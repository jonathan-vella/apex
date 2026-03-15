#!/usr/bin/env node
/**
 * Agent Checks Validator
 *
 * Combined agent validation in a single pass over getAgents():
 * 1. Body size: agent body should not exceed MAX_BODY_LINES
 * 2. Language density: absolute-language keywords per 100 lines
 *
 * Replaces validate-agent-body-size.mjs and lint-agent-language.mjs.
 *
 * @example
 * node scripts/lint-agent-checks.mjs
 */

import { getAgents } from "./_lib/workspace-index.mjs";
import { getBody } from "./_lib/parse-frontmatter.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { MAX_BODY_LINES } from "./_lib/paths.mjs";

const r = new Reporter("Agent Checks Validator");
r.header();

// --- Language density config ---

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

// --- Main loop: single pass over all agents ---

const agents = getAgents();

for (const [file, agent] of agents) {
  r.tick();
  const { path: filePath, content } = agent;
  const body = getBody(content);
  const bodyLines = body.split("\n").length;

  // Check 1: Body size
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

  // Check 2: Language density
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
r.exitOnError("Agent checks passed");
