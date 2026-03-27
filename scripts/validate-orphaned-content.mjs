#!/usr/bin/env node
/**
 * Orphaned Content Validator
 *
 * Detects skills and instruction files that are not referenced by any
 * agent, other skill, or instruction file. Orphaned content wastes
 * repository space and creates maintenance confusion.
 *
 * @example
 * node scripts/validate-orphaned-content.mjs
 */

import fs from "node:fs";
import {
  getAgents,
  getSkills,
  getInstructions,
} from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { COPILOT_INSTRUCTIONS } from "./_lib/paths.mjs";

// Skills intentionally kept without direct agent references.
// These are invoked dynamically by VS Code Copilot via skill descriptions
// or used as general-purpose skills available to any conversation.
const KNOWN_UNLINKED_SKILLS = new Set([
  "appinsights-instrumentation",
  "azure-ai",
  "azure-aigateway",
  "azure-cloud-migrate",
  "azure-compliance",
  "azure-compute",
  "azure-cost-optimization",
  "azure-hosted-copilot-sdk",
  "azure-kusto",
  "azure-messaging",
  "azure-quotas",
  "azure-rbac",
  "azure-resource-lookup",
  "azure-resource-visualizer",
  "azure-storage",
  "copilot-customization",
  "count-registry",
  "entra-app-registration",
  "excalidraw",
  "mermaid",
  "microsoft-foundry",
  "python-diagrams",
]);

const r = new Reporter("Orphaned Content Validator");
r.header();

// Gather reference corpus from cached index + top-level config.
function gatherReferenceContent() {
  const corpus = [];
  const perSkill = {};

  for (const [, agent] of getAgents()) corpus.push(agent.content);
  for (const [, instr] of getInstructions()) corpus.push(instr.content);

  for (const [name, skill] of getSkills()) {
    if (skill.content) perSkill[name] = skill.content;
  }

  // Top-level config files
  for (const f of [
    COPILOT_INSTRUCTIONS,
    "AGENTS.md",
    ".github/prompts/plan-agenticWorkflowOverhaul.prompt.md",
  ]) {
    if (fs.existsSync(f)) corpus.push(fs.readFileSync(f, "utf-8"));
  }

  return { corpus: corpus.join("\n"), perSkill };
}

const { corpus, perSkill } = gatherReferenceContent();

// Check skills — exclude the skill's own SKILL.md to prevent self-referencing
console.log("📁 Skills:");
const skills = getSkills();

for (const [skill] of skills) {
  r.tick();
  // Build search content: agents + instructions + config + OTHER skills (not self)
  const otherSkills = Object.entries(perSkill)
    .filter(([name]) => name !== skill)
    .map(([, content]) => content)
    .join("\n");
  const searchContent = corpus + "\n" + otherSkills;

  const isReferenced =
    searchContent.includes(`${skill}/SKILL.md`) ||
    searchContent.includes(`skills/${skill}`) ||
    searchContent.includes(`${skill}/references/`) ||
    searchContent.includes(`${skill}/`) ||
    searchContent.includes(`\`${skill}\``);

  if (!isReferenced) {
    if (KNOWN_UNLINKED_SKILLS.has(skill)) {
      // Intentionally unlinked — skip warning
    } else {
      r.warn(`${skill}/`, "not referenced by any agent or instruction");
    }
  }
}

// Check instruction files for completeness (applyTo presence)
// Instructions auto-load by glob pattern — missing applyTo means the
// instruction will never be applied automatically.
console.log("\n📁 Instructions (applyTo completeness):");
const instructions = getInstructions();

for (const [file, instr] of instructions) {
  r.tick();

  const fmMatch = instr.content.match(/^---\n([\s\S]*?)\n---/);
  const hasApplyTo = fmMatch && fmMatch[1].includes("applyTo");

  if (!hasApplyTo) {
    r.warn(file, "no applyTo frontmatter (instruction never auto-loads)");
  }
}

r.summary();
r.exitOnError("Orphaned content check passed");
