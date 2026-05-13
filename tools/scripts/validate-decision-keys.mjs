#!/usr/bin/env node
/**
 * validate-decision-keys.mjs
 *
 * Greps every .agent.md file under .github/agents/ for
 * `apex-recall decide --key <name>` patterns and asserts that each
 * <name> is registered in tools/apex-recall/docs/decision-keys.md.
 *
 * Phase I1 of the nordic-foods lessons plan. Prevents silent typos in
 * decision keys (the historical failure mode where a typo never reads
 * back and the gate it controls silently no-ops).
 *
 * Usage:
 *   node tools/scripts/validate-decision-keys.mjs
 *
 * Exit codes:
 *   0 — all keys valid
 *   1 — at least one unregistered key found
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AGENTS_DIR = path.join(ROOT, ".github/agents");
const REGISTRY = path.join(ROOT, "tools/apex-recall/docs/decision-keys.md");

function parseRegistry() {
  if (!fs.existsSync(REGISTRY)) {
    console.error(`[validate-decision-keys] registry missing: ${REGISTRY}`);
    process.exit(1);
  }
  const text = fs.readFileSync(REGISTRY, "utf-8");
  const keys = new Set();
  // Each registered key appears as the first column of a pipe-delimited
  // table row, wrapped in backticks: `| \`key_name\` |`. Extract.
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .slice(1, -1);
    if (cells.length < 2) continue;
    const first = cells[0];
    // Skip header and separator rows
    if (!first.startsWith("`")) continue;
    const m = first.match(/^`([^`]+)`$/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (name.endsWith(".agent.md")) {
      out.push(full);
    }
  }
  return out;
}

function extractKeyUsages(text) {
  // Matches:  apex-recall decide ... --key <name>
  // Captures any non-whitespace token after --key (until end-of-arg).
  const usages = [];
  const re = /apex-recall\s+decide[^\n]*--key\s+([A-Za-z0-9_\-<>{}]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const key = m[1];
    // Allow agents to use placeholders like <k>, <key>, ${k}, or the
    // literal `<key>` from documentation — these are template forms,
    // not real key usages. Skip them.
    if (/^[<{].*[>}]$/.test(key)) continue;
    if (key === "k" || key === "key") continue;
    usages.push(key);
  }
  return usages;
}

function main() {
  const registry = parseRegistry();
  console.log(`[validate-decision-keys] registry: ${registry.size} canonical key(s)`);

  const files = walk(AGENTS_DIR);
  let errors = 0;
  const seen = new Set();
  for (const f of files) {
    const text = fs.readFileSync(f, "utf-8");
    const usages = extractKeyUsages(text);
    for (const key of usages) {
      seen.add(key);
      if (!registry.has(key)) {
        console.error(`❌ ${path.relative(ROOT, f)}: unregistered decision key --key ${key}`);
        errors++;
      }
    }
  }
  console.log(`[validate-decision-keys] scanned ${files.length} agent file(s), saw ${seen.size} distinct key(s)`);
  if (errors > 0) {
    console.error(`\n❌ ${errors} unregistered decision-key reference(s).`);
    console.error(`   Add the key to tools/apex-recall/docs/decision-keys.md or fix the typo.`);
    process.exit(1);
  }
  console.log("✅ all decision-key references are registered");
  return 0;
}

main();
