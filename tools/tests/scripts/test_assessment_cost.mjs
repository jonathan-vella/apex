import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import {
  allowedPaginationPath,
  assessmentCostStatus,
  buildCostRequest,
  compareCostEvidence,
  createNotAssessedEvidence,
  deriveReportingWindows,
  normalizeCostCollection,
  planCostQueries,
  sumCosts,
  validateAssessmentCost,
  validateScopes,
} from "../../scripts/assessment-cost.mjs";
import { evidenceBackedFixture } from "./test_cost_estimate_fixture.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SCRIPT = path.join(ROOT, "tools/scripts/assessment-cost.mjs");
const AS_OF = "2026-03-15T12:30:00.000Z";
const SUB = "/subscriptions/00000000-0000-4000-8000-000000000001";
const RG = `${SUB}/resourceGroups/synthetic`;
const RESOURCE = `${RG}/providers/Microsoft.Compute/virtualMachines/synthetic`;
const OTHER = `${RG}/providers/Microsoft.Compute/virtualMachines/other`;
const WINDOWS = deriveReportingWindows(AS_OF);
const PRICING_DIRECTORY = fs.mkdtempSync(path.join(ROOT, ".assessment-retail-test-"));
const PRICING_SOURCES = new Map();
const PRICING_REQUESTS = new WeakMap();
let pricingSequence = 0;
after(() => fs.rmSync(PRICING_DIRECTORY, { recursive: true, force: true }));

function request(overrides = {}) {
  return {
    id: "previous",
    scope: RG,
    operation: "query",
    period: WINDOWS[0],
    cost_type: "ActualCost",
    metric: "PreTaxCost",
    granularity: "None",
    group_by: ["ServiceName", "ResourceId"],
    expected_currency: "USD",
    ...overrides,
  };
}

function page(req, rows = [[0.1, "USD", "Compute", RESOURCE]], overrides = {}) {
  return {
    request_path: buildCostRequest(req, { approvedScopes: [RG], asOf: AS_OF }).request_path,
    status_code: 200,
    body: {
      properties: {
        columns: [
          { name: req.metric, type: "Number" },
          { name: "Currency", type: "String" },
          ...req.group_by.map((name) => ({ name, type: "String" })),
        ],
        rows,
        nextLink: null,
      },
    },
    ...overrides,
  };
}

function collection(req = request(), pages = [page(req)]) {
  return { source: "azure-cost-management", collected_at: AS_OF, request: req, pages };
}

function retained(source, name = "evidence/cost.json", sourceName = "azure-cost-management", collectedAt = AS_OF) {
  const bytes = Buffer.from(JSON.stringify(source));
  const provenance = {
    path: name,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    collected_at: collectedAt,
    source: sourceName,
  };
  return { bytes, provenance };
}

function normalized(source = collection(), name) {
  const saved = retained(source, name, "azure-cost-management", source.collected_at);
  return {
    ...saved,
    evidence: normalizeCostCollection(source, { approvedScopes: [RG], asOf: AS_OF, provenance: saved.provenance }),
  };
}

function report(evidence = [], overrides = {}) {
  return {
    schema_version: "1.0",
    as_of: AS_OF,
    generated_at: AS_OF,
    status: assessmentCostStatus(evidence, [], []),
    scopes: [...new Set(evidence.map((e) => e.request.scope))],
    periods: [
      ...new Map(
        (evidence.length ? evidence.map((e) => e.request.period) : [WINDOWS[0]]).map((p) => [p.id, p]),
      ).values(),
    ],
    evidence,
    estimates: [],
    opportunities: [],
    exclusions: [],
    allocation_notes: ["Scope totals only. Shared allocation is unknown; no workload-wide sum claimed."],
    gaps: [],
    ...overrides,
  };
}

function validate(value, sources = new Map(), overrides = {}) {
  return validateAssessmentCost(value, {
    root: PRICING_DIRECTORY,
    asOf: AS_OF,
    readEvidence: (name) => {
      assert.ok(sources.has(name) || PRICING_SOURCES.has(name), `Missing synthetic evidence ${name}`);
      return sources.get(name) ?? PRICING_SOURCES.get(name);
    },
    ...overrides,
  });
}

test("calendar defaults handle leap February, nonleap February, year rollover and UTC offsets", () => {
  const leap = deriveReportingWindows("2024-03-01T00:00:00Z");
  assert.equal(leap[0].from, "2024-02-01T00:00:00.000Z");
  assert.equal(leap[0].to, "2024-02-29T23:59:59.999Z");
  assert.equal(leap[2].from, leap[2].to);
  assert.equal(deriveReportingWindows("2025-03-01T00:00:00Z")[0].to, "2025-02-28T23:59:59.999Z");
  assert.equal(deriveReportingWindows("2026-01-03T11:00:00Z")[0].from, "2025-12-01T00:00:00.000Z");
  assert.equal(deriveReportingWindows("2026-01-03T11:00:00Z")[1].from, "2025-11-01T00:00:00.000Z");
  assert.equal(deriveReportingWindows("2024-03-01T00:30:00+02:00")[2].to, "2024-02-29T22:30:00.000Z");
  assert.equal(deriveReportingWindows("2024-02-29T22:30:00Z")[2].to, "2024-02-29T22:30:00.000Z");
  for (const invalid of [
    "2024-02-30T00:00:00Z",
    "2024-03-01T24:00:00Z",
    "2024-03-01",
    "2024-03-01T00:00:00",
    "not-a-date",
  ]) {
    assert.throws(() => deriveReportingWindows(invalid), /timestamp/);
  }
});

test("plans retain exact approved scopes, reporting dates and metric without currency conversion", () => {
  const plan = planCostQueries({
    as_of: AS_OF,
    scopes: [RG],
    expected_currency: "EUR",
    cost_type: "AmortizedCost",
    metric: "Cost",
  });
  assert.equal(plan.requests.length, 4);
  const previous = plan.requests[0];
  assert.equal(previous.body.type, "AmortizedCost");
  assert.equal(previous.body.dataset.aggregation.totalCost.name, "Cost");
  assert.deepEqual(previous.body.timePeriod, { from: WINDOWS[0].from, to: WINDOWS[0].to });
  assert.equal(previous.body.timeframe, "Custom");
  assert.equal(previous.request.expected_currency, "EUR");
  assert.equal(previous.body.dataset.filter, undefined);
  assert.equal(previous.body.dataset.top, undefined);
  assert.ok(previous.request_path.startsWith(`${RG}/providers/Microsoft.CostManagement/query?`));
  assert.equal(plan.requests[3].body.includeActualCost, true);
  assert.equal(plan.requests[3].body.includeFreshPartialCost, false);
  assert.equal(plan.requests[3].body.dataset.grouping, undefined);
  assert.throws(() => planCostQueries({ as_of: AS_OF, scopes: [RG], filters: ["ignored"] }), /must not silently widen/);
});

test("scope validation refuses wider, malformed, duplicate and overlapping collections", () => {
  assert.deepEqual(validateScopes([RG, `${SUB}/resourceGroups/other`]), [RG, `${SUB}/resourceGroups/other`]);
  assert.deepEqual(validateScopes([SUB]), [SUB]);
  for (const scopes of [
    [],
    ["/subscriptions/no-guid"],
    [`${SUB}/`],
    [`${RG}/providers/Microsoft.Compute`],
    ["/providers/Microsoft.Management/managementGroups/synthetic"],
    ["/providers/Microsoft.Billing/billingAccounts/synthetic"],
    [RG, RG.toLowerCase()],
    [SUB, RG],
    [RG, SUB],
    [`${RG}/../other`],
    [`${RG}?token=bad`],
    Array.from({ length: 11 }, (_, i) => `${SUB}/resourceGroups/rg${i}`),
  ])
    assert.throws(() => validateScopes(scopes));
  assert.throws(
    () => buildCostRequest(request({ scope: SUB }), { approvedScopes: [RG], asOf: AS_OF }),
    /exactly approved/,
  );
});

test("request validation rejects invalid periods, types, metrics, currencies, dimensions and unbounded fields", () => {
  const invalid = [
    { cost_type: "Usage" },
    { metric: "RetailPrice" },
    { expected_currency: "usd" },
    { expected_currency: "AAA" },
    { granularity: "Weekly" },
    { group_by: ["CustomerName"] },
    { group_by: ["ServiceName", "ResourceId", "ResourceType"] },
    { group_by: ["ServiceName", "ServiceName"] },
    { filter: { dimensions: [] } },
    { period: { ...WINDOWS[0], from: "2026-02-02T00:00:00Z" } },
    { period: { ...WINDOWS[0], to: "2026-02-28T00:00:00Z" } },
    { period: { id: "old", kind: "custom", from: "2025-01-01T00:00:00Z", to: AS_OF } },
    { period: { id: "reversed", kind: "custom", from: "2026-03-10T00:00:00Z", to: "2026-03-09T00:00:00Z" } },
    { period: { id: "future", kind: "custom", from: "2026-03-10T00:00:00Z", to: "2026-03-20T00:00:00Z" } },
    { period: { id: "not-day", kind: "custom", from: "2026-03-10T12:00:00Z", to: AS_OF } },
    { operation: "forecast" },
    { period: WINDOWS[3] },
  ];
  for (const override of invalid)
    assert.throws(() => buildCostRequest(request(override), { approvedScopes: [RG], asOf: AS_OF }));
  assert.throws(() => planCostQueries({ as_of: AS_OF, scopes: [RG], periods: [WINDOWS[0], WINDOWS[0]] }), /unique/);
  assert.throws(
    () =>
      buildCostRequest(request({ operation: "forecast", period: WINDOWS[3] }), { approvedScopes: [RG], asOf: AS_OF }),
    /Forecast requires/,
  );
});

test("normalization uses declared column order and exact decimal sums without mutating sources", () => {
  const req = request();
  const first = page(req);
  first.body.properties.columns = [
    { name: "ResourceId", type: "String" },
    { name: "Currency", type: "String" },
    { name: "ServiceName", type: "String" },
    { name: "PreTaxCost", type: "Number" },
  ];
  first.body.properties.rows = [
    [RESOURCE, "USD", "Compute", 0.1],
    [OTHER, "USD", "Compute", "0.2"],
  ];
  const input = collection(req, [first]);
  const before = JSON.stringify(input);
  const output = normalized(input).evidence;
  assert.equal(output.status, "complete");
  assert.equal(output.series[0].amount, "0.3");
  assert.equal(output.series[0].groups[0].dimensions.ResourceId, RESOURCE);
  assert.equal(JSON.stringify(input), before);
  assert.equal(sumCosts(["123456789012345.123456", "0.000001", "-0.1"]), "123456789012345.023457");
  assert.equal(sumCosts([1e-7, 2e-7, -3e-7]), "0");
  assert.throws(() => sumCosts([null]), /finite/);
  assert.throws(() => sumCosts([NaN]), /finite/);
  assert.throws(() => sumCosts([Number.MAX_SAFE_INTEGER + 1]), /finite/);
});

test("actual credits and refunds remain signed in groups and positive, zero or negative net totals", () => {
  const req = request({ id: "credits", group_by: ["ResourceId", "ChargeType"] });
  for (const [charge, expected] of [
    [100, "70"],
    [30, "0"],
    [10, "-20"],
  ]) {
    const saved = normalized(
      collection(req, [
        page(req, [
          [charge, "USD", RESOURCE, "Usage"],
          [-25, "USD", RESOURCE, "Refund"],
          [-5, "USD", OTHER, "Credit"],
        ]),
      ]),
      "_meta/cost/credits.json",
    );
    const evidence = saved.evidence;
    assert.equal(evidence.status, "complete");
    assert.equal(evidence.series[0].amount, expected);
    assert.deepEqual(
      evidence.series[0].groups.slice(1).map((group) => group.amount),
      ["-25", "-5"],
    );
    assert.equal(validate(report([evidence]), new Map([[saved.provenance.path, saved.bytes]])).valid, true);
  }
});

test("pagination follows exact page order and exposes only authorized continuation paths", () => {
  const req = request();
  const first = page(req);
  const next = `${first.request_path}&$skiptoken=synthetic%2Btoken`;
  first.body.properties.nextLink = `https://management.azure.com${next}`;
  const second = page(req, [[0.2, "USD", "Compute", OTHER]], { request_path: next });
  const full = normalized(collection(req, [first, second])).evidence;
  assert.equal(full.status, "complete");
  assert.equal(full.page_count, 2);
  assert.equal(full.series[0].amount, "0.3");
  assert.equal(full.next_request_path, null);
  const partial = normalized(collection(req, [first])).evidence;
  assert.equal(partial.status, "partial");
  assert.equal(partial.next_request_path, next);
  assert.equal(partial.series[0].amount, "0.1");
  assert.match(partial.gaps.join(" "), /incomplete/);
});

test("pagination rejects foreign hosts, wider scopes, alternate operations, credentials and parameters", () => {
  const req = request();
  const valid = buildCostRequest(req, { approvedScopes: [RG], asOf: AS_OF }).request_path;
  for (const link of [
    `https://example.invalid${valid}`,
    `http://management.azure.com${valid}`,
    `https://management.azure.com:444${valid}`,
    `https://user:secret@management.azure.com${valid}`,
    valid.replace(RG, SUB),
    valid.replace("/query?", "/forecast?"),
    `${valid}&api-version=2023-11-01`,
    `${valid}&token=secret`,
    `${valid}#fragment`,
    `${valid}&$skiptoken=`,
    valid.replace("2023-11-01", "2099-01-01"),
  ])
    assert.throws(() => allowedPaginationPath(link, req));
  const first = page(req);
  first.body.properties.nextLink = `https://example.invalid${valid}`;
  const output = normalized(collection(req, [first])).evidence;
  assert.equal(output.status, "partial");
  assert.equal(output.next_request_path, null);
  assert.match(output.gaps.join(" "), /exact authorized/);
});

test("unfinished, repeated, duplicated and extra pages cannot produce complete or double counted charges", () => {
  const req = request();
  const first = page(req);
  const next = `${first.request_path}&$skiptoken=page2`;
  first.body.properties.nextLink = next;
  const duplicateRow = page(req, first.body.properties.rows, { request_path: next });
  const repeatedLink = structuredClone(first);
  repeatedLink.body.properties.nextLink = first.request_path;
  const cases = [
    [first, duplicateRow],
    [first, first],
    [repeatedLink],
    [page(req), page(req, [[0.2, "USD", "Compute", OTHER]])],
    [first, page(req, [[0.2, "USD", "Compute", OTHER]], { request_path: `${next}wrong` })],
  ];
  for (const pages of cases) {
    const output = normalized(collection(req, pages)).evidence;
    assert.notEqual(output.status, "complete");
    assert.equal(output.series[0].amount, "0.1");
    assert.ok(output.gaps.length > 0);
  }
});

test("denial, throttling, missing pages and empty API envelopes remain explicit gaps, not zeros", () => {
  const req = request();
  for (const pages of [
    [],
    [page(req, [], { status_code: 403, body: { error: { code: "AuthorizationFailed" } } })],
    [page(req, [], { status_code: 429, body: { error: { code: "TooManyRequests" } } })],
    [page(req, [], { status_code: 204, body: null })],
    [page(req, [], { body: {} })],
    [page(req, [], { body: null })],
    [page(req, [], { body: { properties: {} } })],
  ]) {
    const output = normalized(collection(req, pages)).evidence;
    assert.equal(output.status, "not_assessed");
    assert.deepEqual(output.series, []);
    assert.ok(output.gaps.length);
  }
});

test("literal empty rows are numeric zero only for successful complete currency-declared historical queries", () => {
  const req = request();
  const success = normalized(collection(req, [page(req, [])])).evidence;
  assert.equal(success.status, "complete");
  assert.deepEqual(success.series, [{ currency: "USD", cost_status: "Actual", amount: "0", groups: [] }]);
  const first = page(req, []);
  first.body.properties.nextLink = `${first.request_path}&$skiptoken=next`;
  const unfinished = normalized(collection(req, [first])).evidence;
  assert.equal(unfinished.status, "not_assessed");
  assert.deepEqual(unfinished.series, []);
  const unspecified = request();
  delete unspecified.expected_currency;
  const unknown = normalized(collection(unspecified, [page(unspecified, [])])).evidence;
  assert.equal(unknown.status, "not_assessed");
  assert.deepEqual(unknown.series, []);
});

test("malformed response columns, rows, dates and cross-scope attribution cannot silently pass", () => {
  const req = request();
  const mutations = [
    (p) => {
      p.body.properties.columns[0].name = "Cost";
    },
    (p) => {
      p.body.properties.columns[0].type = "String";
    },
    (p) => {
      p.body.properties.columns[1].name = "PreTaxCost";
    },
    (p) => {
      p.body.properties.columns[2].name = "CustomerEmail";
    },
    (p) => {
      p.body.properties.rows[0][1] = "usd";
    },
    (p) => {
      p.body.properties.rows[0][0] = null;
    },
    (p) => {
      p.body.properties.rows[0].pop();
    },
    (p) => {
      p.body.properties.rows[0][3] = `${SUB}/resourceGroups/unapproved/providers/Test/resource`;
    },
  ];
  for (const mutate of mutations) {
    const first = page(req);
    mutate(first);
    const output = normalized(collection(req, [first])).evidence;
    assert.notEqual(output.status, "complete");
    assert.ok(output.gaps.length);
  }
  const daily = request({ granularity: "Daily" });
  const first = page(daily);
  first.body.properties.columns.push({ name: "UsageDate", type: "Number" });
  first.body.properties.rows[0].push(20260301);
  assert.match(normalized(collection(daily, [first])).evidence.gaps.join(" "), /outside requested/);
  first.body.properties.rows[0][4] = 20260230;
  assert.match(normalized(collection(daily, [first])).evidence.gaps.join(" "), /calendar timestamp/);
});

test("custom timezone-qualified boundaries compare response dates as UTC instants, not lexical prefixes", () => {
  const req = request({
    period: { id: "offset", kind: "custom", from: "2026-02-28T19:00:00-05:00", to: "2026-03-01T18:59:59-05:00" },
    granularity: "Daily",
  });
  const first = page(req);
  first.body.properties.columns.push({ name: "UsageDate", type: "DateTime" });
  first.body.properties.rows[0].push("2026-03-01T00:00:00Z");
  assert.equal(normalized(collection(req, [first])).evidence.status, "complete");
  first.body.properties.rows[0][4] = "2026-02-28T00:00:00Z";
  assert.match(normalized(collection(req, [first])).evidence.gaps.join(" "), /outside requested/);
  first.body.properties.rows[0][4] = "2026-03-01 unparsed suffix";
  assert.notEqual(normalized(collection(req, [first])).evidence.status, "complete");
});

test("historical query evidence cannot predate its requested end instant", () => {
  const source = collection(request({ period: WINDOWS[2] }));
  source.collected_at = "2026-03-14T12:30:00Z";
  assert.throws(() => normalized(source), /cannot end in the future/);
});

test("currency and actual/amortized views remain separate; expected currency never converts charges", () => {
  const req = request();
  const mixed = normalized(
    collection(req, [
      page(req, [
        [1, "USD", "Compute", RESOURCE],
        [2, "EUR", "Compute", RESOURCE],
      ]),
    ]),
  ).evidence;
  assert.equal(mixed.status, "partial");
  assert.deepEqual(
    mixed.series.map((s) => [s.currency, s.amount]),
    [
      ["USD", "1"],
      ["EUR", "2"],
    ],
  );
  assert.equal(mixed.total, undefined);
  const actual = normalized();
  const amortized = normalized(
    collection(request({ id: "amortized", cost_type: "AmortizedCost" })),
    "evidence/amortized.json",
  );
  const value = report([actual.evidence, amortized.evidence]);
  const sources = new Map([
    [actual.provenance.path, actual.bytes],
    [amortized.provenance.path, amortized.bytes],
  ]);
  const result = validate(value, sources);
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.equal(compareCostEvidence(actual.evidence, amortized.evidence, "USD").comparable, false);
});

function forecastCollection(rows = [], includeStatus = true) {
  const req = request({
    id: "forecast",
    operation: "forecast",
    period: WINDOWS[3],
    granularity: "Daily",
    group_by: [],
  });
  const first = page(req, rows);
  first.body.properties.columns.push({ name: "UsageDate", type: "Number" });
  if (includeStatus) first.body.properties.columns.push({ name: "CostStatus", type: "String" });
  return collection(req, [first]);
}

test("forecast Cost requests accept the documented PreTaxCost response without changing metric provenance", () => {
  const source = forecastCollection();
  source.request.metric = "Cost";
  source.pages[0].body.properties.columns = [
    { name: "UsageDate", type: "Number" },
    { name: "CostStatus", type: "String" },
    { name: "PreTaxCost", type: "Number" },
    { name: "Currency", type: "String" },
  ];
  source.pages[0].body.properties.rows = [
    [20260314, "Actual", 10, "USD"],
    [20260316, "Forecast", 20, "USD"],
  ];
  const saved = normalized(source, "_meta/cost/forecast.json");
  assert.equal(saved.evidence.status, "complete");
  assert.equal(saved.evidence.request.metric, "Cost");
  assert.deepEqual(
    saved.evidence.series.map((series) => [series.cost_status, series.amount]),
    [
      ["Actual", "10"],
      ["Forecast", "20"],
    ],
  );
  assert.equal(validate(report([saved.evidence]), new Map([[saved.provenance.path, saved.bytes]])).valid, true);
  const exact = structuredClone(source);
  exact.pages[0].body.properties.columns[2].name = "Cost";
  assert.equal(normalized(exact).evidence.status, "complete");
  const ambiguous = structuredClone(source);
  ambiguous.pages[0].body.properties.columns.push({ name: "Cost", type: "Number" });
  ambiguous.pages[0].body.properties.rows.forEach((row) => row.push(999));
  assert.match(normalized(ambiguous).evidence.gaps.join(" "), /monetary column.*ambiguous/);
  const wrongType = structuredClone(source);
  wrongType.pages[0].body.properties.columns[2].type = "String";
  assert.match(normalized(wrongType).evidence.gaps.join(" "), /column types invalid/);
  const wrongOperation = structuredClone(source);
  wrongOperation.request.operation = "query";
  wrongOperation.request.period = WINDOWS[0];
  wrongOperation.pages[0].request_path = buildCostRequest(wrongOperation.request, {
    approvedScopes: [RG],
    asOf: AS_OF,
  }).request_path;
  assert.match(normalized(wrongOperation).evidence.gaps.join(" "), /monetary column missing/);
});

test("forecast evidence retains Actual/Forecast partitions and never fabricates unavailable projections", () => {
  const source = forecastCollection([
    [10, "USD", 20260314, "Actual"],
    [20, "USD", 20260316, "Forecast"],
  ]);
  const output = normalized(source).evidence;
  assert.equal(output.status, "complete");
  assert.deepEqual(
    output.series.map((s) => [s.cost_status, s.amount]),
    [
      ["Actual", "10"],
      ["Forecast", "20"],
    ],
  );
  for (const missing of [
    forecastCollection(),
    forecastCollection([[10, "USD", 20260314, "Actual"]]),
    forecastCollection([[20, "USD", 20260316]], false),
  ]) {
    const result = normalized(missing).evidence;
    assert.equal(result.status, "not_assessed");
    assert.equal(
      result.series.some((s) => s.cost_status === "Forecast"),
      false,
    );
    assert.ok(result.gaps.length);
  }
  const denied = forecastCollection();
  denied.pages[0].status_code = 403;
  denied.pages[0].body = { error: { code: "Denied" } };
  assert.deepEqual(normalized(denied).evidence.series, []);
  const excessive = forecastCollection(
    Array.from({ length: 101 }, (_, index) => [1, Intl.supportedValuesOf("currency")[index], 20260316, "Forecast"]),
  );
  delete excessive.request.expected_currency;
  assert.match(normalized(excessive).evidence.gaps.join(" "), /bounded row limit/);
});

test("trends compare adjacent calendar months, not incomplete evidence or month-to-date against full month", () => {
  const current = normalized(collection(request(), [page(request(), [[30, "USD", "Compute", RESOURCE]])])).evidence;
  const previousReq = request({ id: "preceding", period: WINDOWS[1] });
  const previous = normalized(
    collection(previousReq, [page(previousReq, [[20, "USD", "Compute", RESOURCE]])]),
  ).evidence;
  assert.deepEqual(compareCostEvidence(current, previous, "USD"), {
    comparable: true,
    currency: "USD",
    current: "30",
    previous: "20",
    change: "10",
    percent_change: 50,
  });
  const zero = structuredClone(previous);
  zero.series[0].amount = "0";
  assert.equal(compareCostEvidence(current, zero, "USD").percent_change, null);
  assert.equal(compareCostEvidence({ ...current, status: "partial" }, previous, "USD").comparable, false);
  assert.equal(compareCostEvidence(current, previous, "EUR").comparable, false);
  assert.equal(
    compareCostEvidence(current, { ...previous, request: { ...previous.request, metric: "Cost" } }, "USD").comparable,
    false,
  );
  const mtdReq = request({ id: "mtd", period: WINDOWS[2] });
  const mtd = normalized(collection(mtdReq, [page(mtdReq)])).evidence;
  assert.equal(mtd.status, "complete");
  assert.match(mtd.gaps.join(" "), /billing may be delayed/);
  assert.equal(compareCostEvidence(mtd, previous, "USD").comparable, false);
});

test("optional prior MTD matches equal elapsed periods and refuses truncated shorter-month comparisons", () => {
  const make = (period) => ({
    status: "complete",
    request: request({ period }),
    series: [{ currency: "USD", cost_status: "Actual", amount: "1", groups: [] }],
  });
  const matching = deriveReportingWindows(AS_OF, { includePriorMtd: true });
  assert.equal(matching.length, 5);
  assert.equal(compareCostEvidence(make(matching[2]), make(matching[4]), "USD").comparable, true);
  const truncated = deriveReportingWindows("2026-03-31T12:30:00Z", { includePriorMtd: true });
  assert.equal(truncated[4].to, "2026-02-28T23:59:59.999Z");
  assert.equal(compareCostEvidence(make(truncated[2]), make(truncated[4]), "USD").comparable, false);
});

test("reports validate original source bytes, exact normalization, timestamps and explicit scope receipt", () => {
  const saved = normalized();
  const value = report([saved.evidence]);
  const sources = new Map([[saved.provenance.path, saved.bytes]]);
  assert.deepEqual(validate(value, sources, { approvedScopes: [RG] }), { valid: true, errors: [] });
  assert.equal(validate(value, sources, { approvedScopes: [SUB] }).valid, false);
  assert.equal(validate(value, new Map()).valid, false);
  assert.equal(validate(value, new Map([[saved.provenance.path, Buffer.from("{}")]])).valid, false);
  const altered = structuredClone(value);
  altered.evidence[0].series[0].amount = "999";
  assert.match(validate(altered, sources).errors.join(" "), /differs from original/);
  assert.match(validate(value, sources, { asOf: "2026-03-24T12:30:00Z" }).errors.join(" "), /stale/);
  assert.match(validate(value, sources, { asOf: "2026-03-14T12:30:00Z" }).errors.join(" "), /future/);
  const movedTime = structuredClone(value);
  movedTime.evidence[0].provenance.collected_at = "2026-03-16T00:00:00Z";
  assert.equal(validate(movedTime, sources).valid, false);
  const noReader = validateAssessmentCost(value, { asOf: AS_OF });
  assert.match(noReader.errors.join(" "), /reader required/);
});

test("valid hashes cannot swap saved scope, metric or period provenance behind a report", () => {
  const original = normalized();
  for (const field of ["scope", "metric", "period"]) {
    const swapped = collection();
    if (field === "scope") {
      const other = `${SUB}/resourceGroups/other`;
      swapped.request.scope = other;
      swapped.pages[0].request_path = swapped.pages[0].request_path.replace(RG, other);
      swapped.pages[0].body.properties.rows[0][3] = RESOURCE.replace(RG, other);
    } else if (field === "metric") {
      swapped.request.metric = "Cost";
      swapped.pages[0].body.properties.columns[0].name = "Cost";
    } else swapped.request.period = WINDOWS[1];
    const replacement = retained(swapped, `evidence/swapped-${field}.json`);
    const value = report([structuredClone(original.evidence)]);
    value.evidence[0].provenance = replacement.provenance;
    const result = validate(value, new Map([[replacement.provenance.path, replacement.bytes]]));
    assert.equal(result.valid, false, field);
    assert.match(result.errors.join(" "), /not exactly approved|differs from original saved source/, field);
  }
});

test("schema-allowed unknown responses remain unavailable while complete literal empty success alone supports zero", () => {
  const req = request();
  const success = normalized(collection(req, [page(req, [])]));
  const successfulSources = new Map([[success.provenance.path, success.bytes]]);
  assert.equal(validate(report([success.evidence]), successfulSources).valid, true);
  assert.equal(success.evidence.series[0].amount, "0");
  for (const body of [null, {}, { properties: {} }, { properties: { columns: [], rows: [] } }]) {
    const missing = normalized(collection(req, [page(req, [], { body })]));
    const sources = new Map([[missing.provenance.path, missing.bytes]]);
    assert.equal(missing.evidence.status, "not_assessed");
    assert.deepEqual(missing.evidence.series, []);
    assert.equal(validate(report([missing.evidence]), sources).valid, true);
    const fabricated = report([structuredClone(missing.evidence)], { status: "complete" });
    fabricated.evidence[0].status = "complete";
    fabricated.evidence[0].series = [{ currency: "USD", cost_status: "Actual", amount: "0", groups: [] }];
    assert.match(validate(fabricated, sources).errors.join(" "), /differs from original saved source/);
  }
});

test("honest not-assessed and partial reports are valid without whole-workload completion or a retail fallback", () => {
  const missing = createNotAssessedEvidence(request(), "Billing access denied; actual spend unknown");
  assert.equal(validate(report([missing])).valid, true);
  const defaults = planCostQueries({ as_of: AS_OF, scopes: [RG] });
  const entries = defaults.requests.map(({ request: req }) =>
    createNotAssessedEvidence(req, "Not authorized to query this billing category"),
  );
  const denied = report(entries);
  assert.equal(denied.status, "not_assessed");
  assert.equal(validate(denied).valid, true);
  const approvedPlan = { as_of: AS_OF, scopes: [RG] };
  assert.equal(validate(denied, new Map(), { approvedPlan }).valid, true);
  const alteredMetric = structuredClone(denied);
  alteredMetric.evidence[0].request.metric = "Cost";
  assert.match(validate(alteredMetric, new Map(), { approvedPlan }).errors.join(" "), /metrics\/currencies differ/);
  assert.equal(validate(report([missing]), new Map(), { approvedPlan }).valid, false);
  const saved = normalized();
  const sources = new Map([[saved.provenance.path, saved.bytes]]);
  const partial = report([saved.evidence, entries[1]], { status: "partial" });
  assert.equal(validate(partial, sources).valid, true);
  const unmapped = report([missing], { periods: [WINDOWS[0], WINDOWS[1]] });
  assert.match(validate(unmapped).errors.join(" "), /Missing evidence\/gap record/);
  assert.equal(
    validate(report([], { status: "not_assessed", gaps: ["IaC expressions unresolved; no retail estimate available"] }))
      .valid,
    true,
  );
  const fabricated = report([missing], { status: "complete" });
  assert.equal(validate(fabricated).valid, false);
  fabricated.evidence[0].series = [{ currency: "USD", cost_status: "Actual", amount: "0", groups: [] }];
  assert.equal(validate(fabricated).valid, false);
});

test("report validation rejects duplicate evidence, overlaps, unsupported properties and unsafe source paths", () => {
  const saved = normalized();
  const sources = new Map([[saved.provenance.path, saved.bytes]]);
  const duplicate = structuredClone(saved.evidence);
  duplicate.id = "duplicate";
  duplicate.request.id = "duplicate";
  assert.match(validate(report([saved.evidence, duplicate]), sources).errors.join(" "), /Duplicate cost evidence/);
  assert.equal(validate(report([saved.evidence], { scopes: [SUB, RG] }), sources).valid, false);
  assert.equal(validate(report([saved.evidence], { total_actual_cost: "999" }), sources).valid, false);
  for (const name of [
    "../private.json",
    "/private.json",
    "https://example.invalid/file",
    "evidence/../private.json",
    "evidence\\private.json",
  ]) {
    const value = report([structuredClone(saved.evidence)]);
    value.evidence[0].provenance.path = name;
    assert.match(validate(value, sources).errors.join(" "), /relative/);
  }
});

function retailOutput(overrides = {}) {
  const source = {
    status: "COMPLETE",
    project_name: "synthetic",
    region: "swedencentral",
    currency: "USD",
    resources: [
      {
        name: "synthetic",
        service_name: "Azure App Service",
        sku: "Fixture",
        region: "swedencentral",
        quantity: 1,
        monthly_cost: 12,
        unit_of_measure: "1 GB",
        retail_price: 12,
        usage_amount: 1,
        usage: { amount: 1, unit: "GB", scope: "per-instance" },
        notes: "Synthetic fixture, not a quoted Azure rate",
      },
    ],
    monthly_total: 12,
    yearly_total: 144,
    optimization_notes: [],
    savings_status: "NOT_APPLICABLE",
    savings_reason: "No savings claim",
    eligible_strategies: [],
    data_source: "Azure MCP pricing_get",
    queried_at: AS_OF,
    confidence: "High",
    unresolved_items: [],
    mcp_calls_used: 1,
    budget_exceeded: false,
    ...overrides,
  };
  const directory = path.join(PRICING_DIRECTORY, `case-${++pricingSequence}`);
  fs.mkdirSync(directory);
  const linked = evidenceBackedFixture(source, directory, {
    queriedAt: source.queried_at,
    cwd: PRICING_DIRECTORY,
  });
  const result = { ...linked, ...overrides };
  const retainTree = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory()) retainTree(filename);
      else
        PRICING_SOURCES.set(
          path.relative(PRICING_DIRECTORY, filename).split(path.sep).join("/"),
          fs.readFileSync(filename),
        );
    }
  };
  retainTree(directory);
  const request = path
    .relative(PRICING_DIRECTORY, path.join(directory, "pricing-request.json"))
    .split(path.sep)
    .join("/");
  PRICING_REQUESTS.set(result, {
    path: request,
    sha256: createHash("sha256").update(PRICING_SOURCES.get(request)).digest("hex"),
  });
  return result;
}

function estimateFixture(source = retailOutput()) {
  const saved = retained(source, "_meta/cost/retail-output.json", "cost-estimate-subagent", source.queried_at);
  saved.provenance.pricing_request = PRICING_REQUESTS.get(source);
  const estimate = {
    id: "iac-estimate",
    source_kind: "estimate",
    status: "complete",
    provenance: saved.provenance,
    currency: "USD",
    monthly_total: "12",
    assumptions: ["Owner-supplied synthetic usage only; retail estimate, not actual billing"],
    gaps: [],
  };
  return { ...saved, estimate };
}

test("IaC retail estimates retain verified leaf provenance, exact amount and assumptions without billing access", () => {
  const saved = estimateFixture();
  const value = report([], { status: "complete", estimates: [saved.estimate] });
  const sources = new Map([[saved.provenance.path, saved.bytes]]);
  const result = validate(value, sources);
  assert.equal(result.valid, true, result.errors.join("; "));
  for (const change of [
    { source_kind: "actual" },
    { currency: "EUR" },
    { monthly_total: "13" },
    { assumptions: [] },
    { provenance: { ...saved.provenance, source: "azure-cost-management" } },
  ])
    assert.equal(validate({ ...value, estimates: [{ ...saved.estimate, ...change }] }, sources).valid, false);
  assert.match(
    validate(
      value,
      new Map([[saved.provenance.path, Buffer.from(JSON.stringify(retailOutput({ monthly_total: 13 })))]]),
    ).errors.join(" "),
    /SHA-256 mismatch/,
  );
  const stale = estimateFixture(retailOutput({ queried_at: "2026-01-01T00:00:00Z" }));
  assert.match(
    validate(
      report([], { status: "complete", estimates: [stale.estimate] }),
      new Map([[stale.provenance.path, stale.bytes]]),
    ).errors.join(" "),
    /stale/,
  );
  const failed = estimateFixture(
    retailOutput({
      status: "FAILED",
      monthly_total: null,
      yearly_total: null,
      unresolved_items: ["External module unpriced"],
      resources: [{ ...retailOutput().resources[0], monthly_cost: null }],
    }),
  );
  const unknown = {
    ...failed.estimate,
    status: "not_assessed",
    monthly_total: null,
    gaps: ["External module unpriced"],
  };
  const unavailable = validate(
    report([], { status: "not_assessed", estimates: [unknown] }),
    new Map([[failed.provenance.path, failed.bytes]]),
  );
  assert.equal(unavailable.valid, true, unavailable.errors.join("; "));
  assert.equal(
    validate(
      report([], { status: "complete", estimates: [failed.estimate] }),
      new Map([[failed.provenance.path, failed.bytes]]),
    ).valid,
    false,
  );
});

test("root-produced retail evidence imports through independently retained project-relative requests", () => {
  const workspace = path.join(PRICING_DIRECTORY, "separate-workspace");
  const root = path.join(workspace, "agent-output", "synthetic");
  const directory = path.join(root, "evidence", "pricing");
  fs.mkdirSync(directory, { recursive: true });
  const source = retailOutput();
  Object.assign(source.resources[0], {
    unit_of_measure: "1 GB",
    retail_price: 12,
    usage_amount: 1,
    usage: { amount: 1, unit: "GB", scope: "per-instance" },
  });
  const linked = evidenceBackedFixture(source, directory, { queriedAt: AS_OF, cwd: workspace });
  const saved = estimateFixture(linked);
  fs.mkdirSync(path.join(root, "_meta", "cost"), { recursive: true });
  fs.writeFileSync(path.join(root, saved.provenance.path), saved.bytes);
  saved.provenance.pricing_request = {
    path: "evidence/pricing/pricing-request.json",
    sha256: createHash("sha256")
      .update(fs.readFileSync(path.join(directory, "pricing-request.json")))
      .digest("hex"),
  };
  const result = validateAssessmentCost(report([], { status: "complete", estimates: [saved.estimate] }), {
    root,
    asOf: AS_OF,
    readEvidence: (reference) => fs.readFileSync(path.join(root, reference)),
  });
  assert.equal(result.valid, true, result.errors.join("; "));
});

test("a complete retail estimate never fills a denied actual-cost record", () => {
  const saved = estimateFixture();
  const missing = createNotAssessedEvidence(request(), "Billing access denied; actual spend unknown");
  const value = report([missing], { status: "partial", estimates: [saved.estimate] });
  const sources = new Map([[saved.provenance.path, saved.bytes]]);
  assert.equal(validate(value, sources).valid, true);
  assert.deepEqual(value.evidence[0].series, []);
  const fallback = structuredClone(value);
  fallback.evidence[0].series = [{ currency: "USD", cost_status: "Actual", amount: "12", groups: [] }];
  assert.equal(validate(fallback, sources).valid, false);
});

test("documented minimal plan, saved actual, estimate and not-assessed envelopes match the executable contract", () => {
  const reference = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-cost-optimization/references/assessment-cost-contract.md"),
    "utf8",
  );
  const section = reference.split("## Minimal envelope examples")[1];
  assert.ok(section);
  const examples = [...section.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => JSON.parse(match[1]));
  const config = examples.find((value) => value.as_of && value.scopes && !value.schema_version);
  assert.equal(planCostQueries(config).requests.length, 4);
  const actual = normalized(examples.find((value) => value.source === "azure-cost-management"));
  assert.equal(actual.evidence.status, "complete");
  assert.equal(actual.evidence.series[0].amount, "12.5");
  assert.equal(validate(report([actual.evidence]), new Map([[actual.provenance.path, actual.bytes]])).valid, true);
  const estimate = examples.find((value) => value.source_kind === "estimate");
  const saved = estimateFixture();
  assert.match(estimate.provenance.sha256, /^<replace/);
  estimate.provenance.sha256 = saved.provenance.sha256;
  estimate.provenance.pricing_request = saved.provenance.pricing_request;
  assert.equal(
    validate(report([], { status: "complete", estimates: [estimate] }), new Map([[saved.provenance.path, saved.bytes]]))
      .valid,
    true,
  );
  assert.equal(validate(examples.find((value) => value.schema_version === "1.0")).valid, true);
});

function savingsFixture() {
  const req = request();
  const saved = normalized(collection(req, [page(req, [[100, "USD", "Compute", RESOURCE]])]));
  const source = {
    source: "azure-monitor-utilization",
    collected_at: AS_OF,
    scope: RG,
    period: req.period,
    cost_type: req.cost_type,
    metric: req.metric,
    currency: "USD",
    resource_ids: [RESOURCE],
    reduction_fraction: "0.25",
    method: "baseline_fraction",
  };
  const observation = retained(
    {
      source: source.source,
      collected_at: AS_OF,
      scope: RG,
      observations: [
        { resource_id: RESOURCE, data: { synthetic_owner_verified_retirable_fraction: "0.25", interval: req.period } },
      ],
    },
    "evidence/observed-utilization.json",
    source.source,
  );
  source.basis = {
    rationale: "Synthetic observed retirement fraction; independent review must validate the actual collected basis",
    evidence_refs: [observation.provenance],
  };
  const support = retained(source, "evidence/utilization.json", source.source);
  const opportunity = {
    id: "saving",
    description: "Synthetic evidence-backed opportunity; not realized savings",
    baseline_evidence_id: req.id,
    resource_ids: [RESOURCE],
    currency: "USD",
    reduction_fraction: "0.25",
    amount: "25",
    method: "baseline_fraction",
    provenance: support.provenance,
  };
  const value = report([saved.evidence], { opportunities: [opportunity] });
  const sources = new Map([
    [saved.provenance.path, saved.bytes],
    [support.provenance.path, support.bytes],
    [observation.provenance.path, observation.bytes],
  ]);
  return { value, sources, opportunity };
}

test("quantified opportunities require saved utilization evidence, exact actual baseline and no excluded/shared allocation", () => {
  const { value, sources, opportunity } = savingsFixture();
  assert.equal(validate(value, sources).valid, true);
  for (const change of [
    { amount: "26" },
    { amount: "-25" },
    { reduction_fraction: "2" },
    { currency: "EUR" },
    { resource_ids: [OTHER] },
    { baseline_evidence_id: "retail" },
    { method: "retail_difference" },
    { provenance: { ...opportunity.provenance, source: "cost-estimate-subagent" } },
  ])
    assert.equal(validate({ ...value, opportunities: [{ ...opportunity, ...change }] }, sources).valid, false);
  assert.equal(validate(value, new Map([...sources].filter(([name]) => !name.includes("utilization")))).valid, false);
  assert.match(
    validate(
      { ...value, opportunities: [opportunity, { ...opportunity, id: "duplicate-saving" }] },
      sources,
    ).errors.join(" "),
    /double count/,
  );
  assert.match(
    validate(
      { ...value, exclusions: [{ resource_id: RESOURCE, reason: "Shared platform cost not assigned to workload" }] },
      sources,
    ).errors.join(" "),
    /Shared\/excluded/,
  );
  const partial = structuredClone(value);
  partial.status = "partial";
  partial.evidence[0].status = "partial";
  assert.equal(validate(partial, sources).valid, false);
});

test("a declared fraction alone or altered underlying observations cannot substantiate savings", () => {
  const { value, sources, opportunity } = savingsFixture();
  const source = JSON.parse(sources.get(opportunity.provenance.path));
  delete source.basis;
  const noBasis = retained(source, opportunity.provenance.path, opportunity.provenance.source);
  const unsupported = structuredClone(value);
  unsupported.opportunities[0].provenance = noBasis.provenance;
  const ungrounded = new Map(sources);
  ungrounded.set(noBasis.provenance.path, noBasis.bytes);
  assert.match(validate(unsupported, ungrounded).errors.join(" "), /fraction alone/);
  const changed = new Map(sources);
  changed.set("evidence/observed-utilization.json", Buffer.from(JSON.stringify({ observations: [] })));
  assert.match(validate(value, changed).errors.join(" "), /SHA-256 mismatch/);
});

test("CLI emits bounded JSON errors, accepts --input, validates persisted fixtures and never follows symlinks outside root", (t) => {
  const directory = path.join(ROOT, `.assessment-cost-fixtures-${randomUUID()}`);
  fs.mkdirSync(directory);
  fs.mkdirSync(path.join(directory, "evidence"));
  fs.mkdirSync(path.join(directory, "contracts"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const saved = normalized();
  fs.writeFileSync(path.join(directory, saved.provenance.path), saved.bytes);
  fs.writeFileSync(path.join(directory, "contracts/report.json"), JSON.stringify(report([saved.evidence])));
  const run = (...args) => {
    const child = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: "utf8" });
    assert.equal(child.stderr, "");
    return { code: child.status, result: JSON.parse(child.stdout) };
  };
  const args = [
    "validate",
    "--input",
    path.join(directory, "contracts/report.json"),
    "--root",
    directory,
    "--as-of",
    AS_OF,
  ];
  assert.deepEqual(run(...args), { code: 0, result: { valid: true, errors: [] } });
  assert.equal(run("windows", "--as-of", AS_OF).result.length, 4);
  fs.symlinkSync(SCRIPT, path.join(directory, "cost-helper.mjs"));
  const linked = spawnSync(process.execPath, [path.join(directory, "cost-helper.mjs"), "windows", "--as-of", AS_OF], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(linked.status, 0);
  assert.equal(JSON.parse(linked.stdout).length, 4);
  const imported = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { sumCosts } from ${JSON.stringify(SCRIPT)}; console.log(sumCosts([0.1, 0.2]));`,
      "not-a-script-path",
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(imported.status, 0);
  assert.equal(imported.stdout.trim(), "0.3");
  assert.equal(
    run(
      "normalize",
      "--input",
      path.join(directory, saved.provenance.path),
      "--scope",
      RG,
      "--root",
      directory,
      "--as-of",
      AS_OF,
    ).result.status,
    "complete",
  );
  assert.equal(
    run(
      "normalize",
      "--input",
      path.join(directory, saved.provenance.path),
      "--scope",
      SUB,
      "--root",
      directory,
      "--as-of",
      AS_OF,
    ).code,
    1,
  );
  assert.equal(
    run("validate", "--input", path.join(directory, "missing.json"), "--root", directory, "--as-of", AS_OF).code,
    1,
  );
  fs.writeFileSync(path.join(directory, "malformed.json"), "SYNTHETIC-PRIVATE-INPUT is not JSON");
  const malformed = run(
    "validate",
    "--input",
    path.join(directory, "malformed.json"),
    "--root",
    directory,
    "--as-of",
    AS_OF,
  );
  assert.equal(malformed.code, 1);
  assert.match(malformed.result.errors.join(" "), /Invalid JSON/);
  assert.equal(JSON.stringify(malformed.result).includes("SYNTHETIC-PRIVATE-INPUT"), false);
  assert.equal(run("validate", "--input", path.join(directory, "contracts/report.json"), "--root", directory).code, 1);
  assert.equal(
    run(
      "validate",
      "--input",
      path.join(directory, "contracts/report.json"),
      "--root",
      directory,
      "--as-of",
      AS_OF,
      "--scope",
      SUB,
    ).code,
    1,
  );
  fs.rmSync(path.join(directory, saved.provenance.path));
  fs.symlinkSync(path.join(ROOT, "package.json"), path.join(directory, saved.provenance.path));
  const escaped = run(...args);
  assert.equal(escaped.code, 1);
  assert.match(escaped.result.errors.join(" "), /escapes project root/);
});

test("physical collector consolidates 16 logical requests into 8 physical calls, handles 429 Retry-After, and verifies same-scope empty currency", async (t) => {
  const { executePhysicalCostPlan, parseRetryAfterMs, planPhysicalCostCalls } =
    await import("../../scripts/collect-assessment-cost.mjs");
  const scopes = [
    "/subscriptions/11111111-1111-1111-1111-111111111111",
    "/subscriptions/22222222-2222-2222-2222-222222222222",
    "/subscriptions/33333333-3333-3333-3333-333333333333",
    "/subscriptions/44444444-4444-4444-4444-444444444444",
  ];
  const planConfig = { as_of: AS_OF, scopes };
  const planned = planCostQueries(planConfig);
  assert.equal(planned.requests.length, 16);
  const physical = planPhysicalCostCalls(planned);
  assert.equal(physical.length, 8);

  assert.equal(parseRetryAfterMs({ "x-ms-ratelimit-microsoft.costmanagement-entity-retry-after": "3" }, 1), 3000);
  assert.equal(parseRetryAfterMs({ "retry-after": "2" }, 2), 2000);

  const projectRoot = path.join(ROOT, `.collect-cost-${randomUUID()}`);
  fs.mkdirSync(projectRoot, { recursive: true });
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));

  const sleeps = [];
  let throttledOnce = false;
  const executor = (url, _body) => {
    if (!throttledOnce && url.includes("44444444") && url.includes("/query")) {
      throttledOnce = true;
      return { status_code: 429, headers: { "retry-after": "1" }, body: { error: { code: "TooManyRequests" } } };
    }
    const scope = scopes.find((s) => url.toLowerCase().includes(s.toLowerCase()));
    if (url.includes("/forecast")) {
      return {
        status_code: 200,
        headers: {},
        body: {
          properties: {
            columns: [
              { name: "PreTaxCost", type: "Number" },
              { name: "Currency", type: "String" },
              { name: "UsageDate", type: "Number" },
              { name: "CostStatus", type: "String" },
            ],
            rows: [
              [10, "USD", 20260310, "Actual"],
              [25, "USD", 20260320, "Forecast"],
            ],
            nextLink: null,
          },
        },
      };
    }
    // Scope 4 has 0 rows in preceding_month (Jan 2026), positive rows in Feb & Mar MTD.
    const rows =
      scope === scopes[3]
        ? [
            [
              31.44,
              "USD",
              "Virtual Machines",
              `${scope}/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm1`,
              20260215,
            ],
            [
              0.43,
              "USD",
              "Storage",
              `${scope}/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/st1`,
              20260305,
            ],
          ]
        : [
            [
              50,
              "USD",
              "Compute",
              `${scope}/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm`,
              20260110,
            ],
            [
              60,
              "USD",
              "Compute",
              `${scope}/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm`,
              20260210,
            ],
            [
              15,
              "USD",
              "Compute",
              `${scope}/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm`,
              20260305,
            ],
          ];
    return {
      status_code: 200,
      headers: {},
      body: {
        properties: {
          columns: [
            { name: "PreTaxCost", type: "Number" },
            { name: "Currency", type: "String" },
            { name: "ServiceName", type: "String" },
            { name: "ResourceId", type: "String" },
            { name: "UsageDate", type: "Number" },
          ],
          rows,
          nextLink: null,
        },
      },
    };
  };

  const out = executePhysicalCostPlan(planConfig, {
    projectRoot,
    collectedAt: AS_OF,
    executor,
    sleep: (ms) => sleeps.push(ms),
    minIntervalMs: 1500,
  });
  assert.equal(out.physical_call_count, 8);
  assert.equal(out.report.status, "complete");
  assert.ok(sleeps.includes(1000)); // 429 Retry-After backoff
  const scope4Preceding = out.report.evidence.find((e) => e.id === "scope4-preceding_month");
  assert.equal(scope4Preceding.status, "complete");
  assert.equal(scope4Preceding.series[0].currency, "USD");
  assert.equal(scope4Preceding.series[0].amount, "0");

  const validation = validateAssessmentCost(out.report, {
    root: projectRoot,
    asOf: AS_OF,
    readEvidence: (rel) => fs.readFileSync(path.join(projectRoot, rel)),
    approvedScopes: scopes,
    approvedPlan: planConfig,
  });
  assert.deepEqual(validation, { valid: true, errors: [] });

  // Conflicting sibling currency invalidates same-scope currency inference.
  const badReport = structuredClone(out.report);
  const donor = badReport.evidence.find((e) => e.id === "scope4-previous_month");
  donor.series[0].currency = "EUR";
  const badCheck = validateAssessmentCost(badReport, {
    root: projectRoot,
    asOf: AS_OF,
    readEvidence: (rel) => fs.readFileSync(path.join(projectRoot, rel)),
    approvedScopes: scopes,
    approvedPlan: planConfig,
  });
  assert.equal(badCheck.valid, false);
});

test("physical cost collector rejects gapped consolidation, preserves body+pacing across pagination, and captures 429 headers/ENOBUFS", async (t) => {
  const { defaultHttpExecutor, executePhysicalCostPlan, parseAzRestResult, planPhysicalCostCalls } =
    await import("../../scripts/collect-assessment-cost.mjs");
  const sub = "/subscriptions/11111111-1111-1111-1111-111111111111";

  // 1. Disjoint custom periods must NOT consolidate into one spanning query.
  const disjointPlan = planCostQueries({
    as_of: "2026-03-15T12:00:00.000Z",
    scopes: [sub],
    periods: [
      { id: "jan_slice", kind: "custom", from: "2026-01-01T00:00:00.000Z", to: "2026-01-05T23:59:59.999Z" },
      { id: "mar_slice", kind: "custom", from: "2026-03-01T00:00:00.000Z", to: "2026-03-05T23:59:59.999Z" },
    ],
  });
  const disjointCalls = planPhysicalCostCalls(disjointPlan);
  assert.equal(disjointCalls.length, 2);
  assert.ok(disjointCalls.every((c) => c.kind === "single_query"));

  // 2. ENOBUFS, token-clean --only-show-errors (never --debug), and rate-limit parsing in defaultHttpExecutor / parseAzRestResult.
  const enobufs = parseAzRestResult({ error: { code: "ENOBUFS" }, status: null, stdout: "", stderr: "" });
  assert.equal(enobufs.status_code, 502);
  assert.equal(enobufs.body.error.code, "ResponseBufferExceeded");

  const exec429 = defaultHttpExecutor(
    "https://management.azure.com/test",
    { type: "ActualCost" },
    (_bin, args, opts) => {
      assert.equal(opts.maxBuffer, 64 * 1024 * 1024);
      assert.equal(args.includes("--debug"), false, "defaultHttpExecutor must never pass --debug");
      assert.ok(args.includes("--only-show-errors"));
      assert.ok(args.includes("--body"));
      return {
        status: 1,
        stdout: "",
        stderr: '{"error":{"code":"429","message":"Too many requests. Please retry after 17 seconds."}}',
      };
    },
  );
  assert.equal(exec429.status_code, 429);
  assert.equal(exec429.headers["retry-after"], "17");

  // Legacy header-style stderr lines remain supported by parseAzRestResult.
  const legacy429 = parseAzRestResult({
    status: 1,
    stdout: "",
    stderr: "Response status: 429\n" + "'x-ms-ratelimit-microsoft.costmanagement-entity-retry-after': '12'\n",
  });
  assert.equal(legacy429.status_code, 429);
  assert.equal(legacy429.headers["x-ms-ratelimit-microsoft.costmanagement-entity-retry-after"], "12");

  // 3. Continuation pages keep POST body and apply minIntervalMs pacing before every page.
  const pageRoot = path.join(ROOT, `.collect-paged-${randomUUID()}`);
  fs.mkdirSync(pageRoot, { recursive: true });
  t.after(() => fs.rmSync(pageRoot, { recursive: true, force: true }));
  const singlePeriodCfg = {
    as_of: AS_OF,
    scopes: [sub],
    expected_currency: "USD",
    periods: [WINDOWS[0]],
  };
  const seenBodies = [];
  const intervals = [];
  let callNum = 0;
  const pagedOut = executePhysicalCostPlan(singlePeriodCfg, {
    projectRoot: pageRoot,
    collectedAt: AS_OF,
    minIntervalMs: 1500,
    sleep: (ms) => intervals.push(ms),
    executor: (url, body) => {
      seenBodies.push(body);
      callNum++;
      return {
        status_code: 200,
        headers: {},
        body: {
          properties: {
            columns: [
              { name: "PreTaxCost", type: "Number" },
              { name: "Currency", type: "String" },
              { name: "ServiceName", type: "String" },
              { name: "ResourceId", type: "String" },
              { name: "UsageDate", type: "Number" },
            ],
            rows: [
              [
                10 * callNum,
                "USD",
                "Compute",
                `${sub}/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm${callNum}`,
                20260210 + callNum,
              ],
            ],
            nextLink:
              callNum === 1
                ? `https://management.azure.com${sub}/providers/Microsoft.CostManagement/query?api-version=2023-11-01&$skiptoken=page2`
                : null,
          },
        },
      };
    },
  });
  assert.equal(seenBodies.length, 2);
  assert.ok(seenBodies[0] !== null);
  assert.deepEqual(seenBodies[0], seenBodies[1]);
  assert.deepEqual(intervals, [1500]);
  assert.equal(pagedOut.report.evidence[0].status, "complete");
  assert.equal(pagedOut.report.evidence[0].page_count, 2);

  // 4. --include-amortized and --include-rg-breakdown write isolated companion contracts without clobbering primary.
  const { runCollectCostCli } = await import("../../scripts/collect-assessment-cost.mjs");
  const { validateCostRequest } = await import("../../scripts/cost-estimate.mjs");
  const multiRoot = path.join(ROOT, `.collect-multi-${randomUUID()}`);
  fs.mkdirSync(path.join(multiRoot, "_meta"), { recursive: true });
  t.after(() => fs.rmSync(multiRoot, { recursive: true, force: true }));
  const multiPlanPath = path.join(multiRoot, "_meta/cost-plan.json");
  const multiPlan = {
    as_of: AS_OF,
    scopes: [sub],
    expected_currency: "USD",
    // Intentionally omit periods so --include-rg-breakdown exercises planCostQueries() default windows.
  };
  fs.writeFileSync(multiPlanPath, `${JSON.stringify(multiPlan, null, 2)}\n`);
  const cliCode = runCollectCostCli(
    [
      "--plan",
      multiPlanPath,
      "--root",
      multiRoot,
      "--collected-at",
      AS_OF,
      "--include-amortized",
      "--include-rg-breakdown",
    ],
    {
      sleep: () => {},
      executor: (url, body) => {
        const isForecast = url.includes("/forecast?");
        if (isForecast) {
          return {
            status_code: 200,
            headers: {},
            body: {
              properties: {
                columns: [
                  { name: "PreTaxCost", type: "Number" },
                  { name: "UsageDate", type: "Number" },
                  { name: "CostStatus", type: "String" },
                  { name: "Currency", type: "String" },
                ],
                rows: [
                  [50, 20260301, "Actual", "USD"],
                  [90, 20260320, "Forecast", "USD"],
                ],
                nextLink: null,
              },
            },
          };
        }
        const firstGroupDim = body?.dataset?.grouping?.[0]?.name ?? "ServiceName";
        const firstGroupVal = firstGroupDim === "ResourceGroupName" ? "rg-spoke" : "SQL Managed Instance";
        return {
          status_code: 200,
          headers: {},
          body: {
            properties: {
              columns: [
                { name: "PreTaxCost", type: "Number" },
                { name: "Currency", type: "String" },
                { name: firstGroupDim, type: "String" },
                { name: "ResourceId", type: "String" },
                { name: "UsageDate", type: "Number" },
              ],
              rows: [
                [
                  body?.type === "AmortizedCost" ? 80 : 100,
                  "USD",
                  firstGroupVal,
                  `${sub}/resourceGroups/rg-spoke/providers/Microsoft.Sql/managedInstances/sqlmi1`,
                  20260215,
                ],
              ],
              nextLink: null,
            },
          },
        };
      },
    },
  );
  assert.equal(cliCode, 0);
  const primaryDoc = JSON.parse(fs.readFileSync(path.join(multiRoot, "contracts/03-cost-management.json"), "utf8"));
  const amortizedDoc = JSON.parse(
    fs.readFileSync(path.join(multiRoot, "_meta/amortized-cost/contracts/03-cost-management.json"), "utf8"),
  );
  const rgDoc = JSON.parse(
    fs.readFileSync(path.join(multiRoot, "_meta/resource-group-cost/contracts/03-cost-management.json"), "utf8"),
  );
  assert.equal(primaryDoc.evidence[0].request.cost_type, "ActualCost");
  assert.equal(amortizedDoc.evidence[0].request.cost_type, "AmortizedCost");
  assert.deepEqual(rgDoc.evidence[0].request.group_by, ["ResourceGroupName", "ResourceId"]);
  assert.equal(
    rgDoc.periods.some((p) => p.kind === "forecast"),
    false,
  );

  // 5. PaaS recipes enforce service/SKU-specific variable dimensions and reject missing variable usage.
  const paasCheck = validateCostRequest({
    project_name: "paas-recipe-test",
    region: "swedencentral",
    output_path: path.join(multiRoot, "_meta/paas.json"),
    resource_list: [
      {
        name: "sqlmi-gp-gen5",
        service_name: "Azure SQL Managed Instance",
        sku: "GP_Gen5_4",
        region: "swedencentral",
        quantity: 1,
      },
      { name: "sb-prem", service_name: "Azure Service Bus", sku: "Premium", region: "swedencentral", quantity: 1 },
      {
        name: "afw-std",
        service_name: "Azure Firewall",
        sku: "Standard",
        region: "swedencentral",
        quantity: 1,
        usage: [
          { dimension: "hours", amount: 730, unit: "Hour", scope: "per-instance" },
          { dimension: "processed_gb", amount: 500, unit: "GB", scope: "aggregate" },
        ],
      },
      {
        name: "ca-cons",
        service_name: "Azure Container Apps",
        sku: "Consumption",
        region: "swedencentral",
        quantity: 1,
        usage: [
          { dimension: "vcpu_seconds", amount: 100000, unit: "vCPU-s", scope: "aggregate" },
          { dimension: "gib_seconds", amount: 200000, unit: "GiB-s", scope: "aggregate" },
          { dimension: "requests", amount: 500000, unit: "1M", scope: "aggregate" },
        ],
      },
    ],
  });
  assert.equal(paasCheck.ok, true, paasCheck.unresolved_items.join("; "));
  assert.equal(paasCheck.normalized.lines.length, 4);

  // Firewall without processed_gb, Service Bus Standard without operations, and Container Apps Consumption without CPU/memory/requests fail preflight!
  const missingFirewall = validateCostRequest({
    project_name: "paas-missing-dim",
    region: "swedencentral",
    output_path: path.join(multiRoot, "_meta/paas-bad1.json"),
    resource_list: [
      {
        name: "afw-hourly-only",
        service_name: "Azure Firewall",
        sku: "Standard",
        region: "swedencentral",
        quantity: 1,
      },
    ],
  });
  assert.equal(missingFirewall.ok, false);
  assert.match(missingFirewall.unresolved_items.join("\n"), /requires known billable dimension 'processed_gb'/);

  const missingSbStd = validateCostRequest({
    project_name: "sb-std-missing",
    region: "swedencentral",
    output_path: path.join(multiRoot, "_meta/paas-bad2.json"),
    resource_list: [
      {
        name: "sb-std",
        service_name: "Azure Service Bus",
        sku: "Standard",
        region: "swedencentral",
        quantity: 1,
      },
    ],
  });
  assert.equal(missingSbStd.ok, false);
  assert.match(missingSbStd.unresolved_items.join("\n"), /requires known billable dimension 'operations'/);

  const missingCa = validateCostRequest({
    project_name: "ca-missing-dim",
    region: "swedencentral",
    output_path: path.join(multiRoot, "_meta/paas-bad3.json"),
    resource_list: [
      {
        name: "ca-no-usage",
        service_name: "Azure Container Apps",
        sku: "Consumption",
        region: "swedencentral",
        quantity: 1,
      },
    ],
  });
  assert.equal(missingCa.ok, false);
  assert.match(missingCa.unresolved_items.join("\n"), /requires known billable dimension 'vcpu_seconds'/);
});
