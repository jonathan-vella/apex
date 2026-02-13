#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const mcpConfigPath = resolve(repoRoot, ".vscode/mcp.json");

console.log("🔍 Validating MCP configuration...");

if (!existsSync(mcpConfigPath)) {
  console.error("❌ Missing .vscode/mcp.json");
  process.exit(1);
}

let mcpConfig;
try {
  mcpConfig = JSON.parse(readFileSync(mcpConfigPath, "utf-8"));
} catch (error) {
  console.error(`❌ Invalid JSON in .vscode/mcp.json: ${error.message}`);
  process.exit(1);
}

const githubServer = mcpConfig?.servers?.github;
if (!githubServer) {
  console.error("❌ Missing required MCP server: servers.github");
  process.exit(1);
}

console.log("✅ MCP config includes required server: github");
