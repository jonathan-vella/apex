#!/usr/bin/env node
/**
 * VS Code 1.109 Agent Frontmatter Validator
 *
 * Validates that all agent files conform to VS Code 1.109 agent definition spec:
 * - Required frontmatter fields present
 * - user-invokable correctly set (false/never for subagents)
 * - agents list syntax valid
 * - handoffs have send property
 * - model fallback configuration present
 *
 * @example
 * node scripts/validate-agent-frontmatter.mjs
 */

import fs from "node:fs";
import path from "node:path";

const AGENTS_DIR = ".github/agents";
const SUBAGENTS_DIR = ".github/agents/_subagents";

// Required fields for main agents (user-invokable: true)
const MAIN_AGENT_REQUIRED = ["name", "description", "user-invokable", "tools"];

// Required fields for subagents (user-invokable: false/never)
const SUBAGENT_REQUIRED = ["name", "description", "user-invokable", "tools"];

// Recommended fields for 1.109 orchestration
const RECOMMENDED_FIELDS = ["agents", "model"];

let errors = 0;
let warnings = 0;

/**
 * Parse YAML-like frontmatter from markdown file
 * Note: This is a simple parser, not full YAML
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split("\n");
  let currentKey = null;
  let currentValue = [];
  let inArray = false;
  let inMultilineString = false;

  for (const line of lines) {
    // Handle array continuation
    if (inArray) {
      if (line.trim().startsWith("-") || line.trim().startsWith('"')) {
        const value = line
          .trim()
          .replace(/^-\s*/, "")
          .replace(/["\[\],]/g, "")
          .trim();
        if (value) currentValue.push(value);
        continue;
      } else if (line.trim() === "]" || line.trim().endsWith("]")) {
        frontmatter[currentKey] = currentValue;
        inArray = false;
        currentKey = null;
        currentValue = [];
        continue;
      } else if (line.trim() && !line.startsWith(" ") && line.includes(":")) {
        // New key, save current array
        frontmatter[currentKey] = currentValue;
        inArray = false;
        currentValue = [];
      }
    }

    // Handle multiline string (>)
    if (inMultilineString) {
      if (line.startsWith("  ")) {
        currentValue.push(line.trim());
        continue;
      } else {
        frontmatter[currentKey] = currentValue.join(" ");
        inMultilineString = false;
        currentKey = null;
        currentValue = [];
      }
    }

    // Parse key: value
    const keyMatch = line.match(/^([a-z-]+):\s*(.*)/i);
    if (keyMatch) {
      currentKey = keyMatch[1].toLowerCase();
      const rawValue = keyMatch[2].trim();

      // Check for array start
      if (rawValue === "[" || rawValue.startsWith("[")) {
        inArray = true;
        currentValue = [];
        // Handle inline array like [value1, value2]
        if (rawValue.includes("]")) {
          const values = rawValue
            .replace(/[\[\]]/g, "")
            .split(",")
            .map((v) => v.trim().replace(/"/g, ""))
            .filter(Boolean);
          frontmatter[currentKey] = values;
          inArray = false;
          currentKey = null;
        }
        continue;
      }

      // Check for multiline string
      if (rawValue === ">" || rawValue === "|") {
        inMultilineString = true;
        currentValue = [];
        continue;
      }

      // Simple value
      frontmatter[currentKey] = rawValue.replace(/^["']|["']$/g, "");
    }
  }

  // Handle any remaining array
  if (inArray && currentKey) {
    frontmatter[currentKey] = currentValue;
  }
  if (inMultilineString && currentKey) {
    frontmatter[currentKey] = currentValue.join(" ");
  }

  return frontmatter;
}

/**
 * Validate a single agent file
 */
function validateAgent(filePath, isSubagent) {
  const content = fs.readFileSync(filePath, "utf8");
  const frontmatter = parseFrontmatter(content);
  const relativePath = path.relative(process.cwd(), filePath);

  if (!frontmatter) {
    console.error(`❌ ${relativePath}: No frontmatter found`);
    errors++;
    return;
  }

  const requiredFields = isSubagent ? SUBAGENT_REQUIRED : MAIN_AGENT_REQUIRED;

  // Check required fields
  for (const field of requiredFields) {
    if (!(field in frontmatter)) {
      console.error(`❌ ${relativePath}: Missing required field '${field}'`);
      errors++;
    }
  }

  // Validate user-invokable for subagents
  if (isSubagent) {
    const userInvokable = frontmatter["user-invokable"];
    if (
      userInvokable !== "false" &&
      userInvokable !== "never" &&
      userInvokable !== false
    ) {
      console.error(
        `❌ ${relativePath}: Subagent must have user-invokable: false or never (got: ${userInvokable})`,
      );
      errors++;
    }
  } else {
    // Main agents should be user-invokable
    const userInvokable = frontmatter["user-invokable"];
    if (
      userInvokable !== "true" &&
      userInvokable !== "always" &&
      userInvokable !== true
    ) {
      console.warn(
        `⚠️  ${relativePath}: Main agent should have user-invokable: true (got: ${userInvokable})`,
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
      console.warn(`⚠️  ${relativePath}: 'agents' should be an array`);
      warnings++;
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

/**
 * Main validation function
 */
function main() {
  console.log("🔍 VS Code 1.109 Agent Frontmatter Validator\n");

  // Find all agent files using fs
  const mainAgents = findAgentFiles(AGENTS_DIR);
  const subAgents = findAgentFiles(SUBAGENTS_DIR);

  console.log(
    `Found ${mainAgents.length} main agents and ${subAgents.length} subagents\n`,
  );

  console.log("=== Main Agents ===");
  for (const agentFile of mainAgents) {
    validateAgent(agentFile, false);
  }

  console.log("\n=== Subagents ===");
  for (const agentFile of subAgents) {
    validateAgent(agentFile, true);
  }

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
}

try {
  main();
} catch (err) {
  console.error("Fatal error:", err);
  process.exit(1);
}
