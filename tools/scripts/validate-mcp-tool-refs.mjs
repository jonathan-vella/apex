#!/usr/bin/env node
// Checks every mcp_azure-mcp_* reference in agent and skill markdown against the committed Azure MCP tool snapshot.
// Offline by design; refresh the snapshot with `npm run refresh:mcp-tool-snapshot` when the pin changes.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "./_lib/parse-jsonc.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const IGNORE_MARKER = "mcp-ref:ignore";
const WRAPPER_KEYS = new Set(["command", "intent", "parameters", "learn"]);
const WINDOW_LINES = 4;
// Docs write mcp_azure-mcp_<tool>; VS Code lists the same tool as mcp_azure_mcp_ser_<tool>.
const PREFIX = "mcp_azure[-_]mcp_(?:ser_)?";

const words = (text, pattern) => [...text.matchAll(pattern)].map((match) => match[1]);

function commandsIn(windowText, toolName) {
  const found = new Set();
  for (const pattern of [
    /command:\s*["'`]([A-Za-z0-9_-]+)["'`]/g,
    /command\s+`([A-Za-z0-9_-]+)`/g,
    /\(command\s+([A-Za-z0-9_-]+)\)/g,
    new RegExp(`\\b(${toolName}_[a-z0-9_-]+)`, "g"),
  ]) {
    for (const command of words(windowText, pattern)) found.add(command);
  }
  for (const match of windowText.matchAll(/`command`\s+to\s+`([^`]+)`(?:\s+or\s+`([^`]+)`)?/g)) {
    found.add(match[1]);
    if (match[2]) found.add(match[2]);
  }
  return found;
}

function keysOf(text) {
  return words(text, /["']?([A-Za-z][\w-]*)["']?\s*:/g);
}

function yamlBlockKeys(lines, headerPattern) {
  const keys = [];
  lines.forEach((line, index) => {
    const header = line.match(headerPattern);
    if (!header) return;
    const baseIndent = header[1].length;
    for (const next of lines.slice(index + 1)) {
      const indent = next.match(/^(\s*)/)[1].length;
      if (!next.trim() || indent <= baseIndent) break;
      const key = next.match(/^\s+["']?([A-Za-z][\w-]*)["']?\s*:/);
      if (key) keys.push(key[1]);
    }
  });
  return keys;
}

function parametersIn(windowLines, windowText, direct) {
  const keys = [];
  for (const match of windowText.matchAll(/parameters:\s*\{([^}]*)\}/g)) keys.push(...keysOf(match[1]));
  keys.push(...yamlBlockKeys(windowLines, /^(\s*)parameters:\s*$/));
  keys.push(...words(windowText, /\(parameters?:\s*`([^`]+)`\)/g));
  if (direct) {
    for (const match of windowText.matchAll(/\(\{([^}]*)\}\)/g)) keys.push(...keysOf(match[1]));
    keys.push(...yamlBlockKeys(windowLines, new RegExp(`^()\\S.*${PREFIX}\\w+\\s*$`)));
  }
  return keys.filter((key) => !WRAPPER_KEYS.has(key));
}

// Returns [{ line, message }] for each reference the snapshot cannot back.
export function scanText(text, snapshot) {
  const lines = text.split(/\r?\n/);
  const problems = [];
  lines.forEach((line, index) => {
    const matches = [...line.matchAll(new RegExp(`${PREFIX}([a-z][a-z0-9_]*)`, "g"))];
    matches.forEach((match, matchIndex) => {
      if (line.includes(IGNORE_MARKER) || (lines[index - 1] ?? "").includes(IGNORE_MARKER)) return;
      const toolName = match[1];
      // A prefix followed by a placeholder such as <tool> is documentation, not a reference.
      if (toolName.endsWith("_") && line[match.index + match[0].length] === "<") return;
      const tool = snapshot.tools[toolName];
      if (!tool) {
        problems.push({ line: index + 1, message: `unknown tool mcp_azure-mcp_${toolName}` });
        return;
      }
      const sameLineEnd = matches[matchIndex + 1]?.index ?? line.length;
      const following = [];
      for (const next of lines.slice(index + 1, index + 1 + WINDOW_LINES)) {
        if (!next.trim() || next.trimStart().startsWith("```") || new RegExp(PREFIX).test(next)) break;
        following.push(next);
      }
      const windowLines = [line.slice(match.index, sameLineEnd), ...following];
      const windowText = windowLines.join("\n");
      const direct = !tool.commands;
      let commandSchema;
      if (!direct) {
        const commands = commandsIn(windowText, toolName);
        for (const command of commands) {
          if (!tool.commands[command]) {
            problems.push({ line: index + 1, message: `mcp_azure-mcp_${toolName} has no command "${command}"` });
          }
        }
        if (commands.size === 1) commandSchema = tool.commands[[...commands][0]];
        if (!commandSchema) return;
      }
      const known = (direct ? tool : commandSchema).parameters;
      for (const key of new Set(parametersIn(windowLines, windowText, direct))) {
        if (!Object.hasOwn(known, key)) {
          problems.push({ line: index + 1, message: `mcp_azure-mcp_${toolName} has no parameter "${key}"` });
        }
      }
    });
  });
  return problems;
}

export function pinProblems(root, snapshot) {
  const problems = [];
  const config = parseJsonc(readFileSync(join(root, ".mcp.json"), "utf8"));
  const arg = (config.mcpServers?.["azure-mcp"]?.args ?? []).find((value) => String(value).startsWith("@azure/mcp@"));
  const workspacePin = arg?.slice("@azure/mcp@".length);
  const defaultsPin = readFileSync(join(root, ".devcontainer/configure-mcp.mjs"), "utf8").match(
    /["']@azure\/mcp@([^"']+)["']/,
  )?.[1];
  for (const [source, version] of [
    [".mcp.json", workspacePin],
    [".devcontainer/configure-mcp.mjs", defaultsPin],
    ["snapshot", snapshot.serverVersion],
  ]) {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? "")) {
      problems.push(`${source} must use an exact stable @azure/mcp version, got ${version}`);
    }
  }
  if (workspacePin !== snapshot.serverVersion) {
    problems.push(`.mcp.json pins ${workspacePin}; snapshot is for ${snapshot.serverVersion}`);
  }
  if (defaultsPin !== snapshot.serverVersion) {
    problems.push(`.devcontainer/configure-mcp.mjs pins ${defaultsPin}; snapshot is for ${snapshot.serverVersion}`);
  }
  return problems;
}

function markdownFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

function main() {
  const r = new Reporter("Azure MCP Tool Reference Validator");
  r.header();
  const snapshotPath = join(repoRoot, "tools/registry/azure-mcp-tools.json");
  if (!existsSync(snapshotPath)) {
    r.error("tools/registry/azure-mcp-tools.json", "Missing snapshot; run npm run refresh:mcp-tool-snapshot");
    r.summary();
    r.exitOnError();
  }
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  r.tick();
  const pins = pinProblems(repoRoot, snapshot);
  for (const message of pins) r.error("pin", message);
  if (!pins.length) r.ok("pin", `Snapshot matches the @azure/mcp@${snapshot.serverVersion} pin`);
  for (const file of [...markdownFiles(join(repoRoot, ".github"))]) {
    r.tick();
    const location = relative(repoRoot, file);
    for (const problem of scanText(readFileSync(file, "utf8"), snapshot)) {
      r.error(`${location}:${problem.line}`, problem.message);
    }
  }
  r.summary();
  r.exitOnError("Azure MCP references valid", "Azure MCP reference validation failed");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
