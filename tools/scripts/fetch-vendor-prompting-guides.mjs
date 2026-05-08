#!/usr/bin/env node
/**
 * Vendor Prompting Source Fetcher + Drift Detector
 *
 * Fetches the canonical Anthropic + OpenAI prompting source documents,
 * stores hashed snapshots under
 * `.github/skills/vendor-prompting/references/.snapshots/`, and compares
 * them against what `rules.json` expects.
 *
 * Fetch fallback chain (per F-15):
 *   1. `gh api` for openai/skills paths (uses GH_TOKEN)
 *   2. anonymous raw https://raw.githubusercontent.com/...
 *   3. cached committed normalized prose (audit still works, no drift)
 *
 * Exit codes:
 *   0 — no drift detected (or --fail-on-drift not set)
 *   1 — drift detected and --fail-on-drift was set
 *   2 — every source failed to fetch (always non-zero)
 *
 * @example
 *   node tools/scripts/fetch-vendor-prompting-guides.mjs
 *   node tools/scripts/fetch-vendor-prompting-guides.mjs --fail-on-drift
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import https from "node:https";

const SKILL_DIR = ".github/skills/vendor-prompting";
const RULES_PATH = path.join(SKILL_DIR, "rules.json");
const SNAPSHOT_DIR = path.join(SKILL_DIR, "references", ".snapshots");
const MANIFEST_PATH = path.join(SNAPSHOT_DIR, "manifest.json");
const FRESHNESS_MANIFEST = "tools/registry/source-freshness.json";

const OPENAI_SKILLS_REPO = "openai/skills";
const OPENAI_SKILLS_REF = "724cd511c96593f642bddf13187217aa155d2554";

const SOURCES = [
  {
    id: "anthropic-prompting-best-practices",
    vendor: "anthropic",
    url: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
    snapshotName: "anthropic-prompting-best-practices.md",
    fetch: fetchAnonymous,
  },
  {
    id: "openai-prompting-guide",
    vendor: "openai",
    repo: OPENAI_SKILLS_REPO,
    ref: OPENAI_SKILLS_REF,
    apiPath: "skills/.curated/openai-docs/references/prompting-guide.md",
    snapshotName: "openai-prompting-guide.md",
    fetch: fetchGithub,
  },
  {
    id: "openai-upgrade-guide",
    vendor: "openai",
    repo: OPENAI_SKILLS_REPO,
    ref: OPENAI_SKILLS_REF,
    apiPath: "skills/.curated/openai-docs/references/upgrade-guide.md",
    snapshotName: "openai-upgrade-guide.md",
    fetch: fetchGithub,
  },
];

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function fetchAnonymous(source) {
  return new Promise((resolve) => {
    https
      .get(source.url, { headers: { "User-Agent": "vendor-prompting-fetcher" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Naive single-hop redirect handler
          const loc = res.headers.location;
          if (loc) {
            return https.get(loc, (r2) => collect(r2, resolve));
          }
        }
        collect(res, resolve);
      })
      .on("error", (err) => resolve({ ok: false, error: err.message }));
  });
}

function collect(res, resolve) {
  let data = "";
  res.setEncoding("utf-8");
  res.on("data", (c) => (data += c));
  res.on("end", () => {
    if (res.statusCode === 200) resolve({ ok: true, body: data, method: "raw" });
    else resolve({ ok: false, error: `HTTP ${res.statusCode}` });
  });
  res.on("error", (err) => resolve({ ok: false, error: err.message }));
}

async function fetchGithub(source) {
  // Prefer gh api for auth + pinned SHA reproducibility.
  try {
    const out = execFileSync(
      "gh",
      [
        "api",
        `repos/${source.repo}/contents/${source.apiPath}?ref=${source.ref}`,
        "-H",
        "Accept: application/vnd.github.raw",
      ],
      { encoding: "utf-8" },
    );
    return { ok: true, body: out, method: "gh-api" };
  } catch (_e) {
    // Fall back to anonymous raw
    const url = `https://raw.githubusercontent.com/${source.repo}/${source.ref}/${source.apiPath}`;
    const result = await fetchAnonymous({ url });
    if (result.ok) result.method = "raw";
    return result;
  }
}

function loadCachedSnapshot(name) {
  const p = path.join(SNAPSHOT_DIR, name);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf-8");
}

async function main() {
  const args = process.argv.slice(2);
  const failOnDrift = args.includes("--fail-on-drift");

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  if (!fs.existsSync(RULES_PATH)) {
    console.error(`Cannot find ${RULES_PATH}. Run from repo root.`);
    process.exit(2);
  }
  const registry = JSON.parse(fs.readFileSync(RULES_PATH, "utf-8"));
  const expectedHashes = Object.fromEntries(registry.sources.map((s) => [s.id, s.sha256]));

  const manifest = [];
  const drift = [];
  let allFailed = true;

  for (const source of SOURCES) {
    process.stdout.write(`→ ${source.id} ... `);
    let result = await source.fetch(source);

    if (!result.ok) {
      const cached = loadCachedSnapshot(source.snapshotName);
      if (cached) {
        result = { ok: true, body: cached, method: "cached" };
        console.log(`\u26a0\ufe0f  fallback to cached (${source.id})`);
      } else {
        console.log(`\u274c failed (${result.error})`);
        manifest.push({
          source_id: source.id,
          fetch_method: "failed",
          error: result.error,
          fetched_at: new Date().toISOString(),
        });
        continue;
      }
    } else {
      console.log(`\u2705 (${result.method})`);
    }

    allFailed = false;
    const sha = sha256(result.body);
    const snapshotPath = path.join(SNAPSHOT_DIR, source.snapshotName);
    fs.writeFileSync(snapshotPath, result.body, "utf-8");

    const entry = {
      source_id: source.id,
      url: source.url || `https://github.com/${source.repo}/blob/${source.ref}/${source.apiPath}`,
      ref: source.ref || null,
      sha256: sha,
      fetched_at: new Date().toISOString(),
      bytes: Buffer.byteLength(result.body, "utf-8"),
      fetch_method: result.method,
    };
    manifest.push(entry);

    const expected = expectedHashes[source.id];
    const placeholder = expected && /^0+$/.test(expected);
    if (expected && !placeholder && expected !== sha) {
      drift.push({ source_id: source.id, expected, actual: sha });
    }
  }

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  // Update source-freshness manifest
  fs.mkdirSync(path.dirname(FRESHNESS_MANIFEST), { recursive: true });
  let freshness = { sources: [] };
  if (fs.existsSync(FRESHNESS_MANIFEST)) {
    try {
      freshness = JSON.parse(fs.readFileSync(FRESHNESS_MANIFEST, "utf-8"));
      if (!freshness.sources) freshness.sources = [];
    } catch {
      // start fresh
    }
  }
  for (const entry of manifest) {
    if (entry.fetch_method === "failed") continue;
    const existing = freshness.sources.findIndex((s) => s.source_id === entry.source_id);
    const fresh = {
      source_id: entry.source_id,
      owner: "vendor-prompting",
      max_age_days: 90,
      last_fetched: entry.fetched_at,
      sha256: entry.sha256,
      url: entry.url,
    };
    if (existing >= 0) freshness.sources[existing] = fresh;
    else freshness.sources.push(fresh);
  }
  fs.writeFileSync(FRESHNESS_MANIFEST, `${JSON.stringify(freshness, null, 2)}\n`, "utf-8");

  console.log(`\nSnapshots: ${SNAPSHOT_DIR}`);
  console.log(`Manifest:  ${MANIFEST_PATH}`);
  console.log(`Freshness: ${FRESHNESS_MANIFEST}`);

  if (allFailed) {
    console.error("\n\u274c All sources failed to fetch (no cached fallback).");
    process.exit(2);
  }

  if (drift.length === 0) {
    console.log("\n\u2705 No drift detected.");
    process.exit(0);
  }

  console.log("\n\u26a0\ufe0f  Drift detected:");
  for (const d of drift) {
    console.log(`  ${d.source_id}`);
    console.log(`    expected: ${d.expected}`);
    console.log(`    actual:   ${d.actual}`);
  }
  console.log(`\nReview rules.json sources[] sha256 values.`);
  if (failOnDrift) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(`Fatal: ${e.message}`);
  process.exit(2);
});
