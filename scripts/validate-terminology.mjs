#!/usr/bin/env node
/**
 * Terminology Validator
 *
 * Scans workspace files for deprecated product names, agent names, and
 * stale references defined in `.github/terminology-blocklist.json`.
 * Designed to prevent renamed terms from creeping back in after major
 * rebranding efforts.
 *
 * Features:
 * - Configurable blocklist with per-rule severity (error/warning)
 * - File-level exclusions (changelogs, baselines, lock files)
 * - Line-level exclusions (repo URLs, label names, vocab config)
 * - Regex and literal pattern matching
 * - GitHub Actions annotation output
 *
 * @example
 *   node scripts/validate-terminology.mjs
 *   node scripts/validate-terminology.mjs --verbose
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = process.cwd();
const VERBOSE = process.argv.includes("--verbose");
const BLOCKLIST_PATH = path.join(ROOT, ".github", "terminology-blocklist.json");

const r = new Reporter("Terminology Validator");

// ─── Load config ────────────────────────────────────────────────────────────

function loadBlocklist() {
  if (!fs.existsSync(BLOCKLIST_PATH)) {
    r.error(".github/terminology-blocklist.json", "Blocklist config not found");
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(BLOCKLIST_PATH, "utf-8"));
  } catch (e) {
    r.error(".github/terminology-blocklist.json", `Invalid JSON: ${e.message}`);
    return null;
  }
}

// ─── File discovery ─────────────────────────────────────────────────────────

function collectFiles(extensions, excludePatterns) {
  const results = [];
  const excludeNormalized = excludePatterns.map((p) => p.replace(/\\/g, "/"));

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(ROOT, fullPath).replace(/\\/g, "/");

      // Skip excluded directories/files
      if (
        excludeNormalized.some((ex) => relPath === ex || relPath.startsWith(ex))
      ) {
        continue;
      }
      // Skip common dirs
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "dist" ||
        entry.name === ".venv" ||
        entry.name === "venv"
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          results.push({ fullPath, relPath });
        }
      }
    }
  }

  walk(ROOT);
  return results;
}

// ─── Scan logic ─────────────────────────────────────────────────────────────

function scanFile(filePath, relPath, rules, excludeLinePatterns) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const lines = content.split("\n");
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip lines matching any exclude-line pattern
    if (excludeLinePatterns.some((pat) => line.includes(pat))) {
      continue;
    }

    for (const rule of rules) {
      const regex = rule.isRegex ? new RegExp(rule.pattern, "gi") : null;

      const found = regex ? regex.test(line) : line.includes(rule.pattern);

      if (found) {
        violations.push({
          file: relPath,
          line: i + 1,
          rule: rule.id,
          severity: rule.severity || "error",
          pattern: rule.pattern,
          replacement: rule.replacement,
          reason: rule.reason,
          context: line.trim().substring(0, 120),
        });
      }
    }
  }

  return violations;
}

// ─── Main ───────────────────────────────────────────────────────────────────

r.header();

const config = loadBlocklist();
if (!config) {
  r.summary();
  r.exitOnError();
}

const files = collectFiles(
  config.fileExtensions || [".md"],
  config.excludePatterns || [],
);

if (VERBOSE) {
  console.log(
    `  Scanning ${files.length} files against ${config.rules.length} rules...\n`,
  );
}

const allViolations = [];

for (const { fullPath, relPath } of files) {
  r.tick();
  const violations = scanFile(
    fullPath,
    relPath,
    config.rules,
    config.excludeLinePatterns || [],
  );
  allViolations.push(...violations);
}

// ─── Report ─────────────────────────────────────────────────────────────────

if (allViolations.length === 0) {
  console.log(
    `  ✅ No deprecated terminology found (${files.length} files, ${config.rules.length} rules)\n`,
  );
} else {
  // Group by file for readability
  const byFile = new Map();
  for (const v of allViolations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file).push(v);
  }

  for (const [file, violations] of byFile) {
    console.log(`\n  📄 ${file}`);
    for (const v of violations) {
      const icon = v.severity === "error" ? "❌" : "⚠️";
      const msg = `L${v.line}: "${v.pattern}" → "${v.replacement}" (${v.reason})`;
      if (v.severity === "error") {
        r.error(file, msg);
      } else {
        r.warn(file, msg);
      }
      if (VERBOSE) {
        console.log(`      ${v.context}`);
      }
    }
  }
  console.log();
}

r.summary();
r.exitOnError();
