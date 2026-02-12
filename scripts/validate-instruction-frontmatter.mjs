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

const INSTRUCTIONS_DIRS = [".github/instructions"];
const ALLOWED_FIELDS = ["description", "applyTo"];

let errors = 0;

function collectInstructionFiles(dirs) {
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
      const full = path.join(entry.parentPath || entry.path, entry.name);
      if (entry.isFile() && entry.name.endsWith(".instructions.md")) {
        files.push(full);
      }
    }
  }
  return files;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fields = {};
  for (const line of match[1].split("\n")) {
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kvMatch) {
      fields[kvMatch[1]] = kvMatch[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return fields;
}

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const relPath = path.relative(process.cwd(), filePath);
  const fm = parseFrontmatter(content);

  if (!fm) {
    console.log(
      `::error file=${relPath},line=1::Missing YAML frontmatter (requires description and applyTo)`,
    );
    errors++;
    return;
  }

  for (const field of ALLOWED_FIELDS) {
    if (!fm[field]) {
      console.log(
        `::error file=${relPath},line=1::Missing required frontmatter field: ${field}`,
      );
      errors++;
    }
  }

  const unknownFields = Object.keys(fm).filter(
    (k) => !ALLOWED_FIELDS.includes(k),
  );
  if (unknownFields.length > 0) {
    console.log(
      `::error file=${relPath},line=1::Unknown frontmatter fields: ${unknownFields.join(", ")} (allowed: ${ALLOWED_FIELDS.join(", ")})`,
    );
    errors++;
  }
}

console.log("🔍 Instruction File Frontmatter Validator\n");

const files = collectInstructionFiles(INSTRUCTIONS_DIRS);

console.log(`Found ${files.length} instruction file(s)\n`);

for (const file of files) {
  validateFile(file);
}

console.log(`\n${"=".repeat(50)}`);
if (errors > 0) {
  console.log(`❌ ${errors} error(s)`);
  process.exit(1);
} else {
  console.log(`✅ All instruction files valid`);
}
