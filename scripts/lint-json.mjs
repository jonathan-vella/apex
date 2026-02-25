#!/usr/bin/env node
/**
 * JSON Syntax Validator
 *
 * Validates all JSON files in the workspace using a single Node.js process
 * instead of spawning a new process per file via shell find/exec.
 *
 * @example
 * node scripts/lint-json.mjs
 */

import fs from "node:fs";

const EXCLUDE_DIRS = ["node_modules", "infra", ".devcontainer", ".vscode"];

const files = fs.globSync("**/*.json", {
  exclude: (p) => EXCLUDE_DIRS.includes(p.name) && p.isDirectory(),
});

let failures = 0;

for (const file of files) {
  try {
    JSON.parse(fs.readFileSync(file, "utf8"));
    console.log(`✓ ${file}`);
  } catch (err) {
    console.error(`✗ ${file} - ${err.message}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n❌ ${failures} invalid JSON file(s)`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${files.length} JSON files valid`);
}
