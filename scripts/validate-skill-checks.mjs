#!/usr/bin/env node
/**
 * Skill Checks Validator
 *
 * Combined skill validation in a single pass over getSkills():
 * 1. Size: SKILL.md over MAX_SKILL_LINES_WITHOUT_REFS must have references/
 * 2. Digests: SKILL.digest.md and SKILL.minimal.md quality checks
 *
 * Replaces validate-skill-size.mjs and validate-skill-digests.mjs.
 *
 * @example
 * node scripts/validate-skill-checks.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { getSkills } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { MAX_SKILL_LINES_WITHOUT_REFS } from "./_lib/paths.mjs";
import { extractH2Headings } from "./_lib/h2-parser.mjs";

const r = new Reporter("Skill Checks Validator");
r.header();

// Pre-existing oversized skills (tracked for future remediation).
const KNOWN_OVERSIZED = new Set([
  "azure-adr",
  "github-operations",
  "make-skill-template",
  "azure-kusto",
  "azure-cost-optimization",
  "azure-quotas",
]);

const AUTO_GEN_HEADER =
  "<!-- digest:auto-generated from SKILL.md — do not edit manually -->";

const skills = getSkills();

for (const [skill, info] of skills) {
  if (!info.content) continue;
  r.tick();

  const lineCount = info.content.split("\n").length;
  const hasRefs = info.hasRefs;
  const skillPath = path.join(info.dir, "SKILL.md");
  const refsDir = path.join(info.dir, "references");

  // --- Check 1: Skill size ---

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
      console.log(
        `  Fix: Create ${refsDir}/ and move detailed content to reference files.`,
      );
    }
  } else if (lineCount > MAX_SKILL_LINES_WITHOUT_REFS && hasRefs) {
    r.warn(
      skill,
      `SKILL.md is ${lineCount} lines (>${MAX_SKILL_LINES_WITHOUT_REFS}) but has ${info.refFiles.length} reference files — consider trimming further`,
    );
  }

  // --- Check 2: Digest quality ---

  const digestPath = path.join(info.dir, "SKILL.digest.md");
  const minimalPath = path.join(info.dir, "SKILL.minimal.md");

  if (!fs.existsSync(digestPath)) continue;

  const digestContent = fs.readFileSync(digestPath, "utf-8");
  const digestLines = digestContent.split("\n").length;

  if (!digestContent.startsWith(AUTO_GEN_HEADER)) {
    r.error(skill, "SKILL.digest.md missing auto-generated header");
  }

  const digestRatio = digestLines / lineCount;
  if (digestRatio > 0.6) {
    r.warn(
      skill,
      `Digest is ${Math.round(digestRatio * 100)}% of source (target: <60%)`,
    );
  }

  const sourceH2s = extractH2Headings(info.content);
  const digestH2s = extractH2Headings(digestContent);
  for (const h2 of digestH2s) {
    const normalized = h2.replace(/\s*\(.*\)$/, "").trim();
    const matchesSource = sourceH2s.some(
      (sh2) =>
        sh2.includes(normalized) ||
        normalized.includes(sh2) ||
        sh2.replace(/\s*\(.*\)$/, "").trim() === normalized,
    );
    if (!matchesSource) {
      r.warn(skill, `Digest H2 "${h2}" not found in source SKILL.md`);
    }
  }

  r.ok(
    skill,
    `digest: ${digestLines} lines (${Math.round(digestRatio * 100)}% of source)`,
  );

  if (fs.existsSync(minimalPath)) {
    const minimalContent = fs.readFileSync(minimalPath, "utf-8");
    const minimalLines = minimalContent.split("\n").length;

    if (!minimalContent.startsWith(AUTO_GEN_HEADER)) {
      r.error(skill, "SKILL.minimal.md missing auto-generated header");
    }

    const minimalRatio = minimalLines / digestLines;
    if (minimalRatio > 0.5) {
      r.warn(
        skill,
        `Minimal is ${Math.round(minimalRatio * 100)}% of digest (target: <50%)`,
      );
    }

    r.ok(
      skill,
      `minimal: ${minimalLines} lines (${Math.round(minimalRatio * 100)}% of digest)`,
    );
  }
}

r.summary();
r.exitOnError("Skill checks passed");
