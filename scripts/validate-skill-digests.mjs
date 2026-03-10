#!/usr/bin/env node
/**
 * Skill Digest Validator
 *
 * Validates SKILL.digest.md and SKILL.minimal.md files:
 * - Auto-generated header present
 * - Digest H2 headings are a subset of source SKILL.md headings
 * - Digest line count is <60% of source
 * - Minimal line count is <40% of digest (if minimal exists)
 *
 * @example
 * node scripts/validate-skill-digests.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";
import { SKILLS_DIR } from "./_lib/paths.mjs";

const r = new Reporter("Skill Digest Validator");
const AUTO_GEN_HEADER =
  "<!-- digest:auto-generated from SKILL.md — do not edit manually -->";

function extractH2s(content) {
  return content
    .split("\n")
    .filter((line) => /^## /.test(line))
    .map((line) => line.replace(/^## /, "").trim());
}

function validateDigest(skillDir, skillName) {
  const sourcePath = path.join(skillDir, "SKILL.md");
  const digestPath = path.join(skillDir, "SKILL.digest.md");
  const minimalPath = path.join(skillDir, "SKILL.minimal.md");

  if (!fs.existsSync(sourcePath)) return;
  if (!fs.existsSync(digestPath)) {
    r.warn(skillName, "No SKILL.digest.md found");
    return;
  }

  r.tick();
  const sourceContent = fs.readFileSync(sourcePath, "utf-8");
  const digestContent = fs.readFileSync(digestPath, "utf-8");
  const sourceLines = sourceContent.split("\n").length;
  const digestLines = digestContent.split("\n").length;

  if (!digestContent.startsWith(AUTO_GEN_HEADER)) {
    r.error(skillName, "SKILL.digest.md missing auto-generated header");
  }

  const digestRatio = digestLines / sourceLines;
  if (digestRatio > 0.6) {
    r.warn(
      skillName,
      `Digest is ${Math.round(digestRatio * 100)}% of source (target: <60%)`,
    );
  }

  const sourceH2s = extractH2s(sourceContent);
  const digestH2s = extractH2s(digestContent);
  for (const h2 of digestH2s) {
    const normalized = h2.replace(/\s*\(.*\)$/, "").trim();
    const matchesSource = sourceH2s.some(
      (sh2) =>
        sh2.includes(normalized) ||
        normalized.includes(sh2) ||
        sh2.replace(/\s*\(.*\)$/, "").trim() === normalized,
    );
    if (!matchesSource) {
      r.warn(skillName, `Digest H2 "${h2}" not found in source SKILL.md`);
    }
  }

  r.ok(
    skillName,
    `digest: ${digestLines} lines (${Math.round(digestRatio * 100)}% of source)`,
  );

  if (fs.existsSync(minimalPath)) {
    const minimalContent = fs.readFileSync(minimalPath, "utf-8");
    const minimalLines = minimalContent.split("\n").length;

    if (!minimalContent.startsWith(AUTO_GEN_HEADER)) {
      r.error(skillName, "SKILL.minimal.md missing auto-generated header");
    }

    const minimalRatio = minimalLines / digestLines;
    if (minimalRatio > 0.5) {
      r.warn(
        skillName,
        `Minimal is ${Math.round(minimalRatio * 100)}% of digest (target: <50%)`,
      );
    }

    r.ok(
      skillName,
      `minimal: ${minimalLines} lines (${Math.round(minimalRatio * 100)}% of digest)`,
    );
  }
}

console.log("\n📋 Validating skill digests...\n");

const skillDirs = fs
  .readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const skillName of skillDirs) {
  validateDigest(path.join(SKILLS_DIR, skillName), skillName);
}

console.log(`\n📊 Results: ${r.errors} error(s), ${r.warnings} warning(s)\n`);

if (r.errors > 0) {
  console.error("❌ Skill digest validation failed\n");
  process.exit(1);
}

console.log("✅ Skill digest validation passed\n");
