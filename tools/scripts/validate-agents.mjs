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
 * node tools/scripts/validate-agents.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { getAgents, getPromptFiles } from "./_lib/workspace-index.mjs";
import { getBody } from "./_lib/parse-frontmatter.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { MAX_BODY_LINES } from "./_lib/paths.mjs";

let overallFailed = false;
/** Aggregated structured findings across all parts (used by --format=json). */
const allFindings = [];

/**
 * The repo's custom YAML-like parser flattens handoffs into a string array
 * (one entry per `key: value` line). For vendor-prompting checks that need
 * structured handoffs, re-parse the frontmatter with js-yaml.
 *
 * Returns an array of `{ label, agent, prompt, send, model }` objects, or
 * an empty array when the agent has no handoffs.
 */
function parseStructuredHandoffs(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return [];
  try {
    const parsed = yaml.load(m[1]);
    if (parsed && Array.isArray(parsed.handoffs)) return parsed.handoffs;
  } catch {
    // js-yaml may fail on edge-case YAML; degrade to empty array.
  }
  return [];
}

// ============================================================================
// Part 1: Agent Frontmatter Validation (was validate-agent-frontmatter.mjs)
// ============================================================================

const MAIN_AGENT_REQUIRED = ["name", "description", "user-invocable", "tools"];
const SUBAGENT_REQUIRED = ["name", "description", "user-invocable", "tools"];
const RECOMMENDED_FIELDS = ["agents", "model"];
const BLOCK_SCALAR_PATTERN = /^description:\s*[>|][-\s]*$/m;

const ALLOWED_NON_INVOCABLE_MAIN_AGENTS = new Set(["e2e-orchestrator.agent.md"]);

function runFrontmatterValidation() {
  const r = new Reporter("Agent Frontmatter Validator");
  r.header();

  const agents = getAgents();
  let mainCount = 0;
  let subCount = 0;

  for (const [_file, agent] of agents) {
    r.tick();
    const { path: filePath, content, frontmatter, isSubagent } = agent;
    const relativePath = filePath;

    if (isSubagent) subCount++;
    else mainCount++;

    if (BLOCK_SCALAR_PATTERN.test(content)) {
      r.error(relativePath, "description uses a YAML block scalar (>, >-, | or |-). Use a single-line inline string.");
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
        r.error(relativePath, `Subagent must have user-invocable: false or never (got: ${ui})`);
      }
    } else {
      const ui = frontmatter["user-invocable"];
      const filename = relativePath.split("/").pop();
      if (ui !== "true" && ui !== "always" && ui !== true && !ALLOWED_NON_INVOCABLE_MAIN_AGENTS.has(filename)) {
        r.warn(relativePath, `Main agent should have user-invocable: true (got: ${ui})`);
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
      r.error(relativePath, `'agents' parsed as ${typeof frontmatter.agents}, expected array`);
    }

    if (content.includes("handoffs:")) {
      const handoffMatch = content.match(/handoffs:[\s\S]*?(?=\n[a-z-]+:|---|\n#|$)/i);
      if (handoffMatch) {
        const handoffSection = handoffMatch[0];
        const labelCount = (handoffSection.match(/label:/g) || []).length;
        const sendCount = (handoffSection.match(/send:/g) || []).length;
        if (labelCount > 0 && sendCount === 0) {
          r.warn(relativePath, "Handoffs missing 'send' property (1.109 feature)");
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
      r.errorAnnotation(filePath, `${file} body is ${bodyLines} lines (>${MAX_BODY_LINES}; total: ${totalLines})`);
      console.log(`  Fix: Extract verbose sections to skill references/ or scripts/.`);
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
      console.log(`  Fix: Soften language or extract content to skill references.`);
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

/**
 * Build a Map<lowercase-agent-name, { model, path }> from getAgents().
 * Shared by Check 1 (Prompt↔Agent model sync), Check 2 (handoff override
 * redundancy), and the prompt-model-source rule in vendor-prompting.
 */
function buildAgentNameToModel() {
  const map = new Map();
  for (const [, agent] of getAgents()) {
    if (agent.frontmatter?.name) {
      map.set(agent.frontmatter.name.toLowerCase(), {
        model: agent.frontmatter.model,
        path: agent.path,
      });
    }
  }
  return map;
}

function classifyModel(modelStr) {
  if (!modelStr) return "unknown";
  const s = Array.isArray(modelStr) ? modelStr[0] : modelStr;
  if (!s) return "unknown";
  const lower = s.toLowerCase();
  if (lower.includes("claude opus")) return "claude-opus";
  if (lower.includes("claude sonnet")) return "claude-sonnet";
  if (lower.includes("claude haiku")) return "claude-haiku";
  if (lower.includes("claude")) return "claude";
  if (lower.includes("gpt-5.5")) return "gpt-5.5";
  if (lower.includes("gpt-5.4")) return "gpt-5.4";
  if (lower.includes("gpt-5.3") || lower.includes("codex")) return "gpt-codex";
  if (lower.includes("gpt-4o")) return "gpt-4o";
  return "unknown";
}

function isClaude(family) {
  return family.startsWith("claude");
}

function isGpt55(family) {
  return family === "gpt-5.5";
}

function isGptFamily(family) {
  return family.startsWith("gpt-");
}

export { classifyModel, isClaude, isGpt55, isGptFamily };

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
  {
    const agentModelMap = buildAgentNameToModel();
    const prompts = getPromptFiles();

    for (const [file, prompt] of prompts) {
      const fm = prompt.frontmatter;
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
        r.warn(file, `prompt model "${promptModel}" does not match agent "${targetAgent}" model "${agentEntry.model}"`);
        r.record({
          ruleId: "legacy-001",
          severity: "warn",
          file,
          message: `prompt model "${promptModel}" does not match agent "${targetAgent}" model "${agentEntry.model}"`,
          sourceUrl:
            "https://github.com/openai/skills/blob/724cd511c96593f642bddf13187217aa155d2554/skills/.curated/openai-docs/references/upgrade-guide.md",
        });
      }
    }
  }

  // Check 2: Handoff model override redundancy
  console.log("  Check 2: Handoff model override redundancy");
  {
    const agents = getAgents();
    const agentModelMap = new Map();
    for (const [name, entry] of buildAgentNameToModel()) {
      agentModelMap.set(name, entry.model);
    }

    for (const [_filename, agent] of agents) {
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
          r.record({
            ruleId: "legacy-002",
            severity: "warn",
            file: relPath,
            message: `handoff to "${handoff.agent}" has redundant model override "${handoff.model}"`,
          });
        }
      }
    }
  }

  // Check 3: Large Claude agents missing context_awareness
  console.log("  Check 3: Claude large-agent context_awareness");
  {
    const agents = getAgents();

    for (const [_filename, agent] of agents) {
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
        r.record({
          ruleId: "legacy-003",
          severity: "warn",
          file: relPath,
          message: `Claude agent has ${bodyLines} body lines but no <context_awareness> block`,
          sourceUrl:
            "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
        });
      }
    }
  }

  // Check 4: Claude non-ONE-SHOT research agents missing investigate block
  const INVESTIGATE_AGENTS = ["03-architect", "05-iac-planner", "09-diagnose", "11-context-optimizer"];

  console.log("  Check 4: Claude investigate_before_answering");
  {
    const agents = getAgents();

    for (const [filename, agent] of agents) {
      if (!agent.frontmatter?.model) continue;
      const family = classifyModel(agent.frontmatter.model);
      if (!isClaude(family)) continue;

      const matchesKnown = INVESTIGATE_AGENTS.some((prefix) => filename.startsWith(prefix));
      if (!matchesKnown) continue;

      r.tick();
      const relPath = path.relative(process.cwd(), agent.path);
      const body = getBody(agent.content);

      if (!body.includes("<investigate_before_answering>")) {
        r.warn(relPath, "Claude research agent missing <investigate_before_answering> block");
        r.record({
          ruleId: "legacy-004",
          severity: "warn",
          file: relPath,
          message: "Claude research agent missing <investigate_before_answering> block",
          sourceUrl:
            "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
        });
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
  allFindings.push(...r.findings);
}

// ============================================================================
// Part 4: Vendor Prompting (new — checks 5-15)
// ============================================================================

/**
 * Inline rule registry. Each entry mirrors a row in
 * `.github/skills/vendor-prompting/rules.json`. The validator does not load
 * that file at runtime (avoids circularity); instead `--list-rules` dumps
 * this catalog and `validate-vendor-rules.mjs` cross-checks both directions.
 *
 * Severity here is the DEFAULT; family overrides are applied at emit time.
 */
const VENDOR_RULES = [
  {
    id: "claude-oneshot-001",
    severity: "warn",
    appliesTo: "agent",
    sourceUrl:
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
  },
  {
    id: "gpt55-skeleton-001",
    severity: "warn",
    appliesTo: "agent",
    sourceUrl:
      "https://github.com/openai/skills/blob/724cd511c96593f642bddf13187217aa155d2554/skills/.curated/openai-docs/references/prompting-guide.md#suggested-prompt-structure",
  },
  {
    id: "gpt-no-claude-xml-001",
    severity: "warn",
    appliesTo: "agent",
    sourceUrl:
      "https://github.com/openai/skills/blob/724cd511c96593f642bddf13187217aa155d2554/skills/.curated/openai-docs/references/prompting-guide.md",
  },
  {
    id: "cross-language-density-001",
    severity: "info",
    appliesTo: "agent",
    sourceUrl:
      "https://github.com/openai/skills/blob/724cd511c96593f642bddf13187217aa155d2554/skills/.curated/openai-docs/references/prompting-guide.md#outcome-first-prompts-and-stopping-conditions",
  },
  {
    id: "model-deprecation-001",
    severity: "warn",
    appliesTo: "both",
    sourceUrl:
      "https://github.com/openai/skills/blob/724cd511c96593f642bddf13187217aa155d2554/skills/.curated/openai-docs/references/upgrade-guide.md",
  },
  {
    id: "claude-no-prefill-001",
    severity: "warn",
    appliesTo: "both",
    sourceUrl:
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#migrating-away-from-prefilled-responses",
  },
  {
    id: "gpt55-stop-rules-non-empty-001",
    severity: "warn",
    appliesTo: "agent",
    sourceUrl:
      "https://github.com/openai/skills/blob/724cd511c96593f642bddf13187217aa155d2554/skills/.curated/openai-docs/references/prompting-guide.md#outcome-first-prompts-and-stopping-conditions",
  },
  {
    id: "frontmatter-model-style-001",
    severity: "error",
    appliesTo: "both",
    sourceUrl:
      "https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/instructions/agent-authoring.instructions.md",
  },
  {
    id: "claude-output-contract-001",
    severity: "warn",
    appliesTo: "agent",
    sourceUrl:
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#structure-prompts-with-xml-tags",
  },
  {
    id: "handoff-enrichment-001",
    severity: "warn",
    appliesTo: "agent",
    sourceUrl:
      "https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/instructions/agent-authoring.instructions.md",
  },
  {
    id: "personality-scoping-001",
    severity: "info",
    appliesTo: "agent",
    sourceUrl:
      "https://github.com/openai/skills/blob/724cd511c96593f642bddf13187217aa155d2554/skills/.curated/openai-docs/references/prompting-guide.md#personality-and-behavior",
  },
  {
    id: "prompt-model-source-001",
    severity: "error",
    appliesTo: "prompt",
    sourceUrl:
      "https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/instructions/vendor-prompting.instructions.md#prompt-model-source",
  },
];

function ruleById(id) {
  return VENDOR_RULES.find((rule) => rule.id === id);
}

const FAMILY_STATUS = {
  "claude-opus": "enforced",
  "claude-sonnet": "enforced",
  "claude-haiku": "warn-only",
  claude: "warn-only",
  "gpt-5.5": "enforced",
  "gpt-5.4": "deprecated",
  "gpt-codex": "reviewer-only",
  "gpt-4o": "reviewer-only",
  unknown: "enforced",
};

/** Apply family-status downgrade to a rule's default severity. */
function effectiveSeverity(rule, family) {
  const base = rule.severity;
  const status = FAMILY_STATUS[family] || "enforced";
  if (status === "reviewer-only") return "info";
  if (status === "deprecated") return "info";
  if (status === "warn-only") {
    if (base === "error") return "warn";
    return base;
  }
  return base;
}

/** Names of agents whose contract is ONE-SHOT (single round, no investigate). */
const ONE_SHOT_AGENT_NAMES = new Set(["02-Requirements", "challenger-review-subagent"]);

/** XML blocks that are Claude-only and forbidden in GPT agents. */
const CLAUDE_ONLY_XML = [
  "<investigate_before_answering>",
  "<context_awareness>",
  "<scope_fencing>",
  "<empty_result_recovery>",
  "<subagent_budget>",
  "<output_contract>",
];

/** Required H1 sections for GPT-5.5 outcome-first skeleton. */
const GPT55_REQUIRED_SECTIONS = ["# Goal", "# Success criteria", "# Constraints", "# Output", "# Stop rules"];

/** Permitted absolute-language paragraph keywords (Check 8R). */
const PERMITTED_ABSOLUTE_CONTEXTS = [/security baseline/i, /governance/i, /approval gate/i, /non-negotiable/i];

const ABSOLUTE_WORDS = ["ALWAYS", "NEVER", "MUST", "HARD RULE"];
const ABSOLUTE_DENSITY_THRESHOLD = 0.05;

const PREFILL_PATTERNS = [
  /\bprefill the assistant\b/i,
  /\bassistant prefill\b/i,
  /\bprefilled response\b/i,
  /assistant\s*:\s*\{\s*content\s*:\s*"</i,
];

/** Check 5: claude-oneshot-001 */
function checkClaudeOneShotNoInvestigate(r, agent, file, family) {
  if (!isClaude(family)) return;
  const name = agent.frontmatter?.name;
  if (!ONE_SHOT_AGENT_NAMES.has(name)) return;
  const body = getBody(agent.content);
  if (!body.includes("<investigate_before_answering>")) return;
  emit(
    r,
    "claude-oneshot-001",
    family,
    file,
    `ONE-SHOT agent "${name}" must NOT include <investigate_before_answering>`,
  );
}

/** Check 6: gpt55-skeleton-001 */
function checkGpt55Skeleton(r, agent, file, family) {
  if (family !== "gpt-5.5" && family !== "gpt-5.4") return;
  const body = getBody(agent.content);
  const missing = GPT55_REQUIRED_SECTIONS.filter((h) => !new RegExp(`^${h}\\b`, "m").test(body));
  if (missing.length > 0) {
    emit(
      r,
      "gpt55-skeleton-001",
      family,
      file,
      `GPT-5.5 outcome-first skeleton missing sections: ${missing.join(", ")}`,
    );
  }
  // Personality scoping (rule personality-scoping-001 piggybacked)
  const ui = agent.frontmatter?.["user-invocable"];
  const isUserFacing =
    (ui === true || ui === "true" || ui === "always") && /Orchestrator/i.test(agent.frontmatter?.name || "");
  const hasPersonality = /^# Personality\b/m.test(body);
  if (hasPersonality && !isUserFacing && !agent.isSubagent) {
    emit(
      r,
      "personality-scoping-001",
      family,
      file,
      `# Personality block on internal pipeline agent "${agent.frontmatter?.name}" — reserve for user-facing Orchestrators`,
    );
  }
}

/** Check 7: gpt-no-claude-xml-001 */
function checkGptNoClaudeXml(r, agent, file, family) {
  if (!isGptFamily(family)) return;
  const body = getBody(agent.content);
  for (const xml of CLAUDE_ONLY_XML) {
    if (body.includes(xml)) {
      emit(r, "gpt-no-claude-xml-001", family, file, `GPT agent contains Claude-only XML block ${xml}`);
    }
  }
}

/** Check 8R: cross-language-density-001 */
function checkAbsoluteLanguageDensity(r, agent, file, family) {
  const body = getBody(agent.content);
  const lines = body.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return;
  let count = 0;
  for (const line of lines) {
    if (PERMITTED_ABSOLUTE_CONTEXTS.some((re) => re.test(line))) continue;
    for (const w of ABSOLUTE_WORDS) {
      const m = line.match(new RegExp(`\\b${w}\\b`, "g"));
      if (m) count += m.length;
    }
  }
  const density = count / lines.length;
  if (density > ABSOLUTE_DENSITY_THRESHOLD) {
    emit(
      r,
      "cross-language-density-001",
      family,
      file,
      `Absolute words density ${density.toFixed(3)} (count ${count} / ${lines.length} lines) exceeds ${ABSOLUTE_DENSITY_THRESHOLD} outside permitted contexts`,
    );
  }
}

/** Check 9: model-deprecation-001 — light cross-reference */
function checkModelDeprecation(r, agent, file, family, deprecatedSet) {
  const m = agent.frontmatter?.model;
  if (!m) return;
  const norm = (Array.isArray(m) ? m[0] : m).toLowerCase();
  for (const dep of deprecatedSet) {
    if (norm.includes(dep.toLowerCase())) {
      emit(
        r,
        "model-deprecation-001",
        family,
        file,
        `Model "${m}" matches deprecated label "${dep}" — see validate-deprecated-models.mjs`,
      );
      return;
    }
  }
}

/** Check 10R: claude-no-prefill-001 */
function checkClaudeNoPrefill(r, item, file, family) {
  if (!isClaude(family)) return;
  const body = item.body || getBody(item.content);
  for (const pat of PREFILL_PATTERNS) {
    if (pat.test(body)) {
      emit(
        r,
        "claude-no-prefill-001",
        family,
        file,
        `Claude agent/prompt contains prefill instruction (matched ${pat.source}) — prefill is deprecated on Claude 4.6+`,
      );
      return;
    }
  }
}

/** Check 11: gpt55-stop-rules-non-empty-001 */
function checkGpt55StopRulesNonEmpty(r, agent, file, family) {
  if (family !== "gpt-5.5") return;
  const body = getBody(agent.content);
  // Match section body up to the next H1 heading or the end of the document.
  // (`$` with the `m` flag matches end-of-line; we need end-of-string here, hence the explicit alternative.)
  const m = body.match(/^# Stop rules\s*\n([\s\S]*?)(?=^# |$(?![\s\S]))/m);
  if (!m) return; // Missing section is caught by skeleton check
  const sectionBody = m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("<!--"));
  if (sectionBody.length === 0) {
    emit(r, "gpt55-stop-rules-non-empty-001", family, file, `# Stop rules section is empty (header only)`);
  }
}

/** Check 12: frontmatter-model-style-001 */
function checkFrontmatterModelStyle(r, item, file, family, fileType) {
  const m = item.frontmatter?.model;
  if (m === undefined || m === null) return;
  if (fileType === "agent" && !Array.isArray(m)) {
    emit(r, "frontmatter-model-style-001", family, file, `.agent.md model: must be array form, got ${typeof m}`);
  } else if (fileType === "prompt" && Array.isArray(m)) {
    emit(r, "frontmatter-model-style-001", family, file, `.prompt.md model: must be string form, got array`);
  }
}

/** Check 13: claude-output-contract-001 */
function checkClaudeOutputContract(r, agent, file, family) {
  if (!isClaude(family)) return;
  const handoffs = parseStructuredHandoffs(agent.content);
  const isArtifactProducer = handoffs.length > 0 && handoffs.some((h) => /agent-output\//.test(h?.prompt || ""));
  if (!isArtifactProducer) return;
  const body = getBody(agent.content);
  if (body.includes("<output_contract>")) return;
  emit(
    r,
    "claude-output-contract-001",
    family,
    file,
    `Claude artifact-producing agent missing <output_contract> block`,
  );
}

/** Check 14: handoff-enrichment-001 */
function checkHandoffEnrichment(r, agent, file, family) {
  const handoffs = parseStructuredHandoffs(agent.content);
  if (handoffs.length === 0) return;
  for (const [i, h] of handoffs.entries()) {
    if (!h?.prompt || typeof h.prompt !== "string") continue;
    const hasInput = /agent-output\/.+\.md/i.test(h.prompt) || /\bInput\b/i.test(h.prompt);
    const hasOutput = /Output\s*:/i.test(h.prompt) || /agent-output\/.+\.md/i.test(h.prompt);
    if (!hasInput || !hasOutput) {
      const missing = [!hasInput && "input reference", !hasOutput && "output reference"].filter(Boolean).join(" and ");
      emit(
        r,
        "handoff-enrichment-001",
        family,
        file,
        `handoffs[${i}] (${h.label || h.agent || "?"}) missing ${missing}`,
      );
    }
  }
}

/**
 * Check 15: prompt-model-source-001
 *
 * Enforces the prompt-frontmatter HARD rule:
 *   - `agent: "<custom-agent>"` → MUST NOT declare `model:` (let it inherit).
 *   - `agent: agent` (generic) or no `agent:` → MUST declare explicit `model:`.
 *
 * Runs only on prompts. `agentNameToModel` is the lowercase-agent-name →
 * { model, path } map produced by `buildAgentNameToModel()`.
 */
function checkPromptModelSource(r, prompt, file, agentNameToModel) {
  const fm = prompt.frontmatter;
  if (!fm) return;
  const agentField = fm.agent;
  const modelField = fm.model;
  const isGenericAgent = !agentField || (typeof agentField === "string" && agentField.toLowerCase() === "agent");

  if (isGenericAgent) {
    if (modelField === undefined || modelField === null || modelField === "") {
      emit(
        r,
        "prompt-model-source-001",
        "any",
        file,
        `prompt without a custom agent must declare an explicit \`model:\` (got agent="${agentField ?? "<missing>"}")`,
      );
    }
    return;
  }

  // Custom-agent target.
  const targetKey = typeof agentField === "string" ? agentField.toLowerCase() : null;
  const isKnownCustomAgent = targetKey !== null && agentNameToModel.has(targetKey);

  if (isKnownCustomAgent && modelField !== undefined && modelField !== null && modelField !== "") {
    emit(
      r,
      "prompt-model-source-001",
      "any",
      file,
      `redundant \`model:\` on prompt targeting custom agent "${agentField}"; remove it and let the agent's \`model:\` apply`,
    );
  }
}

/**
 * Resolve a prompt's effective family using its own `model:` first, then
 * falling back to the target custom agent's `model:`. Generic prompts
 * (`agent: agent` or absent) classify only via their own `model:`.
 */
function resolvePromptFamily(prompt, agentNameToModel) {
  const fm = prompt.frontmatter;
  if (!fm) return "unknown";
  if (fm.model) return classifyModel(fm.model);
  const agentField = fm.agent;
  if (!agentField || (typeof agentField === "string" && agentField.toLowerCase() === "agent")) {
    return "unknown";
  }
  const entry = agentNameToModel.get(agentField.toLowerCase());
  if (!entry) return "unknown";
  return classifyModel(entry.model);
}

/**
 * Emit a finding via the Reporter, applying family-severity overrides.
 */
function emit(r, ruleId, family, file, message) {
  const rule = ruleById(ruleId);
  if (!rule) {
    r.warn(file, `[unregistered rule ${ruleId}] ${message}`);
    return;
  }
  const sev = effectiveSeverity(rule, family);
  if (sev === "error") r.error(file, `[${ruleId}] ${message}`);
  else if (sev === "warn") r.warn(file, `[${ruleId}] ${message}`);
  else r.info(file, `[${ruleId}] ${message}`);
  r.record({
    ruleId,
    severity: sev,
    file,
    message,
    sourceUrl: rule.sourceUrl,
  });
}

/**
 * Load the deprecated-model labels by parsing
 * tools/scripts/validate-deprecated-models.mjs source. Light grep — avoids
 * importing the whole script.
 */
function loadDeprecatedModels() {
  const file = "tools/scripts/validate-deprecated-models.mjs";
  if (!fs.existsSync(file)) return new Set();
  const src = fs.readFileSync(file, "utf-8");
  // Patterns like: "Claude Opus 4.6", or DEPRECATED_MODELS = [...]
  const out = new Set();
  const re = /["']([A-Z][A-Za-z0-9. -]+\d[A-Za-z0-9. -]*)["']/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (/^(Claude|GPT)/.test(m[1])) out.add(m[1]);
  }
  return out;
}

function runVendorPrompting() {
  const r = new Reporter("Vendor Prompting Rules");
  r.header();

  const agents = getAgents();
  const prompts = getPromptFiles();
  const deprecated = loadDeprecatedModels();
  // lowercase-agent-name → { model, path }; used by the prompt loop to
  // resolve effective family and enforce prompt-model-source-001.
  const agentNameToModel = buildAgentNameToModel();

  for (const [_file, agent] of agents) {
    r.tick();
    const relPath = path.relative(process.cwd(), agent.path);
    const family = classifyModel(agent.frontmatter?.model);

    // unknown model is itself an error (forces explicit model:)
    if (family === "unknown" && agent.frontmatter?.model !== undefined) {
      emit(
        r,
        "frontmatter-model-style-001",
        family,
        relPath,
        `model "${agent.frontmatter.model}" did not classify into any known family`,
      );
    }

    checkFrontmatterModelStyle(r, agent, relPath, family, "agent");
    checkClaudeOneShotNoInvestigate(r, agent, relPath, family);
    checkGpt55Skeleton(r, agent, relPath, family);
    checkGptNoClaudeXml(r, agent, relPath, family);
    checkAbsoluteLanguageDensity(r, agent, relPath, family);
    checkModelDeprecation(r, agent, relPath, family, deprecated);
    checkClaudeNoPrefill(r, agent, relPath, family);
    checkGpt55StopRulesNonEmpty(r, agent, relPath, family);
    checkClaudeOutputContract(r, agent, relPath, family);
    checkHandoffEnrichment(r, agent, relPath, family);
  }

  for (const [_file, prompt] of prompts) {
    r.tick();
    const relPath = path.relative(process.cwd(), prompt.path);
    // Resolve the prompt's effective family via its own `model:` first,
    // then via the target custom agent's `model:`. This keeps per-prompt
    // vendor checks active even when `model:` is intentionally omitted on
    // prompts that target a custom agent (see prompt-model-source-001).
    const family = resolvePromptFamily(prompt, agentNameToModel);

    checkFrontmatterModelStyle(r, prompt, relPath, family, "prompt");
    checkClaudeNoPrefill(r, prompt, relPath, family);
    checkModelDeprecation(r, prompt, relPath, family, deprecated);
    checkPromptModelSource(r, prompt, relPath, agentNameToModel);
  }

  r.summary();
  if (r.errors > 0) {
    overallFailed = true;
    console.log("❌ Vendor prompting check FAILED\n");
  } else {
    console.log("✅ Vendor prompting check passed\n");
  }
  allFindings.push(...r.findings);
}

// ============================================================================
// Self-check: cross-reference VENDOR_RULES vs rules.json
// ============================================================================

function listRules() {
  const rulesJsonPath = ".github/skills/vendor-prompting/rules.json";
  let registry = null;
  if (fs.existsSync(rulesJsonPath)) {
    try {
      registry = JSON.parse(fs.readFileSync(rulesJsonPath, "utf-8"));
    } catch (e) {
      console.error(`Failed to parse ${rulesJsonPath}: ${e.message}`);
      process.exit(2);
    }
  }
  console.log("Inline rule catalog (validate-agents.mjs):\n");
  for (const rule of VENDOR_RULES) {
    console.log(`  ${rule.id.padEnd(36)} severity=${rule.severity.padEnd(5)} appliesTo=${rule.appliesTo}`);
  }
  if (!registry) {
    console.log("\n(no rules.json present to cross-check)");
    return;
  }
  const inlineIds = new Set(VENDOR_RULES.map((r) => r.id));
  const registryIds = new Set(registry.rules.map((r) => r.id));
  const inlineOnly = [...inlineIds].filter((id) => !registryIds.has(id));
  const registryOnly = [...registryIds].filter((id) => !inlineIds.has(id) && !id.startsWith("legacy-"));
  console.log("\nCross-check vs rules.json:");
  if (inlineOnly.length === 0 && registryOnly.length === 0) {
    console.log("  ✅ inline catalog and rules.json are in sync (legacy-* rules excluded)");
  } else {
    if (inlineOnly.length > 0) {
      console.log(`  ❌ in inline catalog but missing from rules.json: ${inlineOnly.join(", ")}`);
    }
    if (registryOnly.length > 0) {
      console.log(`  ❌ in rules.json but missing from inline catalog: ${registryOnly.join(", ")}`);
    }
    process.exit(1);
  }
}

// ============================================================================
// Main entry point
// ============================================================================

const PARTS = {
  frontmatter: runFrontmatterValidation,
  structural: runAgentChecks,
  "model-alignment": runModelAlignment,
  "vendor-prompting": runVendorPrompting,
};

function parseArgs(argv) {
  const opts = { only: null, format: "text", listRules: false, color: true };
  for (const a of argv) {
    if (a === "--list-rules") opts.listRules = true;
    else if (a === "--no-color") opts.color = false;
    else if (a.startsWith("--only=")) {
      opts.only = a
        .slice(7)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a.startsWith("--format=")) {
      opts.format = a.slice(9);
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.listRules) {
    listRules();
    return;
  }

  const isJson = opts.format === "json";
  const log = isJson ? () => {} : console.log;
  const origLog = console.log;
  const origErr = console.error;
  const origWarn = console.warn;
  if (isJson) {
    // suppress text output during JSON mode (findings still accumulated)
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
  }

  log("🤖 Agent Validators (consolidated)\n");

  const partsToRun = opts.only && opts.only.length > 0 ? opts.only.filter((p) => PARTS[p]) : Object.keys(PARTS);

  if (opts.only && opts.only.some((p) => !PARTS[p])) {
    const unknown = opts.only.filter((p) => !PARTS[p]);
    if (!isJson) {
      origErr(`Unknown --only parts: ${unknown.join(", ")}`);
      origErr(`Valid: ${Object.keys(PARTS).join(", ")}`);
    }
    process.exit(2);
  }

  for (const part of partsToRun) {
    log(`═══ Part: ${part} ═══`);
    try {
      PARTS[part]();
    } catch (e) {
      origErr(`Validator crashed in ${part}: ${e.message}`);
      process.exit(2);
    }
  }

  if (isJson) {
    console.log = origLog;
    console.error = origErr;
    console.warn = origWarn;
    const summary = {
      errors: allFindings.filter((f) => f.severity === "error").length,
      warns: allFindings.filter((f) => f.severity === "warn").length,
      infos: allFindings.filter((f) => f.severity === "info").length,
    };
    console.log(JSON.stringify({ summary, findings: allFindings }, null, 2));
    process.exit(summary.errors > 0 ? 1 : 0);
  }

  if (overallFailed) {
    log("❌ Agent validation FAILED");
    process.exit(1);
  }
  log("✅ All agent validations passed");
}

// Run main() only when invoked directly (not when imported by tests).
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main();
}
