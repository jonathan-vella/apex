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

const r = new Reporter("Model Consistency Validator");

function normalize(model) {
  if (!model) return null;
  const s = Array.isArray(model) ? model[0] : model;
  if (typeof s !== "string") return null;
  return s.replace(/ \(copilot\)$/, "").trim();
}

function findAgentFrontmatter(agents, registryAgentPath) {
  for (const [file, agent] of agents) {
    if (
      registryAgentPath.endsWith(file) ||
      file.endsWith(registryAgentPath.replace(/^\.github\/agents\//, ""))
    ) {
      return agent.frontmatter || null;
    }
  }
  return null;
}

function checkEntry(key, registryModel, registryAgentPath, agents) {
  if (!registryAgentPath) {
    r.error(`Agent "${key}"`, "registry entry missing agent file path");
    return;
  }
  const fm = findAgentFrontmatter(agents, registryAgentPath);
  if (!fm) {
    r.error(
      `Agent "${key}"`,
      `agent file not found in workspace index: ${registryAgentPath}`,
    );
    return;
  }
  const yamlModel = normalize(fm.model);
  const regModel = normalize(registryModel);

  if (!yamlModel) {
    r.error(`Agent "${key}"`, `frontmatter is missing \`model\` field`);
    return;
  }
  if (!regModel) {
    r.error(`Agent "${key}"`, `registry entry is missing \`model\` field`);
    return;
  }
  if (yamlModel !== regModel) {
    r.error(
      `Agent "${key}"`,
      `frontmatter model "${yamlModel}" does not equal registry model "${regModel}"`,
    );
  }
}

function walk(key, entry, agents) {
  if (entry.bicep || entry.terraform) {
    if (entry.bicep)
      checkEntry(`${key} (bicep)`, entry.bicep.model, entry.bicep.agent, agents);
    if (entry.terraform)
      checkEntry(
        `${key} (terraform)`,
        entry.terraform.model,
        entry.terraform.agent,
        agents,
      );
    return;
  }
  checkEntry(key, entry.model, entry.agent, agents);
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

let count = 0;
for (const [key, entry] of Object.entries(registry.agents || {})) {
  walk(key, entry, agents);
  count++;
}
for (const [key, entry] of Object.entries(registry.subagents || {})) {
  walk(key, entry, agents);
  count++;
}

r.ok(`Checked ${count} registry entries`);

console.log(`\n📊 Results: ${r.errors} error(s), ${r.warnings} warning(s)\n`);

if (r.errors > 0) {
  console.error("❌ Model consistency validation failed\n");
  process.exit(1);
}

console.log("✅ Model consistency validation passed\n");
