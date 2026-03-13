/**
 * Version Synchronization Validator
 *
 * Ensures VERSION.md is the single source of truth and all other files match.
 * Checks: package.json, CHANGELOG.md
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = process.cwd();
const VERSION_FILE = "VERSION.md";
const FILES_TO_CHECK = [
  { path: "package.json", pattern: /"version":\s*"(\d+\.\d+\.\d+)"/ },
  { path: "CHANGELOG.md", pattern: /##\s*\[?v?(\d+\.\d+\.\d+)\]?/i },
];

const r = new Reporter("Version Sync Validator");
r.header();

function readFile(relPath) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) return null;
  return fs.readFileSync(absPath, "utf8");
}

const versionContent = readFile(VERSION_FILE);
if (!versionContent) {
  r.error(`${VERSION_FILE} not found`);
  r.summary();
  r.exitOnError();
}

const sourceVersion = versionContent.match(/(\d+\.\d+\.\d+)/)?.[1];
if (!sourceVersion) {
  r.error(`Could not extract version from ${VERSION_FILE}`);
  r.summary();
  r.exitOnError();
}

console.log(`📌 Source of truth: ${VERSION_FILE} = v${sourceVersion}\n`);

for (const { path: filePath, pattern } of FILES_TO_CHECK) {
  r.tick();
  const content = readFile(filePath);
  if (!content) {
    r.warn(`${filePath} not found (optional)`);
    continue;
  }

  const match = content.match(pattern);
  if (match) {
    const foundVersion = match[1];
    if (foundVersion === sourceVersion) {
      r.ok(`${filePath}: v${foundVersion}`);
    } else {
      r.error(`${filePath}: v${foundVersion} (expected v${sourceVersion})`);
    }
  }
}

r.summary();
r.exitOnError("All versions in sync", "Version sync FAILED");
