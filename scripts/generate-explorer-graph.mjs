#!/usr/bin/env node
/**
 * Generate architecture explorer graph JSON.
 *
 * Scans the repo for agents, subagents, skills, instructions, prompts, MCP
 * servers, validators, and CI workflows. Emits a single JSON file at
 * `site/public/architecture-explorer-graph.json` consumed by the interactive
 * Cytoscape-based explorer.
 *
 * Counts are computed from disk; the explorer UI reads them at runtime so no
 * entity count is ever hardcoded (honours `.github/count-manifest.json`
 * as the authoritative source of truth).
 *
 * Edges:
 *  - agent → subagent (frontmatter `agents:` field)
 *  - agent handoff → agent (frontmatter `handoffs[].agent`)
 *  - agent → skill (from `.github/skill-affinity.json`, tiered)
 *  - prompt → agent (slug match, e.g. `02-requirements` → `02-Requirements`)
 *  - instruction → agent/skill/prompt (via `applyTo` glob + name match)
 *  - workflow → validator (parse YAML for `npm run …`, expanding composite scripts)
 *  - agent → mcp (scan agent body for MCP server names)
 *  - skill → skill (parse SKILL.md for references to other skill slugs)
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./_lib/parse-frontmatter.mjs";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), "..");
const OUT_PATH = join(
  REPO_ROOT,
  "site/public/architecture-explorer-graph.json",
);

const GITHUB_BASE =
  "https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/";
const DOCS_BASE = "/azure-agentic-infraops/";

/** @type {Array<{id: string, key: string, label: string, color: string, shape: string}>} */
const CATEGORIES = [
  {
    id: "agent",
    key: "agents",
    label: "Agent",
    color: "#3b82f6",
    shape: "round-rectangle",
  },
  {
    id: "subagent",
    key: "subagents",
    label: "Subagent",
    color: "#6366f1",
    shape: "round-diamond",
  },
  {
    id: "skill",
    key: "skills",
    label: "Skill",
    color: "#10b981",
    shape: "ellipse",
  },
  {
    id: "instruction",
    key: "instructions",
    label: "Instruction",
    color: "#f59e0b",
    shape: "rectangle",
  },
  {
    id: "prompt",
    key: "prompts",
    label: "Prompt",
    color: "#ec4899",
    shape: "tag",
  },
  {
    id: "validator",
    key: "validators",
    label: "Validator",
    color: "#8b5cf6",
    shape: "hexagon",
  },
  {
    id: "workflow",
    key: "workflows",
    label: "CI Workflow",
    color: "#06b6d4",
    shape: "cut-rectangle",
  },
  {
    id: "mcp",
    key: "mcp_servers",
    label: "MCP Server",
    color: "#f43f5e",
    shape: "barrel",
  },
];

function listFiles(dir, filter) {
  try {
    return readdirSync(dir)
      .filter(filter)
      .map((f) => join(dir, f))
      .filter((f) => statSync(f).isFile());
  } catch {
    return [];
  }
}

function slug(id) {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// ---------- Node collectors ----------

function collectAgents() {
  const dir = join(REPO_ROOT, ".github/agents");
  const files = listFiles(dir, (f) => f.endsWith(".agent.md"));
  return files.map((path) => {
    const content = readFileSync(path, "utf8");
    const fm = parseFrontmatter(content) || {};
    const name = fm.name || basename(path, ".agent.md");
    return {
      id: `agent:${slug(name)}`,
      category: "agent",
      label: name,
      description: fm.description || "",
      path: relative(REPO_ROOT, path),
      links: {
        source: GITHUB_BASE + relative(REPO_ROOT, path),
      },
      meta: {
        model: asArray(fm.model)[0] || null,
        invocable: fm["user-invocable"] !== "false",
        subagents: asArray(fm.agents),
        handoffTargets: extractHandoffAgents(content),
      },
    };
  });
}

function collectSubagents() {
  const dir = join(REPO_ROOT, ".github/agents/_subagents");
  const files = listFiles(dir, (f) => f.endsWith(".agent.md"));
  return files.map((path) => {
    const content = readFileSync(path, "utf8");
    const fm = parseFrontmatter(content) || {};
    const name = fm.name || basename(path, ".agent.md");
    return {
      id: `subagent:${slug(name)}`,
      category: "subagent",
      label: name,
      description: fm.description || "",
      path: relative(REPO_ROOT, path),
      links: { source: GITHUB_BASE + relative(REPO_ROOT, path) },
      meta: { model: asArray(fm.model)[0] || null },
    };
  });
}

function collectSkills() {
  const skillsDir = join(REPO_ROOT, ".github/skills");
  let dirs = [];
  try {
    dirs = readdirSync(skillsDir).filter((d) =>
      statSync(join(skillsDir, d)).isDirectory(),
    );
  } catch {
    return [];
  }
  return dirs
    .map((d) => {
      const skillPath = join(skillsDir, d, "SKILL.md");
      try {
        const content = readFileSync(skillPath, "utf8");
        const fm = parseFrontmatter(content) || {};
        return {
          id: `skill:${slug(d)}`,
          category: "skill",
          label: fm.name || d,
          description: fm.description || "",
          path: relative(REPO_ROOT, skillPath),
          links: { source: GITHUB_BASE + relative(REPO_ROOT, skillPath) },
          meta: {},
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function collectInstructions() {
  const dir = join(REPO_ROOT, ".github/instructions");
  const files = listFiles(dir, (f) => f.endsWith(".instructions.md"));
  return files.map((path) => {
    const content = readFileSync(path, "utf8");
    const fm = parseFrontmatter(content) || {};
    const name = basename(path, ".instructions.md");
    return {
      id: `instruction:${slug(name)}`,
      category: "instruction",
      label: name,
      description: fm.description || "",
      path: relative(REPO_ROOT, path),
      links: { source: GITHUB_BASE + relative(REPO_ROOT, path) },
      meta: { applyTo: fm.applyto || fm.applyTo || "" },
    };
  });
}

function collectPrompts() {
  const dir = join(REPO_ROOT, ".github/prompts");
  const files = listFiles(dir, (f) => f.endsWith(".prompt.md"));
  return files.map((path) => {
    const content = readFileSync(path, "utf8");
    const fm = parseFrontmatter(content) || {};
    const name = basename(path, ".prompt.md");
    return {
      id: `prompt:${slug(name)}`,
      category: "prompt",
      label: name,
      description: fm.description || "",
      path: relative(REPO_ROOT, path),
      links: { source: GITHUB_BASE + relative(REPO_ROOT, path) },
      meta: {},
    };
  });
}

function collectWorkflows() {
  const dir = join(REPO_ROOT, ".github/workflows");
  const files = listFiles(
    dir,
    (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
  );
  return files.map((path) => {
    const name = basename(path).replace(/\.(yml|yaml)$/, "");
    return {
      id: `workflow:${slug(name)}`,
      category: "workflow",
      label: name,
      description: "",
      path: relative(REPO_ROOT, path),
      links: { source: GITHUB_BASE + relative(REPO_ROOT, path) },
      meta: {},
    };
  });
}

function collectValidators() {
  // Validators = unique script names referenced by `validate:_node` +
  // `validate:_external` in package.json (the canonical count source).
  const pkg = readJson(join(REPO_ROOT, "package.json"));
  const scripts = pkg.scripts || {};
  const collect = (name) => {
    const run = scripts[name] || "";
    return run
      .split(/\s+/)
      .filter((tok) => scripts[tok]) // only tokens that are real script names
      .map((tok) => tok);
  };
  const nodeScripts = collect("validate:_node");
  const externalScripts = collect("validate:_external");
  const unique = [...new Set([...nodeScripts, ...externalScripts])];
  return unique.map((name) => ({
    id: `validator:${slug(name)}`,
    category: "validator",
    label: name,
    description: scripts[name] || "",
    path: "package.json",
    links: {
      source: GITHUB_BASE + "package.json",
    },
    meta: { command: scripts[name] || "" },
  }));
}

function collectMcpServers() {
  const mcp = readJson(join(REPO_ROOT, ".vscode/mcp.json"));
  const servers = mcp.servers || {};
  return Object.entries(servers).map(([name, cfg]) => ({
    id: `mcp:${slug(name)}`,
    category: "mcp",
    label: name,
    description:
      cfg.type === "http" ? `HTTP: ${cfg.url}` : `stdio: ${cfg.command || ""}`,
    path: ".vscode/mcp.json",
    links: { source: GITHUB_BASE + ".vscode/mcp.json" },
    meta: { type: cfg.type || "" },
  }));
}

// ---------- Edge collectors ----------

function extractHandoffAgents(content) {
  // Parse `handoffs:` block for `agent: <Name>` lines
  const m = content.match(/^handoffs:\s*\n([\s\S]*?)(?=\n[a-z-]+:\s|\n---)/m);
  if (!m) return [];
  const lines = m[1].split("\n");
  const agents = new Set();
  for (const line of lines) {
    const a = line.match(/^\s*agent:\s*["']?([^"'\n]+?)["']?\s*$/);
    if (a) agents.add(a[1].trim());
  }
  return [...agents];
}

function buildEdges(nodes, skillAffinity) {
  const edges = [];
  const byLabel = new Map();
  const bySlug = new Map();
  for (const n of nodes) {
    byLabel.set(n.label, n);
    bySlug.set(slug(n.label), n);
  }

  const findNode = (name, category) => {
    // Try exact label, then slug match, optionally scoped by category.
    const candidates = [byLabel.get(name), bySlug.get(slug(name))].filter(
      Boolean,
    );
    if (category) {
      const scoped = candidates.find((c) => c.category === category);
      if (scoped) return scoped;
    }
    return candidates[0] || null;
  };

  // Agent -> Subagent (from `agents:` frontmatter)
  for (const n of nodes) {
    if (n.category !== "agent") continue;
    for (const sub of n.meta.subagents || []) {
      const target = findNode(sub, "subagent");
      if (target) {
        edges.push({
          id: `${n.id}--delegates->${target.id}`,
          source: n.id,
          target: target.id,
          kind: "delegates",
        });
      }
    }
  }

  // Agent -> Agent (handoffs)
  for (const n of nodes) {
    if (n.category !== "agent") continue;
    for (const handoff of n.meta.handoffTargets || []) {
      const target = findNode(handoff, "agent");
      if (target && target.id !== n.id) {
        edges.push({
          id: `${n.id}--hands-off->${target.id}`,
          source: n.id,
          target: target.id,
          kind: "hands-off",
        });
      }
    }
  }

  // Agent -> Skill (from skill-affinity.json)
  const affinity = skillAffinity.agents || {};
  for (const [agentLabel, tiers] of Object.entries(affinity)) {
    const agentNode = findNode(agentLabel, "agent");
    if (!agentNode) continue;
    for (const tier of ["primary", "secondary"]) {
      for (const skillName of tiers[tier] || []) {
        const skillNode = findNode(skillName, "skill");
        if (skillNode) {
          edges.push({
            id: `${agentNode.id}--uses-${tier}->${skillNode.id}`,
            source: agentNode.id,
            target: skillNode.id,
            kind: tier === "primary" ? "uses-primary" : "uses-secondary",
          });
        }
      }
    }
  }

  // Prompt -> Agent (by slug match, e.g. 02-requirements prompt -> 02-Requirements agent)
  for (const n of nodes) {
    if (n.category !== "prompt") continue;
    const promptSlug = n.id.replace(/^prompt:/, "");
    const target = nodes.find(
      (m) => m.category === "agent" && slug(m.label) === promptSlug,
    );
    if (target) {
      edges.push({
        id: `${n.id}--invokes->${target.id}`,
        source: n.id,
        target: target.id,
        kind: "invokes",
      });
    }
  }

  // Instruction -> Agent/Skill/Prompt (by applyTo glob)
  // For each file-type glob in `applyTo`, connect either to every node in the
  // matching category (when the applyTo is broad like `**/*.agent.md`) or to a
  // specific node when the applyTo names one explicitly. Self-edges filtered.
  for (const n of nodes) {
    if (n.category !== "instruction") continue;
    const applyTo = (n.meta.applyTo || "").toString();
    if (!applyTo) continue;
    const targetCats = new Set();
    if (/\.agent\.md/i.test(applyTo)) {
      targetCats.add("agent");
      targetCats.add("subagent");
    }
    if (/SKILL\.md|skills\//i.test(applyTo)) targetCats.add("skill");
    if (/\.prompt\.md/i.test(applyTo)) targetCats.add("prompt");
    if (/\.instructions\.md/i.test(applyTo)) targetCats.add("instruction");
    if (targetCats.size === 0) continue;
    for (const cat of targetCats) {
      // Prefer an explicit name match inside applyTo (e.g. "orchestrator").
      const explicit = nodes.find(
        (m) =>
          m.category === cat &&
          m.id !== n.id &&
          new RegExp(`\\b${slug(m.label).replace(/-/g, "[-_]")}\\b`, "i").test(
            applyTo,
          ),
      );
      const targets = explicit
        ? [explicit]
        : nodes.filter((m) => m.category === cat && m.id !== n.id);
      for (const t of targets) {
        edges.push({
          id: `${n.id}--applies-to->${t.id}`,
          source: n.id,
          target: t.id,
          kind: "applies-to",
        });
      }
    }
  }

  // Workflow -> Validator (parse YAML for `npm run <script>` references,
  // recursively expanding composite scripts like `validate:_node`).
  const pkgScripts = readJson(join(REPO_ROOT, "package.json")).scripts || {};
  const validatorLabels = new Set(
    nodes.filter((m) => m.category === "validator").map((m) => m.label),
  );
  function expandScript(name, seen = new Set()) {
    if (seen.has(name)) return [];
    seen.add(name);
    if (validatorLabels.has(name)) return [name];
    const body = pkgScripts[name];
    if (!body) return [];
    // Expand tokens that are themselves script names
    const tokens = body.split(/\s+/).filter((t) => pkgScripts[t]);
    return tokens.flatMap((t) => expandScript(t, seen));
  }
  for (const n of nodes) {
    if (n.category !== "workflow") continue;
    let yamlContent;
    try {
      yamlContent = readFileSync(join(REPO_ROOT, n.path), "utf8");
    } catch {
      continue;
    }
    const seen = new Set();
    const re = /npm run\s+([a-zA-Z][\w:-]+)/g;
    let match;
    while ((match = re.exec(yamlContent))) {
      const scriptName = match[1];
      for (const validatorName of expandScript(scriptName)) {
        if (seen.has(validatorName)) continue;
        seen.add(validatorName);
        const validator = nodes.find(
          (m) => m.category === "validator" && m.label === validatorName,
        );
        if (validator) {
          edges.push({
            id: `${n.id}--runs->${validator.id}`,
            source: n.id,
            target: validator.id,
            kind: "runs",
          });
        }
      }
    }
  }

  // Agent -> MCP (scan agent body for MCP server names)
  const mcpNodes = nodes.filter((m) => m.category === "mcp");
  for (const n of nodes) {
    if (n.category !== "agent" && n.category !== "subagent") continue;
    let body;
    try {
      body = readFileSync(join(REPO_ROOT, n.path), "utf8").toLowerCase();
    } catch {
      continue;
    }
    const seen = new Set();
    for (const mcpNode of mcpNodes) {
      const mcpName = mcpNode.label.toLowerCase();
      if (seen.has(mcpNode.id)) continue;
      const re = new RegExp(
        `\\b${mcpName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      );
      if (re.test(body)) {
        seen.add(mcpNode.id);
        edges.push({
          id: `${n.id}--uses-mcp->${mcpNode.id}`,
          source: n.id,
          target: mcpNode.id,
          kind: "uses-mcp",
        });
      }
    }
  }

  // Skill -> Skill (parse SKILL.md body/description for references to other skills, e.g. "delegates to drawio")
  const skillNodes = nodes.filter((m) => m.category === "skill");
  const skillSlugMap = new Map(
    skillNodes.map((s) => [s.id.replace(/^skill:/, ""), s]),
  );
  for (const n of skillNodes) {
    let body;
    try {
      body = readFileSync(join(REPO_ROOT, n.path), "utf8");
    } catch {
      continue;
    }
    const nSlug = n.id.replace(/^skill:/, "");
    const seen = new Set();
    for (const [otherSlug, otherNode] of skillSlugMap) {
      if (otherSlug === nSlug || seen.has(otherNode.id)) continue;
      // Match word-boundary backtick or plain reference
      const re = new RegExp(`\\b${otherSlug}\\b`);
      if (re.test(body)) {
        seen.add(otherNode.id);
        edges.push({
          id: `${n.id}--refs->${otherNode.id}`,
          source: n.id,
          target: otherNode.id,
          kind: "refs",
        });
      }
    }
  }

  // Final passes: drop self-edges and dedupe by edge id.
  const filtered = edges.filter((e) => e.source !== e.target);
  const byId = new Map();
  for (const e of filtered) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  return Array.from(byId.values());
}

// ---------- Main ----------

function main() {
  const agents = collectAgents();
  const subagents = collectSubagents();
  const skills = collectSkills();
  const instructions = collectInstructions();
  const prompts = collectPrompts();
  const validators = collectValidators();
  const workflows = collectWorkflows();
  const mcp = collectMcpServers();

  const nodes = [
    ...agents,
    ...subagents,
    ...skills,
    ...instructions,
    ...prompts,
    ...validators,
    ...workflows,
    ...mcp,
  ];

  let skillAffinity = { agents: {} };
  try {
    skillAffinity = readJson(join(REPO_ROOT, ".github/skill-affinity.json"));
  } catch {
    // optional
  }

  const edges = buildEdges(nodes, skillAffinity);

  // Mark orphans (nodes with no edges) and assign them to a category-level
  // compound parent node. This lets the explorer collapse the disconnected
  // "grid of dots" into tidy group bubbles.
  const connected = new Set();
  for (const e of edges) {
    connected.add(e.source);
    connected.add(e.target);
  }
  const orphansByCat = new Map();
  for (const n of nodes) {
    if (connected.has(n.id)) continue;
    n.meta = n.meta || {};
    n.meta.orphan = true;
    if (!orphansByCat.has(n.category)) orphansByCat.set(n.category, []);
    orphansByCat.get(n.category).push(n);
  }
  const parentNodes = [];
  for (const [catId, members] of orphansByCat) {
    if (members.length < 2) continue; // don't group singletons
    const cat = CATEGORIES.find((c) => c.id === catId);
    const parentId = `group:${catId}-orphans`;
    parentNodes.push({
      id: parentId,
      category: catId,
      label: `${cat?.label || catId} (unlinked, ${members.length})`,
      description: `${members.length} ${cat?.label?.toLowerCase() || catId} nodes with no cross-references in the current graph.`,
      isGroup: true,
      meta: { groupSize: members.length },
    });
    for (const m of members) {
      m.parent = parentId;
    }
  }
  nodes.push(...parentNodes);

  const categories = CATEGORIES.map((c) => ({
    ...c,
    count: nodes.filter((n) => n.category === c.id).length,
  }));

  const generatedAt = new Date().toISOString();
  const graph = {
    $schema: "architecture-explorer-graph-v1",
    generatedAt,
    categories,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
  };

  writeFileSync(OUT_PATH, JSON.stringify(graph, null, 2) + "\n");
  console.log(
    `✅ Generated ${relative(REPO_ROOT, OUT_PATH)} — ${nodes.length} nodes, ${edges.length} edges`,
  );
  console.log(
    "   " + categories.map((c) => `${c.label}:${c.count}`).join("  "),
  );
}

main();
