#!/usr/bin/env node
/**
 * IaC Handoff Validator (iac-handoff-v1)
 *
 * Validates agent-output/{project}/05-iac-handoff.json — the compact
 * record emitted by 06b/06t CodeGen at the end of Step 5 that lets deploy
 * agents skip re-reading the full plan + every IaC file.
 *
 * Schema-side checks (Ajv 2020-12, hard-fail):
 *   - All fields per tools/schemas/iac-handoff.schema.json
 *
 * Semantic checks (hard-fail unless marked WARN):
 *   1. tree_hash.value matches a freshly-computed hash of the IaC tree
 *      under tree_hash.root (sha256-of-sorted-file-hashes). Deploy agents
 *      MUST recompute this before running `azd provision` / `terraform
 *      apply`; a mismatch blocks deploy.
 *   2. validation_summary.verdict == APPROVED.
 *   3. governance_attestation.l1m_ref.sha256 matches the actual L1m file
 *      content when the file exists.
 *   4. entrypoint.path exists under tree_hash.root.
 *
 * Usage:
 *   node tools/scripts/validate-iac-handoff.mjs
 *   node tools/scripts/validate-iac-handoff.mjs <path-or-glob>
 *   node tools/scripts/validate-iac-handoff.mjs <path> --skip-tree-hash
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
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/iac-handoff.schema.json");

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

function walkFiles(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".terraform" || entry.name === "node_modules" || entry.name === ".git") continue;
      walkFiles(full, files);
    } else if (entry.isFile()) {
      // skip transient artifacts
      if (entry.name.endsWith(".tfstate") || entry.name.endsWith(".tfstate.backup")) continue;
      if (entry.name === "tfplan" || entry.name.endsWith(".tfplan")) continue;
      files.push(full);
    }
  }
}

function computeTreeHash(rootDir) {
  if (!fs.existsSync(rootDir)) return null;
  const files = [];
  walkFiles(rootDir, files);
  files.sort();
  const h = crypto.createHash("sha256");
  for (const f of files) {
    const rel = path.relative(rootDir, f).split(path.sep).join("/");
    const digest = sha256File(f);
    h.update(`${rel}\u0000${digest}\u0000`);
  }
  return { value: h.digest("hex"), file_count: files.length };
}

function checkTreeHash(data, fileRel, r, skip) {
  if (skip) {
    r.info(fileRel, "(--skip-tree-hash — recompute skipped)");
    return;
  }
  const rootDir = path.resolve(ROOT, data.tree_hash.root);
  if (!fs.existsSync(rootDir)) {
    r.warn(fileRel, `tree_hash.root not found on disk: ${data.tree_hash.root} (skipping recompute)`);
    return;
  }
  const computed = computeTreeHash(rootDir);
  if (!computed) return;
  if (computed.value !== data.tree_hash.value) {
    r.error(
      fileRel,
      `tree_hash mismatch under ${data.tree_hash.root}: declared ${data.tree_hash.value.slice(0, 12)}… actual ${computed.value.slice(0, 12)}… (files: declared ${data.tree_hash.file_count}, actual ${computed.file_count}). Deploy MUST be blocked until 06b/06t re-emits the handoff.`,
    );
  }
}

function checkValidationVerdict(data, fileRel, r) {
  const verdict = data.validation_summary?.verdict;
  if (verdict !== "APPROVED") {
    r.error(
      fileRel,
      `validation_summary.verdict is "${verdict}" — deploy must be blocked until Step 5 re-runs validate-subagent.`,
    );
  }
}

function checkL1mRefHash(data, fileRel, r) {
  const ref = data.governance_attestation?.l1m_ref;
  if (!ref || !ref.sha256) return;
  const refPath = path.resolve(path.dirname(path.join(ROOT, fileRel)), ref.path);
  if (!fs.existsSync(refPath)) {
    r.warn(fileRel, `governance_attestation.l1m_ref.path not found on disk: ${ref.path} (skipping hash check)`);
    return;
  }
  const actual = sha256File(refPath);
  if (actual !== ref.sha256) {
    r.error(
      fileRel,
      `governance_attestation.l1m_ref.sha256 mismatch: declared ${ref.sha256.slice(0, 12)}… actual ${actual.slice(0, 12)}…`,
    );
  }
}

function checkEntrypointExists(data, fileRel, r) {
  const ep = data.entrypoint?.path;
  if (!ep) return;
  const epPath = path.resolve(ROOT, ep);
  if (!fs.existsSync(epPath)) {
    r.error(fileRel, `entrypoint.path not found on disk: ${ep}`);
  }
}

function defaultGlobs() {
  return ["agent-output/*/05-iac-handoff.json"];
}

function main() {
  const r = new Reporter("IaC Handoff Validator");
  r.header();
  const validate = loadValidator();
  const rawArgs = process.argv.slice(2);
  const skipTreeHash = rawArgs.includes("--skip-tree-hash");
  const args = rawArgs.filter((a) => a !== "--skip-tree-hash");
  const patterns = args.length > 0 ? args : defaultGlobs();

  let files = [];
  for (const pat of patterns) {
    const matched = globSync(pat, { cwd: ROOT, absolute: true });
    files = files.concat(matched);
  }
  files = [...new Set(files)];

  if (files.length === 0) {
    r.info("(no 05-iac-handoff.json files found)");
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
    checkValidationVerdict(data, fileRel, r);
    checkTreeHash(data, fileRel, r, skipTreeHash);
    checkL1mRefHash(data, fileRel, r);
    checkEntrypointExists(data, fileRel, r);
    r.ok(
      fileRel,
      `iac-handoff (tool=${data.iac_tool}, verdict=${data.validation_summary.verdict}, ${data.governance_attestation.rows.length} attestations)`,
    );
  }

  r.summary();
  r.exitOnError("IaC handoff validation passed");
}

main();
