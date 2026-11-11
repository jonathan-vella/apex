#!/usr/bin/env node
/**
 * Read-only Azure Cost Management collector with physical historical consolidation,
 * sequential pacing, and HTTP 429 Retry-After / ratelimit backoff.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { readJson, writeJson } from "./_lib/json.mjs";
import {
  allowedPaginationPath,
  assessmentCostStatus,
  buildCostRequest,
  normalizeCostCollection,
  planCostQueries,
  validateAssessmentCost,
} from "./assessment-cost.mjs";

const DAY = 86400000;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function parseRetryAfterMs(headers = {}, attempt = 1, baseMs = 2000) {
  const lowered = Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) => [key.toLowerCase(), String(value).trim()]),
  );
  const candidateKeys = [
    "x-ms-ratelimit-microsoft.costmanagement-entity-retry-after",
    "x-ms-ratelimit-microsoft.costmanagement-clienttype-retry-after",
    "x-ms-ratelimit-microsoft.costmanagement-qpu-retry-after",
    "retry-after",
  ];
  for (const key of candidateKeys) {
    const raw = lowered[key];
    if (!raw) continue;
    if (/^\d+(?:\.\d+)?$/.test(raw)) {
      return Math.min(120000, Math.max(500, Math.ceil(Number(raw) * 1000)));
    }
    const dateMs = Date.parse(raw);
    if (Number.isFinite(dateMs)) {
      return Math.min(120000, Math.max(500, dateMs - Date.now()));
    }
  }
  const exp = Math.min(60000, baseMs * 2 ** Math.max(0, attempt - 1));
  return exp;
}

/**
 * Group planned logical requests into physical Cost Management calls:
 * eligible non-forecast Daily queries on the same scope within <92 days share one physical Query.
 */
export function planPhysicalCostCalls(planned) {
  const byScope = new Map();
  for (const entry of planned.requests) {
    const key = entry.request.scope.toLowerCase();
    if (!byScope.has(key)) byScope.set(key, []);
    byScope.get(key).push(entry);
  }
  const physicalCalls = [];
  for (const entries of byScope.values()) {
    const historical = entries.filter((e) => e.request.operation === "query");
    const forecasts = entries.filter((e) => e.request.operation === "forecast");
    const first = historical[0]?.request;
    const minFrom = historical.length
      ? historical.reduce(
          (min, e) => (Date.parse(e.request.period.from) < Date.parse(min) ? e.request.period.from : min),
          historical[0].request.period.from,
        )
      : null;
    const maxTo = historical.length
      ? historical.reduce(
          (max, e) => (Date.parse(e.request.period.to) > Date.parse(max) ? e.request.period.to : max),
          historical[0].request.period.to,
        )
      : null;
    const canConsolidate =
      historical.length > 1 &&
      historical.every(
        (e) =>
          e.request.granularity === "Daily" &&
          e.request.cost_type === first.cost_type &&
          e.request.metric === first.metric &&
          e.request.expected_currency === first.expected_currency &&
          isDeepStrictEqual(e.request.group_by, first.group_by) &&
          Date.parse(e.request.period.from) % DAY === 0,
      ) &&
      Date.parse(maxTo) - Date.parse(minFrom) < 92 * DAY;

    if (canConsolidate) {
      const synthRequest = {
        ...first,
        id: `${first.id.split("-")[0]}-consolidated_historical`,
        period: { id: "consolidated_historical", kind: "custom", from: minFrom, to: maxTo },
      };
      const built = buildCostRequest(synthRequest, { approvedScopes: planned.scopes, asOf: planned.as_of });
      physicalCalls.push({
        kind: "consolidated_query",
        physical_period: { from: minFrom, to: maxTo },
        request_path: built.request_path,
        body: built.body,
        logical_entries: historical,
      });
    } else {
      for (const item of historical) {
        physicalCalls.push({
          kind: "single_query",
          physical_period: null,
          request_path: item.request_path,
          body: item.body,
          logical_entries: [item],
        });
      }
    }
    for (const item of forecasts) {
      physicalCalls.push({
        kind: "forecast",
        physical_period: null,
        request_path: item.request_path,
        body: item.body,
        logical_entries: [item],
      });
    }
  }
  return physicalCalls;
}

function pruneCostBody(body, request) {
  if (!body || typeof body !== "object") return null;
  if (body.error && typeof body.error.code === "string") {
    return { error: { code: body.error.code } };
  }
  if (!body.properties || !Array.isArray(body.properties.columns) || !Array.isArray(body.properties.rows)) {
    return body;
  }
  const permitted = new Set([
    request.metric,
    ...(request.operation === "forecast" && request.metric === "Cost" ? ["PreTaxCost"] : []),
    "Currency",
    "CostStatus",
    ...request.group_by,
    "UsageDate",
    "Date",
    "BillingMonth",
  ]);
  const keepIndices = [];
  const columns = [];
  body.properties.columns.forEach((col, idx) => {
    if (permitted.has(col.name)) {
      keepIndices.push(idx);
      columns.push({ name: col.name, type: col.type });
    }
  });
  const rows = body.properties.rows.map((row) => keepIndices.map((idx) => row[idx]));
  return {
    properties: {
      columns,
      rows,
      nextLink: body.properties.nextLink ?? null,
    },
  };
}

function defaultSleep(ms) {
  if (ms <= 0) return;
  const buf = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(buf, 0, 0, ms);
}

function defaultHttpExecutor(url, body) {
  const args = ["rest", "--method", "post", "--url", url, "--headers", "Content-Type=application/json"];
  if (body !== null) args.push("--body", JSON.stringify(body));
  const res = spawnSync("az", [...args, "--output", "json"], { encoding: "utf8", timeout: 120000 });
  if (res.status === 0) {
    return { status_code: 200, headers: {}, body: JSON.parse(res.stdout) };
  }
  const stderr = res.stderr || "";
  const is429 = /\b429\b|Too Many Requests/i.test(stderr);
  const retryMatch = /retry[- ]after[:\s]+(\d+)/i.exec(stderr);
  return {
    status_code: is429 ? 429 : 500,
    headers: retryMatch ? { "retry-after": retryMatch[1] } : {},
    body: { error: { code: is429 ? "TooManyRequests" : "CliRequestFailed" } },
  };
}

export function executePhysicalCostPlan(
  planConfig,
  {
    projectRoot,
    collectedAt,
    executor = defaultHttpExecutor,
    sleep = defaultSleep,
    minIntervalMs = 1500,
    maxAttempts = 5,
  } = {},
) {
  const planned = planCostQueries(planConfig);
  const physicalCalls = planPhysicalCostCalls(planned);
  const metaCostDir = path.join(projectRoot, "_meta/cost");
  fs.mkdirSync(metaCostDir, { recursive: true });

  const attemptsLog = [];
  const rawEnvelopes = new Map();

  physicalCalls.forEach((call, callIdx) => {
    if (callIdx > 0) sleep(minIntervalMs);
    const sampleRequest = call.logical_entries[0].request;
    const pages = [];
    let nextPath = call.request_path;
    let firstPage = true;

    while (nextPath && pages.length < 100) {
      const url = `https://management.azure.com${nextPath}`;
      let response = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        response = executor(url, firstPage ? call.body : null);
        attemptsLog.push({
          request_path: nextPath,
          kind: call.kind,
          attempt,
          status_code: response.status_code,
        });
        if (response.status_code !== 429) break;
        if (attempt < maxAttempts) {
          sleep(parseRetryAfterMs(response.headers, attempt));
        }
      }
      firstPage = false;
      const pruned = pruneCostBody(response.body, sampleRequest);
      pages.push({
        request_path: nextPath,
        status_code: response.status_code,
        body: pruned,
      });
      if (response.status_code !== 200 || !pruned?.properties?.nextLink) break;
      nextPath = allowedPaginationPath(pruned.properties.nextLink, sampleRequest);
    }

    for (const logical of call.logical_entries) {
      rawEnvelopes.set(logical.request.id, {
        source: "azure-cost-management",
        collected_at: collectedAt,
        request: logical.request,
        ...(call.physical_period ? { physical_request_period: call.physical_period } : {}),
        pages,
      });
    }
  });

  // First-pass normalization to identify verified single-currency scopes for empty historical sibling periods.
  const prelim = new Map();
  for (const [id, env] of rawEnvelopes.entries()) {
    const dummyProv = {
      path: `_meta/cost/${id}.json`,
      sha256: "0".repeat(64),
      collected_at: collectedAt,
      source: "azure-cost-management",
    };
    prelim.set(
      id,
      normalizeCostCollection(env, { approvedScopes: planned.scopes, asOf: collectedAt, provenance: dummyProv }),
    );
  }

  for (const [id, env] of rawEnvelopes.entries()) {
    const current = prelim.get(id);
    if (
      env.request.operation === "query" &&
      !env.request.expected_currency &&
      current.status === "not_assessed" &&
      current.gaps.some((g) => g.includes("Successful empty query has no declared reporting currency"))
    ) {
      const siblings = [...prelim.values()].filter(
        (item) =>
          item.id !== id &&
          item.request.scope.toLowerCase() === env.request.scope.toLowerCase() &&
          item.request.operation === "query" &&
          item.request.cost_type === env.request.cost_type &&
          item.request.metric === env.request.metric &&
          item.status === "complete" &&
          item.series.length === 1 &&
          item.series[0].groups.length > 0,
      );
      const currencies = new Set(siblings.map((s) => s.series[0].currency));
      if (siblings.length > 0 && currencies.size === 1) {
        env.inferred_currency_from = {
          period_id: siblings[0].request.period.id,
          currency: siblings[0].series[0].currency,
        };
      }
    }
  }

  const evidence = [];
  for (const [id, env] of rawEnvelopes.entries()) {
    const relPath = `_meta/cost/${id}.json`;
    const fullPath = path.join(projectRoot, relPath);
    const encoded = `${JSON.stringify(env, null, 2)}\n`;
    fs.writeFileSync(fullPath, encoded, "utf8");
    const provenance = {
      path: relPath,
      sha256: sha256(Buffer.from(encoded, "utf8")),
      collected_at: collectedAt,
      source: "azure-cost-management",
    };
    evidence.push(
      normalizeCostCollection(env, {
        approvedScopes: planned.scopes,
        asOf: collectedAt,
        provenance,
      }),
    );
  }

  writeJson(path.join(metaCostDir, "attempts.json"), { collected_at: collectedAt, attempts: attemptsLog });

  const report = {
    schema_version: "1.0",
    as_of: planned.as_of,
    generated_at: collectedAt,
    status: assessmentCostStatus(evidence, [], []),
    scopes: planned.scopes,
    periods: planned.periods,
    evidence,
    estimates: [],
    opportunities: [],
    exclusions: [],
    allocation_notes: [
      "Scoped subscription/resource-group actuals reflect authorized billing scopes; shared platform allocation requires owner rules.",
    ],
    gaps: [],
  };
  report.status = assessmentCostStatus(report.evidence, report.estimates, report.gaps);
  const reportPath = path.join(projectRoot, "contracts/03-cost-management.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  writeJson(reportPath, report);
  return { report, physical_call_count: physicalCalls.length, attempts: attemptsLog };
}

export function runCollectCostCli(argv = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        plan: { type: "string" },
        root: { type: "string" },
        "collected-at": { type: "string" },
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      console.log(
        "Usage: collect-assessment-cost.mjs --plan _meta/cost-plan.json --root agent-output/<project> [--collected-at ISO]",
      );
      return 0;
    }
    if (!values.plan || !values.root) throw new Error("--plan and --root are required");
    const planConfig = readJson(values.plan);
    const collectedAt = values["collected-at"] ?? new Date().toISOString();
    const out = executePhysicalCostPlan(planConfig, {
      projectRoot: path.resolve(values.root),
      collectedAt,
    });
    const validation = validateAssessmentCost(out.report, {
      root: path.resolve(values.root),
      asOf: collectedAt,
      readEvidence: (rel) => fs.readFileSync(path.join(path.resolve(values.root), rel)),
      approvedScopes: planConfig.scopes,
      approvedPlan: planConfig,
    });
    if (!validation.valid) throw new Error(validation.errors.join("; "));
    console.log(
      JSON.stringify({
        valid: true,
        status: out.report.status,
        physical_call_count: out.physical_call_count,
        logical_evidence_count: out.report.evidence.length,
      }),
    );
    return 0;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, error: error.message }));
    return 1;
  }
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) process.exit(runCollectCostCli());
