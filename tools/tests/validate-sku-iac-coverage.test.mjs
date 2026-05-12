// SKU ↔ IaC Coverage validator integration test.
//
// Builds two temporary projects:
//   - one where the AVM module receives an explicit SKU param that
//     matches the manifest entry (covers explicit-literal path);
//   - one where the AVM module omits the SKU param and the validator
//     must fall back to the module's default SKU from the AVM defaults
//     lookup library (covers AVM-default-resolution path).
//
// Each project gets its own agent-output/{project}/ + infra/bicep/{project}/
// tree under tools/tests/_tmp_sku_coverage/, with a wrapper script that
// re-runs the coverage validator pointed at the temporary root.
// Cleans up after itself.

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VALIDATOR = path.join(ROOT, "tools/scripts/validate-sku-iac-coverage.mjs");

const TMP = path.join(ROOT, "_tmp_sku_coverage_test");
const PROJECT_OK = "_test-coverage-explicit";
const PROJECT_AVM = "_test-coverage-avm-default";
const PROJECT_GAP = "_test-coverage-gap";

const MANIFEST_BASE = {
  schema_version: "sku-manifest-v1",
  default_region: "swedencentral",
  created_at: "2026-05-12T09:00:00Z",
  updated_at: "2026-05-12T09:00:00Z",
  current_revision: 1,
  environments: ["prod"],
  revisions: [
    {
      rev: 1,
      created_at: "2026-05-12T09:00:00Z",
      agent: "03-Architect",
      step: "2",
      summary: "test fixture",
      changed_ids: ["app"],
    },
  ],
};

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function writeJson(filePath, obj) {
  writeText(filePath, `${JSON.stringify(obj, null, 2)}\n`);
}

function setupProject(name, manifest, bicep) {
  // The validator uses a hard-coded ROOT — we work around by writing
  // into actual agent-output/ and infra/bicep/ but with a name that's
  // very unlikely to collide. Cleanup is guaranteed via after().
  const manifestPath = path.join(ROOT, "agent-output", name, "sku-manifest.json");
  const bicepPath = path.join(ROOT, "infra/bicep", name, "main.bicep");
  writeJson(manifestPath, { ...manifest, project: name });
  writeText(bicepPath, bicep);
}

function teardownProject(name) {
  fs.rmSync(path.join(ROOT, "agent-output", name), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, "infra/bicep", name), { recursive: true, force: true });
}

function runValidator(project) {
  const result = spawnSync("node", [VALIDATOR, "--project", project], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  return {
    stdout: (result.stdout ?? "") + (result.stderr ?? ""),
    exitCode: result.status ?? 0,
  };
}

const SERVICE_APP_P1V3 = {
  id: "app",
  service: "App Service Plan",
  size: "P1v3",
  iac_logical_names: { bicep: "appServicePlan", terraform: "module.app" },
  capacity: { mode: "fixed", default: 1 },
  zonal: true,
  regions: ["swedencentral"],
  sla_target: "99.95%",
  commitment: { type: "on-demand" },
  source: "architect-derived",
  source_step: "2",
  last_modified_rev: 1,
};

describe("SKU ↔ IaC Coverage validator", () => {
  after(() => {
    teardownProject(PROJECT_OK);
    teardownProject(PROJECT_AVM);
    teardownProject(PROJECT_GAP);
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("passes when AVM module receives an explicit SKU that matches the manifest", () => {
    setupProject(
      PROJECT_OK,
      { ...MANIFEST_BASE, services: [SERVICE_APP_P1V3] },
      [
        "module appServicePlan 'br/public:avm/res/web/serverfarm:0.4.1' = {",
        "  name: 'plan-prod'",
        "  params: {",
        "    skuName: 'P1v3'",
        "    name: 'plan-prod'",
        "  }",
        "}",
      ].join("\n"),
    );
    const { stdout, exitCode } = runValidator(PROJECT_OK);
    assert.equal(exitCode, 0, `expected exit 0, got ${exitCode}:\n${stdout}`);
    assert.ok(!stdout.includes("❌"), `unexpected error output:\n${stdout}`);
  });

  it("resolves the AVM default SKU when the module omits the param", () => {
    // Manifest size is P1v3 — the AVM default for avm/res/web/serverfarm
    // is also P1v3, so coverage should pass.
    setupProject(
      PROJECT_AVM,
      { ...MANIFEST_BASE, services: [SERVICE_APP_P1V3] },
      [
        "module appServicePlan 'br/public:avm/res/web/serverfarm:0.4.1' = {",
        "  name: 'plan-prod'",
        "  params: {",
        "    name: 'plan-prod'",
        "  }",
        "}",
      ].join("\n"),
    );
    const { stdout, exitCode } = runValidator(PROJECT_AVM);
    assert.equal(exitCode, 0, `expected exit 0 (AVM default P1v3 matches manifest), got ${exitCode}:\n${stdout}`);
  });

  it("flags an unknown SKU literal", () => {
    setupProject(
      PROJECT_GAP,
      { ...MANIFEST_BASE, services: [SERVICE_APP_P1V3] },
      [
        "resource extra 'Microsoft.Web/serverfarms@2024-04-01' = {",
        "  name: 'plan-extra'",
        "  location: 'swedencentral'",
        "  sku: {",
        "    name: 'P3v3'",
        "    capacity: 1",
        "  }",
        "}",
      ].join("\n"),
    );
    const { stdout, exitCode } = runValidator(PROJECT_GAP);
    assert.notEqual(exitCode, 0, `expected non-zero exit, got 0:\n${stdout}`);
    assert.ok(/P3v3/.test(stdout), `expected P3v3 mention, got:\n${stdout}`);
  });
});
