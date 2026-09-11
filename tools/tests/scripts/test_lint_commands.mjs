import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { load, dump } from "js-yaml";

const { scripts } = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));

test("docs CI retains event coverage, status jobs and same-run build provenance", () => {
  const workflow = (name) =>
    load(readFileSync(new URL(`../../../.github/workflows/${name}.yml`, import.meta.url), "utf8"));
  const ci = workflow("ci");
  const checks = workflow("docs-checks");
  const pages = workflow("docs");
  assert.equal(ci.jobs.ci.name, "ci");
  assert.deepEqual(ci.on.pull_request.branches, ["main"]);
  assert.ok(ci.on.push.branches.includes("main"));
  assert.ok(ci.jobs.ci.steps.some((step) => step.run === "npm run lint:md" && !step.if));
  assert.deepEqual(checks.on.pull_request.paths, ["site/**", ".github/workflows/docs-checks.yml"]);
  assert.deepEqual(checks.on.push, { branches: ["main"], paths: ["site/**"] });
  const steps = checks.jobs["link-check-and-build"].steps;
  assert.equal(
    steps.find((step) => step.run === "npm run lint:md").if,
    "github.event_name == 'pull_request' && github.base_ref != 'main'",
  );
  for (const command of [
    "node tools/scripts/lint-docs-frontmatter.mjs",
    "npm run build",
    "node site/check-links.mjs",
  ]) {
    assert.ok(
      steps.some((step) => step.run === command && !step.if),
      command,
    );
  }
  assert.deepEqual(pages.on.push, {
    branches: ["main"],
    paths: ["site/src/**", "site/public/**", "site/astro.config.mjs", "site/package.json", "site/package-lock.json"],
  });
  assert.ok(Object.hasOwn(pages.on, "workflow_dispatch"));
  const build = pages.jobs.build.steps;
  assert.ok(build.some((step) => step.uses?.startsWith("actions/checkout@") && !step.with?.ref));
  const buildIndex = build.findIndex((step) => step.run === "npm run build" && step["working-directory"] === "site");
  const uploadIndex = build.findIndex((step) => step.uses?.startsWith("actions/upload-pages-artifact@"));
  assert.ok(buildIndex >= 0 && uploadIndex > buildIndex);
  assert.equal(build[uploadIndex].with.path, "site/dist");
  assert.equal(pages.jobs.deploy.needs, "build");
  assert.ok(pages.jobs.deploy.steps.some((step) => step.uses?.startsWith("actions/deploy-pages@")));
  assert.ok(!build.some((step) => step.uses?.startsWith("actions/download-artifact@")));
});

test("lefthook selects artifact, template and H2 source paths through the combined glob", (context) => {
  const root = fixture(context);
  assert.equal(spawnSync("git", ["init", "-q", root]).status, 0);
  const hooks = load(readFileSync(new URL("../../../lefthook.yml", import.meta.url), "utf8"));
  const hook = hooks["pre-commit"].commands["artifact-validation"];
  writeFileSync(
    path.join(root, "lefthook.yml"),
    dump({
      "pre-commit": { commands: { "artifact-validation": { ...hook, run: "echo HOOK_SELECTED" } } },
    }),
  );
  const lefthook = fileURLToPath(new URL("../../../node_modules/.bin/lefthook", import.meta.url));
  for (const [file, selected] of [
    ["agent-output/example/01-requirements.md", true],
    [".github/skills/apex-azure-artifacts/templates/01-requirements.template.md", true],
    [".github/skills/apex-azure-artifacts/templates/nested/example.md", true],
    [".github/skills/apex-azure-artifacts/SKILL.md", true],
    [".github/instructions/azure-artifacts.instructions.md", true],
    ["tools/scripts/validate-artifacts.mjs", true],
    ["README.md", false],
    [".github/skills/apex-azure-artifacts/references/example.md", false],
  ]) {
    const result = spawnSync(
      lefthook,
      ["run", "pre-commit", "--no-auto-install", "--no-tty", "--colors", "off", "--file", file],
      {
        cwd: root,
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.includes("HOOK_SELECTED"), selected, `${file}: ${result.stdout}`);
  }
});

test("artifact hook validates template-only and output changes and propagates gate failures", (context) => {
  const root = fixture(context);
  const hooks = load(readFileSync(new URL("../../../lefthook.yml", import.meta.url), "utf8"));
  assert.equal(hooks["pre-commit"].commands["h2-sync"], undefined);
  const command = hooks["pre-commit"].commands["artifact-validation"].run;
  writeFileSync(
    path.join(root, "bin/git"),
    `#!${process.execPath}\nconsole.log(process.env.STAGED_FILES); process.exit(Number(process.env.GIT_EXIT || 0));\n`,
    {
      mode: 0o755,
    },
  );
  writeFileSync(
    path.join(root, "bin/npm"),
    `#!${process.execPath}\nconsole.log("CALL " + process.argv[3]); process.exit(process.argv[3] === process.env.FAIL_SCRIPT ? 1 : 0);\n`,
    { mode: 0o755 },
  );
  const check = (files, failure = "", gitExit = "0") =>
    spawnSync("/bin/sh", ["-c", command], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${root}/bin:${process.env.PATH}`,
        STAGED_FILES: files,
        FAIL_SCRIPT: failure,
        GIT_EXIT: gitExit,
      },
    });
  for (const files of [
    ".github/skills/apex-azure-artifacts/templates/01-requirements.template.md",
    "agent-output/example/01-requirements.md",
    ".github/skills/apex-azure-artifacts/templates/01-requirements.template.md\nagent-output/example/01-requirements.md",
    ".github/skills/apex-azure-artifacts/SKILL.md\nagent-output/example/01-requirements.md",
  ]) {
    const result = check(files);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.match(/CALL .+/g), ["CALL validate:artifacts", "CALL validate:challenger-presence"]);
    for (const failure of ["validate:artifacts", "validate:challenger-presence"]) {
      assert.notEqual(check(files, failure).status, 0, failure);
    }
  }
  for (const source of [
    ".github/skills/apex-azure-artifacts/SKILL.md",
    ".github/instructions/azure-artifacts.instructions.md",
    "tools/scripts/validate-artifacts.mjs",
  ]) {
    const result = check(source);
    assert.equal(result.status, 0);
    assert.deepEqual(result.stdout.match(/CALL .+/g), ["CALL validate:artifacts"]);
    assert.notEqual(check(source, "validate:artifacts").status, 0);
  }
  assert.notEqual(check("", "", "1").status, 0);
  for (const files of ["", "README.md", ".github/skills/apex-azure-artifacts/references/example.md"]) {
    const result = check(files);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /CALL /);
  }
});

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
