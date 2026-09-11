import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const { scripts } = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));

test("prompt registry validates paths, explicit models and inherited models", (context) => {
  const root = fixture(context);
  mkdirSync(path.join(root, "tools/registry"), { recursive: true });
  mkdirSync(path.join(root, ".github/prompts"), { recursive: true });
  writeFileSync(path.join(root, ".github/prompts/resume.prompt.md"), '---\nagent: "01-Orchestrator"\n---\n# Resume\n');
  writeFileSync(
    path.join(root, ".github/prompts/explicit.prompt.md"),
    '---\nagent: agent\nmodel: "Example Model"\n---\n# Task\n',
  );
  const script = fileURLToPath(new URL("../../scripts/validate-agent-registry.mjs", import.meta.url));
  const runRegistry = (entry) => {
    writeFileSync(
      path.join(root, "tools/registry/agent-registry.json"),
      JSON.stringify({ agents: {}, subagents: {}, prompts: { example: entry } }),
    );
    return spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" }).status;
  };
  const inherited = { prompt: ".github/prompts/resume.prompt.md", model: null, invokable: true };
  assert.equal(runRegistry(inherited), 0);
  assert.equal(
    runRegistry({ prompt: ".github/prompts/explicit.prompt.md", model: "Example Model", invokable: true }),
    0,
  );
  assert.equal(runRegistry({ ...inherited, prompt: ".github/prompts/missing.prompt.md" }), 1);
  assert.equal(runRegistry({ ...inherited, model: "Wrong" }), 1);
  assert.equal(runRegistry({ ...inherited, invokable: "yes" }), 1);
});

test("root workflow diagram uses declared participants and current artifact names", () => {
  const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");
  const diagram = readme.split("```mermaid")[1].split("```")[0];
  const participants = new Set([...diagram.matchAll(/participant (\w+) as/g)].map((match) => match[1]));
  for (const match of diagram.matchAll(/^\s*(\w+)(?:-->>|->>)(\w+):/gm)) {
    assert.ok(participants.has(match[1]), match[1]);
    assert.ok(participants.has(match[2]), match[2]);
  }
  assert.doesNotMatch(diagram, /02-assessment.md|03-cost-estimate.md|04-plan.md|challenge-findings.json/);
  assert.ok(diagram.indexOf("challenge-findings-cost-estimate.json") < diagram.indexOf("Approve architecture"));
  assert.match(diagram, /C->>G: Discover policy constraints/);
  const quality = readFileSync(new URL("../../../QUALITY_SCORE.md", import.meta.url), "utf8");
  assert.match(quality, /historical, not a current validation result/);
  assert.doesNotMatch(quality.split("## Change Log")[0], /\d+ primary|\d+ subagents|\d+ skills|\d+ instructions/);
});

test("version sync fails on missing or malformed required version evidence", (context) => {
  const root = fixture(context);
  const script = fileURLToPath(new URL("../../scripts/validate-version-sync.mjs", import.meta.url));
  const valid = {
    "VERSION.md": "**Current Version:** 1.2.3\n",
    "package.json": '{"version":"1.2.3"}',
    "CHANGELOG.md": "## [1.2.3]\n",
  };
  const check = (overrides = {}) => {
    for (const [name, content] of Object.entries({ ...valid, ...overrides })) {
      const target = path.join(root, name);
      if (content === null) rmSync(target, { force: true });
      else writeFileSync(target, content);
    }
    return spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" }).status;
  };
  assert.equal(check(), 0);
  for (const name of Object.keys(valid)) {
    assert.notEqual(check({ [name]: null }), 0);
    assert.notEqual(check({ [name]: "" }), 0);
  }
  assert.notEqual(check({ "VERSION.md": "**Current Version:** unknown\nhttps://semver.org/spec/v2.0.0.html" }), 0);
  assert.notEqual(check({ "package.json": "{}" }), 0);
  assert.notEqual(check({ "CHANGELOG.md": "# Changelog" }), 0);
  assert.notEqual(check({ "package.json": '{"version":"1.2.4"}' }), 0);
});

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "apex-lint-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "bin"));
  return root;
}

function stub(root, name) {
  writeFileSync(
    path.join(root, "bin", name),
    `#!${process.execPath}\nconsole.log(JSON.stringify(process.argv.slice(2))); console.error("lint diagnostic"); process.exit(Number(process.env.LINT_EXIT || 0));\n`,
    { mode: 0o755 },
  );
}

function run(root, script, env = {}) {
  const command =
    script === "lint:links"
      ? `"${process.execPath}" "${fileURLToPath(new URL("../../scripts/check-repository-links.mjs", import.meta.url))}"`
      : scripts[script];
  return spawnSync("/bin/sh", ["-c", command], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: `${root}/bin:${process.env.PATH}`, ...env },
  });
}

for (const [script, binary] of [
  ["lint:prose", "vale"],
  ["lint:yaml", "yamllint"],
]) {
  test(`${script} distinguishes clean, failing and missing executables`, (context) => {
    const root = fixture(context);
    writeFileSync(path.join(root, "example.yaml"), "key: value\n");
    stub(root, binary);
    assert.equal(run(root, script).status, 0);
    const failed = run(root, script, { LINT_EXIT: "3" });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /lint diagnostic/);
    assert.doesNotMatch(failed.stderr, /not installed/);
    const missing = run(root, script, { PATH: "/nonexistent" });
    assert.equal(missing.status, 127);
    assert.match(missing.stderr, /not installed/);
  });
}

test("YAML selection prunes dependencies and scratch without hiding source files", (context) => {
  const root = fixture(context);
  stub(root, "yamllint");
  for (const file of [
    ".github/workflows/check.yml",
    "a space.yaml",
    "site/node_modules/pkg/a.yml",
    ".venv/a.yml",
    "tmp/a.yml",
  ]) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), "key: value\n");
  }
  const result = run(root, "lint:yaml");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /check.yml/);
  assert.match(result.stdout, /a space.yaml/);
  assert.doesNotMatch(result.stdout, /node_modules|\.venv|tmp\/a/);
});

test("link selection includes tracked and active untracked files but not ignored residue", (context) => {
  const root = fixture(context);
  assert.equal(spawnSync("git", ["init", "-q", root]).status, 0);
  stub(root, "markdown-link-check");
  writeFileSync(path.join(root, ".gitignore"), ".venv/\ntmp/\n");
  for (const file of [
    "README.md",
    "new guide.md",
    ".venv/README.md",
    "tmp/run.md",
    ".archive/old.md",
    "infra/demo.md",
  ]) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), "# Example\n");
  }
  assert.equal(spawnSync("git", ["add", "README.md"], { cwd: root }).status, 0);
  const result = run(root, "lint:links");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /README.md/);
  assert.match(result.stdout, /new guide.md/);
  assert.doesNotMatch(result.stdout, /\.venv|tmp\/run|\.archive|infra\/demo/);
  assert.notEqual(run(root, "lint:links", { LINT_EXIT: "3" }).status, 0);
});

test("empty link selection does not invoke the checker", (context) => {
  const root = fixture(context);
  assert.equal(spawnSync("git", ["init", "-q", root]).status, 0);
  stub(root, "markdown-link-check");
  const result = run(root, "lint:links");
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("link selection fails closed outside Git and when Git fails", (context) => {
  const root = fixture(context);
  stub(root, "markdown-link-check");
  const outside = run(root, "lint:links");
  assert.notEqual(outside.status, 0);
  assert.match(outside.stderr, /not a git repository/);
  assert.equal(outside.stdout, "");
  stub(root, "git");
  const failed = run(root, "lint:links", { LINT_EXIT: "3" });
  assert.equal(failed.status, 3);
  assert.match(failed.stderr, /lint diagnostic/);
  assert.equal(failed.stdout, "");
  assert.equal(scripts["lint:links"], "node tools/scripts/check-repository-links.mjs");
});
