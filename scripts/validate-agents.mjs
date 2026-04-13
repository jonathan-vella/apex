#!/usr/bin/env node
/**
 * Agent Validators (consolidated)
 *
 * Combines three agent validation checks into one script:
 * 1. Frontmatter validation (was validate-agent-frontmatter.mjs)
 * 2. Agent structural checks — body size + language density (was lint-agent-checks.mjs)
 * 3. Model-prompt alignment (was lint-model-alignment.mjs)
 *
 * @example
 * node scripts/validate-agents.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { getAgents } from "./_lib/workspace-index.mjs";
import { parseFrontmatter, getBody } from "./_lib/parse-frontmatter.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { MAX_BODY_LINES } from "./_lib/paths.mjs";

let overallFailed = false;

// ============================================================================
// Part 1: Agent Frontmatter Validation (was validate-agent-frontmatter.mjs)
// ============================================================================

const MAIN_AGENT_REQUIRED = ["name", "description", "user-invocable", "tools"];
const SUBAGENT_REQUIRED = ["name", "description", "user-invocable", "tools"];
const RECOMMENDED_FIELDS = ["agents", "model"];
const BLOCK_SCALAR_PATTERN = /^description:\s*[>|][-\s]*$/m;

const ALLOWED_NON_INVOCABLE_MAIN_AGENTS = new Set([
  "e2e-orchestrator.agent.md",
]);

function runFrontmatterValidation() {
  const r = new Reporter("Agent Frontmatter Validator");
  r.header();

  const agents = getAgents();
  let mainCount = 0;
  let subCount = 0;

  for (const [file, agent] of agents) {
    r.tick();
    const { path: filePath, content, frontmatter, isSubagent } = agent;
    const relativePath = filePath;

    if (isSubagent) subCount++;
    else mainCount++;

    if (BLOCK_SCALAR_PATTERN.test(content)) {
      r.error(
        relativePath,
        "description uses a YAML block scalar (>, >-, | or |-). Use a single-line inline string.",
      );
    }

    if (!frontmatter) {
      r.error(relativePath, "No frontmatter found");
      continue;
    }

    const requiredFields = isSubagent ? SUBAGENT_REQUIRED : MAIN_AGENT_REQUIRED;

    for (const field of requiredFields) {
      if (!(field in frontmatter)) {
        r.error(relativePath, `Missing required field '${field}'`);
      }
    }

    if (isSubagent) {
      const ui = frontmatter["user-invocable"];
      if (ui !== "false" && ui !== "never" && ui !== false) {
        r.error(
          relativePath,
          `Subagent must have user-invocable: false or never (got: ${ui})`,
        );
      }
    } else {
      const ui = frontmatter["user-invocable"];
      const filename = relativePath.split("/").pop();
      if (
        ui !== "true" &&
        ui !== "always" &&
        ui !== true &&
        !ALLOWED_NON_INVOCABLE_MAIN_AGENTS.has(filename)
      ) {
        r.warn(
          relativePath,
          `Main agent should have user-invocable: true (got: ${ui})`,
        );
      }
    }

    if (!isSubagent) {
      for (const field of RECOMMENDED_FIELDS) {
        if (!(field in frontmatter)) {
          r.warn(relativePath, `Missing recommended 1.109 field '${field}'`);
        }
      }
    }

    if ("agents" in frontmatter && !Array.isArray(frontmatter.agents)) {
      r.error(
        relativePath,
        `'agents' parsed as ${typeof frontmatter.agents}, expected array`,
      );
    }

    if (content.includes("handoffs:")) {
      const handoffMatch = content.match(
        /handoffs:[\s\S]*?(?=\n[a-z-]+:|---|\n#|$)/i,
      );
      if (handoffMatch) {
        const handoffSection = handoffMatch[0];
        const labelCount = (handoffSection.match(/label:/g) || []).length;
        const sendCount = (handoffSection.match(/send:/g) || []).length;
        if (labelCount > 0 && sendCount === 0) {
          r.warn(
            relativePath,
            "Handoffs missing 'send' property (1.109 feature)",
          );
        }
      }
    }

    const fmEnd = content.indexOf("\n---", content.indexOf("---") + 3);
    if (fmEnd !== -1) {
      const body = content.substring(fmEnd + 4);
      const bodyLines = body.split("\n").length;
      if (bodyLines > MAX_BODY_LINES) {
        r.error(
          relativePath,
          `Body is ${bodyLines} lines (>${MAX_BODY_LINES}). Extract to skill references/ or scripts/.`,
        );
      }
    }
  }

  console.log(`\nFound ${mainCount} main agents and ${subCount} subagents`);

  r.summary();
  if (r.errors > 0) {
    overallFailed = true;
    console.log("❌ Agent frontmatter validation FAILED\n");
  } else {
    console.log("✅ All agents passed frontmatter validation\n");
  }
}

// ============================================================================
// Part 2: Agent Structural Checks (was lint-agent-checks.mjs)
// ============================================================================

const KEYWORDS = ["MANDATORY", "NEVER", "CRITICAL", "MUST", "HARD"];
const MAX_DENSITY_PER_100 = 5;

const EXCLUDE_PATTERNS = [
  /security baseline/i,
  /approval gate/i,
  /ONE-SHOT/,
  /HARD RULE.*ONE-SHOT/,
  /NEVER proceed past approval gates/i,
  /NEVER ask about IaC tool/i,
  /NEVER call `#runSubagent` for/i,
  /MUST be delegated via/i,
  /MUST include Challenger/i,
];

function stripCodeFences(text) {
  return text.replace(/^```[\s\S]*?^```/gm, "");
}

function analyzeLanguage(body) {
  const stripped = stripCodeFences(body);
  const lines = stripped.split("\n");
  const perKeyword = new Map(KEYWORDS.map((k) => [k, 0]));
  let total = 0;

  for (const line of lines) {
    if (EXCLUDE_PATTERNS.some((pat) => pat.test(line))) continue;
    for (const keyword of KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, "g");
      const matches = line.match(regex);
      if (matches) {
        perKeyword.set(keyword, perKeyword.get(keyword) + matches.length);
        total += matches.length;
      }
    }
  }

  return { total, perKeyword, lines: lines.length };
}

function runAgentChecks() {
  const r = new Reporter("Agent Structural Checks");
  r.header();

  const agents = getAgents();

  for (const [file, agent] of agents) {
    r.tick();
    const { path: filePath, content } = agent;
    const body = getBody(content);
    const bodyLines = body.split("\n").length;

    if (bodyLines > MAX_BODY_LINES) {
      const totalLines = content.split("\n").length;
      r.errorAnnotation(
        filePath,
        `${file} body is ${bodyLines} lines (>${MAX_BODY_LINES}; total: ${totalLines})`,
      );
      console.log(
        `  Fix: Extract verbose sections to skill references/ or scripts/.`,
      );
    }

    const { total, perKeyword, lines } = analyzeLanguage(body);
    const density = lines > 0 ? (total / lines) * 100 : 0;

    if (density > MAX_DENSITY_PER_100) {
      const breakdown = KEYWORDS.filter((k) => perKeyword.get(k) > 0)
        .map((k) => `${k}=${perKeyword.get(k)}`)
        .join(", ");
      r.warnAnnotation(
        filePath,
        `${file}: ${total} absolute-language keywords in ${lines} lines (${density.toFixed(1)}/100 > ${MAX_DENSITY_PER_100}/100). Breakdown: ${breakdown}`,
      );
      console.log(
        `  Fix: Soften language or extract content to skill references.`,
      );
    }
  }

  r.summary();
  if (r.errors > 0) {
    overallFailed = true;
    console.log("❌ Agent structural checks FAILED\n");
  } else {
    console.log("✅ Agent structural checks passed\n");
  }
}

// ============================================================================
// Part 3: Model-Prompt Alignment (was lint-model-alignment.mjs)
// ============================================================================

const PROMPTS_DIR = ".github/prompts";

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

function countBodyLines(content) {
  return getBody(content).split("\n").length;
}

function runModelAlignment() {
  const r = new Reporter("Model-Prompt Alignment");
  r.header();

  // Check 1: Prompt file model matches target agent
  console.log("  Check 1: Prompt ↔ Agent model sync");
  if (fs.existsSync(PROMPTS_DIR)) {
    const agents = getAgents();
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

      const agentEntry = agentModelMap.get(targetAgent.toLowerCase());
      if (!agentEntry) continue;

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

  // Check 2: Handoff model override redundancy
  console.log("  Check 2: Handoff model override redundancy");
  {
    const agents = getAgents();
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

  // Check 3: Claude agents missing reasoning_effort comment
  console.log("  Check 3: Claude reasoning_effort comments");
  {
    const agents = getAgents();

    for (const [filename, agent] of agents) {
      if (!agent.frontmatter?.model) continue;
      const family = classifyModel(agent.frontmatter.model);
      if (!isClaude(family)) continue;
      if (agent.isSubagent) continue;

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

  // Check 4: Large Claude agents missing context_awareness
  console.log("  Check 4: Claude large-agent context_awareness");
  {
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

  // Check 5: Claude non-ONE-SHOT research agents missing investigate block
  const INVESTIGATE_AGENTS = [
    "03-architect",
    "05-iac-planner",
    "09-diagnose",
    "11-context-optimizer",
  ];

  console.log("  Check 5: Claude investigate_before_answering");
  {
    const agents = getAgents();

    for (const [filename, agent] of agents) {
      if (!agent.frontmatter?.model) continue;
      const family = classifyModel(agent.frontmatter.model);
      if (!isClaude(family)) continue;

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

  r.summary();
  if (r.errors > 0) {
    overallFailed = true;
    console.log("❌ Model-prompt alignment check FAILED\n");
  } else {
    console.log("✅ Model-prompt alignment check passed\n");
  }
}

// ============================================================================
// Main entry point
// ============================================================================

function main() {
  console.log("🤖 Agent Validators (consolidated)\n");

  console.log("═══ Part 1: Frontmatter Validation ═══");
  runFrontmatterValidation();

  console.log("═══ Part 2: Agent Structural Checks ═══");
  runAgentChecks();

  console.log("═══ Part 3: Model-Prompt Alignment ═══");
  runModelAlignment();

  if (overallFailed) {
    console.log("❌ Agent validation FAILED");
    process.exit(1);
  }
  console.log("✅ All agent validations passed");
}

main();
