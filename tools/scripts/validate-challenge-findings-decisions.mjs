#!/usr/bin/env node
/**
 * validate-challenge-findings-decisions.mjs
 *
 * Post-write validator for `challenge-findings-*-decisions.json` artifacts
 * (issue #425, audit follow-up). Validates the per-finding decision
 * sidecar against the permissive v1 schema. Agents call this with the
 * artifact path; CI may scan `agent-output/**` and validate every match.
 *
 * Usage:
 *   node tools/scripts/validate-challenge-findings-decisions.mjs <file>
 *   node tools/scripts/validate-challenge-findings-decisions.mjs --all
 *
 * Exit codes:
 *   0 — valid
 *   1 — schema violation (details printed)
 *   2 — usage / file error
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadValidator as compileSchemaFile } from "./_lib/ajv-validator.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/challenge-findings-decisions.schema.json");

function loadValidator() {
  return compileSchemaFile(SCHEMA_PATH);
}

function validateFile(validate, file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`❌ ${path.relative(ROOT, file)}: cannot read or parse JSON — ${err.message}`);
    return false;
  }
  const ok = validate(data);
  if (ok) {
    console.log(`✅ ${path.relative(ROOT, file)}: valid`);
    return true;
  }
  console.error(`❌ ${path.relative(ROOT, file)}: schema violation`);
  for (const err of validate.errors ?? []) {
    console.error(`   - ${err.instancePath || "/"}: ${err.message}`);
  }
  return false;
}

function* walkDecisionsFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDecisionsFiles(full);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("challenge-findings-") &&
      entry.name.endsWith("-decisions.json")
    ) {
      yield full;
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("usage: validate-challenge-findings-decisions.mjs <file> | --all");
    process.exit(2);
  }
  const validate = loadValidator();
  const targets = [];
  if (args[0] === "--all") {
    const base = path.join(ROOT, "agent-output");
    for (const f of walkDecisionsFiles(base)) targets.push(f);
    if (targets.length === 0) {
      console.log("validate-challenge-findings-decisions: no decision sidecars found under agent-output/");
      process.exit(0);
    }
  } else {
    for (const a of args) targets.push(path.resolve(a));
  }
  let allOk = true;
  for (const t of targets) {
    if (!validateFile(validate, t)) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}

// Export internals for fixture-based unit tests.
export { loadValidator, validateFile };

const invokedAsScript =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedAsScript) {
  main();
}
