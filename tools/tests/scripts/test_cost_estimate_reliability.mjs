import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  calculateLineCost,
  normalizeCostRequest,
  pricingRequestSnapshot,
  publishEstimate as strictPublishEstimate,
  validateCostRequest,
  validateEstimate as strictValidateEstimate,
  validateRateQuote as strictValidateRateQuote,
} from "../../scripts/cost-estimate.mjs";
import {
  captureMcpResponse,
  digestObject,
  ledgerCounts,
  normalizeMeter,
  readSnapshot,
  reserveQuery,
  updateAttempt,
  withLedger,
  sha256,
  acquirePricingLock,
  releasePricingLock,
  PRICING_ROOT,
} from "../../scripts/_lib/pricing-evidence.mjs";
import { evidenceBackedFixture, fixtureRequestOptions } from "./test_cost_estimate_fixture.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SCRIPT = new URL("../../scripts/cost-estimate.mjs", import.meta.url).pathname;
const validateEstimate = (estimate, options) =>
  strictValidateEstimate(estimate, fixtureRequestOptions(estimate, options));
const validateRateQuote = (estimate, options) =>
  strictValidateRateQuote(estimate, fixtureRequestOptions(estimate, options));
const publishEstimate = (options) =>
  strictPublishEstimate({
    ...options,
    requestPath: options.requestPath ?? path.join(path.dirname(options.draftPath), "pricing-request.json"),
  });
function directory(t) {
  const dir = fs.mkdtempSync(path.join(HERE, ".pricing-reliability-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function base(dir, resource = {}) {
  return {
    project_name: "synthetic",
    region: "swedencentral",
    output_path: path.join(dir, "estimate.json"),
    resource_list: [
      { name: "app", service_name: "Azure App Service", sku: "B1", quantity: 1, subscription: "workload", ...resource },
    ],
  };
}
function fixture(dir, options = {}) {
  const source = {
    status: "COMPLETE",
    project_name: "synthetic",
    region: "swedencentral",
    currency: "USD",
    resources: [
      {
        ...base(dir).resource_list[0],
        region: "swedencentral",
        retail_price: 2,
        unit_of_measure: "1 Hour",
        notes: "Synthetic evidence only",
        ...options.resource,
      },
    ],
    optimization_notes: [],
    savings_status: "NOT_APPLICABLE",
    savings_reason: "Synthetic",
    eligible_strategies: [],
    data_source: "Azure MCP pricing_get",
    confidence: "High",
    unresolved_items: [],
    budget_exceeded: false,
  };
  if (options.twoQuantities) source.resources.push({ ...source.resources[0], name: "two", quantity: 2 });
  return evidenceBackedFixture(source, dir, { cwd: PRICING_ROOT, ...options });
}

test("monthly preflight blocks incomplete variable recipes and arbitrary unknown services before queries", (t) => {
  const dir = directory(t);
  for (const [service_name, sku, usage] of [
    ["Bandwidth", "Data Transfer Out", null],
    ["Azure Bandwidth", "Zone 1", null],
    ["Azure Cosmos DB", "Serverless", null],
    ["Cosmos DB", "Serverless", { amount: 1, unit: "GB", scope: "aggregate" }],
    ["Storage", "LRS", null],
    ["Azure Storage", "LRS", null],
    ["Private Link", "Standard", { hours: 730, scope: "aggregate" }],
    ["Azure Private Endpoint", "Standard", { hours: 730, ingress_gb: 10, scope: "aggregate" }],
    ["Mystery Service", "Something", { amount: 10, unit: "GB", scope: "aggregate" }],
  ]) {
    const result = validateCostRequest(base(dir, { service_name, sku, usage }));
    assert.equal(result.ok, false, `${service_name} must not infer missing usage`);
    assert.match(result.unresolved_items.join(" "), /billable dimension|unsupported service/);
  }
  assert.equal(validateCostRequest(base(dir)).ok, true, "static hourly controls remain valid");
  assert.equal(
    validateCostRequest(
      base(dir, {
        service_name: "Azure Private Link",
        sku: "Standard",
        usage: { hours: 730, ingress_gb: 10, egress_gb: 20, scope: "aggregate" },
      }),
    ).ok,
    true,
  );
  for (const amount of [null, "unknown", NaN, -1, "", undefined]) {
    assert.equal(
      validateCostRequest(
        base(dir, {
          service_name: "Bandwidth",
          usage: { dimension: "egress_gb", amount, unit: "GB", scope: "aggregate" },
        }),
      ).ok,
      false,
    );
  }
  const zero = base(dir, {
    service_name: "Bandwidth",
    usage: { dimension: "egress_gb", amount: 0, unit: "GB", scope: "aggregate", zero_usage_confirmed: true },
  });
  assert.equal(validateCostRequest(zero).ok, true);
});

test("request hashes retain semantic SKU differences and every logical subscription", (t) => {
  const dir = directory(t);
  const request = base(dir);
  request.resource_list.push({ ...request.resource_list[0], name: "larger", sku: "B2", subscription: "hub" });
  const normalized = normalizeCostRequest(request);
  assert.equal(normalized.estimated_query_groups, 2);
  assert.deepEqual(
    normalized.lines.map((line) => line.subscription),
    ["workload", "hub"],
  );
  const before = digestObject(pricingRequestSnapshot(normalized));
  request.resource_list[0].billing_region = "Global";
  assert.notEqual(digestObject(pricingRequestSnapshot(normalizeCostRequest(request))), before);
  const { resource_list: _resources, ...candidateBase } = base(dir);
  const candidates = normalizeCostRequest({
    ...candidateBase,
    candidate_sets: [
      {
        decision_id: "plan",
        candidates: [{ label: "app", service_name: "Azure App Service", sku: "B1", subscription: "hub" }],
      },
    ],
  });
  assert.equal(candidates.lines[0].subscription, "hub");
});

test("authoritative v2 rejects rate, identity, usage, timestamp, count and coverage tampering", (t) => {
  const estimate = fixture(directory(t));
  assert.deepEqual(validateEstimate(estimate).errors, []);
  const mutations = [
    (value) => {
      delete value.evidence;
    },
    (value) => {
      delete value.resources[0].calculation_basis;
    },
    (value) => {
      value.mcp_calls_used = 0;
    },
    (value) => {
      value.queried_at = "2999-01-01";
    },
    (value) => {
      value.queried_at = "2000-01-01";
    },
    (value) => {
      value.request_sha256 = "bad";
    },
    (value) => {
      value.resources[0].monthly_cost++;
      value.monthly_total++;
      value.yearly_total = value.monthly_total * 12;
    },
    (value) => {
      value.resources[0].calculation_basis.components[0].retail_price++;
    },
    (value) => {
      value.resources[0].calculation_basis.components[0].billing_region = "";
    },
    (value) => {
      value.resources[0].calculation_basis.components[0].product_name = "Different";
    },
    (value) => {
      value.resources[0].calculation_basis.components[0].effective_start_date = "2021-01-01";
    },
    (value) => {
      value.resources[0].calculation_basis.components[0].unit_of_measure = "1 GB";
    },
    (value) => {
      value.resources[0].calculation_basis.components[0].usage_amount = null;
    },
    (value) => {
      value.resources[0].calculation_basis.components[0].unit_conversion.units_per_native_unit = 2;
    },
    (value) => {
      value.resources[0].calculation_basis.components.push(
        structuredClone(value.resources[0].calculation_basis.components[0]),
      );
    },
    (value) => {
      value.resources[0].subscription = "other";
    },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(estimate);
    mutate(copy);
    assert.equal(validateEstimate(copy, { verifyEvidenceFiles: false }).ok, false, mutate.toString());
  }
  const historical = structuredClone(estimate);
  delete historical.schema_version;
  delete historical.evidence;
  assert.equal(validateEstimate(historical).ok, false);
  assert.equal(validateEstimate(historical, { legacyAudit: true }).ok, true);
});

test("controlled evidence readers receive portable declared references for metadata, raw bytes and ledger", (t) => {
  const estimate = fixture(directory(t));
  const references = [];
  const result = validateEstimate(estimate, {
    verifyEvidenceFiles: false,
    readEvidenceFile: (reference) => {
      references.push(reference);
      assert.equal(path.isAbsolute(reference), false);
      return fs.readFileSync(reference);
    },
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.ok(references.some((reference) => reference.endsWith(".raw")));
  assert.ok(references.some((reference) => reference.endsWith("request-ledger.json")));
  const denied = validateEstimate(estimate, {
    readEvidenceFile: () => {
      throw new Error("Controlled read denied");
    },
  });
  assert.equal(denied.ok, false);
});

test("rate quotes use a distinct contract, retain native units, and never pass monthly validation or writeback", (t) => {
  const dir = directory(t);
  const estimate = fixture(dir, {
    purpose: "rate-quote",
    resource: {
      meter_applicability: "Exact synthetic B1 hourly meter",
      native_unit: "1 Hour",
    },
  });
  const request = base(dir, { meter_applicability: "Exact synthetic B1 hourly meter", native_unit: "1 Hour" });
  request.purpose = "rate-quote";
  assert.equal(validateCostRequest(request).ok, true);
  const quote = {
    schema_version: "retail-rate-quote-v1",
    purpose: "rate-quote",
    status: "COMPLETE",
    project_name: estimate.project_name,
    region: estimate.region,
    currency: estimate.currency,
    queried_at: estimate.queried_at,
    data_source: "Azure MCP pricing_get",
    mcp_calls_used: 1,
    direct_api_calls_used: 0,
    unresolved_items: [],
    evidence: estimate.evidence,
    request_snapshot: estimate.request_snapshot,
    resources: estimate.resources.map(({ monthly_cost: _cost, calculation_basis, ...resource }) => ({
      ...resource,
      components: calculation_basis.components.map(
        ({ usage_amount: _amount, usage_scope: _scope, unit_conversion: _conversion, ...component }) => component,
      ),
    })),
  };
  quote.request_sha256 = digestObject(quote.request_snapshot);
  assert.equal(validateRateQuote(quote).ok, true, validateRateQuote(quote).errors.join("; "));
  assert.equal(validateEstimate(quote, { legacyAudit: true }).ok, false);
  const draftPath = path.join(dir, "quote.draft");
  fs.writeFileSync(draftPath, JSON.stringify(quote));
  assert.throws(
    () =>
      publishEstimate({
        draftPath,
        outputPath: path.join(dir, "quote.json"),
        manifestPath: path.join(dir, "manifest.json"),
      }),
    /cannot write a manifest/,
  );
  const published = publishEstimate({ draftPath, outputPath: path.join(dir, "quote.json") });
  assert.match(published.summary, /^RATE QUOTE COMPLETE/);
  assert.equal(Object.hasOwn(published.estimate, "monthly_total"), false);
  assert.equal(validateRateQuote({ ...quote, monthly_total: 0 }).ok, false);
});

test("exact native capture handles offloaded wrappers, no newline, ambiguous content and errors", (t) => {
  const dir = directory(t);
  const output = path.join(dir, "estimate.json");
  const query = { serviceName: "Azure App Service", currencyCode: "USD", priceType: "Consumption" };
  for (const [index, response] of [
    { status: 200, results: { prices: [] } },
    {
      content: [
        { type: "text", text: JSON.stringify({ status: 200, results: { prices: [{ padding: "x".repeat(150000) }] } }) },
      ],
    },
    {
      content: [
        { type: "text", text: '{"prices":[]}' },
        { type: "text", text: '{"prices":[]}' },
      ],
    },
    { status: 429, message: "Synthetic unavailable" },
  ].entries()) {
    const distinctQuery = { ...query, meterName: `fixture-${index}` };
    const call_id = `native-${index}`;
    const response_path = path.join(dir, `${index}.offload`);
    const bytes = Buffer.from(JSON.stringify(response));
    fs.writeFileSync(response_path, bytes);
    reserveQuery({ output, query: distinctQuery, call_id });
    updateAttempt(output, call_id, { state: "issued", issued_at: new Date().toISOString() });
    const result = captureMcpResponse({ output, query: distinctQuery, call_id, response_path });
    assert.deepEqual(readSnapshot(result.raw_path).bytes, bytes);
    assert.equal(result.status, ["EMPTY", "COMPLETE", "FAILED", "FAILED"][index]);
    assert.equal(result.provenance, "caller-supplied-native-call");
    assert.deepEqual(captureMcpResponse({ output, query: distinctQuery, call_id, response_path }), result);
  }
  assert.throws(
    () =>
      reserveQuery({
        output: path.join(dir, "new-name.json"),
        query: { ...query, meterName: "fixture-0" },
        call_id: "duplicate",
      }),
    /already reserved/,
  );
  const counts = withLedger(output, ledgerCounts);
  assert.deepEqual(counts, { issued_requests: 4, unknown_reservations: 0, reserved_requests: 4 });
});

test("no-clobber publication keeps prior bytes and rejects symlinks, source mutation and raw hash changes", (t) => {
  const dir = directory(t);
  const estimate = fixture(dir);
  const draftPath = path.join(dir, "draft.json");
  const outputPath = path.join(dir, "published.json");
  fs.writeFileSync(draftPath, JSON.stringify(estimate));
  publishEstimate({ draftPath, outputPath });
  const before = fs.readFileSync(outputPath);
  fs.writeFileSync(draftPath, JSON.stringify(estimate));
  assert.throws(() => publishEstimate({ draftPath, outputPath, overwrite: true }), /refuse_on_exists/);
  assert.deepEqual(fs.readFileSync(outputPath), before);
  const capture = JSON.parse(fs.readFileSync(estimate.evidence[0].evidence_path));
  fs.appendFileSync(capture.raw_path, " ");
  assert.equal(validateEstimate(estimate).ok, false);
  const link = path.join(dir, "linked");
  fs.symlinkSync(dir, link);
  assert.throws(() => readSnapshot(path.join(link, "draft.json")), /symlinks/);
});

test("preflight and capture lifecycle CLI perform no network and emit reproducible request hashes", (t) => {
  const dir = directory(t);
  const requestPath = path.join(dir, "request.json");
  fs.writeFileSync(requestPath, JSON.stringify(base(dir)));
  const preflight = spawnSync(process.execPath, [SCRIPT, "preflight", "--request", requestPath], { encoding: "utf8" });
  assert.equal(preflight.status, 0, preflight.stderr);
  const output = JSON.parse(preflight.stdout);
  assert.equal(output.request_sha256, digestObject(output.request_snapshot));
  assert.equal(output.purpose, "monthly-estimate");
  assert.throws(
    () => calculateLineCost({ quantity: 1, unit_of_measure: "1 Hour", retail_price: 1, hours_per_month: null }),
    /finite/,
  );
  assert.equal(typeof normalizeMeter, "function");
});

function recapture(estimate, dir, rows) {
  const previous = JSON.parse(fs.readFileSync(estimate.evidence[0].evidence_path));
  const query = {
    serviceName: rows[0].serviceName,
    meterName: rows[0].meterName,
    priceType: "Consumption",
    currencyCode: "USD",
  };
  const output = path.join(dir, "estimate.json");
  const call_id = "replacement-native-call";
  const response_path = path.join(dir, "replacement-native-response.json");
  fs.writeFileSync(response_path, JSON.stringify({ status: 200, results: { prices: rows } }));
  reserveQuery({ output, query, call_id, request_binding_path: previous.request_binding_path });
  updateAttempt(output, call_id, { state: "issued", issued_at: new Date().toISOString() });
  const capture = captureMcpResponse({ output, query, call_id, response_path });
  estimate.queried_at = capture.queried_at;
  estimate.evidence = [{ evidence_path: capture.evidence_path }];
  estimate.mcp_calls_used = 2;
  const component = estimate.resources[0].calculation_basis.components[0];
  component.evidence_ref = {
    evidence_path: capture.evidence_path,
    row_sha256: capture.meter_rows.map((entry) => entry.row_sha256),
  };
  return component;
}

test("single fixed-hourly MCP rows retain missing tier metadata as null with an explicit applicability tag", (t) => {
  const dir = directory(t);
  const estimate = fixture(dir);
  const capture = JSON.parse(fs.readFileSync(estimate.evidence[0].evidence_path));
  const row = { ...capture.normalized_rows[0] };
  delete row.tierMinimumUnits;
  const component = recapture(estimate, dir, [row]);
  assert.equal(validateEstimate(estimate).ok, false);
  component.tier_metadata_status = "not-applicable-fixed-hourly";
  assert.equal(validateEstimate(estimate).ok, true, validateEstimate(estimate).errors.join("; "));
});

test("every native tier band is linked and deterministic totals cannot contradict exact captured rates", (t) => {
  const dir = directory(t);
  const estimate = fixture(dir, {
    resource: { unit_of_measure: "1 GB", usage_amount: 7, usage: { amount: 7, unit: "GB", scope: "aggregate" } },
  });
  const capture = JSON.parse(fs.readFileSync(estimate.evidence[0].evidence_path));
  const rows = [0, 5].map((minimum) => ({
    ...capture.normalized_rows[0],
    unitOfMeasure: "1 GB",
    tierMinimumUnits: minimum,
    retailPrice: minimum ? 2 : 0,
  }));
  const component = recapture(estimate, dir, rows);
  component.unit_of_measure = "1 GB";
  component.usage_amount = 7;
  component.usage_scope = "aggregate";
  component.unit_conversion = {
    native_unit: "1 GB",
    usage_unit: "GB",
    units_per_native_unit: 1,
    reason: "Synthetic identity conversion",
  };
  component.tier_bands = rows.map(({ tierMinimumUnits, retailPrice }) => ({ tierMinimumUnits, retailPrice }));
  delete component.retail_price;
  estimate.resources[0].monthly_cost = 4;
  estimate.monthly_total = 4;
  estimate.yearly_total = 48;
  assert.equal(validateEstimate(estimate).ok, true, validateEstimate(estimate).errors.join("; "));
  for (const mutate of [
    (part) => {
      part.tier_bands[1].retailPrice = 3;
    },
    (part) => {
      part.evidence_ref.row_sha256.pop();
    },
    (part) => {
      part.tier_bands.pop();
    },
    (part) => {
      part.tier_bands.push({ ...part.tier_bands[0] });
    },
    (part) => {
      part.usage_amount = 8;
    },
  ]) {
    const invalid = structuredClone(estimate);
    mutate(invalid.resources[0].calculation_basis.components[0]);
    assert.equal(validateEstimate(invalid).ok, false);
  }
});

test("one captured raw record serves two quantities without duplicate pricing requests", (t) => {
  const dir = directory(t);
  const estimate = fixture(dir, { twoQuantities: true });
  assert.equal(estimate.mcp_calls_used, 1);
  assert.equal(validateEstimate(estimate).ok, true, validateEstimate(estimate).errors.join("; "));
});

test("validation detects raw source changes during controlled reads and cannot certify malformed linked shapes", (t) => {
  const estimate = fixture(directory(t));
  const metadata = JSON.parse(fs.readFileSync(estimate.evidence[0].evidence_path));
  let mutated = false;
  const validation = validateEstimate(estimate, {
    readEvidenceFile: (reference) => {
      if (!mutated && reference.endsWith("request-ledger.json")) {
        fs.appendFileSync(metadata.raw_path, " ");
        mutated = true;
      }
      return fs.readFileSync(reference);
    },
  });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("; "), /source changed/);
  for (const evidence of [42, {}, "not-an-array"]) {
    const invalid = { ...estimate, evidence };
    assert.equal(validateEstimate(invalid).ok, false);
  }
});

test("monthly publication replays deterministically and recovers an interrupted manifest transaction", (t) => {
  const dir = directory(t);
  const estimate = fixture(dir);
  const draftPath = path.join(dir, "draft.json");
  const outputPath = path.join(dir, "published.json");
  const manifestPath = path.join(dir, "sku-manifest.json");
  const original = JSON.stringify({ note: "original source", services: [{ id: "app" }] });
  const interrupted = JSON.stringify({
    note: "interrupted write",
    services: [{ id: "app", cost_estimate_monthly_usd: 999 }],
  });
  fs.writeFileSync(draftPath, JSON.stringify(estimate));
  fs.writeFileSync(manifestPath, interrupted);
  fs.writeFileSync(
    `${outputPath}.publication.json`,
    JSON.stringify({
      schema_version: "pricing-publication-v1",
      output_path: outputPath,
      output_sha256: "not-yet-published",
      draft_sha256: readSnapshot(draftPath).sha256,
      entries: [
        {
          target: manifestPath,
          original_sha256: sha256(original),
          original_base64: Buffer.from(original).toString("base64"),
          staged_sha256: sha256(interrupted),
        },
      ],
    }),
  );
  const first = publishEstimate({ draftPath, outputPath, manifestPath });
  assert.equal(first.estimate.status, "COMPLETE");
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  assert.equal(manifest.note, "original source");
  assert.equal(manifest.services[0].cost_estimate_monthly_usd, 1460);
  assert.equal(fs.existsSync(`${outputPath}.publication.json`), false);
  const secondDraft = path.join(dir, "second-draft.json");
  const secondOutput = path.join(dir, "second-published.json");
  fs.writeFileSync(secondDraft, JSON.stringify(estimate));
  publishEstimate({ draftPath: secondDraft, outputPath: secondOutput, manifestPath });
  assert.deepEqual(fs.readFileSync(outputPath), fs.readFileSync(secondOutput));
  fs.writeFileSync(
    `${outputPath}.publication.json`,
    JSON.stringify({
      schema_version: "pricing-publication-v1",
      output_path: outputPath,
      output_sha256: readSnapshot(outputPath).sha256,
      draft_sha256: "draft-already-removed",
      entries: [],
    }),
  );
  const recovered = publishEstimate({ draftPath, outputPath });
  assert.equal(recovered.estimate.monthly_total, 1460);
  assert.equal(fs.existsSync(`${outputPath}.publication.json`), false);
});

test("full request hashes preserve supplemental subscriptions and assessment charge identities", (t) => {
  const dir = directory(t);
  const manifestPath = path.join(dir, "manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      default_region: "swedencentral",
      environments: ["dev"],
      services: [
        {
          id: "app",
          service: "Azure App Service",
          size: "B1",
          subscription: "hub",
          capacity: { default: 1 },
          commitment: { type: "on-demand" },
        },
      ],
    }),
  );
  const normalized = normalizeCostRequest({
    project_name: "synthetic",
    region: "swedencentral",
    output_path: path.join(dir, "estimate.json"),
    manifest_path: manifestPath,
    supplemental_resources: [{ name: "extra", service_name: "Azure App Service", sku: "B2", subscription: "workload" }],
  });
  assert.deepEqual(
    normalized.lines.map((line) => line.subscription),
    ["hub", "workload"],
  );
  const request = base(dir, { resource_id: "synthetic-resource", charge_id: "compute" });
  request.assessment_basis = {
    cost_view: "Retail",
    period: "month",
    normalization: "730 hours",
    tax: "excluded",
    licensing: "retail",
  };
  request.assumptions = ["Synthetic fixture"];
  const assessment = normalizeCostRequest(request);
  assert.equal(assessment.lines[0].resource_id, "synthetic-resource");
  assert.equal(assessment.lines[0].charge_id, "compute");
  assert.deepEqual(assessment.assessment_basis, request.assessment_basis);
});

test("pricing locks preserve live ownership and recover only recognized dead owners", (t) => {
  const dir = directory(t);
  const lockPath = path.join(dir, "owned.lock");
  const first = acquirePricingLock(lockPath);
  assert.throws(() => acquirePricingLock(lockPath), /live owner/);
  releasePricingLock(first);
  const child = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  assert.equal(child.status, 0);
  fs.writeFileSync(
    lockPath,
    JSON.stringify({ schema_version: "pricing-lock-v1", pid: Number(child.stdout), token: "synthetic-crashed-owner" }),
  );
  const recovered = acquirePricingLock(lockPath);
  releasePricingLock(recovered);
  fs.writeFileSync(lockPath, "unrelated existing data");
  assert.throws(() => acquirePricingLock(lockPath), /preserve/);
  assert.equal(fs.readFileSync(lockPath, "utf8"), "unrelated existing data");
});

test("historical synthetic fixtures preserve explicit collection times throughout their evidence chain", (t) => {
  const dir = directory(t);
  const queriedAt = "2026-11-06T00:00:00Z";
  const source = fixture(directory(t));
  source.queried_at = queriedAt;
  const original = JSON.stringify(source);
  const estimate = evidenceBackedFixture(source, dir, { queriedAt: source.queried_at });
  assert.equal(estimate.queried_at, queriedAt);
  assert.equal(JSON.stringify(source), original);
  const metadata = JSON.parse(fs.readFileSync(path.resolve(dir, estimate.evidence[0].evidence_path)));
  assert.equal(metadata.queried_at, queriedAt);
  assert.equal(metadata.captured_at, queriedAt);
  const ledger = JSON.parse(fs.readFileSync(path.join(dir, "pricing-evidence", "request-ledger.json")));
  assert.equal(ledger.attempts[0].planned_at, queriedAt);
  assert.equal(ledger.attempts[0].issued_at, queriedAt);
  assert.equal(metadata.raw_path.startsWith("../"), false);
  assert.equal(estimate.evidence[0].evidence_path.startsWith("pricing-evidence/"), true);
  assert.equal(
    validateEstimate(estimate, {
      cwd: dir,
      now: new Date(queriedAt),
      readEvidenceFile: (reference) => fs.readFileSync(path.resolve(dir, reference)),
    }).ok,
    true,
  );
  const before = fs.readFileSync(path.resolve(dir, estimate.evidence[0].evidence_path));
  assert.throws(
    () => evidenceBackedFixture(source, dir, { queriedAt: "2026-11-07T00:00:00Z" }),
    /existing pricing evidence/,
  );
  assert.deepEqual(fs.readFileSync(path.resolve(dir, estimate.evidence[0].evidence_path)), before);
});
