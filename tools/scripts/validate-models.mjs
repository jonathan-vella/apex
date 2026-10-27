#!/usr/bin/env node
/**
 * Model Validators (consolidated)
 *
 * Read-only validators for optional legacy model pins and deprecated model
 * deny-list checks, selectable via `--only`:
 *
 *   --only=consistency  Explicit legacy `model` pins match across
 *                       frontmatter and registry; both may be absent.
 *   --only=deprecated   No deprecated model label reappears in agent
 *                       definitions, prompt files, or the registry.
 *
 * With no `--only` flag both run in sequence and the process exits
 * non-zero if any failed.
 *
 * @example
 *   node tools/scripts/validate-models.mjs                 # both modes
 *   node tools/scripts/validate-models.mjs --only=consistency
 *   node tools/scripts/validate-models.mjs --only=deprecated
 */
import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";
import { getAgents } from "./_lib/workspace-index.mjs";
import { REGISTRY_PATH } from "./_lib/paths.mjs";
import { DEFAULT_MODEL_CATALOG, modelLabels, walkRegistry } from "./_lib/model-helpers.mjs";
import { readJsonCached } from "./_lib/json.mjs";

const ROOT = process.cwd();

/**
 * Print a Reporter's pass/fail message (mirroring `Reporter.exitOnError`
 * output) without exiting, and return whether the mode passed. Lets the
 * dispatcher aggregate multiple modes while preserving per-mode output.
 */
function finishMode(r, passMsg, failMsg) {
  if (r.errors > 0) {
    console.log(`\n❌ ${failMsg}`);
    return false;
  }
  if (r.warnings > 0) {
    console.log(`\n⚠️  Passed with ${r.warnings} warning(s)`);
  } else {
    console.log(`\n✅ ${passMsg}`);
  }
  return true;
}

// ── Mode: consistency ────────────────────────────────────────────────────────

function buildAgentLookup(agents) {
  const byBase = new Map();
  const byRelPath = new Map();
  for (const [file, agent] of agents) {
    byBase.set(file, agent.frontmatter || null);
    if (agent.path) {
      const rel = agent.path.replace(/^\.?\/?/, "");
      byRelPath.set(rel, agent.frontmatter || null);
    }
  }
  return { byBase, byRelPath };
}

function findAgentFrontmatter(lookup, registryAgentPath) {
  if (!registryAgentPath) return null;
  const direct = lookup.byRelPath.get(registryAgentPath);
  if (direct !== undefined) return direct;
  const base = registryAgentPath.split("/").pop();
  if (base && lookup.byBase.has(base)) return lookup.byBase.get(base);
  return null;
}

function checkConsistencyEntry(r, key, entry, lookup) {
  const registryAgentPath = entry.agent;
  if (!registryAgentPath) {
    r.error(`Agent "${key}"`, "registry entry missing agent file path");
    return;
  }
  const fm = findAgentFrontmatter(lookup, registryAgentPath);
  if (!fm) {
    r.error(`Agent "${key}"`, `agent file not found in workspace index: ${registryAgentPath}`);
    return;
  }
  let yamlModels;
  let regModels;
  try {
    yamlModels = modelLabels(fm.model);
    regModels = modelLabels(entry.model);
  } catch (error) {
    r.error(`Agent "${key}"`, error.message);
    return;
  }

  if (yamlModels.length === 0 && regModels.length === 0) return;
  if (yamlModels.length === 0 || regModels.length === 0) {
    r.error(`Agent "${key}"`, "legacy model pin must either be absent from both sources or present in both");
    return;
  }
  if (JSON.stringify(yamlModels) !== JSON.stringify(regModels)) {
    r.error(
      `Agent "${key}"`,
      `frontmatter models ${JSON.stringify(yamlModels)} do not equal registry models ${JSON.stringify(regModels)}`,
    );
  }
}

function runConsistency() {
  const r = new Reporter("Model Consistency Validator");
  console.log("\n📋 Validating optional legacy model-pin consistency...\n");

  if (!fs.existsSync(REGISTRY_PATH)) {
    r.error(`Agent registry not found at ${REGISTRY_PATH}`);
    return false;
  }

  let registry;
  try {
    registry = readJsonCached(REGISTRY_PATH);
  } catch (e) {
    r.error(`Cannot parse ${REGISTRY_PATH}: ${e.message}`);
    return false;
  }

  const lookup = buildAgentLookup(getAgents());
  let count = 0;
  for (const [label, entry] of walkRegistry(registry)) {
    checkConsistencyEntry(r, label, entry, lookup);
    count++;
  }
  r.ok(`Checked ${count} registry entries`);
  console.log(`\n📊 Results: ${r.errors} error(s), ${r.warnings} warning(s)\n`);

  if (r.errors > 0) {
    console.error("❌ Model consistency validation failed\n");
    return false;
  }
  console.log("✅ Model consistency validation passed\n");
  return true;
}

// ── Mode: deprecated ─────────────────────────────────────────────────────────

const SCAN_GLOBS = [".github/agents", "tools/tests/prompts"];
const ALLOWED_FILES = new Set([
  "CHANGELOG.md",
  "docs/CHANGELOG.md",
  "QUALITY_SCORE.md",
  "tools/scripts/validate-models.mjs",
]);

function loadDeprecatedModels() {
  const models = DEFAULT_MODEL_CATALOG.models ?? {};
  return Object.entries(models)
    .filter(([, v]) => v?.deprecated === true)
    .map(([name]) => name);
}

function walkDir(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkDir(full));
    else out.push(full);
  }
  return out;
}

function collectDeprecatedScanFiles() {
  const files = [];
  for (const g of SCAN_GLOBS) {
    files.push(...walkDir(path.join(ROOT, g)));
  }
  files.push(path.join(ROOT, REGISTRY_PATH));
  return files.filter((f) => {
    const rel = path.relative(ROOT, f);
    if (ALLOWED_FILES.has(rel)) return false;
    return f.endsWith(".md") || f.endsWith(".json");
  });
}

function scanDeprecatedFile(file, deprecated) {
  const text = fs.readFileSync(file, "utf8");
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const label of deprecated) {
      if (lines[i].includes(label)) {
        hits.push({ line: i + 1, label, content: lines[i].trim() });
      }
    }
  }
  return hits;
}

function runDeprecated() {
  const r = new Reporter("Deprecated Models Deny-List");
  r.header();
  const deprecated = loadDeprecatedModels();
  if (deprecated.length === 0) {
    console.log("  ℹ️  No deprecated models configured. Nothing to enforce.");
    r.summary();
    return true;
  }
  console.log(`  Deprecated labels: ${deprecated.join(", ")}`);

  const files = collectDeprecatedScanFiles();
  for (const f of files) {
    r.tick();
    const hits = scanDeprecatedFile(f, deprecated);
    const rel = path.relative(ROOT, f);
    for (const h of hits) {
      r.errorAnnotation(
        rel,
        `Line ${h.line}: deprecated model label "${h.label}" — remove or migrate. Context: ${h.content.slice(0, 120)}`,
      );
    }
  }
  r.summary();
  return finishMode(
    r,
    "No deprecated model labels found.",
    "Deprecated model labels detected — see annotations above.",
  );
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

const MODES = {
  consistency: runConsistency,
  deprecated: runDeprecated,
};

function main() {
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length) : null;

  if (only && !MODES[only]) {
    console.error(`Unknown --only=${only}. Valid: ${Object.keys(MODES).join(", ")}`);
    process.exit(2);
  }

  const selected = only ? [only] : Object.keys(MODES);
  let allPass = true;
  for (const mode of selected) {
    const pass = MODES[mode]();
    allPass = allPass && pass;
  }
  process.exit(allPass ? 0 : 1);
}

main();
