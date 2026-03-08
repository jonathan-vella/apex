#!/usr/bin/env node
/**
 * Orphaned Content Validator
 *
 * Detects skills and instruction files that are not referenced by any
 * agent, other skill, or instruction file. Orphaned content wastes
 * repository space and creates maintenance confusion.
 *
 * @example
 * node scripts/validate-orphaned-content.mjs
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

console.log("\n🔍 Orphaned Content Validator\n");

// Gather reference corpus from cached index + top-level config.
function gatherReferenceContent() {
  const corpus = [];
  const perSkill = {};

  for (const [, agent] of getAgents()) corpus.push(agent.content);
  for (const [, instr] of getInstructions()) corpus.push(instr.content);

  for (const [name, skill] of getSkills()) {
    if (skill.content) perSkill[name] = skill.content;
  }

  // Top-level config files
  for (const f of [
    ".github/copilot-instructions.md",
    "AGENTS.md",
    ".github/prompts/plan-agenticWorkflowOverhaul.prompt.md",
  ]) {
    if (fs.existsSync(f)) corpus.push(fs.readFileSync(f, "utf-8"));
  }

  return { corpus: corpus.join("\n"), perSkill };
}

const { corpus, perSkill } = gatherReferenceContent();

// Check skills — exclude the skill's own SKILL.md to prevent self-referencing
console.log("📁 Skills:");
const skills = getSkills();

for (const [skill] of skills) {
  checked++;
  // Build search content: agents + instructions + config + OTHER skills (not self)
  const otherSkills = Object.entries(perSkill)
    .filter(([name]) => name !== skill)
    .map(([, content]) => content)
    .join("\n");
  const searchContent = corpus + "\n" + otherSkills;

  const isReferenced =
    searchContent.includes(`${skill}/SKILL.md`) ||
    searchContent.includes(`skills/${skill}`) ||
    searchContent.includes(`${skill}/references/`) ||
    searchContent.includes(`${skill}/`) ||
    searchContent.includes(`\`${skill}\``);

  if (!isReferenced) {
    console.log(`  ⚠️  ${skill}/ — not referenced by any agent or instruction`);
    warnings++;
  }
}

// Check instruction files for completeness (applyTo presence)
// Instructions auto-load by glob pattern — missing applyTo means the
// instruction will never be applied automatically.
console.log("\n📁 Instructions (applyTo completeness):");
const instructions = getInstructions();

for (const [file, instr] of instructions) {
  checked++;

  const fmMatch = instr.content.match(/^---\n([\s\S]*?)\n---/);
  const hasApplyTo = fmMatch && fmMatch[1].includes("applyTo");

  if (!hasApplyTo) {
    console.log(
      `  ⚠️  ${file} — no applyTo frontmatter (instruction never auto-loads)`,
    );
    warnings++;
  }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`Checked: ${checked} | Warnings: ${warnings} | Errors: ${errors}`);

if (errors > 0) {
  console.log(`\n❌ ${errors} orphaned content error(s)`);
  process.exit(1);
}
console.log(`\n✅ Orphaned content check passed`);
