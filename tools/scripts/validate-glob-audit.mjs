#!/usr/bin/env node
/**
 * Glob Audit Validator
 *
 * Flags instruction files whose `applyTo` globs are wastefully broad.
 *
 * Warnings are emitted when:
 *   - `applyTo: "**"` appears at any size (matches every file in repo).
 *   - `applyTo: "**\/*.md"` (or equivalent) is combined with a file larger
 *     than MAX_LINES_WITH_BROAD_MD lines.
 *   - `applyTo: "**"` with a body >MAX_LINES_WITH_WILDCARD lines.
 *
 * @example
 * node tools/scripts/validate-glob-audit.mjs
 */

import { getInstructions } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { MAX_LINES_WITH_WILDCARD } from "./_lib/paths.mjs";

const MAX_LINES_WITH_BROAD_MD = 200;
const BROAD_MD_GLOBS = new Set([
  "**/*.md",
  '"**/*.md"',
  "**/*.{md,mdx}",
  '"**/*.{md,mdx}"',
]);

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
  const trimmed = applyTo.trim();
  const lineCount = content.split("\n").length;

  const isFullWildcard = trimmed === "**" || trimmed === '"**"';
  const isBroadMarkdown = BROAD_MD_GLOBS.has(trimmed);

  if (isFullWildcard) {
    r.warnAnnotation(
      instr.path,
      `${file} has applyTo: "**" (matches every file) — narrow to specific extensions`,
    );
    console.log(
      '  Fix: Narrow the glob to specific extensions (e.g., "**/*.{js,ts,py,bicep,tf}")',
    );
    if (lineCount > MAX_LINES_WITH_WILDCARD) {
      console.log(
        `  Note: also ${lineCount} lines (>${MAX_LINES_WITH_WILDCARD}) — impact amplified.`,
      );
    }
    continue;
  }

  if (isBroadMarkdown && lineCount > MAX_LINES_WITH_BROAD_MD) {
    r.warnAnnotation(
      instr.path,
      `${file} applies to all markdown (${trimmed}) and is ${lineCount} lines (>${MAX_LINES_WITH_BROAD_MD})`,
    );
    console.log(
      "  Fix: Scope to specific folders (site/src/content/docs/**, .github/**, root *.md)",
    );
  }
}

r.summary();
r.exitOnError("Glob audit check passed");
