#!/usr/bin/env node
/**
 * Model Consistency Validator
 *
 * Enforces that every agent's YAML frontmatter `model` field is identical
 * to the registry's `model` field for the same agent. The agent frontmatter
 * is the canonical source of truth; the registry mirrors it. The model
 * catalog (.github/model-catalog.json) is documentation only and is NOT
 * consulted here.
 *
 * Comparison rules:
 *   - Frontmatter `model` may be an array (preferred for agents) or string.
 *     The first element is taken when array form is used.
 *   - Registry `model` is always a string.
 *   - A trailing " (copilot)" qualifier is stripped on both sides before
 *     equality comparison (legacy form support).
 *   - String equality after that strip is required. No allow-list.
 *
 * @example
 *   node tools/scripts/validate-model-consistency.mjs
 */
import fs from "node:fs";
import { getAgents } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { REGISTRY_PATH } from "./_lib/paths.mjs";
import { normalizeModel, walkRegistry } from "./_lib/model-helpers.mjs";

const r = new Reporter("Model Consistency Validator");

/**
 * Build lookups once: by basename and by relative path. Both forms are
 * used in the registry, so we index by both.
 */
function buildAgentLookup(agents) {
  const byBase = new Map();
  const byRelPath = new Map();
  for (const [file, agent] of agents) {
    byBase.set(file, agent.frontmatter || null);
    if (agent.path) {
      const rel = agent.path.replace(/^\.?\/?/, "");
      byRelPath.set(rel, agent.frontmatter || null);
    }
  }
  return { byBase, byRelPath };
}

function findAgentFrontmatter(lookup, registryAgentPath) {
  if (!registryAgentPath) return null;
  // Try exact relative path match first.
  const direct = lookup.byRelPath.get(registryAgentPath);
  if (direct !== undefined) return direct;
  // Fall back to basename match.
  const base = registryAgentPath.split("/").pop();
  if (base && lookup.byBase.has(base)) return lookup.byBase.get(base);
  return null;
}

function checkEntry(key, entry, lookup) {
  const registryAgentPath = entry.agent;
  if (!registryAgentPath) {
    r.error(`Agent "${key}"`, "registry entry missing agent file path");
    return;
  }
  const fm = findAgentFrontmatter(lookup, registryAgentPath);
  if (!fm) {
    r.error(`Agent "${key}"`, `agent file not found in workspace index: ${registryAgentPath}`);
    return;
  }
  const yamlModel = normalizeModel(fm.model);
  const regModel = normalizeModel(entry.model);

  if (!yamlModel) {
    r.error(`Agent "${key}"`, `frontmatter is missing \`model\` field`);
    return;
  }
  if (!regModel) {
    r.error(`Agent "${key}"`, `registry entry is missing \`model\` field`);
    return;
  }
  if (yamlModel !== regModel) {
    r.error(`Agent "${key}"`, `frontmatter model "${yamlModel}" does not equal registry model "${regModel}"`);
  }
}

console.log("\n📋 Validating model consistency (frontmatter ≡ registry)...\n");

if (!fs.existsSync(REGISTRY_PATH)) {
  r.error(`Agent registry not found at ${REGISTRY_PATH}`);
  process.exit(1);
}

let registry;
try {
  registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
} catch (e) {
  r.error(`Cannot parse ${REGISTRY_PATH}: ${e.message}`);
  process.exit(1);
}

const agents = getAgents();
const lookup = buildAgentLookup(agents);

let count = 0;
for (const [label, entry] of walkRegistry(registry)) {
  checkEntry(label, entry, lookup);
  count++;
}

r.ok(`Checked ${count} registry entries`);

console.log(`\n📊 Results: ${r.errors} error(s), ${r.warnings} warning(s)\n`);

if (r.errors > 0) {
  console.error("❌ Model consistency validation failed\n");
  process.exit(1);
}

console.log("✅ Model consistency validation passed\n");
