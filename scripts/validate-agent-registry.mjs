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
import path from "node:path";
import { getSkillNames } from "./_lib/workspace-index.mjs";

const REGISTRY_PATH = ".github/agent-registry.json";

const KNOWN_MODELS = [
  "Claude Opus 4.6",
  "Claude Sonnet 4.6",
  "Claude Haiku 4.5",
  "GPT-5.3-Codex",
  "GPT-5.4",
  "GPT-4o",
];

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠️  ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

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
    error(`Agent "${key}": missing agent file path`);
    return;
  }
  if (!fs.existsSync(agentPath)) {
    error(`Agent "${key}": file not found: ${agentPath}`);
  }
}

function validateSkills(key, skills, skillNames) {
  if (!Array.isArray(skills)) return;
  for (const skill of skills) {
    if (!skillNames.has(skill)) {
      error(`Agent "${key}": references non-existent skill: "${skill}"`);
    }
  }
}

function validateModel(key, model) {
  if (!model) return;
  if (!KNOWN_MODELS.includes(model)) {
    warn(
      `Agent "${key}": unknown model "${model}" (known: ${KNOWN_MODELS.join(", ")})`,
    );
  }
}

console.log("\n📋 Validating agent registry...\n");

if (!fs.existsSync(REGISTRY_PATH)) {
  error(`Agent registry not found at ${REGISTRY_PATH}`);
  process.exit(1);
}

let raw;
try {
  raw = fs.readFileSync(REGISTRY_PATH, "utf-8");
} catch (e) {
  error(`Cannot read ${REGISTRY_PATH}: ${e.message}`);
  process.exit(1);
}

let registry;
try {
  registry = JSON.parse(raw);
} catch (e) {
  error(`Invalid JSON in ${REGISTRY_PATH}: ${e.message}`);
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

ok(`Validated ${agentCount} agents and ${subagentCount} subagents`);

console.log(`\n📊 Results: ${errors} error(s), ${warnings} warning(s)\n`);

if (errors > 0) {
  console.error("❌ Agent registry validation failed\n");
  process.exit(1);
}

console.log("✅ Agent registry validation passed\n");
