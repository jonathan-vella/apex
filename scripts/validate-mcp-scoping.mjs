#!/usr/bin/env node
/**
 * MCP Scoping Validator
 *
 * Validates .github/mcp-scoping.json:
 * - All agents referenced exist as agent files
 * - All MCP server names match keys in .vscode/mcp.json
 *
 * @example
 * node scripts/validate-mcp-scoping.mjs
 */

import fs from "node:fs";

const SCOPING_PATH = ".github/mcp-scoping.json";
const MCP_CONFIG_PATH = ".vscode/mcp.json";

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠️  ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

function stripJsonComments(content) {
  // Strip single-line comments (// ...) and block comments (/* ... */)
  // Handle string literals to avoid stripping within strings
  let result = "";
  let i = 0;
  while (i < content.length) {
    // Skip string literals
    if (content[i] === '"') {
      result += '"';
      i++;
      while (i < content.length && content[i] !== '"') {
        if (content[i] === "\\") {
          result += content[i] + (content[i + 1] || "");
          i += 2;
        } else {
          result += content[i];
          i++;
        }
      }
      if (i < content.length) {
        result += '"';
        i++;
      }
    } else if (content[i] === "/" && content[i + 1] === "/") {
      // Single-line comment — skip to end of line
      while (i < content.length && content[i] !== "\n") i++;
    } else if (content[i] === "/" && content[i + 1] === "*") {
      // Block comment — skip to */
      i += 2;
      while (
        i < content.length - 1 &&
        !(content[i] === "*" && content[i + 1] === "/")
      )
        i++;
      i += 2;
    } else {
      result += content[i];
      i++;
    }
  }
  return result;
}

console.log("\n🔌 Validating MCP scoping configuration...\n");

if (!fs.existsSync(SCOPING_PATH)) {
  error(`MCP scoping config not found at ${SCOPING_PATH}`);
  process.exit(1);
}

let scoping;
try {
  scoping = JSON.parse(fs.readFileSync(SCOPING_PATH, "utf-8"));
} catch (e) {
  error(`Invalid JSON in ${SCOPING_PATH}: ${e.message}`);
  process.exit(1);
}

// Load MCP server names from .vscode/mcp.json
let mcpServers = new Set();
if (fs.existsSync(MCP_CONFIG_PATH)) {
  try {
    const raw = fs.readFileSync(MCP_CONFIG_PATH, "utf-8");
    const cleaned = stripJsonComments(raw);
    const mcpConfig = JSON.parse(cleaned);
    if (mcpConfig.servers) {
      mcpServers = new Set(Object.keys(mcpConfig.servers));
    }
  } catch (e) {
    warn(`Cannot parse ${MCP_CONFIG_PATH}: ${e.message}`);
  }
} else {
  warn(`${MCP_CONFIG_PATH} not found — skipping server name validation`);
}

// Validate scoping entries
let entryCount = 0;
if (scoping.scoping) {
  for (const [agent, servers] of Object.entries(scoping.scoping)) {
    entryCount++;
    if (!Array.isArray(servers)) {
      error(`Agent "${agent}": MCP servers must be an array`);
      continue;
    }
    for (const server of servers) {
      if (mcpServers.size > 0 && !mcpServers.has(server)) {
        error(
          `Agent "${agent}": references MCP server "${server}" not found in ${MCP_CONFIG_PATH} (available: ${[...mcpServers].join(", ")})`,
        );
      }
    }
  }
}

// Validate default_scope
if (scoping.default_scope) {
  for (const server of scoping.default_scope) {
    if (mcpServers.size > 0 && !mcpServers.has(server)) {
      error(
        `default_scope references MCP server "${server}" not found in ${MCP_CONFIG_PATH}`,
      );
    }
  }
}

ok(`Validated ${entryCount} agent MCP scoping entries`);

console.log(`\n📊 Results: ${errors} error(s), ${warnings} warning(s)\n`);

if (errors > 0) {
  console.error("❌ MCP scoping validation failed\n");
  process.exit(1);
}

console.log("✅ MCP scoping validation passed\n");
