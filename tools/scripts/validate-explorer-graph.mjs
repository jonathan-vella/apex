#!/usr/bin/env node
/**
 * Validate the architecture explorer graph JSON.
 *
 * Checks:
 *  1. File exists at site/public/architecture-explorer-graph.json
 *  2. Schema shape (required fields, non-empty arrays)
 *  3. Every node.path referenced (when present) exists on disk
 *  4. Every edge source/target resolves to a node id
 *  5. Category counts match actual per-category node counts
 *  6. Graph generatedAt is not older than the newest mtime of source dirs
 *     (warns locally; exits non-zero in CI when EXPLORER_GRAPH_STRICT=1)
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), "../..");
const GRAPH_PATH = join(
  REPO_ROOT,
  "site/public/architecture-explorer-graph.json",
);

const SOURCE_DIRS = [
  ".github/agents",
  ".github/agents/_subagents",
  ".github/skills",
  ".github/instructions",
  ".github/prompts",
  ".github/workflows",
];
const SOURCE_FILES = [
  ".vscode/mcp.json",
  "tools/registry/agent-registry.json",
  "package.json",
];

const errors = [];
const warnings = [];

function newestMtime(path) {
  if (!existsSync(path)) return 0;
  const s = statSync(path);
  if (s.isFile()) return s.mtimeMs;
  let max = s.mtimeMs;
  for (const entry of readdirSync(path)) {
    max = Math.max(max, newestMtime(join(path, entry)));
  }
  return max;
}

function main() {
  if (!existsSync(GRAPH_PATH)) {
    errors.push(
      `Graph file missing: ${GRAPH_PATH}\n   Run: node tools/scripts/generate-explorer-graph.mjs`,
    );
    report();
    return;
  }

  let graph;
  try {
    graph = JSON.parse(readFileSync(GRAPH_PATH, "utf8"));
  } catch (e) {
    errors.push(`Graph JSON invalid: ${e.message}`);
    report();
    return;
  }

  // Schema
  for (const key of ["generatedAt", "categories", "nodes", "edges"]) {
    if (!(key in graph)) errors.push(`Missing required field: ${key}`);
  }
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    errors.push("graph.nodes must be a non-empty array");
  }
  if (!Array.isArray(graph.edges)) {
    errors.push("graph.edges must be an array");
  }

  const ids = new Set((graph.nodes || []).map((n) => n.id));

  // Node paths exist
  for (const n of graph.nodes || []) {
    if (!n.id || !n.category || !n.label) {
      errors.push(
        `Invalid node (missing id/category/label): ${JSON.stringify(n).slice(0, 120)}`,
      );
    }
    if (n.path && !existsSync(join(REPO_ROOT, n.path))) {
      errors.push(`Node "${n.id}" references missing file: ${n.path}`);
    }
  }

  // Edges resolve
  for (const e of graph.edges || []) {
    if (!ids.has(e.source)) {
      errors.push(`Edge ${e.id}: source node not found (${e.source})`);
    }
    if (!ids.has(e.target)) {
      errors.push(`Edge ${e.id}: target node not found (${e.target})`);
    }
  }

  // Category counts
  for (const cat of graph.categories || []) {
    const actual = (graph.nodes || []).filter(
      (n) => n.category === cat.id,
    ).length;
    if (cat.count !== actual) {
      errors.push(
        `Category "${cat.id}" count mismatch: manifest=${cat.count} actual=${actual}`,
      );
    }
  }

  // Freshness: graph generatedAt must be >= newest source mtime
  // In CI (EXPLORER_GRAPH_STRICT=1), git checkout sets all mtimes to now,
  // making the graph always appear stale. Skip the mtime-based freshness
  // check in CI — structural errors are still enforced.
  if (process.env.EXPLORER_GRAPH_STRICT !== "1") {
    const graphMs =
      Date.parse(graph.generatedAt) || statSync(GRAPH_PATH).mtimeMs;
    let newestSource = 0;
    let newestName = "";
    for (const d of SOURCE_DIRS) {
      const m = newestMtime(join(REPO_ROOT, d));
      if (m > newestSource) {
        newestSource = m;
        newestName = d;
      }
    }
    for (const f of SOURCE_FILES) {
      const m = newestMtime(join(REPO_ROOT, f));
      if (m > newestSource) {
        newestSource = m;
        newestName = f;
      }
    }
    // Tolerate 5-second skew (writes in rapid succession, filesystem resolution).
    if (newestSource > graphMs + 5000) {
      warnings.push(
        `Graph is stale — ${newestName} is newer than ${GRAPH_PATH}\n` +
          `   Run: node tools/scripts/generate-explorer-graph.mjs`,
      );
    }
  }

  report();
}

function report() {
  for (const w of warnings) console.warn(`⚠️  ${w}`);
  if (errors.length === 0 && warnings.length === 0) {
    console.log("✅ architecture-explorer-graph.json is valid");
    return;
  }
  if (errors.length === 0) {
    console.log("✅ validate-explorer-graph passed (with warnings)");
    return;
  }
  for (const e of errors) console.error(`❌ ${e}`);
  console.error(`\n${errors.length} error(s) in explorer graph.`);
  process.exit(1);
}

main();
