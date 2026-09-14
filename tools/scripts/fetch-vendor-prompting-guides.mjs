#!/usr/bin/env node
/**
 * Vendor Prompting Source Fetcher + Drift Detector
 *
 * Fetches the canonical Anthropic + OpenAI prompting source documents,
 * stores hashed snapshots under
 * `.github/skills/apex-vendor-prompting/references/.snapshots/`, and compares
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
import { fileURLToPath } from "node:url";

const SKILL_DIR = ".github/skills/apex-vendor-prompting";
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
    id: "anthropic-prompting-claude-sonnet-5",
    vendor: "anthropic",
    url: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5",
    snapshotName: "anthropic-prompting-claude-sonnet-5.md",
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

function loadCachedSnapshot(name, snapshotDir) {
  const p = path.join(snapshotDir, name);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf-8");
}

export async function runFetcher({
  rootDir = ".",
  sources = SOURCES,
  now = () => new Date().toISOString(),
  args = [],
} = {}) {
  const failOnDrift = args.includes("--fail-on-drift");
  const snapshotDir = path.resolve(rootDir, SNAPSHOT_DIR);
  const rulesPath = path.resolve(rootDir, RULES_PATH);
  const manifestPath = path.resolve(rootDir, MANIFEST_PATH);
  const freshnessPath = path.resolve(rootDir, FRESHNESS_MANIFEST);

  fs.mkdirSync(snapshotDir, { recursive: true });

  if (!fs.existsSync(rulesPath)) {
    console.error(`Cannot find ${RULES_PATH}. Run from repo root.`);
    return 2;
  }
  const registry = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf-8")) : [];
  const freshness = fs.existsSync(freshnessPath)
    ? JSON.parse(fs.readFileSync(freshnessPath, "utf-8"))
    : { sources: [] };
  const expectedHashes = Object.fromEntries(registry.sources.map((s) => [s.id, s.sha256]));

  const manifest = [];
  const drift = [];
  let allFailed = true;

  for (const source of sources) {
    const attemptedAt = now();
    process.stdout.write(`→ ${source.id} ... `);
    let result = await source.fetch(source);
    const fetchError = result.ok ? null : result.error;

    if (!result.ok) {
      const cached = loadCachedSnapshot(source.snapshotName, snapshotDir);
      if (cached) {
        result = { ok: true, body: cached, method: "cached" };
        console.log(`\u26a0\ufe0f  fallback to cached (${source.id})`);
      } else {
        console.log(`\u274c failed (${result.error})`);
        manifest.push({
          ...previous.find((entry) => entry.source_id === source.id),
          source_id: source.id,
          fetch_method: "failed",
          error: result.error,
          attempted_at: attemptedAt,
        });
        continue;
      }
    } else {
      console.log(`\u2705 (${result.method})`);
    }

    allFailed = false;
    const sha = sha256(result.body);
    const snapshotPath = path.join(snapshotDir, source.snapshotName);
    if (result.method !== "cached") fs.writeFileSync(snapshotPath, result.body, "utf-8");
    const prior = previous.find((entry) => entry.source_id === source.id && entry.sha256 === sha);
    const priorFreshness = freshness.sources.find((entry) => entry.source_id === source.id && entry.sha256 === sha);

    const entry = {
      source_id: source.id,
      url: source.url || `https://github.com/${source.repo}/blob/${source.ref}/${source.apiPath}`,
      ref: source.ref || null,
      sha256: sha,
      fetched_at: result.method === "cached" ? (prior?.fetched_at ?? priorFreshness?.last_fetched ?? null) : now(),
      attempted_at: attemptedAt,
      ...(fetchError ? { error: fetchError } : {}),
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

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  // Update source-freshness manifest
  fs.mkdirSync(path.dirname(freshnessPath), { recursive: true });
  for (const entry of manifest) {
    if (entry.fetch_method === "failed" || entry.fetch_method === "cached") continue;
    const existing = freshness.sources.findIndex((s) => s.source_id === entry.source_id);
    const fresh = {
      ...(existing >= 0 ? freshness.sources[existing] : {}),
      source_id: entry.source_id,
      owner: "apex-vendor-prompting",
      max_age_days: 90,
      last_fetched: entry.fetched_at,
      sha256: entry.sha256,
      url: entry.url,
    };
    if (existing >= 0) freshness.sources[existing] = fresh;
    else freshness.sources.push(fresh);
  }
  fs.writeFileSync(freshnessPath, `${JSON.stringify(freshness, null, 2)}\n`, "utf-8");

  console.log(`\nSnapshots: ${SNAPSHOT_DIR}`);
  console.log(`Manifest:  ${MANIFEST_PATH}`);
  console.log(`Freshness: ${FRESHNESS_MANIFEST}`);

  if (allFailed) {
    console.error("\n\u274c All sources failed to fetch (no cached fallback).");
    return 2;
  }

  if (drift.length === 0) {
    console.log("\n\u2705 No drift detected.");
    return 0;
  }

  console.log("\n\u26a0\ufe0f  Drift detected:");
  for (const d of drift) {
    console.log(`  ${d.source_id}`);
    console.log(`    expected: ${d.expected}`);
    console.log(`    actual:   ${d.actual}`);
  }
  console.log(`\nReview rules.json sources[] sha256 values.`);
  return failOnDrift ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFetcher({ args: process.argv.slice(2) })
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`Fatal: ${error.message}`);
      process.exit(2);
    });
}
