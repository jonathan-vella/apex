import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { mutableInputProblem } from "../../scripts/validate-challenger-findings.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const script = path.join(repo, "tools/scripts/validate-challenger-findings.mjs");

test("mutable parent-owned files are rejected as review inputs", () => {
  for (const name of [
    "sku-manifest.json",
    "sku-manifest.md",
    "00-handoff.md",
    "00-session-state.json",
    "README.md",
    "challenge-findings-plan-decisions.json",
  ]) {
    assert.match(mutableInputProblem(`agent-output/p/${name}`), /mutable parent-owned file/, name);
  }
  assert.equal(mutableInputProblem("agent-output/p/04-iac-contract.json"), null);
  assert.equal(mutableInputProblem("agent-output/p/04-governance-constraints.json"), null);
});

test("metadata generation refuses a mutable supporting input with a remediation message", () => {
  const result = spawnSync(
    process.execPath,
    [script, "--metadata", "package.json", "--supporting-input", "agent-output/p/sku-manifest.json"],
    { cwd: repo, encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /Remove it from supporting inputs/);
});
