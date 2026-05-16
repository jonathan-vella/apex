#!/usr/bin/env node

// render-headings-summary.mjs
//
// Generates tools/scripts/_lib/artifact-headings-summary.json from the
// canonical heading registry in _lib/artifact-headings.mjs. The JSON is
// a compact <name>: [<H2 strings>] map agents can read when they only
// need the H2 structure (not the full template body).
//
// Idempotent: re-running with no source change produces identical bytes.
// Wired into the lefthook artifact-validation pre-commit hook (stage_fixed)
// so the JSON stays in sync.
//
// v3 plan Phase 10. See tmp/plan-input-token-reduction-v3.md.

import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { ARTIFACT_HEADINGS } from "./_lib/artifact-headings.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outPath = resolve(__dirname, "_lib/artifact-headings-summary.json");

const summary = {};
for (const [filename, headings] of Object.entries(ARTIFACT_HEADINGS)) {
  summary[filename] = headings.slice();
}

// Sort keys for deterministic output across regen runs.
const sorted = Object.fromEntries(
  Object.keys(summary)
    .sort()
    .map((k) => [k, summary[k]]),
);

const json = `${JSON.stringify(sorted, null, 2)}\n`;

// Idempotency check: only write if content changed.
let existing = null;
try {
  existing = readFileSync(outPath, "utf-8");
} catch {
  // File may not exist on first run.
}

if (existing === json) {
  console.log(`✓ ${outPath} (unchanged)`);
} else {
  writeFileSync(outPath, json, "utf-8");
  console.log(`✓ ${outPath} (rewritten, ${Object.keys(sorted).length} artifact types)`);
}
