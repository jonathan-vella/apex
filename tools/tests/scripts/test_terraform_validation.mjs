import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const command = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")).scripts[
  "validate:terraform"
];

function fixture(context, projects) {
  const root = mkdtempSync(path.join(tmpdir(), "apex terraform-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, "bin");
  mkdirSync(bin);
  const calls = path.join(root, "calls.log");
  writeFileSync(calls, "");
  writeFileSync(
    path.join(bin, "terraform"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const project = path.basename(process.cwd());
const command = process.argv[2];
fs.appendFileSync(process.env.APEX_TEST_CALLS, project + ":" + command + "\\n");
if (project === command + "-fail") process.exit(1);
`,
    { mode: 0o755 },
  );
  for (const project of projects) {
    const directory = path.join(root, "infra/terraform", project);
    mkdirSync(directory, { recursive: true });
    if (project !== "not-a-project") writeFileSync(path.join(directory, "main.tf"), "");
  }
  return { root, bin, calls };
}

for (const failingPhase of ["init", "validate"]) {
  test(`Terraform ${failingPhase} failure survives a later successful project`, (context) => {
    const { root, bin, calls } = fixture(context, [`${failingPhase}-fail`, "z healthy project", "not-a-project"]);
    const result = spawnSync("sh", ["-c", command], {
      cwd: root,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, APEX_TEST_CALLS: calls },
      encoding: "utf8",
    });
    assert.equal(result.status, 1, result.stderr);
    const log = readFileSync(calls, "utf8");
    assert.match(log, /z healthy project:validate/);
    assert.doesNotMatch(log, /not-a-project/);
    if (failingPhase === "init") assert.doesNotMatch(log, /init-fail:validate/);
  });
}

test("Terraform validation succeeds with healthy projects or no projects", (context) => {
  for (const projects of [[], ["healthy", "not-a-project"]]) {
    const { root, bin, calls } = fixture(context, projects);
    const result = spawnSync("sh", ["-c", command], {
      cwd: root,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, APEX_TEST_CALLS: calls },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(calls, "utf8"), projects.length ? "healthy:init\nhealthy:validate\n" : "");
  }
});
