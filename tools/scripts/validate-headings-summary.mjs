#!/usr/bin/env node

// validate-headings-summary.mjs
//
// Verifies that tools/scripts/_lib/artifact-headings-summary.json is in
// sync with the canonical source tools/scripts/_lib/artifact-headings.mjs.
// Drift fails the build — the JSON must be regenerated via
// `npm run render:headings-summary`.
//
// v3 plan Phase 10.

import { readFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { ARTIFACT_HEADINGS } from "./_lib/artifact-headings.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");
const summaryPath = resolve(__dirname, "_lib/artifact-headings-summary.json");

const r = new Reporter("Headings Summary Sync");
r.header();

let existing;
try {
  existing = readFileSync(summaryPath, "utf-8");
} catch (_error) {
  r.error(`Missing ${relative(repoRoot, summaryPath)}. Run: npm run render:headings-summary`);
  r.summary();
  r.exitOnError();
}

const sorted = Object.fromEntries(
  Object.keys(ARTIFACT_HEADINGS)
    .sort()
    .map((k) => [k, ARTIFACT_HEADINGS[k].slice()]),
);
const expected = `${JSON.stringify(sorted, null, 2)}\n`;

if (existing !== expected) {
  r.error(
    `${relative(repoRoot, summaryPath)} is out of sync with artifact-headings.mjs. Run: npm run render:headings-summary`,
  );
} else {
  console.log(
    `✓ ${relative(repoRoot, summaryPath)} matches ${Object.keys(sorted).length} artifact types in artifact-headings.mjs`,
  );
}

r.summary();
r.exitOnError();
