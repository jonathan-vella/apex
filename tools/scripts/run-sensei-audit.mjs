#!/usr/bin/env node
/**
 * Sensei Audit Wrapper — repeatable audit runs for the skills programme.
 *
 * Wraps two upstream sensei tools (token CLI + GEPA score evaluator) and
 * emits a single JSON record per skill that the batch-report generator
 * consumes. Read-only — never edits SKILL.md files.
 *
 * @example
 * # Audit a batch of skills (alphabetical chunks per the programme plan)
 * node tools/scripts/run-sensei-audit.mjs --batch 1
 *
 * # Audit specific skills
 * node tools/scripts/run-sensei-audit.mjs --skills azure-adr,azure-compute
 *
 * # Audit all 33 skills (Phase 3 final audit)
 * node tools/scripts/run-sensei-audit.mjs --all
 *
 * Plan: .github/prompts/plan-skillsAuditOptimize.prompt.md
 * Tracker: .github/skills/_audits/TODO.md
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const SKILLS_DIR = path.join(REPO_ROOT, ".github/skills");
const SENSEI_DIR = path.join(SKILLS_DIR, "sensei");
const GEPA_SCRIPT = path.join(SENSEI_DIR, "scripts/src/gepa/auto_evaluator.py");
// Per-batch skill manifest (alphabetical) — must mirror the programme plan.
// Single source of truth; if you change batches in the prompt file, change here too.
const BATCHES = {
  1: [
    "azure-adr",
    "azure-artifacts",
    "azure-bicep-patterns",
    "azure-cloud-migrate",
    "azure-compliance",
    "azure-compute",
    "azure-cost-optimization",
  ],
  2: [
    "azure-defaults",
    "azure-deploy",
    "azure-diagnostics",
    "azure-governance-discovery",
    "azure-kusto",
    "azure-prepare",
    "azure-quotas",
  ],
  3: [
    "azure-rbac",
    "azure-resources",
    "azure-storage",
    "azure-validate",
    "context-management",
    "docs-writer",
    "drawio",
  ],
  4: ["entra-app-registration", "github-operations", "golden-principles", "iac-common", "mermaid", "microsoft-docs"],
  5: [
    "python-diagrams",
    "terraform-patterns",
    "terraform-search-import",
    "terraform-test",
    "vendor-prompting",
    "workflow-engine",
  ],
};

function parseArgs(argv) {
  const args = { batch: null, skills: null, all: false, output: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--batch") args.batch = Number(argv[++i]);
    else if (a === "--skills") args.skills = argv[++i].split(",");
    else if (a === "--all") args.all = true;
    else if (a === "--output") args.output = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log("Usage: run-sensei-audit.mjs [--batch N | --skills a,b | --all] [--output file.json]");
      process.exit(0);
    }
  }
  return args;
}

function resolveTargets(args) {
  if (args.all) {
    return Object.values(BATCHES).flat();
  }
  if (args.batch !== null) {
    const list = BATCHES[args.batch];
    if (!list) {
      throw new Error(`Unknown batch: ${args.batch}. Valid: 1-5.`);
    }
    return list;
  }
  if (args.skills) return args.skills;
  throw new Error("Specify --batch N, --skills a,b, or --all");
}

function countTokens(skillName) {
  // Use the sensei token CLI; it lives inside the submodule so cd into it.
  const skillMd = path.join("..", skillName, "SKILL.md");
  const result = spawnSync("npm", ["run", "tokens", "--silent", "--", "count", skillMd], {
    cwd: SENSEI_DIR,
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  // Parse: "../azure-adr/SKILL.md      1786      7144     168"
  const line = result.stdout.split("\n").find((l) => l.includes(skillMd) && /\s+\d+\s+\d+\s+\d+\s*$/.test(l));
  if (!line) return null;
  const cols = line.trim().split(/\s+/);
  return {
    tokens: Number(cols[cols.length - 3]),
    chars: Number(cols[cols.length - 2]),
    lines: Number(cols[cols.length - 1]),
  };
}

function gepaScore(skillName) {
  // GEPA score subcommand is deterministic — no LLM calls, no gepa pkg needed.
  const result = spawnSync(
    "python3",
    [GEPA_SCRIPT, "score", "--skill", skillName, "--skills-dir", ".github/skills", "--tests-dir", "tests", "--json"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (result.status !== 0) {
    return { error: result.stderr.trim() || "score command failed" };
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { error: "non-JSON output", raw: result.stdout };
  }
}

function getFrontmatter(skillName) {
  const file = path.join(SKILLS_DIR, skillName, "SKILL.md");
  if (!fs.existsSync(file)) return { error: "SKILL.md not found" };
  const content = fs.readFileSync(file, "utf8");
  if (!content.startsWith("---")) return { error: "no frontmatter" };
  const end = content.indexOf("---", 3);
  if (end === -1) return { error: "unterminated frontmatter" };
  const fm = content.slice(3, end).trim();
  // Lightweight parser — captures key fields without a YAML lib dependency.
  const data = {};
  for (const line of fm.split("\n")) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) data[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return data;
}

function classifyAdherence(score, fmDescription) {
  if (!fmDescription) return "Invalid";
  if (fmDescription.length > 1024) return "Invalid";
  if (fmDescription.length < 150) return "Low";
  const wordCount = fmDescription.split(/\s+/).length;
  const hasWhen = /\bWHEN:/i.test(fmDescription);
  const hasUseFor = /\bUSE FOR:/i.test(fmDescription);
  const hasInvokes = /\bINVOKES:/i.test(fmDescription);
  const hasPrefix = /\*\*(WORKFLOW|UTILITY|ANALYSIS) SKILL\*\*/i.test(fmDescription);
  if (!hasWhen && !hasUseFor) return "Low";
  if (wordCount > 60) return "Medium";
  if (hasInvokes && hasPrefix) return "High";
  return "Medium-High";
}

function auditSkill(skillName) {
  const tokens = countTokens(skillName);
  const score = gepaScore(skillName);
  const fm = getFrontmatter(skillName);
  return {
    skill: skillName,
    timestamp: new Date().toISOString(),
    frontmatter: {
      name: fm.name,
      description: fm.description,
      description_length: fm.description?.length ?? 0,
      adherence: classifyAdherence(score.quality_score, fm.description),
    },
    tokens,
    gepa: score,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const targets = resolveTargets(args);
  const results = targets.map(auditSkill);
  const output = JSON.stringify(results, null, 2);
  if (args.output) {
    fs.writeFileSync(args.output, output);
    console.error(`Wrote ${results.length} audit records → ${args.output}`);
  } else {
    console.log(output);
  }
}

main();
