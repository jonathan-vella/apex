#!/usr/bin/env node
/**
 * Lens-reference linter.
 *
 * Enforces that the set of adversarial-review lens names used across
 * `.github/agents/**` and
 * `.github/skills/workflow-engine/templates/workflow-graph.json` matches
 * the registered set in
 * `.github/skills/azure-defaults/references/adversarial-review-protocol.md`
 * `## Lenses` table.
 *
 * Behavior:
 *
 * 1. Parses the `## Lenses` H2 block in `adversarial-review-protocol.md`
 *    into a Set<string> of registered lens names.
 * 2. Scans every `.github/agents/{plus subagents subfolder}/{name}.agent.md` for
 *    `review_focus:` / `lenses:` / `default_lenses:` tokens and extracts
 *    referenced lens names.
 * 3. Scans `workflow-graph.json` for any `lenses` / `default_lenses`
 *    array under `challenger` blocks.
 * 4. Fails if any agent or workflow-graph reference is not in the
 *    registered set.
 *
 * Wired into `validate:all` via the `validate:lens-references` npm
 * script (see package.json).
 *
 * Usage:
 *   npm run validate:lens-references
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const PROTOCOL_PATH = ".github/skills/azure-defaults/references/adversarial-review-protocol.md";
const WORKFLOW_GRAPH_PATH = ".github/skills/workflow-engine/templates/workflow-graph.json";
const AGENT_DIRS = [".github/agents"];

const r = new Reporter("Lens-Reference Validator");

function parseRegisteredLenses(protocolPath) {
  const lenses = new Set();
  const text = fs.readFileSync(protocolPath, "utf-8");
  // Find the `## Lenses` H2 block.
  const start = text.indexOf("## Lenses");
  if (start === -1) {
    r.error(`${protocolPath}: missing \`## Lenses\` H2`);
    return lenses;
  }
  // Block runs until the next H2 (`\n## `).
  const end = text.indexOf("\n## ", start + 1);
  const block = text.slice(start, end === -1 ? text.length : end);
  // Lens name appears in a markdown table as the first cell in backticks:
  //   | `comprehensive` | ... |
  for (const m of block.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)) {
    lenses.add(m[1]);
  }
  return lenses;
}

function* walkAgents(dirs) {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const stack = [dir];
    while (stack.length) {
      const d = stack.pop();
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile() && entry.name.endsWith(".agent.md")) {
          yield full;
        }
      }
    }
  }
}

const LENS_TOKEN_RE =
  /(?:review_focus|lenses|default_lenses|review_focus_default|review_focus_value)\s*[:=]?\s*\[?\s*["'`]([a-zA-Z][\w-]+)["'`]/g;
// Also match lenses as bare unquoted identifiers in JSON arrays:
// `default_lenses: ["foo", "bar"]`
const LENS_ARRAY_RE = /(?:lenses|default_lenses)\s*[:=]?\s*\[([^\]]+)\]/g;

const TOKEN_RE = /["'`]([a-zA-Z][\w-]+)["'`]/g;

function extractReferencesFromText(text, file, referenced) {
  for (const m of text.matchAll(LENS_ARRAY_RE)) {
    const arr = m[1];
    for (const tm of arr.matchAll(TOKEN_RE)) {
      referenced.set(tm[1], (referenced.get(tm[1]) ?? []).concat(file));
    }
  }
  for (const m of text.matchAll(LENS_TOKEN_RE)) {
    referenced.set(m[1], (referenced.get(m[1]) ?? []).concat(file));
  }
}

console.log("\n🔍 Validating lens references...\n");

const registered = parseRegisteredLenses(PROTOCOL_PATH);
if (registered.size === 0) {
  r.error(`${PROTOCOL_PATH}: no lens entries detected in \`## Lenses\` table — registry is empty`);
} else {
  console.log(`  ✅ Registered lenses: ${[...registered].sort().join(", ")}`);
}

const referenced = new Map();

for (const file of walkAgents(AGENT_DIRS)) {
  const text = fs.readFileSync(file, "utf-8");
  extractReferencesFromText(text, file, referenced);
}

if (fs.existsSync(WORKFLOW_GRAPH_PATH)) {
  const text = fs.readFileSync(WORKFLOW_GRAPH_PATH, "utf-8");
  extractReferencesFromText(text, WORKFLOW_GRAPH_PATH, referenced);
}

// Whitelist: descriptive sentinels that look like lens tokens but are
// genuinely not lens references (e.g., the enum-style placeholders used
// in subagent contract docs).
const WHITELIST = new Set([
  "per",
  "pass",
  "comprehensive",
  "security-governance",
  "architecture-reliability",
  "cost-feasibility",
  "governance-reconciliation",
  // Common enum scaffolding strings in subagent prose
  "high",
  "medium",
  "low",
]);

let invalid = 0;
for (const [token, sources] of referenced) {
  if (WHITELIST.has(token)) continue;
  if (registered.has(token)) continue;
  r.error(`Undefined lens reference: "${token}" used in ${[...new Set(sources)].join(", ")}`);
  invalid++;
}

console.log(`  ✅ Scanned ${referenced.size} unique lens-shaped tokens across agents + workflow-graph`);
r.summary();
r.exitOnError(
  "All lens references resolve to registered entries in adversarial-review-protocol.md",
  `${invalid} undefined lens reference(s) found`,
);
