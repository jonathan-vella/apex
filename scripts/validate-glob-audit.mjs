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

import { getInstructions } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { MAX_LINES_WITH_WILDCARD } from "./_lib/paths.mjs";

const r = new Reporter("Glob Audit Validator");
r.header();

const instructions = getInstructions();

for (const [file, instr] of instructions) {
  r.tick();
  const { content, frontmatter: fm } = instr;

  if (!fm || !fm.applyTo) continue;

  const applyTo = Array.isArray(fm.applyTo)
    ? fm.applyTo.join(", ")
    : String(fm.applyTo);

  const isBroadWildcard =
    applyTo === "**" || applyTo === '"**"' || applyTo.trim() === "**";

  if (!isBroadWildcard) continue;

  const lineCount = content.split("\n").length;

  if (lineCount > MAX_LINES_WITH_WILDCARD) {
    r.warnAnnotation(instr.path, `${file} has applyTo: "**" and is ${lineCount} lines (>${MAX_LINES_WITH_WILDCARD})`);
    console.log(`  Fix: Narrow the glob to specific extensions (e.g., "**/*.{js,ts,py,bicep,tf}")`);
  }
}

r.summary();
r.exitOnError("Glob audit check passed");
