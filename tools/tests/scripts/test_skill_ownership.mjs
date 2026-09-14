import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");
const moves = [
  ["apex-workflow-engine", "apex-docs-writer", "doc-gardening", "doc-gardening"],
  ["apex-workflow-engine", "apex-docs-writer", "plan-docs-peer-review", "plan-docsPeerReview"],
  ["apex-workflow-engine", "apex-docs-writer", "review-astro-docs", "review-astro-docs"],
  ["apex-context-management", "apex-agent-authoring", "assess-agents", "assess-agents"],
  ["apex-context-management", "apex-agent-authoring", "assess-github-folder", "assess-github-folder"],
  [
    "apex-context-management",
    "apex-agent-authoring",
    "plan-four-layer-agent-assessment",
    "plan-fourLayerAgentAssessment",
  ],
];

function checkRelativeLinks(file) {
  for (const match of source(file).matchAll(/\]\(([^)]+)\)|^\[[^\]]+\]:\s+(\S+)/gm)) {
    const target = (match[1] ?? match[2]).split("#")[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    assert.ok(existsSync(path.resolve(root, path.dirname(file), target)), `${file}: ${target}`);
  }
}

for (const [previous, owner, name, adapter] of moves) {
  test(`${name} has one canonical owner, indexed links, a canary and a trackable destination`, () => {
    const destination = `.github/skills/${owner}/references/${name}.md`;
    assert.equal(existsSync(path.join(root, `.github/skills/${previous}/references/${name}.md`)), false);
    assert.match(source(destination), /^<!-- ref:[a-z0-9-]+-v\d+ -->/);
    assert.equal(statSync(path.join(root, destination)).mode & 0o111, 0);
    assert.ok(source(`.github/skills/${owner}/SKILL.md`).includes(`references/${name}.md`));
    const prompt = `tools/apex-prompts/utility-prompts/${adapter}.prompt.md`;
    assert.ok(source(prompt).includes(`${owner}/references/${name}.md`));
    if (!name.startsWith("plan-four-layer")) assert.ok(source(prompt).includes(`${owner}/SKILL.md`));
    checkRelativeLinks(destination);
    checkRelativeLinks(prompt);
    const ignored = spawnSync("git", ["check-ignore", "--no-index", destination], { cwd: root, encoding: "utf8" });
    assert.equal(ignored.status, 1, `${destination}: ${ignored.stdout}${ignored.stderr}`);
  });
}

test("context runtime and log audits stay with context-management", () => {
  const skill = source(".github/skills/apex-context-management/SKILL.md");
  for (const reference of ["debug-log-export", "context-audit", "analysis-methodology", "compression-templates"]) {
    assert.ok(skill.includes(`references/${reference}.md`));
    assert.ok(existsSync(path.join(root, `.github/skills/apex-context-management/references/${reference}.md`)));
  }
});

test("owning skill and documentation source indexes resolve", () => {
  for (const owner of ["apex-docs-writer", "apex-agent-authoring", "apex-workflow-engine", "apex-context-management"]) {
    checkRelativeLinks(`.github/skills/${owner}/SKILL.md`);
  }
  checkRelativeLinks(".github/skills/apex-docs-writer/references/repo-architecture.md");
  checkRelativeLinks(".github/skills/apex-docs-writer/references/freshness-checklist.md");
});

test("moved procedures retain review modes and optional runtime evidence boundaries", () => {
  assert.match(source(".github/skills/apex-docs-writer/references/doc-gardening.md"), /do not auto-fix findings/);
  assert.match(source(".github/skills/apex-docs-writer/references/plan-docs-peer-review.md"), /Read-only review/);
  assert.match(source(".github/skills/apex-docs-writer/references/review-astro-docs.md"), /Default: report-only/);
  for (const name of ["assess-agents", "assess-github-folder"]) {
    assert.match(
      source(`.github/skills/apex-agent-authoring/references/${name}.md`),
      /Gate .* Approval before execution/,
    );
  }
  assert.match(
    source(".github/skills/apex-agent-authoring/references/assess-agents.md"),
    /never fabricate runtime numbers/,
  );
  assert.match(
    source(".github/skills/apex-agent-authoring/references/plan-four-layer-agent-assessment.md"),
    /Do not execute this/,
  );
});
