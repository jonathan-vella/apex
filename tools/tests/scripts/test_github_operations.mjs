import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { JSON_SCHEMA, load } from "js-yaml";
import { parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (file) => readFileSync(path.join(root, file), "utf8");
const skillPath = ".github/skills/apex-github-operations/";
const naming = path.join(root, "tools/scripts/validate-branch-naming.sh");
const scope = path.join(root, "tools/scripts/validate-branch-scope.sh");
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
environment.GIT_CONFIG_NOSYSTEM = "1";
environment.GIT_CONFIG_GLOBAL = "/dev/null";

function run(script, args, cwd = root) {
  const result = spawnSync("bash", [script, ...args], { cwd, env: environment, encoding: "utf8" });
  assert.ifError(result.error);
  return result;
}

function repository(context) {
  const directory = mkdtempSync(path.join(tmpdir(), "apex-github-operations-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync(
      "git",
      ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args],
      { cwd: directory, env: environment, encoding: "utf8" },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const write = (file, text = "fixture\n") => {
    const target = path.join(directory, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
  };
  const commit = () => {
    git("add", "--all");
    git("commit", "--quiet", "-m", "test: Update fixture");
  };
  git("init", "--quiet", "--initial-branch=main", "--template=");
  write("README.md");
  write("tools/scripts/original.mjs");
  commit();
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  return { directory, git, write, commit };
}

test("GitHub operations is the discoverable, model-neutral canonical commit skill", () => {
  const source = read(`${skillPath}SKILL.md`);
  const metadata = parseFrontmatter(source);
  assert.equal(metadata.name, "apex-github-operations");
  assert.equal(metadata["user-invocable"], true);
  assert.equal(metadata["disable-model-invocation"], false);
  for (const key of ["agent", "agents", "model", "tools", "allowed-tools", "context", "hooks"]) {
    assert.equal(Object.hasOwn(metadata, key), false, key);
  }
  assert.equal(existsSync(path.join(root, ".github/skills/apex-git-commit/SKILL.md")), false);
  for (const retired of ["merge-sensei-free-pr.md", "smart-pr-flow.md"]) {
    assert.equal(existsSync(path.join(root, skillPath, "references", retired)), false);
  }
  assert.match(source, /A commit request alone never authorizes push, PR creation or merge/);
  assert.match(source, /Decline does not approve; cancellation stops/);
  assert.match(source, /USER_INPUT_REQUIRED/);
  assert.doesNotMatch(source, /MAI-Code|Require the selected built-in owner/);
});

test("commit procedure separates publication and preserves full-index and partial-stage safeguards", () => {
  const source = read(`${skillPath}references/git-commit.md`);
  for (const phrase of [
    "git var GIT_AUTHOR_IDENT",
    "git var GIT_COMMITTER_IDENT",
    "git diff --cached --name-status",
    "git diff --cached --check",
    "preserve unrelated hunks and other submodules",
    "Preserve partially staged files",
    "user explicitly requests it",
    "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>",
    "report the failed phase and stop",
  ]) {
    assert.ok(source.includes(phrase), phrase);
  }
  assert.match(source, /Exclude `agent-output\/` and `infra\/` from inferred scope unless explicitly included/);
  assert.match(source, /If the existing index contains unrelated or excluded changes, stop/);
  assert.match(source, /Refuse `main`, the repository default branch and detached HEAD/);
  assert.match(source, /Normal pre-commit and commit-msg hooks must run/);
  assert.match(source, /If any hook or commit fails,[\s\S]*stop; do not retry automatically/);
  assert.match(source, /For commit-only requests, finish here/);
  assert.ok(source.indexOf("For commit-only requests, finish here") < source.indexOf("## Push Only When Authorized"));
  assert.match(source, /all outgoing commits, not just the newest commit/);
  assert.match(source, /Never switch accounts or helpers implicitly/);
  assert.doesNotMatch(source, /git add -A|git add -p|head -200|feat\/skills-sensei|git commit[^\n]*&&/);
});

test("PR guidance uses real templates, verified state and approved head SHA rather than imaginary automation", () => {
  const source = read(`${skillPath}references/issues-and-prs.md`);
  for (const phrase of [
    ".github/PULL_REQUEST_TEMPLATE.md",
    "root `PULL_REQUEST_TEMPLATE.md`",
    ".github/PULL_REQUEST_TEMPLATE/",
    "gh pr checks",
    "--match-head-commit",
    "changed head/scope requires renewed approval",
    "Use `--auto` only if explicitly authorized",
    "not evidence that a PR was created",
  ]) {
    assert.ok(source.includes(phrase), phrase);
  }
  const cli = read(`${skillPath}references/detailed-commands.md`);
  assert.match(cli, /user-run private-terminal operation/);
  assert.match(cli, /gh api graphql/);
  assert.match(cli, /Do not assume the latest run belongs to your dispatch/);
  assert.doesNotMatch(cli, /gh auth (?:token|login)|--body "secret_value"|RUN_ID=/);
  const active = [
    source,
    cli,
    read(`${skillPath}SKILL.md`),
    read(".github/skills/apex-iac-common/references/deploy-shared-workflow.md"),
  ].join("\n");
  assert.doesNotMatch(active, /infraops-(?:ci-pass|needs-fix|reviewed)|mcp_github_|smart-pr-flow\.md/);
});

test("CI executes the same branch validators with safe event inputs and full comparison history", () => {
  const workflow = load(read(".github/workflows/branch-enforcement.yml"), { schema: JSON_SCHEMA });
  const namingJob = workflow.jobs["branch-naming"];
  const scopeJob = workflow.jobs["branch-scope"];
  const namingStep = namingJob.steps.find((step) => step.name === "Validate branch name");
  const scopeStep = scopeJob.steps.find((step) => step.name === "Validate branch scope");
  assert.equal(namingStep.run, 'bash tools/scripts/validate-branch-naming.sh "$BRANCH_NAME"');
  assert.equal(scopeStep.run, 'bash tools/scripts/validate-branch-scope.sh "$BRANCH_NAME" "origin/$BASE_BRANCH"');
  assert.equal(namingStep.env.BRANCH_NAME, "${{ github.head_ref || github.ref_name }}");
  assert.equal(scopeStep.env.BASE_BRANCH, "${{ github.base_ref || github.event.repository.default_branch }}");
  assert.equal(scopeJob.steps.find((step) => step.uses?.startsWith("actions/checkout@")).with["fetch-depth"], 0);
  assert.ok(Object.hasOwn(workflow.on, "workflow_dispatch"));
  assert.equal(workflow.on.pull_request.paths, undefined);
  const hooks = load(read("lefthook.yml"), { schema: JSON_SCHEMA });
  assert.equal(hooks["pre-push"].commands["branch-naming"].run, "bash tools/scripts/validate-branch-naming.sh");
  assert.equal(hooks["pre-push"].commands["branch-scope"].run, "bash tools/scripts/validate-branch-scope.sh");
});

test("branch naming accepts documented contributor and automation prefixes", () => {
  for (const prefix of [
    "docs",
    "agents",
    "skills",
    "infra",
    "scripts",
    "instructions",
    "fix",
    "chore",
    "feat",
    "ci",
    "refactor",
    "perf",
    "test",
    "build",
    "revert",
    "dependabot",
    "automation",
  ]) {
    const branch = `${prefix}/scoped-change`;
    const result = run(naming, [branch]);
    assert.equal(result.status, 0, `${branch}: ${result.stderr}`);
  }
  for (const branch of ["main", "HEAD"]) assert.equal(run(naming, [branch]).status, 0);
});

test("branch naming rejects legacy, malformed and unscoped names", () => {
  for (const branch of ["tools/scripts/change", "feature/change", "scripts/", "fix/bad name", "feat/a..b", ""]) {
    const result = run(naming, [branch]);
    assert.notEqual(result.status, 0, branch);
    assert.match(result.stderr, /Invalid Git branch|does not follow/);
  }
  assert.equal(run(naming, ["--help"]).status, 0);
  assert.equal(run(scope, ["--help"]).status, 0);
  assert.notEqual(run(naming, ["feat/a", "extra"]).status, 0);
  assert.notEqual(run(scope, ["feat/a", "origin/main", "extra"]).status, 0);
});

for (const [branch, files] of [
  ["docs/update", ["README.md", "CONTRIBUTING.md", "CHANGELOG.md", "GLOSSARY.md"]],
  ["agents/update", [".github/agents/test.agent.md", "tools/registry/agent-registry.json"]],
  ["skills/update", [".github/skills/test/SKILL.md"]],
  ["infra/update", ["infra/bicep/test/main.bicep"]],
  ["scripts/update", ["tools/scripts/a.mjs", "tools/scripts/nested/space name.mjs", "package.json"]],
  ["instructions/update", [".github/instructions/test.instructions.md"]],
]) {
  test(`branch scope accepts exactly the documented domain for ${branch}`, (context) => {
    const fixture = repository(context);
    for (const file of files) fixture.write(file, "updated\n");
    fixture.commit();
    const result = run(scope, [branch], fixture.directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`All ${files.length} changed file`));
  });
}

for (const [branch, file] of [
  ["docs/update", "README.md.backup"],
  ["agents/update", "tools/registry/agent-registry.json.backup"],
  ["skills/update", "package.json"],
  ["infra/update", "README.md"],
  ["scripts/update", "tools/tools/scripts/wrong.mjs"],
  ["scripts/update", "package.json.backup"],
  ["instructions/update", ".github/agents/test.agent.md"],
]) {
  test(`branch scope blocks ${file} on ${branch}`, (context) => {
    const fixture = repository(context);
    fixture.write(file, "updated\n");
    fixture.commit();
    const result = run(scope, [branch], fixture.directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /modifies files outside/);
  });
}

test("scope violations stay blocked when paths contain newlines", (context) => {
  const fixture = repository(context);
  fixture.write("tools/scripts/allowed.mjs\noutside.txt");
  fixture.commit();
  const result = run(scope, ["scripts/update"], fixture.directory);
  assert.equal(result.status, 0, result.stderr);
  fixture.write("outside.txt\ntools/scripts/pretend.mjs");
  fixture.commit();
  assert.notEqual(run(scope, ["scripts/update"], fixture.directory).status, 0);
});

test("scope checks include both sides of renames and deletions", (context) => {
  const fixture = repository(context);
  fixture.git("mv", "README.md", "tools/scripts/moved.md");
  fixture.commit();
  assert.notEqual(run(scope, ["scripts/update"], fixture.directory).status, 0);
  assert.notEqual(run(scope, ["docs/update"], fixture.directory).status, 0);
});

test("domain scope fails closed on absent or unrelated comparison history", (context) => {
  const fixture = repository(context);
  fixture.write("tools/scripts/valid.mjs");
  fixture.commit();
  assert.equal(run(scope, ["scripts/update"], fixture.directory).status, 0);
  fixture.git("update-ref", "-d", "refs/remotes/origin/main");
  const missing = run(scope, ["scripts/update"], fixture.directory);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Cannot compare branch/);
  assert.notEqual(run(scope, ["scripts/update", ""], fixture.directory).status, 0);
  fixture.git("checkout", "--orphan", "unrelated");
  fixture.write("unrelated.txt");
  fixture.commit();
  fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
  fixture.git("checkout", "main");
  assert.notEqual(run(scope, ["scripts/update"], fixture.directory).status, 0);
});

test("scope supports explicit bases, default branch detection and clean comparisons", (context) => {
  const fixture = repository(context);
  fixture.git("branch", "comparison-base");
  fixture.git("checkout", "-b", "scripts/update");
  const clean = run(scope, [], fixture.directory);
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /All 0 changed file/);
  fixture.write("tools/scripts/changed.mjs");
  fixture.commit();
  assert.equal(run(naming, [], fixture.directory).status, 0);
  assert.equal(run(scope, ["scripts/update", "comparison-base"], fixture.directory).status, 0);
  for (const branch of ["feat/update", "fix/update", "dependabot/update", "automation/update"]) {
    assert.equal(run(scope, [branch, "absent-base"], fixture.directory).status, 0);
  }
  assert.notEqual(run(scope, ["unknown/update"], fixture.directory).status, 0);
});
