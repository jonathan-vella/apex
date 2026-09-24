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
 *   1. anonymous HTTPS fetch of the vendor's Markdown page (`.md` suffix)
 *   2. cached committed snapshot (audit still works, no drift)
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
import https from "node:https";
import { fileURLToPath } from "node:url";

const SKILL_DIR = ".github/skills/apex-vendor-prompting";
const RULES_PATH = path.join(SKILL_DIR, "rules.json");
const SNAPSHOT_DIR = path.join(SKILL_DIR, "references", ".snapshots");
const MANIFEST_PATH = path.join(SNAPSHOT_DIR, "manifest.json");
const FRESHNESS_MANIFEST = "tools/registry/source-freshness.json";

// Vendor docs serve Markdown when `.md` is appended; model-pinned OpenAI paths avoid
// `latest-model.md` silently switching to the next model generation.
const SOURCES = [
  {
    id: "anthropic-prompting-best-practices",
    vendor: "anthropic",
    url: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices.md",
    snapshotName: "anthropic-prompting-best-practices.md",
    fetch: fetchAnonymous,
  },
  {
    id: "anthropic-prompting-claude-opus-5-5",
    vendor: "anthropic",
    url: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5.md",
    snapshotName: "anthropic-prompting-claude-opus-5-5.md",
    fetch: fetchAnonymous,
  },
  {
    // Opus 5.5 guide defers to this one as its baseline.
    id: "anthropic-prompting-claude-opus-5",
    vendor: "anthropic",
    url: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5.md",
    snapshotName: "anthropic-prompting-claude-opus-5.md",
    fetch: fetchAnonymous,
  },
  {
    id: "openai-gpt-6-model-guide",
    vendor: "openai",
    url: "https://developers.openai.com/api/docs/guides/latest-model/gpt-6-astra.md",
    snapshotName: "openai-gpt-6-model-guide.md",
    fetch: fetchAnonymous,
  },
  {
    id: "openai-gpt-5-6-model-guide",
    vendor: "openai",
    url: "https://developers.openai.com/api/docs/guides/latest-model/gpt-5.6.md",
    snapshotName: "openai-gpt-5-6-model-guide.md",
    fetch: fetchAnonymous,
  },
  {
    id: "openai-gpt-5-6-prompt-guidance",
    vendor: "openai",
    url: "https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6.md",
    snapshotName: "openai-gpt-5-6-prompt-guidance.md",
    fetch: fetchAnonymous,
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
  const activeIds = new Set(sources.map((source) => source.id));
  freshness.sources = freshness.sources.filter(
    (entry) => entry.owner !== "apex-vendor-prompting" || activeIds.has(entry.source_id),
  );
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
