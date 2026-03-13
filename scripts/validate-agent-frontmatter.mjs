#!/usr/bin/env node
/**
 * Agent Frontmatter & Body Size Validator
 *
 * Validates that all agent files conform to VS Code 1.109 agent definition spec:
 * - Required frontmatter fields present
 * - user-invocable correctly set (false/never for subagents)
 * - agents list syntax valid
 * - handoffs have send property
 * - model fallback configuration present
 * - Body size ≤ MAX_BODY_LINES (context optimization)
 *
 * @example
 * node scripts/validate-agent-frontmatter.mjs
 */

import { getAgents } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { MAX_BODY_LINES } from "./_lib/paths.mjs";

const MAIN_AGENT_REQUIRED = ["name", "description", "user-invocable", "tools"];
const SUBAGENT_REQUIRED = ["name", "description", "user-invocable", "tools"];
const RECOMMENDED_FIELDS = ["agents", "model"];
const BLOCK_SCALAR_PATTERN = /^description:\s*[>|][-\s]*$/m;

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

  // Check for block scalar description BEFORE parsing (parser swallows it)
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

  // Validate user-invocable for subagents
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
    if (ui !== "true" && ui !== "always" && ui !== true) {
      r.warn(
        relativePath,
        `Main agent should have user-invocable: true (got: ${ui})`,
      );
    }
  }

  // Check recommended fields for main agents
  if (!isSubagent) {
    for (const field of RECOMMENDED_FIELDS) {
      if (!(field in frontmatter)) {
        r.warn(relativePath, `Missing recommended 1.109 field '${field}'`);
      }
    }
  }

  // Validate agents list format
  if ("agents" in frontmatter && !Array.isArray(frontmatter.agents)) {
    r.error(
      relativePath,
      `'agents' parsed as ${typeof frontmatter.agents}, expected array`,
    );
  }

  // Check for handoffs with send property
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

  // Body size check (merged from validate-agent-body-size)
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
r.exitOnError("All agents passed validation", "Agent validation FAILED");
