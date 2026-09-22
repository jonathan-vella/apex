import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import * as yaml from "js-yaml";
import { Lexer, Parser, Evaluator, data } from "@actions/expressions";
import { CONSUMER_WORKFLOWS, syncWorkflows } from "../../scripts/sync-workflows.mjs";

const sha = "a".repeat(40);
const rootDirectory = path.resolve(import.meta.dirname, "../../..");
function context(value) {
  if (typeof value === "string") return new data.StringData(value);
  if (typeof value === "boolean") return new data.BooleanData(value);
  return new data.Dictionary(...Object.entries(value).map(([key, entry]) => ({ key, value: context(entry) })));
}

test("actual template guards block product/template operations and require governance opt-in", () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(rootDirectory, "package.json"), "utf8")).scripts;
  for (const file of CONSUMER_WORKFLOWS) {
    const active = path.join(rootDirectory, ".github/workflows", file);
    if (!fs.existsSync(path.join(rootDirectory, ".github/workflows/weekly-upstream-sync.yml"))) {
      assert.equal(fs.existsSync(active), false);
    } else {
      assert.equal(
        fs.readFileSync(active, "utf8"),
        fs.readFileSync(path.join(rootDirectory, ".github/consumer-workflows", file), "utf8"),
      );
    }
    const workflow = yaml.load(fs.readFileSync(path.join(rootDirectory, ".github/consumer-workflows", file), "utf8"));
    for (const job of Object.values(workflow.jobs)) {
      const expression = new Parser(new Lexer(job.if).lex().tokens, ["github", "vars"], []).parse();
      for (const repository of [
        "jonathan-vella/apex",
        "jonathan-vella/apex-accelerator",
        "jonathan-vella/apex-docs",
        "example/consumer",
      ]) {
        for (const enabled of ["", "false", "true"]) {
          for (const eventName of ["schedule", "workflow_dispatch", "pull_request"]) {
            for (const isTemplate of [false, true]) {
              const values = context({
                github: { repository, event_name: eventName, event: { repository: { is_template: isTemplate } } },
                vars: { GOVERNANCE_BASELINE_ENABLED: enabled },
              });
              const actual = new Evaluator(expression, values).evaluate().coerceString();
              const allowed =
                repository === "example/consumer" &&
                !isTemplate &&
                (file !== "governance-policy-baseline.yml" || enabled === "true");
              assert.equal(actual, String(allowed), `${file}: ${repository}/${eventName}/${enabled}/${isTemplate}`);
            }
          }
        }
      }
      for (const step of job.steps) {
        for (const [, name] of (step.run ?? "").matchAll(/\bnpm run ([\w:-]+)/g)) assert.ok(scripts[name], name);
        if (step.uses?.startsWith("./")) assert.ok(fs.existsSync(path.join(rootDirectory, step.uses, "action.yml")));
      }
    }
  }
});
function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "consumer-workflows-"));
  return Promise.resolve()
    .then(() => run(root))
    .finally(() => fs.rmSync(root, { recursive: true, force: true }));
}
function remote(version = "one", fail = "") {
  return async (url) => {
    if (url.includes("api.github.com")) return { ok: true, json: async () => ({ sha }) };
    assert.ok(url.includes(`/${sha}/.github/consumer-workflows/`));
    const name = url.split("/").at(-1);
    assert.ok(CONSUMER_WORKFLOWS.includes(name));
    return {
      ok: name !== fail,
      status: 404,
      text: async () =>
        `name: ${name}\nversion: ${version}\non: workflow_dispatch\njobs:\n  test:\n    if: github.repository != 'jonathan-vella/apex'\n    steps: []\n`,
    };
  };
}

test("terminology validation ignores scratch checkouts but rejects active deprecated text", () =>
  fixture(async (root) => {
    fs.mkdirSync(path.join(root, ".github"));
    fs.writeFileSync(
      path.join(root, ".github/terminology-blocklist.json"),
      JSON.stringify({
        fileExtensions: [".md"],
        rules: [{ id: "fixture", pattern: "obsolete-fixture", severity: "error" }],
      }),
    );
    fs.mkdirSync(path.join(root, "tmp"));
    fs.writeFileSync(path.join(root, "tmp/old.md"), "obsolete-fixture");
    const run = () =>
      spawnSync(process.execPath, [path.join(rootDirectory, "tools/scripts/validate-terminology.mjs")], {
        cwd: root,
        encoding: "utf8",
      });
    assert.equal(run().status, 0);
    fs.writeFileSync(path.join(root, "active.md"), "obsolete-fixture");
    assert.notEqual(run().status, 0);
  }));

test("preview does not write; install and repeat are idempotent; updates bind a commit", () =>
  fixture(async (root) => {
    const options = { root, fetchImpl: remote() };
    assert.equal((await syncWorkflows(options)).changes.length, CONSUMER_WORKFLOWS.length);
    assert.deepEqual(fs.readdirSync(root), []);
    await syncWorkflows({ ...options, dryRun: false });
    assert.ok((await syncWorkflows(options)).changes.every(({ status }) => status === "unchanged"));
    const updated = await syncWorkflows({ root, fetchImpl: remote("two"), dryRun: false });
    assert.ok(updated.changes.every(({ status }) => status === "update"));
    assert.equal(updated.commit, sha);
  }));

test("customizations block the entire update and unmanaged files remain intact", () =>
  fixture(async (root) => {
    await syncWorkflows({ root, fetchImpl: remote(), dryRun: false });
    const directory = path.join(root, ".github/workflows");
    fs.writeFileSync(path.join(directory, CONSUMER_WORKFLOWS[0]), "local change");
    fs.writeFileSync(path.join(directory, "custom.yml"), "custom");
    const result = await syncWorkflows({ root, fetchImpl: remote("two"), dryRun: false });
    assert.equal(result.exitCode, 2);
    assert.match(fs.readFileSync(path.join(directory, CONSUMER_WORKFLOWS[1]), "utf8"), /version: one/);
    assert.equal(fs.readFileSync(path.join(directory, "custom.yml"), "utf8"), "custom");
  }));

test("failed downloads and malformed revisions leave no partial install", () =>
  fixture(async (root) => {
    await assert.rejects(
      syncWorkflows({ root, fetchImpl: remote("one", CONSUMER_WORKFLOWS.at(-1)), dryRun: false }),
      /Download failed/,
    );
    assert.deepEqual(fs.readdirSync(root), []);
    await assert.rejects(
      syncWorkflows({ root, fetchImpl: async () => ({ ok: true, json: async () => ({ sha: "main" }) }) }),
      /commit SHA/,
    );
  }));

test("retired files are reported without deletion and symlink destinations are rejected", () =>
  fixture(async (root) => {
    await syncWorkflows({ root, fetchImpl: remote(), dryRun: false });
    const statePath = path.join(root, ".github/consumer-workflows-state.json");
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    state.files["retired.yml"] = "old";
    fs.writeFileSync(statePath, JSON.stringify(state));
    const retired = path.join(root, ".github/workflows/retired.yml");
    fs.writeFileSync(retired, "preserve");
    assert.deepEqual((await syncWorkflows({ root, fetchImpl: remote(), dryRun: false })).retired, ["retired.yml"]);
    assert.equal(fs.readFileSync(retired, "utf8"), "preserve");
    fs.unlinkSync(path.join(root, ".github/workflows", CONSUMER_WORKFLOWS[0]));
    fs.symlinkSync(retired, path.join(root, ".github/workflows", CONSUMER_WORKFLOWS[0]));
    await assert.rejects(syncWorkflows({ root, fetchImpl: remote(), dryRun: false }), /symlink/);
  }));
