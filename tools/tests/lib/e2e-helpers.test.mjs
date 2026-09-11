// Unit tests for tools/scripts/_lib/e2e-helpers.mjs.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { detectIacTool, fileExists, scoreStructuralChecks } from "../../scripts/_lib/e2e-helpers.mjs";

describe("structural checks reuse the combined artifact validator", () => {
  it("keeps both public aliases equivalent and wires the tested scorer into the benchmark", () => {
    const scripts = JSON.parse(fs.readFileSync(new URL("../../../package.json", import.meta.url), "utf8")).scripts;
    assert.equal(scripts["lint:artifact-templates"], scripts["lint:h2-sync"]);
    const benchmark = fs.readFileSync(new URL("../../scripts/benchmark-e2e.mjs", import.meta.url), "utf8");
    const steps = fs.readFileSync(new URL("../../scripts/validate-e2e-step.mjs", import.meta.url), "utf8");
    assert.match(benchmark, /scoreStructuralChecks\(runCmd\)/);
    assert.doesNotMatch(benchmark, /production ready/);
    assert.doesNotMatch(steps, /npm run lint:h2-sync/);
    for (const step of [1, 2, 4]) assert.ok(steps.includes(`${step}: [ARTIFACT_VALIDATION_COMMAND]`));
  });
  for (const artifactPass of [true, false]) {
    for (const sessionPass of [true, false]) {
      it(`preserves weighted results for artifact=${artifactPass}, session=${sessionPass}`, () => {
        const calls = [];
        const result = scoreStructuralChecks((command) => {
          calls.push(command);
          return command.includes("validate:session-state") ? sessionPass : artifactPass;
        });
        assert.equal(calls.length, 2);
        assert.equal(calls.filter((command) => command.includes("lint:artifact-templates")).length, 1);
        assert.equal(result.score, (artifactPass ? 40 + 30 : 0) + (sessionPass ? 30 : 0));
        assert.deepEqual(result.checks, [
          `artifact-templates: ${artifactPass ? "PASS" : "FAIL"}`,
          `h2-sync: ${artifactPass ? "PASS" : "FAIL"}`,
          `session-state: ${sessionPass ? "PASS" : "FAIL"}`,
        ]);
      });
    }
  }
});

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "apex-e2e-"));
}

describe("_lib/e2e-helpers detectIacTool", () => {
  it("reads iac_tool from 00-session-state.json (lowercased)", () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, "00-session-state.json"), JSON.stringify({ iac_tool: "Terraform" }));
    assert.equal(detectIacTool(dir), "terraform");
  });

  it("falls back to decisions.iac_tool", () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, "00-session-state.json"), JSON.stringify({ decisions: { iac_tool: "BICEP" } }));
    assert.equal(detectIacTool(dir), "bicep");
  });

  it("defaults to 'bicep' when the state file is missing", () => {
    assert.equal(detectIacTool(tmpDir()), "bicep");
  });

  it("defaults to 'bicep' on invalid JSON", () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, "00-session-state.json"), "{not json");
    assert.equal(detectIacTool(dir), "bicep");
  });
});

describe("_lib/e2e-helpers fileExists", () => {
  it("returns true for a non-empty file", () => {
    const dir = tmpDir();
    const p = path.join(dir, "f.txt");
    fs.writeFileSync(p, "content");
    assert.equal(fileExists(p), true);
  });

  it("returns false for an empty file", () => {
    const dir = tmpDir();
    const p = path.join(dir, "empty.txt");
    fs.writeFileSync(p, "");
    assert.equal(fileExists(p), false);
  });

  it("returns false for a missing path", () => {
    assert.equal(fileExists(path.join(tmpDir(), "nope.txt")), false);
  });

  it("returns false for a directory path (file-only contract)", () => {
    assert.equal(fileExists(tmpDir()), false);
  });
});
