#!/usr/bin/env node
/**
 * No Hard-Coded Counts Validator
 *
 * Two responsibilities:
 * 1. Manifest validation: compute actual counts from filesystem globs and compare
 *    against .github/count-manifest.json definitions.
 * 2. Grep scan: detect hard-coded entity counts in prose files and flag violations
 *    (with an allowlist for historical entries and the manifest itself).
 *
 * @example
 * node scripts/validate-no-hardcoded-counts.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { globSync } from "node:fs";
import { Reporter } from "./_lib/reporter.mjs";
import {
  AGENTS_DIR,
  SUBAGENTS_DIR,
  SKILLS_DIR,
  INSTRUCTIONS_DIR,
} from "./_lib/paths.mjs";
import { parseJsonc } from "./_lib/parse-jsonc.mjs";

const ROOT = process.cwd();
const r = new Reporter("No Hard-Coded Counts Validator");

// ─── Part 1: Manifest validation ────────────────────────────────────────────

const MANIFEST_PATH = path.join(ROOT, ".github", "count-manifest.json");

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    r.error(".github/count-manifest.json", "File not found");
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  } catch (e) {
    r.error(".github/count-manifest.json", `Invalid JSON: ${e.message}`);
    return null;
  }
}

function countFiles(globPattern) {
  try {
    return globSync(globPattern, { cwd: ROOT }).length;
  } catch {
    return -1;
  }
}

function computeActualCounts() {
  const pkgPath = path.join(ROOT, "package.json");
  let validatorCount = 0;
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const nodeScripts = pkg.scripts?.["validate:_node"] || "";
    const extScripts = pkg.scripts?.["validate:_external"] || "";
    const all = [
      ...nodeScripts.split(/\s+/),
      ...extScripts.split(/\s+/),
    ].filter((s) => s.startsWith("lint:") || s.startsWith("validate:"));
    validatorCount = all.length;
  }

  let extensionCount = 0;
  const dcPath = path.join(ROOT, ".devcontainer", "devcontainer.json");
  if (fs.existsSync(dcPath)) {
    try {
      const dcContent = parseJsonc(fs.readFileSync(dcPath, "utf-8"));
      extensionCount =
        dcContent?.customizations?.vscode?.extensions?.length || 0;
    } catch {
      extensionCount = -1;
    }
  }

  return {
    primary_agents: countFiles(path.join(AGENTS_DIR, "*.agent.md")),
    subagents: countFiles(path.join(SUBAGENTS_DIR, "*.agent.md")),
    skills: countFiles(path.join(SKILLS_DIR, "*/SKILL.md")),
    instructions: countFiles(path.join(INSTRUCTIONS_DIR, "*.instructions.md")),
    validators: validatorCount,
    vscode_extensions: extensionCount,
  };
}

function validateManifest(manifest) {
  if (!manifest?.counts) {
    r.error(".github/count-manifest.json", "Missing 'counts' object");
    return;
  }

  const actuals = computeActualCounts();

  for (const [key, actual] of Object.entries(actuals)) {
    const entry = manifest.counts[key];
    if (!entry) {
      r.warn(`count-manifest.json`, `Missing count key: ${key}`);
      continue;
    }

    // Static value entries are checked directly
    if (entry.value !== undefined) {
      r.check(
        `${key}: manifest value (${entry.value}) matches actual (${actual})`,
        entry.value === actual,
      );
    } else {
      // Auto-computed entries: just report the actual for reference
      r.ok(`${key}: ${actual} (computed from ${entry.computed_from})`);
    }
    r.tick();
  }
}

// ─── Part 2: Grep scan for hard-coded counts ────────────────────────────────

// Patterns that look like hard-coded entity counts in prose
const COUNT_PATTERNS = [
  /(?<![\d.])(\d{1,3})\s+(primary\s+)?agents?\b/i,
  /(?<![\d.])(\d{1,3})\s+subagents?\b/i,
  /(?<![\d.])(\d{1,3})\s+(GA\s+)?skills?\b/i,
  /(?<![\d.])(\d{1,3})\s+instructions?\s*(files?)?\b/i,
  /(?<![\d.])(\d{1,3})\s+validators?\b/i,
  /(?<![\d.])(\d{1,3})\s+top-level\b/i,
  /(?<![\d.])(\d{1,3})\s+pre-installed\b/i,
  /(?<![\d.])(\d{1,2})-step\s+workflow\b/i,
  /(?<![\d.])(\d{1,2})\s+steps?\b/i,
];

// These numbers are too common in other contexts — only flag if entity keyword follows
const SAFE_NUMBERS = new Set(["0", "1", "2", "3", "4", "5"]);

// Files/patterns exempt from scanning
const ALLOWLIST_PATHS = [
  /count-manifest\.json$/,
  /CHANGELOG\.md$/,
  /QUALITY_SCORE\.md$/, // Health dashboard — counts are its purpose
  /validate-no-hardcoded-counts\.mjs$/,
  /no-hardcoded-counts\.instructions\.md$/,
  /count-registry\/SKILL\.md$/,
  /count-registry\/SKILL\.(digest|minimal)\.md$/,
  /node_modules\//,
  /\.git\//,
  /site\//,
  /\.venv/,
  /backup\//,
  /\.tar\.gz$/,
  /\.png$/,
  /\.diff$/,
  /\.prompt\.md$/, // Prompt files contain historical execution plans with point-in-time counts
  /e2e-test-plan/, // E2E test plans contain point-in-time counts
];

// Lines containing these phrases are exempt (historical context, version refs)
const ALLOWLIST_LINE_PATTERNS = [
  /validator count \d+\s*→\s*\d+/i, // QUALITY_SCORE change log
  /count corrected/i,
  /count \d+\s*→/i,
  /→\s*\d+/, // arrow transitions in changelogs
  /agent count/i,
  /skill count/i,
  /^\s*\|.*\d{4}-\d{2}-\d{2}/, // date-prefixed table rows (historical)
  /VS Code 1\.\d+/i, // VS Code version numbers (e.g., "1.109 Skills")
  /v\d+\.\d+/i, // version references (e.g., "v2.0")
  /10 agent-first/i, // Golden principles title (genuinely static)
  /10-minute/i, // "10-minute getting started" in docs
];

const SCAN_DIRS = [".github", "docs", "scripts", "mcp", ".devcontainer"];
const SCAN_ROOT_FILES = [
  "AGENTS.md",
  "README.md",
  "QUALITY_SCORE.md",
  "CONTRIBUTING.md",
];

const TEXT_EXTS = new Set([
  ".md",
  ".json",
  ".jsonc",
  ".mjs",
  ".js",
  ".ts",
  ".yml",
  ".yaml",
  ".sh",
  ".ps1",
  ".py",
  ".txt",
]);

function shouldSkipPath(filePath) {
  return ALLOWLIST_PATHS.some((p) => p.test(filePath));
}

function isHistoricalLine(line) {
  return ALLOWLIST_LINE_PATTERNS.some((p) => p.test(line));
}

function scanFileForCounts(filePath) {
  if (shouldSkipPath(filePath)) return;
  if (!fs.existsSync(filePath)) return;

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return;

  const ext = path.extname(filePath);
  if (!TEXT_EXTS.has(ext)) return;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const relPath = path.relative(ROOT, filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isHistoricalLine(line)) continue;

    for (const pattern of COUNT_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const num = match[1];
        // Skip small numbers that are likely not entity counts
        if (SAFE_NUMBERS.has(num)) continue;
        // Skip code fences and YAML frontmatter values
        if (/^\s*(```|---|#|\/\/|\/\*|\*)/.test(line)) continue;
        // Skip `step N` references in numbered workflows (like "Step 1", "Step 2")
        if (/step\s+[1-9]\b/i.test(line) && parseInt(num) <= 9) continue;

        r.warn(
          `${relPath}:${i + 1}`,
          `Possible hard-coded count: "${match[0]}" — use descriptive language or reference count-manifest.json`,
        );
      }
    }
  }
  r.tick();
}

function scanDir(dir) {
  const absDir = path.resolve(ROOT, dir);
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(absDir, entry.name);
    if (shouldSkipPath(fullPath)) continue;
    if (entry.isDirectory()) {
      scanDir(path.relative(ROOT, fullPath));
    } else {
      scanFileForCounts(fullPath);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

r.header();

console.log("Part 1: Manifest validation\n");
const manifest = loadManifest();
if (manifest) {
  validateManifest(manifest);
}

console.log("\nPart 2: Hard-coded count scan\n");
for (const dir of SCAN_DIRS) {
  scanDir(dir);
}
for (const file of SCAN_ROOT_FILES) {
  scanFileForCounts(path.resolve(ROOT, file));
}

r.summary();
r.exitOnError(
  "No hard-coded counts — count-manifest.json is source of truth",
  "Hard-coded counts detected — see warnings above",
);
