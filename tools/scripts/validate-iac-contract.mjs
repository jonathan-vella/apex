#!/usr/bin/env node
/**
 * IaC Contract Validator (iac-contract-v0 / v1)
 *
 * Validates agent-output/{project}/04-iac-contract.json emitted by Step 4
 * (05-IaC Planner) and consumed by Step 5 (06b/06t CodeGen).
 *
 * Schema-side checks (Ajv 2020-12, hard-fail):
 *   - All fields per tools/schemas/iac-contract.schema.json
 *
 * Semantic checks (hard-fail unless marked WARN):
 *   1. resources[].logical_name unique within the contract.
 *   2. modules.bicep[].resource_logical_name and
 *      modules.terraform[].resource_logical_name reference a real
 *      resources[].logical_name.
 *   3. modules track matches iac_tool (Bicep contract → bicep modules,
 *      Terraform contract → terraform modules).
 *   4. identity.uami_logical_names (when type includes user_assigned) must
 *      reference resources[].logical_name entries of type
 *      Microsoft.ManagedIdentity/userAssignedIdentities.
 *   5. diagnostics.workspace_id_param must exist in params[].
 *   6. depends_on entries (when present) must reference real
 *      resources[].logical_name values; no self-reference; no cycles.
 *   7. plan_ref.sha256 + l1m_ref.sha256 match the actual file content when
 *      the referenced files exist on disk (WARN when files missing — common
 *      during local dev before plan is finalised).
 *
 * Usage:
 *   node tools/scripts/validate-iac-contract.mjs
 *   node tools/scripts/validate-iac-contract.mjs <path-or-glob>
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";
import { loadValidator } from "./_lib/ajv-validator.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { readJson, sha256File } from "./_lib/json.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/iac-contract.schema.json");

function checkUniqueLogicalNames(data, fileRel, r) {
  const seen = new Set();
  for (const res of data.resources ?? []) {
    if (seen.has(res.logical_name)) {
      r.error(fileRel, `Duplicate resources[].logical_name: "${res.logical_name}"`);
    }
    seen.add(res.logical_name);
  }
}

function checkModuleRefs(data, fileRel, r) {
  const logicalNames = new Set((data.resources ?? []).map((res) => res.logical_name));
  const track = data.iac_tool === "Bicep" ? "bicep" : "terraform";
  const otherTrack = track === "bicep" ? "terraform" : "bicep";
  const modules = (data.modules ?? {})[track] ?? [];
  const other = (data.modules ?? {})[otherTrack] ?? [];
  if (other.length > 0) {
    r.error(
      fileRel,
      `modules.${otherTrack}[] must be empty when iac_tool="${data.iac_tool}" (got ${other.length} entries)`,
    );
  }
  for (const mod of modules) {
    if (!logicalNames.has(mod.resource_logical_name)) {
      r.error(fileRel, `modules.${track}[].resource_logical_name "${mod.resource_logical_name}" not in resources[]`);
    }
  }
}

function checkIdentity(data, fileRel, r) {
  const identity = data.identity ?? {};
  const includesUami = identity.type === "user_assigned" || identity.type === "both";
  if (includesUami) {
    const names = identity.uami_logical_names ?? [];
    if (names.length === 0) {
      r.error(fileRel, `identity.uami_logical_names required when identity.type="${identity.type}"`);
      return;
    }
    const uamiResources = new Set(
      (data.resources ?? [])
        .filter((res) => res.type === "Microsoft.ManagedIdentity/userAssignedIdentities")
        .map((res) => res.logical_name),
    );
    for (const name of names) {
      if (!uamiResources.has(name)) {
        r.error(
          fileRel,
          `identity.uami_logical_names "${name}" must reference a resources[] entry of type Microsoft.ManagedIdentity/userAssignedIdentities`,
        );
      }
    }
  }
}

function checkDiagnosticsParam(data, fileRel, r) {
  const wsParam = data.diagnostics?.workspace_id_param;
  if (!wsParam) return;
  const paramNames = new Set((data.params ?? []).map((p) => p.name));
  if (!paramNames.has(wsParam)) {
    r.error(fileRel, `diagnostics.workspace_id_param "${wsParam}" not declared in params[]`);
  }
}

function checkDependsOn(data, fileRel, r) {
  const names = new Set((data.resources ?? []).map((res) => res.logical_name));
  const graph = new Map();
  for (const res of data.resources ?? []) {
    const deps = res.depends_on ?? [];
    for (const dep of deps) {
      if (dep === res.logical_name) {
        r.error(fileRel, `resources[].depends_on self-reference on "${res.logical_name}"`);
      }
      if (!names.has(dep)) {
        r.error(fileRel, `resources["${res.logical_name}"].depends_on "${dep}" not in resources[]`);
      }
    }
    graph.set(res.logical_name, deps);
  }
  detectCycles(graph, fileRel, r);
}

function detectCycles(graph, fileRel, r) {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const colour = new Map();
  for (const node of graph.keys()) colour.set(node, WHITE);

  function visit(node, stack) {
    colour.set(node, GRAY);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (colour.get(next) === GRAY) {
        const cycle = [...stack.slice(stack.indexOf(next)), next].join(" → ");
        r.error(fileRel, `Cycle in resources[].depends_on: ${cycle}`);
        return;
      }
      if (colour.get(next) === WHITE) visit(next, stack);
    }
    stack.pop();
    colour.set(node, BLACK);
  }
  for (const node of graph.keys()) {
    if (colour.get(node) === WHITE) visit(node, []);
  }
}

function checkRefHashes(data, fileRel, r) {
  for (const refKey of ["plan_ref", "l1m_ref"]) {
    const ref = data[refKey];
    if (!ref || !ref.sha256) continue;
    const refPath = path.resolve(path.dirname(path.join(ROOT, fileRel)), ref.path);
    if (!fs.existsSync(refPath)) {
      r.warn(fileRel, `${refKey}.path not found on disk: ${ref.path} (skipping hash check)`);
      continue;
    }
    const actual = sha256File(refPath);
    if (actual !== ref.sha256) {
      r.error(
        fileRel,
        `${refKey}.sha256 mismatch: declared ${ref.sha256.slice(0, 12)}… actual ${actual.slice(0, 12)}…`,
      );
    }
  }
}

function defaultGlobs() {
  return ["agent-output/*/04-iac-contract.json"];
}

function main() {
  const r = new Reporter("IaC Contract Validator");
  r.header();
  const validate = loadValidator(SCHEMA_PATH);
  const args = process.argv.slice(2);
  const patterns = args.length > 0 ? args : defaultGlobs();

  let files = [];
  for (const pat of patterns) {
    const matched = globSync(pat, { cwd: ROOT, absolute: true });
    files = files.concat(matched);
  }
  files = [...new Set(files)];

  if (files.length === 0) {
    r.info("(no 04-iac-contract.json files found)");
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
    checkUniqueLogicalNames(data, fileRel, r);
    checkModuleRefs(data, fileRel, r);
    checkIdentity(data, fileRel, r);
    checkDiagnosticsParam(data, fileRel, r);
    checkDependsOn(data, fileRel, r);
    checkRefHashes(data, fileRel, r);
    r.ok(
      fileRel,
      `iac-contract ${data.schema_version} (${data.resources.length} resources, iac_tool=${data.iac_tool})`,
    );
  }

  r.summary();
  r.exitOnError("IaC contract validation passed");
}

main();
