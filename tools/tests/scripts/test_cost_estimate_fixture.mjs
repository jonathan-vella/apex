import fs from "node:fs";
import path from "node:path";
import {
  captureMcpResponse,
  digestObject,
  normalizeMeter,
  reserveQuery,
  updateAttempt,
  withLedger,
  PRICING_ROOT,
} from "../../scripts/_lib/pricing-evidence.mjs";
import {
  bindCostRequest,
  calculateLineCost,
  normalizeCostRequest,
  pricingRequestSnapshot,
} from "../../scripts/cost-estimate.mjs";

export function fixtureRequestOptions(estimate, options = {}) {
  const reference = estimate.evidence?.[0]?.evidence_path;
  return {
    ...options,
    requestPath:
      options.requestPath ??
      (reference
        ? path.resolve(options.cwd ?? PRICING_ROOT, path.dirname(reference), "..", "pricing-request.json")
        : undefined),
  };
}

/** Fully linked synthetic rates: these fixtures are never live Azure quotations. */
export function evidenceBackedFixture(
  source,
  directory,
  { queriedAt, cwd = directory, purpose = "monthly-estimate" } = {},
) {
  const timestamp = queriedAt ?? new Date(Date.now() - 1000).toISOString();
  if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp)))
    throw new Error("Synthetic fixture queriedAt must be a valid timestamp");
  const evidenceDirectory = path.join(directory, "pricing-evidence");
  if (fs.existsSync(evidenceDirectory) && fs.readdirSync(evidenceDirectory).length)
    throw new Error("Synthetic fixture requires a directory without existing pricing evidence");
  const estimate = structuredClone(source);
  estimate.schema_version = "cost-estimate-v2";
  estimate.purpose = purpose;
  estimate.queried_at = timestamp;
  estimate.resources = estimate.resources.map((resource) => {
    const result = { ...resource };
    if (result.service_name === "Synthetic service") result.service_name = "Azure App Service";
    if (result.usage_amount !== undefined && !result.usage)
      result.usage = {
        amount: result.usage_amount,
        unit: "GB",
        scope: "per-instance",
      };
    return result;
  });
  const rawRequest = {
    purpose: estimate.purpose,
    project_name: estimate.project_name,
    region: estimate.region,
    currency: estimate.currency,
    output_path: path.join(directory, "estimate.json"),
    resource_list: estimate.resources,
    ...(estimate.assessment_basis
      ? { assessment_basis: estimate.assessment_basis, assumptions: estimate.assumptions }
      : {}),
  };
  const requestPath = path.join(directory, "pricing-request.json");
  fs.writeFileSync(requestPath, JSON.stringify(rawRequest));
  const normalized = normalizeCostRequest(rawRequest, { cwd });
  const binding = bindCostRequest(rawRequest, { requestPath, cwd });
  estimate.request_snapshot = pricingRequestSnapshot(normalized);
  estimate.request_sha256 = digestObject(estimate.request_snapshot);
  estimate.evidence = [];
  estimate.mcp_calls_used = 0;
  estimate.direct_api_calls_used = 0;
  const captures = new Map();
  for (const [index, resource] of estimate.resources.entries()) {
    const input = normalized.lines[index];
    const unit = resource.unit_of_measure ?? "1 Hour";
    const usageAmount = resource.usage_amount ?? resource.usage?.amount ?? 730;
    const usageScope = resource.usage?.scope ?? "per-instance";
    const usageUnit = resource.usage?.unit ?? (resource.usage_amount !== undefined ? "GB" : "hours");
    const rate =
      resource.retail_price ??
      resource.hourly_rate ??
      resource.monthly_cost / (usageAmount * (usageScope === "aggregate" ? 1 : resource.quantity));
    let row = {
      serviceName: resource.service_name,
      productName: "Synthetic fixture product",
      skuName: resource.sku,
      armSkuName: resource.sku,
      armRegionName: resource.region,
      currencyCode: estimate.currency,
      type: "Consumption",
      meterId: `synthetic-${index}`,
      meterName: `Synthetic meter ${index}`,
      unitOfMeasure: unit,
      retailPrice: rate,
      tierMinimumUnits: 0,
      effectiveStartDate: "2020-01-01",
    };
    const query = {
      serviceName: resource.service_name,
      armSkuName: resource.sku,
      armRegionName: resource.region,
      currencyCode: estimate.currency,
      priceType: "Consumption",
    };
    const call_id = `synthetic-call-${index}`;
    const output = path.join(directory, "estimate.json");
    const response_path = path.join(directory, `response-${index}.json`);
    const key = digestObject(query);
    let captured;
    if (captures.has(key)) {
      const previous = captures.get(key);
      if (previous.row.unitOfMeasure !== unit || previous.row.retailPrice !== rate)
        throw new Error("Synthetic fixture has conflicting rates for one canonical query");
      ({ captured, row } = previous);
    } else {
      fs.writeFileSync(response_path, JSON.stringify({ status: 200, results: { prices: [row] } }));
      reserveQuery({ output, query, call_id, request_binding_path: binding.request_binding_path, cwd });
      updateAttempt(output, call_id, { state: "issued", issued_at: estimate.queried_at });
      captured = captureMcpResponse({ output, query, call_id, response_path, cwd });
      // Only newly generated synthetic records use the fixture clock; production capture never backdates.
      captured.captured_at = timestamp;
      fs.writeFileSync(path.resolve(cwd, captured.evidence_path), `${JSON.stringify(captured, null, 2)}\n`);
      withLedger(output, (ledger) => {
        ledger.attempts.find((attempt) => attempt.call_id === call_id).planned_at = timestamp;
      });
      estimate.evidence.push({ evidence_path: captured.evidence_path });
      captures.set(key, { captured, row });
      estimate.mcp_calls_used++;
    }
    const component = {
      evidence_ref: { evidence_path: captured.evidence_path, row_sha256: [digestObject(normalizeMeter(row))] },
      meter_id: row.meterId,
      product_name: row.productName,
      billing_region: row.armRegionName,
      unit_of_measure: unit,
      effective_start_date: row.effectiveStartDate,
      retail_price: rate,
      usage_amount: usageAmount,
      usage_scope: usageScope,
      unit_conversion: {
        usage_unit: usageUnit,
        native_unit: unit,
        units_per_native_unit: 1,
        reason: "Synthetic identity conversion",
      },
    };
    resource.calculation_basis = {
      name: resource.name,
      service_name: resource.service_name,
      sku: resource.sku,
      region: resource.region,
      quantity: resource.quantity,
      request_line_sha256: digestObject(input),
      components: [component],
    };
    for (const key of ["unit_of_measure", "retail_price", "hourly_rate", "usage_amount", "components"])
      delete resource[key];
    resource.monthly_cost = calculateLineCost(resource.calculation_basis);
  }
  estimate.monthly_total =
    Math.round(estimate.resources.reduce((sum, resource) => sum + resource.monthly_cost, 0) * 1e6) / 1e6;
  estimate.yearly_total = Math.round(estimate.monthly_total * 12 * 1e6) / 1e6;
  return estimate;
}
