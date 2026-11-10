import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAjv } from "../../scripts/_lib/ajv-validator.mjs";
import { reserveQuery } from "../../scripts/_lib/pricing-evidence.mjs";
import { validateEstimate } from "../../scripts/cost-estimate.mjs";
import { evidenceBackedFixture, fixtureRequestOptions } from "./test_cost_estimate_fixture.mjs";

test("rate quote schema is distinct from monthly estimates and prohibits fabricated totals", () => {
  const load = (name) =>
    JSON.parse(fs.readFileSync(new URL(`../../schemas/${name}.schema.json`, import.meta.url), "utf8"));
  const ajv = createAjv();
  const validate = ajv.compile(load("retail-rate-quote"));
  const monthly = ajv.compile(load("cost-estimate"));
  const quote = {
    schema_version: "retail-rate-quote-v1",
    purpose: "rate-quote",
    status: "COMPLETE",
    project_name: "synthetic",
    region: "swedencentral",
    currency: "USD",
    queried_at: new Date().toISOString(),
    data_source: "Azure MCP pricing_get",
    mcp_calls_used: 1,
    direct_api_calls_used: 0,
    unresolved_items: [],
    request_snapshot: { purpose: "rate-quote" },
    request_sha256: "a".repeat(64),
    evidence: [{ evidence_path: "synthetic-evidence.json" }],
    resources: [
      {
        name: "synthetic",
        service_name: "Synthetic fixture",
        sku: "Fixture",
        region: "swedencentral",
        quantity: 1,
        components: [{ unit_of_measure: "1 GB", retail_price: 1 }],
      },
    ],
  };
  assert.equal(validate(quote), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...quote, unknown_request_reservations: 1 }), true);
  assert.equal(validate({ ...quote, unknown_request_reservations: -1 }), false);
  assert.equal(validate({ ...quote, unknown_request_reservations: 21 }), false);
  assert.equal(monthly(quote), false);
  for (const field of ["monthly_total", "yearly_total", "manifest_writeback"]) {
    assert.equal(validate({ ...quote, [field]: field === "manifest_writeback" ? [] : 0 }), false);
  }
  const charged = structuredClone(quote);
  charged.resources[0].monthly_cost = 0;
  assert.equal(validate(charged), false);
  assert.equal(validate({ ...quote, evidence: [] }), false);
  assert.equal(validate({ ...quote, status: "FAILED" }), false);
  assert.equal(validate({ ...quote, status: "FAILED", unresolved_items: ["Synthetic missing input"] }), true);
});

test("an interrupted monthly reservation agrees with both runtime and canonical schema accounting", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pricing-schema-reservation-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const estimate = evidenceBackedFixture(
    {
      status: "COMPLETE",
      project_name: "synthetic",
      region: "swedencentral",
      currency: "USD",
      resources: [
        {
          name: "synthetic",
          service_name: "Azure App Service",
          sku: "B1",
          region: "swedencentral",
          quantity: 1,
          monthly_cost: 1,
          notes: "Synthetic accounting fixture, not a quoted Azure rate.",
        },
      ],
      optimization_notes: [],
      savings_status: "NOT_APPLICABLE",
      savings_reason: "Synthetic fixture",
      eligible_strategies: [],
      data_source: "Azure MCP pricing_get",
      confidence: "High",
      unresolved_items: [],
      budget_exceeded: false,
    },
    directory,
  );
  reserveQuery({
    output: path.join(directory, "estimate.json"),
    query: { serviceName: "Azure App Service", armSkuName: "B2", currencyCode: "USD", priceType: "Consumption" },
    call_id: "interrupted-unissued-query",
    cwd: directory,
  });
  estimate.unknown_request_reservations = 1;
  const checked = validateEstimate(estimate, fixtureRequestOptions(estimate, { cwd: directory }));
  assert.equal(checked.ok, true, checked.errors.join("; "));
  const schema = JSON.parse(
    fs.readFileSync(new URL("../../schemas/cost-estimate.schema.json", import.meta.url), "utf8"),
  );
  const validate = createAjv().compile(schema);
  assert.equal(validate(estimate), true, JSON.stringify(validate.errors));
});
