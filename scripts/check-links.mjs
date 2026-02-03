#!/usr/bin/env node
/**
 * Cross-platform markdown link checker wrapper
 * Uses Node.js instead of Unix find/xargs for Windows compatibility
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const docsDir = path.resolve(process.cwd(), "docs");
const files = [];

/**
 * Recursively find markdown files, excluding _superseded directory
 */
function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip _superseded directory
    if (entry.name === "_superseded") continue;

    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
}

walkDir(docsDir);

if (files.length === 0) {
  console.log("ℹ️  No markdown files found in docs/");
  process.exit(0);
}

console.log(`🔗 Checking links in ${files.length} markdown file(s)...`);

let hasErrors = false;

for (const file of files) {
  try {
    execSync(
      `npx markdown-link-check "${file}" --config .markdown-link-check.json --quiet`,
      { stdio: "inherit" },
    );
  } catch {
    hasErrors = true;
  }
}

process.exit(hasErrors ? 1 : 0);
