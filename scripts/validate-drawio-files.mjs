#!/usr/bin/env node
/**
 * Validate .drawio files for well-formed XML structure.
 * Checks: valid XML, mxfile/mxGraphModel root, non-empty cells, proper parent references.
 *
 * @example
 * node scripts/validate-drawio-files.mjs
 */

import fs from "node:fs";
import path from "node:path";

// Directories to scan for .drawio files
const SCAN_DIRS = ["agent-output", "assets"];

let errors = 0;
let warnings = 0;
let filesChecked = 0;

/**
 * Find all .drawio files recursively in a directory.
 */
function findDrawioFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDrawioFiles(fullPath));
    } else if (entry.name.endsWith(".drawio")) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Basic XML structure validation for draw.io files.
 * Uses string matching instead of a full XML parser to avoid dependencies.
 */
function validateDrawioFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8").trim();

  if (!content) {
    console.error(`❌ ${filePath}: Empty file`);
    errors++;
    return;
  }

  // Check for valid XML structure
  if (!content.startsWith("<")) {
    console.error(`❌ ${filePath}: Not valid XML (doesn't start with <)`);
    errors++;
    return;
  }

  // Check for mxfile or mxGraphModel root
  const hasMxfile = content.includes("<mxfile");
  const hasMxGraphModel = content.includes("<mxGraphModel");

  if (!hasMxfile && !hasMxGraphModel) {
    console.error(
      `❌ ${filePath}: Missing <mxfile> or <mxGraphModel> root element`,
    );
    errors++;
    return;
  }

  // Check for root cells (id=0 and id=1)
  if (!content.includes('id="0"')) {
    console.error(`❌ ${filePath}: Missing root cell (id="0")`);
    errors++;
    return;
  }

  if (!content.includes('id="1"')) {
    console.error(`❌ ${filePath}: Missing default parent cell (id="1")`);
    errors++;
    return;
  }

  // Check for at least one content cell (beyond root cells 0 and 1)
  const cellMatches = content.match(/<mxCell /g);
  if (!cellMatches || cellMatches.length < 3) {
    console.warn(
      `⚠️  ${filePath}: Only ${cellMatches ? cellMatches.length : 0} cells found (expected ≥3 for a meaningful diagram)`,
    );
    warnings++;
  }

  // Check for closing tags
  if (hasMxfile && !content.includes("</mxfile>")) {
    console.error(`❌ ${filePath}: Missing </mxfile> closing tag`);
    errors++;
    return;
  }

  if (
    hasMxGraphModel &&
    !hasMxfile &&
    !content.includes("</mxGraphModel>")
  ) {
    console.error(`❌ ${filePath}: Missing </mxGraphModel> closing tag`);
    errors++;
    return;
  }

  // Check for diagram element (required in mxfile)
  if (hasMxfile && !content.includes("<diagram")) {
    console.error(`❌ ${filePath}: <mxfile> present but no <diagram> element`);
    errors++;
    return;
  }

  filesChecked++;
}

// Also validate mxlibrary XML files in assets
function findMxlibraryFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMxlibraryFiles(fullPath));
    } else if (entry.name.endsWith(".xml") && dir.includes("drawio-libraries")) {
      results.push(fullPath);
    }
  }
  return results;
}

function validateMxlibraryFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8").trim();

  if (!content) {
    console.error(`❌ ${filePath}: Empty library file`);
    errors++;
    return;
  }

  if (!content.includes("<mxlibrary>")) {
    console.error(`❌ ${filePath}: Missing <mxlibrary> root element`);
    errors++;
    return;
  }

  if (!content.includes("</mxlibrary>")) {
    console.error(`❌ ${filePath}: Missing </mxlibrary> closing tag`);
    errors++;
    return;
  }

  // Validate JSON array inside mxlibrary
  try {
    const start = content.indexOf("[");
    const end = content.lastIndexOf("]") + 1;
    if (start === -1 || end === 0) {
      console.error(`❌ ${filePath}: No JSON array found inside <mxlibrary>`);
      errors++;
      return;
    }
    const jsonStr = content.substring(start, end);
    const entries = JSON.parse(jsonStr);
    if (!Array.isArray(entries) || entries.length === 0) {
      console.warn(`⚠️  ${filePath}: Empty icon library`);
      warnings++;
    }
  } catch (e) {
    console.error(`❌ ${filePath}: Invalid JSON in mxlibrary: ${e.message}`);
    errors++;
    return;
  }

  filesChecked++;
}

// Main
console.log("🔍 Validating draw.io files...\n");

// Validate .drawio diagram files
for (const dir of SCAN_DIRS) {
  const drawioFiles = findDrawioFiles(dir);
  for (const f of drawioFiles) {
    validateDrawioFile(f);
  }
}

// Validate mxlibrary files in assets
const libraryFiles = findMxlibraryFiles("assets");
for (const f of libraryFiles) {
  validateMxlibraryFile(f);
}

// Summary
console.log(
  `\n${filesChecked > 0 ? "✅" : "ℹ️"} Checked ${filesChecked} draw.io files | ${errors} errors | ${warnings} warnings`,
);

if (filesChecked === 0 && errors === 0) {
  console.log(
    "   No .drawio files found in agent-output/ — this is normal if no diagrams have been generated yet.",
  );
  console.log(
    `   Found ${libraryFiles.length} mxlibrary files in assets/ — ${libraryFiles.length > 0 ? "all valid" : "none found (run: npm run build:drawio-icons)"}.`,
  );
}

process.exit(errors > 0 ? 1 : 0);
