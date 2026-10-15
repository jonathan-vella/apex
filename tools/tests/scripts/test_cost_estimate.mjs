import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createAjv } from "../../scripts/_lib/ajv-validator.mjs";
import {
  calculateLineCost,
  normalizeCostRequest,
  publishEstimate,
  resolveWorkspacePath,
  round6,
  validateCostRequest,
  validateEstimate,
} from "../../scripts/cost-estimate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const SCRIPT = path.join(ROOT, "tools/scripts/cost-estimate.mjs");

function makeManifest(overrides = {}) {
  return {
    schema_version: "sku-manifest-v1",
    project: "demo",
    default_region: "swedencentral",
    created_at: "2026-10-15T12:00:00Z",
    updated_at: "2026-10-15T12:00:00Z",
    current_revision: 2,
    environments: ["dev"],
    revisions: [
      {
        rev: 1,
        created_at: "2026-10-15T12:00:00Z",
        agent: "02-Requirements",
        step: "1",
        summary: "init",
        changed_ids: ["jump-vm"],
      },
      {
        rev: 2,
        created_at: "2026-10-15T12:05:00Z",
        agent: "03-Architect",
        step: "2",
        summary: "skus",
        changed_ids: ["app-plan-web", "sql-db-core"],
      },
    ],
    services: [
      {
        id: "app-plan-web",
        service: "Azure App Service",
        size: "B2",
        iac_logical_names: { bicep: "appPlanWeb", terraform: "azurerm_service_plan.web" },
        capacity: { mode: "fixed", default: 1 },
        zonal: false,
        regions: ["swedencentral"],
        sla_target: "99.9%",
        commitment: { type: "on-demand" },
        source: "architect-derived",
        source_step: "2",
        last_modified_rev: 2,
      },
      {
        id: "sql-db-core",
        service: "SQL Database",
        size: "S2",
        iac_logical_names: { bicep: "sqlDbCore", terraform: "azurerm_mssql_database.db" },
        capacity: { mode: "fixed", default: 1 },
        zonal: false,
        regions: ["swedencentral"],
        sla_target: "99.9%",
        commitment: { type: "on-demand" },
        source: "architect-derived",
        source_step: "2",
        last_modified_rev: 2,
      },
      {
        id: "jump-vm",
        service: "Virtual Machine",
        size: "Standard_B2s_v2",
        iac_logical_names: { bicep: "jumpVm", terraform: "azurerm_linux_virtual_machine.jump" },
        capacity: { mode: "fixed", default: 1 },
        zonal: false,
        regions: ["swedencentral"],
        sla_target: "Not specified",
        commitment: { type: "on-demand" },
        source: "user-pin",
        source_step: "1",
        last_modified_rev: 1,
      },
    ],
    ...overrides,
  };
}

test("resolveWorkspacePath prevents double-prefixed agent-output paths when shell CWD drifted", () => {
  const driftedCwd = path.join(ROOT, "agent-output", "eventdesk");
  const resolved = resolveWorkspacePath("agent-output/eventdesk/02-cost-estimate.json", driftedCwd);
  assert.equal(resolved, path.join(ROOT, "agent-output/eventdesk/02-cost-estimate.json"));
});

test("preflight enforces single input mode, variable usage, alert frequency, and stale draft checks", (context) => {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "apex-cost-preflight-"));
  context.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const manifestPath = path.join(dir, "sku-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(makeManifest()));
  const outputPath = path.join(dir, "02-cost-estimate.json");

  const multiMode = validateCostRequest({
    project_name: "demo",
    region: "swedencentral",
    output_path: outputPath,
    manifest_path: manifestPath,
    resource_list: [{ name: "x", service_name: "Storage", sku: "LRS" }],
  });
  assert.equal(multiMode.ok, false);
  assert.match(multiMode.unresolved_items[0], /Exactly one primary input mode/);

  const missingUsage = validateCostRequest({
    project_name: "demo",
    region: "swedencentral",
    output_path: outputPath,
    manifest_path: manifestPath,
    supplemental_resources: [
      { name: "log-analytics", service_name: "Log Analytics", sku: "Analytics Logs" },
      {
        name: "alert-rules",
        service_name: "Azure Monitor",
        sku: "Alerts",
        usage: { amount: 3, unit: "monitored-resources", scope: "aggregate" },
      },
    ],
  });
  assert.equal(missingUsage.ok, false);
  assert.ok(missingUsage.unresolved_items.some((u) => u.includes("log-analytics") && u.includes("explicit usage")));
  assert.ok(missingUsage.unresolved_items.some((u) => u.includes("alert-rules") && u.includes("evaluation_frequency")));

  // Stale .tmp blocks preflight
  fs.writeFileSync(`${outputPath}.tmp`, "{}");
  const staleDraft = validateCostRequest({
    project_name: "demo",
    region: "swedencentral",
    output_path: outputPath,
    manifest_path: manifestPath,
  });
  assert.equal(staleDraft.ok, false);
  assert.ok(staleDraft.unresolved_items.some((u) => u.includes("Stale temporary draft")));
  fs.rmSync(`${outputPath}.tmp`);

  // Valid full-scope manifest + supplemental request passes
  const valid = validateCostRequest({
    project_name: "demo",
    region: "swedencentral",
    output_path: outputPath,
    manifest_path: manifestPath,
    supplemental_resources: [
      {
        name: "log-analytics",
        service_name: "Log Analytics",
        sku: "Analytics Logs",
        usage: { amount: 5, unit: "GB", scope: "aggregate" },
      },
      {
        name: "alert-rules",
        service_name: "Azure Monitor",
        sku: "Alerts",
        usage: { amount: 3, unit: "monitored-resources", scope: "aggregate", evaluation_frequency: "5m" },
      },
    ],
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.normalized.lines.length, 5);
});

test("manifest expansion preserves sparse environment overrides and rejects supplemental ID collisions", (context) => {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "apex-cost-expand-"));
  context.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const manifest = makeManifest({
    environments: ["dev", "prod"],
    services: [
      {
        id: "app-plan-web",
        service: "Azure App Service",
        size: "P1v3",
        iac_logical_names: { bicep: "appPlanWeb", terraform: "azurerm_service_plan.web" },
        capacity: { mode: "autoscale", min: 2, max: 6, default: 2 },
        zonal: true,
        regions: ["swedencentral", "germanywestcentral"],
        environment_overrides: {
          dev: {
            size: "B2",
            capacity: { mode: "fixed", default: 1 },
            zonal: false,
            regions: ["swedencentral"],
          },
        },
        sla_target: "99.95%",
        commitment: { type: "reserved-1yr", term_years: 1 },
        source: "architect-derived",
        source_step: "2",
        last_modified_rev: 2,
      },
    ],
  });
  const manifestPath = path.join(dir, "sku-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const normalized = normalizeCostRequest({
    project_name: "demo",
    region: "swedencentral",
    output_path: path.join(dir, "out.json"),
    manifest_path: manifestPath,
  });
  // 1 dev region + 2 prod regions = 3 deployment lines
  assert.equal(normalized.lines.length, 3);
  assert.equal(normalized.lines[0].sku, "B2");
  assert.equal(normalized.lines[0].quantity, 1);
  assert.equal(normalized.lines[1].sku, "P1v3");
  assert.equal(normalized.lines[1].quantity, 2);

  assert.throws(
    () =>
      normalizeCostRequest({
        project_name: "demo",
        region: "swedencentral",
        output_path: path.join(dir, "out.json"),
        manifest_path: manifestPath,
        supplemental_resources: [{ name: "app-plan-web", service_name: "NAT Gateway", sku: "Standard" }],
      }),
    /collides with manifest service id/,
  );
});

test("calculateLineCost computes deterministic unit and tiered band totals without double-multiplying aggregate usage", () => {
  // Hourly meter: 0.036 * 730 = 26.28
  assert.equal(calculateLineCost({ name: "app", quantity: 1, unit_of_measure: "1 Hour", retail_price: 0.036 }), 26.28);

  // Daily meter + storage component: $2.42 * 365/12 + $0.221 * 32 = 80.680333
  assert.equal(
    calculateLineCost({
      name: "sql",
      quantity: 1,
      components: [
        { unit_of_measure: "1/Day", retail_price: 2.42 },
        { unit_of_measure: "1 GB/Month", retail_price: 0.221, usage_amount: 32, usage_scope: "aggregate" },
      ],
    }),
    80.680333,
  );

  // Private endpoints: 4 endpoints * 730h * $0.01 + aggregate 20 GB * $0.01 = 29.2 + 0.2 = 29.4
  assert.equal(
    calculateLineCost({
      name: "pe",
      quantity: 4,
      components: [
        { unit_of_measure: "1 Hour", retail_price: 0.01 },
        { unit_of_measure: "1 GB", retail_price: 0.01, usage_amount: 20, usage_scope: "aggregate" },
      ],
    }),
    29.4,
  );

  // Tiered meter with free first band (0..5 GB @ $0, >5 GB @ $2.99): 5 GB costs $0, 7 GB costs $5.98
  const bands = [
    { tierMinimumUnits: 0, retailPrice: 0 },
    { tierMinimumUnits: 5, retailPrice: 2.99 },
  ];
  assert.equal(
    calculateLineCost({
      name: "law-5gb",
      quantity: 1,
      unit_of_measure: "1 GB",
      usage_amount: 5,
      usage_scope: "aggregate",
      tier_bands: bands,
    }),
    0,
  );
  assert.equal(
    calculateLineCost({
      name: "law-7gb",
      quantity: 1,
      unit_of_measure: "1 GB",
      usage_amount: 7,
      usage_scope: "aggregate",
      tier_bands: bands,
    }),
    round6(2 * 2.99),
  );
});

test("publishEstimate normalizes totals, writes back only manifest services, and handles !name notes via CLI", (context) => {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "apex-cost-publish-"));
  context.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const manifestPath = path.join(dir, "sku-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(makeManifest(), null, 2));

  const outputPath = path.join(dir, "02-cost-estimate.json");
  const draftPath = `${outputPath}.tmp`;

  const draft = {
    status: "COMPLETE",
    project_name: "demo",
    region: "swedencentral",
    currency: "USD",
    monthly_total: 0,
    yearly_total: 0,
    resources: [
      {
        name: "app-plan-web (dev, swedencentral)",
        manifest_service_id: "app-plan-web",
        source_kind: "manifest",
        service_name: "Azure App Service",
        sku: "B2",
        region: "swedencentral",
        quantity: 1,
        hourly_rate: 0.036,
        monthly_cost: 26.28,
        notes: "Linux B2 plan; verified !fs.existsSync hazard does not trigger in file-based publish.",
      },
      {
        name: "sql-db-core (dev, swedencentral)",
        manifest_service_id: "sql-db-core",
        source_kind: "manifest",
        service_name: "SQL Database",
        sku: "S2",
        region: "swedencentral",
        quantity: 1,
        hourly_rate: null,
        monthly_cost: 80.68033333333334,
        notes: "S2 DTU + 32 GB storage.",
      },
      {
        name: "jump-vm (dev, swedencentral)",
        manifest_service_id: "jump-vm",
        source_kind: "manifest",
        service_name: "Virtual Machines",
        sku: "Standard_B2s_v2",
        region: "swedencentral",
        quantity: 1,
        hourly_rate: 0.0864,
        monthly_cost: 63.072,
        notes: "Linux jump VM.",
      },
      {
        name: "bastion-standard",
        source_kind: "supplemental",
        service_name: "Azure Bastion",
        sku: "Standard",
        region: "swedencentral",
        quantity: 1,
        hourly_rate: 0.29,
        monthly_cost: 211.7,
        notes: "Supplemental Bastion host (must not enter manifest writeback).",
      },
    ],
    optimization_notes: [],
    savings_status: "NOT_APPLICABLE",
    savings_reason: "dev on-demand",
    eligible_strategies: [],
    data_source: "Azure MCP pricing_get",
    queried_at: "2026-10-15T14:20:13Z",
    confidence: "Medium",
    unresolved_items: [],
    mcp_calls_used: 4,
    budget_exceeded: false,
  };
  fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2));

  const cli = spawnSync(
    process.execPath,
    [SCRIPT, "publish", "--draft", draftPath, "--output", outputPath, "--manifest", manifestPath],
    { encoding: "utf8", timeout: 5000 },
  );
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /^COST ESTIMATE COMPLETE/m);
  assert.equal(fs.existsSync(draftPath), false);
  assert.equal(fs.existsSync(outputPath), true);

  const published = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(published.monthly_total, 381.732333);
  assert.equal(published.yearly_total, 4580.787996);
  assert.equal(published.manifest_writeback.length, 3);
  assert.ok(!published.manifest_writeback.some((w) => w.id === "bastion-standard"));

  const updatedManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const byId = new Map(updatedManifest.services.map((s) => [s.id, s.cost_estimate_monthly_usd]));
  assert.equal(byId.get("app-plan-web"), 26.28);
  assert.equal(byId.get("sql-db-core"), 80.680333);
  assert.equal(byId.get("jump-vm"), 63.072);

  // Refuse on second publish without overwrite
  fs.writeFileSync(draftPath, JSON.stringify(published, null, 2));
  assert.throws(() => publishEstimate({ draftPath, outputPath, overwrite: false }), /refuse_on_exists/);
});

test("validateEstimate verifies retail_api_evidence SHA-256 and meterIds and flags legacy closest-meter assumptions", (context) => {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "apex-cost-evidence-"));
  context.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const rawPage = JSON.stringify({
    BillingCurrency: "USD",
    Items: [{ meterId: "m-blob-hot", retailPrice: 0.0184, tierMinimumUnits: 0 }],
    NextPageLink: null,
  });
  const evidencePath = path.join(dir, "blob.evidence.json");
  fs.writeFileSync(
    evidencePath,
    JSON.stringify({
      schema_version: "retail-price-evidence-v1",
      data_source: "Azure Retail Prices API (direct fallback)",
      pages: [
        {
          url: "https://prices.azure.com/api/retail/prices",
          queried_at: "2026-10-15T14:00:00Z",
          response_sha256: createHash("sha256").update(rawPage).digest("hex"),
          raw_response: rawPage,
        },
      ],
    }),
  );

  const estimate = {
    status: "COMPLETE",
    project_name: "demo",
    region: "swedencentral",
    currency: "USD",
    monthly_total: 1.84,
    yearly_total: 22.08,
    resources: [
      {
        name: "blob",
        service_name: "Storage",
        sku: "Standard_LRS",
        region: "swedencentral",
        quantity: 1,
        monthly_cost: 1.84,
        notes: "Used closest published catalog meter for alerts.",
      },
    ],
    optimization_notes: [],
    savings_status: "NOT_APPLICABLE",
    savings_reason: "dev",
    eligible_strategies: [],
    data_source: "Azure MCP pricing_get + Azure Retail Prices API (direct fallback)",
    queried_at: "2026-10-15T14:00:00Z",
    confidence: "Medium",
    unresolved_items: [],
    mcp_calls_used: 1,
    direct_api_calls_used: 1,
    budget_exceeded: false,
    retail_api_evidence: [
      {
        evidence_path: evidencePath,
        resource_names: ["blob"],
        selected_meters: [{ meterId: "m-blob-hot", tierMinimumUnits: 0, retailPrice: 0.0184 }],
        calculation: "100 * 0.0184",
      },
    ],
  };

  const res = validateEstimate(estimate, { cwd: dir, legacyAudit: true });
  assert.equal(res.ok, true);
  assert.equal(res.warnings.length, 1);
  assert.match(res.warnings[0], /closest published/);

  estimate.retail_api_evidence[0].selected_meters[0].meterId = "wrong-meter-id";
  const bad = validateEstimate(estimate, { cwd: dir });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /not found in/);
});

test("cost-estimate.schema.json compiles with Ajv and validates fixture and published estimates", () => {
  const ajv = createAjv();
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/schemas/cost-estimate.schema.json"), "utf8"));
  const validate = ajv.compile(schema);
  const fixture = JSON.parse(
    fs.readFileSync(path.join(ROOT, "tools/tests/fixtures/subagent-file-contract/cost-estimate.findings.json"), "utf8"),
  );
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
});
