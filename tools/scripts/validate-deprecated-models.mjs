#!/usr/bin/env node
/**
 * Deprecated Models Deny-List
 *
 * Fails CI if a deprecated Claude/GPT model label reappears in agent
 * definitions, prompt files, or the agent registry. Acts as a guard
 * against accidental regression after a model migration (e.g., the
 * 2026-05 Claude Opus 4.6 → 4.7 migration).
 *
 * The model catalog (.github/model-catalog.json) is allowed to retain
 * deprecated entries as audit history; CHANGELOG / changelog mirrors /
 * QUALITY_SCORE / freshness historical-correction notes are also
 * allowed. Everywhere else, deprecated labels are forbidden.
 *
 * Source-of-truth for deprecated labels: .github/model-catalog.json
 * (any model where `deprecated: true`).
 *
 * @example
 *   node tools/scripts/validate-deprecated-models.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";
import { REGISTRY_PATH } from "./_lib/paths.mjs";

const r = new Reporter("Deprecated Models Deny-List");

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, ".github", "model-catalog.json");
const SCAN_GLOBS = [".github/agents", "tools/apex-prompts", "tools/tests/prompts"];
const ALLOWED_FILES = new Set([
  ".github/model-catalog.json",
  "CHANGELOG.md",
  "docs/CHANGELOG.md",
  "site/src/content/docs/project/changelog.md",
  "QUALITY_SCORE.md",
  ".github/skills/docs-writer/references/freshness-checklist.md",
  ".github/skills/copilot-customization/references/custom-agents.md",
  "tools/scripts/validate-deprecated-models.mjs",
]);

function loadDeprecatedModels() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const models = catalog.models ?? {};
  return Object.entries(models)
    .filter(([, v]) => v?.deprecated === true)
    .map(([name]) => name);
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function collectFiles() {
  const files = [];
  for (const g of SCAN_GLOBS) {
    files.push(...walk(path.join(ROOT, g)));
  }
  files.push(path.join(ROOT, REGISTRY_PATH));
  return files.filter((f) => {
    const rel = path.relative(ROOT, f);
    if (ALLOWED_FILES.has(rel)) return false;
    return f.endsWith(".md") || f.endsWith(".json");
  });
}

function scanFile(file, deprecated) {
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

function main() {
  r.header();
  const deprecated = loadDeprecatedModels();
  if (deprecated.length === 0) {
    console.log("  ℹ️  No deprecated models in catalog. Nothing to enforce.");
    r.summary();
    return;
  }
  console.log(`  Deprecated labels (from catalog): ${deprecated.join(", ")}`);

  const files = collectFiles();
  for (const f of files) {
    r.tick();
    const hits = scanFile(f, deprecated);
    const rel = path.relative(ROOT, f);
    for (const h of hits) {
      r.errorAnnotation(
        rel,
        `Line ${h.line}: deprecated model label "${h.label}" — remove or migrate. Context: ${h.content.slice(0, 120)}`,
      );
    }
  }
  r.summary();
  r.exitOnError("No deprecated model labels found.", "Deprecated model labels detected — see annotations above.");
}

main();
