#!/usr/bin/env node
/**
 * VS Code 1.109 Skills GA Format Validator
 *
 * Validates that all skill files conform to VS Code 1.109 GA specification:
 * - SKILL.md file exists in skill directory
 * - Valid frontmatter with description field
 * - Proper directory structure (.github/skills/{name}/SKILL.md)
 * - No deprecated skill syntax
 *
 * @example
 * node scripts/validate-skills-format.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./_lib/parse-frontmatter.mjs";
import { getSkills } from "./_lib/workspace-index.mjs";

// Required frontmatter fields for GA skills
const REQUIRED_FIELDS = ["description"];

// Patterns that are hard errors (break runtime behaviour if present)
const FORBIDDEN_PATTERNS = [
  {
    pattern: /^description:\s*[>|][-\s]*$/m,
    message:
      "description uses a YAML block scalar (>, >-, | or |-). " +
      "Use a single-line inline string instead — block scalars cause the " +
      "Copilot runtime to receive a literal '>' as the description, which " +
      "silently disables skill auto-discovery.",
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

let errors = 0;
let warnings = 0;
let skillCount = 0;

/**
 * Validate a single skill
 */
function validateSkill(skillDir) {
  const skillName = path.basename(skillDir);
  const skillFile = path.join(skillDir, "SKILL.md");

  // Check SKILL.md exists
  if (!fs.existsSync(skillFile)) {
    console.error(
      `❌ ${skillName}: Missing SKILL.md file. Fix: Create .github/skills/${skillName}/SKILL.md with at least a 'description' in frontmatter.`,
    );
    errors++;
    return;
  }

  const content = fs.readFileSync(skillFile, "utf8");
  const frontmatter = parseFrontmatter(content);

  // Extract raw frontmatter block for pattern checks (avoids false positives
  // from example code fences in the skill body)
  const rawFrontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const rawFrontmatter = rawFrontmatterMatch ? rawFrontmatterMatch[1] : "";

  // Check frontmatter exists
  if (!frontmatter) {
    console.error(
      `❌ ${skillName}: No frontmatter found in SKILL.md. Fix: Add ---\ndescription: "..."\n--- at the top.`,
    );
    errors++;
    return;
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in frontmatter) || !frontmatter[field]) {
      console.error(
        `❌ ${skillName}: Missing required frontmatter field '${field}'. Fix: Add '${field}: "..."' to SKILL.md frontmatter.`,
      );
      errors++;
    }
  }

  // Check for forbidden patterns (hard errors) — checked against raw frontmatter
  // only, so code-fence examples in the skill body don't trigger false positives
  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    if (pattern.test(rawFrontmatter)) {
      console.error(`❌ ${skillName}: ${message}`);
      errors++;
    }
  }

  // Check for deprecated patterns
  for (const { pattern, message } of DEPRECATED_PATTERNS) {
    if (pattern.test(content)) {
      console.warn(`⚠️  ${skillName}: ${message}`);
      warnings++;
    }
  }

  // Check for deprecated .skill.json files in directory
  const jsonFiles = fs
    .readdirSync(skillDir)
    .filter((f) => f.endsWith(".skill.json"));
  if (jsonFiles.length > 0) {
    console.warn(
      `⚠️  ${skillName}: Found deprecated .skill.json file(s): ${jsonFiles.join(", ")}`,
    );
    warnings++;
  }

  // Validate name matches directory name
  if (frontmatter.name && frontmatter.name !== skillName) {
    console.error(
      `❌ ${skillName}: Frontmatter 'name' ("${frontmatter.name}") does not match directory name ("${skillName}"). VS Code will not load the skill.`,
    );
    errors++;
  }

  // Validate description is meaningful (not just placeholder)
  if (frontmatter.description) {
    if (frontmatter.description.length < 10) {
      console.warn(
        `⚠️  ${skillName}: Description is too short (${frontmatter.description.length} chars)`,
      );
      warnings++;
    }
  }

  skillCount++;
  console.log(`✓ ${skillName}: Valid GA skill format`);
}

/**
 * Main validation function
 */
console.log("🔍 VS Code 1.109 Skills GA Format Validator\n");

const skills = getSkills();

if (skills.size === 0) {
  console.log("No .github/skills directory found - skipping skill validation");
  process.exit(0);
}

console.log(`Found ${skills.size} skill directories\n`);

console.log("=== Skills ===");
for (const [skillName, skill] of skills) {
  validateSkill(skill.dir);
}

console.log("\n" + "=".repeat(60));
console.log(`Validated ${skillCount} skills`);

if (errors > 0) {
  console.error(
    `❌ Validation FAILED: ${errors} error(s), ${warnings} warning(s)`,
  );
  process.exit(1);
} else if (warnings > 0) {
  console.log(`⚠️  Validation passed with ${warnings} warning(s)`);
  process.exit(0);
} else {
  console.log("✅ All skills passed GA format validation");
  process.exit(0);
}
