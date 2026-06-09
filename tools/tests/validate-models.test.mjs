// Smoke test for the consolidated tools/scripts/validate-models.mjs.
//
// Guards the --only dispatcher (catalog | consistency | deprecated) and the
// merge of the three former model validators: each mode must exit 0 against
// the current repository, an unknown mode must exit 2, and the npm aliases
// must remain wired to the consolidated script.

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const script = path.join(repoRoot, "tools", "scripts", "validate-models.mjs");

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], { cwd: repoRoot, encoding: "utf8" });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

let pkg;
before(() => {
  pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
});

describe("validate-models dispatcher", () => {
  for (const mode of ["catalog", "consistency", "deprecated"]) {
    it(`--only=${mode} exits 0 against the current repo`, () => {
      const { code, stdout } = run([`--only=${mode}`]);
      assert.equal(code, 0, `mode ${mode} exited ${code}:\n${stdout}`);
    });
  }

  it("no flag runs all three and exits 0", () => {
    const { code } = run([]);
    assert.equal(code, 0);
  });

  it("an unknown --only value exits 2", () => {
    const { code } = run(["--only=bogus"]);
    assert.equal(code, 2);
  });
});

describe("validate-models npm aliases", () => {
  const expected = {
    "validate:model-catalog": "--only=catalog",
    "validate:model-consistency": "--only=consistency",
    "validate:deprecated-models": "--only=deprecated",
  };
  for (const [alias, flag] of Object.entries(expected)) {
    it(`${alias} points at validate-models.mjs ${flag}`, () => {
      const cmd = pkg.scripts[alias] ?? "";
      assert.match(cmd, /validate-models\.mjs/, `${alias} not repointed: ${cmd}`);
      assert.ok(cmd.includes(flag), `${alias} missing ${flag}: ${cmd}`);
    });
  }
});
