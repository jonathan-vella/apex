#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "./_lib/parse-jsonc.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
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

// Validate drawio MCP server configuration
r.tick();
if (!mcpConfig?.servers?.drawio) {
  r.error("Missing required MCP server: servers.drawio");
} else {
  const drawio = mcpConfig.servers.drawio;
  if (drawio.type !== "stdio") {
    r.error(`drawio server must use type: "stdio", got "${drawio.type}"`);
  } else if (drawio.command !== "deno") {
    r.error(`drawio command must be "deno", got "${drawio.command}"`);
  } else if (
    !drawio.args ||
    !drawio.args.some((a) => a.includes("drawio-mcp-server"))
  ) {
    r.error(
      "drawio args must include the drawio-mcp-server path (mcp/drawio-mcp-server)",
    );
  } else {
    r.ok("MCP config includes valid drawio server (Deno stdio)");
  }
}

r.summary();
r.exitOnError("MCP config valid", "MCP config validation failed");
