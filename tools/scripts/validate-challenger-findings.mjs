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
 *   node tools/scripts/validate-challenger-findings.mjs [--root <directory>]
 *   node tools/scripts/validate-challenger-findings.mjs [--path <path>] [<path> ...]
 *   Explicit files (including .tmp) are validated regardless of filename.
 *   Paths resolve from cwd; --root selects the scan directory (default: agent-output).
 *
 * Exit codes:
 *   0  all sidecars conform to v1.0 (or no sidecars present)
 *   1  one or more sidecars fail validation
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Reporter } from "./_lib/reporter.mjs";
import { parseFrontmatter } from "./_lib/parse-frontmatter.mjs";

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

let r;

export function findingId(finding) {
  for (const field of ["category", "claim", "artifact_section"]) {
    if (typeof finding?.[field] !== "string" || !finding[field]) {
      throw new Error(`Finding identity requires ${field}`);
    }
  }
  return createHash("sha256")
    .update([finding.category, finding.claim, finding.artifact_section].join("|"))
    .digest("hex")
    .slice(0, 8);
}

export function cacheInputs(artifactPath, root = process.cwd()) {
  const read = (relative) => fs.readFileSync(path.resolve(root, relative));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const artifact = path.resolve(root, artifactPath);
  const entries = [];
  const ignored = new Set([".git", ".terraform", "node_modules", ".venv", "__pycache__"]);
  const visit = (target) => {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw new Error(`Review artifacts cannot contain symlinks: ${target}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(target).sort()) {
        if (!ignored.has(name)) visit(path.join(target, name));
      }
    } else if (stat.isFile()) {
      entries.push([path.relative(artifact, target).split(path.sep).join("/"), hash(fs.readFileSync(target))]);
    } else throw new Error(`Unsupported review artifact: ${target}`);
  };
  visit(artifact);
  if (!entries.length) throw new Error("Review artifact directory contains no files");
  const artifactSha = fs.lstatSync(artifact).isDirectory() ? hash(JSON.stringify(entries)) : entries[0][1];
  const worker = read(".github/agents/_subagents/challenger-review-subagent.agent.md");
  const models = parseFrontmatter(worker.toString("utf8"))?.model;
  const model = Array.isArray(models) ? models[0] : null;
  if (typeof model !== "string" || !model) throw new Error("Missing reviewer frontmatter model");
  const inputs = {
    artifact_sha: artifactSha,
    checklists_sha: hash(read(".github/skills/apex-azure-defaults/references/adversarial-checklists.md")),
    protocol_sha: hash(read(".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md")),
    subagent_sha: hash(worker),
    model,
  };
  return { ...inputs, artifact_hash: hash(Object.values(inputs).join("\n---\n")) };
}

function verifyCache(file, doc) {
  const expected = cacheInputs(doc.challenged_artifact);
  for (const [field, value] of Object.entries(expected)) {
    if (doc.cache_inputs?.[field] !== value) r.error(`${file}: stale cache_inputs.${field}`);
  }
  for (const [index, finding] of doc.findings.entries()) {
    if (finding.id !== findingId(finding)) r.error(`${file}: findings[${index}].id does not match identity`);
  }
  for (const severity of VALID_SEVERITY) {
    const count = doc.findings.filter((finding) => finding.severity === severity).length;
    if (doc[`${severity}_count`] !== count) r.error(`${file}: ${severity}_count does not match findings`);
  }
}

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

export function runValidator(args = process.argv.slice(2)) {
  r = new Reporter("Challenger Findings Validator");

  const files = new Set();
  let verifyCurrent = false;
  try {
    const { values, positionals } = parseArgs({
      args,
      options: {
        root: { type: "string" },
        path: { type: "string", multiple: true },
        metadata: { type: "string" },
        "finding-ids": { type: "string" },
        "verify-cache": { type: "boolean" },
        help: { type: "boolean" },
      },
      allowPositionals: true,
    });
    if (values.help) {
      console.log(
        "Usage: validate-challenger-findings.mjs [--root DIR | --path FILE | FILE ...] [--verify-cache]\n" +
          "Read-only metadata: --metadata ARTIFACT [--finding-ids DRAFT.json.tmp]\n" +
          "Metadata hashes file bytes or sorted directory entries using the reviewer frontmatter model.\n" +
          "Use --verify-cache for current review gates, not historical schema-only scans.",
      );
      return 0;
    }
    if (values.metadata !== undefined || values["finding-ids"] !== undefined) {
      if (values.root !== undefined || values.path || positionals.length || values["verify-cache"]) {
        throw new Error("Metadata output cannot be combined with validation inputs");
      }
      const metadata = {};
      if (values.metadata !== undefined) metadata.cache_inputs = cacheInputs(values.metadata);
      if (values["finding-ids"] !== undefined) {
        const draft = JSON.parse(fs.readFileSync(values["finding-ids"], "utf8"));
        const identities = (entry) => entry.findings.map((finding, index) => ({ index, id: findingId(finding) }));
        if (Array.isArray(draft.batch_results)) metadata.batch_results = draft.batch_results.map(identities);
        else metadata.finding_ids = identities(draft);
      }
      console.log(JSON.stringify(metadata, null, 2));
      return 0;
    }
    verifyCurrent = values["verify-cache"] ?? false;
    const requested = [...(values.path ?? []), ...positionals];
    if (values.root !== undefined) requested.unshift(values.root);
    if (requested.length === 0) {
      for (const file of walk(ROOT)) files.add(file);
    } else {
      for (const target of requested) {
        try {
          if (!target) throw new Error("input path must not be empty");
          const stat = fs.statSync(target);
          if (target === values.root && !stat.isDirectory()) {
            throw new Error("--root must be a directory");
          }
          if (stat.isFile()) {
            files.add(path.resolve(target));
          } else if (stat.isDirectory()) {
            for (const file of walk(target)) files.add(path.resolve(file));
          } else {
            throw new Error("input must be a regular file or directory");
          }
        } catch (error) {
          r.error(target, `cannot inspect input (${error.message})`);
        }
      }
    }
  } catch (error) {
    r.error(`Invalid arguments or scan failure: ${error.message}`);
  }

  if (files.size === 0 && r.errors === 0) {
    console.log("  ⚠️  No challenger findings sidecars found in scan directories — nothing to validate.\n");
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
    try {
      validateFindings(file, doc);
      if (verifyCurrent) {
        const entries = Array.isArray(doc.batch_results) ? doc.batch_results : [doc];
        if (entries.length === 0) throw new Error("Empty batch cannot prove a current review");
        for (const entry of entries) verifyCache(file, entry);
      }
    } catch (error) {
      r.error(`${file}: invalid findings payload (${error.message})`);
    }
  }

  console.log(`  Scanned ${files.size} findings sidecar(s)`);
  if (verifyCurrent && files.size === 0) r.error("No findings scanned for current review verification");
  r.summary();
  return r.errors > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(runValidator());
}
