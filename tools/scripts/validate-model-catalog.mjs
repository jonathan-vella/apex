#!/usr/bin/env node
/**
 * Model Catalog Validator
 *
 * Enforces three invariants on `.github/model-catalog.json`:
 *
 *   1. Every model label referenced by agent/subagent frontmatter and by
 *      the agent registry exists in the catalog `models` block. The
 *      catalog therefore acts as the authorized-label allow-list.
 *   2. The catalog `assignments` block matches the generator output
 *      exactly. Drift between frontmatter and the catalog is forbidden.
 *   3. A model marked `deprecated: true` in `models` may remain for
 *      audit history but must not appear in any active assignment
 *      (frontmatter or registry).
 *
 * @example
 *   node tools/scripts/validate-model-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";
import { getAgents } from "./_lib/workspace-index.mjs";
import { REGISTRY_PATH } from "./_lib/paths.mjs";
import { buildAssignments } from "./generate-model-catalog.mjs";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, ".github", "model-catalog.json");

const r = new Reporter("Model Catalog Validator");

function normalizeModel(raw) {
  if (!raw) return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return null;
  return v.replace(/ \(copilot\)$/i, "").trim();
}

function collectRegistryModels(registry) {
  const out = new Map(); // model -> [origin labels]
  function add(model, origin) {
    const m = normalizeModel(model);
    if (!m) return;
    if (!out.has(m)) out.set(m, []);
    out.get(m).push(origin);
  }
  function walk(key, entry) {
    if (entry.bicep || entry.terraform) {
      if (entry.bicep) add(entry.bicep.model, `${key}.bicep`);
      if (entry.terraform) add(entry.terraform.model, `${key}.terraform`);
      return;
    }
    add(entry.model, key);
  }
  for (const [k, e] of Object.entries(registry.agents || {})) walk(k, e);
  for (const [k, e] of Object.entries(registry.subagents || {})) walk(k, e);
  return out;
}

function collectFrontmatterModels() {
  const out = new Map();
  for (const [file, a] of getAgents()) {
    const m = normalizeModel(a.frontmatter?.model);
    if (!m) continue;
    if (!out.has(m)) out.set(m, []);
    out.get(m).push(file);
  }
  return out;
}

function main() {
  r.header();

  if (!fs.existsSync(CATALOG_PATH)) {
    r.error("model-catalog.json", `not found at ${CATALOG_PATH}`);
    r.summary();
    r.exitOnError();
    return;
  }
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const declared = new Set(Object.keys(catalog.models || {}));
  const deprecated = new Set(
    Object.entries(catalog.models || {})
      .filter(([, v]) => v?.deprecated === true)
      .map(([k]) => k),
  );

  // Check 1: every referenced label exists in catalog.models
  console.log("  Check 1: referenced labels exist in catalog.models");
  const fmModels = collectFrontmatterModels();
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  const regModels = collectRegistryModels(registry);
  for (const [model, origins] of fmModels) {
    r.tick();
    if (!declared.has(model)) {
      r.error(
        `frontmatter model "${model}"`,
        `not declared in catalog.models — used by ${origins.join(", ")}`,
      );
    }
  }
  for (const [model, origins] of regModels) {
    r.tick();
    if (!declared.has(model)) {
      r.error(
        `registry model "${model}"`,
        `not declared in catalog.models — used by ${origins.join(", ")}`,
      );
    }
  }

  // Check 2: assignments block matches generator output
  console.log("  Check 2: assignments block matches frontmatter");
  const expected = buildAssignments();
  const actual = catalog.assignments;
  r.tick();
  if (!actual) {
    r.error(
      "assignments",
      "missing from catalog — run `node tools/scripts/generate-model-catalog.mjs`",
    );
  } else if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    r.error(
      "assignments",
      "out of sync with frontmatter — run `node tools/scripts/generate-model-catalog.mjs`",
    );
  }

  // Check 3: deprecated models not used in active assignments
  console.log(
    "  Check 3: deprecated models absent from active assignments",
  );
  for (const dep of deprecated) {
    r.tick();
    const fmHits = fmModels.get(dep) || [];
    const regHits = regModels.get(dep) || [];
    if (fmHits.length || regHits.length) {
      r.error(
        `deprecated model "${dep}"`,
        `still in active use — frontmatter: ${fmHits.join(", ") || "none"}; registry: ${regHits.join(", ") || "none"}`,
      );
    }
  }

  r.summary();
  r.exitOnError(
    "Model catalog validation passed",
    "Model catalog validation failed — see errors above",
  );
}

main();
