#!/usr/bin/env node
/**
 * Derive a normalized SKU allowlist projection from
 * agent-output/{project}/04-governance-constraints.json and patch it into
 * agent-output/{project}/sku-manifest.json `sku_allowlist_snapshot`.
 *
 * Invoked by 04g-Governance at the end of Phase 2 once findings are
 * persisted. Reading the governance JSON keeps the projection
 * deterministic and version-controlled instead of re-deriving from
 * Azure Policy at every consumer.
 *
 * Translation rules:
 *   - Policy findings whose `azurePropertyPath` ends in `.sku.name`,
 *     `.skuName`, `.sku`, `.sku_name`, or `.vmSize` describe SKU
 *     restrictions.
 *   - `effect: "deny"` with an enumerated `required_value` (array of
 *     allowed values) becomes `allowed_skus[<service>]`.
 *   - `effect: "deny"` with `required_value.notIn` (explicit deny list)
 *     becomes `denied_skus[<service>]`.
 *   - `resource_types[]` map to canonical service names via the table
 *     below; unknown types are skipped (logged ℹ️).
 *
 * Idempotent: when the manifest's existing snapshot matches the derived
 * projection (same source, allowed_skus, denied_skus), the file is not
 * rewritten.
 *
 * Usage:
 *   node tools/scripts/derive-sku-allowlist.mjs <project>
 *   node tools/scripts/derive-sku-allowlist.mjs --all
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SKU_PATH_SUFFIXES = [".sku.name", ".skuName", ".sku_name", ".vmSize"];
// `.sku` alone is ambiguous (object vs string); accept it only when
// `required_value` is a primitive list of strings.

// Map of Azure resource type → canonical service name used in the
// manifest's services[].service field.
const RESOURCE_TYPE_TO_SERVICE = {
  "Microsoft.Web/serverFarms": "App Service Plan",
  "Microsoft.Web/sites": "App Service",
  "Microsoft.Storage/storageAccounts": "Storage Account",
  "Microsoft.Sql/servers/databases": "SQL Database",
  "Microsoft.Sql/servers": "SQL Server",
  "Microsoft.DocumentDB/databaseAccounts": "Cosmos DB",
  "Microsoft.Cache/Redis": "Redis Cache",
  "Microsoft.ApiManagement/service": "API Management",
  "Microsoft.Network/applicationGateways": "Application Gateway",
  "Microsoft.ContainerService/managedClusters": "AKS Cluster",
  "Microsoft.Compute/virtualMachines": "Virtual Machine",
  "Microsoft.Compute/virtualMachineScaleSets": "VM Scale Set",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, `${JSON.stringify(obj, null, 2)}\n`);
}

function isSkuRestrictionPath(p) {
  if (!p) return false;
  return SKU_PATH_SUFFIXES.some((suf) => p.endsWith(suf));
}

function toStringList(value) {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  if (value && typeof value === "object" && Array.isArray(value.in)) {
    return value.in.filter((v) => typeof v === "string");
  }
  return null;
}

function toNotInList(value) {
  if (value && typeof value === "object" && Array.isArray(value.notIn)) {
    return value.notIn.filter((v) => typeof v === "string");
  }
  return null;
}

function deriveProjection(governance) {
  const allowed = {};
  const denied = {};
  let touched = 0;

  for (const f of governance.findings ?? []) {
    if (f.effect !== "deny") continue;
    if (!isSkuRestrictionPath(f.azurePropertyPath)) continue;

    const types = Array.isArray(f.resource_types) ? f.resource_types : [];
    const services = types.map((t) => RESOURCE_TYPE_TO_SERVICE[t]).filter(Boolean);
    if (services.length === 0) continue;

    const allowList = toStringList(f.required_value);
    const denyList = toNotInList(f.required_value);

    for (const svc of services) {
      if (allowList) {
        allowed[svc] = Array.from(new Set([...(allowed[svc] ?? []), ...allowList]));
        touched++;
      }
      if (denyList) {
        denied[svc] = Array.from(new Set([...(denied[svc] ?? []), ...denyList]));
        touched++;
      }
    }
  }

  if (touched === 0) return null;

  return {
    discovered_at: governance.discovered_at ?? new Date().toISOString(),
    source: "04-governance-constraints.json",
    ...(Object.keys(allowed).length > 0 ? { allowed_skus: allowed } : { allowed_skus: {} }),
    ...(Object.keys(denied).length > 0 ? { denied_skus: denied } : {}),
  };
}

function snapshotsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function processProject(project) {
  const governancePath = path.join(ROOT, "agent-output", project, "04-governance-constraints.json");
  const manifestPath = path.join(ROOT, "agent-output", project, "sku-manifest.json");

  if (!fs.existsSync(governancePath)) {
    console.log(`  ℹ️  ${project}: no 04-governance-constraints.json — nothing to derive`);
    return 0;
  }
  if (!fs.existsSync(manifestPath)) {
    console.log(`  ℹ️  ${project}: no sku-manifest.json — cannot patch projection`);
    return 0;
  }

  const governance = readJson(governancePath);
  const manifest = readJson(manifestPath);
  const projection = deriveProjection(governance);

  if (projection === null) {
    if (manifest.sku_allowlist_snapshot) {
      delete manifest.sku_allowlist_snapshot;
      writeJson(manifestPath, manifest);
      console.log(`  ✓ ${project}: cleared sku_allowlist_snapshot (no SKU-restriction policies found)`);
      return 1;
    }
    console.log(`  ℹ️  ${project}: no SKU-restriction policies — snapshot omitted`);
    return 0;
  }

  if (manifest.sku_allowlist_snapshot && snapshotsEqual(manifest.sku_allowlist_snapshot, projection)) {
    console.log(`  ℹ️  ${project}: sku_allowlist_snapshot already up-to-date`);
    return 0;
  }

  manifest.sku_allowlist_snapshot = projection;
  manifest.updated_at = new Date().toISOString();
  writeJson(manifestPath, manifest);
  const allowedCount = Object.keys(projection.allowed_skus ?? {}).length;
  const deniedCount = Object.keys(projection.denied_skus ?? {}).length;
  console.log(
    `  ✓ ${project}: wrote sku_allowlist_snapshot (allowed services: ${allowedCount}, denied services: ${deniedCount})`,
  );
  return 1;
}

function main() {
  const args = process.argv.slice(2);
  console.log("\n🔧 SKU Allowlist Derivation\n");

  let projects;
  if (args.includes("--all")) {
    projects = globSync("agent-output/*/04-governance-constraints.json", {
      cwd: ROOT,
      nodir: true,
    }).map((p) => p.split("/")[1]);
  } else if (args[0]) {
    projects = [args[0]];
  } else {
    console.error("Usage: node tools/scripts/derive-sku-allowlist.mjs <project> | --all");
    process.exit(2);
  }

  if (projects.length === 0) {
    console.log("  ℹ️  No projects to process.");
    process.exit(0);
  }

  let mutated = 0;
  for (const project of projects) {
    mutated += processProject(project);
  }
  console.log(`\nDone. ${mutated} manifest(s) updated.`);
}

main();
