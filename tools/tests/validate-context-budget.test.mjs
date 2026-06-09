// Integration smoke test for tools/scripts/validate-context-budget.mjs.
//
// The validator enforces the Per-Step File Re-Read Budget (HARD LIMIT):
// every agent that lists a frozen artifact as a prerequisite must also
// declare a cached-lookup escape hatch (`apex-recall show`) and a
// no-re-read marker.
//
// This test guards two things:
//   1. The `validate:context-budget` alias exists and is wired into the
//      `validate:_node` aggregate (npm script wiring).
//   2. The validator itself exits 0 with the expected success message
//      against the current repository state.

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const script = path.join(repoRoot, "tools", "scripts", "validate-context-budget.mjs");

let pkg;
before(() => {
  pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
});

describe("validate-context-budget wiring", () => {
  it("package.json has a validate:context-budget alias", () => {
    assert.ok(
      Object.prototype.hasOwnProperty.call(pkg.scripts, "validate:context-budget"),
      "missing validate:context-budget script in package.json",
    );
  });

  it("validate:_node includes validate:context-budget", () => {
    assert.match(
      pkg.scripts["validate:_node"] ?? "",
      /\bvalidate:context-budget\b/,
      "validate:_node does not include validate:context-budget",
    );
  });
});

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
