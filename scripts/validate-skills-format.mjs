#!/usr/bin/env node
/**
 * VS Code 1.109 Skills GA Format & Size Validator
 *
 * Validates that all skill files conform to VS Code 1.109 GA specification:
 * - SKILL.md file exists in skill directory
 * - Valid frontmatter with description field
 * - Proper directory structure (.github/skills/{name}/SKILL.md)
 * - No deprecated skill syntax
 * - Body size ≤ MAX_SKILL_LINES_WITHOUT_REFS requires references/ dir
 *
 * @example
 * node scripts/validate-skills-format.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { getSkills } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { MAX_SKILL_LINES_WITHOUT_REFS } from "./_lib/paths.mjs";

// Patterns that are hard errors (break runtime behaviour if present)
const FORBIDDEN_PATTERNS = [
  {
    pattern: /^description:\s*[>|][-\s]*$/m,
    message:
      "description uses a YAML block scalar (>, >-, | or |-). " +
      "Use a single-line inline string instead.",
  },
];

// Deprecated patterns that should not appear
const DEPRECATED_PATTERNS = [
  {
    pattern: /skill-version:\s*beta/i,
    message: "skill-version: beta is deprecated, remove for GA",
  },
  {
    pattern: /\.skill\.json/i,
    message: ".skill.json files are deprecated, use SKILL.md frontmatter",
  },
];

// Pre-existing oversized skills (tracked for future remediation).
const KNOWN_OVERSIZED = new Set([
  "azure-adr",
  "github-operations",
  "make-skill-template",
]);

const r = new Reporter("Skills GA Format Validator");
r.header();

const skills = getSkills();

if (skills.size === 0) {
  console.log("No .github/skills directory found - skipping skill validation");
  process.exit(0);
}

console.log(`Found ${skills.size} skill directories\n`);

for (const [skillName, skill] of skills) {
  r.tick();
  const { dir: skillDir, content, frontmatter, hasRefs, refFiles } = skill;
  const skillFile = path.join(skillDir, "SKILL.md");

  if (!content) {
    r.error(skillName, "Missing SKILL.md file");
    continue;
  }

  // Extract raw frontmatter block for pattern checks
  const rawFrontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const rawFrontmatter = rawFrontmatterMatch ? rawFrontmatterMatch[1] : "";

  if (!frontmatter) {
    r.error(skillName, "No frontmatter found in SKILL.md");
    continue;
  }

  // Required: description
  if (!frontmatter.description) {
    r.error(skillName, "Missing required frontmatter field 'description'");
  }

  // Check for forbidden patterns in frontmatter only
  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    if (pattern.test(rawFrontmatter)) {
      r.error(skillName, message);
    }
  }

  // Check for deprecated patterns
  for (const { pattern, message } of DEPRECATED_PATTERNS) {
    if (pattern.test(content)) {
      r.warn(skillName, message);
    }
  }

  // Check for deprecated .skill.json files
  const jsonFiles = fs
    .readdirSync(skillDir)
    .filter((f) => f.endsWith(".skill.json"));
  if (jsonFiles.length > 0) {
    r.warn(
      skillName,
      `Found deprecated .skill.json file(s): ${jsonFiles.join(", ")}`,
    );
  }

  // Validate name matches directory name
  if (frontmatter.name && frontmatter.name !== skillName) {
    r.error(
      skillName,
      `Frontmatter 'name' ("${frontmatter.name}") does not match directory name ("${skillName}")`,
    );
  }

  // Validate description is meaningful
  if (frontmatter.description && frontmatter.description.length < 10) {
    r.warn(
      skillName,
      `Description is too short (${frontmatter.description.length} chars)`,
    );
  }

  // Skill size check (merged from validate-skill-size)
  const lineCount = content.split("\n").length;
  if (lineCount > MAX_SKILL_LINES_WITHOUT_REFS && !hasRefs) {
    if (KNOWN_OVERSIZED.has(skillName)) {
      r.warn(
        skillName,
        `SKILL.md is ${lineCount} lines (>${MAX_SKILL_LINES_WITHOUT_REFS}) without references/ (known — tracked)`,
      );
    } else {
      r.error(
        skillName,
        `SKILL.md is ${lineCount} lines (>${MAX_SKILL_LINES_WITHOUT_REFS}) without references/`,
      );
    }
  } else if (lineCount > MAX_SKILL_LINES_WITHOUT_REFS && hasRefs) {
    r.warn(
      skillName,
      `SKILL.md is ${lineCount} lines (>${MAX_SKILL_LINES_WITHOUT_REFS}) but has ${refFiles.length} reference files`,
    );
  }

  r.ok(skillName, "Valid GA skill format");
}

r.summary();
r.exitOnError(
  "All skills passed GA format validation",
  "Skill validation FAILED",
);
