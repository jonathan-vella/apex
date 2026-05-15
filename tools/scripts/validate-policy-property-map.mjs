#!/usr/bin/env node
/**
 * Policy Property Map Validator (policy-property-map-v1, L1m)
 *
 * Validates agent-output/{project}/04-policy-property-map.json — the
 * machine-readable governance compliance matrix emitted alongside
 * 04-implementation-plan.md by Step 4 (05-IaC Planner).
 *
 * Schema-side checks (Ajv 2020-12, hard-fail):
 *   - All fields per tools/schemas/policy-property-map.schema.json
 *
 * Semantic checks (hard-fail unless marked WARN):
 *   1. policy_id values unique within the file.
 *   2. Every Deny-effect policy from 04-governance-constraints.json (when
 *      file exists alongside) is represented in policies[]. Missing Deny
 *      policies are CRITICAL because L1m exists precisely to attest Deny
 *      coverage even in light governance mode.
 *   3. governance_depth=light may omit rationale for non-Deny entries, but
 *      Deny entries MUST have rationale + evidence_required regardless.
 *   4. constraints_ref.sha256 matches the actual file content when the
 *      referenced 04-governance-constraints.json exists on disk.
 *
 * Usage:
 *   node tools/scripts/validate-policy-property-map.mjs
 *   node tools/scripts/validate-policy-property-map.mjs <path-or-glob>
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/policy-property-map.schema.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadValidator() {
  const schema = readJson(SCHEMA_PATH);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function checkUniquePolicyIds(data, fileRel, r) {
  const seen = new Set();
  for (const p of data.policies ?? []) {
    if (seen.has(p.policy_id)) {
      r.error(fileRel, `Duplicate policies[].policy_id: "${p.policy_id}"`);
    }
    seen.add(p.policy_id);
  }
}

function checkDenyCoverage(data, fileRel, r) {
  const sibling = path.join(path.dirname(path.join(ROOT, fileRel)), "04-governance-constraints.json");
  if (!fs.existsSync(sibling)) {
    r.info(fileRel, "(no sibling 04-governance-constraints.json — skipping Deny coverage check)");
    return;
  }
  let constraints;
  try {
    constraints = readJson(sibling);
  } catch (err) {
    r.warn(fileRel, `cannot parse 04-governance-constraints.json: ${err.message}`);
    return;
  }
  // governance-constraints schema places policies under different shapes
  // across versions; tolerate both flat .policies[] and nested forms.
  const denyIds = new Set();
  const flat = constraints.policies ?? constraints.effective_policies ?? [];
  for (const entry of flat) {
    const effect = entry.effect ?? entry.policyEffect;
    const id = entry.policy_id ?? entry.policyDefinitionId ?? entry.id;
    if (effect === "Deny" && id) denyIds.add(id);
  }
  if (denyIds.size === 0) {
    r.info(fileRel, "(no Deny-effect policies in 04-governance-constraints.json)");
    return;
  }
  const mapped = new Set((data.policies ?? []).map((p) => p.policy_id));
  for (const id of denyIds) {
    if (!mapped.has(id)) {
      r.error(
        fileRel,
        `Deny-effect policy "${id}" present in 04-governance-constraints.json is missing from policies[]. L1m MUST cover every Deny policy regardless of governance_depth.`,
      );
    }
  }
}

function checkDenyEnrichment(data, fileRel, r) {
  for (const p of data.policies ?? []) {
    if (p.effect !== "Deny") continue;
    if (!p.evidence_required) {
      r.error(fileRel, `Deny policy "${p.policy_id}" missing evidence_required (mandatory for Deny entries).`);
    }
    if (data.governance_depth === "full" && !p.rationale) {
      r.error(fileRel, `Deny policy "${p.policy_id}" missing rationale (mandatory when governance_depth="full").`);
    }
  }
}

function checkConstraintsRefHash(data, fileRel, r) {
  const ref = data.constraints_ref;
  if (!ref || !ref.sha256) return;
  const refPath = path.resolve(path.dirname(path.join(ROOT, fileRel)), ref.path);
  if (!fs.existsSync(refPath)) {
    // Hard fail — the L0 governance constraints file is the basis for the
    // L1 policy-property-map; if missing the chain is broken.
    r.error(
      fileRel,
      `constraints_ref.path not found on disk: ${ref.path}. Re-run Step 3.5 governance discovery to regenerate 04-governance-constraints.json before proceeding.`,
    );
    return;
  }
  const actual = sha256File(refPath);
  if (actual !== ref.sha256) {
    r.error(
      fileRel,
      `constraints_ref.sha256 mismatch: declared ${ref.sha256.slice(0, 12)}… actual ${actual.slice(0, 12)}…`,
    );
  }
}

function defaultGlobs() {
  return ["agent-output/*/04-policy-property-map.json"];
}

function main() {
  const r = new Reporter("Policy Property Map Validator (L1m)");
  r.header();
  const validate = loadValidator();
  const args = process.argv.slice(2);
  const patterns = args.length > 0 ? args : defaultGlobs();

  let files = [];
  for (const pat of patterns) {
    const matched = globSync(pat, { cwd: ROOT, absolute: true });
    files = files.concat(matched);
  }
  files = [...new Set(files)];

  if (files.length === 0) {
    r.info("(no 04-policy-property-map.json files found)");
    r.summary();
    process.exit(0);
  }

  for (const filePath of files) {
    const fileRel = path.relative(ROOT, filePath);
    r.tick();
    let data;
    try {
      data = readJson(filePath);
    } catch (err) {
      r.error(fileRel, `Invalid JSON: ${err.message}`);
      continue;
    }
    if (!validate(data)) {
      for (const err of validate.errors) {
        r.error(fileRel, `${err.instancePath || "/"}: ${err.message}`);
      }
      continue;
    }
    checkUniquePolicyIds(data, fileRel, r);
    checkDenyCoverage(data, fileRel, r);
    checkDenyEnrichment(data, fileRel, r);
    checkConstraintsRefHash(data, fileRel, r);
    r.ok(fileRel, `policy-property-map (${data.policies.length} policies, depth=${data.governance_depth})`);
  }

  r.summary();
  r.exitOnError("Policy property map validation passed");
}

main();
