#!/usr/bin/env node
/**
 * Stage 4 (Plan 2 / Sensei GEPA Pipeline) — Waza trigger-test scaffolder.
 *
 * Reads a skill's `description:` frontmatter, parses the WHEN / USE FOR /
 * DO NOT USE FOR clauses, and writes:
 *
 *   tests/{skill}/trigger_tests.yaml   (Waza native format — primary)
 *   tests/{skill}/triggers.test.ts     (TS shim — discovered by the GEPA
 *                                       auto_evaluator's regex parser)
 *
 * The `.ts` shim is regenerated from the YAML on every run so the two stay
 * in lockstep. Editing the YAML by hand and re-running the scaffolder is the
 * recommended workflow.
 *
 * Usage:
 *   node tools/scripts/scaffold-trigger-tests.mjs --skills azure-adr azure-artifacts ...
 *   node tools/scripts/scaffold-trigger-tests.mjs --batch 1
 *   node tools/scripts/scaffold-trigger-tests.mjs --all
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

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

/** Extract single-quoted YAML string value from a frontmatter line. */
function readDescription(skillMd) {
  const fmEnd = skillMd.indexOf("\n---", 4);
  if (fmEnd < 0) throw new Error("No frontmatter end marker");
  const fm = skillMd.slice(0, fmEnd);
  const m = fm.match(/^description:\s*'((?:[^']|'')+)'/ms);
  if (!m) throw new Error("No description: line found");
  return m[1].replace(/''/g, "'");
}

/** Pull the comma-separated phrases that follow a label (`WHEN:`, `USE FOR:`, ...). */
function extractClause(description, label) {
  // The description format is `... WHEN: "a", "b". USE FOR: c, d. DO NOT USE FOR: ...`.
  // Phrases for WHEN: are quoted; phrases for USE FOR: / DO NOT USE FOR: are usually
  // bare comma-separated noun phrases.
  const re = new RegExp(
    `${label}:\\s*([\\s\\S]*?)(?=\\.\\s+(?:WHEN|USE FOR|DO NOT USE FOR|INVOKES|FOR SINGLE OPERATIONS)[:\\.]|\\.?$)`,
    "i",
  );
  const m = description.match(re);
  if (!m) return [];
  return m[1].trim();
}

/** Split a clause body into a list of phrases. Handles both quoted and bare forms. */
function splitPhrases(clauseBody) {
  if (!clauseBody) return [];
  const phrases = [];
  // Pull all quoted phrases first.
  const quoted = clauseBody.match(/"([^"]+)"/g);
  if (quoted && quoted.length) {
    for (const q of quoted) phrases.push(q.slice(1, -1).trim());
    return phrases;
  }
  // Otherwise split on commas, but not commas inside parentheses.
  let depth = 0;
  let cur = "";
  for (const ch of clauseBody) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      if (cur.trim()) phrases.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) phrases.push(cur.trim());
  // Drop trailing punctuation.
  return phrases.map((p) => p.replace(/\.$/, "").trim()).filter(Boolean);
}

/** Strip "(use foo)" parenthetical disambiguators from a USE-FOR or DO-NOT-USE-FOR phrase. */
function stripParentheses(phrase) {
  return phrase
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull "use {skill}" hints out of DO NOT USE FOR parentheticals. */
function competingSkills(doNotUseFor) {
  const out = new Set();
  // Match `use foo-bar`, `use foo` (alpha + optional hyphens). Excludes
  // alphanumeric agent ids like `06b`, `06b/06t`, etc.
  const matches = doNotUseFor.matchAll(/use ([a-z][a-z]+(?:-[a-z]+)*)/gi);
  for (const m of matches) {
    const name = m[1].toLowerCase();
    if (!name || name === "this" || name === "the" || name === "for") continue;
    // Must look like a skill name (contains a hyphen) OR be a known short alias.
    if (name.includes("-") || ["drawio", "mermaid"].includes(name)) {
      out.add(name);
    }
  }
  return [...out];
}

/** Capitalize first character (like `cap('hello')` -> 'Hello'). */
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Lowercase the first character ONLY if it's a leading capital followed by a
 * lowercase letter. Acronyms like `ADR`, `WAF`, `KQL` stay untouched.
 */
function lowerFirst(s) {
  if (!s) return s;
  const a = s.charAt(0);
  const b = s.charAt(1);
  // Lowercase only when the first char is uppercase AND the second is lowercase
  // (so 'Deploy' -> 'deploy' but 'ADR' stays 'ADR' and 'WAF pillar' stays 'WAF pillar').
  if (a >= "A" && a <= "Z" && b >= "a" && b <= "z") {
    return a.toLowerCase() + s.slice(1);
  }
  return s;
}

/** Generate variants from an affirmative phrase per the Waza template rules. */
function expandShouldTrigger(phrases, skillName) {
  const out = [];
  for (const raw of phrases) {
    const p = stripParentheses(raw);
    if (!p) continue;
    const lower = lowerFirst(p);
    out.push(p); // exact match
    out.push(`How do I ${lower}?`); // question form
    out.push(`${cap(p)} now`); // command form
    out.push(`${p} for my project`); // context-rich
  }
  // Deduplicate while preserving order.
  return [...new Set(out)];
}

/** Generate anti-trigger variants. */
function expandShouldNotTrigger(rawPhrases, competing) {
  const out = [];
  for (const raw of rawPhrases) {
    const p = stripParentheses(raw);
    if (!p) continue;
    out.push(p); // exact anti-trigger
    out.push(`How do I ${lowerFirst(p)}?`);
  }
  // Synthetic competing-skill triggers.
  for (const sk of competing) {
    out.push(`use ${sk}`);
    out.push(`run ${sk}`);
  }
  // Generic unrelated probes (always present, prevents over-fitting).
  out.push("What is the weather today?");
  out.push("Help me write a poem");
  return [...new Set(out)];
}

/** Build the Waza YAML body. */
function renderYaml(skillName, shouldTrigger, shouldNotTrigger) {
  const lines = [];
  lines.push(`# Generated by tools/scripts/scaffold-trigger-tests.mjs`);
  lines.push(`# Source: .github/skills/${skillName}/SKILL.md frontmatter description`);
  lines.push(`# Edit the YAML by hand — the .ts shim is regenerated from this file.`);
  lines.push("");
  lines.push(`name: ${skillName}-triggers`);
  lines.push(`skill: ${skillName}`);
  lines.push("");
  lines.push("# Prompts that SHOULD activate this skill");
  lines.push('# Generated from "WHEN:" + "USE FOR:" clauses');
  lines.push("shouldTriggerPrompts:");
  for (const p of shouldTrigger) lines.push(`  - ${JSON.stringify(p)}`);
  lines.push("");
  lines.push("# Prompts that should NOT activate this skill");
  lines.push('# Generated from "DO NOT USE FOR:" clause + competing-skill hints');
  lines.push("shouldNotTriggerPrompts:");
  for (const p of shouldNotTrigger) lines.push(`  - ${JSON.stringify(p)}`);
  lines.push("");
  return lines.join("\n");
}

/** Build the TS shim for GEPA evaluator discovery. */
function renderTsShim(skillName, shouldTrigger, shouldNotTrigger) {
  const lines = [];
  lines.push("// Auto-generated by tools/scripts/scaffold-trigger-tests.mjs.");
  lines.push(`// Source of truth: tests/${skillName}/trigger_tests.yaml`);
  lines.push("// Re-run the scaffolder after editing the YAML.");
  lines.push("//");
  lines.push("// This shim exists so the sensei GEPA auto-evaluator");
  lines.push("// (.github/skills/sensei/scripts/src/gepa/auto_evaluator.py) can");
  lines.push("// discover trigger arrays via its regex-based parser.");
  lines.push("");
  lines.push("export const shouldTriggerPrompts: string[] = [");
  for (const p of shouldTrigger) lines.push(`  ${JSON.stringify(p)},`);
  lines.push("];");
  lines.push("");
  lines.push("export const shouldNotTriggerPrompts: string[] = [");
  for (const p of shouldNotTrigger) lines.push(`  ${JSON.stringify(p)},`);
  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

function scaffold(skillName) {
  const skillPath = join(REPO_ROOT, ".github", "skills", skillName, "SKILL.md");
  if (!existsSync(skillPath)) throw new Error(`Skill not found: ${skillPath}`);
  const md = readFileSync(skillPath, "utf8");
  const desc = readDescription(md);

  const whenPhrases = splitPhrases(extractClause(desc, "WHEN"));
  const useForPhrases = splitPhrases(extractClause(desc, "USE FOR"));
  const doNotPhrases = splitPhrases(extractClause(desc, "DO NOT USE FOR"));
  const competing = competingSkills(extractClause(desc, "DO NOT USE FOR"));

  const shouldTrigger = expandShouldTrigger([...whenPhrases, ...useForPhrases], skillName);
  const shouldNotTrigger = expandShouldNotTrigger(doNotPhrases, competing);

  const testsDir = join(REPO_ROOT, "tests", skillName);
  mkdirSync(testsDir, { recursive: true });
  writeFileSync(join(testsDir, "trigger_tests.yaml"), renderYaml(skillName, shouldTrigger, shouldNotTrigger));
  writeFileSync(join(testsDir, "triggers.test.ts"), renderTsShim(skillName, shouldTrigger, shouldNotTrigger));

  return {
    skill: skillName,
    shouldTriggerCount: shouldTrigger.length,
    shouldNotTriggerCount: shouldNotTrigger.length,
    whenPhrases: whenPhrases.length,
    useForPhrases: useForPhrases.length,
    doNotPhrases: doNotPhrases.length,
    competingHints: competing.length,
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opt = { skills: [], all: false, batch: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") opt.all = true;
    else if (args[i] === "--batch") opt.batch = Number(args[++i]);
    else if (args[i] === "--skills") {
      while (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        opt.skills.push(args[++i]);
      }
    } else {
      throw new Error(`Unknown arg: ${args[i]}`);
    }
  }
  return opt;
}

function main() {
  const opt = parseArgs();
  let targets = opt.skills.slice();
  if (opt.batch != null) {
    const bs = BATCHES[opt.batch];
    if (!bs) throw new Error(`Unknown batch: ${opt.batch}`);
    targets = targets.concat(bs);
  }
  if (opt.all) {
    for (const bs of Object.values(BATCHES)) targets = targets.concat(bs);
  }
  if (!targets.length) {
    console.error("Usage: --skills <name…> | --batch <1-5> | --all");
    process.exit(2);
  }
  // Deduplicate.
  targets = [...new Set(targets)];

  const summary = [];
  for (const skill of targets) {
    try {
      summary.push(scaffold(skill));
      console.log(`✓ ${skill}`);
    } catch (err) {
      console.error(`✗ ${skill}: ${err.message}`);
      process.exitCode = 1;
    }
  }
  console.log("");
  console.log(`Scaffolded ${summary.length} skill(s).`);
  for (const s of summary) {
    console.log(
      `  ${s.skill}: ${s.shouldTriggerCount} trigger / ${s.shouldNotTriggerCount} anti-trigger ` +
        `(WHEN ${s.whenPhrases}, USE FOR ${s.useForPhrases}, DO NOT USE FOR ${s.doNotPhrases}, competing ${s.competingHints})`,
    );
  }
}

main();
