// Fixture test for the wired-skills regex used in
// tools/scripts/validate-orphaned-content.mjs.
//
// Asserts that the regex correctly identifies skill references across:
//   - SKILL.md (canonical — the only tier)
//   - Inside fenced code blocks
//   - With or without the leading `.github/` prefix

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findSkillReferences } from "../scripts/_lib/skill-references.mjs";

describe("orphan-skill-discovery regex", () => {
  it("finds canonical SKILL.md references", () => {
    const content = `Read .github/skills/azure-defaults/SKILL.md for regions.`;
    assert.deepEqual([...findSkillReferences(content)], ["azure-defaults"]);
  });

  it("finds references inside fenced code blocks", () => {
    const content = ["Run this:", "```bash", "cat .github/skills/microsoft-docs/SKILL.md", "```"].join("\n");
    assert.deepEqual([...findSkillReferences(content)], ["microsoft-docs"]);
  });

  it("finds references without the leading `.github/` prefix", () => {
    const content = `See skills/context-management/SKILL.md`;
    assert.deepEqual([...findSkillReferences(content)], ["context-management"]);
  });

  it("collects multiple distinct skills in one document", () => {
    const content = `
      Read .github/skills/azure-defaults/SKILL.md
      Read .github/skills/azure-artifacts/SKILL.md
      Also: skills/golden-principles/SKILL.md
    `;
    const found = findSkillReferences(content);
    assert.equal(found.size, 3);
    assert.ok(found.has("azure-defaults"));
    assert.ok(found.has("azure-artifacts"));
    assert.ok(found.has("golden-principles"));
  });

  it("does NOT match unrelated paths", () => {
    const content = `
      .github/instructions/azure-yaml.instructions.md
      tools/scripts/foo.mjs
      .github/skills/azure-defaults/references/regions.md
      .github/skills/azure-defaults/templates/tag-template.md
    `;
    assert.deepEqual([...findSkillReferences(content)], []);
  });

  it("matches kebab-case skill names", () => {
    const content = `Read .github/skills/azure-cost-optimization/SKILL.md`;
    assert.deepEqual([...findSkillReferences(content)], ["azure-cost-optimization"]);
  });

  it("ignores uppercase / mixed-case skill names (must be kebab-case)", () => {
    const content = `Read .github/skills/AzureDefaults/SKILL.md`;
    assert.deepEqual([...findSkillReferences(content)], []);
  });
});
