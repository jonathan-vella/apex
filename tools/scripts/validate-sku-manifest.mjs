#!/usr/bin/env node
/**
 * SKU Manifest Validator
 *
 * Validates agent-output/{project}/sku-manifest.json against the
 * sku-manifest-v1 JSON schema plus semantic checks not expressible in
 * JSON Schema 2020-12.
 *
 * Schema-side checks (Ajv 2020-12, hard-fail):
 *   - All fields per tools/schemas/sku-manifest.schema.json
 *
 * Semantic checks (hard-fail unless marked WARN):
 *   1. services[].id is unique within the manifest.
 *   2. revisions[].rev is monotonically increasing starting at 1.
 *   3. current_revision == max(revisions[].rev).
 *   4. services[].last_modified_rev exists in revisions[].rev.
 *   5. environment_overrides keys are subset of top-level environments[].
 *   6. services[].regions[0] vs default_region — INFO only.
 *   7. source ↔ source_step coherence (user-pin → 1; deploy-substitute → 6).
 *   8. stamps[].id unique; stamps[].service_overrides refer to real services[].id.
 *   9. stamps[].environments subset of top-level environments[].
 *  10. Governance allowlist cross-check (when sku_allowlist_snapshot present):
 *      services[].size must match an allowed pattern OR fail.
 *  11. Pricing freshness — WARN when cost_estimated_at > PRICING_TTL_DAYS old.
 *  12. Manifest staleness — WARN when updated_at > MANIFEST_TTL_DAYS old.
 *
 * Usage:
 *   node tools/scripts/validate-sku-manifest.mjs
 *   node tools/scripts/validate-sku-manifest.mjs <path-or-glob>
 *   node tools/scripts/validate-sku-manifest.mjs <project>            # resolves to agent-output/<project>/sku-manifest.json
 *   node tools/scripts/validate-sku-manifest.mjs agent-output/<proj>  # directory → sku-manifest.json inside it
 *
 * Tunables (env):
 *   APEX_SKU_PRICING_TTL_DAYS   (default 30)
 *   APEX_SKU_MANIFEST_TTL_DAYS  (default 90)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/sku-manifest.schema.json");

const PRICING_TTL_DAYS = Number(process.env.APEX_SKU_PRICING_TTL_DAYS ?? 30);
const MANIFEST_TTL_DAYS = Number(process.env.APEX_SKU_MANIFEST_TTL_DAYS ?? 90);

const SOURCE_TO_STEP = {
  "user-pin": "1",
  "architect-derived": "2",
  "deploy-substitute": "6",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadValidator() {
  const schema = readJson(SCHEMA_PATH);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

function ageDays(iso, now = new Date()) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / (1000 * 60 * 60 * 24);
}

/**
 * Match a SKU value against a glob-style pattern (case-sensitive).
 * Supports `*` (any chars) and `?` (single char).
 */
function skuMatches(value, pattern) {
  if (!pattern) return false;
  if (value === pattern) return true;
  const re = new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".")}$`,
  );
  return re.test(value);
}

function checkUniqueIds(data, fileRel, r) {
  const seen = new Set();
  for (const svc of data.services ?? []) {
    if (seen.has(svc.id)) r.error(fileRel, `Duplicate services[].id: "${svc.id}"`);
    seen.add(svc.id);
  }
}

function checkRevisions(data, fileRel, r) {
  const revs = (data.revisions ?? []).map((rv) => rv.rev);
  if (revs.length === 0) return;
  if (revs[0] !== 1) r.error(fileRel, `revisions[0].rev must be 1 (got ${revs[0]})`);
  for (let i = 1; i < revs.length; i++) {
    if (revs[i] <= revs[i - 1]) {
      r.error(fileRel, `revisions[${i}].rev (${revs[i]}) must be > revisions[${i - 1}].rev (${revs[i - 1]})`);
    }
  }
  const maxRev = Math.max(...revs);
  if (data.current_revision !== maxRev) {
    r.error(fileRel, `current_revision (${data.current_revision}) must equal max revisions[].rev (${maxRev})`);
  }
  const revSet = new Set(revs);
  for (const svc of data.services ?? []) {
    if (!revSet.has(svc.last_modified_rev)) {
      r.error(fileRel, `services[${svc.id}].last_modified_rev (${svc.last_modified_rev}) not in revisions[]`);
    }
  }
}

function checkEnvOverrides(data, fileRel, r) {
  const envs = new Set(data.environments ?? []);
  for (const svc of data.services ?? []) {
    for (const env of Object.keys(svc.environment_overrides ?? {})) {
      if (!envs.has(env)) {
        r.error(fileRel, `services[${svc.id}].environment_overrides has key "${env}" not in environments[]`);
      }
    }
  }
}

function checkRegionInfo(data, fileRel, r) {
  for (const svc of data.services ?? []) {
    const regions = svc.regions ?? [];
    if (regions.length > 0 && regions[0] !== data.default_region) {
      r.info(
        fileRel,
        `services[${svc.id}].regions[0] = "${regions[0]}" differs from default_region "${data.default_region}" (intentional?)`,
      );
    }
  }
}

function checkSourceStepCoherence(data, fileRel, r) {
  for (const svc of data.services ?? []) {
    const expected = SOURCE_TO_STEP[svc.source];
    if (!expected) continue;
    // architect-derived entries may legitimately be revised at later steps
    // (Planner reconciliation keeps source unchanged); only user-pin and
    // deploy-substitute must match source_step strictly.
    if (svc.source === "architect-derived") continue;
    if (svc.source_step !== expected) {
      r.error(
        fileRel,
        `services[${svc.id}].source "${svc.source}" but source_step "${svc.source_step}" (expected "${expected}")`,
      );
    }
  }
}

function checkStamps(data, fileRel, r) {
  const stamps = data.stamps ?? [];
  if (stamps.length === 0) return;
  const seenIds = new Set();
  const serviceIds = new Set((data.services ?? []).map((s) => s.id));
  const envs = new Set(data.environments ?? []);
  for (const stamp of stamps) {
    if (seenIds.has(stamp.id)) r.error(fileRel, `Duplicate stamps[].id: "${stamp.id}"`);
    seenIds.add(stamp.id);
    for (const env of stamp.environments ?? []) {
      if (!envs.has(env)) {
        r.error(fileRel, `stamps[${stamp.id}].environments has "${env}" not in environments[]`);
      }
    }
    for (const overrideId of Object.keys(stamp.service_overrides ?? {})) {
      if (!serviceIds.has(overrideId)) {
        r.error(fileRel, `stamps[${stamp.id}].service_overrides references unknown services[].id "${overrideId}"`);
      }
    }
  }
}

function checkAllowlist(data, fileRel, r) {
  const snapshot = data.sku_allowlist_snapshot;
  if (!snapshot) return;
  const allowed = snapshot.allowed_skus ?? {};
  const denied = snapshot.denied_skus ?? {};
  for (const svc of data.services ?? []) {
    const denyPatterns = denied[svc.service] ?? [];
    for (const pat of denyPatterns) {
      if (skuMatches(svc.size, pat)) {
        r.error(
          fileRel,
          `services[${svc.id}].size "${svc.size}" matches denied SKU pattern "${pat}" for "${svc.service}" (sku_allowlist_snapshot.denied_skus)`,
        );
        break;
      }
    }
    const allowPatterns = allowed[svc.service];
    if (!allowPatterns || allowPatterns.length === 0) continue;
    const ok = allowPatterns.some((p) => skuMatches(svc.size, p));
    if (!ok) {
      r.error(
        fileRel,
        `services[${svc.id}].size "${svc.size}" not in governance allowlist for "${svc.service}" (allowed: ${allowPatterns.join(", ")})`,
      );
    }
  }
}

function checkFreshness(data, fileRel, r, now = new Date()) {
  const manifestAge = ageDays(data.updated_at, now);
  if (manifestAge !== null && manifestAge > MANIFEST_TTL_DAYS) {
    r.warn(
      fileRel,
      `Manifest updated_at is ${manifestAge.toFixed(1)} days old (>${MANIFEST_TTL_DAYS}). Consider refreshing.`,
    );
  }
  for (const svc of data.services ?? []) {
    if (svc.cost_estimate_monthly_usd === undefined) continue;
    const age = ageDays(svc.cost_estimated_at, now);
    if (age === null) {
      r.warn(
        fileRel,
        `services[${svc.id}] has cost_estimate_monthly_usd but no cost_estimated_at — pricing freshness unknown`,
      );
      continue;
    }
    if (age > PRICING_TTL_DAYS) {
      r.warn(
        fileRel,
        `services[${svc.id}].cost_estimated_at is ${age.toFixed(1)} days old (>${PRICING_TTL_DAYS}). Re-run cost-estimate-subagent.`,
      );
    }
  }
}

function checkMdSync(filePath, data, fileRel, r) {
  // Sibling .md companion. Required to exist and to declare a Current
  // revision cell matching JSON `current_revision`. The MD is the
  // deterministic output of tools/scripts/render-sku-manifest-md.mjs;
  // any mismatch indicates a stale rendering or hand-edit.
  const mdPath = filePath.replace(/\.json$/, ".md");
  const mdRel = path.relative(ROOT, mdPath);
  if (!fs.existsSync(mdPath)) {
    r.error(fileRel, `Companion MD missing: ${mdRel} — run 'node tools/scripts/render-sku-manifest-md.mjs <project>'`);
    return;
  }
  let md;
  try {
    md = fs.readFileSync(mdPath, "utf-8");
  } catch (err) {
    r.error(mdRel, `Failed to read MD companion: ${err.message}`);
    return;
  }
  const m = md.match(/\|\s*Current revision\s*\|\s*`(\d+)`/);
  if (!m) {
    r.error(mdRel, `MD missing 'Current revision' Overview cell — re-render via render-sku-manifest-md.mjs`);
    return;
  }
  const mdRev = Number(m[1]);
  if (mdRev !== data.current_revision) {
    r.error(
      mdRel,
      `MD Current revision (${mdRev}) != JSON current_revision (${data.current_revision}) — re-render via 'node tools/scripts/render-sku-manifest-md.mjs <project>'`,
    );
  }
}

function validateFile(filePath, validate, r) {
  const rel = path.relative(ROOT, filePath);
  let data;
  try {
    data = readJson(filePath);
  } catch (err) {
    r.error(rel, `Failed to parse JSON: ${err.message}`);
    return;
  }

  if (!validate(data)) {
    for (const err of validate.errors ?? []) {
      r.error(rel, `${err.instancePath || "/"} ${err.message}`);
    }
    return;
  }

  // Skip freshness checks on template/fixture files — they would emit
  // perpetual staleness noise as the repo ages. Real per-project
  // manifests under agent-output/ are still freshness-checked.
  const isTemplateOrFixture = /templates\/sku-manifest\.template\.json$|tests\/.+\/sku-manifest\//.test(rel);

  const before = r.errors;
  checkUniqueIds(data, rel, r);
  checkRevisions(data, rel, r);
  checkEnvOverrides(data, rel, r);
  checkRegionInfo(data, rel, r);
  checkSourceStepCoherence(data, rel, r);
  checkStamps(data, rel, r);
  checkAllowlist(data, rel, r);
  if (!isTemplateOrFixture) checkFreshness(data, rel, r);
  if (!isTemplateOrFixture) checkMdSync(filePath, data, rel, r);
  if (r.errors === before) r.ok(rel);
  r.tick();
}

function findManifests() {
  return globSync("agent-output/*/sku-manifest.json", { cwd: ROOT, nodir: true }).map((p) => path.join(ROOT, p));
}

/**
 * Resolve a CLI arg into a manifest file path. Accepts:
 *   - a direct file path (absolute or relative to repo root)
 *   - a directory containing sku-manifest.json
 *   - a bare project name → agent-output/<project>/sku-manifest.json
 * Falls back to path.resolve so non-existent inputs surface as "File not found".
 */
function resolveTarget(arg) {
  const abs = path.resolve(ROOT, arg);
  if (fs.existsSync(abs)) {
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) return path.join(abs, "sku-manifest.json");
    return abs;
  }
  // Bare project name (no path separator, no .json extension) → agent-output/<arg>/sku-manifest.json
  if (!arg.includes(path.sep) && !arg.includes("/") && !arg.endsWith(".json")) {
    const projectGuess = path.join(ROOT, "agent-output", arg, "sku-manifest.json");
    if (fs.existsSync(projectGuess)) return projectGuess;
  }
  return abs;
}

function main() {
  const r = new Reporter("SKU Manifest Validator");
  r.header();

  if (!fs.existsSync(SCHEMA_PATH)) {
    r.error(SCHEMA_PATH, "Schema file not found");
    r.exitOnError();
    return;
  }

  const validate = loadValidator();
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args.map((a) => resolveTarget(a)) : findManifests();

  if (targets.length === 0) {
    console.log("  ℹ️  No sku-manifest.json files found under agent-output/ — nothing to validate.");
    r.exitOnError();
    return;
  }

  for (const t of targets) {
    if (!fs.existsSync(t)) {
      r.error(path.relative(ROOT, t), "File not found");
      continue;
    }
    validateFile(t, validate, r);
  }

  r.summary();
  r.exitOnError();
}

main();
