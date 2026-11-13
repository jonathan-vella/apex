import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

  // Contradictory component hours_per_month on a 730h bound request MUST fail validation (Thread #3)
  const mismatch = structuredClone(estimate);
  mismatch.resources[0].calculation_basis.components[0].hours_per_month = 0;
  const mismatchCheck = validateEstimate(mismatch, {
    cwd: PRICING_ROOT,
    requestPath: riReqPath,
    verifyEvidenceFiles: true,
  });
  assert.equal(mismatchCheck.ok, false);
  assert.match(mismatchCheck.errors.join(" "), /contradicts bound request/);

  // Bound 48-hour request with matching usage_amount: 48 and omitted component.hours_per_month MUST fail Cold-standby guard without ri_breakeven_verified (Thread #3)
  const coldBound = buildV22Fixture(t, {
    priceType: "Reservation",
    inputs: [
      {
        name: "cold-ri-vm",
        service_name: "Virtual Machines",
        sku: "Standard_D4s_v5",
        region: "uaenorth",
        quantity: 1,
        hours_per_month: 48,
        commitment: { type: "reservation", term: "3-year" },
      },
    ],
    rows: [riRow],
  });
  coldBound.estimate.resources[0].calculation_basis.components = [
    {
      evidence_ref: {
        evidence_path: coldBound.capture.evidence_path,
        row_sha256: [digestObject(normalizeMeter(riRow))],
      },
      meter_id: riRow.meterId,
      product_name: riRow.productName,
      billing_region: riRow.armRegionName,
      unit_of_measure: "1 Hour",
      reservation_term: "3 Years",
      effective_start_date: riRow.effectiveStartDate,
      retail_price: 3600,
      usage_amount: 48,
      usage_scope: "per-instance",
      unit_conversion: { usage_unit: "hours", native_unit: "1 Hour", units_per_native_unit: 1, reason: "3Y RI" },
    },
  ];
  coldBound.estimate.resources[0].monthly_cost = calculateLineCost(coldBound.estimate.resources[0].calculation_basis);
  coldBound.estimate.monthly_total = coldBound.estimate.resources[0].monthly_cost;
  coldBound.estimate.yearly_total = coldBound.estimate.monthly_total * 12;
  const coldCheck = validateEstimate(coldBound.estimate, {
    cwd: PRICING_ROOT,
    requestPath: coldBound.requestPath,
    verifyEvidenceFiles: true,
  });
  assert.equal(coldCheck.ok, false);
  assert.match(coldCheck.errors.join(" "), /Cold-standby/);

  // Scenario zero-quantity or hours_per_month override on a reserved line MUST be rejected (Thread #1)
  assert.throws(
    () =>
      calculateScenarios(
        estimate,
        { deallocated: { "dc-vm-ri": { quantity: 0 } } },
        { cwd: PRICING_ROOT, requestPath: riReqPath },
      ),
    /Prepaid Reservation commitment remains payable/,
  );
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

test("v2.2 PR #842 review fixes: Consumption reservation_term rejection, dual 1Y+3Y RI catalog, Windows+ahb-windows, 1/Month disk & 1/Hour Bastion implicit coverage, flat basis scenarios, portfolio binding, CLI Reservation capture, and direct retry/Reservation fallback", async (t) => {
  // Thread #2: Consumption component supplying reservation_term MUST fail validation
  const paygRow = {
    meterId: "vm-payg",
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
    retailPrice: 360,
  };
  const fakeRi = buildV22Fixture(t, {
    inputs: [
      { name: "vm-payg", service_name: "Virtual Machines", sku: "Standard_D4s_v5", region: "uaenorth", quantity: 1 },
    ],
    rows: [paygRow],
  });
  fakeRi.estimate.resources[0].calculation_basis.components = [
    {
      evidence_ref: {
        evidence_path: fakeRi.capture.evidence_path,
        row_sha256: [digestObject(normalizeMeter(paygRow))],
      },
      meter_id: paygRow.meterId,
      product_name: paygRow.productName,
      billing_region: paygRow.armRegionName,
      unit_of_measure: "1 Hour",
      reservation_term: "3 Years",
      effective_start_date: paygRow.effectiveStartDate,
      retail_price: 360,
      usage_amount: 730,
      usage_scope: "per-instance",
      unit_conversion: { usage_unit: "hours", native_unit: "1 Hour", units_per_native_unit: 1, reason: "Hourly" },
    },
  ];
  fakeRi.estimate.resources[0].monthly_cost = calculateLineCost(fakeRi.estimate.resources[0].calculation_basis);
  fakeRi.estimate.monthly_total = fakeRi.estimate.resources[0].monthly_cost;
  fakeRi.estimate.yearly_total = fakeRi.estimate.monthly_total * 12;
  const fakeRiRes = validateEstimate(fakeRi.estimate, {
    cwd: PRICING_ROOT,
    requestPath: fakeRi.requestPath,
    verifyEvidenceFiles: true,
  });
  assert.equal(fakeRiRes.ok, false);
  assert.match(fakeRiRes.errors.join(" "), /forbidden without a bound v2\.2 reservation commitment/);

  // Thread #5, #6, #9, #10: Portfolio binding retains budget_tier=portfolio (60 allowance), CLI captures Reservation with both 1Y & 3Y rows in catalog, and operating_system: "Windows" + license: "ahb-windows" validates cleanly
  const dir = makeTempDir(t);
  const cliOut = path.join(dir, "portfolio-ri.json");
  const cliReqPath = path.join(dir, "portfolio-req.json");
  const cliReq = {
    project_name: "portfolio-ri",
    region: "uaenorth",
    currency: "USD",
    output_path: cliOut,
    budget_tier: "portfolio",
    resource_list: [
      {
        name: "win-ahb-ri",
        service_name: "Virtual Machines",
        sku: "Standard_D4s_v5",
        region: "uaenorth",
        quantity: 1,
        operating_system: "Windows",
        license: "ahb-windows",
        commitment: { type: "reservation", term: "3-year" },
      },
    ],
  };
  fs.writeFileSync(cliReqPath, JSON.stringify(cliReq));
  const portfolioBinding = bindCostRequest(cliReq, { requestPath: cliReqPath, cwd: PRICING_ROOT });
  assert.equal(portfolioBinding.request_snapshot.budget_tier, "portfolio");

  const riQueryPath = path.join(dir, "ri-query.json");
  const riQuery = {
    serviceName: "Virtual Machines",
    armSkuName: "Standard_D4s_v5",
    currencyCode: "USD",
    priceType: "Reservation",
  };
  fs.writeFileSync(riQueryPath, JSON.stringify(riQuery));
  const ri1Y = {
    meterId: "ri-d4",
    meterName: "D4s v5",
    serviceName: "Virtual Machines",
    productName: "Virtual Machines Dsv5 Series",
    skuName: "D4s v5",
    armSkuName: "Standard_D4s_v5",
    armRegionName: "uaenorth",
    currencyCode: "USD",
    type: "Reservation",
    reservationTerm: "1 Year",
    unitOfMeasure: "1 Hour",
    tierMinimumUnits: 0,
    effectiveStartDate: "2023-01-01T00:00:00Z",
    retailPrice: 1500,
  };
  const ri3Y = { ...ri1Y, reservationTerm: "3 Years", retailPrice: 3600 };
  const riRespPath = path.join(dir, "ri-both-terms.json");
  fs.writeFileSync(riRespPath, JSON.stringify({ status: 200, results: { prices: [ri1Y, ri3Y] } }));

  const scriptPath = new URL("../../scripts/cost-estimate.mjs", import.meta.url).pathname;
  let captureStdout = "";
  for (const args of [
    ["reserve-query", "--request", cliReqPath, "--query", riQueryPath, "--output", cliOut, "--call-id", "cli-ri-1"],
    ["issue-query", "--request", cliReqPath, "--query", riQueryPath, "--output", cliOut, "--call-id", "cli-ri-1"],
    [
      "capture-response",
      "--request",
      cliReqPath,
      "--query",
      riQueryPath,
      "--output",
      cliOut,
      "--call-id",
      "cli-ri-1",
      "--response",
      riRespPath,
      "--native-call-id",
      "nat-ri-1",
    ],
  ]) {
    const proc = spawnSync(process.execPath, [scriptPath, ...args], { cwd: PRICING_ROOT, encoding: "utf8" });
    assert.equal(proc.status, 0, proc.stderr || proc.stdout);
    captureStdout = proc.stdout;
  }
  const capturedMeta = JSON.parse(captureStdout);
  const portfolioEst = {
    schema_version: "cost-estimate-v2.2",
    budget_tier: "portfolio",
    purpose: "monthly-estimate",
    status: "COMPLETE",
    project_name: "portfolio-ri",
    region: "uaenorth",
    currency: "USD",
    queried_at: capturedMeta.queried_at,
    resources: [
      {
        name: "win-ahb-ri",
        service_name: "Virtual Machines",
        sku: "Standard_D4s_v5",
        region: "uaenorth",
        quantity: 1,
        subscription: null,
        notes: "Windows AHB + 3Y RI",
        calculation_basis: {
          name: "win-ahb-ri",
          service_name: "Virtual Machines",
          sku: "Standard_D4s_v5",
          region: "uaenorth",
          quantity: 1,
          request_line_sha256: digestObject(portfolioBinding.request_snapshot.lines[0]),
          components: [
            {
              evidence_ref: {
                evidence_path: capturedMeta.evidence_path,
                row_sha256: [digestObject(normalizeMeter(ri3Y))],
              },
              meter_id: ri3Y.meterId,
              product_name: ri3Y.productName,
              billing_region: "uaenorth",
              unit_of_measure: "1 Hour",
              reservation_term: "3 Years",
              effective_start_date: ri3Y.effectiveStartDate,
              retail_price: 3600,
              usage_amount: 730,
              usage_scope: "per-instance",
              unit_conversion: {
                usage_unit: "hours",
                native_unit: "1 Hour",
                units_per_native_unit: 1,
                reason: "3Y RI",
              },
            },
          ],
        },
        monthly_cost: 100,
      },
    ],
    monthly_total: 100,
    yearly_total: 1200,
    optimization_notes: [],
    savings_status: "NOT_APPLICABLE",
    savings_reason: "test",
    eligible_strategies: [],
    data_source: "Azure MCP pricing_get",
    confidence: "High",
    unresolved_items: [],
    mcp_calls_used: 1,
    direct_api_calls_used: 0,
    budget_exceeded: false,
    request_snapshot: portfolioBinding.request_snapshot,
    request_sha256: portfolioBinding.request_sha256,
    evidence: [{ evidence_path: capturedMeta.evidence_path }],
  };
  const portfolioValid = validateEstimate(portfolioEst, {
    cwd: PRICING_ROOT,
    requestPath: cliReqPath,
    verifyEvidenceFiles: true,
  });
  assert.equal(portfolioValid.ok, true, portfolioValid.errors.join("; "));

  // Thread #7, #8, #11: Implicit 1/Month Managed Disk and 1/Hour Bastion without usage, plus flat non-componentized hours_per_month scenario override
  const diskRow = {
    meterId: "disk-p30",
    meterName: "P30 LRS Disk",
    serviceName: "Storage",
    productName: "Premium SSD Managed Disks",
    skuName: "P30 LRS",
    armSkuName: "Premium_LRS",
    armRegionName: "uaenorth",
    currencyCode: "USD",
    type: "Consumption",
    unitOfMeasure: "1/Month",
    tierMinimumUnits: 0,
    effectiveStartDate: "2023-01-01T00:00:00Z",
    retailPrice: 135.17,
  };
  const bastionRow = {
    meterId: "bas-std",
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
  };
  const diskFix = buildV22Fixture(t, {
    inputs: [
      { name: "os-disk", service_name: "Managed Disks", sku: "P30 LRS", region: "uaenorth", quantity: 2 },
      { name: "bastion-gw", service_name: "Azure Bastion", sku: "Standard", region: "uaenorth", quantity: 1 },
    ],
    rows: [diskRow],
  });
  const basResp = path.join(diskFix.dir, "bas.json");
  fs.writeFileSync(basResp, JSON.stringify({ status: 200, results: { prices: [bastionRow] } }));
  reserveQuery({
    output: diskFix.output,
    query: { serviceName: "Azure Bastion", currencyCode: "USD", priceType: "Consumption" },
    call_id: "bas-1",
    request_binding_path: diskFix.binding.request_binding_path,
  });
  updateAttempt(diskFix.output, "bas-1", { state: "issued", issued_at: new Date().toISOString() });
  const basCap = captureMcpResponse({
    output: diskFix.output,
    query: { serviceName: "Azure Bastion", currencyCode: "USD", priceType: "Consumption" },
    call_id: "bas-1",
    native_call_id: "nat-bas-1",
    response_path: basResp,
  });
  diskFix.estimate.evidence.push({ evidence_path: basCap.evidence_path });
  diskFix.estimate.mcp_calls_used = 2;

  diskFix.estimate.resources[0].calculation_basis.components = [
    {
      evidence_ref: {
        evidence_path: diskFix.capture.evidence_path,
        row_sha256: [digestObject(normalizeMeter(diskRow))],
      },
      meter_id: diskRow.meterId,
      product_name: diskRow.productName,
      billing_region: "uaenorth",
      unit_of_measure: "1/Month",
      effective_start_date: diskRow.effectiveStartDate,
      retail_price: 135.17,
      usage_amount: 1,
      usage_scope: "per-instance",
      unit_conversion: {
        usage_unit: "months",
        native_unit: "1/Month",
        units_per_native_unit: 1,
        reason: "Monthly disk",
      },
    },
  ];
  // Use flat non-componentized calculation_basis on Bastion to verify Thread #8 + Thread #11 together!
  delete diskFix.estimate.resources[1].calculation_basis.components;
  Object.assign(diskFix.estimate.resources[1].calculation_basis, {
    evidence_ref: { evidence_path: basCap.evidence_path, row_sha256: [digestObject(normalizeMeter(bastionRow))] },
    meter_id: bastionRow.meterId,
    product_name: bastionRow.productName,
    billing_region: "uaenorth",
    unit_of_measure: "1/Hour",
    tier_metadata_status: "not-applicable-fixed-hourly",
    effective_start_date: bastionRow.effectiveStartDate,
    retail_price: 0.29,
    usage_amount: 730,
    usage_scope: "per-instance",
    unit_conversion: { usage_unit: "hours", native_unit: "1/Hour", units_per_native_unit: 1, reason: "Hourly Bastion" },
  });
  for (const r of diskFix.estimate.resources) r.monthly_cost = calculateLineCost(r.calculation_basis);
  diskFix.estimate.monthly_total = round6Sum(diskFix.estimate.resources);
  diskFix.estimate.yearly_total = Number((diskFix.estimate.monthly_total * 12).toFixed(6));

  const diskBasValid = validateEstimate(diskFix.estimate, {
    cwd: PRICING_ROOT,
    requestPath: diskFix.requestPath,
    verifyEvidenceFiles: true,
  });
  assert.equal(diskBasValid.ok, true, diskBasValid.errors.join("; "));

  const flatScen = calculateScenarios(
    diskFix.estimate,
    { drill_48h: { "bastion-gw": { hours_per_month: 48 } } },
    { cwd: PRICING_ROOT, requestPath: diskFix.requestPath },
  );
  // 2 * 135.17 ($270.34) + 48 * 0.29 ($13.92) = $284.26
  assert.equal(flatScen.scenarios.drill_48h.monthly_total, 284.26);

  // Thread #4 & #12: Reservation direct fallback + transient 429 retry accounting
  const dir2 = makeTempDir(t);
  const riDirectOut = path.join(dir2, "ri-direct.json");
  const riFallbackReqPath = path.join(dir2, "ri-fb-req.json");
  const riFbReq = {
    project_name: "ri-fb",
    region: "uaenorth",
    currency: "USD",
    output_path: path.join(dir2, "est.json"),
    resource_list: [
      {
        name: "blob-rc",
        service_name: "Storage",
        sku: "100 TB",
        region: "uaenorth",
        quantity: 1,
        commitment: { type: "reservation", term: "3-year" },
        usage: [
          { dimension: "capacity_gb", amount: 102400, unit: "GB", scope: "aggregate" },
          {
            dimension: "read_operations",
            amount: 0,
            zero_usage_confirmed: true,
            unit: "operations",
            scope: "aggregate",
          },
          {
            dimension: "write_operations",
            amount: 0,
            zero_usage_confirmed: true,
            unit: "operations",
            scope: "aggregate",
          },
          { dimension: "egress_gb", amount: 0, zero_usage_confirmed: true, unit: "GB", scope: "aggregate" },
        ],
      },
    ],
  };
  fs.writeFileSync(riFallbackReqPath, JSON.stringify(riFbReq));
  const riFbBind = bindCostRequest(riFbReq, { requestPath: riFallbackReqPath, cwd: PRICING_ROOT });
  const riDirectQuery = {
    serviceName: "Storage",
    armRegionName: "uaenorth",
    productName: "Blob Storage Reserved Capacity",
    skuName: "100 TB",
    priceType: "Reservation",
    currencyCode: "USD",
  };
  const emptyMcpPath = path.join(dir2, "mcp-empty-ri.json");
  fs.writeFileSync(emptyMcpPath, JSON.stringify({ status: 200, results: { prices: [] } }));
  reserveQuery({
    output: riDirectOut,
    query: riDirectQuery,
    call_id: "mcp-ri-empty",
    request_binding_path: riFbBind.request_binding_path,
  });
  updateAttempt(riDirectOut, "mcp-ri-empty", { state: "issued", issued_at: new Date().toISOString() });
  const emptyRiCap = captureMcpResponse({
    output: riDirectOut,
    query: riDirectQuery,
    call_id: "mcp-ri-empty",
    native_call_id: "nat-ri-empty",
    response_path: emptyMcpPath,
  });

  const initialRiUrl = retailQueryUrl(riDirectQuery, { allowReservation: true });
  const nextPageUrl = new URL(initialRiUrl.href);
  nextPageUrl.searchParams.set("$skip", "100");

  let callCount = 0;
  const page1Body = {
    BillingCurrency: "USD",
    Items: [
      {
        meterId: "blob-rc-100tb",
        meterName: "100 TB Reserved Capacity",
        productName: "Blob Storage Reserved Capacity",
        skuName: "100 TB",
        serviceName: "Storage",
        armRegionName: "uaenorth",
        armSkuName: "Blob_Storage_Reserved_Capacity_100TB",
        currencyCode: "USD",
        type: "Reservation",
        reservationTerm: "3 Years",
        unitOfMeasure: "100 TB",
        tierMinimumUnits: 0,
        retailPrice: 46080,
        effectiveStartDate: "2023-01-01T00:00:00Z",
      },
    ],
    NextPageLink: nextPageUrl.href,
  };
  const page2Body = { BillingCurrency: "USD", Items: [], NextPageLink: null };

  const retryResult = await fetchRetailEvidence(
    {
      query: riDirectQuery,
      allow_reservation: true,
      output_path: riDirectOut,
      remaining_requests: 4,
      mcp_failure: {
        kind: "empty_result",
        recorded_at: new Date().toISOString(),
        attempts: [{ evidence_path: emptyRiCap.evidence_path }],
      },
    },
    async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          headers: new Map([["retry-after", "0"]]),
          arrayBuffer: async () => Buffer.from(JSON.stringify({ error: "throttled" }), "utf8"),
        };
      }
      const payload = callCount === 2 ? page1Body : page2Body;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from(JSON.stringify(payload), "utf8"),
      };
    },
    { retryTransient: true, minDelayMs: 0 },
  );
  // 1 failed 429 + 1 retried page 1 + 1 page 2 = 3 actual requests accounted!
  assert.equal(callCount, 3);
  assert.equal(retryResult.requests_used, 3);
  assert.equal(retryResult.attempts.length, 3);
  assert.equal(retryResult.attempts[0].state, "error");
  assert.equal(retryResult.attempts[0].http_status, 429);
  assert.equal(retryResult.attempts[1].state, "completed");
  assert.equal(retryResult.pages.length, 2);

  // Replay from saved output succeeds with 0 new requests and validates allow_reservation
  const replayed = await fetchRetailEvidence(
    {
      query: riDirectQuery,
      allow_reservation: true,
      output_path: riDirectOut,
      remaining_requests: 4,
      mcp_failure: {
        kind: "empty_result",
        recorded_at: new Date().toISOString(),
        attempts: [{ evidence_path: emptyRiCap.evidence_path }],
      },
    },
    () => assert.fail("must replay without fetching"),
  );
  assert.equal(replayed.requests_issued_this_run, 0);
  assert.equal(replayed.requests_used, 3);
});

function round6Sum(resources) {
  return Number(resources.reduce((s, r) => s + r.monthly_cost, 0).toFixed(6));
}
