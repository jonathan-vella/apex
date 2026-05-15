#!/usr/bin/env node
/**
 * Region Canonical Validator
 *
 * Asserts that the Default Regions table in
 * `.github/skills/azure-defaults/SKILL.md` matches the canonical
 * declaration in `.github/copilot-instructions.md` (the
 * `## Azure Defaults (canonical)` section).
 *
 * This prevents silent drift between the two files. The canonical
 * source is copilot-instructions.md; the skill restates the table
 * for IaC-output convenience and must stay byte-equivalent.
 *
 * @example
 * node tools/scripts/validate-region-canonical.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const CANONICAL_PATH = path.join(REPO_ROOT, ".github/copilot-instructions.md");
const MIRROR_PATH = path.join(REPO_ROOT, ".github/skills/azure-defaults/SKILL.md");

const r = new Reporter("Region Canonical Validator");
r.header();

/**
 * Extract the `### Default Regions` table from a markdown body.
 * Returns the table rows as an array of trimmed lines, or null if not found.
 */
function extractRegionsTable(filePath) {
  if (!fs.existsSync(filePath)) {
    r.error(filePath, "file not found");
    return null;
  }
  const body = fs.readFileSync(filePath, "utf-8");
  const lines = body.split("\n");

  let i = lines.findIndex((line) => /^###\s+Default Regions\s*$/.test(line));
  if (i === -1) {
    r.error(filePath, "missing `### Default Regions` heading");
    return null;
  }

  // Skip blank line(s) after heading
  i += 1;
  while (i < lines.length && lines[i].trim() === "") i += 1;

  // Collect contiguous table rows (lines starting with `|`)
  const table = [];
  while (i < lines.length && lines[i].trim().startsWith("|")) {
    table.push(lines[i].trim());
    i += 1;
  }

  if (table.length < 3) {
    r.error(filePath, `expected at least 3 table rows (header + sep + 1 data), got ${table.length}`);
    return null;
  }

  return table;
}

r.tick();
const canonical = extractRegionsTable(CANONICAL_PATH);
r.tick();
const mirror = extractRegionsTable(MIRROR_PATH);

if (canonical && mirror) {
  // Compare row-by-row (each cell stripped of leading/trailing whitespace inside pipes)
  const norm = (row) =>
    row
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell, idx, arr) => idx !== 0 && idx !== arr.length - 1)
      .join(" | ");

  const canonicalNorm = canonical.map(norm);
  const mirrorNorm = mirror.map(norm);

  if (canonicalNorm.length !== mirrorNorm.length) {
    r.error(
      "regions-table",
      `row-count mismatch: copilot-instructions.md has ${canonicalNorm.length}, azure-defaults/SKILL.md has ${mirrorNorm.length}`,
    );
  } else {
    let allMatch = true;
    for (let idx = 0; idx < canonicalNorm.length; idx += 1) {
      if (canonicalNorm[idx] !== mirrorNorm[idx]) {
        r.error(
          "regions-table",
          `row ${idx + 1} differs:\n    canonical: ${canonicalNorm[idx]}\n    mirror:    ${mirrorNorm[idx]}`,
        );
        allMatch = false;
      }
    }
    if (allMatch) {
      r.ok("regions-table", `${canonicalNorm.length} rows match between canonical and mirror`);
    }
  }
}

r.summary();
r.exitOnError("Region canonical check passed");
