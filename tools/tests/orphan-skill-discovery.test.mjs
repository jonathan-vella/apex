// Fixture test for the wired-skills regex used in
// tools/scripts/validate-orphaned-content.mjs (Phase 2 of
// context-window-optimization).
//
// Asserts that the regex correctly identifies skill references across:
//   - SKILL.md (canonical)
//   - SKILL.digest.md (Phase 4 default)
//   - SKILL.minimal.md (>80% utilization escalation)
//   - Inside fenced code blocks
//   - With or without the leading `.github/` prefix

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Mirror of SKILL_REFERENCE_PATTERN in
// tools/scripts/validate-orphaned-content.mjs. Keep in sync — the fixture
// test exists specifically to detect drift in the regex.
const SKILL_REFERENCE_PATTERN = /(?:\.github\/)?skills\/([a-z0-9]+(?:-[a-z0-9]+)*)\/SKILL(?:\.digest|\.minimal)?\.md/g;

function findSkillReferences(content) {
  const found = new Set();
  let m;
  SKILL_REFERENCE_PATTERN.lastIndex = 0;
  while ((m = SKILL_REFERENCE_PATTERN.exec(content)) !== null) {
    found.add(m[1]);
  }
  return found;
}

describe("orphan-skill-discovery regex", () => {
  it("finds canonical SKILL.md references", () => {
    const content = `Read .github/skills/azure-defaults/SKILL.md for regions.`;
    assert.deepEqual([...findSkillReferences(content)], ["azure-defaults"]);
  });

  it("finds SKILL.digest.md references", () => {
    const content = `Read .github/skills/golden-principles/SKILL.digest.md for invariants.`;
    assert.deepEqual([...findSkillReferences(content)], ["golden-principles"]);
  });

  it("finds SKILL.minimal.md references", () => {
    const content = `When >80% utilization, read .github/skills/azure-defaults/SKILL.minimal.md instead.`;
    assert.deepEqual([...findSkillReferences(content)], ["azure-defaults"]);
  });

  it("finds references inside fenced code blocks", () => {
    const content = ["Run this:", "```bash", "cat .github/skills/microsoft-docs/SKILL.digest.md", "```"].join("\n");
    assert.deepEqual([...findSkillReferences(content)], ["microsoft-docs"]);
  });

  it("finds references without the leading `.github/` prefix", () => {
    const content = `See skills/context-management/SKILL.md`;
    assert.deepEqual([...findSkillReferences(content)], ["context-management"]);
  });

  it("collects multiple distinct skills in one document", () => {
    const content = `
      Read .github/skills/azure-defaults/SKILL.digest.md
      Read .github/skills/azure-artifacts/SKILL.minimal.md
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
