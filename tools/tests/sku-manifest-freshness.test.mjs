// Freshness check unit test for validate-sku-manifest.mjs.
//
// Builds a temporary agent-output/{project}/ tree where:
//   - cost_estimated_at is 100 days old (>30 default PRICING_TTL_DAYS)
//   - updated_at is 120 days old (>90 default MANIFEST_TTL_DAYS)
// and asserts the validator emits the expected freshness warnings
// without erroring. Cleans up after itself.

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VALIDATOR = path.join(ROOT, "tools/scripts/validate-sku-manifest.mjs");
const PROJECT = "_test-sku-freshness";
const PROJECT_DIR = path.join(ROOT, "agent-output", PROJECT);
const MANIFEST_PATH = path.join(PROJECT_DIR, "sku-manifest.json");

function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function writeManifest(obj) {
  fs.mkdirSync(PROJECT_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(obj, null, 2)}\n`);
}

function runValidator() {
  const result = spawnSync("node", [VALIDATOR, MANIFEST_PATH], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  return {
    stdout: (result.stdout ?? "") + (result.stderr ?? ""),
    exitCode: result.status ?? 0,
  };
}

describe("validate-sku-manifest.mjs freshness checks", () => {
  after(() => fs.rmSync(PROJECT_DIR, { recursive: true, force: true }));

  it("warns when cost_estimated_at exceeds PRICING_TTL_DAYS", () => {
    writeManifest({
      schema_version: "sku-manifest-v1",
      project: PROJECT,
      default_region: "swedencentral",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: new Date().toISOString(),
      current_revision: 1,
      environments: ["prod"],
      revisions: [
        {
          rev: 1,
          created_at: "2026-01-01T00:00:00Z",
          agent: "03-Architect",
          step: "2",
          summary: "fixture",
          changed_ids: ["app"],
        },
      ],
      services: [
        {
          id: "app",
          service: "App Service Plan",
          size: "P1v3",
          iac_logical_names: { bicep: "p", terraform: "module.p" },
          capacity: { mode: "fixed", default: 1 },
          zonal: true,
          regions: ["swedencentral"],
          sla_target: "99.95%",
          commitment: { type: "on-demand" },
          source: "architect-derived",
          source_step: "2",
          last_modified_rev: 1,
          cost_estimate_monthly_usd: 142.5,
          cost_estimated_at: isoDaysAgo(100),
        },
      ],
    });
    const { stdout, exitCode } = runValidator();
    assert.equal(exitCode, 0, `expected exit 0 (warn only), got ${exitCode}:\n${stdout}`);
    assert.ok(/cost_estimated_at is .* days old/.test(stdout), `expected pricing-freshness warning, got:\n${stdout}`);
  });

  it("warns when manifest updated_at exceeds MANIFEST_TTL_DAYS", () => {
    writeManifest({
      schema_version: "sku-manifest-v1",
      project: PROJECT,
      default_region: "swedencentral",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: isoDaysAgo(120),
      current_revision: 1,
      environments: ["prod"],
      revisions: [
        {
          rev: 1,
          created_at: "2026-01-01T00:00:00Z",
          agent: "03-Architect",
          step: "2",
          summary: "fixture",
          changed_ids: [],
        },
      ],
      services: [],
    });
    const { stdout, exitCode } = runValidator();
    assert.equal(exitCode, 0, `expected exit 0, got ${exitCode}:\n${stdout}`);
    assert.ok(
      /Manifest updated_at is .* days old/.test(stdout),
      `expected manifest staleness warning, got:\n${stdout}`,
    );
  });
});
