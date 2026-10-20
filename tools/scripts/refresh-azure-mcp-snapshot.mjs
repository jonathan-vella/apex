#!/usr/bin/env node
// Regenerates tools/registry/azure-mcp-tools.json from a live Azure MCP server in the default namespace mode.
// Needs network access, azqr >= 3.0.0 on PATH (otherwise extension_azqr is not listed) and the npm allow-remote opt-in.

import { spawn } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "./_lib/parse-jsonc.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const snapshotPath = resolve(repoRoot, "tools/registry/azure-mcp-tools.json");
const REQUEST_TIMEOUT_MS = 120_000;

export function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

export function parametersOf(inputSchema) {
  const required = new Set(inputSchema?.required ?? []);
  return Object.fromEntries(Object.keys(inputSchema?.properties ?? {}).map((name) => [name, required.has(name)]));
}

// The learn reply is prose followed by a JSON array of { command, inputSchema } objects.
export function parseLearnReply(text) {
  const start = text.indexOf("[{");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("learn reply contains no command list");
  return JSON.parse(text.slice(start, end + 1));
}

export function commandsFromLearnReply(toolName, reply) {
  const text = (reply.result?.content ?? []).map((content) => content.text).join("\n");
  try {
    if (reply.error || reply.result?.isError) throw new Error(reply.error?.message ?? text);
    return parseLearnReply(text);
  } catch (error) {
    throw new Error(`${toolName} metadata discovery failed: ${error.message}`, { cause: error });
  }
}

export function buildSnapshot(serverVersion, listedTools, learnedByTool) {
  const tools = {};
  for (const tool of listedTools) {
    const wrapped = Object.hasOwn(tool.inputSchema?.properties ?? {}, "command");
    if (!wrapped) {
      tools[tool.name] = { parameters: parametersOf(tool.inputSchema) };
      continue;
    }
    const commands = {};
    for (const entry of learnedByTool[tool.name] ?? []) {
      commands[entry.command] = { parameters: parametersOf(entry.inputSchema) };
    }
    tools[tool.name] = { commands };
  }
  return sortKeys({ schemaVersion: 1, serverMode: "namespace", serverVersion, tools });
}

function pinnedVersion() {
  const config = parseJsonc(readFileSync(resolve(repoRoot, ".mcp.json"), "utf8"));
  const arg = (config.mcpServers?.["azure-mcp"]?.args ?? []).find((a) => String(a).startsWith("@azure/mcp@"));
  if (!arg) throw new Error("azure-mcp has no pinned @azure/mcp@<version> argument in .mcp.json");
  return arg.slice("@azure/mcp@".length);
}

function connect(version) {
  const child = spawn("npx", ["-y", `@azure/mcp@${version}`, "server", "start"], {
    env: { ...process.env, npm_config_allow_remote: "all" },
    stdio: ["pipe", "pipe", "ignore"],
  });
  let buffer = "";
  let nextId = 1;
  const waiting = new Map();
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      try {
        const message = JSON.parse(line);
        if (message.id && waiting.has(message.id)) waiting.get(message.id)(message);
      } catch {
        // Non-JSON lines are server logging.
      }
    }
  });
  const send = (method, params) =>
    new Promise((resolveReply, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), REQUEST_TIMEOUT_MS);
      waiting.set(id, (message) => {
        clearTimeout(timer);
        resolveReply(message);
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  child.on("error", (error) => {
    throw error;
  });
  return { child, send };
}

async function main() {
  const version = pinnedVersion();
  const { child, send } = connect(version);
  try {
    await send("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "refresh", version: "0" },
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    const listed = (await send("tools/list", {})).result?.tools ?? [];
    if (!listed.some((tool) => tool.name === "extension_azqr")) {
      throw new Error("extension_azqr is not listed; put azqr 3.0.0 or later on PATH (.devcontainer/install-azqr.sh)");
    }
    const learned = {};
    for (const tool of listed.filter((t) => Object.hasOwn(t.inputSchema?.properties ?? {}, "command"))) {
      const reply = await send("tools/call", { name: tool.name, arguments: { learn: true, intent: "" } });
      learned[tool.name] = commandsFromLearnReply(tool.name, reply);
    }
    const snapshot = buildSnapshot(version, listed, learned);
    const temp = `${snapshotPath}.tmp`;
    writeFileSync(temp, `${JSON.stringify(snapshot, null, 2)}\n`);
    renameSync(temp, snapshotPath);
    console.log(`Wrote ${snapshotPath} for @azure/mcp@${version}: ${Object.keys(snapshot.tools).length} tools`);
  } finally {
    child.kill();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(`Snapshot refresh failed; the committed snapshot is unchanged: ${error.message}`);
      process.exit(1);
    },
  );
}
