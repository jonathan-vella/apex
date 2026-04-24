#!/usr/bin/env node
/**
 * Workflow Table Sync Validator
 *
 * Validates that the markdown workflow tables in copilot-instructions.md
 * and AGENTS.md stay in sync with the authoritative workflow-graph.json.
 *
 * Checks:
 * - Every agent-step in the JSON has a matching row in each table
 * - Gate types match (approval/validation/null → Approval/Validation/—)
 * - No table rows reference steps absent from the JSON (except "Post")
 *
 * @example
 * node tools/scripts/validate-workflow-table-sync.mjs
 */

import fs from "node:fs";
import { Reporter } from "./_lib/reporter.mjs";

const GRAPH_PATH =
  ".github/skills/workflow-engine/templates/workflow-graph.json";
const TABLE_FILES = [".github/copilot-instructions.md", "AGENTS.md"];

const r = new Reporter("Workflow Table Sync");

// --- JSON parsing ---

/** Extract agent-step nodes and normalize to { stepNum, name, gate } */
function loadGraphSteps() {
  const raw = fs.readFileSync(GRAPH_PATH, "utf-8");
  const graph = JSON.parse(raw);
  const steps = new Map();

  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.type !== "agent-step" && node.type !== "subagent-fan-out")
      continue;

    // step-1 → "1", step-3_5 → "3.5", step-5b → "5", step-6t → "6"
    const num = id.replace("step-", "").replace("_", ".").replace(/[bt]$/, "");

    const gate = node.gate
      ? node.gate.charAt(0).toUpperCase() + node.gate.slice(1)
      : "—";

    // Merge Bicep/Terraform branches into one step number
    if (steps.has(num)) {
      const existing = steps.get(num);
      // If gates differ across branches, flag it; otherwise keep first
      if (existing.gate !== gate) {
        existing.gate = `${existing.gate}/${gate}`;
      }
    } else {
      steps.set(num, { num, name: node.name, gate });
    }
  }
  return steps;
}

// --- Markdown table parsing ---

/** Parse a markdown table and return { headers, rows } */
function parseMarkdownTable(content) {
  const lines = content.split("\n");
  const headers = [];
  const rows = [];
  let inTable = false;
  let headerParsed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      if (inTable) break;
      continue;
    }

    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

    // Skip separator rows (| --- | --- |)
    if (cells.every((c) => /^[-:\s]+$/.test(c))) {
      inTable = true;
      continue;
    }

    // Header row
    if (!headerParsed && /Step/i.test(cells[0])) {
      headerParsed = true;
      inTable = true;
      headers.push(...cells);
      continue;
    }

    if (!inTable) continue;

    if (cells.length >= 2) {
      rows.push(cells);
    }
  }
  return { headers, rows };
}

/** Extract workflow table rows from a markdown file. Returns [{ stepNum, gate }] */
function extractTableSteps(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");

  const sectionPattern = /## (?:Multi-Step Workflow|Agent Workflow)\b/i;
  const match = content.match(sectionPattern);
  if (!match) return null;

  const sectionStart = match.index;
  const rest = content.slice(sectionStart);
  const nextH2 = rest.indexOf("\n## ", 5);
  const section = nextH2 > 0 ? rest.slice(0, nextH2) : rest;

  const { headers, rows } = parseMarkdownTable(section);

  // Find the Gate column index by header name (may not exist in AGENTS.md)
  const gateIdx = headers.findIndex((h) => /^Gate$/i.test(h));

  return rows.map((cells) => {
    const stepNum = cells[0].trim();
    const gate = gateIdx >= 0 && cells[gateIdx] ? cells[gateIdx].trim() : null;
    return { stepNum, gate };
  });
}

// --- Validation ---

function validate() {
  r.header();

  let graphSteps;
  try {
    graphSteps = loadGraphSteps();
  } catch (err) {
    r.error(GRAPH_PATH, `Failed to parse: ${err.message}`);
    r.summary();
    r.exitOnError();
    return;
  }

  r.ok(GRAPH_PATH, `${graphSteps.size} agent steps loaded`);

  for (const file of TABLE_FILES) {
    if (!fs.existsSync(file)) {
      r.warn(file, "File not found — skipping");
      continue;
    }

    r.tick();
    const tableSteps = extractTableSteps(file);
    if (!tableSteps) {
      r.warn(file, "No workflow table found — skipping");
      continue;
    }

    const tableNums = new Set(tableSteps.map((s) => s.stepNum));

    // Check: every JSON step has a table row
    for (const [num] of graphSteps) {
      if (!tableNums.has(num)) {
        r.error(file, `Step ${num} in workflow-graph.json missing from table`);
      }
    }

    // Check: every table row has a JSON step (except "Post" which is orchestrator-only)
    for (const { stepNum } of tableSteps) {
      if (stepNum.toLowerCase() === "post") continue;
      if (!graphSteps.has(stepNum)) {
        r.error(
          file,
          `Table row "${stepNum}" not found in workflow-graph.json`,
        );
      }
    }

    // Check: gate types match where both table and JSON have them
    for (const { stepNum, gate } of tableSteps) {
      if (stepNum.toLowerCase() === "post") continue;
      if (!gate) continue; // AGENTS.md has no Gate column
      const jsonStep = graphSteps.get(stepNum);
      if (!jsonStep) continue; // already flagged above

      const jsonGate = jsonStep.gate;
      // Normalize for comparison: both sides to lowercase
      if (
        gate.toLowerCase().replace("—", "—") !==
        jsonGate.toLowerCase().replace("—", "—")
      ) {
        r.error(
          file,
          `Step ${stepNum} gate mismatch: table="${gate}" vs graph="${jsonGate}"`,
        );
      }
    }

    if (r.errors === 0) {
      r.ok(file, `${tableSteps.length} rows in sync with workflow-graph.json`);
    }
  }

  r.summary();
  r.exitOnError();
}

validate();
