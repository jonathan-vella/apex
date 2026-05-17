#!/usr/bin/env node

// report-agent-body-sizes.mjs
//
// Advisory reporter — prints a table of `agent_id | body_lines | over_350`
// for every main agent under .github/agents/ (excluding _subagents/).
//
// This is intentionally NOT wired into `validate:_node`. The 350-line
// guidance in .github/instructions/context-optimization.instructions.md
// is a project preference without external grounding. The only enforced
// body-size gate remains the 600-line `MAX_BODY_LINES` hard fail in
// tools/scripts/validate-agents.mjs (via _lib/paths.mjs).
//
// Used by:
//   - Plan 01 Phase 4 PR description (before/after body-size delta)
//   - tmp/phase4-baseline.json generation (--json mode)
//   - apex-recall "finding" capture
//
// Flags:
//   --json   emit machine-readable JSON instead of a text table
//   --target=<path/to/targets.json>  optional file mapping agent_id →
//            hypothesis_target_body_lines (added to JSON output)
//
// Exit code is always 0 — this reporter never fails CI.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { getBody } from "./_lib/parse-frontmatter.mjs";
import { AGENTS_DIR, MAX_BODY_LINES } from "./_lib/paths.mjs";

const GUIDANCE_LINES = 350;

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const targetFlag = args.find((a) => a.startsWith("--target="));
const targetPath = targetFlag ? targetFlag.slice("--target=".length) : null;

let targets = {};
if (targetPath && existsSync(targetPath)) {
  try {
    targets = JSON.parse(readFileSync(targetPath, "utf8"));
  } catch {
    // ignore malformed target file — treat as missing
    targets = {};
  }
}

// Enumerate only top-level *.agent.md files in .github/agents/ (skip _subagents/).
const entries = readdirSync(AGENTS_DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".agent.md"))
  .map((e) => e.name)
  .sort();

const rows = entries.map((name) => {
  const filePath = join(AGENTS_DIR, name);
  const content = readFileSync(filePath, "utf8");
  const total_lines = content.split("\n").length;
  const body_lines = getBody(content).split("\n").length;
  const agent_id = name.replace(/\.agent\.md$/, "");
  return {
    agent_id,
    path: filePath,
    total_lines,
    body_lines,
    over_350: body_lines > GUIDANCE_LINES,
    over_600: body_lines > MAX_BODY_LINES,
    hypothesis_target_body_lines: targets[agent_id] ?? null,
  };
});

if (jsonMode) {
  // Aggregate stats for downstream consumers.
  const aggregate = {
    agent_count: rows.length,
    total_body_lines: rows.reduce((s, r) => s + r.body_lines, 0),
    over_350_count: rows.filter((r) => r.over_350).length,
    over_600_count: rows.filter((r) => r.over_600).length,
    guidance_line_threshold: GUIDANCE_LINES,
    hard_max_body_lines: MAX_BODY_LINES,
  };
  process.stdout.write(`${JSON.stringify({ aggregate, agents: rows }, null, 2)}\n`);
} else {
  // Text table — sorted by body_lines descending for at-a-glance scanning.
  const sorted = [...rows].sort((a, b) => b.body_lines - a.body_lines);
  const idWidth = Math.max(...sorted.map((r) => r.agent_id.length), "agent_id".length);
  const pad = (s, n) => String(s).padEnd(n, " ");
  const lpad = (s, n) => String(s).padStart(n, " ");

  process.stdout.write(`${pad("agent_id", idWidth)}  ${lpad("body", 4)}  ${lpad(">350", 5)}  ${lpad(">600", 5)}\n`);
  process.stdout.write(`${"-".repeat(idWidth)}  ${"-".repeat(4)}  ${"-".repeat(5)}  ${"-".repeat(5)}\n`);
  for (const r of sorted) {
    process.stdout.write(
      `${pad(r.agent_id, idWidth)}  ${lpad(r.body_lines, 4)}  ${lpad(r.over_350 ? "YES" : "no", 5)}  ${lpad(r.over_600 ? "YES" : "no", 5)}\n`,
    );
  }
  process.stdout.write(
    `\n${sorted.length} agents · ${sorted.filter((r) => r.over_350).length} over 350 (guidance) · ${sorted.filter((r) => r.over_600).length} over 600 (hard gate: ${MAX_BODY_LINES})\n`,
  );
}
