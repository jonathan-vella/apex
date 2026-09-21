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
import { parseArgs } from "node:util";
import { loadValidator } from "./_lib/ajv-validator.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { readJson, sha256File } from "./_lib/json.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/iac-handoff.schema.json");

export function assertRepositoryPath(candidate, root = ROOT) {
  const inside = (base, target) => {
    const relative = path.relative(base, target);
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  if (
    !inside(root, candidate) ||
    (fs.existsSync(candidate) && !inside(fs.realpathSync(root), fs.realpathSync(candidate)))
  ) {
    throw new Error("Handoff paths must remain inside the repository");
  }
}

function walkFiles(dir, files) {
  // First pass: collect the set of bicep stems in this directory so we can
  // exclude their compiled JSON siblings (`bicep build main.bicep` writes
  // `main.json` next to `main.bicep`, which would otherwise poison the
  // tree hash with build output).
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const bicepStems = new Set();
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith(".bicep")) {
      bicepStems.add(e.name.slice(0, -".bicep".length));
    }
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not valid handoff inputs: ${full}`);
    if (entry.isDirectory()) {
      if (entry.name === ".terraform" || entry.name === "node_modules" || entry.name === ".git") continue;
      walkFiles(full, files);
    } else if (entry.isFile()) {
      // skip transient artifacts
      if (entry.name.endsWith(".tfstate") || entry.name.endsWith(".tfstate.backup")) continue;
      if (entry.name === "tfplan" || entry.name.endsWith(".tfplan")) continue;
      // skip compiled bicep output next to a .bicep source (e.g. main.json next to main.bicep)
      if (entry.name.endsWith(".json")) {
        const stem = entry.name.slice(0, -".json".length);
        if (bicepStems.has(stem)) continue;
      }
      files.push(full);
    }
  }
}

export function computeTreeHash(rootDir) {
  if (!fs.existsSync(rootDir)) return null;
  if (fs.lstatSync(rootDir).isSymbolicLink() || !fs.statSync(rootDir).isDirectory()) {
    throw new Error("Tree root must be a regular directory");
  }
  const files = [];
  walkFiles(rootDir, files);
  if (!files.length) throw new Error("Tree root contains no source files");
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
  assertRepositoryPath(rootDir);
  if (!fs.existsSync(rootDir)) {
    r.error(fileRel, `tree_hash.root not found on disk: ${data.tree_hash.root}`);
    return;
  }
  const computed = computeTreeHash(rootDir);
  if (!computed) return;
  if (computed.value !== data.tree_hash.value || computed.file_count !== data.tree_hash.file_count) {
    r.error(
      fileRel,
      `tree_hash mismatch under ${data.tree_hash.root}: declared ${data.tree_hash.value.slice(0, 12)}… actual ${computed.value.slice(0, 12)}… (files: declared ${data.tree_hash.file_count}, actual ${computed.file_count}). Deploy MUST be blocked until 06b/06t re-emits the handoff.`,
    );
  }
}

export function validationEvidenceErrors(data) {
  const errors = [];
  const gate = data.validation_summary?.validate_gate;
  if (gate?.exit_code !== 0) errors.push("validate_gate must record an executed successful command (exit_code=0)");
  const command = gate?.command ?? "";
  if (data.iac_tool === "Bicep" && !/\baz\s+deployment\s+(sub|group|mg|tenant)\s+validate\b/.test(command)) {
    errors.push("Bicep validate_gate requires Azure deployment validate, not parameter compilation");
  }
  if (data.iac_tool === "Terraform" && !/\bterraform\s+(?:-chdir=\S+\s+)?plan\b/.test(command)) {
    errors.push("Terraform validate_gate requires the scoped plan command");
  }
  if ((data.governance_attestation?.l2_summary?.mismatched ?? 0) !== 0) errors.push("L2 mismatches block handoff");
  return errors;
}

function checkValidationVerdict(data, fileRel, r) {
  for (const error of validationEvidenceErrors(data)) r.error(fileRel, error);
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
  assertRepositoryPath(refPath);
  if (!fs.existsSync(refPath)) {
    // Hard fail — the L1m artifact is the bridge between the policy plan and
    // the IaC code; if it's missing the L0→L3 chain is broken and deploy
    // must be blocked. Previous behaviour (warn-and-skip) let the nordic
    // chain ship in a degraded state.
    r.error(
      fileRel,
      `governance_attestation.l1m_ref.path not found on disk: ${ref.path}. The L1m artifact is required for the governance attestation chain — re-run Step 4 to regenerate it before Step 5 handoff can be trusted.`,
    );
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
  assertRepositoryPath(epPath);
  const relative = path.relative(path.resolve(ROOT, data.tree_hash.root), epPath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    r.error(fileRel, "entrypoint.path must be inside tree_hash.root");
  }
  if (!fs.existsSync(epPath)) {
    r.error(fileRel, `entrypoint.path not found on disk: ${ep}`);
  } else if (
    fs.lstatSync(epPath).isSymbolicLink() ||
    !(["terraform-root", "terraform-module"].includes(data.entrypoint.kind)
      ? fs.statSync(epPath).isDirectory()
      : fs.statSync(epPath).isFile())
  ) {
    r.error(fileRel, "entrypoint.path must be a regular Bicep file or Terraform root directory");
  }
}

function defaultGlobs() {
  return ["agent-output/*/05-iac-handoff.json"];
}

export function main(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { "tree-hash": { type: "string" }, "skip-tree-hash": { type: "boolean" }, help: { type: "boolean" } },
  });
  if (values.help) {
    console.log("Usage: validate-iac-handoff.mjs [path-or-glob] [--skip-tree-hash] | --tree-hash <directory>");
    return;
  }
  if (values["tree-hash"]) {
    if (positionals.length || values["skip-tree-hash"]) throw new Error("Tree-hash mode cannot validate a handoff");
    const result = computeTreeHash(path.resolve(values["tree-hash"]));
    if (!result) throw new Error("Tree root does not exist");
    console.log(JSON.stringify(result));
    return;
  }
  const r = new Reporter("IaC Handoff Validator");
  r.header();
  const validate = loadValidator(SCHEMA_PATH);
  const skipTreeHash = values["skip-tree-hash"];
  const args = positionals;
  const patterns = args.length > 0 ? args : defaultGlobs();

  let files = [];
  for (const pat of patterns) {
    const matched = globSync(pat, { cwd: ROOT, absolute: true });
    files = files.concat(matched);
  }
  files = [...new Set(files)];

  if (files.length === 0) {
    if (args.length) throw new Error(`Explicit target matched no files: ${args.join(", ")}`);
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
