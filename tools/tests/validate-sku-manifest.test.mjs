// SKU Manifest validator fixture test.
//
// Runs tools/scripts/validate-sku-manifest.mjs against the fixtures under
// tests/azure-artifacts/sku-manifest/{valid,invalid}/ and asserts the
// expected pass/fail behaviour. The validator runs in hard-fail mode:
// valid fixtures must exit 0 with no error lines, invalid fixtures must
// exit non-zero with at least one ❌ error line.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VALIDATOR = path.join(ROOT, "tools/scripts/validate-sku-manifest.mjs");
const FIXTURE_BASE = path.join(ROOT, "tests/azure-artifacts/sku-manifest");

function runValidator(fixturePath) {
  const result = spawnSync("node", [VALIDATOR, fixturePath], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  return {
    stdout: (result.stdout ?? "") + (result.stderr ?? ""),
    exitCode: result.status ?? 0,
  };
}

function listFixtures(subdir) {
  const dir = path.join(FIXTURE_BASE, subdir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f));
}

describe("SKU Manifest validator — valid fixtures", () => {
  for (const fixture of listFixtures("valid")) {
    const name = path.basename(fixture);
    it(`accepts ${name}`, () => {
      const { stdout, exitCode } = runValidator(fixture);
      assert.equal(exitCode, 0, `validator exit=${exitCode} for ${name}:\n${stdout}`);
      const errLines = stdout.split("\n").filter((l) => l.includes("❌"));
      assert.equal(errLines.length, 0, `unexpected errors:\n${errLines.join("\n")}`);
    });
  }
});

describe("SKU Manifest validator — invalid fixtures", () => {
  for (const fixture of listFixtures("invalid")) {
    const name = path.basename(fixture);
    it(`rejects ${name} with non-zero exit`, () => {
      const { stdout, exitCode } = runValidator(fixture);
      assert.notEqual(exitCode, 0, `expected non-zero exit for ${name}, got 0:\n${stdout}`);
      const errLines = stdout.split("\n").filter((l) => l.includes("❌"));
      assert.ok(errLines.length > 0, `expected ❌ error lines for ${name}, got:\n${stdout}`);
    });
  }
});
