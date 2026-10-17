import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");
const moves = [
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

test("remaining owning skill indexes resolve", () => {
  for (const owner of ["apex-agent-authoring", "apex-workflow-engine", "apex-context-management"]) {
    checkRelativeLinks(`.github/skills/${owner}/SKILL.md`);
  }
});

test("moved procedures retain review modes and optional runtime evidence boundaries", () => {
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

test("retired site tooling is outside active discovery", () => {
  for (const file of [
    ".github/skills/apex-docs-writer/SKILL.md",
    ".github/instructions/astro.instructions.md",
    ".github/instructions/docs.instructions.md",
    "tools/apex-prompts/utility-prompts/doc-gardening.prompt.md",
    "tools/apex-prompts/utility-prompts/plan-docsPeerReview.prompt.md",
    "tools/apex-prompts/utility-prompts/review-astro-docs.prompt.md",
  ]) {
    assert.equal(existsSync(path.join(root, file)), false, file);
  }
});

test("functional root guidance remains active", () => {
  for (const file of ["README.md", "AGENTS.md", "VERSION.md", "LICENSE"])
    assert.ok(existsSync(path.join(root, file)), file);
  const skills = JSON.parse(source("tools/registry/count-manifest.json")).counts.skills;
  assert.equal(skills.computed_from, ".github/skills/*/SKILL.md");
});
