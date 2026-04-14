#!/usr/bin/env node
/**
 * Validate .excalidraw files for well-formed JSON structure.
 * Checks: valid JSON, correct top-level schema, non-empty elements,
 * unique IDs, and required embedded image payloads for demo architecture files.
 *
 * @example
 * node scripts/validate-excalidraw-files.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const _r = new Reporter("Excalidraw File Validation");

// Directories to scan for .excalidraw files
const SCAN_DIRS = [
  "agent-output",
  "assets",
  ".github/skills/excalidraw/references",
  "site/public/demo",
];

const ICON_REQUIRED_PATTERN =
  /(?:^|\/)(03-des-diagram|04-dependency-diagram|04-runtime-diagram|07-ab-diagram|showcase-[^/]+)\.excalidraw$/;

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

  const files = data.files && typeof data.files === "object" ? data.files : {};
  const imageElements = data.elements.filter(
    (element) => element.type === "image",
  );

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

  if (imageElements.length > 0 && Object.keys(files).length === 0) {
    console.error(
      `❌ ${filePath}: Contains image elements but top-level "files" is empty`,
    );
    errors++;
  }

  let missingFileRefs = 0;
  for (const imageElement of imageElements) {
    if (!imageElement.fileId || !files[imageElement.fileId]) {
      missingFileRefs++;
    }
  }

  if (missingFileRefs > 0) {
    console.error(
      `❌ ${filePath}: ${missingFileRefs} image element(s) reference missing file payloads`,
    );
    errors++;
  }

  const normalizedPath = filePath.replaceAll("\\", "/");
  if (
    ICON_REQUIRED_PATTERN.test(normalizedPath) &&
    imageElements.length === 0
  ) {
    console.error(
      `❌ ${filePath}: Architecture deliverable is missing embedded Azure/Fabric icons`,
    );
    errors++;
  }

  if (
    ICON_REQUIRED_PATTERN.test(normalizedPath) &&
    Object.keys(files).length === 0
  ) {
    console.error(
      `❌ ${filePath}: Architecture deliverable must include a non-empty top-level "files" map`,
    );
    errors++;
  }

  filesChecked++;
  console.log(
    `✅ ${filePath}: Valid (${data.elements.length} elements, ${ids.size} unique IDs, ${imageElements.length} images)`,
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

// Sync local counters to Reporter for consistent summary output
_r.errors = errors;
_r.warnings = warnings;
_r.checked = filesChecked;
_r.summary("Excalidraw validation");
_r.exitOnError(
  "Excalidraw validation passed",
  `${errors} excalidraw validation error(s) found`,
);
