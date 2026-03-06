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

import fs from "node:fs";
import path from "node:path";
import { getSkills } from "./_lib/workspace-index.mjs";

const MAX_LINES_WITHOUT_REFS = 200;

// Pre-existing oversized skills (tracked for future remediation).
// New skills MUST comply — only add entries here with a linked issue.
const KNOWN_OVERSIZED = new Set([
  "azure-adr",
  "github-operations",
  "make-skill-template",
  "microsoft-skill-creator",
]);

let errors = 0;
let warnings = 0;
let checked = 0;

console.log("\n🔍 Skill Size Validator\n");

const skills = getSkills();

for (const [skill, info] of skills) {
  if (!info.content) continue;
  checked++;

  const lineCount = info.content.split("\n").length;
  const hasRefs = info.hasRefs;
  const skillPath = path.join(info.dir, "SKILL.md");
  const refsDir = path.join(info.dir, "references");

  if (lineCount > MAX_LINES_WITHOUT_REFS && !hasRefs) {
    if (KNOWN_OVERSIZED.has(skill)) {
      console.log(
        `  ⚠️  ${skill}/SKILL.md is ${lineCount} lines (>${MAX_LINES_WITHOUT_REFS}) without references/ (known — tracked for remediation)`,
      );
      warnings++;
    } else {
      console.log(
        `::error file=${skillPath}::${skill}/SKILL.md is ${lineCount} lines (>${MAX_LINES_WITHOUT_REFS}) without references/`,
      );
      console.log(
        `  Fix: Create ${refsDir}/ and move detailed content to reference files.`,
      );
      console.log(
        `  Keep SKILL.md as a ≤${MAX_LINES_WITHOUT_REFS}-line quick-reference with a Reference Index section.`,
      );
      errors++;
    }
  } else if (lineCount > MAX_LINES_WITHOUT_REFS && hasRefs) {
    const refCount = info.refFiles.length;
    console.log(
      `  ⚠️  ${skill}/SKILL.md is ${lineCount} lines (>${MAX_LINES_WITHOUT_REFS}) but has ${refCount} reference files — consider trimming further`,
    );
    warnings++;
  }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`Checked: ${checked} | Warnings: ${warnings} | Errors: ${errors}`);

if (errors > 0) {
  console.log(`\n❌ ${errors} skill size violation(s)`);
  process.exit(1);
}
console.log(`\n✅ Skill size check passed`);
