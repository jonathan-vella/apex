#!/usr/bin/env node
/**
 * validate-decision-keys.mjs
 *
 * Greps every .agent.md file under .github/agents/ for
 * `apex-recall decide --key <name>` patterns and asserts that each
 * <name> is registered in tools/apex-recall/docs/decision-keys.md.
 *
 * Phase I1 of the nordic-foods lessons plan. Prevents silent typos in
 * decision keys (the historical failure mode where a typo never reads
 * back and the gate it controls silently no-ops).
 *
 * Also (Phase B of the VNet Planning Gate plan): validates any project's
 * `decisions.subnet_plan` against `tools/schemas/subnet-plan.schema.json`
 * and emits a soft warning when the VNet trigger contract holds (a
 * vnet-attached `service_name` is present in `sku-manifest.json` or a
 * `requires[] ∈ {vnet-integration, private-endpoints}` token appears)
 * but `decisions.subnet_plan` is absent.
 *
 * Usage:
 *   node tools/scripts/validate-decision-keys.mjs
 *
 * Exit codes:
 *   0 — all keys valid (schema errors are hard; missing subnet_plan is a WARN)
 *   1 — at least one unregistered key found OR a schema violation
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AGENTS_DIR = path.join(ROOT, ".github/agents");
const REGISTRY = path.join(ROOT, "tools/apex-recall/docs/decision-keys.md");
const SUBNET_PLAN_SCHEMA = path.join(ROOT, "tools/schemas/subnet-plan.schema.json");
const VNET_PLANNING_REF = path.join(ROOT, ".github/skills/azure-defaults/references/vnet-planning.md");

const VNET_REQUIRES_TOKENS = new Set(["vnet-integration", "private-endpoints"]);

function parseRegistry() {
  if (!fs.existsSync(REGISTRY)) {
    console.error(`[validate-decision-keys] registry missing: ${REGISTRY}`);
    process.exit(1);
  }
  const text = fs.readFileSync(REGISTRY, "utf-8");
  const keys = new Set();
  // Each registered key appears as the first column of a pipe-delimited
  // table row, wrapped in backticks: `| \`key_name\` |`. Extract.
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .slice(1, -1);
    if (cells.length < 2) continue;
    const first = cells[0];
    // Skip header and separator rows
    if (!first.startsWith("`")) continue;
    const m = first.match(/^`([^`]+)`$/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (name.endsWith(".agent.md")) {
      out.push(full);
    }
  }
  return out;
}

function extractKeyUsages(text) {
  // Matches:  apex-recall decide ... --key <name>
  // Captures any non-whitespace token after --key (until end-of-arg).
  const usages = [];
  const re = /apex-recall\s+decide[^\n]*--key\s+([A-Za-z0-9_\-<>{}]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const key = m[1];
    // Allow agents to use placeholders like <k>, <key>, ${k}, or the
    // literal `<key>` from documentation — these are template forms,
    // not real key usages. Skip them.
    if (/^[<{].*[>}]$/.test(key)) continue;
    if (key === "k" || key === "key") continue;
    usages.push(key);
  }
  return usages;
}

/**
 * Load the vnet-attached service whitelist from the canonical fenced
 * ```yaml``` block under `## vnet-attached service whitelist` in
 * vnet-planning.md. Single source of truth (S2-A); we do NOT
 * redeclare the list here.
 */
function loadVnetAttachedWhitelist() {
  if (!fs.existsSync(VNET_PLANNING_REF)) return null;
  const text = fs.readFileSync(VNET_PLANNING_REF, "utf-8");
  const heading = "## vnet-attached service whitelist";
  const idx = text.indexOf(heading);
  if (idx < 0) return null;
  const rest = text.slice(idx);
  const fence = rest.match(/```ya?ml\n([\s\S]*?)\n```/);
  if (!fence) return null;
  const services = [];
  for (const line of fence[1].split("\n")) {
    const m = line.match(/^\s*-\s+([A-Za-z0-9_-]+)\s*$/);
    if (m) services.push(m[1]);
  }
  return services.length > 0 ? new Set(services) : null;
}

/**
 * Walk every `agent-output/<project>/00-session-state.json` plus the
 * sibling `sku-manifest.json` and:
 *   - hard-fail when decisions.subnet_plan violates the schema
 *   - soft-warn when trigger contract holds but subnet_plan is absent
 */
function validateProjectSubnetPlans() {
  if (!fs.existsSync(SUBNET_PLAN_SCHEMA)) {
    console.error(`❌ subnet-plan schema missing: ${path.relative(ROOT, SUBNET_PLAN_SCHEMA)}`);
    return { errors: 1, warnings: 0 };
  }

  const schema = JSON.parse(fs.readFileSync(SUBNET_PLAN_SCHEMA, "utf-8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  const whitelist = loadVnetAttachedWhitelist();
  if (!whitelist) {
    console.warn(
      `⚠️  Could not parse vnet-attached service whitelist from ${path.relative(ROOT, VNET_PLANNING_REF)} — skipping trigger-contract warnings`,
    );
  }

  let errors = 0;
  let warnings = 0;

  const states = globSync("agent-output/*/00-session-state.json", { cwd: ROOT });
  for (const rel of states) {
    const stateAbs = path.join(ROOT, rel);
    let state;
    try {
      state = JSON.parse(fs.readFileSync(stateAbs, "utf-8"));
    } catch {
      continue; // not our problem — validate-session-state.mjs catches malformed JSON
    }

    const decisions = state?.decisions ?? {};
    const subnetPlan = decisions.subnet_plan;

    // Schema-validate when present.
    if (subnetPlan !== undefined) {
      let parsed = subnetPlan;
      if (typeof subnetPlan === "string") {
        try {
          parsed = JSON.parse(subnetPlan);
        } catch (e) {
          console.error(`❌ ${rel}: decisions.subnet_plan is a string but not valid JSON (${e.message})`);
          errors++;
          continue;
        }
      }
      if (!validate(parsed)) {
        for (const err of validate.errors ?? []) {
          console.error(`❌ ${rel}: decisions.subnet_plan${err.instancePath || ""} ${err.message}`);
          errors++;
        }
      }
    }

    // Trigger-contract warning when subnet_plan absent.
    if (subnetPlan === undefined && whitelist) {
      const projectDir = path.dirname(stateAbs);
      const manifestPath = path.join(projectDir, "sku-manifest.json");
      if (!fs.existsSync(manifestPath)) continue;
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      } catch {
        continue;
      }
      const services = Array.isArray(manifest?.services) ? manifest.services : [];
      const triggered = services.some((svc) => {
        if (whitelist.has(svc?.service_name)) return true;
        if (Array.isArray(svc?.requires)) {
          return svc.requires.some((token) => VNET_REQUIRES_TOKENS.has(token));
        }
        return false;
      });
      if (triggered) {
        // Only warn once the project has moved past Step 2 — in-flight
        // projects at Step 1 haven't run the gate yet.
        const currentStep = state?.current_step ?? 0;
        if (currentStep >= 2) {
          console.warn(
            `⚠️  ${rel}: VNet trigger contract holds (vnet-attached service or requires[] token in sku-manifest.json) but decisions.subnet_plan is absent — Architect Phase 6b may have been skipped`,
          );
          warnings++;
        }
      }
    }
  }

  return { errors, warnings };
}

function main() {
  const registry = parseRegistry();
  console.log(`[validate-decision-keys] registry: ${registry.size} canonical key(s)`);

  const files = walk(AGENTS_DIR);
  let errors = 0;
  const seen = new Set();
  for (const f of files) {
    const text = fs.readFileSync(f, "utf-8");
    const usages = extractKeyUsages(text);
    for (const key of usages) {
      seen.add(key);
      if (!registry.has(key)) {
        console.error(`❌ ${path.relative(ROOT, f)}: unregistered decision key --key ${key}`);
        errors++;
      }
    }
  }
  console.log(`[validate-decision-keys] scanned ${files.length} agent file(s), saw ${seen.size} distinct key(s)`);

  // VNet planning gate — schema validate decisions.subnet_plan per project
  // and warn when the trigger contract holds but the key is absent.
  const projectResult = validateProjectSubnetPlans();
  errors += projectResult.errors;
  if (projectResult.warnings > 0) {
    console.log(`[validate-decision-keys] ${projectResult.warnings} subnet_plan warning(s) emitted`);
  }

  if (errors > 0) {
    console.error(`\n❌ ${errors} unregistered decision-key reference(s) or schema violation(s).`);
    console.error(`   Add the key to tools/apex-recall/docs/decision-keys.md or fix the typo.`);
    console.error(
      `   For schema violations in decisions.subnet_plan, fix the value to conform to tools/schemas/subnet-plan.schema.json.`,
    );
    process.exit(1);
  }
  console.log("✅ all decision-key references are registered");
  return 0;
}

main();
