import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runModuleValidator } from "../scripts/validate-all.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "validate-all");

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
