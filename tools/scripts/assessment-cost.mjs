#!/usr/bin/env node
/**
 * Offline Cost Management request planning and saved-evidence validation.
 * No authentication, HTTP client, price calculation or resource discovery.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { createAjv } from "./_lib/ajv-validator.mjs";
import { readJson } from "./_lib/json.mjs";
import { validateEstimate } from "./cost-estimate.mjs";

const SCHEMA = readJson(new URL("../schemas/assessment-cost.schema.json", import.meta.url));
const AJV = createAjv().addSchema(SCHEMA);
const DAY = 86400000;
const API_VERSION = "2023-11-01";
const SCOPE =
  /^\/subscriptions\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}(?:\/resourceGroups\/[a-z0-9_().-]{1,90})?$/i;
const DATE_COLUMNS = new Set(["UsageDate", "Date", "BillingMonth"]);
const CURRENCIES = new Set(Intl.supportedValuesOf("currency"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function errorMessage(error) {
  return error instanceof SyntaxError ? "Invalid JSON input or saved evidence" : error.message;
}

function checkShape(value, definition) {
  const validate = AJV.getSchema(definition ? `${SCHEMA.$id}#/$defs/${definition}` : SCHEMA.$id);
  assert(validate(value), (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; "));
}

function timestamp(value) {
  assert(
    typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value),
    "Explicit ISO timestamp with timezone required",
  );
  const parsed = Date.parse(value);
  const day = value.slice(0, 10);
  assert(
    Number.isFinite(parsed) &&
      Number(value.slice(11, 13)) <= 23 &&
      Number(value.slice(14, 16)) <= 59 &&
      Number(value.slice(17, 19)) <= 59 &&
      new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day,
    "Invalid calendar timestamp",
  );
  return parsed;
}

function iso(value) {
  return new Date(value).toISOString();
}

function monthStart(year, month) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, 1);
  return date.getTime();
}

/** All reporting boundaries are UTC instants; MTD includes the explicit as-of instant. */
export function deriveReportingWindows(asOf, { includePriorMtd = false } = {}) {
  const now = timestamp(asOf);
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = monthStart(year, month);
  const previous = monthStart(year, month - 1);
  const period = (id, kind, from, to) => ({ id, kind, from: iso(from), to: iso(to) });
  const periods = [
    period("previous_month", "closed_month", previous, start - 1),
    period("preceding_month", "closed_month", monthStart(year, month - 2), previous - 1),
    period("month_to_date", "month_to_date", start, now),
    period("current_month_forecast", "forecast", start, monthStart(year, month + 1) - 1),
  ];
  if (includePriorMtd) {
    periods.push(period("prior_month_to_date", "month_to_date", previous, Math.min(previous + now - start, start - 1)));
  }
  return periods;
}

/** Reject overlap rather than silently adding subscription and child-RG charges. */
export function validateScopes(scopes, { allowEmpty = false } = {}) {
  assert(
    Array.isArray(scopes) && scopes.length <= 10 && (allowEmpty || scopes.length > 0),
    "Supply one to ten exact approved scopes",
  );
  const seen = [];
  for (const scope of scopes) {
    assert(
      typeof scope === "string" && SCOPE.test(scope) && !scope.endsWith("."),
      "Scope must be an exact ARM subscription/RG with GUID",
    );
    const key = scope.toLowerCase();
    assert(
      !seen.some((s) => s === key || s.startsWith(`${key}/`) || key.startsWith(`${s}/`)),
      "Duplicate or overlapping scopes cannot be aggregated; retain separate reports",
    );
    seen.push(key);
  }
  return [...scopes];
}

function validatePeriod(period, operation, asOf) {
  checkShape(period, "period");
  const from = timestamp(period.from);
  const to = timestamp(period.to);
  const now = timestamp(asOf);
  assert(
    from <= to && to - from < 92 * DAY && from >= now - 92 * DAY,
    "Period must be ordered within the bounded 92-day window",
  );
  assert(new Date(from).getUTCHours() === 0 && from % DAY === 0, "Period must begin at a UTC day boundary");
  assert(operation === "forecast" || to <= now, "Historical query cannot end in the future");
  assert(operation !== "forecast" || to <= now + 92 * DAY, "Forecast horizon exceeds 92 days from as-of");
  assert(
    (operation === "forecast") === (period.kind === "forecast"),
    "Forecast and historical period kinds must remain distinct",
  );
  const start = new Date(from);
  const nextMonth = monthStart(start.getUTCFullYear(), start.getUTCMonth() + 1);
  if (period.kind === "closed_month") {
    assert(start.getUTCDate() === 1 && to === nextMonth - 1, "closed_month requires exact calendar-month boundaries");
  }
  if (period.kind === "month_to_date") {
    assert(start.getUTCDate() === 1 && to < nextMonth, "month_to_date must remain inside its calendar month");
  }
}

/** Currency is a reporting expectation, not a fabricated API conversion/filter. */
export function buildCostRequest(request, { approvedScopes, asOf } = {}) {
  checkShape(request, "request");
  assert(
    request.expected_currency === undefined || CURRENCIES.has(request.expected_currency),
    "Unsupported reporting currency",
  );
  validateScopes(approvedScopes);
  assert(
    approvedScopes.some((s) => s.toLowerCase() === request.scope.toLowerCase()),
    "Request scope is not exactly approved",
  );
  validatePeriod(request.period, request.operation, asOf);
  const forecast = request.operation === "forecast";
  assert(
    !forecast || (request.granularity !== "None" && request.group_by.length === 0),
    "Forecast requires Daily/Monthly granularity without grouping",
  );
  const body = {
    type: request.cost_type,
    timeframe: "Custom",
    timePeriod: { from: request.period.from, to: request.period.to },
    ...(forecast ? { includeActualCost: true, includeFreshPartialCost: false } : {}),
    dataset: {
      granularity: request.granularity,
      aggregation: { totalCost: { name: request.metric, function: "Sum" } },
      ...(request.group_by.length ? { grouping: request.group_by.map((name) => ({ type: "Dimension", name })) } : {}),
    },
  };
  return {
    request_path: `${request.scope}/providers/Microsoft.CostManagement/${request.operation}?api-version=${API_VERSION}`,
    body,
  };
}

export function planCostQueries(config) {
  const allowed = new Set(["as_of", "scopes", "periods", "cost_type", "metric", "expected_currency", "group_by"]);
  assert(
    config &&
      typeof config === "object" &&
      !Array.isArray(config) &&
      Object.keys(config).every((key) => allowed.has(key)),
    "Unknown cost plan fields; unsupported filters must not silently widen collection",
  );
  const {
    as_of,
    scopes,
    periods = deriveReportingWindows(as_of),
    cost_type = "ActualCost",
    metric = "PreTaxCost",
    expected_currency,
    group_by = ["ServiceName", "ResourceId"],
  } = config;
  validateScopes(scopes);
  assert(
    Array.isArray(periods) &&
      periods.length > 0 &&
      periods.length <= 12 &&
      new Set(periods.map((p) => p?.id)).size === periods.length,
    "Reporting periods need unique IDs and bounded count",
  );
  const requests = scopes.flatMap((scope, index) =>
    periods.map((period) => {
      const request = {
        id: `scope${index + 1}-${period.id}`,
        scope,
        operation: period.kind === "forecast" ? "forecast" : "query",
        period,
        cost_type,
        metric,
        granularity: "Daily",
        group_by: period.kind === "forecast" ? [] : group_by,
        ...(expected_currency === undefined ? {} : { expected_currency }),
      };
      return { request, ...buildCostRequest(request, { approvedScopes: scopes, asOf: as_of }) };
    }),
  );
  return { as_of, scopes, periods, requests };
}

/** Return only a validated same-scope path, never an arbitrary nextLink URL. */
export function allowedPaginationPath(nextLink, request) {
  checkShape(request, "request");
  validateScopes([request.scope]);
  if (nextLink === null || nextLink === undefined || nextLink === "") return null;
  assert(typeof nextLink === "string" && nextLink.length <= 4096, "Invalid pagination link");
  const url = new URL(nextLink, "https://management.azure.com");
  const expected = `${request.scope}/providers/Microsoft.CostManagement/${request.operation}`;
  assert(
    url.origin === "https://management.azure.com" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      url.pathname.toLowerCase() === expected.toLowerCase(),
    "Pagination must remain at the exact authorized Cost Management scope",
  );
  assert(
    url.searchParams.get("api-version") === API_VERSION &&
      [...url.searchParams.keys()].every((k) => ["api-version", "$skiptoken"].includes(k)),
    "Unexpected pagination query parameter",
  );
  assert(
    url.searchParams.getAll("api-version").length === 1 && url.searchParams.getAll("$skiptoken").length <= 1,
    "Repeated pagination parameters",
  );
  if (url.searchParams.has("$skiptoken"))
    assert(
      url.searchParams.get("$skiptoken").length > 0 && url.searchParams.get("$skiptoken").length <= 2048,
      "Invalid pagination token",
    );
  return `${url.pathname}${url.search}`;
}

function decimal(value) {
  assert(
    (typeof value === "number" &&
      Number.isFinite(value) &&
      (!Number.isInteger(value) || Number.isSafeInteger(value))) ||
      typeof value === "string",
    "Cost must be a finite safe decimal",
  );
  const text = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(text);
  assert(match && text.length <= 100, "Invalid cost decimal");
  const scale = (match[3]?.length ?? 0) - Number(match[4] ?? 0);
  assert(Math.abs(scale) <= 30, "Cost precision exceeds bounded decimal support");
  return {
    units: BigInt(`${match[1]}${match[2]}${match[3] ?? ""}`) * 10n ** BigInt(Math.max(-scale, 0)),
    scale: Math.max(scale, 0),
  };
}

function formatDecimal({ units, scale }) {
  const sign = units < 0n ? "-" : "";
  const digits = (units < 0n ? -units : units).toString().padStart(scale + 1, "0");
  const text = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, "") : digits;
  return units === 0n ? "0" : `${sign}${text}`;
}

export function sumCosts(values) {
  const parts = values.map(decimal);
  const scale = Math.max(0, ...parts.map((p) => p.scale));
  return formatDecimal({ units: parts.reduce((sum, p) => sum + p.units * 10n ** BigInt(scale - p.scale), 0n), scale });
}

function multiplyCost(a, b) {
  const left = decimal(a);
  const right = decimal(b);
  return formatDecimal({ units: left.units * right.units, scale: left.scale + right.scale });
}

function rowDate(value) {
  const text = String(value);
  const day = /^\d{8}$/.test(text)
    ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6)}`
    : /^\d{4}-\d\d-\d\d$/.test(text)
      ? text
      : iso(timestamp(text)).slice(0, 10);
  assert(/^\d{4}-\d\d-\d\d$/.test(day), "Invalid response date");
  timestamp(`${day}T00:00:00Z`);
  return day;
}

export function createNotAssessedEvidence(request, reason) {
  checkShape(request, "request");
  assert(typeof reason === "string" && reason.trim(), "Missing-data reason required");
  return {
    id: request.id,
    source_kind: "actual",
    status: "not_assessed",
    request,
    provenance: null,
    series: [],
    page_count: 0,
    next_request_path: null,
    gaps: [reason],
  };
}

/** Normalize only pruned saved owner responses; failed/unfinished data is never a full total. */
export function normalizeCostCollection(collection, { approvedScopes, asOf, provenance } = {}) {
  checkShape(collection, "collection");
  const request = collection.request;
  timestamp(collection.collected_at);
  assert(timestamp(collection.collected_at) <= timestamp(asOf), "Collection cannot be future-dated");
  const { request_path } = buildCostRequest(request, { approvedScopes, asOf: collection.collected_at });
  checkShape(provenance, "provenance");
  assert(
    provenance.source === collection.source && provenance.collected_at === collection.collected_at,
    "Source provenance mismatch",
  );
  const result = { ...createNotAssessedEvidence(request, "No successful response pages"), provenance };
  const gaps = [];
  const series = new Map();
  const paths = new Set();
  const bodies = new Set();
  const rowKeys = new Set();
  let expected = request_path;
  let successful = 0;
  let rowsSeen = 0;
  let completed = false;
  let integrityFailure = false;
  for (const page of collection.pages) {
    try {
      assert(expected !== null, "Unexpected page after terminal response");
      const requestPath = allowedPaginationPath(page.request_path, request);
      assert(requestPath === expected, "Missing, reordered or mismatched pagination request path");
      assert(!paths.has(requestPath), "Repeated pagination path");
      paths.add(requestPath);
      if (page.status_code !== 200 || page.body?.error) {
        gaps.push(
          `Cost Management response unavailable (HTTP ${page.status_code}${page.body?.error ? `, ${page.body.error.code}` : ""})`,
        );
        break;
      }
      const properties = page.body?.properties;
      assert(
        properties && Array.isArray(properties.columns) && Array.isArray(properties.rows),
        "Empty or malformed API response is not a zero-cost result",
      );
      const bodyKey = JSON.stringify(properties);
      assert(!bodies.has(bodyKey), "Repeated response page");
      bodies.add(bodyKey);
      const names = properties.columns.map((column) => column.name);
      const dates = names.filter((name) => DATE_COLUMNS.has(name));
      const monetaryNames =
        request.operation === "forecast" && request.metric === "Cost" ? ["Cost", "PreTaxCost"] : [request.metric];
      const monetaryColumns = names.filter((name) => monetaryNames.includes(name));
      assert(monetaryColumns.length === 1, "Required monetary column missing or ambiguous");
      const monetaryColumn = monetaryColumns[0];
      const permitted = new Set([...monetaryNames, "Currency", "CostStatus", ...request.group_by, ...DATE_COLUMNS]);
      assert(
        new Set(names).size === names.length && names.every((name) => permitted.has(name)),
        "Duplicate or unsupported response columns; prune sensitive columns",
      );
      assert(
        names.includes("Currency") && request.group_by.every((name) => names.includes(name)),
        "Required cost/currency/group columns missing",
      );
      assert(
        dates.length <= 1 && (request.granularity === "None" || dates.length === 1),
        "Granularity requires an unambiguous date column",
      );
      assert(
        request.operation !== "forecast" || names.includes("CostStatus"),
        "Forecast evidence requires CostStatus; never infer a projection",
      );
      assert(
        properties.columns.find((c) => c.name === monetaryColumn).type === "Number" &&
          properties.columns.find((c) => c.name === "Currency").type === "String" &&
          properties.columns
            .filter((c) => request.group_by.includes(c.name) || c.name === "CostStatus")
            .every((c) => c.type === "String"),
        "Metric/currency column types invalid",
      );
      for (const row of properties.rows) {
        assert(rowsSeen < (request.operation === "forecast" ? 100 : 100000), "Response exceeds bounded row limit");
        assert(row.length === names.length, "Response row length differs from declared columns");
        const values = Object.fromEntries(names.map((name, index) => [name, row[index]]));
        const currency = values.Currency;
        assert(CURRENCIES.has(currency), "Invalid response currency");
        const costStatus = values.CostStatus ?? "Actual";
        assert(
          ["Actual", "Forecast"].includes(costStatus) && (request.operation === "forecast" || costStatus === "Actual"),
          "Actual and forecast row types must remain distinct",
        );
        const dimensions = {};
        for (const name of request.group_by) {
          assert(typeof values[name] === "string" && values[name].length <= 2048, "Invalid grouping dimension");
          if (name === "ResourceId" && values[name])
            assert(
              values[name].toLowerCase().startsWith(`${request.scope.toLowerCase()}/`),
              "Resource attribution escapes authorized scope",
            );
          dimensions[name] = values[name];
        }
        if (dates.length) {
          const date = rowDate(values[dates[0]]);
          assert(
            date >= iso(timestamp(request.period.from)).slice(0, 10) &&
              date <= iso(timestamp(request.period.to)).slice(0, 10),
            "Response date outside requested period",
          );
          dimensions[dates[0]] = date;
        }
        const key = JSON.stringify([currency, costStatus, dimensions]);
        assert(!rowKeys.has(key), "Duplicate cost row would double count charges");
        rowKeys.add(key);
        const amount = sumCosts([values[monetaryColumn]]);
        const seriesKey = `${currency}:${costStatus}`;
        if (!series.has(seriesKey))
          series.set(seriesKey, { currency, cost_status: costStatus, amount: "0", groups: [] });
        const bucket = series.get(seriesKey);
        bucket.groups.push({ dimensions, amount });
        bucket.amount = sumCosts([bucket.amount, amount]);
        rowsSeen++;
      }
      successful++;
      expected = allowedPaginationPath(properties.nextLink, request);
      assert(expected === null || !paths.has(expected), "Repeated nextLink");
      completed = expected === null;
    } catch (error) {
      gaps.push(error.message);
      integrityFailure = true;
      expected = null;
      completed = false;
      break;
    }
  }
  if (!collection.pages.length) gaps.push("Cost Management not queried or response unavailable");
  if (expected !== null && collection.pages.length)
    gaps.push("Pagination incomplete; reported amounts are observed subtotals only");
  if (!integrityFailure && completed && rowsSeen === 0) {
    if (request.operation === "forecast")
      gaps.push("Forecast unavailable: successful response contained no forecast rows");
    else if (request.expected_currency)
      series.set(`${request.expected_currency}:Actual`, {
        currency: request.expected_currency,
        cost_status: "Actual",
        amount: "0",
        groups: [],
      });
    else gaps.push("Successful empty query has no declared reporting currency; no numeric zero assigned");
  }
  if (request.operation === "forecast" && rowsSeen && ![...series.values()].some((s) => s.cost_status === "Forecast"))
    gaps.push("Forecast API returned history only; quantitative forecast unavailable");
  if (request.expected_currency && [...series.values()].some((s) => s.currency !== request.expected_currency))
    gaps.push("Returned currency differs from reporting expectation; no conversion performed");
  if (completed && request.period.kind === "month_to_date")
    gaps.push("Month-to-date billing may be delayed or revised; not a final invoice");
  const usable = [...series.values()].filter((s) => request.operation !== "forecast" || s.cost_status === "Forecast");
  const blockingGaps = gaps.filter((gap) => !gap.startsWith("Month-to-date billing"));
  result.status = !usable.length
    ? "not_assessed"
    : completed && successful > 0 && !blockingGaps.length
      ? "complete"
      : "partial";
  result.series = [...series.values()];
  result.page_count = paths.size;
  result.next_request_path = expected;
  result.gaps = [...new Set(gaps)];
  return result;
}

/** Comparisons never mix MTD/full months, incomplete evidence, currencies or metrics. */
export function compareCostEvidence(current, previous, currency) {
  const fail = (reason) => ({ comparable: false, reason });
  for (const value of [current, previous]) {
    if (value.status !== "complete" || value.request.operation !== "query")
      return fail("Complete historical queries required");
  }
  const a = current.request;
  const b = previous.request;
  if (["scope", "cost_type", "metric"].some((key) => a[key].toLowerCase() !== b[key].toLowerCase()))
    return fail("Scope, metric and cost type must match");
  if (!isDeepStrictEqual(a.group_by, b.group_by) || a.granularity !== b.granularity)
    return fail("Attribution and granularity must match");
  const af = timestamp(a.period.from);
  const bf = timestamp(b.period.from);
  const at = timestamp(a.period.to);
  const bt = timestamp(b.period.to);
  const calendarMonths = a.period.kind === "closed_month" && b.period.kind === "closed_month" && af === bt + 1;
  const matchedMtd =
    a.period.kind === "month_to_date" &&
    b.period.kind === "month_to_date" &&
    at - af === bt - bf &&
    monthStart(new Date(bf).getUTCFullYear(), new Date(bf).getUTCMonth() + 1) === af;
  const equalCustom = a.period.kind === "custom" && b.period.kind === "custom" && at - af === bt - bf && af > bt;
  if (!calendarMonths && !matchedMtd && !equalCustom)
    return fail("Periods are not comparable calendar months or equal elapsed windows");
  const find = (value) => value.series.find((s) => s.currency === currency && s.cost_status === "Actual");
  const left = find(current);
  const right = find(previous);
  if (!left || !right) return fail("Matching currency evidence unavailable");
  const change = sumCosts([left.amount, multiplyCost(right.amount, "-1")]);
  return {
    comparable: true,
    currency,
    current: left.amount,
    previous: right.amount,
    change,
    percent_change: Number(right.amount) === 0 ? null : (Number(change) / Math.abs(Number(right.amount))) * 100,
  };
}

function verifyReference(reference, readEvidence, asOf, ttlDays) {
  assert(typeof readEvidence === "function", "Local evidence reader required; references cannot self-certify");
  assert(
    reference.path &&
      !path.isAbsolute(reference.path) &&
      !reference.path.includes("\\") &&
      !reference.path.split("/").some((part) => ["", ".", ".."].includes(part)) &&
      !reference.path.includes(":"),
    "Evidence path must remain relative to approved project root",
  );
  const bytes = readEvidence(reference.path);
  assert(Buffer.isBuffer(bytes) || typeof bytes === "string", "Evidence reader must return original bytes");
  assert(createHash("sha256").update(bytes).digest("hex") === reference.sha256, "Evidence SHA-256 mismatch");
  const age = timestamp(asOf) - timestamp(reference.collected_at);
  assert(age >= 0 && age <= ttlDays * DAY, "Evidence is stale or future-dated");
  return JSON.parse(bytes.toString());
}

export function assessmentCostStatus(evidence, estimates, gaps = []) {
  const entries = [...evidence, ...estimates];
  if (!entries.some((e) => e.status !== "not_assessed")) return "not_assessed";
  return entries.every((e) => e.status === "complete") && gaps.length === 0 ? "complete" : "partial";
}

/** Validate structure, source equivalence, freshness and savings without IO when a reader is supplied. */
export function validateAssessmentCost(report, { asOf, readEvidence, approvedScopes, approvedPlan } = {}) {
  const errors = [];
  const attempt = (label, action) => {
    try {
      action();
    } catch (error) {
      errors.push(`${label}: ${errorMessage(error)}`);
    }
  };
  attempt("schema", () => checkShape(report));
  if (errors.length) return { valid: false, errors };
  attempt("timestamps", () => {
    assert(
      timestamp(report.as_of) <= timestamp(report.generated_at) && timestamp(report.generated_at) <= timestamp(asOf),
      "Report timestamps must not be future-dated or precede as_of",
    );
    assert(timestamp(asOf) - timestamp(report.generated_at) <= 7 * DAY, "Report is stale; refresh before acceptance");
  });
  attempt("scopes", () => validateScopes(report.scopes, { allowEmpty: true }));
  if (approvedScopes !== undefined)
    attempt("authorization", () => {
      validateScopes(approvedScopes, { allowEmpty: true });
      assert(
        isDeepStrictEqual(
          report.scopes.map((s) => s.toLowerCase()).sort(),
          approvedScopes.map((s) => s.toLowerCase()).sort(),
        ),
        "Report scopes differ from approved scope receipt",
      );
    });
  if (approvedPlan !== undefined)
    attempt("reporting authorization", () => {
      const planned = planCostQueries(approvedPlan);
      assert(timestamp(report.as_of) === timestamp(planned.as_of), "Reporting as-of differs from approved plan");
      assert(isDeepStrictEqual(report.periods, planned.periods), "Reporting periods differ from approved plan");
      assert(
        isDeepStrictEqual(
          report.scopes.map((s) => s.toLowerCase()).sort(),
          planned.scopes.map((s) => s.toLowerCase()).sort(),
        ),
        "Billing scopes differ from approved plan",
      );
      const identity = (r) =>
        JSON.stringify([
          r.scope.toLowerCase(),
          r.operation,
          r.period.id,
          r.period.kind,
          timestamp(r.period.from),
          timestamp(r.period.to),
          r.cost_type,
          r.metric,
          r.granularity,
          r.group_by,
          r.expected_currency ?? null,
        ]);
      assert(
        isDeepStrictEqual(
          report.evidence.map((e) => identity(e.request)).sort(),
          planned.requests.map((r) => identity(r.request)).sort(),
        ),
        "Cost requests/metrics/currencies differ from approved plan",
      );
    });
  const ids = new Set();
  const requests = new Set();
  const byId = new Map();
  const periods = new Map(report.periods.map((p) => [p.id, p]));
  if (periods.size !== report.periods.length) errors.push("Duplicate reporting period IDs");
  for (const period of report.periods)
    attempt(`period ${period.id}`, () =>
      validatePeriod(period, period.kind === "forecast" ? "forecast" : "query", report.as_of),
    );
  for (const evidence of report.evidence) {
    attempt(`evidence ${evidence.id}`, () => {
      assert(!ids.has(evidence.id) && evidence.id === evidence.request.id, "Duplicate or inconsistent evidence ID");
      ids.add(evidence.id);
      byId.set(evidence.id, evidence);
      const req = evidence.request;
      buildCostRequest(req, { approvedScopes: report.scopes, asOf: report.as_of });
      assert(
        isDeepStrictEqual(req.period, periods.get(req.period.id)),
        "Evidence period differs from declared reporting period",
      );
      const identity = JSON.stringify([
        req.scope.toLowerCase(),
        req.period.from,
        req.period.to,
        req.operation,
        req.cost_type,
        req.metric,
      ]);
      assert(
        !requests.has(identity),
        "Duplicate cost evidence; retain attribution within one query, never sum duplicate charges",
      );
      requests.add(identity);
      if (evidence.provenance === null) {
        assert(
          evidence.status === "not_assessed" &&
            evidence.series.length === 0 &&
            evidence.page_count === 0 &&
            evidence.next_request_path === null &&
            evidence.gaps.length > 0,
          "Unqueried cost must remain not_assessed with gaps and no amounts",
        );
      } else {
        assert(
          timestamp(evidence.provenance.collected_at) <= timestamp(report.generated_at),
          "Source collected after report generation",
        );
        const source = verifyReference(evidence.provenance, readEvidence, asOf, 7);
        const normalized = normalizeCostCollection(source, {
          approvedScopes: report.scopes,
          asOf,
          provenance: evidence.provenance,
        });
        assert(isDeepStrictEqual(evidence, normalized), "Normalized evidence differs from original saved source");
      }
    });
  }
  for (const scope of report.scopes) {
    for (const period of report.periods) {
      if (
        !report.evidence.some(
          (e) => e.request.scope.toLowerCase() === scope.toLowerCase() && e.request.period.id === period.id,
        )
      )
        errors.push(`Missing evidence/gap record for scope ${scope}, period ${period.id}`);
    }
  }
  const estimateSources = new Set();
  for (const estimate of report.estimates) {
    attempt(`estimate ${estimate.id}`, () => {
      assert(!ids.has(estimate.id), "Duplicate estimate ID");
      ids.add(estimate.id);
      assert(
        estimate.provenance.source === "cost-estimate-subagent",
        "Retail estimate must reference the existing pricing leaf output",
      );
      assert(
        timestamp(estimate.provenance.collected_at) <= timestamp(report.generated_at),
        "Retail source collected after report generation",
      );
      assert(
        !estimateSources.has(estimate.provenance.path) && !estimateSources.has(estimate.provenance.sha256),
        "Duplicate retail estimate source",
      );
      estimateSources.add(estimate.provenance.path);
      estimateSources.add(estimate.provenance.sha256);
      assert(CURRENCIES.has(estimate.currency), "Unsupported retail currency");
      const source = verifyReference(estimate.provenance, readEvidence, asOf, 30);
      const validation = validateEstimate(source, { verifyEvidenceFiles: false });
      assert(validation.ok, `Invalid retail leaf output: ${validation.errors.join("; ")}`);
      assert(
        !source.decisions?.length && source.resources.length > 0,
        "Candidate-only or empty retail output is not a workload estimate",
      );
      assert(
        source.queried_at === estimate.provenance.collected_at && source.currency === estimate.currency,
        "Retail estimate source time/currency mismatch",
      );
      if (estimate.monthly_total !== null) {
        assert(
          source.status === "COMPLETE" &&
            estimate.status === "complete" &&
            estimate.gaps.length === 0 &&
            sumCosts([source.monthly_total]) === estimate.monthly_total,
          "Retail amount must exactly reference a complete verified leaf result",
        );
      } else
        assert(
          estimate.status === "not_assessed" && estimate.gaps.length > 0,
          "Unavailable retail estimate must list gaps, not a fabricated total",
        );
    });
  }
  const usedResources = new Set();
  for (const opportunity of report.opportunities) {
    attempt(`opportunity ${opportunity.id}`, () => {
      assert(!ids.has(opportunity.id), "Duplicate opportunity ID");
      ids.add(opportunity.id);
      const baseline = byId.get(opportunity.baseline_evidence_id);
      assert(
        baseline?.status === "complete" &&
          baseline.request.operation === "query" &&
          baseline.request.period.kind === "closed_month",
        "Savings need a complete closed-month actual baseline, never retail/forecast/partial evidence",
      );
      assert(baseline.request.group_by.includes("ResourceId"), "Savings require resource-level actual attribution");
      const series = baseline.series.find((s) => s.currency === opportunity.currency && s.cost_status === "Actual");
      assert(series, "Savings currency differs from actual baseline");
      assert(
        ["azure-advisor", "azure-monitor-utilization"].includes(opportunity.provenance.source),
        "Savings need separately authorized utilization/Advisor evidence",
      );
      assert(
        timestamp(opportunity.provenance.collected_at) <= timestamp(report.generated_at),
        "Savings source collected after report generation",
      );
      const source = verifyReference(opportunity.provenance, readEvidence, asOf, 7);
      const expected = {
        source: opportunity.provenance.source,
        collected_at: opportunity.provenance.collected_at,
        scope: baseline.request.scope,
        period: baseline.request.period,
        cost_type: baseline.request.cost_type,
        metric: baseline.request.metric,
        currency: opportunity.currency,
        resource_ids: opportunity.resource_ids,
        reduction_fraction: opportunity.reduction_fraction,
        method: "baseline_fraction",
      };
      const { basis, ...binding } = source;
      assert(isDeepStrictEqual(binding, expected), "Savings method/targets/baseline differ from saved evidence");
      assert(
        basis &&
          typeof basis.rationale === "string" &&
          basis.rationale.trim() &&
          Array.isArray(basis.evidence_refs) &&
          basis.evidence_refs.length > 0 &&
          basis.evidence_refs.length <= 10,
        "A claimed reduction fraction alone is not savings evidence; rationale and captured observations required",
      );
      const observedResources = new Set();
      for (const reference of basis.evidence_refs) {
        checkShape(reference, "provenance");
        assert(
          ["azure-advisor", "azure-monitor-utilization"].includes(reference.source) &&
            reference.sha256 !== opportunity.provenance.sha256 &&
            timestamp(reference.collected_at) <= timestamp(report.generated_at),
          "Savings basis must reference distinct current Advisor/utilization observations",
        );
        const observed = verifyReference(reference, readEvidence, asOf, 7);
        assert(
          observed.source === reference.source &&
            observed.collected_at === reference.collected_at &&
            observed.scope === baseline.request.scope &&
            Array.isArray(observed.observations) &&
            observed.observations.length > 0 &&
            observed.observations.length <= 1000,
          "Savings observations lack matching source/time/scope",
        );
        for (const observation of observed.observations) {
          assert(
            observation &&
              typeof observation.resource_id === "string" &&
              observation.resource_id.toLowerCase().startsWith(`${baseline.request.scope.toLowerCase()}/`) &&
              observation.data &&
              typeof observation.data === "object" &&
              !Array.isArray(observation.data) &&
              Object.keys(observation.data).length > 0,
            "Savings observations need scoped resource identities and captured tool data",
          );
          observedResources.add(observation.resource_id.toLowerCase());
        }
      }
      assert(
        Number(opportunity.reduction_fraction) > 0 && Number(opportunity.reduction_fraction) <= 1,
        "Savings fraction must be in (0, 1]",
      );
      const amounts = [];
      for (const resource of opportunity.resource_ids) {
        const key = resource.toLowerCase();
        assert(observedResources.has(key), "Savings target absent from captured utilization/Advisor observations");
        assert(
          !usedResources.has(key),
          "Overlapping savings would double count a resource, period, metric or cost view",
        );
        assert(
          !report.exclusions.some((e) => e.resource_id.toLowerCase() === key),
          "Shared/excluded allocation cannot fund savings",
        );
        const groups = series.groups.filter((g) => g.dimensions.ResourceId?.toLowerCase() === key);
        assert(groups.length > 0, "Savings target absent from actual baseline");
        usedResources.add(key);
        amounts.push(...groups.map((g) => g.amount));
      }
      const baselineAmount = sumCosts(amounts);
      assert(
        Number(baselineAmount) > 0 &&
          multiplyCost(baselineAmount, opportunity.reduction_fraction) === opportunity.amount,
        "Unsupported savings amount/method; exact baseline arithmetic required",
      );
    });
  }
  if (report.allocation_notes.length === 0) errors.push("Explicit shared-cost/allocation notes required");
  if (report.evidence.length === 0 && report.estimates.length === 0 && report.gaps.length === 0)
    errors.push("No evidence requires an explicit reporting gap");
  if (report.status !== assessmentCostStatus(report.evidence, report.estimates, report.gaps))
    errors.push("Report status does not match evidence coverage/gaps");
  return { valid: errors.length === 0, errors };
}

function localReader(root) {
  const realRoot = fs.realpathSync(root);
  return (relative) => {
    assert(typeof relative === "string" && !path.isAbsolute(relative), "Project-relative evidence required");
    const file = fs.realpathSync(path.resolve(realRoot, relative));
    assert(file.startsWith(`${realRoot}${path.sep}`), "Evidence path/symlink escapes project root");
    assert(
      fs.statSync(file).isFile() && fs.statSync(file).size <= 32 * 1024 * 1024,
      "Evidence file must be bounded regular JSON",
    );
    return fs.readFileSync(file);
  };
}

export function runAssessmentCostCli(args = process.argv.slice(2)) {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        "as-of": { type: "string" },
        root: { type: "string" },
        input: { type: "string" },
        scope: { type: "string", multiple: true },
        "approved-plan": { type: "string" },
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      console.log(
        "Offline only: assessment-cost.mjs windows --as-of ISO | plan --input CONFIG.json | normalize --input SOURCE.json --scope ARM_SCOPE --as-of ISO --root PROJECT | validate --input REPORT.json --as-of ISO --root PROJECT [--scope ARM_SCOPE] [--approved-plan JSON]. ISO timestamps use millisecond precision. JSON to stdout; no requests executed.",
      );
      return 0;
    }
    const [operation, positionalInput, ...extra] = positionals;
    assert(!values.input || !positionalInput, "Use --input or positional input, not both");
    const input = values.input ?? positionalInput;
    assert(extra.length === 0, "Unexpected positional arguments");
    let result;
    if (operation === "windows") {
      assert(!input, "windows accepts no file");
      result = deriveReportingWindows(values["as-of"]);
    } else if (operation === "plan") {
      assert(input, "Plan configuration path required");
      result = planCostQueries(readJson(input));
    } else {
      assert(
        ["normalize", "validate"].includes(operation) && input,
        "Expected windows, plan, normalize or validate operation",
      );
      timestamp(values["as-of"]);
      const file = path.resolve(input);
      const root = path.resolve(
        values.root ??
          (path.basename(path.dirname(file)) === "contracts" ? path.dirname(path.dirname(file)) : path.dirname(file)),
      );
      const readEvidence = localReader(root);
      const relative = path.relative(root, file).split(path.sep).join("/");
      const bytes = readEvidence(relative);
      const data = JSON.parse(bytes.toString());
      if (operation === "validate")
        result = validateAssessmentCost(data, {
          asOf: values["as-of"],
          readEvidence,
          approvedScopes: values.scope,
          approvedPlan: values["approved-plan"] === undefined ? undefined : JSON.parse(values["approved-plan"]),
        });
      else {
        const provenance = {
          path: relative,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          collected_at: data.collected_at,
          source: data.source,
        };
        result = normalizeCostCollection(data, { approvedScopes: values.scope, asOf: values["as-of"], provenance });
      }
    }
    console.log(JSON.stringify(result));
    return result.valid === false ? 1 : 0;
  } catch (error) {
    console.log(JSON.stringify({ valid: false, errors: [errorMessage(error)] }));
    return 1;
  }
}

const invokedAsScript =
  process.argv[1] &&
  fs.existsSync(process.argv[1]) &&
  fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) process.exit(runAssessmentCostCli());
