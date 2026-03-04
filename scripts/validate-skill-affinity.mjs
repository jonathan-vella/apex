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
import path from "node:path";

const AFFINITY_PATH = ".github/skill-affinity.json";
const SKILLS_DIR = ".github/skills";
const AGENTS_DIR = ".github/agents";
const SUBAGENTS_DIR = ".github/agents/_subagents";

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

function getSkillNames() {
  if (!fs.existsSync(SKILLS_DIR)) return new Set();
  return new Set(
    fs
      .readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  );
}

function getAgentNames() {
  const names = new Set();
  for (const dir of [AGENTS_DIR, SUBAGENTS_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith(".agent.md")) {
        const content = fs.readFileSync(path.join(dir, file), "utf-8");
        const nameMatch = content.match(/^name:\s*(.+)$/m);
        if (nameMatch) {
          names.add(nameMatch[1].trim());
        }
      }
    }
  }
  return names;
}

function getAgentSkillReads(agentName) {
  // Find the agent file and extract "Read .github/skills/..." references
  const reads = new Set();
  for (const dir of [AGENTS_DIR, SUBAGENTS_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".agent.md")) continue;
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      if (nameMatch && nameMatch[1].trim() === agentName) {
        const skillRefs = content.matchAll(
          /\.github\/skills\/([a-z0-9-]+)\/SKILL\.md/g
        );
        for (const match of skillRefs) {
          reads.add(match[1]);
        }
        return reads;
      }
    }
  }
  return reads;
}

console.log("\n🎯 Validating skill affinity configuration...\n");

if (!fs.existsSync(AFFINITY_PATH)) {
  error(`Skill affinity config not found at ${AFFINITY_PATH}`);
  process.exit(1);
}

let affinity;
try {
  affinity = JSON.parse(fs.readFileSync(AFFINITY_PATH, "utf-8"));
} catch (e) {
  error(`Invalid JSON in ${AFFINITY_PATH}: ${e.message}`);
  process.exit(1);
}

const skillNames = getSkillNames();
const agentNames = getAgentNames();

function validateEntry(key, entry, isSubagent) {
  // Validate skill names
  for (const tier of ["primary", "secondary", "never"]) {
    if (!Array.isArray(entry[tier])) {
      error(`${key}: "${tier}" must be an array`);
      continue;
    }
    for (const skill of entry[tier]) {
      if (!skillNames.has(skill)) {
        error(`${key}: references non-existent skill "${skill}" in ${tier}`);
      }
    }
  }

  // Check for conflicts (same skill in primary and never)
  if (Array.isArray(entry.primary) && Array.isArray(entry.never)) {
    for (const skill of entry.primary) {
      if (entry.never.includes(skill)) {
        error(
          `${key}: skill "${skill}" appears in both "primary" and "never"`
        );
      }
    }
  }

  // Cross-reference against agent body (agents only, not subagents easily)
  if (!isSubagent) {
    const bodyReads = getAgentSkillReads(key);
    if (bodyReads.size > 0 && Array.isArray(entry.primary)) {
      for (const skill of entry.primary) {
        if (!bodyReads.has(skill)) {
          warn(
            `${key}: primary skill "${skill}" is not referenced in agent body "Read" lines`
          );
        }
      }
    }
  }
}

let entryCount = 0;

if (affinity.agents) {
  for (const [key, entry] of Object.entries(affinity.agents)) {
    if (!agentNames.has(key)) {
      warn(`Agent "${key}" in affinity config not found in agent files`);
    }
    validateEntry(key, entry, false);
    entryCount++;
  }
}

if (affinity.subagents) {
  for (const [key, entry] of Object.entries(affinity.subagents)) {
    if (!agentNames.has(key)) {
      warn(`Subagent "${key}" in affinity config not found in agent files`);
    }
    validateEntry(key, entry, true);
    entryCount++;
  }
}

ok(`Validated ${entryCount} affinity entries`);

console.log(
  `\n📊 Results: ${errors} error(s), ${warnings} warning(s)\n`
);

if (errors > 0) {
  console.error("❌ Skill affinity validation failed\n");
  process.exit(1);
}

console.log("✅ Skill affinity validation passed\n");
