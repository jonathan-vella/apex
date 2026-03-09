#!/usr/bin/env node
/**
 * Skill Size Validator
 *
 * Enforces context optimization rule: SKILL.md files over 200 lines
 * must have a `references/` directory for progressive loading.
 * Skills under the threshold are fine without references.
 *
 * @example
 * node scripts/validate-skill-size.mjs
 */

import path from "node:path";
import { getSkills } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { MAX_SKILL_LINES_WITHOUT_REFS } from "./_lib/paths.mjs";

const MAX_LINES_WITHOUT_REFS = MAX_SKILL_LINES_WITHOUT_REFS;

// Pre-existing oversized skills (tracked for future remediation).
// New skills MUST comply — only add entries here with a linked issue.
const KNOWN_OVERSIZED = new Set([
  "azure-adr",
  "github-operations",
  "make-skill-template",
  "microsoft-skill-creator",
]);

const r = new Reporter("Skill Size Validator");
r.header();

const skills = getSkills();

for (const [skill, info] of skills) {
  if (!info.content) continue;
  r.tick();

  const lineCount = info.content.split("\n").length;
  const hasRefs = info.hasRefs;
  const skillPath = path.join(info.dir, "SKILL.md");
  const refsDir = path.join(info.dir, "references");

  if (lineCount > MAX_LINES_WITHOUT_REFS && !hasRefs) {
    if (KNOWN_OVERSIZED.has(skill)) {
      r.warn(skill, `SKILL.md is ${lineCount} lines (>${MAX_LINES_WITHOUT_REFS}) without references/ (known — tracked for remediation)`);
    } else {
      r.errorAnnotation(skillPath, `${skill}/SKILL.md is ${lineCount} lines (>${MAX_LINES_WITHOUT_REFS}) without references/`);
      console.log(`  Fix: Create ${refsDir}/ and move detailed content to reference files.`);
    }
  } else if (lineCount > MAX_LINES_WITHOUT_REFS && hasRefs) {
    r.warn(skill, `SKILL.md is ${lineCount} lines (>${MAX_LINES_WITHOUT_REFS}) but has ${info.refFiles.length} reference files — consider trimming further`);
  }
}

r.summary();
r.exitOnError("Skill size check passed");
