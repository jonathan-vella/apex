#!/usr/bin/env node
/**
 * Model-Prompt Alignment Validator
 *
 * Checks that agent definitions and prompt files follow model-specific
 * prompt engineering patterns (Claude XML blocks, GPT structured markdown)
 * and that prompt file model fields match their target agent's frontmatter.
 *
 * Checks:
 * 1. Prompt files: model field matches the target agent's frontmatter model
 * 2. Agent handoffs: no redundant model overrides that match target agent model
 * 3. Claude agents: reasoning_effort comment present
 * 4. Claude agents >350 lines: context_awareness block recommended
 * 5. Claude agents with investigate role: investigate_before_answering present
 *
 * @example
 * node scripts/lint-model-alignment.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { getAgents } from "./_lib/workspace-index.mjs";
import { parseFrontmatter } from "./_lib/parse-frontmatter.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const PROMPTS_DIR = ".github/prompts";

const r = new Reporter("Model-Prompt Alignment Validator");

// Classify a model string into a family
function classifyModel(modelStr) {
  if (!modelStr) return "unknown";
  const s = Array.isArray(modelStr) ? modelStr[0] : modelStr;
  if (!s) return "unknown";
  const lower = s.toLowerCase();
  if (lower.includes("claude opus")) return "claude-opus";
  if (lower.includes("claude sonnet")) return "claude-sonnet";
  if (lower.includes("claude haiku")) return "claude-haiku";
  if (lower.includes("claude")) return "claude";
  if (lower.includes("gpt-5.4")) return "gpt-5.4";
  if (lower.includes("gpt-5.3") || lower.includes("codex")) return "gpt-codex";
  if (lower.includes("gpt-4o")) return "gpt-4o";
  return "unknown";
}

function isClaude(family) {
  return family.startsWith("claude");
}

// Normalize model for comparison (strip " (copilot)" suffix, brackets, quotes)
function normalizeModel(modelStr) {
  if (!modelStr) return "";
  const s = Array.isArray(modelStr) ? modelStr[0] : modelStr;
  if (!s) return "";
  return s
    .replace(/\s*\(copilot\)/gi, "")
    .replace(/[[\]"']/g, "")
    .trim()
    .toLowerCase();
}

// Get body content (everything after the frontmatter closing ---)
function getBody(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1] : content;
}

function countBodyLines(content) {
  return getBody(content).split("\n").length;
}

// ── Check 1: Prompt file model matches target agent ──

function checkPromptModelSync() {
  if (!fs.existsSync(PROMPTS_DIR)) return;

  const agents = getAgents();
  // Build a lookup: agent name (lowercase) → frontmatter model
  const agentModelMap = new Map();
  for (const [, agent] of agents) {
    if (agent.frontmatter?.name) {
      agentModelMap.set(agent.frontmatter.name.toLowerCase(), {
        model: agent.frontmatter.model,
        path: agent.path,
      });
    }
  }

  const promptFiles = fs
    .readdirSync(PROMPTS_DIR)
    .filter((f) => f.endsWith(".prompt.md"));

  for (const file of promptFiles) {
    const filePath = path.join(PROMPTS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const fm = parseFrontmatter(content);
    if (!fm) continue;

    r.tick();
    const promptModel = fm.model;
    const targetAgent = fm.agent;

    if (!targetAgent || !promptModel) continue;

    // Find the agent
    const agentEntry = agentModelMap.get(targetAgent.toLowerCase());
    if (!agentEntry) continue; // agent not found — other validators catch this

    const promptNorm = normalizeModel(promptModel);
    const agentNorm = normalizeModel(agentEntry.model);

    if (promptNorm && agentNorm && promptNorm !== agentNorm) {
      r.warn(
        file,
        `prompt model "${promptModel}" does not match agent "${targetAgent}" model "${agentEntry.model}"`,
      );
    }
  }
}

// ── Check 2: Handoff model overrides that duplicate the target agent's model ──

function checkHandoffOverrides() {
  const agents = getAgents();

  // Build name → model lookup
  const agentModelMap = new Map();
  for (const [, agent] of agents) {
    if (agent.frontmatter?.name) {
      agentModelMap.set(
        agent.frontmatter.name.toLowerCase(),
        agent.frontmatter.model,
      );
    }
  }

  for (const [filename, agent] of agents) {
    const handoffs = agent.frontmatter?.handoffs;
    if (!Array.isArray(handoffs)) continue;

    r.tick();
    const relPath = path.relative(process.cwd(), agent.path);

    for (const handoff of handoffs) {
      if (!handoff.model || !handoff.agent) continue;

      const targetModel = agentModelMap.get(handoff.agent.toLowerCase());
      if (!targetModel) continue;

      const handoffNorm = normalizeModel(handoff.model);
      const targetNorm = normalizeModel(targetModel);

      if (handoffNorm === targetNorm) {
        r.warn(
          relPath,
          `handoff to "${handoff.agent}" has redundant model override "${handoff.model}" (matches agent's own model)`,
        );
      }
    }
  }
}

// ── Check 3: Claude agents missing reasoning_effort comment ──

function checkReasoningEffort() {
  const agents = getAgents();

  for (const [filename, agent] of agents) {
    if (!agent.frontmatter?.model) continue;
    const family = classifyModel(agent.frontmatter.model);
    if (!isClaude(family)) continue;
    if (agent.isSubagent) continue; // subagents don't need reasoning_effort

    r.tick();
    const relPath = path.relative(process.cwd(), agent.path);
    const body = getBody(agent.content);

    if (!body.includes("reasoning_effort")) {
      r.warn(
        relPath,
        "Claude agent missing <!-- Recommended reasoning_effort: --> comment",
      );
    }
  }
}

// ── Check 4: Large Claude agents missing context_awareness ──

function checkContextAwareness() {
  const agents = getAgents();

  for (const [filename, agent] of agents) {
    if (!agent.frontmatter?.model) continue;
    const family = classifyModel(agent.frontmatter.model);
    if (!isClaude(family)) continue;
    if (agent.isSubagent) continue;

    const bodyLines = countBodyLines(agent.content);
    if (bodyLines <= 350) continue;

    r.tick();
    const relPath = path.relative(process.cwd(), agent.path);
    const body = getBody(agent.content);

    if (!body.includes("<context_awareness>")) {
      r.warn(
        relPath,
        `Claude agent has ${bodyLines} body lines but no <context_awareness> block (recommended for >350 lines)`,
      );
    }
  }
}

// ── Check 5: Claude non-ONE-SHOT research agents missing investigate block ──

const INVESTIGATE_AGENTS = [
  "03-architect",
  "05-iac-planner",
  "09-diagnose",
  "11-context-optimizer",
];

function checkInvestigateBlock() {
  const agents = getAgents();

  for (const [filename, agent] of agents) {
    if (!agent.frontmatter?.model) continue;
    const family = classifyModel(agent.frontmatter.model);
    if (!isClaude(family)) continue;

    // Only check agents expected to have investigate
    const matchesKnown = INVESTIGATE_AGENTS.some((prefix) =>
      filename.startsWith(prefix),
    );
    if (!matchesKnown) continue;

    r.tick();
    const relPath = path.relative(process.cwd(), agent.path);
    const body = getBody(agent.content);

    if (!body.includes("<investigate_before_answering>")) {
      r.warn(
        relPath,
        "Claude research agent missing <investigate_before_answering> block",
      );
    }
  }
}

// ── Main ──

r.header();

console.log("  Check 1: Prompt ↔ Agent model sync");
checkPromptModelSync();

console.log("  Check 2: Handoff model override redundancy");
checkHandoffOverrides();

console.log("  Check 3: Claude reasoning_effort comments");
checkReasoningEffort();

console.log("  Check 4: Claude large-agent context_awareness");
checkContextAwareness();

console.log("  Check 5: Claude investigate_before_answering");
checkInvestigateBlock();

r.summary();
r.exitOnError("Model-prompt alignment check passed");
