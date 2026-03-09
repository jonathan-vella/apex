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

import { getAgents } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { MAX_BODY_LINES } from "./_lib/paths.mjs";

const r = new Reporter("Agent Body Size Validator");
r.header();

const agents = getAgents();

for (const [file, agent] of agents) {
  r.tick();
  const { path: filePath, content } = agent;

  const fmEnd = content.indexOf("\n---", content.indexOf("---") + 3);
  if (fmEnd === -1) {
    r.warn(file, "no frontmatter found, skipping");
    continue;
  }

  const body = content.substring(fmEnd + 4);
  const bodyLines = body.split("\n").length;
  const totalLines = content.split("\n").length;

  if (bodyLines > MAX_BODY_LINES) {
    r.errorAnnotation(filePath, `${file} body is ${bodyLines} lines (>${MAX_BODY_LINES}; total: ${totalLines})`);
    console.log(`  Fix: Extract verbose sections to skill references/ or scripts/.`);
  }
}

r.summary();
r.exitOnError("Agent body size check passed");
