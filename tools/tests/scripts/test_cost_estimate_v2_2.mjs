import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  bindCostRequest,
  calculateLineCost,
  calculateScenarios,
  normalizeCostRequest,
  validateEstimate,
  validateRateQuote,
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

const HERE = path.dirname(new URL(import.meta.url).pathname);

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(HERE, ".pricing-v22-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function buildV22Fixture(
  t,
  { schemaVersion = "cost-estimate-v2.2", budgetTier = "standard", inputs, rows, priceType = "Consumption" },
) {
  const dir = makeTempDir(t);
  const output = path.join(dir, "estimate.json");
  const request = {
    project_name: "v22-test",
    region: "uaenorth",
    currency: "USD",
    output_path: output,
    ...(budgetTier === "portfolio" ? { budget_tier: "portfolio" } : {}),
    resource_list: inputs,
  };
  const requestPath = path.join(dir, "pricing-request.json");
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const binding = bindCostRequest(request, { requestPath, cwd: PRICING_ROOT });
  const query = { serviceName: rows[0].serviceName, currencyCode: "USD", priceType };
  const responsePath = path.join(dir, "native-response.json");
  fs.writeFileSync(responsePath, JSON.stringify({ status: 200, results: { prices: rows } }));
  reserveQuery({
    output,
    query,
    call_id: "res-1",
    request_binding_path: binding.request_binding_path,
    remaining_requests: budgetTier === "portfolio" ? 60 : 20,
  });
  updateAttempt(output, "res-1", { state: "issued", issued_at: new Date().toISOString() });
  const capture = captureMcpResponse({
    output,
    query,
    call_id: "res-1",
    native_call_id: "native-1",
    response_path: responsePath,
  });

  const resources = binding.request_snapshot.lines.map((line) => ({
    name: line.name,
    service_name: line.service_name,
    sku: line.sku,
    region: line.region,
    quantity: line.quantity,
    subscription: line.subscription ?? null,
    ...(line.usage ? { usage: line.usage } : {}),
    notes: "v2.2 synthetic fixture",
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
    schema_version: schemaVersion,
    ...(budgetTier === "portfolio" ? { budget_tier: "portfolio" } : {}),
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
    savings_reason: "v2.2 test",
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

  return { dir, output, requestPath, binding, capture, estimate };
}

test("v2.2 G10/G11: normalizeMeter and computeComponentCost accept 1/Hour, 1 Second, and 1 GiB Second", () => {
  const oneSlashHour = normalizeMeter({
    meterId: "m-bastion",
    meterName: "Standard Gateway",
    serviceName: "Azure Bastion",
    productName: "Azure Bastion",
    skuName: "Standard",
    armSkuName: "",
    armRegionName: "uaenorth",
    currencyCode: "USD",
    type: "Consumption",
    unitOfMeasure: "1/Hour",
    effectiveStartDate: "2023-01-01T00:00:00Z",
    retailPrice: 0.29,
  });
  assert.equal(oneSlashHour.tierMinimumUnits, null);

  const bastionMonthly = calculateLineCost({
    quantity: 1,
    components: [
      {
        unit_of_measure: "1/Hour",
        retail_price: 0.29,
        hours_per_month: 730,
      },
    ],
  });
  assert.equal(bastionMonthly, 211.7);

  const acaCost = calculateLineCost({
    quantity: 1,
    components: [
      { unit_of_measure: "1 Second", retail_price: 0.000024, usage_amount: 1000000 },
      { unit_of_measure: "1 GiB Second", retail_price: 0.000003, usage_amount: 2000000 },
    ],
  });
  assert.equal(acaCost, 30);
});

test("v2.2 G12: operating_system Linux accepts Linux VM series while rejecting Windows and non-VM synthetic products", (t) => {
  const linuxVmRow = {
    meterId: "vm-edsv5",
    meterName: "E16ds v5",
    serviceName: "Virtual Machines",
    productName: "Virtual Machines Edsv5 Series",
    skuName: "E16ds v5",
    armSkuName: "Standard_E16ds_v5",
    armRegionName: "uaenorth",
    currencyCode: "USD",
    type: "Consumption",
    unitOfMeasure: "1 Hour",
    tierMinimumUnits: 0,
    effectiveStartDate: "2023-01-01T00:00:00Z",
    retailPrice: 1.2,
  };
  const { requestPath, capture, estimate } = buildV22Fixture(t, {
    inputs: [
      {
        name: "linux-db-vm",
        service_name: "Virtual Machines",
        sku: "Standard_E16ds_v5",
        region: "uaenorth",
        quantity: 1,
        operating_system: "Linux",
      },
    ],
    rows: [linuxVmRow],
  });
  estimate.resources[0].calculation_basis.components = [
    {
      evidence_ref: { evidence_path: capture.evidence_path, row_sha256: [digestObject(normalizeMeter(linuxVmRow))] },
      meter_id: linuxVmRow.meterId,
      product_name: linuxVmRow.productName,
      billing_region: linuxVmRow.armRegionName,
      unit_of_measure: "1 Hour",
      effective_start_date: linuxVmRow.effectiveStartDate,
      retail_price: 1.2,
      usage_amount: 730,
      usage_scope: "per-instance",
      unit_conversion: { usage_unit: "hours", native_unit: "1 Hour", units_per_native_unit: 1, reason: "Hourly VM" },
    },
  ];
  estimate.resources[0].monthly_cost = calculateLineCost(estimate.resources[0].calculation_basis);
  estimate.monthly_total = estimate.resources[0].monthly_cost;
  estimate.yearly_total = estimate.monthly_total * 12;

  const valid = validateEstimate(estimate, { cwd: PRICING_ROOT, requestPath, verifyEvidenceFiles: true });
  assert.equal(valid.ok, true, valid.errors.join("; "));

  // Must still reject Windows product when Linux was requested
  const winRow = { ...linuxVmRow, meterId: "vm-win", productName: "Virtual Machines Edsv5 Series Windows" };
  const badWin = buildV22Fixture(t, {
    inputs: [
      {
        name: "bad-win",
        service_name: "Virtual Machines",
        sku: "Standard_E16ds_v5",
        region: "uaenorth",
        quantity: 1,
        operating_system: "Linux",
      },
    ],
    rows: [winRow],
  });
  badWin.estimate.resources[0].calculation_basis.components = [
    {
      evidence_ref: { evidence_path: badWin.capture.evidence_path, row_sha256: [digestObject(normalizeMeter(winRow))] },
      meter_id: winRow.meterId,
      product_name: winRow.productName,
      billing_region: winRow.armRegionName,
      unit_of_measure: "1 Hour",
      effective_start_date: winRow.effectiveStartDate,
      retail_price: 1.2,
      usage_amount: 730,
      usage_scope: "per-instance",
      unit_conversion: { usage_unit: "hours", native_unit: "1 Hour", units_per_native_unit: 1, reason: "Hourly VM" },
    },
  ];
  badWin.estimate.resources[0].monthly_cost = calculateLineCost(badWin.estimate.resources[0].calculation_basis);
  badWin.estimate.monthly_total = badWin.estimate.resources[0].monthly_cost;
  badWin.estimate.yearly_total = badWin.estimate.monthly_total * 12;
  const badCheck = validateEstimate(badWin.estimate, {
    cwd: PRICING_ROOT,
    requestPath: badWin.requestPath,
    verifyEvidenceFiles: true,
  });
  assert.equal(badCheck.ok, false);
  assert.match(badCheck.errors.join(" "), /operating_system is unverifiable/);
});

test("v2.2 C1/G1/G8/G13: BCDR/Enterprise recipes, Hot Blob no-egress, query coalescing, portfolio budget, and rate-quote", () => {
  const normalized = normalizeCostRequest({
    project_name: "bcdr-portfolio",
    region: "uaenorth",
    currency: "USD",
    output_path: "agent-output/bcdr-portfolio/02-cost-estimate.json",
    budget_tier: "portfolio",
    query_coalescing: "service-region",
    resource_list: [
      {
        name: "asr-1",
        service_name: "Azure Site Recovery",
        sku: "Azure",
        region: "uaenorth",
        quantity: 1,
        usage: [{ dimension: "protected_instances", amount: 250 }],
      },
      {
        name: "hot-blob",
        service_name: "Storage",
        sku: "Hot LRS",
        region: "uaenorth",
        quantity: 1,
        usage: [
          { dimension: "capacity_gb", amount: 500 },
          { dimension: "read_operations", amount: 10000 },
          { dimension: "write_operations", amount: 10000 },
        ],
      },
      ...Array.from({ length: 12 }, (_, idx) => ({
        name: `vm-${idx}`,
        service_name: "Virtual Machines",
        sku: `Standard_D${(idx % 6) * 2 + 2}s_v5`,
        region: "uaenorth",
        quantity: 1,
      })),
    ],
  });
  assert.equal(normalized.budget_tier, "portfolio");
  assert.equal(normalized.remaining_requests, 60);
  // 1 ASR group + 1 Storage group + 6 distinct VM SKUs coalesced into ceil(6/10)=1 group = 3
  assert.equal(normalized.estimated_query_groups, 3);

  // rate-quote on an unreciped service succeeds when meter_applicability + native_unit are supplied
  const quoteReq = normalizeCostRequest({
    purpose: "rate-quote",
    project_name: "custom-quote",
    region: "uaenorth",
    currency: "USD",
    output_path: "agent-output/custom-quote/quote.json",
    resource_list: [
      {
        name: "custom-fabric",
        service_name: "Some Future Service",
        sku: "F2",
        region: "uaenorth",
        quantity: 1,
        meter_applicability: "Hourly capacity unit",
        native_unit: "1 Hour",
      },
    ],
  });
  assert.equal(quoteReq.purpose, "rate-quote");
  assert.equal(quoteReq.lines.length, 1);
  assert.equal(typeof validateRateQuote, "function");
});

test("v2.2 C4/G9: Reservation 3-Year /36 amortization, ahb-windows, and cold-standby (<730h) RI guard", (t) => {
  // Default retailQueryUrl still rejects Reservation without explicit opt-in
  assert.throws(
    () => retailQueryUrl({ serviceName: "Virtual Machines", priceType: "Reservation", currencyCode: "USD" }),
    /Consumption priceType/,
  );
  const riUrl = retailQueryUrl(
    { serviceName: "Virtual Machines", priceType: "Reservation", currencyCode: "USD" },
    { allowReservation: true },
  );
  assert.match(riUrl.searchParams.get("$filter"), /priceType eq 'Reservation'/);

  const riRow = {
    meterId: "ri-d4sv5-3y",
    meterName: "D4s v5",
    serviceName: "Virtual Machines",
    productName: "Virtual Machines Dsv5 Series",
    skuName: "D4s v5",
    armSkuName: "Standard_D4s_v5",
    armRegionName: "uaenorth",
    currencyCode: "USD",
    type: "Reservation",
    reservationTerm: "3 Years",
    unitOfMeasure: "1 Hour",
    tierMinimumUnits: 0,
    effectiveStartDate: "2023-01-01T00:00:00Z",
    retailPrice: 3600,
  };

  const {
    requestPath: riReqPath,
    capture,
    estimate,
  } = buildV22Fixture(t, {
    priceType: "Reservation",
    inputs: [
      {
        name: "dc-vm-ri",
        service_name: "Virtual Machines",
        sku: "Standard_D4s_v5",
        region: "uaenorth",
        quantity: 2,
        license: "ahb-windows",
        commitment: { type: "reservation", term: "3-year" },
      },
    ],
    rows: [riRow],
  });

  estimate.resources[0].calculation_basis.components = [
    {
      evidence_ref: { evidence_path: capture.evidence_path, row_sha256: [digestObject(normalizeMeter(riRow))] },
      meter_id: riRow.meterId,
      product_name: riRow.productName,
      billing_region: riRow.armRegionName,
      unit_of_measure: "1 Hour",
      reservation_term: "3 Years",
      effective_start_date: riRow.effectiveStartDate,
      retail_price: 3600,
      usage_amount: 730,
      usage_scope: "per-instance",
      unit_conversion: { usage_unit: "hours", native_unit: "1 Hour", units_per_native_unit: 1, reason: "3Y RI" },
    },
  ];
  // 3600 / 36 * 2 = $200/month
  estimate.resources[0].monthly_cost = calculateLineCost(estimate.resources[0].calculation_basis);
  assert.equal(estimate.resources[0].monthly_cost, 200);
  estimate.monthly_total = 200;
  estimate.yearly_total = 2400;

  const ok = validateEstimate(estimate, { cwd: PRICING_ROOT, requestPath: riReqPath, verifyEvidenceFiles: true });
  assert.equal(ok.ok, true, ok.errors.join("; "));

  // Cold-standby (<730h/mo) without ri_breakeven_verified MUST fail validation
  const cold = structuredClone(estimate);
  cold.resources[0].calculation_basis.components[0].hours_per_month = 0;
  const coldCheck = validateEstimate(cold, { cwd: PRICING_ROOT, requestPath: riReqPath, verifyEvidenceFiles: true });
  assert.equal(coldCheck.ok, false);
  assert.match(coldCheck.errors.join(" "), /Cold-standby/);
});

test("v2.2 G4/RD2-13: single_non_hourly_missing_tier_metadata authorizes <100-row unpaged MCP response and rejects >=100-row truncated response", async (t) => {
  const dir = makeTempDir(t);
  const output = path.join(dir, "pe-direct.json");
  const peQuery = {
    serviceName: "Virtual Network",
    armRegionName: "uaenorth",
    productName: "Azure Private Link",
    skuName: "Standard",
    meterName: "Standard Data Processed - Ingress",
    priceType: "Consumption",
    currencyCode: "USD",
  };
  const reqFile = path.join(dir, "req.json");
  const costReq = {
    project_name: "pe-fallback",
    region: "uaenorth",
    currency: "USD",
    output_path: path.join(dir, "est.json"),
    resource_list: [
      {
        name: "pe-1",
        service_name: "Azure Private Link",
        sku: "Standard",
        region: "uaenorth",
        quantity: 1,
        usage: [
          { dimension: "hours", amount: 730 },
          { dimension: "ingress_gb", amount: 100 },
          { dimension: "egress_gb", amount: 100 },
        ],
      },
    ],
  };
  fs.writeFileSync(reqFile, JSON.stringify(costReq));
  const binding = bindCostRequest(costReq, { requestPath: reqFile, cwd: PRICING_ROOT });

  // 1. Capture an unpaged (<100 rows) single non-hourly row omitting tierMinimumUnits -> AUTHORIZED
  const okMcpPath = path.join(dir, "mcp-ok.json");
  fs.writeFileSync(
    okMcpPath,
    JSON.stringify({
      status: 200,
      results: {
        prices: [
          {
            serviceName: "Virtual Network",
            region: "uaenorth",
            productName: "Azure Private Link",
            skuName: "Standard",
            meterName: "Standard Data Processed - Ingress",
            unitOfMeasure: "1 GB",
            retailPrice: 0.01,
          },
        ],
      },
    }),
  );
  reserveQuery({ output, query: peQuery, call_id: "mcp-1", request_binding_path: binding.request_binding_path });
  updateAttempt(output, "mcp-1", { state: "issued", issued_at: new Date().toISOString() });
  const okCapture = captureMcpResponse({
    output,
    query: peQuery,
    call_id: "mcp-1",
    native_call_id: "native-mcp-1",
    response_path: okMcpPath,
  });

  const directPage = {
    BillingCurrency: "USD",
    Items: [
      {
        meterId: "pe-ing-1",
        meterName: "Standard Data Processed - Ingress",
        productName: "Azure Private Link",
        skuName: "Standard",
        serviceName: "Virtual Network",
        armRegionName: "uaenorth",
        armSkuName: "",
        currencyCode: "USD",
        type: "Consumption",
        unitOfMeasure: "1 GB",
        tierMinimumUnits: 0,
        retailPrice: 0.01,
        effectiveStartDate: "2023-01-01T00:00:00Z",
      },
    ],
    NextPageLink: null,
  };
  const directResult = await fetchRetailEvidence(
    {
      query: peQuery,
      output_path: output,
      remaining_requests: 5,
      mcp_failure: {
        kind: "single_non_hourly_missing_tier_metadata",
        recorded_at: new Date().toISOString(),
        attempts: [{ evidence_path: okCapture.evidence_path }],
      },
    },
    async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from(JSON.stringify(directPage), "utf8"),
    }),
  );
  assert.equal(directResult.status, "COMPLETE");

  // 2. Capture a 100-row truncated MCP response -> REJECTED (RD2-13 anti-truncation guard)
  const truncMcpPath = path.join(dir, "mcp-trunc.json");
  const fillerRows = Array.from({ length: 99 }, (_, idx) => ({
    serviceName: "Virtual Network",
    region: "uaenorth",
    productName: "Other Product",
    skuName: `Other-${idx}`,
    meterName: `Other Meter ${idx}`,
    unitOfMeasure: "1 GB",
    retailPrice: 0.05,
  }));
  fs.writeFileSync(
    truncMcpPath,
    JSON.stringify({
      status: 200,
      results: {
        prices: [
          {
            serviceName: "Virtual Network",
            region: "uaenorth",
            productName: "Azure Private Link",
            skuName: "Standard",
            meterName: "Standard Data Processed - Ingress",
            unitOfMeasure: "1 GB",
            retailPrice: 0.01,
          },
          ...fillerRows,
        ],
      },
    }),
  );
  const truncQuery = { ...peQuery, meterName: "Standard Data Processed - Ingress" };
  const out2 = path.join(dir, "pe-trunc.json");
  reserveQuery({
    output: out2,
    query: { serviceName: "Virtual Network", currencyCode: "USD", priceType: "Consumption" },
    call_id: "mcp-2",
    request_binding_path: binding.request_binding_path,
  });
  updateAttempt(out2, "mcp-2", { state: "issued", issued_at: new Date().toISOString() });
  const truncCapture = captureMcpResponse({
    output: out2,
    query: { serviceName: "Virtual Network", currencyCode: "USD", priceType: "Consumption" },
    call_id: "mcp-2",
    native_call_id: "native-mcp-2",
    response_path: truncMcpPath,
  });
  await assert.rejects(
    fetchRetailEvidence(
      {
        query: truncQuery,
        output_path: out2,
        remaining_requests: 5,
        mcp_failure: {
          kind: "single_non_hourly_missing_tier_metadata",
          recorded_at: new Date().toISOString(),
          attempts: [{ evidence_path: truncCapture.evidence_path }],
        },
      },
      () => assert.fail("must not fetch when MCP returned >= 100 rows"),
    ),
    /unpaged \(<100 rows\)/,
  );
});

test("v2.2 C5: calculateScenarios supports quantity: 0, hours_per_month, dimensions, month1_factor, and baselineScenario", (t) => {
  const vmRow = {
    meterId: "vm-d4",
    meterName: "D4s v5",
    serviceName: "Virtual Machines",
    productName: "Virtual Machines Dsv5 Series",
    skuName: "D4s v5",
    armSkuName: "Standard_D4s_v5",
    armRegionName: "uaenorth",
    currencyCode: "USD",
    type: "Consumption",
    unitOfMeasure: "1 Hour",
    tierMinimumUnits: 0,
    effectiveStartDate: "2023-01-01T00:00:00Z",
    retailPrice: 0.2,
  };
  const asrRow = {
    meterId: "asr-1",
    meterName: "Azure Site Recovery to Azure",
    serviceName: "Azure Site Recovery",
    productName: "Azure Site Recovery",
    skuName: "Azure",
    armSkuName: "",
    armRegionName: "uaenorth",
    currencyCode: "USD",
    type: "Consumption",
    unitOfMeasure: "1/Month",
    tierMinimumUnits: 0,
    effectiveStartDate: "2023-01-01T00:00:00Z",
    retailPrice: 25,
  };
  const {
    dir,
    output: outPath,
    requestPath: scenReqPath,
    binding,
    capture,
    estimate,
  } = buildV22Fixture(t, {
    inputs: [
      {
        name: "cold-app-vms",
        service_name: "Virtual Machines",
        sku: "Standard_D4s_v5",
        region: "uaenorth",
        quantity: 10,
      },
      {
        name: "asr-replication",
        service_name: "Azure Site Recovery",
        sku: "Azure",
        region: "uaenorth",
        quantity: 1,
        usage: [{ dimension: "protected_instances", amount: 10, unit: "protected_instances", scope: "aggregate" }],
      },
    ],
    rows: [vmRow],
  });

  const asrQuery = { serviceName: "Azure Site Recovery", currencyCode: "USD", priceType: "Consumption" };
  const asrRespPath = path.join(dir, "asr-resp.json");
  fs.writeFileSync(asrRespPath, JSON.stringify({ status: 200, results: { prices: [asrRow] } }));
  reserveQuery({
    output: outPath,
    query: asrQuery,
    call_id: "res-2",
    request_binding_path: binding.request_binding_path,
  });
  updateAttempt(outPath, "res-2", {
    state: "issued",
    issued_at: new Date().toISOString(),
  });
  const asrCapture = captureMcpResponse({
    output: outPath,
    query: asrQuery,
    call_id: "res-2",
    native_call_id: "native-2",
    response_path: asrRespPath,
  });
  estimate.evidence.push({ evidence_path: asrCapture.evidence_path });
  estimate.mcp_calls_used = 2;

  estimate.resources[0].calculation_basis.components = [
    {
      evidence_ref: { evidence_path: capture.evidence_path, row_sha256: [digestObject(normalizeMeter(vmRow))] },
      meter_id: vmRow.meterId,
      product_name: vmRow.productName,
      billing_region: vmRow.armRegionName,
      unit_of_measure: "1 Hour",
      effective_start_date: vmRow.effectiveStartDate,
      retail_price: 0.2,
      usage_amount: 730,
      usage_scope: "per-instance",
      unit_conversion: { usage_unit: "hours", native_unit: "1 Hour", units_per_native_unit: 1, reason: "Hourly VM" },
    },
  ];
  estimate.resources[1].calculation_basis.components = [
    {
      evidence_ref: { evidence_path: asrCapture.evidence_path, row_sha256: [digestObject(normalizeMeter(asrRow))] },
      meter_id: asrRow.meterId,
      product_name: asrRow.productName,
      billing_region: asrRow.armRegionName,
      unit_of_measure: "1/Month",
      effective_start_date: asrRow.effectiveStartDate,
      retail_price: 25,
      usage_index: 0,
      usage_dimension: "protected_instances",
      usage_amount: 10,
      usage_scope: "aggregate",
      unit_conversion: {
        usage_unit: "protected_instances",
        native_unit: "1/Month",
        units_per_native_unit: 1,
        reason: "ASR protected instance per month",
      },
    },
  ];
  for (const r of estimate.resources) r.monthly_cost = calculateLineCost(r.calculation_basis);
  estimate.monthly_total = estimate.resources.reduce((s, r) => s + r.monthly_cost, 0);
  estimate.yearly_total = estimate.monthly_total * 12;

  const scenarios = calculateScenarios(
    estimate,
    {
      standby_month1: {
        "cold-app-vms": { quantity: 0 },
        "asr-replication": { month1_factor: 0 },
      },
      standby_ongoing: {
        "cold-app-vms": { quantity: 0 },
      },
      drill_48h: {
        "cold-app-vms": { hours_per_month: 48 },
      },
      active_failover: {},
    },
    { cwd: PRICING_ROOT, requestPath: scenReqPath, baselineScenario: "active_failover" },
  );

  assert.equal(scenarios.scenarios.standby_month1.monthly_total, 0);
  assert.equal(scenarios.scenarios.standby_ongoing.monthly_total, 250);
  // 10 VMs * 48h * $0.20 ($96) + $250 ASR = $346
  assert.equal(scenarios.scenarios.drill_48h.monthly_total, 346);
  // 10 VMs * 730h * $0.20 ($1460) + $250 ASR = $1710
  assert.equal(scenarios.scenarios.active_failover.monthly_total, 1710);
  assert.equal(scenarios.scenarios.standby_ongoing.savings_vs_baseline, 1460);
});
