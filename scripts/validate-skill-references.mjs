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
import { Reporter } from "./_lib/reporter.mjs";
import { SKILLS_DIR, INSTRUCTIONS_DIR } from "./_lib/paths.mjs";

const r = new Reporter("Skill References Validator");
r.header();

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
    r.tick();
    const refRelPath = `${skill}/references/${refFile}`;
    const refName = refFile.replace(/\.md$/, "");

    const isReferenced =
      allContent.includes(refRelPath) ||
      allContent.includes(`references/${refFile}`) ||
      allContent.includes(`${skill}/references/${refName}`);

    if (!isReferenced) {
      r.warnAnnotation(path.join(refsDir, refFile), `${refRelPath} is not referenced by any agent, skill, or instruction`);
      console.log(`  Fix: Add a loading directive in ${skill}/SKILL.md or remove the orphaned file.`);
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
    r.tick();
    const refName = refFile.replace(/\.md$/, "");
    const isReferenced =
      allContent.includes(refFile) || allContent.includes(refName);

    if (!isReferenced) {
      r.warnAnnotation(path.join(instrRefsDir, refFile), `instructions/references/${refFile} is not referenced anywhere`);
      console.log(`  Fix: Add a reference in the parent instruction file or remove the orphaned file.`);
    }
  }
}

r.summary();
r.exitOnError("Skill references check passed");
