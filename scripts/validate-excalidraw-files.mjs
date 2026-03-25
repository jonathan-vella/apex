#!/usr/bin/env node
/**
 * Validate .excalidraw files for well-formed JSON structure.
 * Checks: valid JSON, correct top-level schema, non-empty elements, unique IDs.
 *
 * @example
 * node scripts/validate-excalidraw-files.mjs
 */

import fs from "node:fs";
import path from "node:path";

// Directories to scan for .excalidraw files
const SCAN_DIRS = ["agent-output", "assets"];

let errors = 0;
let warnings = 0;
let filesChecked = 0;

/**
 * Find all .excalidraw files recursively in a directory.
 */
function findExcalidrawFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findExcalidrawFiles(fullPath));
    } else if (
      entry.name.endsWith(".excalidraw") &&
      !entry.name.endsWith(".excalidraw.svg") &&
      !entry.name.endsWith(".excalidraw.png")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Validate an Excalidraw JSON file.
 */
function validateExcalidrawFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8").trim();

  if (!content) {
    console.error(`❌ ${filePath}: Empty file`);
    errors++;
    return;
  }

  // Parse JSON
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error(`❌ ${filePath}: Invalid JSON — ${e.message}`);
    errors++;
    return;
  }

  // Check top-level type
  if (data.type !== "excalidraw") {
    console.error(
      `❌ ${filePath}: Missing or incorrect "type" field (expected "excalidraw", got "${data.type}")`,
    );
    errors++;
    return;
  }

  // Check version
  if (data.version !== 2) {
    console.warn(
      `⚠️  ${filePath}: Unexpected version ${data.version} (expected 2)`,
    );
    warnings++;
  }

  // Check elements array
  if (!Array.isArray(data.elements)) {
    console.error(`❌ ${filePath}: Missing "elements" array`);
    errors++;
    return;
  }

  if (data.elements.length === 0) {
    console.warn(
      `⚠️  ${filePath}: Empty elements array (diagram has no content)`,
    );
    warnings++;
  }

  // Check for unique element IDs
  const ids = new Set();
  let duplicates = 0;
  for (const el of data.elements) {
    if (!el.id) {
      console.error(`❌ ${filePath}: Element missing "id" field`);
      errors++;
    } else if (ids.has(el.id)) {
      duplicates++;
    } else {
      ids.add(el.id);
    }
  }

  if (duplicates > 0) {
    console.error(
      `❌ ${filePath}: ${duplicates} duplicate element ID(s) found`,
    );
    errors++;
  }

  // Check element types are valid
  const validTypes = new Set([
    "rectangle",
    "ellipse",
    "diamond",
    "arrow",
    "line",
    "text",
    "image",
    "freedraw",
    "frame",
    "magicframe",
    "embeddable",
    "iframe",
  ]);

  for (const el of data.elements) {
    if (el.type && !validTypes.has(el.type)) {
      console.warn(
        `⚠️  ${filePath}: Unknown element type "${el.type}" (id: ${el.id})`,
      );
      warnings++;
    }
  }

  filesChecked++;
  console.log(
    `✅ ${filePath}: Valid (${data.elements.length} elements, ${ids.size} unique IDs)`,
  );
}

// Main
const allFiles = [];
for (const dir of SCAN_DIRS) {
  allFiles.push(...findExcalidrawFiles(dir));
}

if (allFiles.length === 0) {
  console.log("ℹ️  No .excalidraw files found to validate");
  process.exit(0);
}

for (const file of allFiles) {
  validateExcalidrawFile(file);
}

console.log(
  `\n📊 Checked: ${filesChecked} | Errors: ${errors} | Warnings: ${warnings}`,
);

if (errors > 0) {
  process.exit(1);
}
