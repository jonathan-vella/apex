#!/usr/bin/env node
/**
 * AVM Module Version Validator
 *
 * Reinforces the "always use the latest published AVM module version" rule
 * (addresses Nordic Step 5 preflight blocker where the frozen Step 4 contract
 * pinned unpublished AVM modules).
 *
 * Dual scan:
 *   1. Contract scan — agent-output/*\/04-iac-contract.json
 *      modules.bicep[] and modules.terraform[] entries
 *   2. Source scan   — infra/bicep/**\/*.bicep and infra/terraform/**\/*.tf
 *      direct module declarations and AVM-TF version constraints
 *
 * Resolver pipeline (see _lib/avm-module-resolver.mjs):
 *   live registry (MCR for Bicep, registry.terraform.io for Terraform)
 *     → checked-in cache (tools/scripts/_data/avm-module-cache.json)
 *
 * Modes:
 *   --mode=local   default; cache fallback allowed; warnings only when offline.
 *   --mode=ci      fail closed when both live and fresh cache are missing.
 *   --mode=freeze  same as ci; used by 05-IaC Planner before contract freeze.
 *
 * Result categories (machine-readable):
 *   ok, stale_justified, stale_unjustified, missing_version, prerelease_ignored,
 *   lookup_unavailable, source_unclassified.
 *
 * Exception escape hatch (addresses must-fix avm-002):
 *   contract.modules.{bicep,terraform}[].pin_policy = {
 *     mode: "latest" | "exception",
 *     latest_seen, lookup_source, lookup_timestamp,
 *     rationale, evidence_url_or_file, review_after, approved_by_step
 *   }
 *
 * Usage:
 *   node tools/scripts/validate-avm-module-versions.mjs
 *   node tools/scripts/validate-avm-module-versions.mjs --mode=ci
 *   node tools/scripts/validate-avm-module-versions.mjs --mode=freeze agent-output/nordic/04-iac-contract.json
 *   node tools/scripts/validate-avm-module-versions.mjs --no-network
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";
import { Reporter } from "./_lib/reporter.mjs";
import { resolveLatest, classifyPin, evaluatePinPolicy } from "./_lib/avm-module-resolver.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const BICEP_MODULE_RE =
  /(['"])?(br\/public:avm\/(?:res|ptn)\/[a-z0-9-]+(?:\/[a-z0-9-]+)+):(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)\1?/gi;
const TF_SOURCE_RE = /source\s*=\s*"(Azure\/avm-(?:res|ptn)-[a-z0-9-]+\/azurerm)"/gi;
const TF_VERSION_RE = /version\s*=\s*"([^"]+)"/i;

function parseArgs(argv) {
  const opts = {
    mode: "local",
    allowNetwork: true,
    paths: [],
  };
  for (const arg of argv) {
    if (arg === "--no-network") opts.allowNetwork = false;
    else if (arg.startsWith("--mode=")) opts.mode = arg.slice("--mode=".length);
    else if (!arg.startsWith("--")) opts.paths.push(arg);
  }
  if (!["local", "ci", "freeze"].includes(opts.mode)) {
    throw new Error(`--mode must be local|ci|freeze (got ${opts.mode})`);
  }
  return opts;
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    return { __error: err.message };
  }
}

/**
 * Iterate a contract's bicep[] and terraform[] entries.
 */
function* enumerateContractModules(contract) {
  for (const tool of ["bicep", "terraform"]) {
    const list = contract.modules?.[tool] ?? [];
    for (let i = 0; i < list.length; i++) {
      yield { tool, idx: i, mod: list[i] };
    }
  }
}

async function scanContract(r, opts, contractPath) {
  const rel = path.relative(ROOT, contractPath);
  r.tick();
  const contract = readJsonSafe(contractPath);
  if (contract.__error) {
    r.error(rel, `Invalid JSON: ${contract.__error}`);
    return;
  }
  if (!contract.modules) {
    r.info(rel, "No modules block — skipping.");
    return;
  }
  for (const { tool, mod } of enumerateContractModules(contract)) {
    const pinned = mod.version;
    const source = mod.source;
    const resolved = await resolveLatest({
      tool,
      source,
      mode: opts.mode,
      allowNetwork: opts.allowNetwork,
    });
    const cls = classifyPin({ pinned, resolved });
    const where = `${rel} → modules.${tool}[].source=${source}`;
    if (cls.result === "ok") {
      r.ok(where, `pinned ${pinned} matches latest stable (source: ${resolved.source}).`);
      continue;
    }
    if (cls.result === "prerelease_ignored") {
      r.info(where, cls.message);
      continue;
    }
    if (cls.result === "stale") {
      const policy = evaluatePinPolicy(mod.pin_policy, pinned);
      if (policy.accepted) {
        r.ok(where, `stale pin accepted (${cls.message}; ${policy.reason}).`);
      } else {
        r.error(where, `stale_unjustified: ${cls.message} ${policy.reason}`);
      }
      continue;
    }
    if (cls.result === "missing_version") {
      r.error(where, `missing_version: ${cls.message}`);
      continue;
    }
    if (cls.result === "lookup_unavailable") {
      if (opts.mode === "ci" || opts.mode === "freeze") {
        r.error(where, `lookup_unavailable in ${opts.mode} mode: ${cls.message}`);
      } else {
        r.warn(where, `lookup_unavailable: ${cls.message}`);
      }
      continue;
    }
    if (cls.result === "source_unclassified") {
      if (opts.mode === "ci" || opts.mode === "freeze") {
        r.error(where, `source_unclassified: ${cls.message}`);
      } else {
        r.warn(where, `source_unclassified: ${cls.message}`);
      }
      continue;
    }
    r.warn(where, `unrecognized classification "${cls.result}": ${cls.message}`);
  }
}

async function scanBicepFile(r, opts, filePath) {
  const rel = path.relative(ROOT, filePath);
  r.tick();
  const text = fs.readFileSync(filePath, "utf-8");
  const seen = new Set();
  let m;
  BICEP_MODULE_RE.lastIndex = 0;
  while ((m = BICEP_MODULE_RE.exec(text)) !== null) {
    const source = m[2];
    const pinned = m[3];
    const key = `${source}:${pinned}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const resolved = await resolveLatest({
      tool: "bicep",
      source,
      mode: opts.mode,
      allowNetwork: opts.allowNetwork,
    });
    const cls = classifyPin({ pinned, resolved });
    const where = `${rel} → ${source}:${pinned}`;
    if (cls.result === "ok" || cls.result === "prerelease_ignored") {
      r.ok(where, cls.message);
    } else if (cls.result === "missing_version") {
      r.error(where, `missing_version: ${cls.message}`);
    } else if (cls.result === "stale") {
      // source-scan can't read pin_policy (lives in contract); emit warn,
      // contract scan is authoritative for justification.
      r.warn(where, `stale source pin: ${cls.message} (contract pin_policy must justify).`);
    } else if (cls.result === "lookup_unavailable") {
      if (opts.mode === "ci" || opts.mode === "freeze") {
        r.error(where, cls.message);
      } else {
        r.warn(where, cls.message);
      }
    } else {
      r.warn(where, `${cls.result}: ${cls.message}`);
    }
  }
}

async function scanTerraformFile(r, opts, filePath) {
  const rel = path.relative(ROOT, filePath);
  r.tick();
  const text = fs.readFileSync(filePath, "utf-8");
  const seen = new Set();
  // crude block-level walk: find each `module "x" { ... }` block and check
  // whether it has both an Azure/avm-*/azurerm source and a version constraint
  const blockRe = /module\s+"[^"]+"\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const body = m[1];
    TF_SOURCE_RE.lastIndex = 0;
    const sourceMatch = TF_SOURCE_RE.exec(body);
    if (!sourceMatch) continue;
    const source = sourceMatch[1];
    const versionMatch = TF_VERSION_RE.exec(body);
    if (!versionMatch) {
      r.warn(`${rel} → ${source}`, `Terraform module has no version pin.`);
      continue;
    }
    const rawVersion = versionMatch[1].trim();
    const where = `${rel} → ${source}@${rawVersion}`;
    if (seen.has(where)) continue;
    seen.add(where);

    // Range constraints — Terraform allows `~> 0.5`, `>= 1.2.0`, etc.
    // For source-scan we flag any constraint that is NOT an exact semver.
    const exact = /^\d+\.\d+\.\d+$/.test(rawVersion);
    if (!exact) {
      r.warn(
        where,
        `Terraform AVM-TF module uses range constraint "${rawVersion}"; contracts require exact semver. Source-scan cannot resolve to a single version.`,
      );
      continue;
    }
    const resolved = await resolveLatest({
      tool: "terraform",
      source,
      mode: opts.mode,
      allowNetwork: opts.allowNetwork,
    });
    const cls = classifyPin({ pinned: rawVersion, resolved });
    if (cls.result === "ok" || cls.result === "prerelease_ignored") {
      r.ok(where, cls.message);
    } else if (cls.result === "missing_version") {
      r.error(where, `missing_version: ${cls.message}`);
    } else if (cls.result === "stale") {
      r.warn(where, `stale source pin: ${cls.message} (contract pin_policy must justify).`);
    } else if (cls.result === "lookup_unavailable") {
      if (opts.mode === "ci" || opts.mode === "freeze") {
        r.error(where, cls.message);
      } else {
        r.warn(where, cls.message);
      }
    } else {
      r.warn(where, `${cls.result}: ${cls.message}`);
    }
  }
}

async function main() {
  const r = new Reporter("AVM Module Version Validator");
  r.header();

  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    r.error("args", err.message);
    r.summary();
    process.exit(1);
  }

  // Collect target files
  let contractPaths;
  let bicepPaths;
  let tfPaths;

  if (opts.paths.length > 0) {
    contractPaths = opts.paths
      .filter((p) => p.endsWith(".json"))
      .map((p) => path.resolve(ROOT, p))
      .filter((p) => fs.existsSync(p));
    bicepPaths = opts.paths
      .filter((p) => p.endsWith(".bicep"))
      .map((p) => path.resolve(ROOT, p))
      .filter((p) => fs.existsSync(p));
    tfPaths = opts.paths
      .filter((p) => p.endsWith(".tf"))
      .map((p) => path.resolve(ROOT, p))
      .filter((p) => fs.existsSync(p));
  } else {
    contractPaths = globSync("agent-output/*/04-iac-contract.json", {
      cwd: ROOT,
      absolute: true,
    });
    bicepPaths = globSync("infra/bicep/**/*.bicep", { cwd: ROOT, absolute: true });
    tfPaths = globSync("infra/terraform/**/*.tf", { cwd: ROOT, absolute: true });
  }

  if (contractPaths.length === 0 && bicepPaths.length === 0 && tfPaths.length === 0) {
    r.info("(no AVM module references found)");
    r.summary();
    process.exit(0);
  }

  console.log(`  Mode: ${opts.mode} | Network: ${opts.allowNetwork ? "on" : "off"}`);
  console.log(
    `  Contracts: ${contractPaths.length} | Bicep files: ${bicepPaths.length} | Terraform files: ${tfPaths.length}\n`,
  );

  for (const p of contractPaths) await scanContract(r, opts, p);
  for (const p of bicepPaths) await scanBicepFile(r, opts, p);
  for (const p of tfPaths) await scanTerraformFile(r, opts, p);

  r.summary();
  r.exitOnError(
    "AVM module version validator passed",
    `${r.errors} unresolved AVM version issue(s) — see entries above`,
  );
}

main().catch((err) => {
  console.error("\n💥 Validator crashed:", err);
  process.exit(2);
});
