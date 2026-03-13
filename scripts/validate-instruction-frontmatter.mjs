#!/usr/bin/env node
/**
 * Instruction File Frontmatter Validator
 *
 * Validates .instructions.md files have correct YAML frontmatter:
 * - Required fields: description, applyTo
 * - No unknown fields (catches stray name, title, etc.)
 *
 * @example
 * node scripts/validate-instruction-frontmatter.mjs
 */

import path from "node:path";
import { getInstructions } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const REQUIRED_FIELDS = ["description", "applyto"];
const REQUIRED_FIELDS_DISPLAY = ["description", "applyTo"];
const OPTIONAL_FIELDS = ["name"];
const ALLOWED_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];
const ALLOWED_FIELDS_DISPLAY = [...REQUIRED_FIELDS_DISPLAY, ...OPTIONAL_FIELDS];

const r = new Reporter("Instruction Frontmatter Validator");
r.header();

const instructions = getInstructions();

console.log(`Found ${instructions.size} instruction file(s)\n`);

for (const [fileName, instr] of instructions) {
  r.tick();
  const { path: filePath, frontmatter: fm } = instr;
  const relPath = path.relative(process.cwd(), filePath);

  if (!fm) {
    r.error(
      relPath,
      "Missing YAML frontmatter (requires description and applyTo)",
    );
    continue;
  }

  for (const field of REQUIRED_FIELDS) {
    if (!fm[field]) {
      const display = REQUIRED_FIELDS_DISPLAY[REQUIRED_FIELDS.indexOf(field)];
      r.error(relPath, `Missing required field: ${display}`);
    }
  }

  const unknownFields = Object.keys(fm).filter(
    (k) => !ALLOWED_FIELDS.includes(k),
  );
  if (unknownFields.length > 0) {
    r.error(
      relPath,
      `Unknown frontmatter fields: ${unknownFields.join(", ")} (allowed: ${ALLOWED_FIELDS_DISPLAY.join(", ")})`,
    );
  }
}

r.summary();
r.exitOnError(
  "All instruction files valid",
  "Instruction frontmatter validation FAILED",
);
