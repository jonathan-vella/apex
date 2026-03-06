#!/usr/bin/env node
/**
 * Agent Body Size Validator
 *
 * Enforces context optimization rule: agent body (lines after closing
 * `---` frontmatter delimiter) should not exceed 350 lines. Large
 * agent bodies should extract content to skill references or scripts.
 *
 * @example
 * node scripts/validate-agent-body-size.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { getAgents } from "./_lib/workspace-index.mjs";

const MAX_BODY_LINES = 350;

let errors = 0;
let warnings = 0;
let checked = 0;

console.log("\n🔍 Agent Body Size Validator\n");

const agents = getAgents();

for (const [file, agent] of agents) {
  checked++;
  const { path: filePath, content } = agent;

  // Find end of frontmatter (second ---)
  const fmEnd = content.indexOf("\n---", content.indexOf("---") + 3);
  if (fmEnd === -1) {
    console.log(`  ⚠️  ${file}: no frontmatter found, skipping`);
    warnings++;
    continue;
  }

  const body = content.substring(fmEnd + 4); // skip "\n---"
  const bodyLines = body.split("\n").length;
  const totalLines = content.split("\n").length;

  if (bodyLines > MAX_BODY_LINES) {
    console.log(
      `::error file=${filePath}::${file} body is ${bodyLines} lines (>${MAX_BODY_LINES}; total: ${totalLines})`,
    );
    console.log(
      `  Fix: Extract verbose sections to skill references/ or scripts/.`,
    );
    console.log(
      `  Convert DO/DON'T lists to tables; compact adversarial review sections to pointers.`,
    );
    errors++;
  }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`Checked: ${checked} | Warnings: ${warnings} | Errors: ${errors}`);

if (errors > 0) {
  console.log(`\n❌ ${errors} agent body size violation(s)`);
  process.exit(1);
}
console.log(`\n✅ Agent body size check passed`);
