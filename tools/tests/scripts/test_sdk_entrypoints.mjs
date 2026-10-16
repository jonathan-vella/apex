import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";
import { getPromptFiles } from "../../scripts/_lib/workspace-index.mjs";

const root = new URL("../../../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");

for (const [entry, reference] of [
  ["apex-workflow-start", "apex-workflow-engine/references/workflow-entry.md"],
  ["apex-git-commit", "apex-github-operations/references/git-commit.md"],
  ["apex-debug-log-export", "apex-context-management/references/debug-log-export.md"],
]) {
  test(`${entry} is manual, model-inheriting and permission-neutral`, () => {
    const content = read(`.github/skills/${entry}/SKILL.md`);
    const metadata = parseFrontmatter(content);
    assert.equal(metadata.name, entry);
    assert.equal(metadata["user-invocable"], true);
    assert.equal(metadata["disable-model-invocation"], true);
    for (const key of ["agent", "agents", "model", "tools", "allowed-tools", "context", "hooks"]) {
      assert.equal(Object.hasOwn(metadata, key), false, `${entry}: ${key}`);
    }
    assert.ok(content.includes(`../${reference}`));
    assert.ok(existsSync(new URL(`.github/skills/${reference}`, root)));
    assert.match(content, /\*\*STOP\*\*/);
    assert.match(content, /(?:cannot|does not) bind/);
    assert.match(content, /(?:widen tools|widening tools)/);
  });
}

test("Local roots are archived and never active prompt sources", () => {
  assert.equal(getPromptFiles().size, 0);
  for (const [retired, archived] of [
    [".github/prompts", "github-prompts"],
    ["tools/apex-prompts", "apex-prompts"],
    [".github/instructions/prompt.instructions.md", "prompt.instructions.md"],
  ]) {
    assert.equal(existsSync(new URL(retired, root)), false, retired);
    assert.equal(existsSync(new URL(`.archive/pre-cpharness/${archived}`, root)), true, archived);
  }
  assert.equal(Object.hasOwn(JSON.parse(read("tools/registry/agent-registry.json")), "prompts"), false);
});

test("only Orchestrator dispatches main agents; steps dispatch leaves only", () => {
  const mains = readdirSync(new URL(".github/agents/", root))
    .filter((file) => file.endsWith(".agent.md"))
    .map((file) => parseFrontmatter(read(`.github/agents/${file}`)));
  const names = new Set(mains.map((agent) => agent.name));
  const orchestrator = mains.find((agent) => agent.name === "01-Orchestrator");
  assert.equal(orchestrator["disable-model-invocation"], true);
  assert.ok(orchestrator.agents.length > 0);
  assert.ok(orchestrator.tools.includes("agent"));
  for (const target of orchestrator.agents) {
    assert.ok(names.has(target), target);
    assert.notEqual(target, orchestrator.name);
  }
  for (const agent of mains.filter((agent) => agent !== orchestrator)) {
    assert.equal(agent["disable-model-invocation"], false, agent.name);
    assert.equal(agent["user-invocable"], true, agent.name);
    for (const target of agent.agents ?? []) assert.ok(!names.has(target), `${agent.name}: ${target}`);
  }
});

test("commit procedure retains staged-index, identity, normal-hook and credential gates", () => {
  const shared = read(".github/skills/apex-github-operations/references/git-commit.md");
  for (const phrase of [
    "git var GIT_AUTHOR_IDENT",
    "git var GIT_COMMITTER_IDENT",
    "First inspect the entire existing index",
    "Never commit to `main`",
    "Never force-push",
    "do not change persistent credential configuration",
    "If a pre-commit hook fails, capture its output, summarize the error and stop",
  ])
    assert.ok(shared.includes(phrase), phrase);
});
