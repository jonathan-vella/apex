import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  bindCostRequest,
  calculateLineCost,
  publishEstimate,
  resolveWorkspacePath,
  validateEstimate,
} from "../../scripts/cost-estimate.mjs";
import { fetchRetailEvidence, retailQueryUrl } from "../../scripts/fetch-retail-price-evidence.mjs";
import {
  captureMcpResponse,
  digestObject,
  normalizeMeter,
  PRICING_ROOT,
  reserveQuery,
  updateAttempt,
} from "../../scripts/_lib/pricing-evidence.mjs";
import { evidenceBackedFixture } from "./test_cost_estimate_fixture.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SCRIPT = new URL("../../scripts/cost-estimate.mjs", import.meta.url).pathname;
function directory(t) {
  const dir = fs.mkdtempSync(path.join(HERE, ".pricing-review-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const input = (extra = {}) => ({
  name: "app",
  service_name: "Azure App Service",
  sku: "B1",
  region: "swedencentral",
  quantity: 1,
  subscription: "workload",
  ...extra,
});
const meter = (extra = {}) => ({
  meterId: "synthetic-hourly",
  meterName: "Synthetic Hourly",
  serviceName: "Azure App Service",
  productName: "Synthetic Linux Plan",
  skuName: "B1",
  armSkuName: "B1",
  armRegionName: "swedencentral",
  currencyCode: "USD",
  type: "Consumption",
  unitOfMeasure: "1 Hour",
  tierMinimumUnits: 0,
  effectiveStartDate: "2020-01-01",
  retailPrice: 1,
  ...extra,
});
function setup(t, { inputs = [input()], rows = [meter()], candidateSets, manifest, empty = false } = {}) {
  const dir = directory(t);
  const output = path.join(dir, "estimate.json");
  const manifestPath = manifest ? path.join(dir, "sku-manifest.json") : undefined;
  if (manifest) fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const request = {
    project_name: "synthetic-review",
    region: "swedencentral",
    currency: "USD",
    output_path: output,
    ...(candidateSets
      ? { candidate_sets: candidateSets }
      : manifest
        ? { manifest_path: manifestPath }
        : { resource_list: inputs }),
  };
  const requestPath = path.join(dir, "pricing-request.json");
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const binding = bindCostRequest(request, { requestPath, cwd: PRICING_ROOT });
  const query = { serviceName: rows[0].serviceName, currencyCode: "USD", priceType: "Consumption" };
  const response_path = path.join(dir, "native-response.json");
  const response = { status: 200, results: { prices: empty ? [] : rows } };
  fs.writeFileSync(response_path, JSON.stringify(response));
  reserveQuery({ output, query, call_id: "reservation-1", request_binding_path: binding.request_binding_path });
  updateAttempt(output, "reservation-1", { state: "issued", issued_at: new Date().toISOString() });
  const capture = captureMcpResponse({
    output,
    query,
    call_id: "reservation-1",
    native_call_id: "actual-native-1",
    response_path,
  });
  const resources = binding.request_snapshot.lines.map((line) => ({
    name: line.name,
    decision_id: line.decision_id,
    service_name: line.service_name,
    sku: line.sku,
    region: line.region,
    quantity: line.quantity,
    subscription: line.subscription,
    notes: "Synthetic review fixture",
    calculation_basis: {
      name: line.name,
      service_name: line.service_name,
      sku: line.sku,
      region: line.region,
      quantity: line.quantity,
      request_line_sha256: digestObject(line),
      components: [],
    },
    monthly_cost: 0,
  }));
  const estimate = {
    schema_version: "cost-estimate-v2",
    purpose: "monthly-estimate",
    status: "COMPLETE",
    project_name: request.project_name,
    region: request.region,
    currency: request.currency,
    queried_at: capture.queried_at,
    resources,
    monthly_total: 0,
    yearly_total: 0,
    optimization_notes: [],
    savings_status: "NOT_APPLICABLE",
    savings_reason: "Synthetic fixture",
    eligible_strategies: [],
    data_source: "Azure MCP pricing_get",
    confidence: "High",
    unresolved_items: [],
    mcp_calls_used: 1,
    direct_api_calls_used: 0,
    budget_exceeded: false,
    request_snapshot: binding.request_snapshot,
    request_sha256: binding.request_sha256,
    evidence: [{ evidence_path: capture.evidence_path }],
  };
  const component = (row, extra = {}) => ({
    evidence_ref: { evidence_path: capture.evidence_path, row_sha256: [digestObject(normalizeMeter(row))] },
    meter_id: row.meterId,
    product_name: row.productName,
    billing_region: row.armRegionName,
    unit_of_measure: row.unitOfMeasure,
    effective_start_date: row.effectiveStartDate,
    retail_price: row.retailPrice,
    usage_amount: 730,
    usage_scope: "per-instance",
    unit_conversion: {
      usage_unit: "hours",
      native_unit: row.unitOfMeasure,
      units_per_native_unit: 1,
      reason: "Synthetic explicit identity conversion",
    },
    ...extra,
  });
  const total = () => {
    for (const resource of estimate.resources) resource.monthly_cost = calculateLineCost(resource.calculation_basis);
    estimate.monthly_total = estimate.resources.reduce((sum, resource) => sum + resource.monthly_cost, 0);
    estimate.yearly_total = estimate.monthly_total * 12;
  };
  return {
    dir,
    output,
    request,
    requestPath,
    manifestPath,
    binding,
    query,
    capture,
    response,
    estimate,
    rows,
    component,
    total,
  };
}
const validate = (fixture, estimate = fixture.estimate, options = {}) =>
  validateEstimate(estimate, { requestPath: fixture.requestPath, ...options });

test("review: authoritative original request cannot be omitted, replaced or quantity-rebound", (t) => {
  const f = setup(t);
  f.estimate.resources[0].calculation_basis.components = [f.component(f.rows[0])];
  f.total();
  assert.equal(validate(f).ok, true, validate(f).errors.join("; "));
  assert.equal(validateEstimate(f.estimate).ok, false);
  const changed = structuredClone(f.estimate);
  const line = changed.request_snapshot.lines[0];
  line.quantity = 10;
  changed.request_sha256 = digestObject(changed.request_snapshot);
  changed.resources[0].quantity = 10;
  changed.resources[0].calculation_basis.quantity = 10;
  changed.resources[0].calculation_basis.request_line_sha256 = digestObject(line);
  changed.resources[0].monthly_cost *= 10;
  changed.monthly_total *= 10;
  changed.yearly_total *= 10;
  assert.equal(validate(f, changed).ok, false);
  const draftPath = path.join(f.dir, "draft.json");
  fs.writeFileSync(draftPath, JSON.stringify(changed));
  assert.throws(
    () => publishEstimate({ draftPath, outputPath: path.join(f.dir, "bad.json"), requestPath: f.requestPath }),
    /binding differs/,
  );
  f.request.resource_list[0].quantity = 10;
  fs.writeFileSync(f.requestPath, JSON.stringify(f.request));
  assert.equal(validate(f, changed).ok, false, "editing the original file cannot rebind the captured preflight");
  assert.throws(
    () =>
      reserveQuery({
        output: f.output,
        query: f.query,
        call_id: "reservation-1",
        request_binding_path: bindCostRequest(f.request, { requestPath: f.requestPath }).request_binding_path,
      }),
    /binding conflict/,
  );
});

test("review: every Key Vault usage entry requires its own applicable meter and exact coverage", (t) => {
  const rows = ["Secrets", "Certificates"].map((kind) =>
    meter({
      serviceName: "Key Vault",
      skuName: "Standard",
      armSkuName: "Standard",
      meterId: kind,
      meterName: kind,
      unitOfMeasure: "1K",
      retailPrice: 1,
    }),
  );
  const f = setup(t, {
    inputs: [
      input({
        service_name: "Key Vault",
        sku: "Standard",
        usage: [
          { amount: 1000, unit: "operations", scope: "aggregate", meter_name: "Secrets" },
          { amount: 900000, unit: "operations", scope: "aggregate", meter_name: "Certificates" },
        ],
      }),
    ],
    rows,
  });
  const make = (index, amount) =>
    f.component(rows[index], {
      usage_index: index,
      usage_amount: amount,
      usage_scope: "aggregate",
      unit_conversion: {
        usage_unit: "operations",
        native_unit: "1K",
        units_per_native_unit: 1000,
        reason: "One thousand operations per native unit",
      },
    });
  f.estimate.resources[0].calculation_basis.components = [make(0, 1000)];
  f.total();
  assert.equal(validate(f).ok, false);
  f.estimate.resources[0].calculation_basis.components.push(make(1, 900000));
  f.total();
  assert.equal(f.estimate.monthly_total, 901);
  assert.equal(validate(f).ok, true, validate(f).errors.join("; "));
  const swapped = structuredClone(f.estimate);
  swapped.resources[0].calculation_basis.components[1].usage_index = 0;
  assert.equal(validate(f, swapped).ok, false);
});

test("review: requested native SKU, billing region, monthly unit, OS and licensing cannot be ignored", (t) => {
  for (const requested of [
    { sku_name: "Contradictory" },
    { billing_region: "eastus" },
    { native_unit: "1 Month" },
    { operating_system: "Windows" },
    { license: "Azure Hybrid Benefit" },
    { redundancy: "ZRS" },
  ]) {
    const f = setup(t, { inputs: [input(requested)] });
    f.estimate.resources[0].calculation_basis.components = [f.component(f.rows[0])];
    f.total();
    assert.equal(validate(f).ok, false, JSON.stringify(requested));
  }
  const positive = setup(t, {
    inputs: [
      input({ operating_system: "Linux", sku_name: "B1", billing_region: "swedencentral", native_unit: "1 Hour" }),
    ],
  });
  positive.estimate.resources[0].calculation_basis.components = [positive.component(positive.rows[0])];
  positive.total();
  assert.equal(validate(positive).ok, true, validate(positive).errors.join("; "));
});

test("review: candidate mode comes from the original request and decisions cover every requested alternative", (t) => {
  const f = setup(t, {
    candidateSets: [
      {
        decision_id: "plan",
        candidates: [
          { label: "cheap", service_name: "Azure App Service", sku: "B1" },
          { label: "expensive", service_name: "Azure App Service", sku: "B2" },
        ],
      },
    ],
    rows: [meter(), meter({ meterId: "B2", meterName: "B2", skuName: "B2", armSkuName: "B2", retailPrice: 2 })],
  });
  for (const [index, resource] of f.estimate.resources.entries())
    resource.calculation_basis.components = [f.component(f.rows[index])];
  f.total();
  f.estimate.monthly_total = 0;
  f.estimate.yearly_total = 0;
  f.estimate.decisions = [
    { decision_id: "plan", candidates: [{ label: "expensive", monthly_cost: 1460 }], winner_label: "expensive" },
  ];
  assert.equal(validate(f).ok, false, "omitting the cheaper candidate must fail");
  f.estimate.decisions[0].candidates.unshift({ label: "cheap", monthly_cost: 730 });
  f.estimate.decisions[0].winner_label = "cheap";
  assert.equal(validate(f).ok, true, validate(f).errors.join("; "));
  delete f.estimate.decisions;
  assert.equal(validate(f).ok, false, "candidate mode cannot disappear by omitting decisions");
});

test("review: capture CLI persists actual native identity and detects reuse across reservations", (t) => {
  const dir = directory(t);
  const output = path.join(dir, "estimate.json");
  const requestPath = path.join(dir, "request.json");
  const queryPath = path.join(dir, "query.json");
  const responsePath = path.join(dir, "actual-response.json");
  fs.writeFileSync(
    requestPath,
    JSON.stringify({
      project_name: "synthetic",
      region: "swedencentral",
      output_path: output,
      resource_list: [input()],
    }),
  );
  fs.writeFileSync(
    queryPath,
    JSON.stringify({ serviceName: "Azure App Service", priceType: "Consumption", currencyCode: "USD" }),
  );
  fs.writeFileSync(responsePath, JSON.stringify({ status: 200, results: { prices: [meter()] } }));
  const cli = (mode, id, extra = []) =>
    spawnSync(
      process.execPath,
      [SCRIPT, mode, "--request", requestPath, "--query", queryPath, "--output", output, "--call-id", id, ...extra],
      { encoding: "utf8" },
    );
  assert.equal(cli("reserve-query", "reservation-not-native").status, 0);
  assert.equal(cli("issue-query", "reservation-not-native").status, 0);
  const captured = cli("capture-response", "reservation-not-native", [
    "--response",
    responsePath,
    "--native-call-id",
    "actual-native-identity",
  ]);
  assert.equal(captured.status, 0, captured.stderr);
  const metadata = JSON.parse(captured.stdout);
  assert.equal(metadata.native_call_id, "actual-native-identity");
  assert.equal(JSON.parse(fs.readFileSync(metadata.evidence_path)).native_call_id, "actual-native-identity");
  fs.writeFileSync(
    queryPath,
    JSON.stringify({
      serviceName: "Azure App Service",
      priceType: "Consumption",
      currencyCode: "USD",
      meterName: "Synthetic Hourly",
    }),
  );
  assert.equal(cli("reserve-query", "second-reservation").status, 0);
  assert.equal(cli("issue-query", "second-reservation").status, 0);
  assert.equal(
    cli("capture-response", "second-reservation", [
      "--response",
      responsePath,
      "--native-call-id",
      "actual-native-identity",
    ]).status,
    1,
  );
});

test("review: complete two-page fallback validates end to end and shares its native-failure budget", async (t) => {
  const row = meter({ unitOfMeasure: "1 GB", retailPrice: 0 });
  const f = setup(t, {
    inputs: [input({ usage: { amount: 7, unit: "GB", scope: "aggregate" } })],
    rows: [row],
    empty: true,
  });
  const next = retailQueryUrl(f.query);
  next.searchParams.set("$skip", "1000");
  let calls = 0;
  const directPath = path.join(f.dir, "fallback.json");
  const request = {
    query: f.query,
    remaining_requests: 19,
    output_path: directPath,
    mcp_failure: {
      kind: "empty_result",
      recorded_at: f.capture.queried_at,
      attempts: [{ query: f.query, response: f.response, evidence_path: f.capture.evidence_path }],
    },
  };
  const bands = [row, { ...row, tierMinimumUnits: 5, retailPrice: 2 }];
  const evidence = await fetchRetailEvidence(request, async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({ BillingCurrency: "USD", Items: [bands[calls]], NextPageLink: calls++ === 0 ? next.href : null }),
  }));
  assert.equal(calls, 2);
  const comp = f.component(row, {
    evidence_ref: { evidence_path: directPath, row_sha256: bands.map((band) => digestObject(normalizeMeter(band))) },
    usage_amount: 7,
    usage_scope: "aggregate",
    unit_conversion: {
      usage_unit: "GB",
      native_unit: "1 GB",
      units_per_native_unit: 1,
      reason: "Exact GB identity conversion",
    },
    tier_bands: bands.map(({ tierMinimumUnits, retailPrice }) => ({ tierMinimumUnits, retailPrice })),
  });
  delete comp.retail_price;
  f.estimate.resources[0].calculation_basis.components = [comp];
  f.estimate.evidence = [{ evidence_path: directPath }];
  f.estimate.direct_api_calls_used = 2;
  f.estimate.data_source = "Azure MCP pricing_get + Azure Retail Prices API (direct fallback)";
  f.total();
  assert.equal(f.estimate.monthly_total, 4);
  assert.equal(validate(f).ok, true, validate(f).errors.join("; "));
  const replay = await fetchRetailEvidence(request, () => assert.fail("zero-query replay required"));
  assert.equal(replay.requests_issued_this_run, 0);
  const foreign = directory(t);
  const moved = { ...request, output_path: path.join(foreign, "fallback.json") };
  await assert.rejects(
    fetchRetailEvidence(moved, () => assert.fail("foreign ledger must not issue")),
    /share one request ledger/,
  );
  const forged = structuredClone(f.estimate);
  const metadataPath = path.join(foreign, "forged.json");
  fs.writeFileSync(
    metadataPath,
    JSON.stringify({ ...evidence, ledger_path: path.join(foreign, "pricing-evidence", "request-ledger.json") }),
  );
  forged.evidence = [{ evidence_path: metadataPath }];
  forged.resources[0].calculation_basis.components[0].evidence_ref.evidence_path = metadataPath;
  assert.equal(validate(f, forged).ok, false);
});

test("review: twenty native reservations cannot be escaped by placing fallback output beside another ledger", async (t) => {
  const f = setup(t, { empty: true });
  for (let index = 0; index < 19; index++)
    reserveQuery({
      output: f.output,
      query: { ...f.query, meterName: `unknown-${index}` },
      call_id: `unknown-${index}`,
    });
  const request = {
    query: f.query,
    remaining_requests: 20,
    mcp_failure: {
      kind: "empty_result",
      recorded_at: f.capture.queried_at,
      attempts: [{ query: f.query, response: f.response, evidence_path: f.capture.evidence_path }],
    },
  };
  await assert.rejects(
    fetchRetailEvidence(request, () => assert.fail("budget must block"), {
      outputPath: path.join(f.dir, "fallback.json"),
    }),
    (error) => {
      assert.equal(error.result.ledger_counts.unknown_reservations, 19);
      assert.equal(error.result.requests_used, 0);
      return true;
    },
  );
  await assert.rejects(
    fetchRetailEvidence(request, () => assert.fail("foreign scope must block"), {
      outputPath: path.join(directory(t), "fallback.json"),
    }),
    /share one request ledger/,
  );
});

test("review: controlled readers canonicalize project-relative and absolute aliases against options.cwd", (t) => {
  const dir = directory(t);
  const original = setup(t);
  original.estimate.resources[0].calculation_basis.components = [original.component(original.rows[0])];
  original.total();
  const estimate = evidenceBackedFixture(original.estimate, dir);
  estimate.evidence[0].evidence_path = path.resolve(dir, estimate.evidence[0].evidence_path);
  const metadata = JSON.parse(fs.readFileSync(estimate.evidence[0].evidence_path));
  metadata.raw_path = path.relative(PRICING_ROOT, path.resolve(dir, metadata.raw_path)).replaceAll(path.sep, "/");
  fs.writeFileSync(estimate.evidence[0].evidence_path, JSON.stringify(metadata));
  const reads = [];
  const reader = (reference) => {
    const actual = path.resolve(reference.startsWith("tools/") ? PRICING_ROOT : dir, reference);
    assert.ok(actual.startsWith(`${dir}${path.sep}`), "all canonical reads stay in the project");
    reads.push({ reference, actual });
    return fs.readFileSync(actual);
  };
  const validation = validateEstimate(estimate, {
    cwd: dir,
    requestPath: "pricing-request.json",
    readEvidenceFile: reader,
    readRequestFile: reader,
    verifyEvidenceFiles: false,
  });
  assert.equal(validation.ok, true, validation.errors.join("; "));
  assert.ok(reads.some(({ reference }) => path.isAbsolute(reference)));
  assert.ok(reads.some(({ reference }) => reference.startsWith("pricing-evidence/")));
  assert.ok(reads.some(({ reference }) => reference.startsWith("tools/")));
  assert.ok(
    reads.filter(({ reference }) => reference.endsWith(".raw")).length >= 2,
    "revision watching rereads the same original raw reference",
  );
});

test("review: manifest pricing writeback preserves the bound original inputs but SKU changes invalidate them", (t) => {
  const f = setup(t, {
    manifest: {
      default_region: "swedencentral",
      environments: ["dev"],
      services: [
        {
          id: "app",
          service: "Azure App Service",
          size: "B1",
          capacity: { default: 1 },
          commitment: { type: "on-demand" },
        },
      ],
    },
  });
  f.estimate.resources[0].calculation_basis.components = [f.component(f.rows[0])];
  f.total();
  const draftPath = path.join(f.dir, "draft.json");
  fs.writeFileSync(draftPath, JSON.stringify(f.estimate));
  const { estimate } = publishEstimate({
    draftPath,
    outputPath: path.join(f.dir, "published.json"),
    requestPath: f.requestPath,
    manifestPath: f.manifestPath,
  });
  assert.equal(validate(f, estimate).ok, true, validate(f, estimate).errors.join("; "));
  const changed = JSON.parse(fs.readFileSync(f.manifestPath));
  changed.services[0].size = "B2";
  fs.writeFileSync(f.manifestPath, JSON.stringify(changed));
  assert.equal(validate(f, estimate).ok, false);
});

test("review: synthetic fixture honors aggregate GB usage without changing its source quantity or scope", (t) => {
  const dir = directory(t);
  const source = setup(t);
  source.estimate.resources[0].quantity = 2;
  source.estimate.resources[0].monthly_cost = 5;
  source.estimate.resources[0].unit_of_measure = "1 GB";
  source.estimate.resources[0].usage = { amount: 1000, unit: "GB", scope: "aggregate" };
  const estimate = evidenceBackedFixture(source.estimate, dir);
  const component = estimate.resources[0].calculation_basis.components[0];
  assert.equal(component.usage_scope, "aggregate");
  assert.equal(component.unit_conversion.usage_unit, "GB");
  assert.equal(component.usage_amount, 1000);
  assert.equal(estimate.monthly_total, 5);
  assert.equal(validateEstimate(estimate, { cwd: dir, requestPath: "pricing-request.json" }).ok, true);
});

function importedEstimate(f, request, requestPath) {
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const binding = bindCostRequest(request, { requestPath });
  const estimate = structuredClone(f.estimate);
  estimate.request_snapshot = binding.request_snapshot;
  estimate.request_sha256 = binding.request_sha256;
  estimate.mcp_calls_used = 0;
  estimate.direct_api_calls_used = 0;
  estimate.evidence = estimate.evidence.map((entry) => ({ ...entry, provenance: "historical-import" }));
  for (const [index, resource] of estimate.resources.entries()) {
    const line = binding.request_snapshot.lines[index];
    resource.quantity = line.quantity;
    resource.calculation_basis.quantity = line.quantity;
    resource.calculation_basis.request_line_sha256 = digestObject(line);
    resource.monthly_cost = calculateLineCost(resource.calculation_basis);
  }
  estimate.monthly_total = estimate.resources.reduce((sum, resource) => sum + resource.monthly_cost, 0);
  estimate.yearly_total = estimate.monthly_total * 12;
  return { estimate, binding, options: { requestPath } };
}

test("closure: authorized new quantity imports historical collection evidence with zero new calls and unchanged timestamps", (t) => {
  const f = setup(t);
  f.estimate.resources[0].calculation_basis.components = [f.component(f.rows[0])];
  f.total();
  const rawBefore = fs.readFileSync(f.capture.raw_path);
  const captureBefore = fs.readFileSync(f.capture.evidence_path);
  const request = structuredClone(f.request);
  request.output_path = path.join(f.dir, "quantity-ten.json");
  request.resource_list[0].quantity = 10;
  const current = importedEstimate(f, request, path.join(f.dir, "request-two.json"));
  fs.unlinkSync(f.requestPath);
  assert.equal(current.estimate.monthly_total, 7300);
  assert.equal(current.estimate.queried_at, f.estimate.queried_at);
  assert.equal(current.estimate.mcp_calls_used + current.estimate.direct_api_calls_used, 0);
  const result = validateEstimate(current.estimate, current.options);
  assert.equal(result.ok, true, result.errors.join("; "));
  const draftPath = path.join(f.dir, "quantity-ten.draft.json");
  fs.writeFileSync(draftPath, JSON.stringify(current.estimate));
  publishEstimate({ draftPath, outputPath: request.output_path, ...current.options });
  assert.deepEqual(fs.readFileSync(f.capture.raw_path), rawBefore);
  assert.deepEqual(fs.readFileSync(f.capture.evidence_path), captureBefore);
  const untagged = structuredClone(current.estimate);
  delete untagged.evidence[0].provenance;
  assert.equal(validateEstimate(untagged, current.options).ok, false);
  const changed = structuredClone(request);
  changed.resource_list[0].native_unit = "1 Month";
  const contradictory = importedEstimate(f, changed, path.join(f.dir, "contradictory-request.json"));
  assert.equal(validateEstimate(contradictory.estimate, contradictory.options).ok, false);
});

test("closure: same-attempt historical relabeling cannot erase unknown reservations or recover an exhausted budget", (t) => {
  const f = setup(t);
  f.estimate.resources[0].calculation_basis.components = [f.component(f.rows[0])];
  f.total();
  for (let index = 0; index < 19; index++)
    reserveQuery({
      output: f.output,
      query: { ...f.query, meterName: `pending-${index}` },
      call_id: `pending-${index}`,
    });
  assert.equal(validate(f).ok, false);
  f.estimate.unknown_request_reservations = 19;
  assert.equal(validate(f).ok, true, validate(f).errors.join("; "));
  const falsified = structuredClone(f.estimate);
  falsified.evidence[0].provenance = "historical-import";
  falsified.mcp_calls_used = 0;
  falsified.unknown_request_reservations = 0;
  assert.equal(validate(f, falsified).ok, false);
  const copied = { ...f.request, output_path: path.join(f.dir, "renamed-output.json") };
  const requestPath = path.join(f.dir, "renamed-request.json");
  fs.writeFileSync(requestPath, JSON.stringify(copied));
  const binding = bindCostRequest(copied, { requestPath });
  assert.equal(binding.request_sha256, f.estimate.request_sha256);
  assert.throws(
    () =>
      reserveQuery({
        output: copied.output_path,
        query: { ...f.query, meterName: "one-more" },
        call_id: "one-more",
        request_binding_path: binding.request_binding_path,
      }),
    /budget/,
  );
});

test("closure: duplicate aggregate tier components cannot claim the native free band twice", (t) => {
  const rows = [
    meter({ serviceName: "Log Analytics", unitOfMeasure: "1 GB", retailPrice: 0 }),
    meter({ serviceName: "Log Analytics", unitOfMeasure: "1 GB", tierMinimumUnits: 5, retailPrice: 2 }),
  ];
  const f = setup(t, {
    inputs: [
      input({
        service_name: "Log Analytics",
        usage: [
          { amount: 5, unit: "GB", scope: "aggregate" },
          { amount: 5, unit: "GB", scope: "aggregate" },
        ],
      }),
    ],
    rows,
  });
  const make = (index, amount) => {
    const component = f.component(rows[0], {
      usage_index: index,
      usage_amount: amount,
      usage_scope: "aggregate",
      evidence_ref: {
        evidence_path: f.capture.evidence_path,
        row_sha256: rows.map((row) => digestObject(normalizeMeter(row))),
      },
      unit_conversion: { usage_unit: "GB", native_unit: "1 GB", units_per_native_unit: 1, reason: "GB identity" },
      tier_bands: rows.map(({ tierMinimumUnits, retailPrice }) => ({ tierMinimumUnits, retailPrice })),
    });
    delete component.retail_price;
    return component;
  };
  f.estimate.resources[0].calculation_basis.components = [make(0, 5), make(1, 5)];
  f.total();
  assert.equal(f.estimate.monthly_total, 0, "counterexample arithmetic before entitlement validation");
  assert.match(validate(f).errors.join("; "), /Aggregate tiered billing group/);
  const draftPath = path.join(f.dir, "split.draft.json");
  fs.writeFileSync(draftPath, JSON.stringify(f.estimate));
  assert.throws(
    () => publishEstimate({ draftPath, outputPath: path.join(f.dir, "split.json"), requestPath: f.requestPath }),
    /Aggregate tiered billing group/,
  );
  assert.equal(fs.existsSync(path.join(f.dir, "split.json")), false);
  const request = structuredClone(f.request);
  request.resource_list[0].usage = { amount: 10, unit: "GB", scope: "aggregate" };
  request.output_path = path.join(f.dir, "consolidated.json");
  const current = importedEstimate(f, request, path.join(f.dir, "consolidated-request.json"));
  current.estimate.resources[0].calculation_basis.components = [make(0, 10)];
  current.estimate.resources[0].monthly_cost = 10;
  current.estimate.monthly_total = 10;
  current.estimate.yearly_total = 120;
  const result = validateEstimate(current.estimate, current.options);
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("closure: workspace-root produced captures resolve from arbitrary nested agent-output project roots", (t) => {
  const workspace = path.join(directory(t), "workspace");
  const project = path.join(workspace, "agent-output", "synthetic");
  fs.mkdirSync(project, { recursive: true });
  const source = setup(t);
  source.estimate.resources[0].calculation_basis.components = [source.component(source.rows[0])];
  source.total();
  const estimate = evidenceBackedFixture(source.estimate, project, { cwd: workspace });
  assert.ok(estimate.evidence[0].evidence_path.startsWith("agent-output/synthetic/"));
  assert.equal(
    resolveWorkspacePath(estimate.evidence[0].evidence_path, project),
    path.join(workspace, estimate.evidence[0].evidence_path),
  );
  assert.equal(resolveWorkspacePath("prices.json", project), path.join(project, "prices.json"));
  const read = (reference) =>
    fs.readFileSync(path.resolve(reference.startsWith("agent-output/") ? workspace : project, reference));
  const result = validateEstimate(estimate, {
    cwd: project,
    requestPath: "pricing-request.json",
    readEvidenceFile: read,
    readRequestFile: read,
  });
  assert.equal(result.ok, true, result.errors.join("; "));
});
