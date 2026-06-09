// Unit tests for tools/scripts/_lib/e2e-helpers.mjs.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { detectIacTool, fileExists } from "../../scripts/_lib/e2e-helpers.mjs";

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
