#!/usr/bin/env node
/**
 * Skill Affinity Validator
 *
 * Validates .github/skill-affinity.json:
 * - All agent names match existing .agent.md files
 * - All skill names match existing skill folders
 * - No skill appears in both primary and never for the same agent
 * - Cross-references agent body "Read .github/skills/..." lines
 *
 * @example
 * node scripts/validate-skill-affinity.mjs
 */

import fs from "node:fs";
import { getAgents, getSkillNames as getSkillNamesFromIndex } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { AFFINITY_PATH } from "./_lib/paths.mjs";

const r = new Reporter("Skill Affinity Validator");

function getAgentNames() {
  const names = new Set();
  for (const [, agent] of getAgents()) {
    const name = agent.frontmatter?.name?.trim();
    if (name) names.add(name);
  }
  return names;
}

function buildAgentSkillReadsMap() {
  const map = new Map();
  for (const [, agent] of getAgents()) {
    const name = agent.frontmatter?.name?.trim();
    if (!name) continue;
    const reads = new Set();
    const skillRefs = agent.content.matchAll(
      /\.github\/skills\/([a-z0-9-]+)\/SKILL\.md/g,
    );
    for (const match of skillRefs) {
      reads.add(match[1]);
    }
    map.set(name, reads);
  }
  return map;
}

console.log("\n🎯 Validating skill affinity configuration...\n");

if (!fs.existsSync(AFFINITY_PATH)) {
  r.error(`Skill affinity config not found at ${AFFINITY_PATH}`);
  process.exit(1);
}

let affinity;
try {
  affinity = JSON.parse(fs.readFileSync(AFFINITY_PATH, "utf-8"));
} catch (e) {
  r.error(`Invalid JSON in ${AFFINITY_PATH}: ${e.message}`);
  process.exit(1);
}

const skillNames = getSkillNamesFromIndex();
const agentNames = getAgentNames();
const agentSkillReadsMap = buildAgentSkillReadsMap();

function validateEntry(key, entry, isSubagent) {
  // Validate skill names
  for (const tier of ["primary", "secondary", "never"]) {
    if (!Array.isArray(entry[tier])) {
      r.error(`${key}: "${tier}" must be an array`);
      continue;
    }
    for (const skill of entry[tier]) {
      if (!skillNames.has(skill)) {
        r.error(`${key}: references non-existent skill "${skill}" in ${tier}`);
      }
    }
  }

  if (Array.isArray(entry.primary) && Array.isArray(entry.never)) {
    for (const skill of entry.primary) {
      if (entry.never.includes(skill)) {
        r.error(`${key}: skill "${skill}" appears in both "primary" and "never"`);
      }
    }
  }

  if (!isSubagent) {
    const bodyReads = agentSkillReadsMap.get(key) || new Set();
    if (bodyReads.size > 0 && Array.isArray(entry.primary)) {
      for (const skill of entry.primary) {
        if (!bodyReads.has(skill)) {
          r.warn(`${key}: primary skill "${skill}" is not referenced in agent body "Read" lines`);
        }
      }
    }
  }
}

let entryCount = 0;

if (affinity.agents) {
  for (const [key, entry] of Object.entries(affinity.agents)) {
    if (!agentNames.has(key)) {
      r.warn(`Agent "${key}" in affinity config not found in agent files`);
    }
    validateEntry(key, entry, false);
    entryCount++;
  }
}

if (affinity.subagents) {
  for (const [key, entry] of Object.entries(affinity.subagents)) {
    if (!agentNames.has(key)) {
      r.warn(`Subagent "${key}" in affinity config not found in agent files`);
    }
    validateEntry(key, entry, true);
    entryCount++;
  }
}

r.ok(`Validated ${entryCount} affinity entries`);

console.log(`\n📊 Results: ${r.errors} error(s), ${r.warnings} warning(s)\n`);

if (r.errors > 0) {
  console.error("❌ Skill affinity validation failed\n");
  process.exit(1);
}

console.log("✅ Skill affinity validation passed\n");
