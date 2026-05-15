// Integration test for tools/scripts/derive-sku-allowlist.mjs.
//
// Builds a temporary agent-output/{project}/ tree containing a
// minimal sku-manifest.json + 04-governance-constraints.json, invokes
// the derive script, and asserts the resulting sku_allowlist_snapshot
// matches expectations. Cleans up after itself.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = path.join(ROOT, "tools/scripts/derive-sku-allowlist.mjs");
const PROJECT = "_test-derive-sku-allowlist";
const PROJECT_DIR = path.join(ROOT, "agent-output", PROJECT);

const BASE_MANIFEST = {
  $schema: "../../tools/schemas/sku-manifest.schema.json",
  schema_version: "sku-manifest-v1",
  project: PROJECT,
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
  services: [
    {
      id: "app",
      service: "App Service Plan",
      size: "P1v3",
      iac_logical_names: { bicep: "app", terraform: "module.app" },
      capacity: { mode: "fixed", default: 1 },
      zonal: true,
      regions: ["swedencentral"],
      sla_target: "99.95%",
      commitment: { type: "on-demand" },
      source: "architect-derived",
      source_step: "2",
      last_modified_rev: 1,
    },
  ],
};

const GOVERNANCE_WITH_ALLOWLIST = {
  schema_version: "governance-constraints-v1",
  subscription_id: "00000000-0000-0000-0000-000000000000",
  discovered_at: "2026-05-12T09:00:00Z",
  findings: [
    {
      policy_id: "allowed-app-service-skus",
      display_name: "Allowed App Service Plan SKUs",
      effect: "deny",
      azurePropertyPath: "properties.sku.name",
      resource_types: ["Microsoft.Web/serverFarms"],
      required_value: ["P1v3", "P2v3", "P3v3"],
    },
  ],
};

const GOVERNANCE_NO_SKU = {
  schema_version: "governance-constraints-v1",
  subscription_id: "00000000-0000-0000-0000-000000000000",
  discovered_at: "2026-05-12T09:00:00Z",
  findings: [
    {
      policy_id: "require-https",
      display_name: "Require HTTPS",
      effect: "deny",
      azurePropertyPath: "properties.httpsOnly",
      resource_types: ["Microsoft.Web/sites"],
      required_value: true,
    },
  ],
};

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(obj, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function runDerive() {
  return execFileSync("node", [SCRIPT, PROJECT], { cwd: ROOT, encoding: "utf-8" });
}

describe("derive-sku-allowlist.mjs", () => {
  before(() => {
    fs.mkdirSync(PROJECT_DIR, { recursive: true });
  });
  after(() => {
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
  });

  it("projects an allowed_skus snapshot from a deny+azurePropertyPath finding", () => {
    writeJson(path.join(PROJECT_DIR, "sku-manifest.json"), BASE_MANIFEST);
    writeJson(path.join(PROJECT_DIR, "04-governance-constraints.json"), GOVERNANCE_WITH_ALLOWLIST);
    runDerive();
    const patched = readJson(path.join(PROJECT_DIR, "sku-manifest.json"));
    assert.ok(patched.sku_allowlist_snapshot, "expected sku_allowlist_snapshot to be set");
    assert.equal(patched.sku_allowlist_snapshot.source, "04-governance-constraints.json");
    assert.deepEqual(patched.sku_allowlist_snapshot.allowed_skus["App Service Plan"], ["P1v3", "P2v3", "P3v3"]);
  });

  it("is idempotent on repeat runs", () => {
    runDerive();
    const first = readJson(path.join(PROJECT_DIR, "sku-manifest.json"));
    runDerive();
    const second = readJson(path.join(PROJECT_DIR, "sku-manifest.json"));
    assert.deepEqual(first.sku_allowlist_snapshot, second.sku_allowlist_snapshot);
  });

  it("clears the snapshot when governance has no SKU-restriction policies", () => {
    // Pre-populate the manifest with a snapshot from the previous test.
    writeJson(path.join(PROJECT_DIR, "04-governance-constraints.json"), GOVERNANCE_NO_SKU);
    runDerive();
    const patched = readJson(path.join(PROJECT_DIR, "sku-manifest.json"));
    assert.equal(patched.sku_allowlist_snapshot, undefined, "expected snapshot to be cleared");
  });
});
