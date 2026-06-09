// Integration smoke test for tools/scripts/validate-context-budget.mjs.
//
// The validator enforces the Per-Step File Re-Read Budget (HARD LIMIT):
// every agent that lists a frozen artifact as a prerequisite must also
// declare a cached-lookup escape hatch (`apex-recall show`) and a
// no-re-read marker. This test runs the validator against the live
// repository and asserts it exits 0 with the success summary — guarding
// both the script's health and its wiring into `validate:_node`.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const script = path.join(repoRoot, "tools", "scripts", "validate-context-budget.mjs");

describe("validate-context-budget", () => {
  it("passes against the current repository", () => {
    let output;
    let code = 0;
    try {
      output = execFileSync(process.execPath, [script], {
        cwd: repoRoot,
        encoding: "utf8",
      });
    } catch (err) {
      code = err.status ?? 1;
      output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    }
    assert.equal(code, 0, `validator exited ${code}:\n${output}`);
    assert.match(output, /Context budget: all agents declare/);
  });
});
