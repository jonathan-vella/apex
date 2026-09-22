import assert from "node:assert/strict";
import { cpSync, symlinkSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { load, dump } from "js-yaml";
import { parseJsonc } from "../../scripts/_lib/parse-jsonc.mjs";
import { artifactTrigger } from "../../scripts/check-publication-scope.mjs";

const { scripts } = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));

test("npm lockfiles retain portable registry URLs rather than environment-specific feed addresses", () => {
  for (const file of ["package-lock.json"]) {
    const lock = JSON.parse(readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8"));
    for (const [name, entry] of Object.entries(lock.packages)) {
      if (!entry.resolved?.startsWith("https://")) continue;
      assert.equal(new URL(entry.resolved).origin, "https://registry.npmjs.org", `${file}: ${name}`);
      assert.ok(entry.integrity, `${file}: ${name} must retain integrity evidence`);
    }
  }
});

test("devcontainer remote features match locked versions", () => {
  const config = parseJsonc(readFileSync(new URL("../../../.devcontainer/devcontainer.json", import.meta.url), "utf8"));
  const lock = JSON.parse(
    readFileSync(new URL("../../../.devcontainer/devcontainer-lock.json", import.meta.url), "utf8"),
  );
  for (const feature of Object.keys(config.features).filter((key) => key.startsWith("ghcr.io/"))) {
    const tag = feature.split(":").at(-1);
    assert.ok(tag, `Empty feature tag: ${feature}`);
    assert.ok(lock.features[feature], `Missing locked feature: ${feature}`);
    if (/^\d+$/.test(tag)) assert.equal(lock.features[feature].version.split(".")[0], tag);
  }
});

test("extension guard rejects Azure Copilot and bundling extensions", (context) => {
  const root = fixture(context);
  mkdirSync(path.join(root, "tools/scripts"), { recursive: true });
  mkdirSync(path.join(root, ".devcontainer"));
  cpSync(new URL("../../scripts/_lib", import.meta.url), path.join(root, "tools/scripts/_lib"), { recursive: true });
  cpSync(
    new URL("../../scripts/validate-extension-bloat.mjs", import.meta.url),
    path.join(root, "tools/scripts/validate-extension-bloat.mjs"),
  );
  symlinkSync(fileURLToPath(new URL("../../../node_modules", import.meta.url)), path.join(root, "node_modules"), "dir");
  const exclusions = parseJsonc(
    readFileSync(new URL("../../../.devcontainer/devcontainer.json", import.meta.url), "utf8"),
  ).customizations.vscode.extensions.filter((entry) => entry.startsWith("-"));
  const check = (extension) => {
    writeFileSync(
      path.join(root, ".devcontainer/devcontainer.json"),
      JSON.stringify({ customizations: { vscode: { extensions: [...exclusions, extension] } } }),
    );
    return spawnSync(process.execPath, [path.join(root, "tools/scripts/validate-extension-bloat.mjs")], {
      encoding: "utf8",
    });
  };
  for (const extension of [
    "ms-azuretools.vscode-azure-github-copilot",
    "ms-azuretools.vscode-azure-mcp-server",
    "ms-vscode.vscode-node-azure-pack",
    "ms-windows-ai-studio.windows-ai-studio",
  ]) {
    const result = check(extension.toUpperCase());
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Bloat extension declared/);
  }
  for (const extension of ["GitHub.copilot-chat", "ms-azuretools.vscode-bicep", "ms-python.vscode-pylance"]) {
    const result = check(extension);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
});

test("product CI retains coverage while migrated docs automation stays retired", () => {
  const workflow = (name) =>
    load(readFileSync(new URL(`../../../.github/workflows/${name}.yml`, import.meta.url), "utf8"));
  const ci = workflow("ci");
  assert.equal(ci.jobs.ci.name, "ci");
  assert.deepEqual(ci.on.pull_request.branches, ["main"]);
  assert.ok(ci.on.push.branches.includes("main"));
  assert.ok(ci.jobs.ci.steps.some((step) => step.run === "npm run lint:md" && !step.if));
  for (const name of ["docs", "docs-checks", "docs-gardening", "link-check", "sensei-branch-maintenance"]) {
    assert.equal(existsSync(new URL(`../../../.github/workflows/${name}.yml`, import.meta.url)), false);
  }
  assert.equal(existsSync(new URL("../../../site/package.json", import.meta.url)), false);
  for (const name of [
    "docs:dev",
    "docs:build",
    "docs:preview",
    "lint:site-links",
    "lint:docs-frontmatter",
    "lint:links:docs",
  ]) {
    assert.equal(scripts[name], undefined);
  }
});

test("Python CI installs diagram dependencies and renderer before running tooling tests", () => {
  const workflow = load(readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8"));
  const steps = workflow.jobs["external-tests"].steps;
  const testIndex = steps.findIndex((step) => step.run === "npm run test:python-tools");
  const dependencies = steps.findIndex((step) => step.run?.includes("python -m pip install -r requirements.txt"));
  const renderer = steps.findIndex((step) => step.run?.includes("apt-get install -y graphviz"));
  assert.ok(dependencies >= 0 && dependencies < testIndex);
  assert.ok(renderer >= 0 && renderer < testIndex);
  const requirements = readFileSync(new URL("../../../requirements.txt", import.meta.url), "utf8");
  for (const name of ["diagrams", "matplotlib", "pillow", "pytest", "ruff"]) {
    assert.match(requirements, new RegExp(`^${name}==`, "m"));
  }
});

test("Node CI provides a native Terraform CLI before executable validator tests", () => {
  const workflow = load(readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8"));
  const steps = workflow.jobs.ci.steps;
  const setup = steps.findIndex((step) => step.uses === "hashicorp/setup-terraform@v4");
  const tests = steps.findIndex((step) => step.run === "npm run validate:_node-ci");
  assert.ok(setup >= 0 && setup < tests);
  assert.equal(steps[setup].with.terraform_wrapper, false);
  assert.match(steps[setup].with.terraform_version, /^\d+\.\d+\.\d+$/);
});

test("lefthook always invokes the index selector, which covers artifact and template changes", (context) => {
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
    [".github/skills/apex-azure-artifacts/references/example.md", true],
    ["tools/scripts/_lib/artifact-headings.mjs", true],
    ["agent-output/example/challenge-findings-plan.json", true],
    ["lefthook.yml", true],
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
    assert.equal(result.stdout.includes("HOOK_SELECTED"), true, `${file}: ${result.stdout}`);
    assert.equal(artifactTrigger(file), selected, file);
  }
});

test("artifact hook validates template-only and output changes and propagates gate failures", (context) => {
  const root = fixture(context);
  const hooks = load(readFileSync(new URL("../../../lefthook.yml", import.meta.url), "utf8"));
  assert.equal(hooks["pre-commit"].commands["h2-sync"], undefined);
  const command = hooks["pre-commit"].commands["artifact-validation"].run;
  assert.equal(command, "node tools/scripts/check-publication-scope.mjs artifacts");
  assert.equal(hooks["pre-commit"].commands["markdown-lint"].stage_fixed, undefined);
  mkdirSync(path.join(root, "tools/scripts"), { recursive: true });
  for (const code of [0, 1, 7]) {
    writeFileSync(path.join(root, "tools/scripts/check-publication-scope.mjs"), `process.exit(${code});\n`);
    const result = spawnSync("/bin/sh", ["-c", command], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, code);
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
  const quality = readFileSync(
    new URL("../../../.archive/docs-cleanup-2026-09-22/QUALITY_SCORE.md", import.meta.url),
    "utf8",
  );
  assert.match(quality, /historical, not a current validation result/);
  assert.doesNotMatch(quality.split("## Change Log")[0], /\d+ primary|\d+ subagents|\d+ skills|\d+ instructions/);
});

test("version sync fails on missing or malformed required version evidence", (context) => {
  const root = fixture(context);
  const script = fileURLToPath(new URL("../../scripts/validate-version-sync.mjs", import.meta.url));
  const valid = {
    "VERSION.md": "**Current Version:** 1.2.3\n",
    "package.json": '{"version":"1.2.3"}',
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
  assert.equal(check({ "CHANGELOG.md": "# Historical changelog" }), 0);
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
