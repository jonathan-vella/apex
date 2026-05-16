#!/usr/bin/env node

// check-context-redundancy.mjs
//
// Post-mortem analyser for VS Code Copilot Chat debug logs.
// Identifies the same `filePath` being read more than once via the
// `read_file` tool within a single session — a violation of the
// no-duplicate-read rule in
// .github/instructions/agent-authoring.instructions.md.
//
// Usage:
//   node tools/scripts/check-context-redundancy.mjs <log.json>
//
// Exit codes:
//   0 — no duplicate reads of heavy files (informational summary only)
//   1 — at least one heavy-file duplicate read (rule violation)
//   2 — invocation error (bad path, malformed log)
//
// Heavy-file globs (case-insensitive match on the read filePath):
//   - SKILL.md
//   - **/references/*.md
//   - **/templates/*.md
//   - **/instructions/*.instructions.md
//
// Other duplicate reads (e.g. iterative agent-output/**) are reported
// as informational notes and do not fail the script.
//
// v3 plan Phase 11.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function usage(msg) {
  if (msg) console.error(`error: ${msg}`);
  console.error("usage: node tools/scripts/check-context-redundancy.mjs <log.json>");
  process.exit(2);
}

const [, , logArg] = process.argv;
if (!logArg) usage("missing <log.json>");
const logPath = resolve(logArg);
if (!existsSync(logPath)) usage(`log not found: ${logPath}`);

let data;
try {
  data = JSON.parse(readFileSync(logPath, "utf-8"));
} catch (err) {
  usage(`malformed JSON: ${err.message}`);
}

const spans = data?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans;
if (!Array.isArray(spans)) {
  usage("unexpected log shape: missing resourceSpans[0].scopeSpans[0].spans");
}

function attrValue(v = {}) {
  if ("stringValue" in v) return v.stringValue;
  if ("intValue" in v) return Number.parseInt(v.intValue, 10);
  return undefined;
}

const HEAVY_RE = [
  /SKILL\.md$/i,
  /\/references\/[^/]+\.md$/i,
  /\/templates\/[^/]+\.md$/i,
  /\/instructions\/[^/]+\.instructions\.md$/i,
];

// Whitelist: legitimate iterative reads
const WHITELIST_RE = [/^agent-output\//, /\/agent-output\//];

const readFiles = new Map(); // filePath → { count, isHeavy }

for (const span of spans) {
  if (span?.name !== "read_file") continue;
  const args = (span.attributes ?? []).find((a) => a.key === "gen_ai.tool.call.arguments");
  if (!args) continue;
  const raw = attrValue(args.value);
  if (!raw) continue;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    continue;
  }
  const fp = parsed.filePath || parsed.uri || parsed.path;
  if (!fp) continue;
  const isHeavy = HEAVY_RE.some((re) => re.test(fp));
  const isWhitelist = WHITELIST_RE.some((re) => re.test(fp));
  const entry = readFiles.get(fp) ?? { count: 0, isHeavy, isWhitelist };
  entry.count += 1;
  readFiles.set(fp, entry);
}

const heavyDups = [];
const otherDups = [];
for (const [fp, info] of readFiles) {
  if (info.count <= 1) continue;
  if (info.isWhitelist) continue;
  if (info.isHeavy) heavyDups.push({ filePath: fp, count: info.count });
  else otherDups.push({ filePath: fp, count: info.count });
}

heavyDups.sort((a, b) => b.count - a.count);
otherDups.sort((a, b) => b.count - a.count);

console.log(`Scanned ${readFiles.size} unique read_file target(s) across ${spans.length} span(s).`);

if (heavyDups.length === 0 && otherDups.length === 0) {
  console.log("✓ No duplicate reads detected.");
  process.exit(0);
}

if (heavyDups.length > 0) {
  console.log(`\n❌ Heavy-file duplicate reads (rule violations): ${heavyDups.length}`);
  console.log("   See .github/instructions/agent-authoring.instructions.md#no-duplicate-read-rule");
  for (const { filePath, count } of heavyDups) {
    console.log(`   ${count}×  ${filePath}`);
  }
}

if (otherDups.length > 0) {
  console.log(`\nℹ️  Informational — other duplicate reads (not gated): ${otherDups.length}`);
  for (const { filePath, count } of otherDups) {
    console.log(`   ${count}×  ${filePath}`);
  }
}

process.exit(heavyDups.length > 0 ? 1 : 0);
