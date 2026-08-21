/** Canonical skill-reference extraction shared by discovery and validation. */

export const SKILL_REFERENCE_PATTERN = /(?:\.github\/)?skills\/([a-z0-9]+(?:-[a-z0-9]+)*)\/SKILL\.md/g;

export function findSkillReferences(content) {
  const found = new Set();
  for (const match of content.matchAll(SKILL_REFERENCE_PATTERN)) {
    found.add(match[1]);
  }
  return found;
}

export function extractSkillReferences(content) {
  return [...findSkillReferences(content)];
}
