#!/usr/bin/env node
/**
 * Stale Skill Reference Validator
 *
 * Greps the project for references to retired skill names.
 * Retired names are skills that were renamed as part of plugin adoption.
 * Any match is an error — all references must use the new canonical name.
 *
 * @example
 * node scripts/validate-no-stale-skill-references.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const r = new Reporter("Stale Skill Reference Validator");

const RETIRED_SKILLS = [
  {
    old: "azure-troubleshooting",
    new: "azure-diagnostics",
    since: "Issue #240 — Azure Skills Plugin integration",
  },
];

const SCAN_DIRS = [".github", "docs", "scripts"];
const SCAN_ROOT_FILES = ["AGENTS.md", "CHANGELOG.md", "README.md"];

const SKIP_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /site\//,
  /\.venv/,
  /PLUGIN_VERSION\.md/,
  /validate-no-stale-skill-references\.mjs/,
  /migration\//,
];

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some((p) => p.test(filePath));
}

function scanFile(filePath) {
  if (shouldSkip(filePath)) return;
  if (!fs.existsSync(filePath)) return;

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return;

  const ext = path.extname(filePath);
  const textExts = [
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
  ];
  if (!textExts.includes(ext)) return;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (const retired of RETIRED_SKILLS) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(retired.old)) {
        r.error(
          `${filePath}:${i + 1}`,
          `Stale reference to "${retired.old}" — rename to "${retired.new}" (${retired.since})`,
        );
      }
    }
  }
  r.tick();
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldSkip(fullPath)) continue;
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else {
      scanFile(fullPath);
    }
  }
}

r.header();

for (const dir of SCAN_DIRS) {
  scanDir(dir);
}

for (const file of SCAN_ROOT_FILES) {
  scanFile(file);
}

r.summary();
r.exitOnError();
