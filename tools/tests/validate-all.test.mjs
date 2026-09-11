import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { runModuleValidator } from "../scripts/validate-all.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "validate-all");

test("the CLI fails instead of reporting success for an unknown suite", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../scripts/validate-all.mjs", import.meta.url)), "--suite=__missing_suite__"],
    { encoding: "utf8", cwd: fileURLToPath(new URL("../../", import.meta.url)) },
  );
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown or empty npm script: __missing_suite__/);
  assert.doesNotMatch(result.stdout, /0 passed, 0 failed/);
});

function task(name) {
  return {
    name,
    type: "module",
    modulePath: path.join(FIXTURES, `${name}.mjs`),
    args: [],
    env: {},
  };
}

test("module validators preserve exit codes without terminating the runner", async () => {
  const originalExit = process.exit;
  const pass = await runModuleValidator(task("pass"), 1);
  const fail = await runModuleValidator(task("fail"), 2);
  const asyncPass = await runModuleValidator(task("async-pass"), 3);

  assert.equal(pass.exitCode, 0);
  assert.equal(fail.exitCode, 3);
  assert.equal(asyncPass.exitCode, 0);
  assert.strictEqual(process.exit, originalExit);
});
