#!/usr/bin/env node
/**
 * Challenger findings validator (v1.0).
 *
 * Scans every `challenge-findings-*.json` (and `…-pass{N}.json`) sidecar
 * under `agent-output/` and validates them against the v1.0 contract:
 *
 * - Required top-level fields: `schema_version`, `challenged_artifact`,
 *   `artifact_type`, `review_focus`, `pass_number`, `risk_level`,
 *   `must_fix_count`, `should_fix_count`, `suggestion_count`, `findings[]`,
 *   `cache_inputs`.
 *   Batch-mode files require `batch_results[]` whose elements match the
 *   single-lens shape.
 * - `schema_version` MUST equal `"1.0"`. Any other value (or absence) is
 *   a hard error. Legacy pre-1.0 sidecars are no longer supported.
 * - Each `findings[]` element must carry `id`, `severity`, `category`,
 *   `claim`, `evidence`, `impact`, `artifact_section`, `traces_to`.
 *   `must_fix` findings must also carry a `suggested_fix` with at minimum
 *   `artifact_path` and `proposed_edit`.
 * - `cache_inputs` must carry `artifact_sha`, `checklists_sha`,
 *   `protocol_sha`, `subagent_sha`, `model`, `artifact_hash` (all
 *   non-empty strings).
 *
 * Excludes the decisions sidecar (`challenge-findings-*-decisions.json`)
 * which has its own shape defined in `adversarial-review-protocol.md`
 * (§ Per-Finding Decision Protocol).
 *
 * Usage:
 *   node tools/scripts/validate-challenger-findings.mjs
 *
 * Exit codes:
 *   0  all sidecars conform to v1.0 (or no sidecars present)
 *   1  one or more sidecars fail validation
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = "agent-output";
const REQUIRED_TOP_LEVEL = [
  "schema_version",
  "challenged_artifact",
  "artifact_type",
  "review_focus",
  "pass_number",
  "risk_level",
  "must_fix_count",
  "should_fix_count",
  "suggestion_count",
  "findings",
  "cache_inputs",
];
const REQUIRED_FINDING_FIELDS = [
  "id",
  "severity",
  "category",
  "claim",
  "evidence",
  "impact",
  "artifact_section",
  "traces_to",
];
const REQUIRED_CACHE_FIELDS = [
  "artifact_sha",
  "checklists_sha",
  "protocol_sha",
  "subagent_sha",
  "model",
  "artifact_hash",
];
const VALID_SEVERITY = new Set(["must_fix", "should_fix", "suggestion"]);

const r = new Reporter("Challenger Findings Validator");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // _meta/ holds one-off adversarial reviews of planning prompts; they
      // intentionally use a non-canonical shape (location/phase fields) and
      // are out of scope for the standard challenger-findings contract.
      if (entry.name === "_meta") continue;
      walk(full, acc);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("challenge-findings-") &&
      entry.name.endsWith(".json") &&
      !entry.name.endsWith("-decisions.json")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

function validateFinding(file, finding, idx) {
  const where = `${file} findings[${idx}]`;
  for (const f of REQUIRED_FINDING_FIELDS) {
    if (!(f in finding)) {
      r.error(`${where}: missing required field "${f}"`);
    }
  }
  if (!VALID_SEVERITY.has(finding.severity)) {
    r.error(`${where}: severity "${finding.severity}" is not one of ${[...VALID_SEVERITY].join(", ")}`);
  }
  if (!Array.isArray(finding.traces_to)) {
    r.error(`${where}: traces_to must be an array (got ${typeof finding.traces_to})`);
  }
  if (finding.severity === "must_fix") {
    const sf = finding.suggested_fix;
    if (!sf || typeof sf !== "object") {
      r.error(`${where}: must_fix findings require a suggested_fix object`);
    } else {
      if (!isNonEmptyString(sf.artifact_path)) {
        r.error(`${where}: suggested_fix.artifact_path missing or empty`);
      }
      if (!isNonEmptyString(sf.proposed_edit)) {
        r.error(`${where}: suggested_fix.proposed_edit missing or empty`);
      }
    }
  }
  if (finding.requires_step !== undefined && !isNonEmptyString(finding.requires_step)) {
    r.error(`${where}: requires_step, when present, must be a non-empty string`);
  }
}

function validateFindings(file, doc) {
  // Batch mode
  if (Array.isArray(doc.batch_results)) {
    for (const [i, entry] of doc.batch_results.entries()) {
      validateFindings(`${file} batch_results[${i}]`, entry);
    }
    return;
  }

  for (const f of REQUIRED_TOP_LEVEL) {
    if (!(f in doc)) {
      r.error(`${file}: missing required top-level field "${f}"`);
    }
  }
  if (doc.schema_version !== "1.0") {
    r.error(`${file}: schema_version must be "1.0" (got ${JSON.stringify(doc.schema_version)})`);
  }
  if (!Array.isArray(doc.findings)) {
    r.error(`${file}: findings must be an array`);
  } else {
    for (const [i, finding] of doc.findings.entries()) {
      validateFinding(file, finding, i);
    }
  }
  if (doc.cache_inputs && typeof doc.cache_inputs === "object") {
    for (const f of REQUIRED_CACHE_FIELDS) {
      if (!isNonEmptyString(doc.cache_inputs[f])) {
        r.error(`${file}: cache_inputs.${f} missing or empty`);
      }
    }
  }
}

console.log("\n🔍 Validating challenger findings sidecars...\n");

const files = walk(ROOT);

if (files.length === 0) {
  console.log("  ⚠️  No challenger findings sidecars found under agent-output/ — nothing to validate.\n");
}

for (const file of files) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch (e) {
    r.error(`${file}: cannot read (${e.message})`);
    continue;
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    r.error(`${file}: invalid JSON (${e.message})`);
    continue;
  }
  validateFindings(file, doc);
}

console.log(`  ✅ Validated ${files.length} findings sidecar(s)`);
r.summary();
r.exitOnError(
  "All challenger findings sidecars conform to schema v1.0",
  `${files.length} sidecar(s) scanned, validation failed`,
);
