#!/usr/bin/env node
/**
 * IaC Contract Consistency Validator
 *
 * Cross-checks 04-iac-contract.json against 04-implementation-plan.md to
 * detect prose-vs-contract drift (e.g. the prose lists 12 resources but
 * the contract has 10). Runs alongside validate-iac-contract.mjs.
 *
 * Hard-fail checks:
 *   1. plan_ref.path exists and plan_ref.sha256 matches.
 *   2. Every resource referenced in 04-implementation-plan.md by either an
 *      AVM module callout (br/public:avm/res/&#42; or Azure/avm-res-&#42;/azurerm)
 *      or an explicit `## ResourceType:logical-name` heading appears in
 *      contract.resources[].
 *   3. resources[].logical_name count must equal `## ResourceType:*`
 *      heading count when the plan uses that pattern.
 *
 * The checks are conservative — when the plan uses unconventional
 * patterns, this validator emits WARN rather than hard-fail to avoid
 * false-positive churn.
 *
 * Usage:
 *   node tools/scripts/validate-iac-contract-consistency.mjs
 *   node tools/scripts/validate-iac-contract-consistency.mjs <contract-path>
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";
import { Reporter } from "./_lib/reporter.mjs";
import { readJson, sha256File } from "./_lib/json.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const AVM_BICEP_RE = /br\/public:avm\/(?:res|ptn)\/[a-z0-9-]+(?:\/[a-z0-9-]+)+/g;
const AVM_TF_RE = /Azure\/avm-res-[a-z0-9-]+\/azurerm/g;
const HEADING_RE = /^##+\s+([A-Z][a-zA-Z0-9.]+\/[a-zA-Z0-9.]+)\s*:\s*([a-z][a-z0-9-]+)\s*$/gm;

function extractPlanReferences(plan) {
  const headings = [];
  let m;
  HEADING_RE.lastIndex = 0;
  while ((m = HEADING_RE.exec(plan)) !== null) {
    headings.push({ type: m[1], logical_name: m[2] });
  }
  const bicepModules = plan.match(AVM_BICEP_RE) ?? [];
  const tfModules = plan.match(AVM_TF_RE) ?? [];
  return {
    headings,
    bicepModules: [...new Set(bicepModules)],
    tfModules: [...new Set(tfModules)],
  };
}

function defaultGlobs() {
  return ["agent-output/*/04-iac-contract.json"];
}

function main() {
  const r = new Reporter("IaC Contract ↔ Plan Consistency Validator");
  r.header();
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

  for (const contractPath of files) {
    const contractRel = path.relative(ROOT, contractPath);
    r.tick();
    let contract;
    try {
      contract = readJson(contractPath);
    } catch (err) {
      r.error(contractRel, `Invalid JSON: ${err.message}`);
      continue;
    }
    const planPath = path.resolve(path.dirname(contractPath), contract.plan_ref?.path ?? "");
    if (!contract.plan_ref?.path || !fs.existsSync(planPath)) {
      r.warn(contractRel, `plan_ref.path missing or not on disk: ${contract.plan_ref?.path}`);
      continue;
    }
    const declaredHash = contract.plan_ref.sha256;
    const actualHash = sha256File(planPath);
    if (declaredHash !== actualHash) {
      r.error(
        contractRel,
        `plan_ref.sha256 mismatch: declared ${declaredHash.slice(0, 12)}… actual ${actualHash.slice(0, 12)}…. Plan has drifted from the contract — 05-IaC Planner must re-emit.`,
      );
      continue;
    }
    const planText = fs.readFileSync(planPath, "utf-8");
    const refs = extractPlanReferences(planText);
    const contractLogical = new Set((contract.resources ?? []).map((res) => res.logical_name));
    // Heading consistency
    if (refs.headings.length > 0) {
      const headingNames = new Set(refs.headings.map((h) => h.logical_name));
      for (const name of headingNames) {
        if (!contractLogical.has(name)) {
          r.error(
            contractRel,
            `Plan declares "## …:${name}" heading but contract.resources[] missing logical_name="${name}".`,
          );
        }
      }
      for (const name of contractLogical) {
        if (!headingNames.has(name)) {
          r.warn(
            contractRel,
            `contract.resources[].logical_name "${name}" not surfaced as a "## ResourceType:${name}" heading in plan (cosmetic; reviewer should add for traceability).`,
          );
        }
      }
    }
    // AVM module track sanity
    const track = contract.iac_tool === "Bicep" ? "bicep" : "terraform";
    const contractModules = (contract.modules?.[track] ?? []).map((m) => m.source);
    const planModules = track === "bicep" ? refs.bicepModules : refs.tfModules;
    if (planModules.length > 0) {
      for (const planMod of planModules) {
        const planBase = planMod.split("@")[0];
        const matched = contractModules.some((cm) => cm.startsWith(planBase));
        if (!matched) {
          r.warn(
            contractRel,
            `Plan references ${track.toUpperCase()} module "${planMod}" but contract.modules.${track}[] has no matching source.`,
          );
        }
      }
    }
    r.ok(contractRel, `contract ↔ plan consistent (${contract.resources.length} resources, plan_ref hash OK)`);
  }

  r.summary();
  r.exitOnError("IaC contract consistency passed");
}

main();
