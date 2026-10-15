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
 *   8. Private paths (only for resources declaring phase/consumes/target):
 *      a depends_on target may not be in a later phase, and a resource that
 *      consumes a resource with a private endpoint must depend_on one.
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
const STAGES = ["deploy", "post-deploy", "go-live"];

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

function checkScheduledActions(data, fileRel, reporter) {
  for (const resource of data.resources ?? []) {
    if (resource.type.toLowerCase() !== "microsoft.costmanagement/scheduledactions") continue;
    const deployment = resource.deployment;
    const label = `resources["${resource.logical_name}"].deployment`;
    if (!deployment) {
      reporter.error(fileRel, `${label} is required: record scheduled-action kind, scope and provider constraints`);
      continue;
    }
    if (deployment.kind !== "InsightAlert") continue;
    if (deployment.scope !== "subscription")
      reporter.error(fileRel, `${label}.scope must be subscription for InsightAlert`);
    if (data.iac_tool === "Bicep" && deployment.module_scope !== "subscription") {
      reporter.error(
        fileRel,
        `${label}.module_scope must be subscription; an RG-scoped module cannot host InsightAlert`,
      );
    }
    if (!deployment.display_name_max_length)
      reporter.error(fileRel, `${label} must bound displayName to 25 characters`);
    if (deployment.view_scope !== "same-subscription")
      reporter.error(fileRel, `${label} must bind the view to the same subscription`);
    if (!deployment.schedule) {
      reporter.error(
        fileRel,
        `${label}.schedule must require deployment-date UTC midnight and a window of at most 365 days`,
      );
    }
  }
}

function checkCapabilityReadiness(data, fileRel, reporter, required, stage = "deploy") {
  if (!data.capability_checks) {
    if (required) reporter.error(fileRel, "Capability coverage absent; owner migration required for readiness mode");
    return;
  }
  // A capability without `blocks` blocks every stage, which is the behaviour before the field existed.
  const blocksStage = (capability) =>
    !capability.blocks?.length || capability.blocks.some((blocked) => STAGES.indexOf(blocked) <= STAGES.indexOf(stage));
  const checks = new Map(data.capability_checks.map((entry) => [entry.id, entry]));
  const visit = (capability, trail = new Set()) => {
    if (trail.has(capability.id)) {
      reporter.error(fileRel, `Capability dependency cycle: ${capability.id}`);
      return;
    }
    const next = new Set([...trail, capability.id]);
    for (const reference of capability.dependencies) {
      const id = reference.startsWith("capability:") ? reference.slice("capability:".length) : reference;
      const dependency = checks.get(id);
      if (!dependency && reference.startsWith("capability:"))
        reporter.error(fileRel, `Missing capability dependency: ${id}`);
      if (dependency) {
        if (dependency.status !== "designed")
          reporter.error(fileRel, `Required path ${capability.id} depends on ${dependency.status} capability ${id}`);
        else visit(dependency, next);
      }
    }
  };
  const seen = new Set();
  for (const capability of data.capability_checks) {
    if (seen.has(capability.id)) reporter.error(fileRel, `Duplicate capability: ${capability.id}`);
    seen.add(capability.id);
    if (capability.status === "designed" && (capability.required_now || capability.security_obligation))
      visit(capability);
    if ((capability.required_now || capability.security_obligation) && capability.status === "unresolved") {
      if (blocksStage(capability)) reporter.error(fileRel, `Required design path unresolved: ${capability.id}`);
      else {
        reporter.warn(
          fileRel,
          `Capability ${capability.id} is unresolved and blocks ${capability.blocks.join(", ")}; not blocking stage ${stage}`,
        );
      }
    }
    if (
      capability.status === "deferred" &&
      (capability.security_obligation || !capability.approval_ref || !capability.revisit_condition)
    ) {
      reporter.error(
        fileRel,
        `Invalid deferral: ${capability.id}; security cannot be deferred, other deferrals require approval and revisit condition`,
      );
    }
    if (capability.status === "designed" && (!capability.dependencies.length || !capability.evidence.length)) {
      reporter.error(fileRel, `Designed capability lacks dependencies/evidence: ${capability.id}`);
    }
    if (capability.runtime_status === "verified" && !capability.evidence.length) {
      reporter.error(fileRel, `Runtime verification lacks evidence: ${capability.id}`);
    }
  }
}

function checkPhaseParameter(data, fileRel, r) {
  for (const param of data.params ?? []) {
    if ((param.name === "phase" || param.name === "deployment_phase") && "default" in param) {
      r.error(
        fileRel,
        `params["${param.name}"] must be required with no default: a default deploys every phase when it is omitted and bypasses the per-phase approval gates`,
      );
    }
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

// Applies only to resources that declare `phase`, `consumes` or `target`; contracts without them are unchanged.
function checkPrivatePaths(data, fileRel, r) {
  const resources = new Map((data.resources ?? []).map((res) => [res.logical_name, res]));
  const endpointsByTarget = new Map();
  for (const res of resources.values()) {
    if (res.target === undefined) continue;
    if (res.type !== "Microsoft.Network/privateEndpoints") {
      r.error(fileRel, `resources["${res.logical_name}"].target is only valid on Microsoft.Network/privateEndpoints`);
    } else if (!resources.has(res.target)) {
      r.error(fileRel, `resources["${res.logical_name}"].target "${res.target}" not in resources[]`);
    } else {
      endpointsByTarget.set(res.target, [...(endpointsByTarget.get(res.target) ?? []), res.logical_name]);
    }
  }
  for (const res of resources.values()) {
    for (const dep of res.depends_on ?? []) {
      const earlier = resources.get(dep);
      if (res.phase !== undefined && earlier?.phase !== undefined && earlier.phase > res.phase) {
        r.error(
          fileRel,
          `resources["${res.logical_name}"] (phase ${res.phase}) depends_on "${dep}" in later phase ${earlier.phase}`,
        );
      }
    }
    for (const consumed of res.consumes ?? []) {
      if (consumed === res.logical_name || !resources.has(consumed)) {
        r.error(fileRel, `resources["${res.logical_name}"].consumes "${consumed}" must name another resource`);
        continue;
      }
      const endpoints = endpointsByTarget.get(consumed) ?? [];
      if (endpoints.length > 0 && !endpoints.some((endpoint) => (res.depends_on ?? []).includes(endpoint))) {
        r.error(
          fileRel,
          `resources["${res.logical_name}"] consumes "${consumed}" but does not depends_on its private endpoint (${endpoints.join(", ")}); create the endpoint first`,
        );
      }
    }
  }
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
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes("--help")) {
    console.log(
      "Usage: validate-iac-contract.mjs [artifact-path-or-glob ...] [--readiness] [--stage deploy|post-deploy|go-live]\nNo paths: scan project contracts. Readiness requires capability coverage; it does not grant approval.\n--stage (default deploy): an unresolved capability fails only when its `blocks` list includes that stage or an earlier one.",
    );
    return;
  }
  const readiness = rawArgs.includes("--readiness");
  const stageIndex = rawArgs.indexOf("--stage");
  const stage = stageIndex >= 0 ? rawArgs[stageIndex + 1] : "deploy";
  if (!STAGES.includes(stage)) {
    r.error("--stage", `must be one of ${STAGES.join(", ")}`);
    r.summary();
    r.exitOnError("Invalid --stage");
    return;
  }
  const args = rawArgs.filter(
    (arg, index) => arg !== "--readiness" && arg !== "--stage" && (stageIndex < 0 || index !== stageIndex + 1),
  );
  const patterns = args.length > 0 ? args : defaultGlobs();

  let files = [];
  for (const pat of patterns) {
    const matched = globSync(pat, { cwd: ROOT, absolute: true });
    if (args.length > 0 && matched.length === 0) r.error(pat, "Explicit target matched no files; use an artifact path");
    files = files.concat(matched);
  }
  files = [...new Set(files)];

  if (files.length === 0) {
    r.info("(no 04-iac-contract.json files found)");
    r.summary();
    r.exitOnError("No IaC contracts selected");
    return;
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
    const errorsBefore = r.errors;
    checkUniqueLogicalNames(data, fileRel, r);
    checkModuleRefs(data, fileRel, r);
    checkIdentity(data, fileRel, r);
    checkDiagnosticsParam(data, fileRel, r);
    checkScheduledActions(data, fileRel, r);
    checkCapabilityReadiness(data, fileRel, r, readiness, stage);
    checkPhaseParameter(data, fileRel, r);
    checkDependsOn(data, fileRel, r);
    checkPrivatePaths(data, fileRel, r);
    checkRefHashes(data, fileRel, r);
    if (r.errors === errorsBefore) {
      r.ok(
        fileRel,
        `iac-contract ${data.schema_version} (${data.resources.length} resources, iac_tool=${data.iac_tool})`,
      );
    }
  }

  r.summary();
  r.exitOnError("IaC contract validation passed");
}

main();
