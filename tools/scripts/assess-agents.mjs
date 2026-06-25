#!/usr/bin/env node
/**
 * 4-Layer Per-Agent Assessment Harness (deterministic engine)
 *
 * Scores every agent (main + subagents) across the deterministic slices of
 * the four-layer model and emits a per-agent scorecard plus a ranked fleet
 * summary. The judgment slices (Layer 2 role clarity, Layer 4 adversarial)
 * are left `pending` for the `assess-agents.prompt.md` Explore fan-out to
 * fill in; Layer 3 runtime is `na` unless a `profile_debug_log.py --json`
 * file is supplied via `--profile=<path>`.
 *
 * This script NEVER edits an agent. It is a read-only reporter and exits 0
 * on success (advisory), 1 only on a hard crash.
 *
 * Layers (deterministic parts only):
 *   L1 Mechanical  — validator contract (frontmatter, structural, handoffs).
 *   L2 Static      — body/tool/handoff/skill-read limits, vendor-prompting
 *                    blocks, frontmatter & model integrity.
 *   L3 Runtime     — optional ingest of a debug-log profile JSON.
 *   L4 Adversarial — pending (judgment fan-out in the prompt).
 *
 * Counts are derived from the filesystem walk (getAgents) — never hard-coded.
 *
 * Usage:
 *   node tools/scripts/assess-agents.mjs
 *   node tools/scripts/assess-agents.mjs --profile=path/to/profile.json
 *   node tools/scripts/assess-agents.mjs --out=agent-output/_baselines/custom
 *   node tools/scripts/assess-agents.mjs --no-validators   # skip subprocess
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
// Namespace import (not `import yaml from "js-yaml"`): js-yaml 5.x is pure ESM
// and exposes named exports only — no default export. A namespace import works
// under both js-yaml 4.x (CommonJS) and 5.x (ESM).
import * as yaml from "js-yaml";

import { getAgents } from "./_lib/workspace-index.mjs";
import { getBody } from "./_lib/parse-frontmatter.mjs";
import { MAX_BODY_LINES, REGISTRY_PATH, AGENT_OUTPUT_DIR } from "./_lib/paths.mjs";
import { classifyModel, isClaude, isGptFamily } from "./validate-agents.mjs";

// ── Limits ──────────────────────────────────────────────────────────────────
// Hard limit (MAX_BODY_LINES) is imported from _lib/paths.mjs. The rest are
// advisory soft/guidance limits mirrored from
// .github/instructions/context-optimization.instructions.md and the rubric ref.
const GUIDANCE_BODY_LINES = 350;
const MAX_TOOLS = 30;
const MAX_HANDOFFS = 8;
const MAX_SKILL_READS = 5;
const DESCRIPTION_MAX_LEN = 350;
const DESCRIPTION_WARN_LEN = 300;

// Vendor-prompting reference sets (mirrored from validate-agents.mjs).
const GPT55_REQUIRED_SECTIONS = ["# Goal", "# Success criteria", "# Constraints", "# Output", "# Stop rules"];
const CLAUDE_ONLY_XML = [
  "<investigate_before_answering>",
  "<context_awareness>",
  "<scope_fencing>",
  "<empty_result_recovery>",
  "<subagent_budget>",
  "<output_contract>",
];
// Claude research agents expected to carry an investigate block (file-prefix match).
const INVESTIGATE_AGENT_PREFIXES = ["03-architect", "05-iac-planner", "11-context-optimizer"];
// ONE-SHOT agents (frontmatter name) that must NOT carry an investigate block.
const ONE_SHOT_AGENT_NAMES = new Set(["02-Requirements", "challenger-review-subagent"]);

// Composite bucket weights (sum to 1.0). See the rubric reference.
const WEIGHTS = {
  l1: 0.2,
  ctx: 0.15,
  vendor: 0.15,
  role: 0.15,
  frame_safety: 0.1,
  runtime: 0.1,
  adversarial: 0.15,
};

// Interactive-shell patterns (mirrors safe-shell.mjs core rules).
const INTERACTIVE_SHELL_PATTERNS = [
  { id: "mv-interactive", re: /\bmv\s+(?:-[a-zA-Z]*i[a-zA-Z]*\b|--interactive\b)/ },
  { id: "rm-interactive", re: /\brm\s+(?:-[a-zA-Z]*i[a-zA-Z]*\b|--interactive\b)/ },
  { id: "cp-interactive", re: /\bcp\s+(?:-[a-zA-Z]*i[a-zA-Z]*\b|--interactive\b)/ },
  { id: "read-prompt", re: /\bread\s+-p\b/ },
];

// Conservative hard-coded-secret patterns (low false-positive prefixes only).
const SECRET_PATTERNS = [
  { id: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "slack-token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { id: "assigned-secret", re: /\b(?:password|secret|api[_-]?key|client[_-]?secret)\s*[:=]\s*["'][^"'\s]{12,}["']/i },
];

// ── CLI ──────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = { profile: null, out: null, runValidators: true };
  for (const a of argv) {
    if (a === "--no-validators") opts.runValidators = false;
    else if (a.startsWith("--profile=")) opts.profile = a.slice("--profile=".length);
    else if (a.startsWith("--out=")) opts.out = a.slice("--out=".length);
  }
  return opts;
}

function utcStamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .replace(/-/g, "")
    .replace(/T(\d{6})\d*Z/, "T$1Z");
}

// ── Metric extraction ─────────────────────────────────────────────────────────
/**
 * Re-parse frontmatter with js-yaml to recover the structured `handoffs`
 * array (the repo's lightweight parser flattens it). Returns [] on absence.
 */
function structuredHandoffs(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return [];
  try {
    const parsed = yaml.load(m[1]);
    if (parsed && Array.isArray(parsed.handoffs)) return parsed.handoffs;
  } catch {
    // Degrade to empty on malformed YAML.
  }
  return [];
}

/** Distinct skill names referenced via `.github/skills/<name>/SKILL.md` in the body. */
function skillReads(body) {
  const out = new Set();
  const re = /\.github\/skills\/([a-z0-9-]+)\/SKILL\.md/g;
  let m;
  while ((m = re.exec(body)) !== null) out.add(m[1]);
  return [...out];
}

function toolCount(frontmatter) {
  const t = frontmatter?.tools;
  if (Array.isArray(t)) return t.length;
  return 0;
}

function computeMetrics(agent) {
  const { content, frontmatter } = agent;
  const body = getBody(content);
  const family = classifyModel(frontmatter?.model);
  const handoffs = structuredHandoffs(content);
  const skills = skillReads(body);

  const gpt55Present = GPT55_REQUIRED_SECTIONS.filter((h) => new RegExp(`^${escapeRe(h)}\\b`, "m").test(body));
  const gpt55Missing = GPT55_REQUIRED_SECTIONS.filter((h) => !gpt55Present.includes(h));

  return {
    total_lines: content.split("\n").length,
    body_lines: body.split("\n").length,
    tool_count: toolCount(frontmatter),
    handoff_count: handoffs.length,
    skill_read_count: skills.length,
    skills_referenced: skills,
    description_length: typeof frontmatter?.description === "string" ? frontmatter.description.length : 0,
    has_context_awareness: body.includes("<context_awareness>"),
    has_investigate_block: body.includes("<investigate_before_answering>"),
    has_output_contract: body.includes("<output_contract>"),
    uses_apex_recall: /apex-recall/.test(body),
    reads_skill_md: skills.length > 0,
    gpt55_sections_present: gpt55Present,
    gpt55_sections_missing: gpt55Missing,
    model_family: family,
  };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Dimension scoring (deterministic) ─────────────────────────────────────────
const SEVERITY_RANK = { none: 0, low: 1, medium: 2, high: 3, blocker: 4 };
function worst(a, b) {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function dim(layer, status, score, severity, evidence) {
  return { layer, status, score, severity, evidence };
}

/** D1 — Mechanical contract (L1): validator + structural hard checks. */
function scoreContract(metrics, validatorStatus) {
  const evidence = [];
  let severity = "none";

  if (metrics.body_lines > MAX_BODY_LINES) {
    evidence.push(`body ${metrics.body_lines} lines > hard max ${MAX_BODY_LINES}`);
    severity = worst(severity, "blocker");
  }
  if (validatorStatus === "fail") {
    evidence.push("validate-agents reported error-severity findings");
    severity = worst(severity, "blocker");
  } else if (validatorStatus === "warn") {
    evidence.push("validate-agents reported warnings");
    severity = worst(severity, "low");
  } else if (validatorStatus === "unavailable") {
    evidence.push("validator subprocess unavailable — contract from metrics only");
  }

  const status = severity === "blocker" ? "fail" : severity === "none" ? "pass" : "warn";
  const score = status === "fail" ? 0 : status === "warn" ? 3 : 5;
  if (evidence.length === 0) evidence.push("no contract violations detected");
  return dim("L1", status, score, severity, evidence);
}

/** D2 — Frontmatter & model integrity (L2). */
function scoreFrontmatter(agent, metrics) {
  const fm = agent.frontmatter || {};
  const evidence = [];
  let severity = "none";

  const required = ["name", "description", "user-invocable", "tools"];
  for (const f of required) {
    if (!(f in fm)) {
      evidence.push(`missing required field '${f}'`);
      severity = worst(severity, "high");
    }
  }
  if (fm.model === undefined || fm.model === null) {
    evidence.push("no model field");
    severity = worst(severity, "low");
  } else if (metrics.model_family === "unknown") {
    evidence.push(`model "${fm.model}" did not classify into a known family`);
    severity = worst(severity, "high");
  }
  if (metrics.description_length > DESCRIPTION_MAX_LEN) {
    evidence.push(`description ${metrics.description_length} chars > ${DESCRIPTION_MAX_LEN}`);
    severity = worst(severity, "high");
  } else if (metrics.description_length > DESCRIPTION_WARN_LEN) {
    evidence.push(`description ${metrics.description_length} chars > recommended ${DESCRIPTION_WARN_LEN}`);
    severity = worst(severity, "low");
  }

  const status = SEVERITY_RANK[severity] >= SEVERITY_RANK.high ? "fail" : severity === "none" ? "pass" : "warn";
  const score = status === "fail" ? 1 : status === "warn" ? 4 : 5;
  if (evidence.length === 0) evidence.push("frontmatter complete; model classifies; description within budget");
  return dim("L2", status, score, severity, evidence);
}

/** D3 — Context efficiency (L2). */
function scoreContext(agent, metrics) {
  const evidence = [];
  let severity = "none";
  const isOrchestrator = /orchestrator/i.test(agent.frontmatter?.name || agent.path);

  if (metrics.body_lines > MAX_BODY_LINES) {
    evidence.push(`body ${metrics.body_lines} > hard max ${MAX_BODY_LINES}`);
    severity = worst(severity, "high");
  } else if (metrics.body_lines > GUIDANCE_BODY_LINES) {
    evidence.push(`body ${metrics.body_lines} > guidance ${GUIDANCE_BODY_LINES}`);
    severity = worst(severity, "low");
  }
  if (metrics.tool_count > MAX_TOOLS) {
    evidence.push(`tools ${metrics.tool_count} > soft ${MAX_TOOLS}`);
    severity = worst(severity, "low");
  }
  if (metrics.handoff_count > MAX_HANDOFFS && !isOrchestrator) {
    evidence.push(`handoffs ${metrics.handoff_count} > soft ${MAX_HANDOFFS}`);
    severity = worst(severity, "low");
  } else if (metrics.handoff_count > MAX_HANDOFFS && isOrchestrator) {
    evidence.push(`handoffs ${metrics.handoff_count} (orchestrator exempt — soft only)`);
  }
  if (metrics.skill_read_count > MAX_SKILL_READS) {
    evidence.push(`skill-reads ${metrics.skill_read_count} > soft ${MAX_SKILL_READS}`);
    severity = worst(severity, "low");
  }

  const status = severity === "high" ? "fail" : severity === "none" ? "pass" : "warn";
  const breaches = evidence.filter((e) => e.includes(">")).length;
  const score = status === "fail" ? 1 : Math.max(2, 5 - breaches);
  if (evidence.length === 0) evidence.push("body, tools, handoffs, and skill-reads within budget");
  return dim("L2", status, score, severity, evidence);
}

/** D4 — Vendor prompting (L2): family-correct blocks + ONE-SHOT correctness. */
function scoreVendor(agent, metrics, vendorFindings) {
  const evidence = [];
  let severity = "none";
  const family = metrics.model_family;
  const name = agent.frontmatter?.name || "";
  const fileBase = path.basename(agent.path).replace(/\.agent\.md$/, "");

  if (
    isClaude(family) &&
    !agent.isSubagent &&
    metrics.body_lines > GUIDANCE_BODY_LINES &&
    !metrics.has_context_awareness
  ) {
    evidence.push(`Claude agent ${metrics.body_lines} lines but no <context_awareness> (legacy-003)`);
    severity = worst(severity, "low");
  }
  if (
    isClaude(family) &&
    INVESTIGATE_AGENT_PREFIXES.some((p) => fileBase.startsWith(p)) &&
    !metrics.has_investigate_block
  ) {
    evidence.push("Claude research agent missing <investigate_before_answering> (legacy-004)");
    severity = worst(severity, "low");
  }
  if (isClaude(family) && ONE_SHOT_AGENT_NAMES.has(name) && metrics.has_investigate_block) {
    evidence.push("ONE-SHOT agent must NOT include <investigate_before_answering> (claude-oneshot-001)");
    severity = worst(severity, "medium");
  }
  if (family === "gpt-5.5" && metrics.gpt55_sections_missing.length > 0) {
    evidence.push(`GPT-5.5 skeleton missing: ${metrics.gpt55_sections_missing.join(", ")} (gpt55-skeleton-001)`);
    severity = worst(severity, "medium");
  }
  if (isGptFamily(family)) {
    const present = CLAUDE_ONLY_XML.filter((x) => getBody(agent.content).includes(x));
    if (present.length > 0) {
      evidence.push(`GPT agent contains Claude-only XML: ${present.join(", ")} (gpt-no-claude-xml-001)`);
      severity = worst(severity, "medium");
    }
  }

  // Fold in any error-severity vendor findings the validator surfaced.
  const vendorErrors = vendorFindings.filter((f) => f.severity === "error");
  if (vendorErrors.length > 0) {
    evidence.push(...vendorErrors.map((f) => `validator: [${f.ruleId}] ${f.message}`));
    severity = worst(severity, "high");
  }

  const status = SEVERITY_RANK[severity] >= SEVERITY_RANK.high ? "fail" : severity === "none" ? "pass" : "warn";
  const score = status === "fail" ? 1 : status === "warn" ? 3 : 5;
  if (evidence.length === 0) evidence.push("vendor-prompting blocks correct for model family");
  return dim("L2", status, score, severity, evidence);
}

/** D5 — Role clarity & boundary (L2 judgment): pending Explore fan-out. */
function scoreRolePending() {
  return dim("L2", "pending", null, "none", [
    "judgment dimension — resolved by assess-agents.prompt.md Explore fan-out",
  ]);
}

/** D6 — Operating-frame & safety (L2): mechanical signals; frame N/A for subagents. */
function scoreFrameSafety(agent, metrics) {
  const body = getBody(agent.content);
  const evidence = [];
  let severity = "none";

  for (const p of INTERACTIVE_SHELL_PATTERNS) {
    if (p.re.test(body)) {
      evidence.push(`interactive-shell pattern '${p.id}' present (hangs chat turn)`);
      severity = worst(severity, "high");
    }
  }
  for (const s of SECRET_PATTERNS) {
    if (s.re.test(body)) {
      evidence.push(`possible hard-coded secret '${s.id}'`);
      severity = worst(severity, "high");
    }
  }

  if (!agent.isSubagent) {
    // Operating-frame signals apply to main step agents only.
    if (!metrics.uses_apex_recall) {
      evidence.push("operating-frame: no apex-recall reference (expected for step agents)");
      severity = worst(severity, "low");
    }
    if (!metrics.reads_skill_md) {
      evidence.push("operating-frame: no SKILL.md read reference");
      severity = worst(severity, "low");
    }
  } else {
    evidence.push("operating-frame N/A for subagents — safety signals only");
  }

  const status = SEVERITY_RANK[severity] >= SEVERITY_RANK.high ? "fail" : severity === "none" ? "pass" : "warn";
  const score = status === "fail" ? 1 : status === "warn" ? 4 : 5;
  evidence.push("destructive-gating depth is a judgment item — confirm in Explore fan-out");
  return dim("L2", status, score, severity, evidence);
}

/** D7 — Runtime behavior (L3): from profile JSON when available, else N/A. */
function scoreRuntime(agent, profile) {
  if (!profile) {
    return dim("L3", "na", null, "none", ["no debug-log profile supplied — pass --profile=<profile.json>"]);
  }
  const name = agent.frontmatter?.name;
  const calls = Array.isArray(profile.subagent_calls) ? profile.subagent_calls.filter((c) => c.name === name) : [];
  if (agent.isSubagent && calls.length > 0) {
    const totalWall = calls.reduce((s, c) => s + (Number(c.wall_time_s) || Number(c.duration_s) || 0), 0);
    const evidence = [`${calls.length} invocation(s) in profile`, `aggregate wall ≈ ${totalWall.toFixed(1)}s`];
    return dim("L3", "pass", null, "none", evidence);
  }
  return dim("L3", "na", null, "none", ["no per-agent attribution in supplied profile (session-level only)"]);
}

/** D8 — Adversarial (L4 judgment): pending Explore fan-out. */
function scoreAdversarialPending() {
  return dim("L4", "pending", null, "none", [
    "red-team dimension — resolved by assess-agents.prompt.md against agent-adversarial-checklist.md",
  ]);
}

// ── Composite ─────────────────────────────────────────────────────────────────
function pct(score) {
  return (score / 5) * 100;
}

function computeComposite(dimensions) {
  const buckets = {
    l1: avgScore([dimensions.mechanical_contract, dimensions.frontmatter_integrity]),
    ctx: dimensions.context_efficiency.score,
    vendor: dimensions.vendor_prompting.score,
    role: dimensions.role_clarity.score,
    frame_safety: dimensions.frame_safety.score,
    runtime: dimensions.runtime_behavior.score,
    adversarial: dimensions.adversarial.score,
  };

  let weightSum = 0;
  let weighted = 0;
  for (const [b, score] of Object.entries(buckets)) {
    if (score === null || score === undefined) continue;
    weightSum += WEIGHTS[b];
    weighted += WEIGHTS[b] * pct(score);
  }
  const mechanical = weightSum > 0 ? Math.round(weighted / weightSum) : null;
  const resolvedAll = Object.values(buckets).every((s) => s !== null && s !== undefined);
  return { mechanical, resolvedAll, buckets };
}

function avgScore(dims) {
  const vals = dims.map((d) => d.score).filter((s) => s !== null && s !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ── Validator enrichment (optional subprocess) ────────────────────────────────
/**
 * Run `validate-agents.mjs --format=json` and bucket findings by file path.
 * Returns { byFile: Map<relPath, finding[]>, available: boolean }.
 * Frontmatter/structural parts use non-recording reporters, so the JSON
 * stream carries model-alignment, vendor, and handoff findings — used for
 * D4 enrichment and a per-agent validator status signal.
 */
function runValidatorJson() {
  let raw;
  try {
    raw = execFileSync("node", ["tools/scripts/validate-agents.mjs", "--format=json"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    // Non-zero exit (errors present) still carries stdout.
    if (err && typeof err.stdout === "string" && err.stdout.trim()) raw = err.stdout;
    else return { byFile: new Map(), available: false };
  }
  try {
    const parsed = JSON.parse(raw);
    const byFile = new Map();
    for (const f of parsed.findings || []) {
      const key = path.normalize(f.file || "");
      if (!byFile.has(key)) byFile.set(key, []);
      byFile.get(key).push(f);
    }
    return { byFile, available: true };
  } catch {
    return { byFile: new Map(), available: false };
  }
}

function classifyValidatorStatus(findings) {
  if (findings.some((f) => f.severity === "error")) return "fail";
  if (findings.some((f) => f.severity === "warn")) return "warn";
  return "pass";
}

const VENDOR_CHECK_TITLES = ["Vendor Prompting Rules", "Model-Prompt Alignment"];

// ── Registry enrichment ───────────────────────────────────────────────────────
function loadRegistry() {
  try {
    const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
    const byPath = new Map();
    const walk = (group) => {
      for (const entry of Object.values(group || {})) {
        for (const sub of [entry, entry.bicep, entry.terraform]) {
          if (sub && typeof sub.agent === "string") {
            byPath.set(path.normalize(sub.agent), {
              step: entry.step ?? null,
              invokable: entry.invokable ?? null,
              registry_model: sub.model ?? null,
            });
          }
        }
      }
    };
    walk(reg.agents);
    walk(reg.subagents);
    return byPath;
  } catch {
    return new Map();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  const opts = parseArgs(process.argv.slice(2));

  let profile = null;
  if (opts.profile) {
    try {
      profile = JSON.parse(fs.readFileSync(opts.profile, "utf8"));
    } catch (err) {
      console.error(`⚠️  Could not read profile ${opts.profile}: ${err.message} — continuing with L3 = N/A`);
    }
  }

  const validator = opts.runValidators ? runValidatorJson() : { byFile: new Map(), available: false };
  const registry = loadRegistry();

  const agents = [...getAgents().values()].sort((a, b) => a.path.localeCompare(b.path));
  const scorecards = [];

  for (const agent of agents) {
    const relPath = path.normalize(agent.path);
    const metrics = computeMetrics(agent);
    const findings = validator.byFile.get(relPath) || [];
    const vendorFindings = findings.filter((f) => VENDOR_CHECK_TITLES.includes(f.check));
    const contractFindings = findings.filter((f) => !VENDOR_CHECK_TITLES.includes(f.check));
    const validatorStatus = validator.available ? classifyValidatorStatus(contractFindings) : "unavailable";

    const dimensions = {
      mechanical_contract: scoreContract(metrics, validatorStatus),
      frontmatter_integrity: scoreFrontmatter(agent, metrics),
      context_efficiency: scoreContext(agent, metrics),
      vendor_prompting: scoreVendor(agent, metrics, vendorFindings),
      role_clarity: scoreRolePending(),
      frame_safety: scoreFrameSafety(agent, metrics),
      runtime_behavior: scoreRuntime(agent, profile),
      adversarial: scoreAdversarialPending(),
    };

    const blocker = Object.values(dimensions).some((d) => d.severity === "blocker");
    const composite = computeComposite(dimensions);
    let mechanicalComposite = composite.mechanical;
    if (blocker && mechanicalComposite !== null) mechanicalComposite = Math.min(mechanicalComposite, 49);

    const reg = registry.get(relPath) || {};
    scorecards.push({
      schema_version: "agent-scorecard-v1",
      agent_id: path.basename(agent.path).replace(/\.agent\.md$/, ""),
      name: agent.frontmatter?.name || null,
      path: agent.path,
      is_subagent: agent.isSubagent,
      model: agent.frontmatter?.model ?? null,
      model_family: metrics.model_family,
      step: reg.step ?? null,
      invokable: reg.invokable ?? null,
      generated_at: new Date().toISOString(),
      metrics,
      dimensions,
      validator_status: validatorStatus,
      validator_findings: findings.map((f) => ({
        check: f.check,
        ruleId: f.ruleId,
        severity: f.severity,
        message: f.message,
      })),
      blocker,
      mechanical_composite: mechanicalComposite,
      composite: composite.resolvedAll ? composite.mechanical : null,
      judgment_pending: !composite.resolvedAll,
      composite_buckets: composite.buckets,
    });
  }

  // ── Write outputs ───────────────────────────────────────────────────────────
  const stamp = utcStamp();
  const outDir = opts.out || path.join(AGENT_OUTPUT_DIR, "_baselines", `agent-assess-${stamp}`);
  const cardsDir = path.join(outDir, "scorecards");
  fs.mkdirSync(cardsDir, { recursive: true });

  for (const card of scorecards) {
    fs.writeFileSync(path.join(cardsDir, `${card.agent_id}.json`), `${JSON.stringify(card, null, 2)}\n`);
  }

  const fleet = buildFleet(scorecards, { stamp, profile: opts.profile, validatorAvailable: validator.available });
  fs.writeFileSync(path.join(outDir, "fleet-summary.json"), `${JSON.stringify(fleet, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "fleet-summary.md"), renderFleetMd(fleet, scorecards));

  console.log(`🤖 4-Layer Agent Assessment\n`);
  console.log(
    `   agents scored        : ${fleet.totals.agents} (${fleet.totals.main} main, ${fleet.totals.subagents} subagents)`,
  );
  console.log(`   blockers             : ${fleet.totals.blockers}`);
  console.log(`   validator enrichment : ${validator.available ? "on" : "unavailable"}`);
  console.log(`   L3 runtime profile   : ${profile ? opts.profile : "N/A"}`);
  console.log(`   judgment pending     : ${fleet.totals.judgment_pending} agents (role + adversarial via prompt)`);
  console.log(`\n   → ${path.join(outDir, "fleet-summary.md")}`);
  console.log(`   → ${cardsDir}/<agent_id>.json`);
}

// ── Fleet roll-up ─────────────────────────────────────────────────────────────
function rankKey(card) {
  // Blockers first, then ascending mechanical composite (lowest = most at risk).
  const blockerRank = card.blocker ? 0 : 1;
  const comp = card.mechanical_composite ?? 100;
  return [blockerRank, comp];
}

function buildFleet(scorecards, meta) {
  const ranked = [...scorecards].sort((a, b) => {
    const [ab, ac] = rankKey(a);
    const [bb, bc] = rankKey(b);
    return ab - bb || ac - bc;
  });
  const main = scorecards.filter((c) => !c.is_subagent).length;
  const subagents = scorecards.filter((c) => c.is_subagent).length;
  const blockers = scorecards.filter((c) => c.blocker).length;
  const judgmentPending = scorecards.filter((c) => c.judgment_pending).length;

  return {
    schema_version: "agent-fleet-summary-v1",
    generated_at: new Date().toISOString(),
    stamp: meta.stamp,
    inputs: {
      profile: meta.profile || null,
      validator_enrichment: meta.validatorAvailable,
    },
    totals: {
      agents: scorecards.length,
      main,
      subagents,
      blockers,
      judgment_pending: judgmentPending,
    },
    ranking: ranked.map((c, i) => ({
      rank: i + 1,
      agent_id: c.agent_id,
      is_subagent: c.is_subagent,
      model_family: c.model_family,
      blocker: c.blocker,
      mechanical_composite: c.mechanical_composite,
      top_risks: Object.entries(c.dimensions)
        .filter(([, d]) => d.severity === "blocker" || d.severity === "high" || d.severity === "medium")
        .map(([k, d]) => `${k}:${d.severity}`),
    })),
  };
}

function renderFleetMd(fleet, scorecards) {
  const byId = new Map(scorecards.map((c) => [c.agent_id, c]));
  const lines = [];
  lines.push(`# Agent Fleet Assessment — Deterministic Pass`);
  lines.push("");
  lines.push(`> Generated ${fleet.generated_at} · stamp \`${fleet.stamp}\``);
  lines.push(">");
  lines.push(
    `> Deterministic layers only (L1 contract, L2 static, L3 runtime${fleet.inputs.profile ? "" : " = N/A"}). ` +
      `Role clarity (L2) and adversarial (L4) are **pending** the \`assess-agents.prompt.md\` Explore fan-out.`,
  );
  lines.push("");
  lines.push(`## Totals`);
  lines.push("");
  lines.push(
    `- Agents scored: **${fleet.totals.agents}** (${fleet.totals.main} main, ${fleet.totals.subagents} subagents)`,
  );
  lines.push(`- Blockers: **${fleet.totals.blockers}**`);
  lines.push(`- Validator enrichment: ${fleet.inputs.validator_enrichment ? "on" : "unavailable"}`);
  lines.push(`- L3 runtime profile: ${fleet.inputs.profile || "N/A — supply `--profile=<profile.json>`"}`);
  lines.push(`- Judgment pending (role + adversarial): **${fleet.totals.judgment_pending}**`);
  lines.push("");
  lines.push(`## Risk ranking`);
  lines.push("");
  lines.push(`Blockers first, then ascending mechanical composite (lowest = most at risk).`);
  lines.push("");
  lines.push(`| Rank | Agent | Kind | Family | Blocker | Mech. composite | Top risks |`);
  lines.push(`| ---- | ----- | ---- | ------ | ------- | --------------- | --------- |`);
  for (const row of fleet.ranking) {
    const kind = row.is_subagent ? "sub" : "main";
    const comp = row.mechanical_composite ?? "—";
    const risks = row.top_risks.length ? row.top_risks.join(", ") : "—";
    lines.push(
      `| ${row.rank} | ${row.agent_id} | ${kind} | ${row.model_family} | ${row.blocker ? "⚠️ yes" : "no"} | ${comp} | ${risks} |`,
    );
  }
  lines.push("");
  lines.push(`## Per-agent deterministic findings`);
  lines.push("");
  for (const row of fleet.ranking) {
    const card = byId.get(row.agent_id);
    lines.push(`### ${card.agent_id}${card.is_subagent ? " (subagent)" : ""}`);
    lines.push("");
    lines.push(
      `- Model: \`${card.model_family}\` · body ${card.metrics.body_lines} · tools ${card.metrics.tool_count} · ` +
        `handoffs ${card.metrics.handoff_count} · skill-reads ${card.metrics.skill_read_count} · desc ${card.metrics.description_length}`,
    );
    for (const [name, d] of Object.entries(card.dimensions)) {
      if (d.status === "pass" || d.status === "na") continue;
      const tag = d.status === "pending" ? "pending" : `${d.status}/${d.severity}`;
      lines.push(`- **${name}** (${d.layer}, ${tag}): ${d.evidence[0]}`);
    }
    lines.push("");
  }
  lines.push(`## Next step`);
  lines.push("");
  lines.push(
    `Run \`assess-agents.prompt.md\` to resolve the pending judgment dimensions (role clarity, adversarial) ` +
      `via per-agent Explore fan-out, then aggregate into final composites and a ranked remediation plan (read-only; gated before edits).`,
  );
  lines.push("");
  return lines.join("\n");
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  try {
    main();
  } catch (err) {
    console.error(`assess-agents crashed: ${err.stack || err.message}`);
    process.exit(1);
  }
}

export { computeMetrics, scoreContract, scoreContext, scoreVendor, computeComposite, skillReads };
