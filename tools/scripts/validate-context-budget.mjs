#!/usr/bin/env node
/**
 * Context Budget Validator
 *
 * Structural floor for the per-step file re-read budget defined in
 * `.github/instructions/agent-skills.instructions.md` → "Per-Step File
 * Re-Read Budget (HARD LIMIT)".
 *
 * Rule: any agent whose body references one of the FROZEN_ARTIFACTS as a
 * required prerequisite must ALSO declare:
 *   1. A cached-lookup escape hatch — phrase `apex-recall show` (the
 *      session-state cache path that replaces a redundant disk read).
 *   2. A re-read prohibition marker — at least one of:
 *      "do not re-read predecessor artifacts",
 *      "no self-edit",
 *      "frozen_inputs",
 *      "plan_readonly",
 *      "Plan-Lock", or
 *      "Plan-Readiness Precondition".
 *
 * Subagents (`isSubagent: true`) are exempt — they receive a compressed
 * digest from the parent and never declare prerequisites of their own.
 *
 * @example
 *   node tools/scripts/validate-context-budget.mjs
 *   node tools/scripts/validate-context-budget.mjs --json
 */

import { getAgents } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const FROZEN_ARTIFACTS = [
  "04-implementation-plan.md",
  "04-governance-constraints.md",
  "04-governance-constraints.json",
  "02-architecture-assessment.md",
];

const CACHE_MARKERS = ["apex-recall show"];
const NO_REREAD_MARKERS = [
  "do not re-read predecessor artifacts",
  "no self-edit",
  "frozen_inputs",
  "plan_readonly",
  "plan-lock",
  "plan-readiness precondition",
];

function bodyMentions(content, needle) {
  return content.toLowerCase().includes(needle.toLowerCase());
}

// Helper retained for future use by the consumer-detection logic below.
// Currently unused; the `_` prefix satisfies the no-unused-vars rule.
function _referencesFrozen(content) {
  return FROZEN_ARTIFACTS.some((a) => content.includes(a));
}

/**
 * The budget applies to *consumers* of frozen artifacts, not producers.
 * A consumer marks at least one frozen artifact as a hard prerequisite —
 * i.e. the body contains a line that pairs the artifact filename with
 * `**REQUIRED**`. Producers (e.g. 02-Requirements, 03-Architect,
 * 04g-Governance) reference the artifact name only as an output and are
 * exempt.
 */
function isFrozenArtifactConsumer(content) {
  return FROZEN_ARTIFACTS.some((artifact) => {
    // Look for "`artifact` — **REQUIRED**" or "**REQUIRED**. … artifact"
    // patterns on the same line.
    const lines = content.split("\n");
    return lines.some((line) => line.includes(artifact) && line.includes("**REQUIRED**"));
  });
}

function hasCacheMarker(content) {
  return CACHE_MARKERS.some((m) => bodyMentions(content, m));
}

function hasNoRereadMarker(content) {
  return NO_REREAD_MARKERS.some((m) => bodyMentions(content, m));
}

const r = new Reporter("Context Budget Validator");
r.header();

const agents = getAgents();
let evaluated = 0;

for (const [file, agent] of agents) {
  // Subagents are exempt — they consume a compressed digest from the parent.
  if (agent.isSubagent) continue;

  // The budget only applies to *consumers* of frozen artifacts. An agent
  // is a consumer when at least one frozen artifact appears on the same
  // line as `**REQUIRED**` in its body. Producers (Requirements,
  // Architect, Design, Governance, Planner) reference these filenames as
  // outputs only and are exempt.
  if (!isFrozenArtifactConsumer(agent.content)) continue;

  evaluated++;
  r.tick();

  const missingCache = !hasCacheMarker(agent.content);
  const missingNoReread = !hasNoRereadMarker(agent.content);

  if (missingCache || missingNoReread) {
    const reasons = [];
    if (missingCache) {
      reasons.push("missing `apex-recall show` cached-lookup escape hatch");
    }
    if (missingNoReread) {
      reasons.push(
        "missing re-read prohibition marker (one of: do not re-read predecessor artifacts | no self-edit | frozen_inputs | plan_readonly | plan-lock | plan-readiness precondition)",
      );
    }
    r.error(
      file,
      `references frozen artifact(s) but ${reasons.join(" and ")}. See .github/instructions/agent-skills.instructions.md → Per-Step File Re-Read Budget.`,
    );
  }
}

console.log(`\nEvaluated ${evaluated} agent(s) referencing frozen artifacts.`);

r.summary();
r.exitOnError(
  "Context budget: all agents declare cached-lookup + no-re-read markers.",
  "Context budget violations found — add the markers documented in agent-skills.instructions.md.",
);
