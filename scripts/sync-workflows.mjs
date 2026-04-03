#!/usr/bin/env node
/**
 * Fetches GitHub Actions workflow files from the upstream repository.
 *
 * The weekly-upstream-sync workflow excludes .github/workflows/ because
 * GITHUB_TOKEN cannot push workflow file changes. This script provides
 * a local alternative: it downloads workflow files from upstream and
 * places them in .github/workflows/, skipping the sync workflow itself
 * (which is accelerator-specific).
 *
 * @example
 * npm run sync:workflows
 * npm run sync:workflows -- --dry-run
 */

import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const UPSTREAM_OWNER = "jonathan-vella";
const UPSTREAM_REPO = "azure-agentic-infraops";
const UPSTREAM_REF = "main";
const WORKFLOWS_DIR = ".github/workflows";

// Workflows that are accelerator-specific and should NOT be overwritten
const SKIP_FILES = new Set(["weekly-upstream-sync.yml"]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("--dry");
const showHelp = args.includes("--help") || args.includes("-h");

if (showHelp) {
  console.log(`
Usage: npm run sync:workflows [-- --dry-run]

Fetches GitHub Actions workflow files from the upstream repository
(${UPSTREAM_OWNER}/${UPSTREAM_REPO}) into ${WORKFLOWS_DIR}/.

Options:
  --dry-run   Show what would be fetched without writing files
  --help      Show this help message

Skipped files (accelerator-specific):
  ${[...SKIP_FILES].join(", ")}
`);
  process.exit(0);
}

console.log(
  `\n🔄 Sync Workflows from ${UPSTREAM_OWNER}/${UPSTREAM_REPO}@${UPSTREAM_REF}\n`,
);

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function main() {
  // List workflow files from upstream via GitHub API (no auth required for public repos)
  const apiUrl = `https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/contents/${WORKFLOWS_DIR}?ref=${UPSTREAM_REF}`;
  let files;
  try {
    files = await fetchJSON(apiUrl);
  } catch (err) {
    console.error(`❌ Could not list upstream workflows: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(files)) {
    console.error(
      "❌ Unexpected API response (not an array). Check the upstream repo path.",
    );
    process.exit(1);
  }

  const ymlFiles = files.filter(
    (f) =>
      f.type === "file" &&
      (f.name.endsWith(".yml") || f.name.endsWith(".yaml")),
  );

  if (ymlFiles.length === 0) {
    console.log("No workflow files found in upstream.");
    process.exit(0);
  }

  // Ensure local workflows directory exists
  if (!dryRun) {
    mkdirSync(WORKFLOWS_DIR, { recursive: true });
  }

  let synced = 0;
  let skipped = 0;

  for (const file of ymlFiles) {
    if (SKIP_FILES.has(file.name)) {
      console.log(`  ⏭️  ${file.name} (skipped — accelerator-specific)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  📋 ${file.name} (would fetch)`);
      synced++;
      continue;
    }

    try {
      const content = await fetchText(file.download_url);
      const dest = join(WORKFLOWS_DIR, file.name);
      writeFileSync(dest, content, "utf8");
      console.log(`  ✅ ${file.name}`);
      synced++;
    } catch (err) {
      console.error(`  ❌ ${file.name}: ${err.message}`);
    }
  }

  console.log(
    `\n${dryRun ? "Dry run: " : ""}${synced} synced, ${skipped} skipped\n`,
  );
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
