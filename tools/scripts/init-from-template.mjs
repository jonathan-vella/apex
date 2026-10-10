#!/usr/bin/env node
/**
 * Replaces accelerator template repository references with this repository's URL,
 * leaving template-exclusion guards untouched, then formats the touched files.
 * Run once after creating a new repository from the accelerator template.
 * Auto-detects the new owner/repo from the git remote.
 *
 * @example
 * npm run init
 * npm run init -- --dry-run
 */

import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

const TEMPLATE_OWNER = "jonathan-vella";
const TEMPLATE_REPO = "apex-accelerator";
const TEMPLATE_SLUG = `${TEMPLATE_OWNER}/${TEMPLATE_REPO}`;
const TEMPLATE_URL = `https://github.com/${TEMPLATE_SLUG}`;

const SKIP_DIRS = new Set([".git", "node_modules", "site", ".venv", "__pycache__"]);
const SKIP_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".zip", ".gz"]);

// Template-exclusion guards (`github.repository != '<template>'`) must keep naming the template,
// otherwise every guarded job runs/skips against the wrong repository.
const GUARD_PATTERN = "github.repository !=";
const SKIP_FILES = new Set(["test_consumer_workflows.mjs"]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("--dry");
const noFormat = args.includes("--no-format");
const showHelp = args.includes("--help") || args.includes("-h");

if (showHelp) {
  console.log(`
Usage: npm run init [-- --dry-run]

Replaces all references to the accelerator template repository
  ${TEMPLATE_URL}
with this repository's URL, auto-detected from the git remote.

Run this once after creating a new repository from the accelerator template.

Options:
  --dry-run    Preview which files would be changed without modifying them
  --no-format  Skip the final 'npx prettier --write' on touched files
  --help, -h   Show this help message
`);
  process.exit(0);
}

/** Parse a GitHub HTTPS or SSH remote URL into an "owner/repo" slug. */
function parseSlug(remoteUrl) {
  const https = remoteUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+?)(\.git)?$/);
  if (https) return `${https[1]}/${https[2]}`;
  const ssh = remoteUrl.match(/^git@github\.com:([^/]+)\/([^/.]+?)(\.git)?$/);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;
  return null;
}

/** Replace the template slug on every line except template-exclusion guard lines. */
function replaceSlug(content, newSlug) {
  return content
    .split("\n")
    .map((line) => (line.includes(GUARD_PATTERN) ? line : line.replaceAll(TEMPLATE_SLUG, newSlug)))
    .join("\n");
}

/** True when at least one non-guard line references the template slug. */
function hasReplaceableLine(content) {
  return content.split("\n").some((line) => line.includes(TEMPLATE_SLUG) && !line.includes(GUARD_PATTERN));
}

/** Recursively collect files with replaceable template references (text files only). */
function findAffected(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) findAffected(fullPath, results);
    } else {
      const ext = entry.includes(".") ? `.${entry.split(".").pop()}` : "";
      if (SKIP_EXTS.has(ext.toLowerCase()) || SKIP_FILES.has(basename(fullPath))) continue;
      try {
        const content = readFileSync(fullPath, "utf8");
        if (hasReplaceableLine(content)) results.push({ fullPath, content });
      } catch {
        // Binary or unreadable — skip silently
      }
    }
  }
  return results;
}

// --- main ---

console.log("🔍 Detecting repository remote URL...");

let remoteUrl;
try {
  remoteUrl = execSync("git remote get-url origin", {
    encoding: "utf8",
  }).trim();
} catch {
  console.error("❌ Could not detect git remote 'origin'. Are you inside a git repository?");
  process.exit(1);
}

const newSlug = parseSlug(remoteUrl);
if (!newSlug) {
  console.error(`❌ Cannot parse a GitHub slug from remote URL: ${remoteUrl}`);
  console.error("   Expected: https://github.com/owner/repo  or  git@github.com:owner/repo");
  process.exit(1);
}

const newUrl = `https://github.com/${newSlug}`;

if (newSlug === TEMPLATE_SLUG) {
  console.log("ℹ️  Remote matches the template repository — nothing to replace.");
  process.exit(0);
}

console.log(`📋 Template: ${TEMPLATE_URL}`);
console.log(`🎯 Target:   ${newUrl}`);
console.log("");

const affected = findAffected(".");

if (affected.length === 0) {
  console.log("✅ No files contain template references. Repository already initialized.");
  process.exit(0);
}

console.log(`${affected.length} file(s) with template references:`);
for (const { fullPath } of affected) {
  console.log(`  📄 ${relative(".", fullPath)}`);
}
console.log("");

if (dryRun) {
  console.log("⚠️  Dry-run mode — no files modified.");
  process.exit(0);
}

let count = 0;
const touched = [];
for (const { fullPath, content } of affected) {
  writeFileSync(fullPath, replaceSlug(content, newSlug), "utf8");
  touched.push(relative(".", fullPath));
  console.log(`  ✅ Updated: ${relative(".", fullPath)}`);
  count++;
}

if (!noFormat) {
  console.log("");
  console.log("🎨 Formatting touched files with prettier...");
  const result = spawnSync("npx", ["prettier", "--write", "--ignore-unknown", "--log-level", "warn", ...touched], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0)
    console.warn("⚠️  prettier failed — run 'npx prettier --write' on the files above manually.");
}

console.log("");
console.log(`✅ Done — updated ${count} file(s).`);
console.log(`   ${TEMPLATE_URL}`);
console.log(`   → ${newUrl}`);
console.log("");
console.log("💡 Next steps:");
console.log("   1. Review changes:  git diff");
console.log("   2. Commit:          git add -A && git commit -m 'chore: initialize from template'");
