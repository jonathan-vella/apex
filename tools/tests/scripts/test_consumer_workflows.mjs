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
const PRODUCT_REPOSITORIES = new Set([
  "jonathan-vella/apex",
  "jonathan-vella/apex-accelerator",
  "jonathan-vella/apex-docs",
]);
function context(value) {
  if (typeof value === "string") return new data.StringData(value);
  if (typeof value === "boolean") return new data.BooleanData(value);
  return new data.Dictionary(...Object.entries(value).map(([key, entry]) => ({ key, value: context(entry) })));
}

function validateInstalledWorkflow(template, installed) {
  const expected = yaml.load(template);
  const actual = yaml.load(installed);
  const normalized = structuredClone(actual);
  assert.deepEqual(Object.keys(actual.jobs), Object.keys(expected.jobs));
  for (const [name, job] of Object.entries(expected.jobs)) {
    const guard = actual.jobs[name].if;
    assert.equal(typeof guard, "string", `${name}: installed guard is required`);
    assert.ok(guard.startsWith(job.if), `${name}: canonical guard must remain unchanged`);
    const restriction = guard.slice(job.if.length);
    assert.match(
      restriction,
      /^(?: && github\.repository != '[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+')*$/,
      `${name}: only additional repository exclusions are supported`,
    );
    normalized.jobs[name].if = job.if;
  }
  assert.deepEqual(normalized, expected, "non-guard workflow content must match the template");
  return actual;
}

function assertGuardSafety(guard, file) {
  const expression = new Parser(new Lexer(guard).lex().tokens, ["github", "vars"], []).parse();
  const exclusions = new Set(
    [...guard.matchAll(/github\.repository != '([^']+)'/g)].map((match) => match[1].toLowerCase()),
  );
  const repositories = new Set([...PRODUCT_REPOSITORIES, "example/consumer", ...exclusions]);
  for (const repository of [...repositories, ...[...repositories].map((name) => name.toUpperCase())]) {
    const normalized = repository.toLowerCase();
    for (const enabled of ["", "false", "true"]) {
      for (const eventName of ["schedule", "workflow_dispatch", "pull_request"]) {
        for (const isTemplate of [false, true]) {
          const values = context({
            github: { repository, event_name: eventName, event: { repository: { is_template: isTemplate } } },
            vars: { GOVERNANCE_BASELINE_ENABLED: enabled },
          });
          const actual = new Evaluator(expression, values).evaluate().coerceString();
          const allowed =
            !PRODUCT_REPOSITORIES.has(normalized) &&
            !exclusions.has(normalized) &&
            !isTemplate &&
            (file !== "governance-policy-baseline.yml" || enabled === "true");
          assert.equal(actual, String(allowed), `${file}: ${repository}/${eventName}/${enabled}/${isTemplate}`);
        }
      }
    }
  }
}

test("guard safety accepts mixed-case exclusions and independently protects product repositories", () => {
  for (const file of CONSUMER_WORKFLOWS) {
    const template = fs.readFileSync(path.join(rootDirectory, ".github/consumer-workflows", file), "utf8");
    const workflow = yaml.load(template);
    for (const job of Object.values(workflow.jobs)) {
      for (const repository of ["Example/Consumer", "EXAMPLE/Disabled"]) {
        const installed = validateInstalledWorkflow(
          template,
          template.replaceAll(job.if, `${job.if} && github.repository != '${repository}'`),
        );
        for (const activeJob of Object.values(installed.jobs)) assertGuardSafety(activeJob.if, file);
      }
      for (const repository of PRODUCT_REPOSITORIES) {
        const weakened = job.if.replace(`github.repository != '${repository}' && `, "");
        assert.notEqual(weakened, job.if, `${file}: fixture must remove the protected repository`);
        assert.throws(() => assertGuardSafety(weakened, file), { name: "AssertionError" });
      }
    }
  }
});

test("installed templates allow only additive repository exclusions", () => {
  const template = `name: Fixture
on: workflow_dispatch
jobs:
  check:
    if: github.repository != 'example/product' && github.event.repository.is_template != true
    runs-on: ubuntu-latest
    steps: []
`;
  const guard = yaml.load(template).jobs.check.if;
  for (const suffix of [
    "",
    " && github.repository != 'example/disabled'",
    " && github.repository != 'example/a' && github.repository != 'example/b'",
  ]) {
    assert.ok(validateInstalledWorkflow(template, template.replace(guard, guard + suffix)));
  }
  for (const changed of [
    template.replace("example/product", "example/other"),
    template.replace(" && github.event.repository.is_template != true", ""),
    template.replace(guard, `${guard} || true`),
    template.replace(guard, `${guard} && vars.OPT_OUT != 'false'`),
    template.replace("steps: []", "steps: [{run: 'echo unexpected'}]"),
    template.replace(guard, `${guard} && github.repository != 'example/disabled' || true`),
  ]) {
    assert.throws(() => validateInstalledWorkflow(template, changed), { name: "AssertionError" });
  }
});

test("actual template guards block product/template operations and require governance opt-in", () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(rootDirectory, "package.json"), "utf8")).scripts;
  for (const file of CONSUMER_WORKFLOWS) {
    const active = path.join(rootDirectory, ".github/workflows", file);
    const template = fs.readFileSync(path.join(rootDirectory, ".github/consumer-workflows", file), "utf8");
    const workflows = [yaml.load(template)];
    if (!fs.existsSync(path.join(rootDirectory, ".github/workflows/weekly-upstream-sync.yml"))) {
      assert.equal(fs.existsSync(active), false);
    } else {
      workflows.push(validateInstalledWorkflow(template, fs.readFileSync(active, "utf8")));
    }
    for (const workflow of workflows) {
      for (const job of Object.values(workflow.jobs)) {
        assertGuardSafety(job.if, file);
        for (const step of job.steps) {
          for (const [, name] of (step.run ?? "").matchAll(/\bnpm run ([\w:-]+)/g)) assert.ok(scripts[name], name);
          if (step.uses?.startsWith("./")) assert.ok(fs.existsSync(path.join(rootDirectory, step.uses, "action.yml")));
        }
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
    const parsed = new URL(url);
    assert.equal(parsed.protocol, "https:");
    assert.equal(parsed.username, "");
    assert.equal(parsed.password, "");
    assert.equal(parsed.port, "");
    if (parsed.hostname === "api.github.com") {
      assert.equal(parsed.pathname, "/repos/jonathan-vella/apex/commits/main");
      return { ok: true, json: async () => ({ sha }) };
    }
    assert.equal(parsed.hostname, "raw.githubusercontent.com");
    const name = parsed.pathname.split("/").at(-1);
    assert.ok(CONSUMER_WORKFLOWS.includes(name));
    assert.equal(parsed.pathname, `/jonathan-vella/apex/${sha}/.github/consumer-workflows/${name}`);
    return {
      ok: name !== fail,
      status: 404,
      text: async () =>
        `name: ${name}\nversion: ${version}\non: workflow_dispatch\njobs:\n  test:\n    if: github.repository != 'jonathan-vella/apex'\n    steps: []\n`,
    };
  };
}

test("mock transport rejects deceptive hosts, paths and insecure URLs", async () => {
  const fetchImpl = remote();
  for (const url of [
    "https://api.github.com.example.com/repos/jonathan-vella/apex/commits/main",
    "https://example.com/api.github.com",
    "https://api.github.com@evil.example/repos/jonathan-vella/apex/commits/main",
    "http://api.github.com/repos/jonathan-vella/apex/commits/main",
    "https://api.github.com/repos/another/repo/commits/main",
    `https://raw.githubusercontent.com/another/repo/${sha}/.github/consumer-workflows/iac-checks.yml`,
  ]) {
    await assert.rejects(fetchImpl(url), { name: "AssertionError" });
  }
});

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
