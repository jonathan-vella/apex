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

import fs from "node:fs";
import path from "node:path";
import { getInstructions } from "./_lib/workspace-index.mjs";

// Shared parser lowercases keys; match against lowercase allowed fields
const ALLOWED_FIELDS = ["description", "applyto"];
const ALLOWED_FIELDS_DISPLAY = ["description", "applyTo"];

let errors = 0;

function validateFile(fileName, instr) {
  const { path: filePath, content, frontmatter: fm } = instr;
  const relPath = path.relative(process.cwd(), filePath);

  if (!fm) {
    console.log(
      `::error file=${relPath},line=1::Missing YAML frontmatter (requires description and applyTo)`,
    );
    errors++;
    return;
  }

  for (const field of ALLOWED_FIELDS) {
    if (!fm[field]) {
      const display = ALLOWED_FIELDS_DISPLAY[ALLOWED_FIELDS.indexOf(field)];
      console.log(
        `::error file=${relPath},line=1::Missing required frontmatter field: ${display}`,
      );
      errors++;
    }
  }

  const unknownFields = Object.keys(fm).filter(
    (k) => !ALLOWED_FIELDS.includes(k),
  );
  if (unknownFields.length > 0) {
    console.log(
      `::error file=${relPath},line=1::Unknown frontmatter fields: ${unknownFields.join(", ")} (allowed: ${ALLOWED_FIELDS_DISPLAY.join(", ")})`,
    );
    errors++;
  }
}

console.log("🔍 Instruction File Frontmatter Validator\n");

const instructions = getInstructions();

console.log(`Found ${instructions.size} instruction file(s)\n`);

for (const [fileName, instr] of instructions) {
  validateFile(fileName, instr);
}

console.log(`\n${"=".repeat(50)}`);
if (errors > 0) {
  console.log(`❌ ${errors} error(s)`);
  process.exit(1);
} else {
  console.log(`✅ All instruction files valid`);
}
