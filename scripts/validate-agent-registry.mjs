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
import { getSkillNames } from "./_lib/workspace-index.mjs";
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

r.ok(`Validated ${agentCount} agents and ${subagentCount} subagents`);

console.log(`\n📊 Results: ${r.errors} error(s), ${r.warnings} warning(s)\n`);

if (r.errors > 0) {
  console.error("❌ Agent registry validation failed\n");
  process.exit(1);
}

console.log("✅ Agent registry validation passed\n");
