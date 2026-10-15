import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const validator = path.join(repo, "tools/scripts/validate-policy-property-map.mjs");

function check(context, policy) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "policy-status-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "04-policy-property-map.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      schema_version: "policy-property-map-v1",
      project: "synthetic",
      generated_at: "2026-10-15T00:00:00Z",
      governance_depth: "light",
      policies: [
        {
          policy_id: "block-vm-sku",
          display_name: "Block VM SKU sizes",
          effect: "Deny",
          target_property: { resource_type: "Microsoft.Compute/virtualMachines", property_path: "properties.size" },
          evidence_required: "inline parameter",
          ...policy,
        },
      ],
    }),
  );
  const result = spawnSync(process.execPath, [validator, file], { cwd: repo, encoding: "utf8" });
  return { status: result.status, text: result.stdout + result.stderr };
}

test("a not-applicable policy row needs a reason", (context) => {
  const missing = check(context, { status: "not-applicable" });
  assert.notEqual(missing.status, 0);
  assert.match(missing.text, /no not_applicable_reason/);
  const reasoned = check(context, { status: "not-applicable", not_applicable_reason: "No VM in the plan" });
  assert.equal(reasoned.status, 0, reasoned.text);
});

test("a reason is only valid on a not-applicable row", (context) => {
  const result = check(context, { status: "satisfied", not_applicable_reason: "stale text" });
  assert.notEqual(result.status, 0);
  assert.match(result.text, /status is not not-applicable/);
});

test("an unsatisfiable policy row fails and routes to governance", (context) => {
  const result = check(context, { status: "unsatisfiable" });
  assert.notEqual(result.status, 0);
  assert.match(result.text, /Refresh Governance/);
});

test("a row without a status keeps the earlier behaviour", (context) => {
  const result = check(context, {});
  assert.equal(result.status, 0, result.text);
});
