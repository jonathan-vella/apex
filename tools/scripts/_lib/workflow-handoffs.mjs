/**
 * Workflow-Handoff Helper
 *
 * Shared logic for workflow-handoff validation in validate-agents.mjs:
 *
 *  - loadWorkflowGraph()            — read + cache workflow-graph.json
 *  - getAgentToStepMap(graph)       — agent name → step ID
 *  - forwardReachable(graph, ...)   — DAG-derived forward edge legality
 *  - hasReturnEdge(graph, ...)      — return_edges[] lookup (handles array conditions)
 *  - normalizeTrackLabel(label)     — strip Bicep|Terraform|TF tokens
 *  - normalizeTrackTarget(agentName)— collapse 06b/06t → "codegen", 07b/07t → "deploy"
 *  - buildSubagentInventory()       — names of *.agent.md under _subagents/
 *  - isVersionAtLeast22(graph)      — `metadata.version >= "2.2"` predicate
 *
 * Kept lightweight on purpose — must remain importable by both the
 * validator and the test harness (no heavy I/O at import time).
 */

import fs from "node:fs";
import path from "node:path";
import { SUBAGENTS_DIR } from "./paths.mjs";

const GRAPH_PATH = ".github/skills/workflow-engine/templates/workflow-graph.json";

let _graph = null;

/** Read + parse the workflow graph (cached). Returns null on error. */
export function loadWorkflowGraph() {
  if (_graph) return _graph;
  if (!fs.existsSync(GRAPH_PATH)) return null;
  try {
    _graph = JSON.parse(fs.readFileSync(GRAPH_PATH, "utf-8"));
  } catch {
    _graph = null;
  }
  return _graph;
}

/** Reset the cache (used by tests). */
export function resetWorkflowGraphCache() {
  _graph = null;
}

/** True iff `metadata.version` >= "2.2" (semver minor). */
export function isVersionAtLeast22(graph) {
  if (!graph?.metadata?.version) return false;
  const m = graph.metadata.version.match(/^(\d+)\.(\d+)$/);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (major > 2) return true;
  if (major === 2 && minor >= 2) return true;
  return false;
}

/**
 * Build agent-name → step-id map from `nodes`. Matches by `node.agent`
 * exactly; excludes nodes without an `agent` field (e.g. gates).
 */
export function getAgentToStepMap(graph) {
  const map = new Map();
  if (!graph?.nodes) return map;
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node?.type === "agent-step" || node?.type === "subagent-fan-out") {
      if (typeof node.agent === "string") {
        map.set(node.agent, id);
      }
    }
  }
  return map;
}

/**
 * `forwardReachable(graph, fromStep, toStep)`:
 *
 *  - Length-1 `on_complete` or `on_skip` edge from `fromStep` to `toStep`.
 *  - Length-2 `step → gate → step` chain where both edges carry
 *    `on_complete` (or, on the final hop, `on_skip`).
 *
 * Returns true if any such path exists. Works on edges with string OR
 * array `condition` (any element matches).
 */
export function forwardReachable(graph, fromStep, toStep) {
  if (!graph?.edges || !fromStep || !toStep) return false;
  if (fromStep === toStep) return false; // self-loop is a separate legality
  const edges = graph.edges;

  function hasCond(edge, ...allowed) {
    const c = Array.isArray(edge.condition) ? edge.condition : [edge.condition];
    return c.some((x) => allowed.includes(x));
  }

  // Length-1
  for (const e of edges) {
    if (e.from === fromStep && e.to === toStep && hasCond(e, "on_complete", "on_skip")) {
      return true;
    }
  }

  // Length-2 via a single intermediary node (gate or step).
  const intermediates = new Set();
  for (const e of edges) {
    if (e.from === fromStep && hasCond(e, "on_complete", "on_skip")) {
      intermediates.add(e.to);
    }
  }
  for (const e of edges) {
    if (intermediates.has(e.from) && e.to === toStep && hasCond(e, "on_complete", "on_skip")) {
      return true;
    }
  }
  return false;
}

/** Return the matching `return_edges[]` entry (or null). */
export function findReturnEdge(graph, fromStep, toStep) {
  if (!Array.isArray(graph?.return_edges)) return null;
  for (const re of graph.return_edges) {
    if (re.from === fromStep && re.to === toStep) return re;
  }
  return null;
}

/**
 * Cross-track jump detection. The four illegal pairs per spec:
 *
 *    step-5b → step-6t,  step-5t → step-6b,
 *    step-6b → step-5t,  step-6t → step-5b
 */
export function isCrossTrackJump(fromStep, toStep) {
  const pairs = [
    ["step-5b", "step-6t"],
    ["step-5t", "step-6b"],
    ["step-6b", "step-5t"],
    ["step-6t", "step-5b"],
  ];
  return pairs.some(([f, t]) => fromStep === f && toStep === t);
}

/**
 * Strip Bicep/Terraform tokens AND map tool-native verbs to canonical
 * names for B4 label normalization.
 *
 * Token strip: `Bicep|Terraform|TF|terraform|bicep|tf` removed.
 * Verb canonicalization: `What-If` ↔ `Plan` → `Preview` (semantically
 *   equivalent deploy-preview commands across the two IaC tools).
 *
 * See `references/track-parity-spec.md` for the full spec.
 */
export function normalizeTrackLabel(label) {
  if (typeof label !== "string") return "";
  return label
    .replace(/\b(Bicep|Terraform|TF|terraform|bicep|tf)\b/g, "")
    .replace(/\b(What-?If|Plan)\b/gi, "Preview")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Collapse track-specific subagent names. */
export function normalizeTrackSubagent(name) {
  if (typeof name !== "string") return name;
  if (name === "bicep-whatif-subagent" || name === "terraform-plan-subagent") {
    return "preview-subagent";
  }
  if (name === "bicep-validate-subagent" || name === "terraform-validate-subagent") {
    return "validate-subagent";
  }
  return name;
}

/** Collapse 06b/06t → "codegen", 07b/07t → "deploy", etc. */
export function normalizeTrackTarget(agentName) {
  if (typeof agentName !== "string") return agentName;
  // Top-level agents: 06b-Bicep CodeGen / 06t-Terraform CodeGen → "codegen"
  if (/^06[bt]-/.test(agentName)) return "codegen";
  if (/^07[bt]-/.test(agentName)) return "deploy";
  // Subagents: track-specific → role
  return normalizeTrackSubagent(agentName);
}

/** List subagent names (frontmatter `name:` strings) under `_subagents/`. */
export function buildSubagentInventory() {
  const out = new Set();
  if (!fs.existsSync(SUBAGENTS_DIR)) return out;
  for (const file of fs.readdirSync(SUBAGENTS_DIR)) {
    if (!file.endsWith(".agent.md")) continue;
    const filePath = path.join(SUBAGENTS_DIR, file);
    let content;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    const m = content.match(/^---\n([\s\S]*?)\n---/);
    if (!m) continue;
    const nameMatch = m[1].match(/^name:\s*(.+?)\s*$/m);
    if (nameMatch) out.add(nameMatch[1].trim().replace(/^["']|["']$/g, ""));
  }
  return out;
}

/**
 * Extract artifact paths from a handoff prompt. Returns an array of
 * `{ path, role, raw }` where `role ∈ "input" | "output" | "unknown"`.
 *
 * Linear-scan algorithm:
 *
 *   1. Find each artifact path ("agent-output/{project}/X.md") in document order.
 *   2. For each path, look BACKWARDS for the nearest `Input:` or `Output:`
 *      label that has no other label between it and the path.
 *   3. If no label precedes the path → role="unknown" (path is contextual,
 *      not an Input/Output declaration).
 *
 * This avoids the trap where one prompt mentions both an upstream
 * artifact (contextual) and Output paths in one sentence.
 */
export function extractArtifactRefs(prompt) {
  if (typeof prompt !== "string") return [];
  const out = [];
  const PATH_RE = /agent-output\/\{project\}\/([\w.-]+\.md)/g;
  const LABEL_RE = /\b(Input|Output)\s*:/gi;

  // Index every label position for backward-search.
  const labels = [];
  let lm;
  while ((lm = LABEL_RE.exec(prompt)) !== null) {
    labels.push({ pos: lm.index, role: lm[1].toLowerCase() });
  }

  let pm;
  while ((pm = PATH_RE.exec(prompt)) !== null) {
    const pathPos = pm.index;
    let role = "unknown";
    // Find the nearest label that precedes this path.
    for (let i = labels.length - 1; i >= 0; i--) {
      if (labels[i].pos < pathPos) {
        role = labels[i].role;
        break;
      }
    }
    out.push({ path: pm[1], role, raw: pm[0] });
  }
  return out;
}

/** Build a Set<string> of artifact basenames produced by any step in `graph`. */
export function collectAllProducedArtifacts(graph) {
  const set = new Set();
  if (!graph?.nodes) return set;
  for (const node of Object.values(graph.nodes)) {
    if (Array.isArray(node?.produces)) {
      for (const p of node.produces) {
        // Strip directory prefixes (e.g. "infra/bicep/{project}/" → keep as-is)
        // and glob suffixes — match by basename for handoff cross-checks.
        const base = p.replace(/.*\//, "");
        if (base.endsWith(".md")) set.add(base);
        // Also keep the wildcard pattern token for matching (e.g. 03-des-adr-*.md)
        if (base.includes("*")) set.add(base);
      }
    }
  }
  return set;
}

/** Match a literal artifact basename against the producer set, allowing wildcards. */
export function isProducedArtifact(name, producedSet) {
  if (producedSet.has(name)) return true;
  for (const p of producedSet) {
    if (!p.includes("*")) continue;
    const re = new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    if (re.test(name)) return true;
  }
  return false;
}
