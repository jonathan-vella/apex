#!/usr/bin/env node
/**
 * VS Code 1.109 Agent Frontmatter Validator
 *
 * Validates that all agent files conform to VS Code 1.109 agent definition spec:
 * - Required frontmatter fields present
 * - user-invocable correctly set (false/never for subagents)
 * - agents list syntax valid
 * - handoffs have send property
 * - model fallback configuration present
 *
 * @example
 * node scripts/validate-agent-frontmatter.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./_lib/parse-frontmatter.mjs";
import { getAgents } from "./_lib/workspace-index.mjs";

// Required fields for main agents (user-invocable: true)
const MAIN_AGENT_REQUIRED = ["name", "description", "user-invocable", "tools"];

// Required fields for subagents (user-invocable: false/never)
const SUBAGENT_REQUIRED = ["name", "description", "user-invocable", "tools"];

// Recommended fields for 1.109 orchestration
const RECOMMENDED_FIELDS = ["agents", "model"];

let errors = 0;
let warnings = 0;

// Block scalar check — must run on raw content before parsing
const BLOCK_SCALAR_PATTERN = /^description:\s*[>|][-\s]*$/m;

/**
 * Validate a single agent file
 */
function validateAgent(filePath, isSubagent) {
  const content = fs.readFileSync(filePath, "utf8");
  const frontmatter = parseFrontmatter(content);
  const relativePath = path.relative(process.cwd(), filePath);

  // Check for block scalar description BEFORE parsing (parser swallows it)
  if (BLOCK_SCALAR_PATTERN.test(content)) {
    console.error(
      `❌ ${relativePath}: description uses a YAML block scalar (>, >-, | or |-)`,
    );
    console.error(
      `  Fix: Replace with a single-line description: "..." inline string.`,
    );
    console.error(
      `  Block scalars break VS Code prompts-diagnostics-provider.`,
    );
    errors++;
  }

  if (!frontmatter) {
    console.error(`❌ ${relativePath}: No frontmatter found`);
    console.error(
      `  Fix: Add YAML frontmatter at the top: ---\nname: ...\ndescription: ...\nuser-invocable: true\ntools: []\n---`,
    );
    errors++;
    return;
  }

  const requiredFields = isSubagent ? SUBAGENT_REQUIRED : MAIN_AGENT_REQUIRED;

  // Check required fields
  for (const field of requiredFields) {
    if (!(field in frontmatter)) {
      console.error(`❌ ${relativePath}: Missing required field '${field}'`);
      console.error(
        `  Fix: Add '${field}: ...' to the YAML frontmatter block.`,
      );
      errors++;
    }
  }

  // Validate user-invocable for subagents
  if (isSubagent) {
    const userInvokable = frontmatter["user-invocable"];
    if (
      userInvokable !== "false" &&
      userInvokable !== "never" &&
      userInvokable !== false
    ) {
      console.error(
        `❌ ${relativePath}: Subagent must have user-invocable: false or never (got: ${userInvokable})`,
      );
      errors++;
    }
  } else {
    // Main agents should be user-invocable
    const userInvokable = frontmatter["user-invocable"];
    if (
      userInvokable !== "true" &&
      userInvokable !== "always" &&
      userInvokable !== true
    ) {
      console.warn(
        `⚠️  ${relativePath}: Main agent should have user-invocable: true (got: ${userInvokable})`,
      );
      warnings++;
    }
  }

  // Check recommended fields for main agents
  if (!isSubagent) {
    for (const field of RECOMMENDED_FIELDS) {
      if (!(field in frontmatter)) {
        console.warn(
          `⚠️  ${relativePath}: Missing recommended 1.109 field '${field}'`,
        );
        warnings++;
      }
    }
  }

  // Validate agents list format (should be array)
  if ("agents" in frontmatter) {
    if (!Array.isArray(frontmatter.agents)) {
      console.error(
        `❌ ${relativePath}: 'agents' parsed as ${typeof frontmatter.agents}, expected array`,
      );
      errors++;
    }
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
        console.warn(
          `⚠️  ${relativePath}: Handoffs missing 'send' property (1.109 feature)`,
        );
        warnings++;
      }
    }
  }

  // Check model configuration
  if ("model" in frontmatter) {
    const model = frontmatter.model;
    if (Array.isArray(model) && model.length > 1) {
      console.log(
        `✓ ${relativePath}: Model fallback configured (${model.length} models)`,
      );
    }
  }

  console.log(`✓ ${relativePath}: Frontmatter valid`);
}

/**
 * Find agent files in a directory
 */
function findAgentFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".agent.md"))
    .map((f) => path.join(dir, f));
}

console.log("\n🔍 Agent Frontmatter Validator\n");

const agents = getAgents();
let mainCount = 0;
let subCount = 0;

for (const [file, agent] of agents) {
  validateAgent(agent.path, agent.isSubagent);
  if (agent.isSubagent) subCount++;
  else mainCount++;
}

console.log(`\nFound ${mainCount} main agents and ${subCount} subagents`);

console.log("\n" + "=".repeat(60));
if (errors > 0) {
  console.error(
    `❌ Validation FAILED: ${errors} error(s), ${warnings} warning(s)`,
  );
  process.exit(1);
} else if (warnings > 0) {
  console.log(`⚠️  Validation passed with ${warnings} warning(s)`);
  process.exit(0);
} else {
  console.log("✅ All agents passed validation");
  process.exit(0);
}
