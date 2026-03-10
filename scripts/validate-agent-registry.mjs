#!/usr/bin/env node
/**
 * Agent Registry Validator
 *
 * Validates .github/agent-registry.json:
 * - All referenced .agent.md files exist
 * - All referenced skills exist in .github/skills/
 * - Cross-checks model names against known valid models
 *
 * @example
 * node scripts/validate-agent-registry.mjs
 */

import fs from "node:fs";
import { getSkillNames, getAgents } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { REGISTRY_PATH } from "./_lib/paths.mjs";

const KNOWN_MODELS = [
  "Claude Opus 4.6",
  "Claude Sonnet 4.6",
  "Claude Haiku 4.5",
  "GPT-5.3-Codex",
  "GPT-5.4",
  "GPT-4o",
];

const r = new Reporter("Agent Registry Validator");

function validateAgentEntry(key, entry, skillNames) {
  // Handle IaC-conditional entries (bicep/terraform variants)
  if (entry.bicep || entry.terraform) {
    for (const variant of ["bicep", "terraform"]) {
      if (entry[variant]) {
        validateAgentFile(key, entry[variant].agent);
        validateSkills(key, entry[variant].skills, skillNames);
        validateModel(key, entry[variant].model);
      }
    }
    return;
  }

  validateAgentFile(key, entry.agent);
  validateSkills(key, entry.skills, skillNames);
  validateModel(key, entry.model);
}

function validateAgentFile(key, agentPath) {
  if (!agentPath) {
    r.error(`Agent "${key}"`, "missing agent file path");
    return;
  }
  if (!fs.existsSync(agentPath)) {
    r.error(`Agent "${key}"`, `file not found: ${agentPath}`);
  }
}

function validateSkills(key, skills, skillNames) {
  if (!Array.isArray(skills)) return;
  for (const skill of skills) {
    if (!skillNames.has(skill)) {
      r.error(`Agent "${key}"`, `references non-existent skill: "${skill}"`);
    }
  }
}

function validateModel(key, model) {
  if (!model) return;
  if (!KNOWN_MODELS.includes(model)) {
    r.warn(`Agent "${key}"`, `unknown model "${model}"`);
  }
}

console.log("\n📋 Validating agent registry...\n");

if (!fs.existsSync(REGISTRY_PATH)) {
  r.error(`Agent registry not found at ${REGISTRY_PATH}`);
  process.exit(1);
}

let raw;
try {
  raw = fs.readFileSync(REGISTRY_PATH, "utf-8");
} catch (e) {
  r.error(`Cannot read ${REGISTRY_PATH}: ${e.message}`);
  process.exit(1);
}

let registry;
try {
  registry = JSON.parse(raw);
} catch (e) {
  r.error(`Invalid JSON in ${REGISTRY_PATH}: ${e.message}`);
  process.exit(1);
}

const skillNames = getSkillNames();

// Validate agents
let agentCount = 0;
if (registry.agents) {
  for (const [key, entry] of Object.entries(registry.agents)) {
    validateAgentEntry(key, entry, skillNames);
    agentCount++;
  }
}

// Validate subagents
let subagentCount = 0;
if (registry.subagents) {
  for (const [key, entry] of Object.entries(registry.subagents)) {
    validateAgentEntry(key, entry, skillNames);
    subagentCount++;
  }
}

// Cross-check registry models against YAML frontmatter
const agentMap = new Map();
for (const [file, agent] of getAgents()) {
  const name = agent.frontmatter?.name?.trim();
  if (name) agentMap.set(file, agent.frontmatter);
}

function crossCheckModel(registryKey, registryModel, agentFilePath) {
  if (!registryModel || !agentFilePath) return;
  for (const [file, fm] of agentMap) {
    if (
      agentFilePath.endsWith(file) ||
      file.endsWith(agentFilePath.replace(/^\.github\/agents\//, ""))
    ) {
      const yamlModel = Array.isArray(fm.model) ? fm.model[0] : fm.model;
      if (yamlModel) {
        const cleanYaml = yamlModel.replace(/ \(copilot\)$/, "");
        const cleanRegistry = registryModel.replace(/ \(copilot\)$/, "");
        if (cleanYaml !== cleanRegistry) {
          r.warn(
            `Agent "${registryKey}"`,
            `registry model "${registryModel}" differs from YAML frontmatter "${yamlModel}"`,
          );
        }
      }
      break;
    }
  }
}

const allEntries = [
  ...Object.entries(registry.agents || {}),
  ...Object.entries(registry.subagents || {}),
];
for (const [key, entry] of allEntries) {
  if (entry.bicep || entry.terraform) {
    if (entry.bicep)
      crossCheckModel(key + " (bicep)", entry.bicep.model, entry.bicep.agent);
    if (entry.terraform)
      crossCheckModel(
        key + " (terraform)",
        entry.terraform.model,
        entry.terraform.agent,
      );
  } else {
    crossCheckModel(key, entry.model, entry.agent);
  }
}

r.ok(`Validated ${agentCount} agents and ${subagentCount} subagents`);

console.log(`\n📊 Results: ${r.errors} error(s), ${r.warnings} warning(s)\n`);

if (r.errors > 0) {
  console.error("❌ Agent registry validation failed\n");
  process.exit(1);
}

console.log("✅ Agent registry validation passed\n");
