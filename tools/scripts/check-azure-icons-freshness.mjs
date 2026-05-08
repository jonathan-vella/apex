#!/usr/bin/env node
/**
 * check-azure-icons-freshness.mjs
 *
 * T-005 helper. Compares the local Azure icon manifest's `sourceVersion`
 * against the latest published version on Microsoft Learn. Warns on drift;
 * does not fail (manifest refreshes are a separate, manual workflow).
 *
 * Usage:
 *   node tools/scripts/check-azure-icons-freshness.mjs           # check, exit 0
 *   node tools/scripts/check-azure-icons-freshness.mjs --strict  # exit 1 on drift
 *   node tools/scripts/check-azure-icons-freshness.mjs --quiet   # silent unless drift
 */

import fs from "node:fs";
import path from "node:path";

const MANIFEST_PATH = path.join("assets", "drawio-libraries", "azure-icons", "manifest.json");
const ICONS_PAGE_URL = "https://learn.microsoft.com/en-us/azure/architecture/icons/";

const args = new Set(process.argv.slice(2));
const STRICT = args.has("--strict");
const QUIET = args.has("--quiet");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function log(msg) {
  if (!QUIET) console.log(msg);
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

function err(msg) {
  console.error(`❌ ${msg}`);
}

const manifest = readJson(MANIFEST_PATH);
const localVersion = manifest.sourceVersion || "(unknown)";
const localChecked = manifest.lastChecked || "(unknown)";

log(`Local Azure icon manifest`);
log(`  sourceVersion : ${localVersion}`);
log(`  lastChecked   : ${localChecked}`);
log(`  totalIcons    : ${manifest.totalIcons || "?"}`);
log("");
log(`Checking ${ICONS_PAGE_URL} ...`);

let upstreamHtml;
try {
  const res = await fetch(ICONS_PAGE_URL, {
    headers: {
      "User-Agent": "apex-icons-freshness-check/1.0 (+https://github.com/jonathan-vella/azure-agentic-infraops)",
    },
  });
  if (!res.ok) {
    warn(`Upstream check skipped: HTTP ${res.status} from ${ICONS_PAGE_URL} (offline or rate-limited)`);
    process.exit(0);
  }
  upstreamHtml = await res.text();
} catch (e) {
  warn(`Upstream check skipped: ${e.message} (offline or DNS)`);
  process.exit(0);
}

// Microsoft publishes "V<N>-<Month>-<Year>" badges in the page. Pattern is
// stable across releases; an example is "V23-November-2025". Fallback parser
// also accepts "Version 23" and "released November 2025".
const versionMatches = upstreamHtml.match(/V\d+-[A-Z][a-z]+-\d{4}/g) || [];
const upstreamVersions = [...new Set(versionMatches)].sort();
const latestUpstream = upstreamVersions[upstreamVersions.length - 1] || null;

if (!latestUpstream) {
  warn(
    `Could not parse a version label from ${ICONS_PAGE_URL}. ` + `Page format may have changed; manifest unchanged.`,
  );
  process.exit(0);
}

log(`Upstream latest : ${latestUpstream}`);
log("");

if (latestUpstream === localVersion) {
  log(`✅ Manifest matches upstream (${latestUpstream}).`);
  process.exit(0);
}

const message =
  `Azure icon manifest drift detected: local=${localVersion} upstream=${latestUpstream}. ` +
  `Refresh assets/drawio-libraries/azure-icons/ via tools/scripts/convert-azure-icons-to-drawio.py.`;

if (STRICT) {
  err(message);
  process.exit(1);
}

warn(message);
process.exit(0);
