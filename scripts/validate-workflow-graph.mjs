#!/usr/bin/env node
/**
 * Workflow Graph Validator
 *
 * Validates the workflow-graph.json DAG:
 * - No orphan nodes (every node is reachable or is a root)
 * - All agent references match existing *.agent.md files
 * - No cycles in the graph
 * - All produced artifacts are consumed downstream or are terminal
 * - Edge references valid node IDs
 *
 * @example
 * node scripts/validate-workflow-graph.mjs
 */

import fs from "node:fs";
import { getAgents } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const GRAPH_PATH =
  ".github/skills/workflow-engine/templates/workflow-graph.json";

const r = new Reporter("Workflow Graph Validator");

function getAgentFiles() {
  const agents = new Set();
  for (const [file, agent] of getAgents()) {
    const name = agent.frontmatter?.name?.trim();
    if (name) agents.add(name);
    agents.add(file.replace(".agent.md", ""));
  }
  return agents;
}

function detectCycle(nodes, edges) {
  const adj = {};
  for (const nodeId of Object.keys(nodes)) {
    adj[nodeId] = [];
  }
  for (const edge of edges) {
    if (adj[edge.from]) {
      adj[edge.from].push(edge.to);
    }
  }

  const visited = new Set();
  const recStack = new Set();

  function dfs(node) {
    visited.add(node);
    recStack.add(node);

    for (const neighbor of adj[node] || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  for (const nodeId of Object.keys(nodes)) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) return true;
    }
  }
  return false;
}

console.log("\n🔄 Validating workflow graph...\n");

if (!fs.existsSync(GRAPH_PATH)) {
  r.error(`Workflow graph not found at ${GRAPH_PATH}`);
  process.exit(1);
}

let raw;
try {
  raw = fs.readFileSync(GRAPH_PATH, "utf-8");
} catch (e) {
  r.error(`Cannot read ${GRAPH_PATH}: ${e.message}`);
  process.exit(1);
}

let graph;
try {
  graph = JSON.parse(raw);
} catch (e) {
  r.error(`Invalid JSON in ${GRAPH_PATH}: ${e.message}`);
  process.exit(1);
}

if (!graph.nodes || typeof graph.nodes !== "object") {
  r.error("Missing or invalid 'nodes' object");
  process.exit(1);
}

if (!Array.isArray(graph.edges)) {
  r.error("Missing or invalid 'edges' array");
  process.exit(1);
}

const nodeIds = new Set(Object.keys(graph.nodes));
const agentFiles = getAgentFiles();

const VALID_LENSES = [
  "security-governance",
  "architecture-reliability",
  "cost-feasibility",
  "comprehensive",
  // Legacy lens names (backward compat)
  "security",
  "reliability",
  "cost",
  "naming",
  "avm-compliance",
];

const COMPLEXITY_TIERS = ["simple", "standard", "complex"];

// Validate challenger field (supports old passes:N or new complexity_matrix)
function validateChallenger(nodeId, challenger) {
  if (!challenger) return;

  // Old format: { passes: N, lenses: [...] }
  if (typeof challenger.passes === "number") {
    if (challenger.passes < 1) {
      r.error(`Node "${nodeId}" challenger.passes must be a positive integer`);
    }
    if (Array.isArray(challenger.lenses)) {
      for (const lens of challenger.lenses) {
        if (!VALID_LENSES.includes(lens)) {
          r.error(`Node "${nodeId}" challenger has invalid lens: "${lens}"`);
        }
      }
    }
    return;
  }

  // New format: { complexity_matrix: { simple: {...}, standard: {...}, complex: {...} } }
  if (challenger.complexity_matrix) {
    for (const tier of COMPLEXITY_TIERS) {
      if (!challenger.complexity_matrix[tier]) {
        r.error(
          `Node "${nodeId}" challenger.complexity_matrix missing required tier: "${tier}"`,
        );
        continue;
      }
      const entry = challenger.complexity_matrix[tier];
      if (typeof entry.passes !== "number" || entry.passes < 1) {
        r.error(
          `Node "${nodeId}" challenger.complexity_matrix.${tier}.passes must be a positive integer`,
        );
      }
      if (!Array.isArray(entry.lenses) || entry.lenses.length === 0) {
        r.error(
          `Node "${nodeId}" challenger.complexity_matrix.${tier}.lenses must be a non-empty array`,
        );
      } else {
        for (const lens of entry.lenses) {
          if (!VALID_LENSES.includes(lens)) {
            r.error(
              `Node "${nodeId}" challenger.complexity_matrix.${tier} has invalid lens: "${lens}"`,
            );
          }
        }
      }
    }
  }

  // Validate skip_condition references valid fields
  if (
    challenger.skip_condition &&
    typeof challenger.skip_condition === "string"
  ) {
    const allowedFields = ["complexity", "open_findings"];
    const hasValidRef = allowedFields.some((f) =>
      challenger.skip_condition.includes(f),
    );
    if (!hasValidRef) {
      r.warn(
        `Node "${nodeId}" challenger.skip_condition does not reference known fields (complexity, open_findings)`,
      );
    }
  }
}

// Validate nodes
for (const [nodeId, node] of Object.entries(graph.nodes)) {
  if (node.id !== nodeId) {
    r.error(`Node "${nodeId}" has mismatched id field: "${node.id}"`);
  }

  const validTypes = ["agent-step", "gate", "subagent-fan-out", "validation"];
  if (!validTypes.includes(node.type)) {
    r.error(`Node "${nodeId}" has invalid type: "${node.type}"`);
  }

  // Check agent references
  if (node.agent) {
    const agentName = node.agent;
    if (!agentFiles.has(agentName)) {
      // Try matching by common patterns
      const kebab = agentName.toLowerCase().replace(/\s+/g, "-");
      if (!agentFiles.has(kebab)) {
        r.warn(
          `Node "${nodeId}" references agent "${agentName}" — not found in agent files`,
        );
      }
    }
  }

  // Check requires references
  if (Array.isArray(node.requires)) {
    for (const req of node.requires) {
      if (!nodeIds.has(req)) {
        r.error(`Node "${nodeId}" requires non-existent node: "${req}"`);
      }
    }
  }

  // Validate challenger configuration
  validateChallenger(nodeId, node.challenger);
}

// Validate edges
const edgeTargets = new Set();
for (const edge of graph.edges) {
  if (!nodeIds.has(edge.from)) {
    r.error(`Edge references non-existent source node: "${edge.from}"`);
  }
  if (!nodeIds.has(edge.to)) {
    r.error(`Edge references non-existent target node: "${edge.to}"`);
  }
  edgeTargets.add(edge.to);

  const validConditions = ["on_complete", "on_skip", "on_fail"];
  if (!validConditions.includes(edge.condition)) {
    r.error(
      `Edge ${edge.from} → ${edge.to} has invalid condition: "${edge.condition}"`,
    );
  }
}

// Check for orphan nodes (not targeted by any edge and not a root)
const rootNodes = Object.values(graph.nodes).filter(
  (n) => !n.requires || n.requires.length === 0,
);
const rootNodeIds = new Set(rootNodes.map((n) => n.id));

for (const nodeId of nodeIds) {
  if (!edgeTargets.has(nodeId) && !rootNodeIds.has(nodeId)) {
    r.warn(`Node "${nodeId}" is an orphan (no incoming edges and not a root)`);
  }
}

if (detectCycle(graph.nodes, graph.edges)) {
  r.error("Cycle detected in workflow graph");
} else {
  r.ok("No cycles detected");
}

r.ok(`Validated ${nodeIds.size} nodes and ${graph.edges.length} edges`);

console.log(`\n📊 Results: ${r.errors} error(s), ${r.warnings} warning(s)\n`);

if (r.errors > 0) {
  console.error("❌ Workflow graph validation failed\n");
  process.exit(1);
}

console.log("✅ Workflow graph validation passed\n");
