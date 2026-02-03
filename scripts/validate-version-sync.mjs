/**
 * Version Synchronization Validator
 *
 * Ensures VERSION.md is the single source of truth and all other files match.
 * Checks: package.json, README.md, docs/README.md, CHANGELOG.md
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Files to check for version references
const VERSION_FILE = "VERSION.md";
const FILES_TO_CHECK = [
  { path: "package.json", pattern: /"version":\s*"(\d+\.\d+\.\d+)"/ },
  { path: "README.md", pattern: /Version:\s*(\d+\.\d+\.\d+)/i },
  { path: "README.md", pattern: /badge\/version-v?(\d+\.\d+\.\d+)/i },
  { path: "docs/README.md", pattern: /Version:\s*(\d+\.\d+\.\d+)/i },
  { path: "CHANGELOG.md", pattern: /##\s*\[?v?(\d+\.\d+\.\d+)\]?/i },
];

let hasError = false;
let hasWarning = false;

function readFile(relPath) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) return null;
  return fs.readFileSync(absPath, "utf8");
}

function extractVersion(content) {
  // VERSION.md format: ## Current Version: X.Y.Z or just X.Y.Z on first non-empty line
  const match = content.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

function log(level, message) {
  const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : "✅";
  console.log(`${prefix} ${message}`);
  if (level === "error") hasError = true;
  if (level === "warn") hasWarning = true;
}

function main() {
  console.log("🔍 Version Synchronization Validator\n");

  // Read source of truth
  const versionContent = readFile(VERSION_FILE);
  if (!versionContent) {
    log("error", `${VERSION_FILE} not found`);
    process.exit(1);
  }

  const sourceVersion = extractVersion(versionContent);
  if (!sourceVersion) {
    log("error", `Could not extract version from ${VERSION_FILE}`);
    process.exit(1);
  }

  console.log(`📌 Source of truth: ${VERSION_FILE} = v${sourceVersion}\n`);

  // Check each file
  const checked = new Set();
  for (const { path: filePath, pattern } of FILES_TO_CHECK) {
    const content = readFile(filePath);
    if (!content) {
      if (!checked.has(filePath)) {
        log("warn", `${filePath} not found (optional)`);
        checked.add(filePath);
      }
      continue;
    }

    const match = content.match(pattern);
    if (match) {
      const foundVersion = match[1];
      if (foundVersion === sourceVersion) {
        log("ok", `${filePath}: v${foundVersion}`);
      } else {
        log(
          "error",
          `${filePath}: v${foundVersion} (expected v${sourceVersion})`,
        );
      }
    }
    checked.add(filePath);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (hasError) {
    console.log("❌ Version sync FAILED - versions out of sync");
    console.log(`\n💡 To fix: Update all files to match ${VERSION_FILE}`);
    process.exit(1);
  } else if (hasWarning) {
    console.log("⚠️  Version sync passed with warnings");
    process.exit(0);
  } else {
    console.log("✅ All versions in sync");
    process.exit(0);
  }
}

main();
