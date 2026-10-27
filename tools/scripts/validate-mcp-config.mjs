#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "./_lib/parse-jsonc.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");
const mcpConfigPath = resolve(repoRoot, ".mcp.json");
const legacyMcpConfigPath = resolve(repoRoot, ".vscode/mcp.json");

const r = new Reporter("MCP Config Validator");
r.header();

if (existsSync(legacyMcpConfigPath)) {
  r.error("Deprecated .vscode/mcp.json must be removed; use root .mcp.json (portable Copilot format)");
}

if (!existsSync(mcpConfigPath)) {
  r.error("Missing .mcp.json");
  r.summary();
  r.exitOnError();
}

let mcpConfig;
try {
  mcpConfig = parseJsonc(readFileSync(mcpConfigPath, "utf-8"));
} catch (error) {
  r.error(`Invalid JSON in .mcp.json: ${error.message}`);
  r.summary();
  r.exitOnError();
}

const requiredServers = ["github"];
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
if (!isObject(mcpConfig) || Object.hasOwn(mcpConfig, "servers") || !isObject(mcpConfig.mcpServers)) {
  r.error("MCP configuration and mcpServers must be objects");
  r.summary();
  r.exitOnError();
}
for (const name of requiredServers) {
  r.tick();
  if (!mcpConfig?.mcpServers?.[name]) {
    r.error(`Missing required MCP server: mcpServers.${name}`);
  } else {
    r.ok(`MCP config includes required server: ${name}`);
  }
}

r.tick();
const azureMcp = mcpConfig?.mcpServers?.["azure-mcp"];
if (!azureMcp) {
  r.error("Missing required MCP server: mcpServers.azure-mcp");
} else if (azureMcp.type !== "stdio") {
  r.error(`azure-mcp must use type: "stdio", got "${azureMcp.type}"`);
} else if (typeof azureMcp.command !== "string" || !azureMcp.command.trim()) {
  r.error("azure-mcp command must be a nonempty string");
} else if (
  azureMcp.args !== undefined &&
  (!Array.isArray(azureMcp.args) || !azureMcp.args.every((arg) => typeof arg === "string"))
) {
  r.error("azure-mcp args must be an array of strings when provided");
} else {
  r.ok("MCP config includes a structurally valid Azure MCP command; runtime capability is not verified");
}

const retiredServers = ["azure-pricing", "drawio", "astro-docs", "terraform", "azure-resource-manager-mcp"];
for (const name of retiredServers) {
  r.tick();
  if (Object.hasOwn(mcpConfig.mcpServers, name)) {
    r.error(`Retired mcpServers.${name} entry must be removed`);
  } else {
    r.ok(`Retired MCP server is not configured: ${name}`);
  }
}

r.summary();
r.exitOnError("MCP config valid", "MCP config validation failed");
