/**
 * AVM module version resolver.
 *
 * Resolves the latest published version of an AVM module against:
 *   1. Public registry (HEAD / GET, primary source of truth)
 *      - Bicep:      https://mcr.microsoft.com/v2/bicep/{path}/tags/list
 *      - Terraform:  https://registry.terraform.io/v1/modules/Azure/{path}/azurerm/versions
 *   2. Checked-in cache file (tools/scripts/_data/avm-module-cache.json)
 *      with timestamp + source. Used when registries are unreachable.
 *
 * Resolution modes:
 *   - "ci" / "freeze": fail closed when both live and cache are stale/missing.
 *   - "local":         soft-pass from cache; warn on missing.
 *
 * The resolver does NOT call MCP helpers — it is consumed by Node validators
 * outside the Copilot chat context. Agents in chat sessions are still
 * instructed to call MCP first; the validator independently verifies.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CACHE_PATH = path.join(ROOT, "tools/scripts/_data/avm-module-cache.json");
const CACHE_MAX_AGE_DAYS = 7;
const FRESH_CACHE_MAX_AGE_DAYS = 14; // older than this fails in CI mode

const MCR_REGISTRY = "https://mcr.microsoft.com";
const TF_REGISTRY = "https://registry.terraform.io";

/**
 * @typedef {object} ResolverResult
 * @property {"ok"|"missing"|"unreachable"|"unclassified"} status
 * @property {string|null} latest               highest stable semver (excludes prerelease)
 * @property {string[]} known_versions          full version list, newest first
 * @property {"mcr"|"terraform-registry"|"cache"|null} source
 * @property {string} lookup_timestamp          ISO-8601
 * @property {string|null} note                 human-readable diagnostic
 */

const STABLE_SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const PRERELEASE_RE = /-(alpha|beta|preview|rc|next)/i;

function parseSemver(v) {
  const m = STABLE_SEMVER_RE.exec(v);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

function pickLatestStable(versions) {
  const stable = versions.filter((v) => STABLE_SEMVER_RE.test(v) && !PRERELEASE_RE.test(v));
  if (stable.length === 0) return null;
  stable.sort(compareSemver);
  return stable[stable.length - 1];
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return { entries: {} };
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } catch {
    return { entries: {} };
  }
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

function ageDays(isoTimestamp) {
  const ts = Date.parse(isoTimestamp);
  if (Number.isNaN(ts)) return Infinity;
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

/**
 * Fetch the tag list for a Bicep AVM module from MCR.
 * Source path example: br/public:avm/res/key-vault/vault
 *   → MCR path: bicep/avm/res/key-vault/vault
 *   → URL:      https://mcr.microsoft.com/v2/bicep/avm/res/key-vault/vault/tags/list
 */
async function fetchMcrTags(source, { timeoutMs = 8000 } = {}) {
  // source like "br/public:avm/res/key-vault/vault" or "avm/res/key-vault/vault"
  const cleaned = source.replace(/^br\/public:/, "");
  const mcrPath = `bicep/${cleaned}`;
  const url = `${MCR_REGISTRY}/v2/${mcrPath}/tags/list`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.status === 404) {
      return { status: "missing", tags: [], note: `MCR returned 404 for ${mcrPath}` };
    }
    if (!res.ok) {
      return {
        status: "unreachable",
        tags: [],
        note: `MCR ${res.status} for ${mcrPath}`,
      };
    }
    const body = await res.json();
    return { status: "ok", tags: Array.isArray(body.tags) ? body.tags : [], note: null };
  } catch (err) {
    clearTimeout(timer);
    return { status: "unreachable", tags: [], note: err.message ?? "fetch failed" };
  }
}

/**
 * Fetch the version list for a Terraform AVM module from registry.terraform.io.
 * Source path example: Azure/avm-res-keyvault-vault/azurerm
 */
async function fetchTfVersions(source, { timeoutMs = 8000, retries = 2 } = {}) {
  // source must match Azure/<module>/<provider>
  const m = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/.exec(source);
  if (!m) {
    return {
      status: "unclassified",
      versions: [],
      note: `Source "${source}" is not a Terraform Registry path (expected Namespace/Module/Provider).`,
    };
  }
  const url = `${TF_REGISTRY}/v1/modules/${m[1]}/${m[2]}/${m[3]}/versions`;
  let lastNote = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 404) {
        return { status: "missing", versions: [], note: `Registry 404 for ${source}` };
      }
      if (res.status === 429) {
        lastNote = `Registry 429 (rate-limited) for ${source}`;
        const backoff = 500 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      if (!res.ok) {
        return {
          status: "unreachable",
          versions: [],
          note: `Registry ${res.status} for ${source}`,
        };
      }
      const body = await res.json();
      const versions = (body.modules?.[0]?.versions ?? []).map((v) => v.version);
      return { status: "ok", versions, note: null };
    } catch (err) {
      clearTimeout(timer);
      lastNote = err.message ?? "fetch failed";
    }
  }
  return { status: "unreachable", versions: [], note: lastNote };
}

/**
 * Resolve the latest published stable version for a single AVM module.
 *
 * @param {object} args
 * @param {"bicep"|"terraform"} args.tool
 * @param {string} args.source                module path
 * @param {"ci"|"freeze"|"local"} [args.mode="local"]
 * @param {boolean} [args.allowNetwork=true]  set false to force cache-only
 * @returns {Promise<ResolverResult>}
 */
export async function resolveLatest({ tool, source, mode = "local", allowNetwork = true }) {
  const cache = loadCache();
  const key = `${tool}::${source}`;
  const cached = cache.entries?.[key] ?? null;

  if (allowNetwork) {
    const live = tool === "bicep" ? await fetchMcrTags(source) : await fetchTfVersions(source);

    if (live.status === "ok") {
      const versions = tool === "bicep" ? live.tags : live.versions;
      const latest = pickLatestStable(versions);
      const entry = {
        latest,
        known_versions: [...versions].sort(compareSemver).reverse(),
        source: tool === "bicep" ? "mcr" : "terraform-registry",
        lookup_timestamp: new Date().toISOString(),
      };
      cache.entries = cache.entries ?? {};
      cache.entries[key] = entry;
      saveCache(cache);
      return {
        status: "ok",
        latest,
        known_versions: entry.known_versions,
        source: entry.source,
        lookup_timestamp: entry.lookup_timestamp,
        note: null,
      };
    }
    if (live.status === "missing") {
      return {
        status: "missing",
        latest: null,
        known_versions: [],
        source: tool === "bicep" ? "mcr" : "terraform-registry",
        lookup_timestamp: new Date().toISOString(),
        note: live.note,
      };
    }
    if (live.status === "unclassified") {
      return {
        status: "unclassified",
        latest: null,
        known_versions: [],
        source: null,
        lookup_timestamp: new Date().toISOString(),
        note: live.note,
      };
    }
    // fall through to cache when unreachable
  }

  if (cached) {
    const age = ageDays(cached.lookup_timestamp);
    const stale = age > CACHE_MAX_AGE_DAYS;
    const tooStaleForCi = age > FRESH_CACHE_MAX_AGE_DAYS;
    if ((mode === "ci" || mode === "freeze") && tooStaleForCi) {
      return {
        status: "unreachable",
        latest: cached.latest,
        known_versions: cached.known_versions ?? [],
        source: "cache",
        lookup_timestamp: cached.lookup_timestamp,
        note: `Cache age ${age.toFixed(1)}d exceeds CI/freeze threshold ${FRESH_CACHE_MAX_AGE_DAYS}d.`,
      };
    }
    return {
      status: "ok",
      latest: cached.latest,
      known_versions: cached.known_versions ?? [],
      source: "cache",
      lookup_timestamp: cached.lookup_timestamp,
      note: stale ? `Cache age ${age.toFixed(1)}d > ${CACHE_MAX_AGE_DAYS}d freshness target.` : null,
    };
  }

  return {
    status: "unreachable",
    latest: null,
    known_versions: [],
    source: null,
    lookup_timestamp: new Date().toISOString(),
    note: "No live response and no cache entry available.",
  };
}

/**
 * Classify the freshness/validity of a pinned version against the resolved latest.
 *
 * @param {object} args
 * @param {string} args.pinned
 * @param {ResolverResult} args.resolved
 * @param {number} [args._maxAgeDays=90]   publish-age threshold for "stale"
 * @returns {{ result: string, message: string }}
 */
export function classifyPin({ pinned, resolved, _maxAgeDays = 90 }) {
  if (resolved.status === "missing") {
    return {
      result: "missing_version",
      message: `Module not found in registry (source may be invalid or yanked).`,
    };
  }
  if (resolved.status === "unclassified") {
    return {
      result: "source_unclassified",
      message: resolved.note ?? "Source format not recognized.",
    };
  }
  if (resolved.status === "unreachable") {
    return {
      result: "lookup_unavailable",
      message: resolved.note ?? "Registry unreachable and no usable cache.",
    };
  }
  // resolved.status === "ok"
  const known = resolved.known_versions ?? [];
  if (!known.includes(pinned)) {
    return {
      result: "missing_version",
      message: `Pinned version ${pinned} not in registry version list (latest stable: ${resolved.latest ?? "unknown"}).`,
    };
  }
  if (PRERELEASE_RE.test(pinned)) {
    return {
      result: "prerelease_ignored",
      message: `Pinned version ${pinned} is prerelease; ignoring for stale check.`,
    };
  }
  if (resolved.latest && compareSemver(pinned, resolved.latest) < 0) {
    // pinned is older than latest stable — return stale; caller checks pin_policy
    return {
      result: "stale",
      message: `Pinned ${pinned} is older than latest stable ${resolved.latest}.`,
    };
  }
  return {
    result: "ok",
    message: `Pinned ${pinned} matches latest stable.`,
  };
}

/**
 * Evaluate a pin_policy exception block. Returns { accepted, reason }.
 * @param {object|undefined} pinPolicy
 * @param {string} pinned
 */
export function evaluatePinPolicy(pinPolicy, _pinned) {
  if (!pinPolicy) return { accepted: false, reason: "No pin_policy block." };
  if (pinPolicy.mode !== "exception") {
    return {
      accepted: false,
      reason: `pin_policy.mode='${pinPolicy.mode}' (expected 'exception' to justify stale pin).`,
    };
  }
  const required = ["rationale", "evidence_url_or_file", "review_after"];
  for (const field of required) {
    if (!pinPolicy[field]) {
      return { accepted: false, reason: `pin_policy.${field} missing.` };
    }
  }
  const reviewAfter = Date.parse(pinPolicy.review_after);
  if (Number.isNaN(reviewAfter)) {
    return { accepted: false, reason: `pin_policy.review_after invalid date.` };
  }
  if (reviewAfter < Date.now()) {
    return {
      accepted: false,
      reason: `pin_policy.review_after (${pinPolicy.review_after}) is in the past — exception expired.`,
    };
  }
  // latest_seen should agree with the pinned version OR be the latest at exception time
  return {
    accepted: true,
    reason: `Exception accepted; review due ${pinPolicy.review_after}.`,
  };
}

export const __test__ = {
  parseSemver,
  compareSemver,
  pickLatestStable,
  STABLE_SEMVER_RE,
  PRERELEASE_RE,
};
