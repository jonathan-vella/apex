#!/usr/bin/env node
/**
 * Skill Checks Validator
 *
 * 1. Skill-size check: SKILL.md over MAX_SKILL_LINES_WITHOUT_REFS must have references/.
 * 2. Canary-marker check: every references/*.md must start with `<!-- ref:{slug}-v1 -->`
 *    so docs-freshness can detect stale references.
 *
 * @example
 * node tools/scripts/validate-skill-checks.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { getSkills } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { MAX_SKILL_LINES_WITHOUT_REFS } from "./_lib/paths.mjs";

const r = new Reporter("Skill Checks Validator");
r.header();

// Pre-existing oversized skills (tracked for future remediation).
const KNOWN_OVERSIZED = new Set([
  "azure-adr",
  "github-operations",
  "azure-kusto",
  "azure-cost-optimization",
  "azure-quotas",
]);

// Pattern: matches `<!-- ref:any-slug-v1 -->` on the first non-blank line.
// The closing `-->` may be preceded by additional commentary, e.g.
// `<!-- ref:slug-v1 — Merged from foo -->`.
const CANARY_PATTERN = /^<!--\s*ref:[a-z0-9-]+-v\d+\b.*-->/;

const skills = getSkills();

for (const [skill, info] of skills) {
  if (!info.content) continue;
  r.tick();

  const lineCount = info.content.split("\n").length;
  const hasRefs = info.hasRefs;
  const skillPath = path.join(info.dir, "SKILL.md");
  const refsDir = path.join(info.dir, "references");

  // --- Check 1: skill-size ---
  if (lineCount > MAX_SKILL_LINES_WITHOUT_REFS && !hasRefs) {
    if (KNOWN_OVERSIZED.has(skill)) {
      r.warn(
        skill,
        `SKILL.md is ${lineCount} lines (>${MAX_SKILL_LINES_WITHOUT_REFS}) without references/ (known — tracked for remediation)`,
      );
    } else {
      r.errorAnnotation(
        skillPath,
        `${skill}/SKILL.md is ${lineCount} lines (>${MAX_SKILL_LINES_WITHOUT_REFS}) without references/`,
      );
      console.log(`  Fix: Create ${refsDir}/ and move detailed content to reference files.`);
    }
  } else if (lineCount > MAX_SKILL_LINES_WITHOUT_REFS && hasRefs) {
    r.warn(
      skill,
      `SKILL.md is ${lineCount} lines (>${MAX_SKILL_LINES_WITHOUT_REFS}) but has ${info.refFiles.length} reference files — consider trimming further`,
    );
  } else {
    r.ok(skill, `SKILL.md: ${lineCount} lines`);
  }

  // --- Check 2: canary markers on references/*.md ---
  if (!hasRefs) continue;
  for (const refFile of info.refFiles) {
    const refPath = path.join(refsDir, refFile);
    const refContent = fs.readFileSync(refPath, "utf-8");
    // Allow leading blank lines, then require the marker.
    const firstNonBlank = refContent.split("\n").find((line) => line.trim().length > 0) || "";
    if (!CANARY_PATTERN.test(firstNonBlank)) {
      const slug = refFile.replace(/\.md$/, "");
      r.errorAnnotation(
        refPath,
        `${skill}/references/${refFile} missing canary marker (expected \`<!-- ref:${slug}-v1 -->\` on line 1)`,
      );
      console.log(`  Fix: Prepend \`<!-- ref:${slug}-v1 -->\` to the first line of ${refFile}.`);
    }
  }
}

r.summary();
r.exitOnError("Skill checks passed");
