#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "./_lib/parse-jsonc.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");
const mcpConfigPath = resolve(repoRoot, ".vscode/mcp.json");

const r = new Reporter("MCP Config Validator");
r.header();

if (!existsSync(mcpConfigPath)) {
  r.error("Missing .vscode/mcp.json");
  r.summary();
  r.exitOnError();
}

let mcpConfig;
try {
  mcpConfig = parseJsonc(readFileSync(mcpConfigPath, "utf-8"));
} catch (error) {
  r.error(`Invalid JSON in .vscode/mcp.json: ${error.message}`);
  r.summary();
  r.exitOnError();
}

const requiredServers = ["github"];
for (const name of requiredServers) {
  r.tick();
  if (!mcpConfig?.servers?.[name]) {
    r.error(`Missing required MCP server: servers.${name}`);
  } else {
    r.ok(`MCP config includes required server: ${name}`);
  }
}

// The hosted ARM MCP replaces the former in-repo pricing server.
r.tick();
const armMcp = mcpConfig?.servers?.["azure-resource-manager-mcp"];
const armToolsets = String(armMcp?.headers?.["x-mcp-toolset"] ?? "")
  .split(",")
  .map((toolset) => toolset.trim())
  .filter(Boolean);
if (!armMcp) {
  r.error("Missing required MCP server: servers.azure-resource-manager-mcp");
} else if (armMcp.type !== "http") {
  r.error(`azure-resource-manager-mcp must use type: "http", got "${armMcp.type}"`);
} else if (armMcp.url !== "https://mcp.management.azure.com") {
  r.error(`azure-resource-manager-mcp has unexpected URL: "${armMcp.url}"`);
} else if (!armToolsets.includes("CostManagement")) {
  r.error('azure-resource-manager-mcp must enable the "CostManagement" toolset');
} else {
  r.ok("MCP config includes valid Azure Resource Manager MCP server");
}

r.tick();
const azureMcp = mcpConfig?.servers?.["azure-mcp"];
const expectedAzureMcpArgs = ["-y", "@azure/mcp@latest", "server", "start"];
if (!azureMcp) {
  r.error("Missing required MCP server: servers.azure-mcp");
} else if (azureMcp.type !== "stdio") {
  r.error(`azure-mcp must use type: "stdio", got "${azureMcp.type}"`);
} else if (azureMcp.command !== "npx") {
  r.error(`azure-mcp command must be "npx", got "${azureMcp.command}"`);
} else if (JSON.stringify(azureMcp.args) !== JSON.stringify(expectedAzureMcpArgs)) {
  r.error(`azure-mcp args must be ${JSON.stringify(expectedAzureMcpArgs)}`);
} else {
  r.ok("MCP config includes valid standalone Azure MCP server");
}

const retiredServers = ["azure-pricing", "drawio", "astro-docs", "terraform"];
for (const name of retiredServers) {
  r.tick();
  if (mcpConfig?.servers?.[name]) {
    r.error(`Retired servers.${name} entry must be removed`);
  } else {
    r.ok(`Retired MCP server is not configured: ${name}`);
  }
}

r.summary();
r.exitOnError("MCP config valid", "MCP config validation failed");
