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
 * node tools/scripts/validate-workflow-graph.mjs
 */

import fs from "node:fs";
import { getAgents } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const GRAPH_PATH = ".github/skills/apex-workflow-engine/templates/workflow-graph.json";

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

function canReachInForwardDag(edges, startNode, targetNode) {
  if (startNode === targetNode) return true;
  const visited = new Set([startNode]);
  const queue = [startNode];
  while (queue.length > 0) {
    const curr = queue.shift();
    for (const edge of edges) {
      if (edge.from === curr && !visited.has(edge.to)) {
        if (edge.to === targetNode) return true;
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return false;
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
  "governance-reconciliation",
  // Legacy lens names (backward compat)
  "security",
  "reliability",
  "cost",
  "naming",
  "avm-compliance",
];

const COMPLEXITY_TIERS = ["simple", "standard", "complex"];

// Validate challenger field (supports old passes:N or new opt_in_matrix)
function validateChallenger(nodeId, challenger) {
  if (!challenger) return;

  // Validate default_lenses (post-Phase-1 default flow)
  if (Array.isArray(challenger.default_lenses)) {
    for (const lens of challenger.default_lenses) {
      if (!VALID_LENSES.includes(lens)) {
        r.error(`Node "${nodeId}" challenger.default_lenses has invalid lens: "${lens}"`);
      }
    }
  }

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

  // New format: { opt_in_matrix: { simple?: {...}, standard?: {...}, complex?: {...} } }
  // Opt-in semantics: tiers MAY be partial (a missing tier just means no recommended
  // multi-pass shape for that tier). Validate each present tier shape, no required[] check.
  if (challenger.opt_in_matrix) {
    for (const tier of COMPLEXITY_TIERS) {
      const entry = challenger.opt_in_matrix[tier];
      if (!entry) continue;
      if (typeof entry.passes !== "number" || entry.passes < 1) {
        r.error(`Node "${nodeId}" challenger.opt_in_matrix.${tier}.passes must be a positive integer`);
      }
      if (!Array.isArray(entry.lenses) || entry.lenses.length === 0) {
        r.error(`Node "${nodeId}" challenger.opt_in_matrix.${tier}.lenses must be a non-empty array`);
      } else {
        for (const lens of entry.lenses) {
          if (!VALID_LENSES.includes(lens)) {
            r.error(`Node "${nodeId}" challenger.opt_in_matrix.${tier} has invalid lens: "${lens}"`);
          }
        }
      }
    }
  }

  // Validate skip_condition references valid fields
  if (challenger.skip_condition && typeof challenger.skip_condition === "string") {
    const allowedFields = ["complexity", "open_findings", "constraints.count"];
    const hasValidRef = allowedFields.some((f) => challenger.skip_condition.includes(f));
    if (!hasValidRef) {
      r.warn(
        `Node "${nodeId}" challenger.skip_condition does not reference known fields (complexity, open_findings, constraints.count)`,
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
        r.warn(`Node "${nodeId}" references agent "${agentName}" — not found in agent files`);
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
const VALID_CONDITIONS = [
  "on_complete",
  "on_skip",
  "on_fail",
  "on_refine",
  "on_architecture_must_fix",
  "on_must_fix_governance_conflict",
];
function validateCondition(label, value) {
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0) {
    r.error(`${label} has empty condition array`);
    return;
  }
  for (const v of values) {
    if (!VALID_CONDITIONS.includes(v)) {
      r.error(`${label} has invalid condition: "${v}"`);
    }
  }
}

for (const edge of graph.edges) {
  if (!nodeIds.has(edge.from)) {
    r.error(`Edge references non-existent source node: "${edge.from}"`);
  }
  if (!nodeIds.has(edge.to)) {
    r.error(`Edge references non-existent target node: "${edge.to}"`);
  }
  edgeTargets.add(edge.to);

  validateCondition(`Edge ${edge.from} → ${edge.to}`, edge.condition);
}

// Validate metadata.version
const expectedMajors = ["2", "3"];
const knownVersions = new Set(["2.1", "2.2", "2.3", "2.4", "2.5", "3.0", "3.1", "3.2"]);
const metaVersion = graph.metadata?.version;
if (["2.5", "3.0", "3.1", "3.2"].includes(metaVersion)) {
  const contract = graph.metadata?.risk_acceptance;
  if (
    contract?.contract !== "risk-authorization-v1" ||
    contract?.eligibility !== "non-production-lab" ||
    contract?.review_verdicts_unchanged !== true ||
    contract?.readiness_command !== "apex-recall check-gate" ||
    JSON.stringify(contract?.kit_actions) !== JSON.stringify(["plan-complete", "codegen", "code-complete"]) ||
    contract?.deployment_requires !== "separate-adopter-tenant-subscription-event-authorization-and-human-approval"
  )
    r.error("Invalid lab-only risk authorization contract");
  if (
    graph.nodes["step-4"]?.challenger?.exit_criteria !== "all-passes-APPROVED" ||
    graph.nodes["step-4"]?.challenger?.exception_exit_criteria !==
      "current-explicit-lab-authorization-and-separate-human-approval"
  )
    r.error("Plan review exit criteria must preserve the default gate and distinct explicit exception");
}
if (metaVersion === undefined) {
  r.warn("metadata.version missing — older consumers may rely on it");
} else if (!knownVersions.has(metaVersion)) {
  r.error(
    `metadata.version "${metaVersion}" is not a known version (expected one of: ${[...knownVersions].join(", ")})`,
  );
} else if (!expectedMajors.includes(metaVersion.split(".")[0])) {
  r.error(`Unsupported metadata.version major: ${metaVersion}`);
}
if (["3.0", "3.1", "3.2"].includes(metaVersion)) {
  const contract = graph.metadata.practical_workflow;
  if (
    contract?.contract !== "practical-v1" ||
    contract.initial_calls_per_artifact_lens !== 1 ||
    contract.closure_calls_per_artifact_lens !== 1 ||
    contract.retain_stage_approvals !== true ||
    contract.new_projects_only !== true ||
    contract.migration !== "explicit-owner-adoption"
  )
    r.error("Practical workflow must preserve bounded review cycles, stage approvals and explicit legacy adoption");
}
if (["3.1", "3.2"].includes(metaVersion)) {
  for (const error of validateAssessmentProfile(graph.profiles?.assessment, metaVersion)) r.error(error);
}

export function validateAssessmentProfile(profile, version = "3.2") {
  const errors = [];
  if (
    !profile ||
    profile.workflow_mode !== "assessment" ||
    profile.entry !== "scope" ||
    profile.terminal !== "terminal"
  )
    return ["Missing explicit standalone assessment profile"];
  if (!["3.1", "3.2"].includes(version)) errors.push("Unknown standalone assessment graph version");
  if (version === "3.2") {
    if (JSON.stringify(profile.bundle_contracts) !== JSON.stringify(["assessment-bundle-v1", "assessment-bundle-v2"]))
      errors.push("Assessment graph must declare original and register-capable bundle contracts");
    const expected = [
      {
        when: {
          bundle_contract: "assessment-bundle-v2",
          sources: ["azure", "combined"],
          selection: "action_register",
        },
        outputs: [
          "contracts/assessment-action-register.json",
          "04-assessment-action-register.md",
          "assets/04-assessment-action-register.xlsx",
          "_meta/action-register-derived.json",
          "_meta/action-register-export.json",
        ],
      },
    ];
    if (JSON.stringify(profile.nodes?.analysis?.conditional_produces) !== JSON.stringify(expected))
      errors.push("Assessment register outputs must use the bounded contract/source/selection condition at analysis");
  } else if (profile.bundle_contracts || Object.values(profile.nodes ?? {}).some((node) => node.conditional_produces)) {
    errors.push("Register-capable output declarations require graph 3.2");
  }
  const nodes = profile.nodes ?? {};
  const edges = Array.isArray(profile.edges) ? profile.edges : [];
  const allowedAgents = new Set(["01-Orchestrator", "02-Requirements", "03-Architect", "04-Design"]);
  for (const [id, node] of Object.entries(nodes)) {
    if (node.id !== id || (node.agent && !allowedAgents.has(node.agent)))
      errors.push(`Invalid assessment owner/node ${id}`);
    for (const required of node.requires ?? []) {
      if (!nodes[required]) errors.push(`Assessment prerequisite escapes profile: ${required}`);
    }
    if (id !== "analysis" && node.conditional_produces)
      errors.push("Register output applicability belongs to analysis, not a new phase");
    for (const output of [
      ...(node.produces ?? []),
      ...(node.conditional_produces ?? []).flatMap((group) => group.outputs ?? []),
    ]) {
      if (
        typeof output !== "string" ||
        output.split(/[\\/]/).some((part) => part === ".." || part.startsWith("assessment-step-"))
      )
        errors.push(`Reserved or unsafe assessment output ${output}`);
    }
  }
  for (const edge of edges) {
    if (!nodes[edge.from] || !nodes[edge.to]) errors.push("Assessment edge escapes profile");
  }
  if (edges.some((edge) => edge.from === "terminal") || nodes.terminal?.terminal !== true)
    errors.push("Assessment must terminate without delivery routing");
  const returns = profile.return_edges;
  if (
    !Array.isArray(returns) ||
    returns.length !== 1 ||
    returns[0].from !== "acceptance" ||
    returns[0].to !== "review" ||
    returns[0].condition !== "on_refine" ||
    typeof returns[0].reason !== "string" ||
    !returns[0].reason.trim()
  )
    errors.push("Assessment repair return must be owner-approved acceptance to review without reopening terminal");
  if (
    Object.entries(nodes)
      .filter(([, node]) => node.type === "gate")
      .map(([id]) => id)
      .sort()
      .join() !== "acceptance,scope"
  )
    errors.push("Assessment permits only scope and final acceptance gates");
  for (const scenario of ["evidence_only", "requirements_led"]) {
    const route = ["scope"];
    while (route.at(-1) !== "terminal" && route.length <= Object.keys(nodes).length) {
      const next = edges.filter((edge) => edge.from === route.at(-1) && (!edge.scenario || edge.scenario === scenario));
      if (next.length !== 1 || route.includes(next[0]?.to)) break;
      route.push(next[0].to);
    }
    const expected = [
      "scope",
      ...(scenario === "requirements_led" ? ["requirements"] : []),
      "evidence",
      "analysis",
      "diagram",
      "review",
      "acceptance",
      "terminal",
    ];
    if (JSON.stringify(route) !== JSON.stringify(expected)) errors.push(`Invalid assessment phase order: ${scenario}`);
  }
  const reviews = profile.reviews;
  if (
    reviews?.comprehensive?.artifact !== "02-architecture-assessment.md" ||
    reviews?.comprehensive?.artifact_type !== "architecture" ||
    reviews?.["cost-feasibility"]?.artifact !== "03-cost-management-report.md" ||
    reviews?.["cost-feasibility"]?.artifact_type !== "cost-estimate" ||
    Object.keys(reviews ?? {}).length !== 2
  )
    errors.push("Assessment must retain both existing independent review identities and exact report paths");
  for (const [phase, outputs] of Object.entries({
    requirements: ["01-requirements.md"],
    evidence: ["01-assessment-brief.md", "contracts/assessment-evidence.json"],
    analysis: ["02-architecture-assessment.md", "03-cost-management-report.md", "contracts/03-cost-management.json"],
    diagram: ["assets/03-des-diagram.py", "assets/03-des-diagram.png", "assets/03-des-diagram.svg"],
  })) {
    if (JSON.stringify(nodes[phase]?.produces) !== JSON.stringify(outputs))
      errors.push(`Assessment phase ${phase} changes the original mandatory bundle outputs`);
  }
  return errors;
}

// Validate top-level challenger block (introduced in 2.2)
if (graph.challenger !== undefined) {
  const c = graph.challenger;
  if (typeof c !== "object" || c === null || Array.isArray(c)) {
    r.error("Top-level challenger must be an object");
  } else {
    for (const field of ["wrapper_agent", "review_subagent"]) {
      if (typeof c[field] !== "string" || c[field].trim() === "") {
        r.error(`challenger.${field} must be a non-empty string`);
      }
    }
    if (c.wrapper_agent && !agentFiles.has(c.wrapper_agent)) {
      r.warn(`challenger.wrapper_agent "${c.wrapper_agent}" not found in agent files`);
    }
    // review_subagent lives under _subagents/ and may not match getAgents()
    // exactly; accept silently here, validate-agents will cross-check.
  }
}

// Validate orchestrator_targets[]
if (graph.orchestrator_targets !== undefined) {
  if (!Array.isArray(graph.orchestrator_targets)) {
    r.error("orchestrator_targets must be an array");
  } else {
    for (const target of graph.orchestrator_targets) {
      if (typeof target !== "string" || target.trim() === "") {
        r.error(`orchestrator_targets entry must be a non-empty string (got: ${JSON.stringify(target)})`);
      } else if (!agentFiles.has(target)) {
        r.warn(`orchestrator_targets entry "${target}" not found in agent files`);
      }
    }
  }
}

// Validate ui_pseudo_targets[]
if (graph.ui_pseudo_targets !== undefined) {
  if (!Array.isArray(graph.ui_pseudo_targets)) {
    r.error("ui_pseudo_targets must be an array");
  } else {
    for (const target of graph.ui_pseudo_targets) {
      if (typeof target !== "string" || target.trim() === "") {
        r.error(`ui_pseudo_targets entry must be a non-empty string (got: ${JSON.stringify(target)})`);
      }
    }
  }
}

// Validate return_edges[]
if (graph.return_edges !== undefined) {
  if (!Array.isArray(graph.return_edges)) {
    r.error("return_edges must be an array");
  } else {
    // Build a set of (from,to,cond) tuples from edges[] for duplicate detection
    const edgeTuples = new Set();
    for (const edge of graph.edges) {
      const conds = Array.isArray(edge.condition) ? edge.condition : [edge.condition];
      for (const c of conds) edgeTuples.add(`${edge.from}|${edge.to}|${c}`);
    }
    const seen = new Set();
    for (const [i, re] of graph.return_edges.entries()) {
      if (typeof re !== "object" || re === null || Array.isArray(re)) {
        r.error(`return_edges[${i}] must be an object`);
        continue;
      }
      const label = `return_edges[${i}] (${re.from} → ${re.to})`;
      if (!nodeIds.has(re.from)) {
        r.error(`${label}: from references non-existent node`);
      }
      if (!nodeIds.has(re.to)) {
        r.error(`${label}: to references non-existent node`);
      }
      if (nodeIds.has(re.from) && nodeIds.has(re.to) && !canReachInForwardDag(graph.edges, re.to, re.from)) {
        r.error(`${label}: target "${re.to}" is not an ancestor/self of "${re.from}" in the forward workflow DAG`);
      }
      if (typeof re.reason !== "string" || re.reason.trim() === "") {
        r.error(`${label}: reason must be a non-empty string`);
      }
      validateCondition(label, re.condition);

      const conds = Array.isArray(re.condition) ? re.condition : [re.condition];
      for (const c of conds) {
        const tuple = `${re.from}|${re.to}|${c}`;
        if (edgeTuples.has(tuple)) {
          r.error(`${label}: duplicates edges[] tuple (${tuple.replace(/\|/g, ", ")})`);
        }
        if (seen.has(tuple)) {
          r.error(`${label}: duplicate within return_edges (${tuple.replace(/\|/g, ", ")})`);
        }
        seen.add(tuple);
      }

      if (re.ui_label_pattern !== undefined) {
        if (typeof re.ui_label_pattern !== "string") {
          r.error(`${label}: ui_label_pattern must be a string`);
        } else {
          try {
            new RegExp(re.ui_label_pattern);
          } catch (e) {
            r.error(`${label}: ui_label_pattern invalid regex (${e.message})`);
          }
        }
      }
    }
  }
}

// Check for orphan nodes (not targeted by any edge and not a root)
const rootNodes = Object.values(graph.nodes).filter((n) => !n.requires || n.requires.length === 0);
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
