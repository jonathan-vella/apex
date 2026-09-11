import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

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

test("the CLI rejects unknown aggregate members before running any validator", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "apex-aggregate-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const suite of ["run-p first missing", "run-p --continue-on-error first missing && echo done"]) {
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { suite, first: "echo VALIDATOR_RAN" } }));
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../scripts/validate-all.mjs", import.meta.url)), "--suite=suite"],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Task not found.*missing/);
    assert.doesNotMatch(result.stdout, /VALIDATOR_RAN|Validation summary/);
  }
});

test("the CLI preserves native runner options, task arguments, shell suffixes and failures", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "apex-native-aggregate-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const run = (first) => {
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        scripts: {
          suite: 'run-p --max-parallel 2 "first -- alpha" second && echo SUFFIX_RAN',
          first,
          second: "echo SECOND_RAN",
        },
      }),
    );
    return spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../scripts/validate-all.mjs", import.meta.url)), "--suite=suite"],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fileURLToPath(new URL("../../node_modules/.bin", import.meta.url))}:${process.env.PATH}`,
        },
      },
    );
  };
  const passed = run("node -e \"console.log(process.argv.slice(1).join(','))\"");
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /alpha/);
  assert.match(passed.stdout, /SECOND_RAN/);
  assert.match(passed.stdout, /^SUFFIX_RAN$/m);
  const failed = run('node -e "process.exit(5)"');
  assert.equal(failed.status, 1, failed.stderr);
  assert.match(failed.stdout, /0 passed, 1 failed/);
  assert.doesNotMatch(failed.stdout, /^SUFFIX_RAN$/m);
});

test("the CLI executes native descriptor redirections and preserves failures", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "apex-descriptor-aggregate-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const exitCode of [0, 5]) {
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        scripts: {
          suite: "run-p first 2>/dev/null",
          first: `node -e "console.log('DESCRIPTOR_RAN'); console.error('HIDDEN_STDERR'); process.exit(${exitCode})"`,
        },
      }),
    );
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../scripts/validate-all.mjs", import.meta.url)), "--suite=suite"],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fileURLToPath(new URL("../../node_modules/.bin", import.meta.url))}:${process.env.PATH}`,
        },
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, exitCode === 0 ? 0 : 1, result.stderr);
    assert.match(result.stdout, /^DESCRIPTOR_RAN$/m);
    assert.match(result.stdout, exitCode === 0 ? /1 passed, 0 failed/ : /0 passed, 1 failed/);
    assert.doesNotMatch(result.stderr, /HIDDEN_STDERR/);
  }
});

test("the CLI matches native overlapping and repeated task execution", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "apex-pattern-aggregate-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [patterns, expected] of [
    ["check:* check:one", ["ONE_RAN", "TWO_RAN"]],
    ["check:one check:one", ["ONE_RAN", "ONE_RAN"]],
    ["check:* check:*", ["ONE_RAN", "ONE_RAN", "TWO_RAN", "TWO_RAN"]],
  ]) {
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        scripts: { suite: `run-p ${patterns}`, "check:one": "echo ONE_RAN", "check:two": "echo TWO_RAN" },
      }),
    );
    const options = {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fileURLToPath(new URL("../../node_modules/.bin", import.meta.url))}:${process.env.PATH}`,
      },
    };
    const native = spawnSync("npm", ["run", "suite"], options);
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../scripts/validate-all.mjs", import.meta.url)), "--suite=suite"],
      options,
    );
    assert.equal(native.error, undefined);
    assert.equal(result.error, undefined);
    assert.equal(native.status, 0, native.stderr);
    assert.equal(result.status, 0, result.stderr);
    const executions = (stdout) => (stdout.match(/^(?:ONE|TWO)_RAN$/gm) ?? []).sort();
    assert.deepEqual(executions(native.stdout), expected, patterns);
    assert.deepEqual(executions(result.stdout), executions(native.stdout), patterns);
    assert.match(result.stdout, new RegExp(`${expected.length} passed, 0 failed`));
  }
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
