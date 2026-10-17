#!/usr/bin/env node
/**
 * Model Catalog Assignment Generator
 *
 * Rebuilds the `assignments` block of `.github/model-catalog.json` from
 * agent and subagent frontmatter (the canonical source of truth). The
 * `models` and `governance` blocks are hand-maintained metadata and are
 * preserved verbatim. Only `assignments` is rewritten.
 *
 * Run on demand (`npm run generate:model-catalog`) or automatically via
 * the lefthook pre-commit hook whenever an agent frontmatter file is
 * staged. The validator (`validate-models.mjs --only=catalog`) compares the
 * committed `assignments` block against this generator's output and
 * fails CI on drift.
 *
 * Output schema (assignments):
 *   {
 *     "generated": true,
 *     "generated_by": "tools/scripts/generate-model-catalog.mjs",
 *     "description": "...",
 *     "agents": { "<file>.agent.md": "<model label>", ... },
 *     "subagents": { "<file>.agent.md": "<model label>", ... }
 *   }
 *
 * @example
 *   node tools/scripts/generate-model-catalog.mjs
 *   node tools/scripts/generate-model-catalog.mjs --check   # exit 1 on drift
 */
import fs from "node:fs";
import path from "node:path";
import { buildAssignments } from "./_lib/model-helpers.mjs";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, ".github", "model-catalog.json");

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error(`❌ Catalog not found at ${CATALOG_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
}

function writeCatalog(catalog) {
  // Match repo convention: 2-space indent, trailing newline.
  fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const catalog = loadCatalog();
  const next = buildAssignments();
  const prev = catalog.assignments ?? null;

  if (checkOnly) {
    const same = JSON.stringify(prev) === JSON.stringify(next);
    if (!same) {
      console.error("❌ model-catalog.json `assignments` block is out of sync with frontmatter.");
      console.error("   Run: node tools/scripts/generate-model-catalog.mjs");
      process.exit(1);
    }
    console.log("✅ model-catalog.json assignments in sync with frontmatter");
    return;
  }

  catalog.assignments = next;
  writeCatalog(catalog);
  const agentCount = Object.keys(next.agents).length;
  const subCount = Object.keys(next.subagents).length;
  console.log(`✅ Regenerated assignments: ${agentCount} agents, ${subCount} subagents`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
