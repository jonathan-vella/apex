#!/usr/bin/env node
/**
 * SKU ↔ IaC Coverage Validator
 *
 * Bidirectional cross-check between agent-output/{project}/sku-manifest.json
 * and the matching infra/{bicep|terraform}/{project}/ tree:
 *
 *   A. manifest → IaC: every services[].iac_logical_names.{bicep|terraform}
 *      must appear in the IaC source.
 *   B. IaC → manifest: every effective SKU (explicit literals + AVM defaults
 *      when the consumer doesn't pass an explicit SKU param) must trace back
 *      to a manifest entry — unless the surrounding resource matches the
 *      explicit exclude list (bandwidth, Log Analytics, vnet, subnet, NSG,
 *      route table, public IP, diagnostics).
 *
 * Hard-fail mode: every coverage gap is a build error. Projects predating
 * the manifest can opt out by adding an `.sku-manifest.skip` sentinel file
 * to their agent-output/{project}/ directory; otherwise the missing
 * manifest itself is an error.
 *
 * Diff-aware: when invoked with --diff-mode, only re-validates project
 * trees whose JSON or `infra/` files changed in the working tree.
 *
 * Usage:
 *   node tools/scripts/validate-sku-iac-coverage.mjs
 *   node tools/scripts/validate-sku-iac-coverage.mjs --diff-mode
 *   node tools/scripts/validate-sku-iac-coverage.mjs --project <slug>
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";
import { Reporter } from "./_lib/reporter.mjs";
import { lookupAvmDefault } from "./_lib/avm-default-skus.mjs";
import { readJson } from "./_lib/json.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Out-of-scope resource categories — manifest excludes these, and an
// IaC SKU literal in one of these categories is NOT a coverage gap.
// See .github/instructions/sku-manifest.instructions.md.
const EXCLUDED_RESOURCE_TOKENS = [
  "bandwidth",
  "loganalytics",
  "log_analytics",
  "log-analytics",
  "virtualnetwork",
  "virtual_network",
  "vnet",
  "subnet",
  "networksecuritygroup",
  "network_security_group",
  "nsg",
  "routetable",
  "route_table",
  "publicip",
  "public_ip",
  "diagnosticsetting",
  "diagnostic_setting",
];

function readText(filePath) {
  return fs.readFileSync(filePath, "utf-8");
}

function isExcluded(content) {
  const lower = content.toLowerCase();
  return EXCLUDED_RESOURCE_TOKENS.some((tok) => lower.includes(tok));
}

/**
 * Scan a Bicep file for:
 *   - resource/module symbolic names
 *   - explicit SKU literals (`sku: { name: '...' }`, `skuName: '...'`)
 *   - AVM module invocations + their effective SKU (param override or default)
 */
function scanBicep(filePath) {
  const text = readText(filePath);
  const symbolicNames = new Set();
  const skuLiterals = [];

  const symRe = /^\s*(?:resource|module)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(['"])([^'"]+)\2/gm;
  let m;
  while ((m = symRe.exec(text)) !== null) {
    symbolicNames.add(m[1]);
  }

  // Detect AVM module references and their bodies. Pattern:
  //   module foo 'br/public:avm/res/web/serverfarm:0.4.1' = {
  //     params: { skuName: '...' / sku: { name: '...' } / ... }
  //   }
  const avmModuleRe = /^\s*module\s+([A-Za-z_][A-Za-z0-9_]*)\s+'([^']+)'\s*=\s*\{([\s\S]*?)\n\}/gm;
  while ((m = avmModuleRe.exec(text)) !== null) {
    const [, symbol, moduleRef, body] = m;
    const avm = lookupAvmDefault(moduleRef);
    if (!avm) continue;
    let effective = avm.default_sku;
    let explicit = false;
    for (const param of avm.sku_param_names) {
      const re = new RegExp(`${param}\\s*:\\s*'([^']+)'`);
      const pm = body.match(re);
      if (pm) {
        effective = pm[1];
        explicit = true;
        break;
      }
      const reNested = new RegExp(`${param}\\s*:\\s*\\{\\s*name\\s*:\\s*'([^']+)'`);
      const pm2 = body.match(reNested);
      if (pm2) {
        effective = pm2[1];
        explicit = true;
        break;
      }
    }
    skuLiterals.push({
      sku: effective,
      context: body,
      line: text.slice(0, m.index).split("\n").length,
      source: explicit ? "avm-explicit" : "avm-default",
      module_id: avm.module_id,
      symbol,
    });
  }

  // Direct SKU literals not inside an AVM module.
  const skuRe = /sku\s*:\s*\{\s*name\s*:\s*['"]([^'"]+)['"]|skuName\s*:\s*['"]([^'"]+)['"]/g;
  while ((m = skuRe.exec(text)) !== null) {
    const sku = m[1] || m[2];
    const start = Math.max(0, m.index - 600);
    const end = Math.min(text.length, m.index + 600);
    const context = text.slice(start, end);
    // Skip duplicates already captured via AVM scanning by checking proximity.
    const line = text.slice(0, m.index).split("\n").length;
    const alreadyAvm = skuLiterals.some((l) => Math.abs(l.line - line) < 3 && l.sku === sku);
    if (alreadyAvm) continue;
    skuLiterals.push({ sku, context, line, source: "explicit" });
  }

  return { symbolicNames, skuLiterals };
}

/**
 * Scan a Terraform file the same way: symbolic addresses, SKU literals,
 * and AVM (Azure/avm-res-*) module invocations.
 */
function scanTerraform(filePath) {
  const text = readText(filePath);
  const symbolicNames = new Set();
  const skuLiterals = [];

  const resRe = /^\s*resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/gm;
  let m;
  while ((m = resRe.exec(text)) !== null) {
    symbolicNames.add(`${m[1]}.${m[2]}`);
  }
  const modRe = /^\s*module\s+"([^"]+)"\s*\{([\s\S]*?)^\}/gm;
  const modulesWithBody = [];
  while ((m = modRe.exec(text)) !== null) {
    symbolicNames.add(`module.${m[1]}`);
    modulesWithBody.push({ symbol: `module.${m[1]}`, body: m[2], index: m.index });
  }

  // AVM module SKU resolution (Terraform): look at each module body for
  // a `source = "Azure/avm-res-..."` line and the relevant sku_* arg.
  for (const mod of modulesWithBody) {
    const srcMatch = mod.body.match(/source\s*=\s*"([^"]+)"/);
    if (!srcMatch) continue;
    const avm = lookupAvmDefault(srcMatch[1]);
    if (!avm) continue;
    let effective = avm.default_sku;
    let explicit = false;
    for (const param of avm.sku_param_names) {
      const re = new RegExp(`${param}\\s*=\\s*"([^"]+)"`);
      const pm = mod.body.match(re);
      if (pm) {
        effective = pm[1];
        explicit = true;
        break;
      }
    }
    const line = text.slice(0, mod.index).split("\n").length;
    skuLiterals.push({
      sku: effective,
      context: mod.body,
      line,
      source: explicit ? "avm-explicit" : "avm-default",
      module_id: avm.module_id,
      symbol: mod.symbol,
    });
  }

  // Direct SKU literals not in an AVM module.
  const skuRe = /sku_name\s*=\s*"([^"]+)"|\bsku\s*=\s*"([^"]+)"/g;
  while ((m = skuRe.exec(text)) !== null) {
    const sku = m[1] || m[2];
    const start = Math.max(0, m.index - 600);
    const end = Math.min(text.length, m.index + 600);
    const context = text.slice(start, end);
    const line = text.slice(0, m.index).split("\n").length;
    const alreadyAvm = skuLiterals.some((l) => Math.abs(l.line - line) < 3 && l.sku === sku);
    if (alreadyAvm) continue;
    skuLiterals.push({ sku, context, line, source: "explicit" });
  }

  return { symbolicNames, skuLiterals };
}

function scanInfra(dir) {
  if (!fs.existsSync(dir)) return null;
  const all = {
    symbolicNames: new Set(),
    skuLiterals: [],
    files: [],
  };
  const bicepFiles = globSync("**/*.bicep", { cwd: dir, nodir: true });
  const tfFiles = globSync("**/*.tf", { cwd: dir, nodir: true });
  for (const f of bicepFiles) {
    const abs = path.join(dir, f);
    const { symbolicNames, skuLiterals } = scanBicep(abs);
    for (const n of symbolicNames) all.symbolicNames.add(n);
    for (const lit of skuLiterals) all.skuLiterals.push({ ...lit, file: path.relative(ROOT, abs) });
    all.files.push(path.relative(ROOT, abs));
  }
  for (const f of tfFiles) {
    const abs = path.join(dir, f);
    const { symbolicNames, skuLiterals } = scanTerraform(abs);
    for (const n of symbolicNames) all.symbolicNames.add(n);
    for (const lit of skuLiterals) all.skuLiterals.push({ ...lit, file: path.relative(ROOT, abs) });
    all.files.push(path.relative(ROOT, abs));
  }
  return all;
}

function collectManifestSkus(manifest) {
  const literals = new Set();
  for (const svc of manifest.services ?? []) {
    if (svc.size) literals.add(svc.size);
    for (const env of Object.values(svc.environment_overrides ?? {})) {
      if (env?.size) literals.add(env.size);
    }
  }
  for (const stamp of manifest.stamps ?? []) {
    for (const ov of Object.values(stamp.service_overrides ?? {})) {
      if (ov?.size) literals.add(ov.size);
    }
  }
  return literals;
}

function validateProject(project, r) {
  const projectDir = path.join(ROOT, "agent-output", project);
  const manifestPath = path.join(projectDir, "sku-manifest.json");
  const skipPath = path.join(projectDir, ".sku-manifest.skip");
  const bicepDir = path.join(ROOT, "infra/bicep", project);
  const tfDir = path.join(ROOT, "infra/terraform", project);

  const hasBicep = fs.existsSync(bicepDir);
  const hasTf = fs.existsSync(tfDir);
  if (!hasBicep && !hasTf) {
    r.info(`agent-output/${project}`, "No infra/{bicep|terraform} tree — skipping coverage check");
    return;
  }

  if (!fs.existsSync(manifestPath)) {
    if (fs.existsSync(skipPath)) {
      r.info(
        `agent-output/${project}`,
        "Project predates SKU manifest (.sku-manifest.skip sentinel present) — coverage skipped",
      );
      return;
    }
    r.error(
      `agent-output/${project}`,
      `Missing sku-manifest.json. Add a manifest or place a .sku-manifest.skip sentinel for legacy projects.`,
    );
    return;
  }

  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (err) {
    r.error(`agent-output/${project}/sku-manifest.json`, `Parse failure: ${err.message}`);
    return;
  }

  r.tick();

  const bicepScan = hasBicep ? scanInfra(bicepDir) : null;
  const tfScan = hasTf ? scanInfra(tfDir) : null;

  const manifestBicepNames = new Set();
  const manifestTfNames = new Set();
  for (const svc of manifest.services ?? []) {
    if (svc.iac_logical_names?.bicep) manifestBicepNames.add(svc.iac_logical_names.bicep);
    if (svc.iac_logical_names?.terraform) manifestTfNames.add(svc.iac_logical_names.terraform);
  }
  const manifestSkus = collectManifestSkus(manifest);

  // A. manifest → IaC
  if (hasBicep) {
    for (const name of manifestBicepNames) {
      if (!bicepScan.symbolicNames.has(name)) {
        r.error(
          `agent-output/${project}/sku-manifest.json`,
          `Bicep symbolic name "${name}" referenced in manifest but not found in infra/bicep/${project}/`,
        );
      }
    }
  }
  if (hasTf) {
    for (const addr of manifestTfNames) {
      if (!tfScan.symbolicNames.has(addr)) {
        r.error(
          `agent-output/${project}/sku-manifest.json`,
          `Terraform address "${addr}" referenced in manifest but not found in infra/terraform/${project}/`,
        );
      }
    }
  }

  // B. IaC → manifest (explicit literals + AVM defaults)
  const allLiterals = [...(bicepScan?.skuLiterals ?? []), ...(tfScan?.skuLiterals ?? [])];
  for (const lit of allLiterals) {
    if (manifestSkus.has(lit.sku)) continue;
    if (isExcluded(lit.context)) continue;
    const sourceTag =
      lit.source === "avm-default"
        ? ` (AVM default for ${lit.module_id})`
        : lit.source === "avm-explicit"
          ? ` (AVM-explicit via ${lit.module_id})`
          : "";
    r.error(
      `${lit.file}:${lit.line}`,
      `Effective SKU "${lit.sku}"${sourceTag} has no matching services[].size in sku-manifest.json`,
    );
  }
}

function findProjects() {
  const out = new Set();
  for (const p of globSync("agent-output/*/sku-manifest.json", { cwd: ROOT, nodir: true })) {
    out.add(p.split("/")[1]);
  }
  for (const p of globSync("infra/bicep/*", { cwd: ROOT })) {
    const project = p.split("/")[2];
    if (project && project !== "AGENTS.md") out.add(project);
  }
  for (const p of globSync("infra/terraform/*", { cwd: ROOT })) {
    const project = p.split("/")[2];
    if (project && project !== "AGENTS.md") out.add(project);
  }
  return [...out];
}

function diffModeProjects() {
  let changed;
  try {
    changed = execSync("git diff --name-only HEAD 2>/dev/null", { cwd: ROOT }).toString();
    if (!changed.trim()) {
      changed = execSync("git diff --name-only origin/main...HEAD 2>/dev/null", { cwd: ROOT }).toString();
    }
  } catch {
    return null;
  }
  const lines = changed.split("\n").filter(Boolean);
  const projects = new Set();
  for (const f of lines) {
    let m = f.match(/^agent-output\/([^/]+)\/sku-manifest\.json$/);
    if (m) projects.add(m[1]);
    m = f.match(/^infra\/(bicep|terraform)\/([^/]+)\//);
    if (m) projects.add(m[2]);
  }
  return [...projects];
}

function main() {
  const r = new Reporter("SKU ↔ IaC Coverage Validator");
  r.header();

  const args = process.argv.slice(2);
  const projectIdx = args.indexOf("--project");
  const diffMode = args.includes("--diff-mode");

  let targets;
  if (projectIdx !== -1) {
    targets = [args[projectIdx + 1]];
  } else if (diffMode) {
    targets = diffModeProjects();
    if (targets === null) {
      console.log("  ℹ️  Diff-mode: git diff unavailable — skipping (treated as success).");
      r.exitOnError();
      return;
    }
    if (targets.length === 0) {
      console.log("  ℹ️  Diff-mode: no manifest or infra changes in diff — skipping.");
      r.exitOnError();
      return;
    }
  } else {
    targets = findProjects();
  }

  if (targets.length === 0) {
    console.log("  ℹ️  No projects found — nothing to validate.");
    r.exitOnError();
    return;
  }

  for (const project of targets) {
    validateProject(project, r);
  }

  r.summary();
  r.exitOnError();
}

main();
