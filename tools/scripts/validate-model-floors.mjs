#!/usr/bin/env node
/**
 * Model Floor Validator
 *
 * Enforces that every agent's declared `model` frontmatter appears in
 * `.github/model-catalog.json` (unknown models are errors). Models marked
 * `deprecated` in the catalog emit a warning (not an error) to allow a
 * grace period before removal. This catches:
 *   - Typos ("Claude opus 4.6" vs "Claude Opus 4.6") — error
 *   - Silent drift to unapproved models — error
 *   - Use of deprecated models still referenced in agent files — warning
 *
 * The catalog is the single source of truth. Update it when model availability
 * changes; update agents to match.
 *
 * @example
 *   node tools/scripts/validate-model-floors.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAgents } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(
  __dirname,
  "../..",
  ".github",
  "model-catalog.json",
);

const r = new Reporter("Model Floor Validator");
r.header();

if (!fs.existsSync(CATALOG_PATH)) {
  console.error(
    "❌ Missing .github/model-catalog.json — create the catalog before running this validator.",
  );
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
const allowed = new Set(Object.keys(catalog.models || {}));
const deprecated = new Set(
  Object.entries(catalog.models || {})
    .filter(([, meta]) => meta.deprecated)
    .map(([name]) => name),
);

const agents = getAgents();

for (const [file, agent] of agents) {
  r.tick();
  const raw = agent.frontmatter?.model;
  if (!raw) {
    r.warnAnnotation(agent.path, `${file}: no model field declared`);
    continue;
  }

  // model may be a string or array; normalize to string[]
  const models = Array.isArray(raw) ? raw : [String(raw)];

  for (const m of models) {
    // Strip " (copilot)" suffix and quotes that some agents use.
    const name = String(m)
      .replace(/\s*\(copilot\)\s*$/i, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    if (!allowed.has(name)) {
      r.errorAnnotation(
        agent.path,
        `${file}: model "${name}" is not listed in .github/model-catalog.json`,
      );
      console.log(`  Allowed: ${Array.from(allowed).join(", ")}`);
      continue;
    }

    if (deprecated.has(name)) {
      r.warnAnnotation(
        agent.path,
        `${file}: model "${name}" is marked deprecated in model-catalog.json`,
      );
    }
  }
}

r.summary();
r.exitOnError("Model floor check passed");
