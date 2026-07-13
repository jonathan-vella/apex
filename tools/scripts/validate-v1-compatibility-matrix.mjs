#!/usr/bin/env node
/**
 * Verifies that the Phase 0A compatibility matrix covers live v1 runtime surfaces.
 *
 * @example
 * node tools/scripts/validate-v1-compatibility-matrix.mjs
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const MATRIX_PATH = path.join(REPO_ROOT, "docs/vnext/phase-0a/v1-behavior-compatibility.md");
const AGENTS_DIR = path.join(REPO_ROOT, ".github/agents");
const SCHEMAS_DIR = path.join(REPO_ROOT, "tools/schemas");
const MCP_DIR = path.join(REPO_ROOT, "tools/mcp-servers");
const WORKFLOW_PATH = path.join(REPO_ROOT, ".github/skills/workflow-engine/templates/workflow-graph.json");
const APEX_RECALL_SRC = path.join(REPO_ROOT, "tools/apex-recall/src");

const reporter = new Reporter("v1 Compatibility Matrix Coverage");
reporter.header();

function toRepoPath(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}

function findFiles(directory, suffix) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findFiles(entryPath, suffix);
      return entry.isFile() && entry.name.endsWith(suffix) ? [entryPath] : [];
    })
    .sort();
}

function checkCoverage(label, values, tokenFor) {
  reporter.tick();
  const missing = values.filter((value) => !matrix.includes(tokenFor(value)));
  if (missing.length > 0) {
    reporter.error(label, `missing ${missing.map((value) => tokenFor(value)).join(", ")}`);
    return;
  }
  reporter.ok(label, `${values.length} live entries mapped`);
}

if (!fs.existsSync(MATRIX_PATH)) {
  reporter.tick();
  reporter.error(toRepoPath(MATRIX_PATH), "matrix file not found");
  reporter.summary();
  reporter.exitOnError();
}

const matrix = fs.readFileSync(MATRIX_PATH, "utf8");
const agentPaths = findFiles(AGENTS_DIR, ".agent.md").map(toRepoPath);
const schemaNames = findFiles(SCHEMAS_DIR, ".schema.json").map((filePath) => path.basename(filePath));
const mcpPaths = fs
  .readdirSync(MCP_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
  .map((entry) => `tools/mcp-servers/${entry.name}/`)
  .sort();
const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, "utf8"));
const workflowNodeIds = Object.keys(workflow.nodes).sort();
const recallHelp = execFileSync("python3", ["-m", "apex_recall", "--help"], {
  encoding: "utf8",
  env: {
    ...process.env,
    PYTHONPATH: [APEX_RECALL_SRC, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
  },
});
const recallCommandMatch = recallHelp.match(/\{([^}]+)\}/s);

checkCoverage("agents and subagents", agentPaths, (value) => `\`${value}\``);
checkCoverage("JSON schemas", schemaNames, (value) => `\`${value}\``);
checkCoverage("MCP servers", mcpPaths, (value) => `\`${value}\``);
checkCoverage("workflow nodes", workflowNodeIds, (value) => `\`${value}\``);

reporter.tick();
if (!recallCommandMatch) {
  reporter.error("apex-recall", "could not parse command list from --help");
} else {
  const recallCommands = recallCommandMatch[1].replaceAll(/\s+/g, "").split(",").filter(Boolean);
  const missingCommands = recallCommands.filter((command) => !matrix.includes(command));
  if (missingCommands.length > 0) {
    reporter.error("apex-recall", `missing commands: ${missingCommands.join(", ")}`);
  } else {
    reporter.ok("apex-recall", `${recallCommands.length} commands mapped`);
  }
}

reporter.summary();
reporter.exitOnError("v1 compatibility matrix covers all discovered surfaces");
