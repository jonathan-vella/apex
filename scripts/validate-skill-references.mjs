#!/usr/bin/env node
/**
 * Skill References Validator
 *
 * Ensures all files in skill `references/` directories are referenced
 * somewhere (SKILL.md, agents, or instructions). Orphaned reference
 * files waste repository space and create maintenance confusion.
 *
 * @example
 * node scripts/validate-skill-references.mjs
 */

import fs from "node:fs";
import path from "node:path";
import {
  getAgents,
  getSkills,
  getInstructions,
} from "./_lib/workspace-index.mjs";

const SKILLS_DIR = ".github/skills";
const INSTRUCTIONS_DIR = ".github/instructions";

let errors = 0;
let warnings = 0;
let checked = 0;

console.log("\n🔍 Skill References Validator\n");

// Gather all searchable content from cached index
function gatherSearchableContent() {
  const content = [];
  for (const [, agent] of getAgents()) content.push(agent.content);
  for (const [, instr] of getInstructions()) content.push(instr.content);
  for (const [, skill] of getSkills()) {
    if (skill.content) content.push(skill.content);
  }
  return content.join("\n");
}

const allContent = gatherSearchableContent();

// Check each skill's references/ directory
const skills = getSkills();

for (const [skill, info] of skills) {
  if (!info.hasRefs) continue;
  const refsDir = path.join(SKILLS_DIR, skill, "references");

  for (const refFile of info.refFiles) {
    checked++;
    const refRelPath = `${skill}/references/${refFile}`;
    const refName = refFile.replace(/\.md$/, "");

    // Check if referenced anywhere using explicit reference paths
    // to avoid false positives from short filenames matching unrelated text
    const isReferenced =
      allContent.includes(refRelPath) ||
      allContent.includes(`references/${refFile}`) ||
      allContent.includes(`${skill}/references/${refName}`);

    if (!isReferenced) {
      console.log(
        `::warning file=${path.join(refsDir, refFile)}::${refRelPath} is not referenced by any agent, skill, or instruction`,
      );
      console.log(
        `  Fix: Add a loading directive in ${skill}/SKILL.md or remove the orphaned file.`,
      );
      warnings++;
    }
  }
}

// Also check instruction references/
const instrRefsDir = path.join(INSTRUCTIONS_DIR, "references");
if (fs.existsSync(instrRefsDir)) {
  const instrRefFiles = fs
    .readdirSync(instrRefsDir)
    .filter((f) => f.endsWith(".md"));

  for (const refFile of instrRefFiles) {
    checked++;
    const refName = refFile.replace(/\.md$/, "");
    const isReferenced =
      allContent.includes(refFile) || allContent.includes(refName);

    if (!isReferenced) {
      console.log(
        `::warning file=${path.join(instrRefsDir, refFile)}::instructions/references/${refFile} is not referenced anywhere`,
      );
      console.log(
        `  Fix: Add a reference in the parent instruction file or remove the orphaned file.`,
      );
      warnings++;
    }
  }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`Checked: ${checked} | Warnings: ${warnings} | Errors: ${errors}`);

if (errors > 0) {
  console.log(`\n❌ ${errors} reference resolution error(s)`);
  process.exit(1);
}
console.log(`\n✅ Skill references check passed`);
