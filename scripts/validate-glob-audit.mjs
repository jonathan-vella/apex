#!/usr/bin/env node
/**
 * Glob Audit Validator
 *
 * Warns when instruction files with `applyTo: "**"` (wildcard glob)
 * exceed 50 lines. Broad globs load into every file context, so large
 * files with wildcards waste tokens on irrelevant file types.
 *
 * @example
 * node scripts/validate-glob-audit.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { getInstructions } from "./_lib/workspace-index.mjs";

const MAX_LINES_WITH_WILDCARD = 50;

let errors = 0;
let warnings = 0;
let checked = 0;

console.log("\n🔍 Glob Audit Validator\n");

const instructions = getInstructions();

for (const [file, instr] of instructions) {
  checked++;
  const { content, frontmatter: fm } = instr;

  if (!fm || !fm.applyTo) continue;

  const applyTo = Array.isArray(fm.applyTo)
    ? fm.applyTo.join(", ")
    : String(fm.applyTo);

  // Check for broad wildcards: "**" without extension filter
  const isBroadWildcard =
    applyTo === "**" || applyTo === '"**"' || applyTo.trim() === "**";

  if (!isBroadWildcard) continue;

  const lineCount = content.split("\n").length;

  if (lineCount > MAX_LINES_WITH_WILDCARD) {
    console.log(
      `::warning file=${instr.path}::${file} has applyTo: "**" and is ${lineCount} lines (>${MAX_LINES_WITH_WILDCARD})`,
    );
    console.log(
      `  Fix: Narrow the glob to specific extensions (e.g., "**/*.{js,ts,py,bicep,tf}")`,
    );
    console.log(
      `  or split content into a reference file to reduce auto-loaded size.`,
    );
    warnings++;
  }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`Checked: ${checked} | Warnings: ${warnings} | Errors: ${errors}`);

if (errors > 0) {
  console.log(`\n❌ ${errors} glob audit violation(s)`);
  process.exit(1);
}
console.log(`\n✅ Glob audit check passed`);
