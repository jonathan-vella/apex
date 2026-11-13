#!/usr/bin/env node
/**
 * Deterministic cost-estimate preflight, calculation, validation, and atomic
 * publication helper for `cost-estimate-subagent`.
 *
 * Replaces ad-hoc `node -e` shell validation/rename commands (which hit Bash
 * history expansion when containing `!identifier` inside double quotes) and
 * supports full-scope `manifest_path` runs with `supplemental_resources[]`.
 */

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { isLayoutV2, projectDirFromPath, resolveContractPath, resolveProjectFile } from "./_lib/project-paths.mjs";
import { retailQueryUrl, validateFailure, validateNextPageLink, validatePage } from "./fetch-retail-price-evidence.mjs";
import {
  assertSnapshots,
  captureMcpResponse,
  decodePricingResponse,
  digestObject,
  METER_FIELDS,
  normalizeMeter,
  readSnapshot,
  reserveQuery,
  safePath,
  sha256,
  stableJson,
  updateAttempt,
  writeExclusive,
  verifyCapturedFailure,
  rawPageBytes,
  acquirePricingLock,
  releasePricingLock,
  evidenceDirectory,
  resolvePricingWorkspacePath,
  withLedger,
} from "./_lib/pricing-evidence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RENDERER = path.join(ROOT, "tools/scripts/render-sku-manifest-md.mjs");
const MAX_SHARED_REQUESTS = 20;
const PORTFOLIO_SHARED_REQUESTS = 60;
const HOURS_PER_MONTH = 730;
const DAYS_PER_MONTH = 365 / 12;

function maxRequestsFor(obj) {
  return obj?.budget_tier === "portfolio" ? PORTFOLIO_SHARED_REQUESTS : MAX_SHARED_REQUESTS;
}

const ALLOWED_DATA_SOURCES = new Set([
  "Azure MCP pricing_get",
  "Azure MCP pricing_get + Azure Retail Prices API (direct fallback)",
  "Azure Retail Prices API (direct fallback)",
]);

const VARIABLE_SERVICE_NAMES = new Set(["Key Vault", "Log Analytics", "Azure DNS"]);

function serviceRecipe(line) {
  const service = String(line.service_name)
    .toLowerCase()
    .replace(/^azure /, "");
  if (service === "managed disks" || /managed disks/i.test(line.product_name ?? "")) return null;
  if (/^(bandwidth|data transfer)$/.test(service)) return ["egress_gb"];
  if (
    /^(private link|private endpoint|private endpoints|virtual network private link)$/.test(service) ||
    (service === "virtual network" &&
      /private (link|endpoint)/i.test(`${line.product_name ?? ""} ${line.meter_name ?? ""}`))
  )
    return ["hours", "ingress_gb", "egress_gb"];
  if (service === "virtual network" && /peering/i.test(`${line.product_name ?? ""} ${line.meter_name ?? ""}`))
    return ["ingress_gb", "egress_gb"];
  if (/^(storage|storage account|storage accounts)$/.test(service)) {
    return /\bhot\b/i.test(line.sku ?? "")
      ? ["capacity_gb", "read_operations", "write_operations"]
      : ["capacity_gb", "read_operations", "write_operations", "egress_gb"];
  }
  if (/cosmos/.test(service))
    return /serverless/i.test(line.sku) ? ["request_units", "storage_gb"] : ["provisioned_ru", "storage_gb"];
  if (service === "nat gateway") return ["hours", "processed_gb"];
  if (service === "firewall") return ["hours", "processed_gb"];
  if (service === "application gateway") return ["hours", "capacity_units"];
  if (/^(?:database for )?(?:postgresql|mysql)$/.test(service)) return ["hours", "storage_gb"];
  if (service === "service bus") {
    if (/\bpremium\b/i.test(line.sku)) return null;
    if (/\bstandard\b/i.test(line.sku)) return ["hours", "operations"];
    if (/\bbasic\b/i.test(line.sku)) return ["operations"];
    return undefined;
  }
  if (service === "container apps") {
    if (/consumption|standard/i.test(line.sku)) return ["vcpu_seconds", "gib_seconds", "requests"];
    if (/\b(?:dedicated|d\d+|e\d+)\b/i.test(line.sku)) return null;
    return undefined;
  }
  if (service === "site recovery") return ["protected_instances"];
  if (service === "backup") return ["protected_instances", "vault_storage_gb"];
  if (/^(vpn gateway|virtual network gateways?)$/.test(service)) return null;
  if (service === "expressroute") return /gateway/i.test(line.product_name ?? "") ? null : ["circuits"];
  if (/^(cloud hsm|payment hsm|microsoft azure payment hsm)$/.test(service)) return null;
  if (service === "load balancer") return ["hours"];
  if (/^(email|communication services email)$/.test(service)) return ["emails"];
  if (service === "data factory") return ["activity_runs", "diu_hours"];
  if (/^(synapse analytics|microsoft fabric)$/.test(service)) return null;
  if (service === "virtual machines licenses") return null;
  if (service === "virtual network") return undefined;
  if (/^(front door|front door service)$/.test(service)) return ["hours", "requests", "egress_gb"];
  if (/^(foundry models|openai|cognitive services)$/.test(service)) return ["input_tokens", "output_tokens"];
  if (service === "dns") return ["zones", "queries"];
  if (service === "sql database" && /serverless/i.test(line.sku)) return ["vcore_seconds", "storage_gb"];
  if (service === "key vault" && /hsm pool/i.test(line.product_name ?? "")) return null;
  if (/^(key vault|log analytics|monitor)$/.test(service)) return [];
  if (
    /^(app service|virtual machines?|sql database|sql managed instance|bastion|container registry|managed redis|redis cache|cache for redis)$/.test(
      service,
    )
  )
    return null;
  return undefined;
}

function validateBillableDimensions(line, purpose) {
  if (purpose === "rate-quote") {
    if (!String(line.service_name ?? "").trim()) return [`${line.name}: service_name is required`];
    return typeof line.meter_applicability === "string" &&
      line.meter_applicability.trim() &&
      typeof line.native_unit === "string" &&
      line.native_unit.trim()
      ? []
      : [`${line.name}: rate-quote requires meter_applicability and native_unit, not guessed monthly usage`];
  }
  const recipe = serviceRecipe(line);
  if (recipe === undefined) return [`${line.name}: unsupported service recipe; explicit billing-input gap`];
  const errors = validateUsageEntry(line.name, line.service_name, line.sku, line.usage);
  if (!recipe?.length) return errors;
  const usage = Array.isArray(line.usage) ? line.usage : [line.usage];
  for (const dimension of recipe) {
    const item = usage.find((entry) => entry?.dimension === dimension || Object.hasOwn(entry ?? {}, dimension));
    const value = item?.dimension === dimension ? item.amount : item?.[dimension];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      (value === 0 && item?.zero_usage_confirmed !== true)
    )
      errors.push(`${line.name}: requires known billable dimension '${dimension}' (explicit confirmed zero allowed)`);
  }
  return errors;
}

function retainPricingSemantics(item) {
  return {
    input_semantics: structuredClone(item),
    subscription: item.subscription ?? null,
    ...Object.fromEntries(
      [
        "subscription",
        "resource_id",
        "charge_id",
        "commitment",
        "product_name",
        "sku_name",
        "billing_region",
        "native_unit",
        "meter_applicability",
        "operating_system",
        "license",
        "redundancy",
        "pricing_context",
        "hours_per_month",
        "ri_breakeven_verified",
      ]
        .filter((key) => item[key] !== undefined)
        .map((key) => [key, structuredClone(item[key])]),
    ),
  };
}

const SERVICE_QUERY_GROUP_ALIASES = new Map([
  ["azure storage", "Storage"],
  ["storage", "Storage"],
  ["storage account", "Storage"],
  ["managed disks", "Storage"],
  ["azure managed disks", "Storage"],
  ["site recovery", "Azure Site Recovery"],
  ["azure site recovery", "Azure Site Recovery"],
  ["cloud hsm", "Azure Cloud HSM"],
  ["azure cloud hsm", "Azure Cloud HSM"],
  ["payment hsm", "Microsoft Azure Payment HSM"],
  ["azure payment hsm", "Microsoft Azure Payment HSM"],
  ["communication services email", "Email"],
  ["azure key vault", "Key Vault"],
  ["key vault", "Key Vault"],
  ["azure log analytics", "Log Analytics"],
  ["log analytics", "Log Analytics"],
  ["dns", "Azure DNS"],
  ["azure dns", "Azure DNS"],
  ["cosmos db", "Azure Cosmos DB"],
  ["azure cosmos db", "Azure Cosmos DB"],
  ["private link", "Virtual Network"],
  ["azure private link", "Virtual Network"],
  ["private endpoint", "Virtual Network"],
  ["azure private endpoint", "Virtual Network"],
  ["virtual network private link", "Virtual Network"],
  ["virtual network", "Virtual Network"],
  ["virtual machine", "Virtual Machines"],
  ["virtual machines", "Virtual Machines"],
  ["azure front door", "Azure Front Door Service"],
  ["azure front door service", "Azure Front Door Service"],
  ["azure openai", "Foundry Models"],
  ["microsoft foundry models", "Foundry Models"],
  ["foundry models", "Foundry Models"],
]);

function normalizeQueryGroupService(serviceName) {
  const key = String(serviceName ?? "")
    .trim()
    .toLowerCase();
  return SERVICE_QUERY_GROUP_ALIASES.get(key) ?? String(serviceName ?? "").trim();
}

export function round6(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
}

export function resolveWorkspacePath(targetPath, cwd = process.cwd()) {
  if (typeof targetPath !== "string" || !targetPath.trim()) {
    throw new Error("Path must be a non-empty string");
  }
  return resolvePricingWorkspacePath(targetPath, cwd);
}

function assertNotSymlink(filePath, label) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      throw new Error(`${label} must not be a symbolic link: ${filePath}`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function mergeSparseService(baseService, envOverride = {}, stampOverride = {}) {
  const mergedCapacity = {
    ...(baseService.capacity ?? {}),
    ...(envOverride.capacity ?? {}),
    ...(stampOverride.capacity ?? {}),
  };
  const mergedCommitment = {
    ...(baseService.commitment ?? {}),
    ...(envOverride.commitment ?? {}),
    ...(stampOverride.commitment ?? {}),
  };
  return {
    ...baseService,
    ...envOverride,
    ...stampOverride,
    capacity: mergedCapacity,
    commitment: mergedCommitment,
  };
}

function expandManifestServices(manifest, manifestUsage = {}) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.services)) {
    throw new Error("Manifest must contain a services[] array");
  }
  const topEnvs =
    Array.isArray(manifest.environments) && manifest.environments.length > 0 ? manifest.environments : ["dev"];
  const stamps = Array.isArray(manifest.stamps) && manifest.stamps.length > 0 ? manifest.stamps : [null];
  const expanded = [];

  for (const service of manifest.services) {
    if (!service.id || !service.service || !service.size) {
      throw new Error(`Manifest service entry is missing id, service, or size: ${JSON.stringify(service)}`);
    }
    const usageSpec = manifestUsage[service.id] ?? null;
    for (const stamp of stamps) {
      const stampEnvs =
        stamp && Array.isArray(stamp.environments) && stamp.environments.length > 0 ? stamp.environments : topEnvs;
      const stampSvcOverride = stamp?.service_overrides?.[service.id] ?? {};
      for (const env of stampEnvs) {
        const envOverride = service.environment_overrides?.[env] ?? {};
        const effective = mergeSparseService(service, envOverride, stampSvcOverride);
        const effectiveUsage = usageSpec ?? effective.usage ?? null;
        if (
          ["observed-current", "user-pin"].includes(effective.source) &&
          (effective.capacity?.default === undefined || !effective.commitment?.type)
        ) {
          throw new Error(
            `${effective.source === "user-pin" ? "User-pinned" : "Observed"} service '${service.id}' requires explicit capacity.default and commitment.type before pricing; unknown values cannot default to one instance or on-demand`,
          );
        }
        const regions =
          stamp && Array.isArray(stamp.regions) && stamp.regions.length > 0
            ? stamp.regions
            : Array.isArray(effective.regions) && effective.regions.length > 0
              ? effective.regions
              : manifest.default_region
                ? [manifest.default_region]
                : [];
        if (regions.length === 0) {
          throw new Error(`Manifest service '${service.id}' has no effective deployment region`);
        }
        const quantity = Number(effective.capacity?.default ?? 1);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`Manifest service '${service.id}' in '${env}' has invalid capacity.default`);
        }
        for (const region of regions) {
          const stampLabel = stamp?.id ? `, ${stamp.id}` : "";
          expanded.push({
            ...retainPricingSemantics(effective),
            name: `${service.id} (${env}${stampLabel}, ${region})`,
            manifest_service_id: service.id,
            source_kind: "manifest",
            environment: env,
            stamp: stamp?.id ?? null,
            subscription: stamp?.subscription ?? effective.subscription ?? null,
            service_name: effective.service,
            sku: effective.size,
            region,
            quantity,
            commitment: effective.commitment ?? { type: "on-demand" },
            usage: effectiveUsage,
            meter_name: effective.meter_name ?? effectiveUsage?.meter_name ?? null,
            upper_bound_ok: Boolean(effectiveUsage?.upper_bound_ok),
          });
        }
      }
    }
  }
  return expanded;
}

function validateUsageEntry(lineName, serviceName, sku, usage) {
  const problems = [];
  const items = Array.isArray(usage) ? usage : usage && typeof usage === "object" ? [usage] : [];
  if (items.length === 0) {
    if (VARIABLE_SERVICE_NAMES.has(serviceName) || /^(azure )?(key vault|log analytics|dns)$/i.test(serviceName)) {
      problems.push(`${lineName}: variable-usage service '${serviceName}' requires explicit usage`);
    }
    if (serviceName === "Azure Monitor" && /alert/i.test(`${sku} ${lineName}`)) {
      problems.push(`${lineName}: Azure Monitor alert line requires explicit usage and evaluation_frequency`);
    }
    return problems;
  }

  for (const [idx, item] of items.entries()) {
    const label = items.length > 1 ? `${lineName}.usage[${idx}]` : `${lineName}.usage`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      problems.push(`${label}: usage entry must be an object`);
      continue;
    }
    for (const [key, value] of Object.entries(item)) {
      if (
        [
          "scope",
          "unit",
          "dimension",
          "evaluation_frequency",
          "zero_usage_confirmed",
          "meter_name",
          "upper_bound_ok",
        ].includes(key)
      )
        continue;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
        problems.push(`${label}: '${key}' must be an explicit finite nonnegative number, not unknown/null`);
    }
    if (Object.hasOwn(item, "amount")) {
      const amount = item.amount;
      if (
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        (amount === 0 && !item.zero_usage_confirmed)
      ) {
        problems.push(`${label}: usage amount must be a positive number (or 0 with zero_usage_confirmed: true)`);
      }
      if (typeof item.unit !== "string" || !item.unit.trim()) {
        problems.push(`${label}: usage unit is required (e.g. 'GB', '10K', '1M', 'monitored-resources')`);
      }
    } else {
      const numericMetrics = Object.entries(item).filter(
        ([k, v]) =>
          ![
            "scope",
            "unit",
            "dimension",
            "evaluation_frequency",
            "billable_days_per_month",
            "zero_usage_confirmed",
            "meter_name",
            "upper_bound_ok",
          ].includes(k) &&
          typeof v === "number" &&
          Number.isFinite(v) &&
          v >= 0,
      );
      const hasPositive = numericMetrics.some(([, v]) => v > 0) || Boolean(item.zero_usage_confirmed);
      if (numericMetrics.length === 0 || !hasPositive) {
        problems.push(`${label}: usage object must specify amount+unit or positive numeric usage metrics`);
      }
    }
    if (item.scope !== "per-instance" && item.scope !== "aggregate") {
      problems.push(`${label}: usage scope must be 'per-instance' or 'aggregate'`);
    }
    if (serviceName === "Azure Monitor" && /alert/i.test(`${sku} ${lineName}`)) {
      if (typeof item.evaluation_frequency !== "string" || !item.evaluation_frequency.trim()) {
        problems.push(`${label}: alert usage must specify evaluation_frequency (e.g. '1m', '5m', '10m', '15m')`);
      }
    }
  }
  return problems;
}

function assessmentPricingContext(input, mode, lines) {
  if (input.assessment_basis === undefined) return {};
  const basis = input.assessment_basis;
  if (
    mode !== "resource_list" ||
    !basis ||
    basis.cost_view !== "Retail" ||
    !["period", "normalization", "tax", "licensing"].every(
      (key) => typeof basis[key] === "string" && basis[key].trim(),
    ) ||
    !Array.isArray(input.assumptions) ||
    input.assumptions.length === 0 ||
    !input.assumptions.every((item) => typeof item === "string" && item.trim()) ||
    !lines.every((line) =>
      ["resource_id", "charge_id"].every((key) => typeof line[key] === "string" && line[key].trim()),
    )
  ) {
    throw new Error("Assessment pricing requires resource_list identities, explicit retail basis and assumptions");
  }
  return { assessment_basis: structuredClone(basis), assumptions: [...input.assumptions] };
}

export function normalizeCostRequest(rawRequest, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  if (!rawRequest || typeof rawRequest !== "object" || Array.isArray(rawRequest)) {
    throw new Error("Cost request must be a JSON object");
  }
  const primaryModes = ["resource_list", "manifest_path", "candidate_sets"].filter((key) =>
    Object.hasOwn(rawRequest, key),
  );
  if (primaryModes.length !== 1) {
    throw new Error(
      `Exactly one primary input mode (resource_list, manifest_path, or candidate_sets) is required; got ${primaryModes.length}`,
    );
  }
  const mode = primaryModes[0];
  const purpose = rawRequest.purpose ?? "monthly-estimate";
  if (!["monthly-estimate", "rate-quote"].includes(purpose))
    throw new Error("purpose must be monthly-estimate or rate-quote");
  if (typeof rawRequest.project_name !== "string" || !rawRequest.project_name.trim()) {
    throw new Error("project_name is required");
  }
  if (typeof rawRequest.region !== "string" || !rawRequest.region.trim()) {
    throw new Error("region is required");
  }
  if (typeof rawRequest.output_path !== "string" || !rawRequest.output_path.trim()) {
    throw new Error("output_path is required");
  }

  const currency = rawRequest.currency ?? "USD";
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(`Invalid currency code: ${currency}`);
  }
  const overwrite = Boolean(rawRequest.overwrite);
  const outputPath = resolveWorkspacePath(rawRequest.output_path, cwd);
  const draftPath = `${outputPath}.tmp`;
  const budgetTier = rawRequest.budget_tier === "portfolio" ? "portfolio" : "standard";
  const maxRequests = budgetTier === "portfolio" ? PORTFOLIO_SHARED_REQUESTS : MAX_SHARED_REQUESTS;
  const remainingRequests = Number(rawRequest.recovery?.remaining_requests ?? maxRequests);

  let manifestPath = null;
  let manifestServiceIds = [];
  let lines = [];

  if (mode === "manifest_path") {
    manifestPath = resolveWorkspacePath(rawRequest.manifest_path, cwd);
    if (!options.readManifestFile && !fs.existsSync(manifestPath)) {
      const pdir = projectDirFromPath(manifestPath);
      if (isLayoutV2(pdir)) manifestPath = resolveContractPath(pdir, path.basename(manifestPath));
    }
    const manifest = JSON.parse(
      options.readManifestFile
        ? Buffer.from(options.readManifestFile(manifestPath)).toString("utf8")
        : fs.readFileSync(manifestPath, "utf8"),
    );
    manifestServiceIds = manifest.services.map((s) => s.id);
    const manifestIdSet = new Set(manifestServiceIds);
    const expanded = expandManifestServices(manifest, rawRequest.manifest_usage ?? {});
    const supplemental = Array.isArray(rawRequest.supplemental_resources) ? rawRequest.supplemental_resources : [];
    const seenSupplemental = new Set();

    for (const sup of supplemental) {
      if (!sup || typeof sup !== "object" || !sup.name || !sup.service_name || !sup.sku) {
        throw new Error(`Each supplemental_resources entry requires name, service_name, and sku`);
      }
      if (manifestIdSet.has(sup.name)) {
        throw new Error(`Supplemental resource '${sup.name}' collides with manifest service id '${sup.name}'`);
      }
      if (seenSupplemental.has(sup.name)) {
        throw new Error(`Duplicate supplemental resource name: '${sup.name}'`);
      }
      seenSupplemental.add(sup.name);
      lines.push({
        ...retainPricingSemantics(sup),
        name: sup.name,
        source_kind: "supplemental",
        service_name: sup.service_name,
        sku: sup.sku,
        region: sup.region ?? rawRequest.region,
        quantity: Number(sup.quantity ?? 1),
        usage: sup.usage ?? null,
        meter_name: sup.meter_name ?? null,
        upper_bound_ok: Boolean(sup.upper_bound_ok),
      });
    }
    lines = [...expanded, ...lines];
  } else if (mode === "resource_list") {
    if (!Array.isArray(rawRequest.resource_list) || rawRequest.resource_list.length === 0) {
      throw new Error("resource_list must be a non-empty array");
    }
    lines = rawRequest.resource_list.map((item, idx) => ({
      ...retainPricingSemantics(item),
      name: item.name ?? `${item.service_name}-${idx + 1}`,
      source_kind: "resource_list",
      service_name: item.service_name,
      sku: item.sku,
      region: item.region ?? rawRequest.region,
      quantity: Number(item.quantity ?? 1),
      usage: item.usage ?? null,
      meter_name: item.meter_name ?? null,
      upper_bound_ok: Boolean(item.upper_bound_ok),
      ...Object.fromEntries(
        ["resource_id", "charge_id"].filter((key) => item[key] !== undefined).map((key) => [key, item[key]]),
      ),
    }));
  } else {
    if (!Array.isArray(rawRequest.candidate_sets) || rawRequest.candidate_sets.length === 0) {
      throw new Error("candidate_sets must be a non-empty array");
    }
    const seenDecisions = new Set();
    for (const set of rawRequest.candidate_sets) {
      if (
        typeof set.decision_id !== "string" ||
        !set.decision_id.trim() ||
        !Array.isArray(set.candidates) ||
        set.candidates.length === 0 ||
        seenDecisions.has(set.decision_id)
      ) {
        throw new Error("Each candidate_sets entry requires decision_id and a non-empty candidates[] array");
      }
      seenDecisions.add(set.decision_id);
      const seenLabels = new Set();
      for (const candidate of set.candidates) {
        if (typeof candidate.label !== "string" || !candidate.label.trim() || seenLabels.has(candidate.label))
          throw new Error("Each decision requires unique non-empty candidate labels");
        seenLabels.add(candidate.label);
        lines.push({
          ...retainPricingSemantics(candidate),
          name: candidate.label,
          decision_id: set.decision_id,
          source_kind: "candidate",
          service_name: candidate.service_name,
          sku: candidate.sku,
          region: candidate.region ?? rawRequest.region,
          quantity: Number(candidate.quantity ?? 1),
          usage: candidate.usage ?? null,
          meter_name: candidate.meter_name ?? null,
          upper_bound_ok: Boolean(candidate.upper_bound_ok),
        });
      }
    }
  }

  let estimatedQueryGroupCount;
  if (rawRequest.query_coalescing === "service-region") {
    const coalesced = new Map();
    for (const line of lines) {
      const k = digestObject({
        service: normalizeQueryGroupService(line.service_name),
        region: line.billing_region ?? line.region,
        currency,
        commitment: line.commitment?.type ?? "on-demand",
      });
      if (!coalesced.has(k)) coalesced.set(k, new Set());
      coalesced.get(k).add(line.sku);
    }
    estimatedQueryGroupCount = [...coalesced.values()].reduce((acc, skus) => acc + Math.ceil(skus.size / 10), 0);
  } else {
    const queryGroups = new Set(
      lines.map((line) =>
        digestObject({
          service: normalizeQueryGroupService(line.service_name),
          sku: line.sku,
          region: line.region,
          meter: line.meter_name,
          currency,
          product: line.product_name,
          native_unit: line.native_unit,
          commitment: line.commitment,
          pricing_context: line.pricing_context,
          operating_system: line.operating_system,
          license: line.license,
          redundancy: line.redundancy,
          sku_name: line.sku_name,
          billing_region: line.billing_region,
        }),
      ),
    );
    estimatedQueryGroupCount = queryGroups.size;
  }

  return {
    mode,
    purpose,
    project_name: rawRequest.project_name.trim(),
    region: rawRequest.region.trim(),
    currency,
    output_path: outputPath,
    draft_path: draftPath,
    manifest_path: manifestPath,
    manifest_writeback:
      purpose === "monthly-estimate" && mode === "manifest_path" ? rawRequest.manifest_writeback !== false : false,
    manifest_service_ids: manifestServiceIds,
    overwrite,
    budget_tier: budgetTier,
    remaining_requests: remainingRequests,
    estimated_query_groups: estimatedQueryGroupCount,
    lines,
    recovery: rawRequest.recovery ?? null,
    ...assessmentPricingContext(rawRequest, mode, lines),
  };
}

export function validateCostRequest(rawRequest, options = {}) {
  const unresolved = [];
  let normalized;
  try {
    normalized = normalizeCostRequest(rawRequest, options);
  } catch (error) {
    return { ok: false, normalized: null, unresolved_items: [error.message] };
  }

  safePath(normalized.output_path);
  safePath(normalized.draft_path);
  if (normalized.manifest_path) safePath(normalized.manifest_path);

  if (fs.existsSync(normalized.output_path) && !normalized.overwrite && !normalized.recovery) {
    unresolved.push(`output_path already exists and overwrite is false: ${normalized.output_path}`);
  }
  if (fs.existsSync(normalized.draft_path) && !normalized.recovery?.draft_path) {
    unresolved.push(
      `Stale temporary draft already exists (preserve or clear before running): ${normalized.draft_path}`,
    );
  }
  const maxReqs = maxRequestsFor(normalized);
  if (
    !Number.isInteger(normalized.remaining_requests) ||
    normalized.remaining_requests < 1 ||
    normalized.remaining_requests > maxReqs
  ) {
    unresolved.push(`remaining_requests must be an integer between 1 and ${maxReqs}`);
  } else if (normalized.estimated_query_groups > normalized.remaining_requests) {
    unresolved.push(
      `Estimated distinct query groups (${normalized.estimated_query_groups}) exceed remaining request budget (${normalized.remaining_requests})`,
    );
  }

  for (const line of normalized.lines) {
    if (!line.service_name || !line.sku || !line.region) {
      unresolved.push(`${line.name}: service_name, sku, and region are required`);
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      unresolved.push(`${line.name}: quantity must be a positive number`);
    }
    if (
      line.subscription !== null &&
      line.subscription !== undefined &&
      (typeof line.subscription !== "string" || !line.subscription.trim())
    )
      unresolved.push(`${line.name}: subscription must be a non-empty logical name or null`);
    unresolved.push(...validateBillableDimensions(line, normalized.purpose));
  }

  return {
    ok: unresolved.length === 0,
    normalized,
    unresolved_items: unresolved,
  };
}

function computeTieredCharge(totalUnits, tierBands) {
  if (!Array.isArray(tierBands) || tierBands.length === 0) {
    throw new Error("tier_bands must be a non-empty array");
  }
  const sorted = [...tierBands].sort((a, b) => Number(a.tierMinimumUnits) - Number(b.tierMinimumUnits));
  if (Number(sorted[0].tierMinimumUnits) !== 0) {
    throw new Error("tier_bands must start at tierMinimumUnits = 0");
  }
  for (let i = 1; i < sorted.length; i++) {
    if (Number(sorted[i].tierMinimumUnits) <= Number(sorted[i - 1].tierMinimumUnits)) {
      throw new Error("tier_bands must have strictly increasing tierMinimumUnits");
    }
  }
  let cost = 0;
  for (let i = 0; i < sorted.length; i++) {
    const start = Number(sorted[i].tierMinimumUnits);
    const end = i + 1 < sorted.length ? Number(sorted[i + 1].tierMinimumUnits) : Infinity;
    const rate = Number(sorted[i].retailPrice);
    if (!Number.isFinite(rate) || rate < 0) {
      throw new Error("tier_bands retailPrice must be a nonnegative number");
    }
    if (totalUnits > start) {
      const unitsInBand = Math.min(totalUnits, end) - start;
      cost += unitsInBand * rate;
    }
  }
  return cost;
}

function computeComponentCost(component, defaultQuantity = 1, options = {}) {
  const quantity = Number(component.quantity ?? defaultQuantity);
  if (options.allowZeroQuantity && quantity === 0 && !component.reservation_term) return 0;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(
      component.reservation_term
        ? "Prepaid Reservation commitment remains payable; cannot zero out reserved quantity"
        : "Component quantity must be a positive number",
    );
  }
  const unit = (component.unit_of_measure ?? component.unitOfMeasure ?? "1 Hour").trim();
  const usageAmount = component.usage_amount ?? component.usage?.amount;
  const scope = component.usage_scope ?? component.usage?.scope ?? "per-instance";
  const multiplier = scope === "aggregate" ? 1 : quantity;
  const freeGrant = Number(component.free_grant_units ?? 0);
  for (const key of ["usage_amount", "hours_per_month", "billable_days", "free_grant_units"]) {
    if (
      Object.hasOwn(component, key) &&
      (typeof component[key] !== "number" || !Number.isFinite(component[key]) || component[key] < 0)
    )
      throw new Error(`${key} must be an explicit finite nonnegative number`);
  }
  if (component.reservation_term) {
    const months = component.reservation_term === "3 Years" ? 36 : component.reservation_term === "1 Year" ? 12 : null;
    if (!months) throw new Error(`Unsupported reservation_term '${component.reservation_term}'`);
    const rate = Number(component.retail_price ?? component.retailPrice);
    if (!Number.isFinite(rate) || rate < 0) throw new Error("Invalid native reservation rate");
    return (rate / months) * quantity;
  }
  if (component.unit_conversion) {
    const conversion = component.unit_conversion;
    if (
      typeof usageAmount !== "number" ||
      !Number.isFinite(usageAmount) ||
      usageAmount < 0 ||
      typeof conversion.units_per_native_unit !== "number" ||
      !Number.isFinite(conversion.units_per_native_unit) ||
      conversion.units_per_native_unit <= 0 ||
      !["aggregate", "per-instance"].includes(scope)
    )
      throw new Error("Explicit usage and native unit conversion required");
    const units = (usageAmount * multiplier) / conversion.units_per_native_unit;
    if (component.tier_bands) return computeTieredCharge(units, component.tier_bands);
    const rate = component.retail_price;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0) throw new Error("Invalid native rate");
    return units * rate;
  }

  const isMillionUnit = /^(?:1m\b|1,000,000(?!,\d))/i;
  const isTenThousandUnit = /^(?:10k\b|10,000(?!,\d))/i;
  const isThousandUnit = /^(?:1k\b|1,000(?!,\d))/i;

  if (Array.isArray(component.tier_bands) && component.tier_bands.length > 0) {
    if (!Number.isFinite(Number(usageAmount)) || Number(usageAmount) < 0) {
      throw new Error(`Tiered component requires finite usage_amount`);
    }
    const rawUnits = Math.max(0, Number(usageAmount) * multiplier - freeGrant);
    const unitScale = isTenThousandUnit.test(unit)
      ? 10000
      : isThousandUnit.test(unit)
        ? 1000
        : isMillionUnit.test(unit)
          ? 1000000
          : 1;
    return computeTieredCharge(rawUnits / unitScale, component.tier_bands);
  }

  const rate = Number(component.retail_price ?? component.retailPrice ?? component.hourly_rate);
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error(`Component rate must be a nonnegative number`);
  }

  if (component.reservation_term) {
    const months = component.reservation_term === "3 Years" ? 36 : component.reservation_term === "1 Year" ? 12 : null;
    if (!months) throw new Error(`Unsupported reservation_term '${component.reservation_term}'`);
    return (rate / months) * quantity;
  }
  if (/^(1\s*\/?\s*)?hours?$/i.test(unit)) {
    const hours = Number(component.hours_per_month ?? HOURS_PER_MONTH);
    return rate * hours * quantity;
  }
  if (/^1\s*(gi?b\s*)?seconds?$/i.test(unit)) {
    if (!Number.isFinite(Number(usageAmount)) || Number(usageAmount) < 0) {
      throw new Error(`Unit '${unit}' requires explicit usage_amount`);
    }
    return rate * Math.max(0, Number(usageAmount) * multiplier - freeGrant);
  }
  if (/^(1\s*\/\s*)?days?$/i.test(unit)) {
    const days = Number(component.billable_days ?? DAYS_PER_MONTH);
    return rate * days * quantity;
  }
  if (/^(1\s*\/\s*)?months?$/i.test(unit)) {
    const units = usageAmount !== undefined && usageAmount !== null ? Number(usageAmount) * multiplier : quantity;
    return rate * Math.max(0, units - freeGrant);
  }
  if (/^(1\s*)?gb(\s*\/\s*month)?$/i.test(unit)) {
    if (!Number.isFinite(Number(usageAmount)) || Number(usageAmount) < 0) {
      throw new Error(`Unit '${unit}' requires explicit usage_amount`);
    }
    return rate * Math.max(0, Number(usageAmount) * multiplier - freeGrant);
  }
  if (isThousandUnit.test(unit)) {
    if (!Number.isFinite(Number(usageAmount)) || Number(usageAmount) < 0) {
      throw new Error(`Unit '${unit}' requires explicit usage_amount`);
    }
    const billableOps = Math.max(0, Number(usageAmount) * multiplier - freeGrant);
    return rate * (billableOps / 1000);
  }
  if (isTenThousandUnit.test(unit)) {
    if (!Number.isFinite(Number(usageAmount)) || Number(usageAmount) < 0) {
      throw new Error(`Unit '${unit}' requires explicit usage_amount`);
    }
    const billableOps = Math.max(0, Number(usageAmount) * multiplier - freeGrant);
    return rate * (billableOps / 10000);
  }
  if (isMillionUnit.test(unit)) {
    if (!Number.isFinite(Number(usageAmount)) || Number(usageAmount) < 0) {
      throw new Error(`Unit '${unit}' requires explicit usage_amount`);
    }
    const billableOps = Math.max(0, Number(usageAmount) * multiplier - freeGrant);
    return rate * (billableOps / 1000000);
  }
  if (unit === "1" && component.unit_interpretation === "per-unit-month") {
    const units = usageAmount !== undefined && usageAmount !== null ? Number(usageAmount) * multiplier : quantity;
    return rate * Math.max(0, units - freeGrant);
  }
  throw new Error(`Unsupported or ambiguous unitOfMeasure '${unit}'`);
}

export function calculateLineCost(line, options = {}) {
  if (!line || typeof line !== "object") throw new Error("Resource line must be an object");
  const hasReservationComponent =
    Boolean(line.reservation_term) ||
    (Array.isArray(line.components) && line.components.some((comp) => Boolean(comp?.reservation_term)));
  if (options.allowZeroQuantity && line.quantity === 0 && !hasReservationComponent) return 0;
  if (Array.isArray(line.components) && line.components.length > 0) {
    const total = line.components.reduce(
      (sum, comp) => sum + computeComponentCost(comp, line.quantity ?? 1, options),
      0,
    );
    return round6(total);
  }
  if (line.unit_of_measure || line.unitOfMeasure || line.retail_price !== undefined || line.tier_bands) {
    return round6(computeComponentCost(line, line.quantity ?? 1, options));
  }
  if (line.monthly_cost !== undefined && line.monthly_cost !== null) {
    const val = Number(line.monthly_cost);
    if (!Number.isFinite(val) || val < 0) throw new Error(`Invalid monthly_cost on '${line.name}'`);
    return round6(val);
  }
  return null;
}

/** SKU rates and free grants may change without changing the evidenced consumption. */
export function comparableLineUsage(line) {
  const numeric = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value);
    if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error("Invalid comparable consumption input");
    const [whole, fraction = ""] = text.split(".");
    const decimal = fraction.replace(/0+$/, "");
    return `${BigInt(whole)}${decimal ? `.${decimal}` : ""}`;
  };
  const stable = (value) => {
    if (Array.isArray(value))
      return value.map(stable).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, stable(value[key])]),
      );
    return typeof value === "number" || (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value))
      ? numeric(value)
      : value;
  };
  const project = (component, quantity, region) => ({
    region: (component.region ?? region).toLowerCase(),
    billing_region: component.billing_region?.toLowerCase() ?? null,
    quantity: numeric(component.quantity ?? quantity),
    unit: (component.unit_of_measure ?? component.unitOfMeasure ?? component.usage?.unit ?? "1 Hour")
      .trim()
      .toLowerCase()
      .replace(/^1\s+/, "")
      .replace(/\s+/g, " ")
      .replace(/^(hours?|days?|months?)$/, (unit) => unit.replace(/s$/, "")),
    usage_amount: numeric(component.usage_amount ?? component.usage?.amount),
    usage_scope: component.usage_scope ?? component.usage?.scope ?? "per-instance",
    usage_dimension: component.usage_dimension ?? null,
    unit_conversion: component.unit_conversion
      ? {
          usage_unit: component.unit_conversion.usage_unit,
          native_unit: component.unit_conversion.native_unit,
          units_per_native_unit: numeric(component.unit_conversion.units_per_native_unit),
        }
      : null,
    usage: component.usage === undefined ? null : stable(component.usage),
    hours_per_month: numeric(component.hours_per_month ?? HOURS_PER_MONTH),
    billable_days: numeric(component.billable_days ?? DAYS_PER_MONTH),
    unit_interpretation: component.unit_interpretation ?? null,
    components: (component.components ?? [])
      .map((item) => project(item, component.quantity ?? quantity, component.region ?? region))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  });
  return {
    ...project(line, 1, line.region),
    calculation_basis: line.calculation_basis ? project(line.calculation_basis, line.quantity, line.region) : null,
  };
}

export function pricingRequestSnapshot(normalized) {
  return Object.fromEntries(
    [
      "purpose",
      "mode",
      "project_name",
      "region",
      "currency",
      ...(normalized.budget_tier === "portfolio" ? ["budget_tier"] : []),
      "lines",
      "assessment_basis",
      "assumptions",
    ]
      .filter((key) => normalized[key] !== undefined)
      .map((key) => [key, structuredClone(normalized[key])]),
  );
}

export function bindCostRequest(rawRequest, { requestPath, cwd = process.cwd() } = {}) {
  if (!requestPath) throw new Error("Original requestPath is required for immutable preflight binding");
  const source = readSnapshot(resolveWorkspacePath(requestPath, cwd));
  if (stableJson(JSON.parse(source.bytes)) !== stableJson(rawRequest))
    throw new Error("Preflight input differs from the original request file");
  const normalized = normalizeCostRequest(rawRequest, { cwd });
  const request_snapshot = pricingRequestSnapshot(normalized);
  const sourceFiles = normalized.manifest_path ? [readSnapshot(normalized.manifest_path)] : [];
  if (
    digestObject(pricingRequestSnapshot(normalizeCostRequest(rawRequest, { cwd }))) !== digestObject(request_snapshot)
  )
    throw new Error("Manifest changed during request binding");
  assertSnapshots([source, ...sourceFiles]);
  const portable = (filename) => path.relative(cwd, filename).replaceAll(path.sep, "/");
  const binding = {
    schema_version: "pricing-request-binding-v1",
    request_path: portable(source.path),
    request_source_sha256: source.sha256,
    request_source_base64: source.bytes.toString("base64"),
    request_sha256: digestObject(request_snapshot),
    request_snapshot,
    source_files: sourceFiles.map((snapshot) => ({
      path: portable(snapshot.path),
      sha256: snapshot.sha256,
      original_base64: snapshot.bytes.toString("base64"),
    })),
  };
  const filename = path.join(
    evidenceDirectory(normalized.output_path),
    `request-${source.sha256}-${binding.request_sha256}.json`,
  );
  const bytes = `${JSON.stringify(binding, null, 2)}\n`;
  let bindingDigest = sha256(bytes);
  if (fs.existsSync(filename)) {
    const existing = readSnapshot(filename);
    if (existing.sha256 !== bindingDigest) {
      const saved = JSON.parse(existing.bytes);
      const { request_source_base64: _savedBytes, ...savedCore } = saved;
      const { request_source_base64: _newBytes, ...newCore } = binding;
      if (
        stableJson(savedCore) !== stableJson(newCore) ||
        (saved.request_source_base64 !== undefined &&
          sha256(Buffer.from(saved.request_source_base64, "base64")) !== source.sha256)
      )
        throw new Error("Existing request binding must be preserved");
      bindingDigest = existing.sha256;
    }
  } else writeExclusive(filename, bytes);
  withLedger(normalized.output_path, () => undefined);
  return {
    request_binding_path: portable(filename),
    request_binding_sha256: bindingDigest,
    request_snapshot,
    request_sha256: binding.request_sha256,
  };
}

function validateOriginalRequest(estimate, catalogs, options, errors) {
  if (!options.requestPath) {
    errors.push("Independent original requestPath is required for authoritative validation");
    return;
  }
  const snapshots = options.snapshots;
  const readSource = (reference) =>
    options.readRequestFile
      ? readSnapshot(reference, options.readRequestFile, options.cwd)
      : readSnapshot(resolveWorkspacePath(reference, options.cwd));
  const readEvidence = (reference) =>
    options.readEvidenceFile
      ? readSnapshot(reference, options.readEvidenceFile, options.cwd)
      : readSnapshot(resolveWorkspacePath(reference, options.cwd));
  const original = readSource(options.requestPath);
  snapshots.push(original);
  const rawRequest = JSON.parse(original.bytes);
  const derivedReference = path.join(
    path.dirname(rawRequest.output_path),
    "pricing-evidence",
    `request-${original.sha256}-${estimate.request_sha256}.json`,
  );
  const bindingReference =
    options.requestBindingPath ??
    (path.isAbsolute(derivedReference)
      ? path.relative(options.cwd, derivedReference).replaceAll(path.sep, "/")
      : derivedReference);
  let currentSnapshot;
  try {
    currentSnapshot = readEvidence(bindingReference);
  } catch (cause) {
    throw new Error("Original request/preflight binding differs or is missing", { cause });
  }
  snapshots.push(currentSnapshot);
  const current = JSON.parse(currentSnapshot.bytes);
  const archives = (binding) =>
    (binding.source_files ?? []).map((source) => {
      const bytes = Buffer.from(source.original_base64 ?? "", "base64");
      if (sha256(bytes) !== source.sha256) throw new Error("Original manifest backup is unverified");
      return { source, bytes };
    });
  const normalizedArchive = (raw, binding) => {
    const files = archives(binding);
    const normalized = normalizeCostRequest(raw, {
      cwd: options.cwd,
      readManifestFile: files.length === 1 ? () => files[0].bytes : undefined,
    });
    return pricingRequestSnapshot(normalized);
  };
  if (
    current.schema_version !== "pricing-request-binding-v1" ||
    current.request_source_sha256 !== original.sha256 ||
    resolveWorkspacePath(current.request_path, options.cwd) !==
      resolveWorkspacePath(options.requestPath, options.cwd) ||
    current.request_sha256 !== estimate.request_sha256 ||
    stableJson(current.request_snapshot) !== stableJson(estimate.request_snapshot) ||
    digestObject(normalizedArchive(rawRequest, current)) !== current.request_sha256
  )
    throw new Error("Original request/preflight binding differs; existing evidence cannot be rebound");
  for (const { source, bytes } of archives(current)) {
    const snapshot = readSource(source.path);
    snapshots.push(snapshot);
    if (snapshot.sha256 !== source.sha256) {
      const stripWriteback = (manifest) => ({
        ...manifest,
        services: manifest.services.map((service) => {
          const copy = { ...service };
          delete copy.cost_estimate_monthly_usd;
          delete copy.cost_estimated_at;
          return copy;
        }),
      });
      if (stableJson(stripWriteback(JSON.parse(bytes))) !== stableJson(stripWriteback(JSON.parse(snapshot.bytes))))
        throw new Error("Original manifest billing inputs changed after preflight");
    }
  }
  const currentLedgerReference = path.join(path.dirname(bindingReference), "request-ledger.json");
  const currentLedgerSnapshot = readEvidence(currentLedgerReference);
  snapshots.push(currentLedgerSnapshot);
  const currentLedger = JSON.parse(currentLedgerSnapshot.bytes);
  if (currentLedger.schema_version !== "pricing-request-ledger-v1" || !Array.isArray(currentLedger.attempts))
    throw new Error("Current calculation requires a durable request ledger");
  for (const { evidence, ledgerInfo, historical } of catalogs.values()) {
    const references = [evidence];
    if (evidence.schema_version === "retail-price-evidence-v1") {
      for (const failure of evidence.mcp_failure.attempts) {
        const snapshot = readEvidence(failure.evidence_path);
        snapshots.push(snapshot);
        references.push(JSON.parse(snapshot.bytes));
      }
    }
    for (const capture of references) {
      if (!capture.request_binding_path || !capture.request_binding_sha256)
        throw new Error("Captured provenance lacks its original immutable request binding");
      const bindingSnapshot = readEvidence(capture.request_binding_path);
      snapshots.push(bindingSnapshot);
      if (bindingSnapshot.sha256 !== capture.request_binding_sha256)
        throw new Error("Immutable original request binding hash mismatch");
      const binding = JSON.parse(bindingSnapshot.bytes);
      if (
        binding.schema_version !== "pricing-request-binding-v1" ||
        digestObject(binding.request_snapshot) !== binding.request_sha256
      )
        throw new Error("Historical collection request binding is invalid");
      if (historical) {
        if (
          binding.request_sha256 === current.request_sha256 ||
          binding.request_source_sha256 === current.request_source_sha256
        )
          throw new Error("Same-attempt evidence cannot be relabelled as a historical import");
        const bytes = binding.request_source_base64
          ? Buffer.from(binding.request_source_base64, "base64")
          : readSource(binding.request_path).bytes;
        if (
          sha256(bytes) !== binding.request_source_sha256 ||
          digestObject(normalizedArchive(JSON.parse(bytes), binding)) !== binding.request_sha256
        )
          throw new Error("Historical collection original request is unverified");
      } else if (
        capture.request_binding_sha256 !== currentSnapshot.sha256 ||
        bindingSnapshot.path !== currentSnapshot.path
      )
        throw new Error(
          "Original request/preflight binding differs; existing evidence cannot be rebound without an explicit historical import",
        );
    }
    const attemptIds =
      evidence.source === "mcp" ? [evidence.call_id] : evidence.attempts.map((attempt) => attempt.call_id);
    for (const id of attemptIds) {
      const attempt = ledgerInfo.ledger.attempts.find((entry) => entry.call_id === id);
      if (
        attempt.request_binding_path !== evidence.request_binding_path ||
        attempt.request_binding_sha256 !== evidence.request_binding_sha256
      )
        throw new Error("Reservation request binding differs from captured provenance");
    }
  }
  return {
    path: currentSnapshot.path,
    sha256: currentSnapshot.sha256,
    binding: current,
    ledgerInfo: { path: currentLedgerSnapshot.path, ledger: currentLedger },
  };
}
function currentTimestamp(value, options, label, errors) {
  const timestamp = Date.parse(value);
  const now = new Date(options.now ?? Date.now()).getTime();
  if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp > (options.ttlDays ?? 30) * 86400000)
    errors.push(`${label}: evidence timestamp is invalid, stale or future-dated`);
}

function validateNativeConversion(conversion) {
  const native = conversion.native_unit;
  const usage = conversion.usage_unit;
  let scale;
  if (native === usage) scale = 1;
  else if (/^(1\s*\/?\s*)?hours?$/i.test(native) && usage === "hours") scale = 1;
  else if (/^1\s*seconds?$/i.test(native) && usage === "vcpu_seconds") scale = 1;
  else if (/^1\s*gi?b\s*seconds?$/i.test(native) && usage === "gib_seconds") scale = 1;
  else if (/^(1\s*\/\s*)?days?$/i.test(native) && usage === "days") scale = 1;
  else if (
    /^(1\s*\/\s*)?months?$/i.test(native) &&
    ["months", "protected_instances", "circuits", "zones"].includes(usage)
  )
    scale = 1;
  else if (
    /^(1\s*)?GB(\s*\/\s*Month)?$/.test(native) &&
    ["GB", "capacity_gb", "storage_gb", "vault_storage_gb", "ingress_gb", "egress_gb", "processed_gb"].includes(usage)
  )
    scale = 1;
  else if (/^(1\s*)?TB(\s*\/\s*Month)?$/.test(native) && ["TB", "capacity_tb"].includes(usage)) scale = 1;
  else if (/^100\s*TB(\s*\/\s*Month)?$/i.test(native) && usage === "GB") scale = 102400;
  else if (/^1\s*PB(\s*\/\s*Month)?$/i.test(native) && usage === "GB") scale = 1048576;
  else if (native === "1") scale = 1;
  else if (
    ["operations", "requests", "queries", "tokens", "request_units", "emails", "activity_runs"].includes(usage)
  ) {
    if (/^(?:1K\b|1,?000(?!,?\d))/i.test(native)) scale = 1000;
    else if (/^(?:10K\b|10,?000(?!,?\d))/i.test(native)) scale = 10000;
    else if (/^(?:1M\b|1,?000,?000(?!,?\d))/i.test(native)) scale = 1000000;
  }
  if (scale === undefined || scale !== conversion.units_per_native_unit)
    throw new Error("Unverified or contradictory native unit conversion; use native units or a rate quote");
}

function loadExactEvidence(entries, options, errors) {
  const catalogs = new Map();
  const snapshots = options.snapshots ?? [];
  const read = (reference) =>
    options.readEvidenceFile
      ? readSnapshot(reference, options.readEvidenceFile, options.cwd)
      : readSnapshot(resolveWorkspacePath(reference, options.cwd));
  for (const entry of entries ?? []) {
    try {
      const filename = resolveWorkspacePath(entry.evidence_path, options.cwd);
      if (entry.provenance !== undefined && entry.provenance !== "historical-import")
        throw new Error("Unsupported evidence import provenance tag");
      if (catalogs.has(filename)) throw new Error("Duplicate evidence reference");
      const snapshot = read(entry.evidence_path);
      snapshots.push(snapshot);
      const evidence = JSON.parse(snapshot.bytes);
      let ledgerInfo = null;
      if (evidence.status !== "COMPLETE") throw new Error("Incomplete/unverified evidence response");
      const rows = [];
      if (evidence.schema_version === "pricing-response-evidence-v1") {
        if (
          evidence.source !== "mcp" ||
          evidence.provenance !== "caller-supplied-native-call" ||
          !evidence.call_id ||
          !evidence.native_call_id ||
          evidence.query_hash !== digestObject(evidence.query)
        )
          throw new Error("Missing native query/call provenance");
        const raw = read(evidence.raw_path);
        snapshots.push(raw);
        if (path.dirname(raw.path) !== path.dirname(snapshot.path))
          throw new Error("Raw evidence escaped evidence directory");
        if (raw.sha256 !== evidence.response_sha256) throw new Error("Raw evidence SHA-256 mismatch");
        const decoded = decodePricingResponse(raw.bytes);
        if (stableJson(decoded) !== stableJson(evidence.normalized_rows))
          throw new Error("Normalized result differs from original bytes");
        rows.push(...decoded);
        currentTimestamp(evidence.queried_at, options, filename, errors);
        const ledgerSnapshot = read(path.join(path.dirname(entry.evidence_path), "request-ledger.json"));
        snapshots.push(ledgerSnapshot);
        const ledger = JSON.parse(ledgerSnapshot.bytes);
        ledgerInfo = { path: ledgerSnapshot.path, ledger };
        const attempt = ledger.attempts?.find((item) => item.call_id === evidence.call_id);
        if (
          attempt?.state !== "completed" ||
          attempt.query_hash !== evidence.query_hash ||
          attempt.response_sha256 !== evidence.response_sha256 ||
          attempt.native_call_id !== evidence.native_call_id ||
          attempt.issued_at !== evidence.queried_at ||
          resolveWorkspacePath(attempt.evidence_path, options.cwd) !== filename
        )
          throw new Error("Native capture lacks matching completed ledger reservation");
        currentTimestamp(evidence.captured_at, options, "captured_at", errors);
        if (Date.parse(evidence.captured_at) < Date.parse(evidence.queried_at))
          throw new Error("Capture timestamp predates native issue");
        if (ledger.attempts.length + (ledger.external_requests_used ?? 0) > maxRequestsFor(ledger))
          throw new Error("Shared request budget exceeded");
      } else if (evidence.schema_version === "retail-price-evidence-v1") {
        if (!evidence.ledger_path) throw new Error("Missing durable direct request ledger");
        const failureSnapshots = verifyCapturedFailure(
          evidence.mcp_failure,
          options.readEvidenceFile,
          options.cwd,
          evidence.ledger_path,
        );
        snapshots.push(...failureSnapshots);
        const queryOpts = {
          allowReservation: Boolean(options.allowReservation && evidence.query?.priceType === "Reservation"),
        };
        validateFailure(
          {
            query: evidence.query,
            allow_reservation: queryOpts.allowReservation,
            mcp_failure: failureSnapshots.failure,
          },
          { now: Date.parse(evidence.pages?.[0]?.queried_at), allowReservation: queryOpts.allowReservation },
        );
        const ledgerSnapshot = read(evidence.ledger_path);
        snapshots.push(ledgerSnapshot);
        const ledger = JSON.parse(ledgerSnapshot.bytes);
        ledgerInfo = { path: ledgerSnapshot.path, ledger };
        if (
          !Array.isArray(evidence.pages) ||
          !evidence.pages.length ||
          !Array.isArray(evidence.attempts) ||
          evidence.requests_used !== evidence.attempts.length ||
          evidence.attempts.length < evidence.pages.length
        )
          throw new Error("Incomplete direct evidence pages");
        for (const directAttempt of evidence.attempts) {
          const ledgerAttempt = ledger.attempts?.find((item) => item.call_id === directAttempt?.call_id);
          if (
            !ledgerAttempt ||
            ledgerAttempt.source !== "direct" ||
            !ledgerAttempt.issued_confirmed ||
            ledgerAttempt.state !== directAttempt.state ||
            !ledgerAttempt.evidence_path
          )
            throw new Error("Direct attempt lacks durable ledger provenance");
          const attemptSnapshot = read(ledgerAttempt.evidence_path);
          snapshots.push(attemptSnapshot);
          const durableAttempt = JSON.parse(attemptSnapshot.bytes);
          if (sha256(rawPageBytes(durableAttempt)) !== durableAttempt.response_sha256)
            throw new Error("Durable direct attempt page SHA-256 mismatch");
          if (
            directAttempt.state !== "completed" &&
            !(directAttempt.state === "error" && [429, 503].includes(directAttempt.http_status))
          )
            throw new Error("Direct evidence contains non-retryable failed attempt");
        }
        const completedAttempts = evidence.attempts.filter((item) => item.state === "completed");
        if (completedAttempts.length !== evidence.pages.length)
          throw new Error("Direct completed attempts do not match evidence pages");
        for (const [index, page] of evidence.pages.entries()) {
          if (sha256(rawPageBytes(page)) !== page.response_sha256) throw new Error("Raw page SHA-256 mismatch");
          const parsed = JSON.parse(page.raw_response);
          validatePage(parsed, evidence.query);
          if (parsed.NextPageLink !== null)
            validateNextPageLink(parsed.NextPageLink, evidence.query, page.url, queryOpts);
          if (index === 0 && page.url !== retailQueryUrl(evidence.query, queryOpts).href)
            throw new Error("Direct page query differs from request");
          const attempt = completedAttempts[index];
          const issued = ledger.attempts?.find((item) => item.call_id === attempt?.call_id);
          if (
            attempt?.state !== "completed" ||
            issued?.state !== "completed" ||
            issued.source !== "direct" ||
            issued.query?.page_url !== page.url ||
            issued.issued_at !== page.queried_at ||
            issued.query_hash !== digestObject({ ...evidence.query, page_url: page.url })
          )
            throw new Error("Direct page lacks completed durable request provenance");
          const pageSnapshot = read(issued.evidence_path);
          snapshots.push(pageSnapshot);
          const durablePage = JSON.parse(pageSnapshot.bytes);
          if (
            durablePage.response_sha256 !== page.response_sha256 ||
            durablePage.raw_response !== page.raw_response ||
            rawPageBytes(durablePage).compare(rawPageBytes(page)) !== 0
          )
            throw new Error("Direct page differs from durably captured response");
          if (
            parsed.BillingCurrency !== evidence.query.currencyCode ||
            !Object.hasOwn(parsed, "NextPageLink") ||
            (index === evidence.pages.length - 1
              ? parsed.NextPageLink !== null
              : parsed.NextPageLink !== evidence.pages[index + 1].url)
          )
            throw new Error("Incomplete direct evidence pagination");
          rows.push(...parsed.Items);
          currentTimestamp(page.queried_at, options, filename, errors);
        }
      } else throw new Error("Unsupported evidence schema");
      const meters = rows.map(normalizeMeter);
      if (!meters.length) throw new Error("No meter evidence");
      for (const meter of meters) {
        currentTimestamp(evidence.queried_at ?? evidence.pages[0].queried_at, options, filename, errors);
        if (Date.parse(meter.effectiveStartDate) > new Date(options.now ?? Date.now()).getTime())
          throw new Error("Meter effective date is in the future");
        for (const key of [
          "serviceName",
          "armSkuName",
          "armRegionName",
          "productName",
          "skuName",
          "meterName",
          "currencyCode",
        ]) {
          if (Object.hasOwn(evidence.query, key) && evidence.query[key] !== meter[key])
            throw new Error(`Evidence row contradicts query ${key}`);
        }
        if (meter.type !== evidence.query.priceType) throw new Error("Evidence priceType mismatch");
      }
      if (ledgerInfo?.ledger.schema_version !== "pricing-request-ledger-v1")
        throw new Error("Invalid durable request ledger schema");
      if (
        ledgerInfo.ledger.attempts.length + (ledgerInfo.ledger.external_requests_used ?? 0) >
        maxRequestsFor(ledgerInfo.ledger)
      )
        throw new Error("Collection ledger exceeds the shared pricing budget");
      catalogs.set(filename, { meters, evidence, ledgerInfo, historical: entry.provenance === "historical-import" });
    } catch (error) {
      errors.push(`Evidence: ${error.message}`);
    }
  }
  return catalogs;
}

function validateLinkedPricing(estimate, options, errors, quote = false) {
  const request = estimate.request_snapshot;
  if (
    !request ||
    estimate.request_sha256 !== digestObject(request) ||
    !Array.isArray(request.lines) ||
    !request.lines.length
  ) {
    errors.push("Current normalized request_snapshot and request_sha256 are required");
    return;
  }
  if (
    request.purpose !== (quote ? "rate-quote" : "monthly-estimate") ||
    ["project_name", "region", "currency"].some((key) => request[key] !== estimate[key])
  )
    errors.push("Estimate/request identity or purpose mismatch");
  if (!["resource_list", "manifest_path", "candidate_sets"].includes(request.mode))
    errors.push("Invalid original request mode");
  if (
    request.lines.some(
      (line) =>
        !line ||
        ["name", "service_name", "sku", "region"].some((key) => typeof line[key] !== "string" || !line[key].trim()) ||
        typeof line.quantity !== "number" ||
        !Number.isFinite(line.quantity) ||
        line.quantity <= 0,
    )
  )
    errors.push("Normalized request lines require explicit identity and positive finite quantity");
  const catalogs = loadExactEvidence(
    estimate.evidence,
    { ...options, allowReservation: estimate.schema_version === "cost-estimate-v2.2" },
    errors,
  );
  const authority = validateOriginalRequest(estimate, catalogs, options, errors);
  if (!catalogs.size) errors.push("Every COMPLETE result requires exact captured evidence");
  const used = new Set();
  const seen = new Set();
  const aggregateTierGroups = new Set();
  for (const resource of estimate.resources ?? []) {
    const input = request.lines.find(
      (line) =>
        line.name === resource.name &&
        line.decision_id === resource.decision_id &&
        (line.resource_id ?? null) === (resource.resource_id ?? null) &&
        (line.charge_id ?? null) === (resource.charge_id ?? null),
    );
    if (!input || seen.has(input)) {
      errors.push("Missing, duplicate or unrequested pricing resource");
      continue;
    }
    seen.add(input);
    for (const key of ["service_name", "sku", "region", "quantity", "subscription", "resource_id", "charge_id"]) {
      if ((resource[key] ?? null) !== (input[key] ?? null)) errors.push(`${resource.name}: request ${key} differs`);
    }
    errors.push(...validateBillableDimensions(input, request.purpose));
    const basis = quote ? resource : resource.calculation_basis;
    if (!basis || (!quote && basis.request_line_sha256 !== digestObject(input))) {
      errors.push(`${resource.name}: retained calculation basis/request coverage is required`);
      continue;
    }
    if (!quote && ["name", "service_name", "sku", "region", "quantity"].some((key) => basis[key] !== resource[key]))
      errors.push(`${resource.name}: calculation basis differs from resource`);
    if (
      Array.isArray(basis.components) &&
      basis.components.length > 0 &&
      (Object.hasOwn(basis, "reservation_term") || Object.hasOwn(basis, "ri_breakeven_verified"))
    ) {
      errors.push(`${resource.name}: reservation fields belong on individual components, not parent calculation_basis`);
      continue;
    }
    const components = basis.components?.length ? basis.components : [basis];
    const covered = new Set();
    const duplicated = new Set();
    for (const component of components) {
      try {
        const ref = component.evidence_ref;
        if (!ref?.evidence_path || !Array.isArray(ref.row_sha256) || !ref.row_sha256.length)
          throw new Error("Component requires evidence_ref {evidence_path,row_sha256:[]}");
        const filename = resolveWorkspacePath(ref.evidence_path, options.cwd);
        const catalog = catalogs.get(filename);
        if (!catalog) throw new Error("Component references undeclared/unverified evidence");
        used.add(filename);
        const selected = ref.row_sha256.map((digest) => {
          const matches = catalog.meters.filter((row) => digestObject(row) === digest);
          if (matches.length !== 1) throw new Error("Selected meter row is absent or ambiguous");
          return matches[0];
        });
        if (new Set(ref.row_sha256).size !== ref.row_sha256.length) throw new Error("Duplicate selected row");
        const identity = (row) =>
          stableJson({
            ...Object.fromEntries(
              METER_FIELDS.filter((key) => !["retailPrice", "tierMinimumUnits"].includes(key)).map((key) => [
                key,
                row[key],
              ]),
            ),
            ...(row.reservationTerm ? { reservationTerm: row.reservationTerm } : {}),
          });
        const first = selected[0];
        if (selected.some((row) => identity(row) !== identity(first)))
          throw new Error("Tier rows have incompatible native identities");
        if (input.product_name && input.product_name !== first.productName)
          throw new Error("Selected native product contradicts request");
        if (input.meter_name && input.meter_name !== first.meterName)
          throw new Error("Selected native meter contradicts request");
        for (const [field, native] of [
          ["sku_name", "skuName"],
          ["billing_region", "armRegionName"],
          ["native_unit", "unitOfMeasure"],
        ]) {
          if (Object.hasOwn(input, field) && input[field] !== first[native])
            throw new Error(`Selected native ${native} contradicts requested ${field}`);
        }
        const isV22 = estimate.schema_version === "cost-estimate-v2.2";
        const isV22Reservation = isV22 && input.commitment?.type === "reservation";
        const expectedPriceType = isV22Reservation ? "Reservation" : "Consumption";
        const expectedReservationTerm = isV22Reservation
          ? input.commitment?.term === "3-year"
            ? "3 Years"
            : input.commitment?.term === "1-year"
              ? "1 Year"
              : null
          : null;
        if (
          !isV22Reservation &&
          (Object.hasOwn(component, "reservation_term") || Object.hasOwn(component, "ri_breakeven_verified"))
        )
          throw new Error(
            "Component reservation_term and ri_breakeven_verified are forbidden without a bound v2.2 reservation commitment",
          );
        const isBaseVmComputeProduct =
          normalizeQueryGroupService(first.serviceName) === "Virtual Machines" &&
          /^Virtual Machines\b/i.test(first.productName) &&
          !/\b(windows|cloud services)\b/i.test(first.productName);
        const isAhbWindows = isV22 && input.license === "ahb-windows";
        if (Object.hasOwn(input, "operating_system")) {
          const osLower = typeof input.operating_system === "string" ? input.operating_system.trim().toLowerCase() : "";
          const osVerified = isAhbWindows
            ? osLower === "windows" && isBaseVmComputeProduct
            : osLower === "windows"
              ? /\bwindows\b/i.test(first.productName)
              : osLower === "linux"
                ? /\blinux\b/i.test(first.productName) || isBaseVmComputeProduct
                : false;
          if (!osVerified)
            throw new Error("Requested operating_system is unverifiable from the selected native product");
        }
        if (!isV22) {
          if (
            Object.hasOwn(input, "license") ||
            Object.hasOwn(input, "pricing_context") ||
            (Object.hasOwn(input, "commitment") && !["on-demand", "pay-as-you-go"].includes(input.commitment?.type))
          )
            throw new Error(
              "Requested licensing/pricing context/commitment is unverifiable from native Consumption evidence",
            );
        } else {
          if (Object.hasOwn(input, "pricing_context"))
            throw new Error("Requested pricing_context is unverifiable from native retail evidence");
          if (Object.hasOwn(input, "license")) {
            if (!["ahb-windows", "sa-passive-dr"].includes(input.license))
              throw new Error("Unsupported v2.2 license mode; use ahb-windows or sa-passive-dr");
            if (input.license === "ahb-windows" && !isBaseVmComputeProduct)
              throw new Error("ahb-windows requires a Virtual Machines base compute meter without Windows surcharge");
          }
          if (Object.hasOwn(input, "commitment")) {
            const cType = input.commitment?.type;
            if (!["on-demand", "pay-as-you-go", "reservation"].includes(cType))
              throw new Error("Unsupported commitment.type");
            if (cType === "reservation") {
              if (
                !expectedReservationTerm ||
                first.reservationTerm !== expectedReservationTerm ||
                component.reservation_term !== expectedReservationTerm
              )
                throw new Error("Reservation commitment requires matching 1-year/3-year native reservationTerm");
            }
          }
        }
        if (
          Object.hasOwn(input, "redundancy") &&
          ![first.productName, first.skuName, first.armSkuName].some((value) =>
            value
              .toLowerCase()
              .split(/[^a-z0-9]+/)
              .includes(String(input.redundancy).toLowerCase()),
          )
        )
          throw new Error("Requested redundancy is unverifiable from native identity");
        const usageEntries = Array.isArray(input.usage) ? input.usage : input.usage ? [input.usage] : [];
        const applicableUsage = usageEntries[usageEntries.length === 1 ? 0 : component.usage_index];
        const applicable = catalog.meters.filter(
          (row) =>
            normalizeQueryGroupService(row.serviceName) === normalizeQueryGroupService(input.service_name) &&
            [row.skuName, row.armSkuName].includes(input.sku) &&
            row.type === expectedPriceType &&
            (!expectedReservationTerm || row.reservationTerm === expectedReservationTerm) &&
            row.unitOfMeasure === first.unitOfMeasure &&
            row.armRegionName === first.armRegionName &&
            (!input.product_name || row.productName === input.product_name) &&
            (!input.meter_name || row.meterName === input.meter_name) &&
            (!applicableUsage?.meter_name || row.meterName === applicableUsage.meter_name),
        );
        if (new Set(applicable.map(identity)).size > 1)
          throw new Error("Ambiguous native product/meter applicability; request must select exact product/meter");
        const allBands = catalog.meters.filter((row) => identity(row) === identity(first));
        if (allBands.length !== selected.length) throw new Error("All evidenced tier bands must be selected");
        const duplicateKey = `${identity(first)}|${component.usage_index ?? 0}|${component.usage_dimension ?? "amount"}`;
        if (duplicated.has(duplicateKey)) throw new Error("Duplicate representations would double count a meter");
        duplicated.add(duplicateKey);
        if (!quote && component.usage_scope === "aggregate" && selected.length > 1) {
          const group = identity(first);
          if (aggregateTierGroups.has(group))
            throw new Error(
              "Aggregate tiered billing group cannot split free bands across components; consolidate usage or prove independent billing scopes",
            );
          aggregateTierGroups.add(group);
        }
        if (
          normalizeQueryGroupService(first.serviceName) !== normalizeQueryGroupService(input.service_name) ||
          ![first.skuName, first.armSkuName].includes(input.sku) ||
          first.currencyCode !== estimate.currency ||
          first.type !== expectedPriceType ||
          component.billing_region !== first.armRegionName ||
          (component.unit_of_measure ?? component.unitOfMeasure) !== first.unitOfMeasure
        )
          throw new Error("Component native service/SKU/billing region/currency/type/unit mismatch");
        if (
          component.product_name !== first.productName ||
          component.meter_id !== first.meterId ||
          component.effective_start_date !== first.effectiveStartDate
        )
          throw new Error("Component native product/meter/effective date mismatch");
        if (first.armRegionName && first.armRegionName !== "Global" && first.armRegionName !== input.region)
          throw new Error("Billing region does not apply to deployment region");
        if (first.tierMinimumUnits === null) {
          if (
            selected.length !== 1 ||
            component.tier_bands ||
            component.tier_metadata_status !== "not-applicable-fixed-hourly" ||
            component.retail_price !== first.retailPrice
          )
            throw new Error("Missing tier metadata is allowed only for a documented single fixed-hourly meter");
        } else if (selected.length > 1 || first.tierMinimumUnits !== 0 || component.tier_bands) {
          if (Object.hasOwn(component, "retail_price"))
            throw new Error("Tiered components cannot also declare a separate flat rate");
          const actual = selected
            .map(({ tierMinimumUnits, retailPrice }) => ({ tierMinimumUnits, retailPrice }))
            .sort((a, b) => a.tierMinimumUnits - b.tierMinimumUnits);
          const declared = [...(component.tier_bands ?? [])].sort((a, b) => a.tierMinimumUnits - b.tierMinimumUnits);
          if (stableJson(actual) !== stableJson(declared)) throw new Error("Native tier/rate mismatch");
          computeTieredCharge(0, actual);
        } else if (component.retail_price !== first.retailPrice) throw new Error("Native rate mismatch");
        if (quote) {
          if (input.native_unit !== first.unitOfMeasure)
            throw new Error("Quoted native unit differs from request applicability");
          continue;
        }
        const conversion = component.unit_conversion;
        if (
          !conversion ||
          conversion.native_unit !== first.unitOfMeasure ||
          !conversion.usage_unit ||
          !conversion.reason ||
          component.free_grant_units
        )
          throw new Error("Explicit labelled native unit conversion required; grants must be evidenced tiers");
        validateNativeConversion(conversion);
        if (component.quantity !== undefined && component.quantity !== input.quantity)
          throw new Error("Component quantity contradicts request");
        const usage = Array.isArray(input.usage) ? input.usage : input.usage ? [input.usage] : [];
        const dimension = component.usage_dimension;
        let usageIndex = component.usage_index;
        if (usageIndex !== undefined && (!Number.isInteger(usageIndex) || usageIndex < 0 || usageIndex >= usage.length))
          throw new Error("Component usage_index does not identify a requested usage entry");
        if (usage.length > 1 && (!Number.isInteger(usageIndex) || usageIndex < 0 || usageIndex >= usage.length))
          throw new Error("Multiple usage entries require an explicit usage_index for every component");
        if (usage.length === 1) usageIndex = 0;
        const declared = usage[usageIndex];
        if (declared && dimension && declared.dimension !== dimension && !Object.hasOwn(declared, dimension))
          throw new Error("Component usage dimension does not identify its requested usage entry");
        const amount = declared?.dimension === dimension || !dimension ? declared?.amount : declared?.[dimension];
        if (declared) {
          if (declared.meter_name && declared.meter_name !== first.meterName)
            throw new Error("Usage entry meter applicability contradicts native evidence");
          if (
            amount !== component.usage_amount ||
            declared.scope !== component.usage_scope ||
            (declared.unit && declared.unit !== conversion.usage_unit)
          )
            throw new Error("Calculation usage contradicts request");
          covered.add(`${usageIndex}:${Object.hasOwn(declared, "amount") ? "amount" : dimension}`);
        } else {
          const implicitHourly =
            serviceRecipe(input) === null &&
            component.usage_amount === (input.hours_per_month ?? HOURS_PER_MONTH) &&
            conversion.usage_unit === "hours" &&
            /^(1\s*\/?\s*)?hours?$/i.test(first.unitOfMeasure) &&
            conversion.units_per_native_unit === 1 &&
            component.usage_scope === "per-instance";
          const implicitMonthly =
            serviceRecipe(input) === null &&
            input.hours_per_month === undefined &&
            component.usage_amount === 1 &&
            conversion.usage_unit === "months" &&
            /^(1\s*\/\s*)?months?$/i.test(first.unitOfMeasure) &&
            conversion.units_per_native_unit === 1 &&
            component.usage_scope === "per-instance";
          if (!implicitHourly && !implicitMonthly) throw new Error("Calculation lacks exact request usage coverage");
        }
        const isHourlyUnit = conversion.usage_unit === "hours" || /^(1\s*\/?\s*)?hours?$/i.test(first.unitOfMeasure);
        const declaredHours = declared && isHourlyUnit ? amount : undefined;
        if (
          declaredHours !== undefined &&
          input.hours_per_month !== undefined &&
          declaredHours !== input.hours_per_month
        )
          throw new Error("Requested hours_per_month contradicts declared hourly usage");
        const effectiveHours =
          declaredHours ?? input.hours_per_month ?? (isHourlyUnit ? component.usage_amount : HOURS_PER_MONTH);
        if (Object.hasOwn(component, "hours_per_month") && component.hours_per_month !== effectiveHours)
          throw new Error("Component hours_per_month contradicts bound request or matched hourly usage");
        if (
          Object.hasOwn(component, "ri_breakeven_verified") &&
          component.ri_breakeven_verified !== Boolean(input.ri_breakeven_verified)
        )
          throw new Error("Component ri_breakeven_verified contradicts bound request");
        if (isV22Reservation && effectiveHours < HOURS_PER_MONTH && input.ri_breakeven_verified !== true)
          throw new Error(
            "Cold-standby (<730h/mo) resource cannot apply Reservation without bound ri_breakeven_verified",
          );
        computeComponentCost(component, input.quantity);
      } catch (error) {
        errors.push(`${resource.name}: ${error.message}`);
      }
    }
    if (!quote) {
      for (const dimension of serviceRecipe(input) ?? []) {
        const usage = Array.isArray(input.usage) ? input.usage : input.usage ? [input.usage] : [];
        if (
          !usage.some((entry, index) => covered.has(`${index}:${entry.dimension === dimension ? "amount" : dimension}`))
        )
          errors.push(`${resource.name}: missing calculation for ${dimension}`);
      }
      const requestedUsage = Array.isArray(input.usage) ? input.usage : input.usage ? [input.usage] : [];
      for (const [index, entry] of requestedUsage.entries()) {
        const dimensions = Object.hasOwn(entry, "amount")
          ? ["amount"]
          : Object.entries(entry)
              .filter(([key, value]) => typeof value === "number" && key !== "billable_days_per_month")
              .map(([key]) => key);
        for (const dimension of dimensions)
          if (!covered.has(`${index}:${dimension}`))
            errors.push(`${resource.name}: missing calculation coverage for usage[${index}].${dimension}`);
      }
      if (input.usage && !covered.size) errors.push(`${resource.name}: missing usage calculation coverage`);
      try {
        const calculated = calculateLineCost(basis);
        if (calculated === null || !Number.isFinite(calculated) || calculated !== resource.monthly_cost)
          errors.push(`${resource.name}: monthly cost contradicts deterministic calculation basis`);
      } catch (error) {
        errors.push(`${resource.name}: ${error.message}`);
      }
    }
  }
  if (seen.size !== request.lines.length) errors.push("Incomplete request/resource coverage");
  if (used.size !== catalogs.size) errors.push("Unreferenced pricing evidence");
  const evidenceCalls = [...catalogs.values()]
    .filter((catalog) => !catalog.historical)
    .reduce((sum, { evidence }) => sum + (evidence.source === "mcp" ? 1 : evidence.requests_used), 0);
  if (Number(estimate.mcp_calls_used) + Number(estimate.direct_api_calls_used ?? 0) < evidenceCalls)
    errors.push("Issued request counts contradict captured evidence");
  const historicalScopes = new Set(
    [...catalogs.values()].filter((catalog) => catalog.historical).map(({ ledgerInfo }) => ledgerInfo.path),
  );
  const ledgers = new Map(
    [...catalogs.values()]
      .filter((catalog) => !catalog.historical)
      .map(({ ledgerInfo }) => [ledgerInfo.path, ledgerInfo.ledger]),
  );
  if (authority) ledgers.set(authority.ledgerInfo.path, authority.ledgerInfo.ledger);
  const allAttempts = [...ledgers.entries()].flatMap(([filename, ledger]) =>
    historicalScopes.has(filename)
      ? ledger.attempts.filter(
          (attempt) =>
            !attempt.issued_confirmed ||
            !attempt.request_binding_sha256 ||
            attempt.request_binding_sha256 === authority?.sha256,
        )
      : ledger.attempts,
  );
  const external = [...ledgers.entries()].reduce(
    (sum, [filename, ledger]) => sum + (historicalScopes.has(filename) ? 0 : (ledger.external_requests_used ?? 0)),
    0,
  );
  const mcpIssued = allAttempts.filter((attempt) => attempt.source === "mcp" && attempt.issued_confirmed).length;
  const directIssued = allAttempts.filter((attempt) => attempt.source === "direct" && attempt.issued_confirmed).length;
  const unknown = allAttempts.filter((attempt) => !attempt.issued_confirmed).length;
  if (
    Number(estimate.mcp_calls_used) < mcpIssued ||
    Number(estimate.direct_api_calls_used ?? 0) < directIssued ||
    Number(estimate.mcp_calls_used) + Number(estimate.direct_api_calls_used ?? 0) !==
      mcpIssued + directIssued + external
  )
    errors.push("Published issued-call accounting must match the durable ledger");
  if (
    (estimate.unknown_request_reservations ?? 0) !== unknown ||
    [...ledgers.values()].some(
      (ledger) => ledger.attempts.length + (ledger.external_requests_used ?? 0) > maxRequestsFor(ledger),
    )
  )
    errors.push("Unknown reservations and conservative request budget must match the durable ledger");
  if (
    [...catalogs.values()].some(({ evidence }) => evidence.schema_version === "retail-price-evidence-v1") &&
    typeof estimate.data_source === "string" &&
    !estimate.data_source.includes("direct fallback")
  )
    errors.push("Direct pricing evidence must identify direct fallback in data_source");
}

export function validateRateQuote(quote, options = {}) {
  const errors = [];
  const snapshots = options.snapshots ?? [];
  if (!quote || typeof quote !== "object" || Array.isArray(quote))
    return { ok: false, errors: ["Rate quote must be an object"] };
  if (
    quote?.schema_version !== "retail-rate-quote-v1" ||
    quote.purpose !== "rate-quote" ||
    !["COMPLETE", "FAILED"].includes(quote.status)
  )
    errors.push("Invalid rate-quote contract");
  if (["monthly_total", "yearly_total", "manifest_writeback"].some((key) => Object.hasOwn(quote ?? {}, key)))
    errors.push("Rate quote cannot carry monthly totals or manifest writeback");
  if (!Array.isArray(quote?.resources) || !Array.isArray(quote?.unresolved_items))
    errors.push("Quote resources/unresolved_items required");
  if (quote?.resources?.some((resource) => Object.hasOwn(resource, "monthly_cost")))
    errors.push("Rate quote resources cannot contain monthly costs");
  if (
    ![quote?.mcp_calls_used, quote?.direct_api_calls_used ?? 0].every(
      (count) => Number.isInteger(count) && count >= 0,
    ) ||
    (quote?.mcp_calls_used ?? 0) + (quote?.direct_api_calls_used ?? 0) > maxRequestsFor(quote)
  )
    errors.push("Invalid rate-quote shared request accounting");
  if (!/^[A-Z]{3}$/.test(quote.currency ?? "") || !ALLOWED_DATA_SOURCES.has(quote.data_source))
    errors.push("Quote currency and explicit supported data_source are required");
  if (quote?.status === "COMPLETE") {
    if (quote.unresolved_items?.length) errors.push("COMPLETE quote has unresolved inputs");
    currentTimestamp(quote.queried_at, options, "queried_at", errors);
    try {
      validateLinkedPricing(quote, { cwd: process.cwd(), ...options, snapshots }, errors, true);
    } catch (error) {
      errors.push(`Invalid linked quote evidence: ${error.message}`);
    }
  } else if (!quote?.unresolved_items?.length) errors.push("FAILED quote must identify unresolved items");
  try {
    assertSnapshots(snapshots);
  } catch (error) {
    errors.push(error.message);
  }
  return { ok: !errors.length, errors };
}

function validateEvidenceReferences(estimate, cwd) {
  const errors = [];
  const entries = estimate.retail_api_evidence;
  if (!Array.isArray(entries) || entries.length === 0) return errors;

  for (const [idx, entry] of entries.entries()) {
    const label = `retail_api_evidence[${idx}]`;
    if (!entry || typeof entry !== "object") {
      errors.push(`${label}: must be an object`);
      continue;
    }
    if (typeof entry.evidence_path !== "string" || !entry.evidence_path.trim()) {
      errors.push(`${label}: evidence_path is required`);
      continue;
    }
    if (!Array.isArray(entry.resource_names) || entry.resource_names.length === 0) {
      errors.push(`${label}: resource_names must be a non-empty array`);
    }
    if (!Array.isArray(entry.selected_meters) || entry.selected_meters.length === 0) {
      errors.push(`${label}: selected_meters must be a non-empty array`);
    }
    if (typeof entry.calculation !== "string" || !entry.calculation.trim()) {
      errors.push(`${label}: calculation is required`);
    }
    let evidenceFile = resolveWorkspacePath(entry.evidence_path, cwd);
    if (!fs.existsSync(evidenceFile)) {
      const pdir = projectDirFromPath(evidenceFile);
      if (isLayoutV2(pdir)) evidenceFile = resolveProjectFile(pdir, entry.evidence_path);
    }
    if (!fs.existsSync(evidenceFile)) {
      errors.push(`${label}: evidence file does not exist: ${entry.evidence_path}`);
      continue;
    }
    try {
      const payload = JSON.parse(fs.readFileSync(evidenceFile, "utf8"));
      if (payload.schema_version !== "retail-price-evidence-v1" || !Array.isArray(payload.pages)) {
        errors.push(`${label}: invalid retail-price-evidence-v1 structure in ${entry.evidence_path}`);
        continue;
      }
      const catalogMeterIds = new Set();
      for (const page of payload.pages) {
        const digest = createHash("sha256")
          .update(String(page.raw_response ?? ""))
          .digest("hex");
        if (digest !== page.response_sha256) {
          errors.push(`${label}: SHA-256 mismatch in ${entry.evidence_path}`);
        }
        const parsedPage = JSON.parse(page.raw_response);
        for (const item of parsedPage.Items ?? []) {
          if (item.meterId) catalogMeterIds.add(item.meterId);
        }
      }
      for (const selected of entry.selected_meters ?? []) {
        if (!selected.meterId || !catalogMeterIds.has(selected.meterId)) {
          errors.push(`${label}: selected meterId '${selected.meterId}' not found in ${entry.evidence_path}`);
        }
      }
    } catch (error) {
      errors.push(`${label}: failed to parse evidence file ${entry.evidence_path}: ${error.message}`);
    }
  }
  return errors;
}

export function validateEstimate(estimate, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const errors = [];
  const warnings = [];
  const snapshots = options.snapshots ?? [];

  if (!estimate || typeof estimate !== "object" || Array.isArray(estimate)) {
    return { ok: false, errors: ["Estimate must be a JSON object"], warnings };
  }
  if (estimate.schema_version === "retail-rate-quote-v1" || estimate.purpose === "rate-quote")
    return { ok: false, errors: ["Rate quote is not a monthly estimate"], warnings };
  if (!options.legacyAudit && !["cost-estimate-v2", "cost-estimate-v2.2"].includes(estimate.schema_version))
    errors.push(
      "Authoritative estimates require cost-estimate-v2 or cost-estimate-v2.2; use explicit legacy-audit for historical data",
    );
  if (!options.legacyAudit && estimate.purpose !== "monthly-estimate")
    errors.push("Authoritative monthly estimates require purpose monthly-estimate");

  for (const field of [
    "status",
    "project_name",
    "region",
    "currency",
    "resources",
    "optimization_notes",
    "savings_status",
    "savings_reason",
    "eligible_strategies",
    "data_source",
    "queried_at",
    "confidence",
    "unresolved_items",
    "mcp_calls_used",
    "budget_exceeded",
  ]) {
    if (!Object.hasOwn(estimate, field)) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  if (errors.length > 0) return { ok: false, errors, warnings };

  if (estimate.status !== "COMPLETE" && estimate.status !== "FAILED") {
    errors.push(`status must be 'COMPLETE' or 'FAILED' (never 'PARTIAL'); got '${estimate.status}'`);
  }
  if (!["High", "Medium", "Low"].includes(estimate.confidence)) {
    errors.push(`confidence must be 'High', 'Medium', or 'Low'; got '${estimate.confidence}'`);
  }
  if (estimate.status === "COMPLETE" && estimate.confidence === "Low") {
    errors.push("COMPLETE estimate must never have Low confidence");
  }
  if (!ALLOWED_DATA_SOURCES.has(estimate.data_source)) {
    errors.push(`Unsupported data_source: '${estimate.data_source}'`);
  }
  if (!/^[A-Z]{3}$/.test(estimate.currency ?? "")) {
    errors.push(`Invalid currency: '${estimate.currency}'`);
  }
  if (!Number.isFinite(Date.parse(estimate.queried_at))) {
    errors.push(`queried_at must be a valid ISO-8601 timestamp`);
  }
  if (!options.legacyAudit) currentTimestamp(estimate.queried_at, options, "queried_at", errors);

  const mcpCalls = estimate.mcp_calls_used;
  const directCalls = estimate.direct_api_calls_used ?? 0;
  const maxCeiling = maxRequestsFor(estimate);
  if (!Number.isInteger(mcpCalls) || mcpCalls < 0 || !Number.isInteger(directCalls) || directCalls < 0) {
    errors.push("mcp_calls_used and direct_api_calls_used must be nonnegative integers");
  } else if (mcpCalls + directCalls > maxCeiling) {
    errors.push(`Total requests (${mcpCalls} MCP + ${directCalls} direct) exceed ceiling of ${maxCeiling}`);
  }

  if (!Array.isArray(estimate.resources)) {
    errors.push("resources must be an array");
    return { ok: false, errors, warnings };
  }
  try {
    assessmentPricingContext(estimate, "resource_list", estimate.resources);
  } catch (error) {
    errors.push(error.message);
  }

  let hasUpperBound = false;
  for (const [idx, res] of estimate.resources.entries()) {
    const label = `resources[${idx}] (${res?.name ?? "unnamed"})`;
    if (!res || typeof res !== "object") {
      errors.push(`${label}: must be an object`);
      continue;
    }
    for (const req of ["name", "service_name", "sku", "region", "quantity", "notes"]) {
      if (res[req] === undefined || res[req] === null || res[req] === "") {
        errors.push(`${label}: missing required field '${req}'`);
      }
    }
    if (!Number.isFinite(Number(res.quantity)) || Number(res.quantity) <= 0) {
      errors.push(`${label}: quantity must be a positive number`);
    }
    if (res.monthly_cost !== null && res.monthly_cost !== undefined) {
      if (!Number.isFinite(Number(res.monthly_cost)) || Number(res.monthly_cost) < 0) {
        errors.push(`${label}: monthly_cost must be a finite nonnegative number or null`);
      }
    } else if (estimate.status === "COMPLETE") {
      errors.push(`${label}: monthly_cost cannot be null when status is COMPLETE`);
    }
    if (res.estimate_kind === "upper_bound" || /\bupper[- ]bound\b/i.test(res.notes ?? "")) {
      hasUpperBound = true;
    }
    if (options.legacyAudit && /closest published (catalog )?meter/i.test(res.notes ?? "")) {
      warnings.push(`${label}: uses 'closest published meter' substitution assumption in notes`);
    }
  }

  if (hasUpperBound && estimate.confidence === "High") {
    errors.push("Estimate containing an upper-bound line cannot report High confidence");
  }

  const isCandidateMode = options.legacyAudit
    ? Array.isArray(estimate.decisions) && estimate.decisions.length > 0
    : estimate.request_snapshot?.mode === "candidate_sets";

  if (estimate.status === "COMPLETE") {
    if (!options.legacyAudit) {
      try {
        validateLinkedPricing(estimate, { cwd, ...options, snapshots }, errors);
      } catch (error) {
        errors.push(`Invalid linked estimate evidence: ${error.message}`);
      }
    }
    if (!Array.isArray(estimate.unresolved_items) || estimate.unresolved_items.length > 0) {
      errors.push("COMPLETE estimate must have an empty unresolved_items[] array");
    }
    if (estimate.budget_exceeded === true) {
      errors.push("COMPLETE estimate cannot have budget_exceeded = true");
    }
    if (isCandidateMode) {
      if (!options.legacyAudit) {
        const requested = new Map();
        for (const line of estimate.request_snapshot?.lines ?? []) {
          if (!requested.has(line.decision_id)) requested.set(line.decision_id, []);
          requested.get(line.decision_id).push(line.name);
        }
        const decisions = estimate.decisions ?? [];
        if (
          !Array.isArray(decisions) ||
          decisions.length !== requested.size ||
          decisions.some(
            (decision) =>
              !decision ||
              !Array.isArray(decision.candidates) ||
              decision.candidates.some((candidate) => !candidate || typeof candidate.label !== "string"),
          ) ||
          new Set(decisions.map((decision) => decision.decision_id)).size !== requested.size
        )
          errors.push("Candidate decisions must exactly cover every requested decision");
        else
          for (const decision of decisions) {
            const names = requested.get(decision.decision_id);
            const labels = decision.candidates?.map((candidate) => candidate.label) ?? [];
            if (
              !names ||
              stableJson([...names].sort()) !== stableJson([...labels].sort()) ||
              new Set(labels).size !== labels.length
            )
              errors.push(`decisions[${decision.decision_id}]: exact requested candidate coverage is required`);
          }
      }
      if (Number(estimate.monthly_total) !== 0 || Number(estimate.yearly_total) !== 0) {
        errors.push("candidate_sets mode must report monthly_total = 0 and yearly_total = 0");
      }
      for (const decision of Array.isArray(estimate.decisions) ? estimate.decisions : []) {
        const candidates = Array.isArray(decision?.candidates) ? decision.candidates : [];
        if (!decision || !Array.isArray(decision.candidates)) {
          errors.push("Each decision requires a candidates array");
          continue;
        }
        if (candidates.some((candidate) => !candidate || typeof candidate.label !== "string")) {
          errors.push("Each candidate requires an explicit label");
          continue;
        }
        if (!options.legacyAudit) {
          for (const candidate of candidates) {
            const resource = estimate.resources.find(
              (line) => line.name === candidate.label && line.decision_id === decision.decision_id,
            );
            if (!resource || candidate.monthly_cost !== resource.monthly_cost)
              errors.push(`decisions[${decision.decision_id}]: candidate cost lacks verified resource coverage`);
          }
        }
        const completeCandidates = candidates.filter(
          (c) => Number.isFinite(Number(c.monthly_cost)) && c.estimate_kind !== "upper_bound",
        );
        if (completeCandidates.length === 0) {
          errors.push(
            `decisions[${decision.decision_id}]: COMPLETE candidate_sets decision requires resolved candidates`,
          );
          continue;
        }
        const sorted = [...completeCandidates].sort((a, b) => {
          const diff = Number(a.monthly_cost) - Number(b.monthly_cost);
          if (Math.abs(diff) > 1e-6) return diff;
          return String(a.label).localeCompare(String(b.label));
        });
        if (decision.winner_label !== sorted[0].label) {
          errors.push(
            `decisions[${decision.decision_id}]: winner_label '${decision.winner_label}' does not match lowest complete candidate '${sorted[0].label}'`,
          );
        }
      }
    } else {
      if (!options.legacyAudit && estimate.decisions?.length)
        errors.push("Non-candidate requests cannot publish candidate decisions");
      const sum = round6(estimate.resources.reduce((acc, r) => acc + Number(r.monthly_cost ?? 0), 0));
      const monthly = Number(estimate.monthly_total);
      const yearly = Number(estimate.yearly_total);
      if (!Number.isFinite(monthly) || Math.abs(sum - monthly) > 1e-5) {
        errors.push(`monthly_total (${estimate.monthly_total}) does not equal sum of resources (${sum})`);
      }
      if (!Number.isFinite(yearly) || Math.abs(yearly - monthly * 12) > 1e-4) {
        errors.push(
          `yearly_total (${estimate.yearly_total}) does not equal monthly_total * 12 (${round6(monthly * 12)})`,
        );
      }
    }
  } else if (estimate.status === "FAILED") {
    if (!Array.isArray(estimate.unresolved_items) || estimate.unresolved_items.length === 0) {
      errors.push("FAILED estimate must list at least one entry in unresolved_items[]");
    }
    if (!options.legacyAudit && (estimate.monthly_total !== null || estimate.yearly_total !== null))
      errors.push("FAILED estimates cannot publish success-shaped totals; monthly_total/yearly_total must be null");
  }

  if (options.legacyAudit && Array.isArray(estimate.retail_api_evidence) && estimate.retail_api_evidence.length > 0) {
    if (!estimate.data_source.includes("direct fallback")) {
      errors.push("Estimate with retail_api_evidence[] must identify direct fallback in data_source");
    }
    if (options.verifyEvidenceFiles !== false) {
      errors.push(...validateEvidenceReferences(estimate, cwd));
    }
  }

  if (!options.legacyAudit) {
    try {
      assertSnapshots(snapshots);
    } catch (error) {
      errors.push(error.message);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

function matchManifestServiceId(resource, serviceIds) {
  if (resource.source_kind === "supplemental") return null;
  if (resource.manifest_service_id && serviceIds.has(resource.manifest_service_id)) {
    return resource.manifest_service_id;
  }
  const name = String(resource.name ?? "");
  if (serviceIds.has(name)) return name;
  for (const id of serviceIds) {
    if (name.startsWith(`${id} (`) || name.startsWith(`${id}-`)) {
      return id;
    }
  }
  return null;
}

export function buildCompactSummary(estimate, outputPath) {
  const relPath = outputPath.startsWith(`${ROOT}${path.sep}`)
    ? path.relative(ROOT, outputPath).replaceAll("\\", "/")
    : outputPath;
  if (estimate.purpose === "rate-quote")
    return [
      `RATE QUOTE ${estimate.status}`,
      `file_path: ${relPath}`,
      `status: ${estimate.status}`,
      `currency: ${estimate.currency}`,
      `resource_count: ${estimate.resources.length}`,
      `unresolved_items: ${estimate.unresolved_items.length}`,
    ].join("\n");
  const lines = [
    `COST ESTIMATE ${estimate.status}`,
    `file_path: ${relPath}`,
    `status: ${estimate.status}`,
    `region: ${estimate.region}`,
    `currency: ${estimate.currency}`,
    `monthly_total: ${estimate.monthly_total}`,
    `yearly_total: ${estimate.yearly_total}`,
    `resource_count: ${estimate.resources.length}`,
    `unresolved_items: ${estimate.unresolved_items.length}`,
    `savings_status: ${estimate.savings_status}`,
    `confidence: ${estimate.confidence}`,
    `mcp_calls_used: ${estimate.mcp_calls_used}/${maxRequestsFor(estimate)}`,
    `budget_exceeded: ${Boolean(estimate.budget_exceeded)}`,
  ];
  return lines.join("\n");
}

export function publishEstimate(options = {}) {
  const resolvedOptions = { ...options };
  if (options.manifestPath) {
    let manifestPath = resolveWorkspacePath(options.manifestPath, options.cwd);
    if (!fs.existsSync(manifestPath)) {
      const pdir = projectDirFromPath(manifestPath);
      if (isLayoutV2(pdir)) manifestPath = resolveContractPath(pdir, path.basename(manifestPath));
    }
    resolvedOptions.manifestPath = manifestPath;
  }
  const targets = [resolvedOptions.outputPath, ...(resolvedOptions.manifestPath ? [resolvedOptions.manifestPath] : [])]
    .map((target) => resolveWorkspacePath(target, options.cwd))
    .sort();
  const locks = [];
  try {
    for (const target of targets) {
      safePath(target);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const lock = `${target}.pricing-lock`;
      locks.push(acquirePricingLock(lock));
    }
    return publishLocked(resolvedOptions);
  } finally {
    for (const lock of locks.reverse()) releasePricingLock(lock);
  }
}

function recoverPublication(outputPath, draftPath, manifestPath, options) {
  const cwd = options.cwd ?? process.cwd();
  const journalPath = `${outputPath}.publication.json`;
  if (!fs.existsSync(journalPath)) return null;
  const journal = JSON.parse(readSnapshot(journalPath).bytes);
  const allowed = new Set(manifestPath ? [manifestPath, path.join(path.dirname(manifestPath), "sku-manifest.md")] : []);
  if (
    journal.schema_version !== "pricing-publication-v1" ||
    journal.output_path !== outputPath ||
    !Array.isArray(journal.entries) ||
    journal.entries.some((item) => !allowed.has(item.target))
  )
    throw new Error("Publication recovery scope differs; preserve the existing journal");
  if (fs.existsSync(draftPath) && readSnapshot(draftPath).sha256 !== journal.draft_sha256)
    throw new Error("Publication recovery requires the unchanged original draft");
  if (fs.existsSync(outputPath)) {
    const snapshot = readSnapshot(outputPath);
    if (
      snapshot.sha256 !== journal.output_sha256 ||
      journal.entries.some((item) => readSnapshot(item.target).sha256 !== item.staged_sha256)
    )
      throw new Error("Interrupted publication conflicts with current files; preserve journal");
    const estimate = JSON.parse(snapshot.bytes);
    const validation = validateEstimate(estimate, { ...options, cwd, legacyAudit: false });
    if (!validation.ok) throw new Error(`Interrupted publication evidence is invalid: ${validation.errors.join("; ")}`);
    fs.unlinkSync(journalPath);
    return { estimate, summary: buildCompactSummary(estimate, outputPath) };
  }
  for (const item of journal.entries) {
    const current = fs.existsSync(item.target) ? readSnapshot(item.target) : null;
    if (current?.sha256 === item.original_sha256 || (!current && !item.original_sha256)) continue;
    if (current?.sha256 !== item.staged_sha256)
      throw new Error("Interrupted publication target changed externally; preserve journal");
    if (item.original_sha256) {
      const bytes = Buffer.from(item.original_base64, "base64");
      if (sha256(bytes) !== item.original_sha256) throw new Error("Publication recovery backup hash mismatch");
      const rollback = `${item.target}.${randomUUID()}.rollback`;
      writeExclusive(rollback, bytes);
      fs.renameSync(rollback, item.target);
    } else fs.unlinkSync(item.target);
  }
  fs.unlinkSync(journalPath);
  return null;
}

function publishLocked(options) {
  const cwd = options.cwd ?? process.cwd();
  const draftPath = resolveWorkspacePath(options.draftPath, cwd);
  const outputPath = resolveWorkspacePath(options.outputPath, cwd);
  let manifestPath = options.manifestPath ? resolveWorkspacePath(options.manifestPath, cwd) : null;
  if (manifestPath && !fs.existsSync(manifestPath)) {
    const pdir = projectDirFromPath(manifestPath);
    if (isLayoutV2(pdir)) manifestPath = resolveContractPath(pdir, path.basename(manifestPath));
  }
  const recovered = recoverPublication(outputPath, draftPath, manifestPath, options);
  if (recovered) return recovered;
  assertNotSymlink(draftPath, "draftPath");
  assertNotSymlink(outputPath, "outputPath");
  if (manifestPath) assertNotSymlink(manifestPath, "manifestPath");

  if (!fs.existsSync(draftPath)) {
    throw new Error(`Draft file does not exist: ${draftPath}`);
  }
  if (fs.existsSync(outputPath)) {
    const err = new Error(
      `refuse_on_exists: ${outputPath} already exists; preserve evidence and select a new publication path`,
    );
    err.code = "REFUSE_ON_EXISTS";
    throw err;
  }

  const draftSnapshot = readSnapshot(draftPath);
  const estimate = JSON.parse(draftSnapshot.bytes);
  const snapshots = [draftSnapshot];
  if (estimate.purpose === "rate-quote") {
    if (manifestPath) throw new Error("Rate quote cannot write a manifest");
    const validation = validateRateQuote(estimate, { ...options, cwd, snapshots });
    if (!validation.ok) throw new Error(`Rate quote validation failed: ${validation.errors.join("; ")}`);
    assertSnapshots(snapshots);
    writeExclusive(outputPath, `${JSON.stringify(estimate, null, 2)}\n`);
    if (readSnapshot(draftPath).sha256 === draftSnapshot.sha256) fs.unlinkSync(draftPath);
    return { estimate, summary: buildCompactSummary(estimate, outputPath) };
  }
  for (const res of estimate.resources ?? []) {
    if (Array.isArray(res.components) || res.unit_of_measure || res.tier_bands) {
      res.calculation_basis = structuredClone(res);
      res.monthly_cost = calculateLineCost(res);
      delete res.components;
      delete res.unit_of_measure;
      delete res.tier_bands;
    } else if (res.monthly_cost !== null && res.monthly_cost !== undefined) {
      res.monthly_cost = round6(res.monthly_cost);
    }
  }

  const isCandidateMode = estimate.request_snapshot?.mode === "candidate_sets";
  if (isCandidateMode) {
    estimate.monthly_total = 0;
    estimate.yearly_total = 0;
  } else if (estimate.status === "COMPLETE") {
    const sum = round6(estimate.resources.reduce((acc, r) => acc + Number(r.monthly_cost ?? 0), 0));
    estimate.monthly_total = sum;
    estimate.yearly_total = round6(sum * 12);
  } else {
    estimate.monthly_total = null;
    estimate.yearly_total = null;
  }

  let manifest = null;
  let manifestSnapshot = null;
  if (manifestPath && estimate.status === "COMPLETE") {
    if (estimate.currency !== "USD") throw new Error("USD manifest writeback requires USD evidence");
    manifestSnapshot = readSnapshot(manifestPath);
    snapshots.push(manifestSnapshot);
    manifest = JSON.parse(manifestSnapshot.bytes);
    const serviceIds = new Set((manifest.services ?? []).map((s) => s.id));
    const totalsByService = new Map();
    for (const res of estimate.resources ?? []) {
      const matchedId = matchManifestServiceId(res, serviceIds);
      if (!matchedId) continue;
      totalsByService.set(matchedId, round6((totalsByService.get(matchedId) ?? 0) + Number(res.monthly_cost)));
    }
    estimate.manifest_writeback = [...totalsByService.entries()].map(([id, cost]) => ({
      id,
      cost_estimate_monthly_usd: cost,
      cost_estimated_at: estimate.queried_at,
    }));
  }

  const validation = validateEstimate(estimate, { ...options, cwd, snapshots, legacyAudit: false });
  if (!validation.ok) {
    throw new Error(`Estimate validation failed: ${validation.errors.join("; ")}`);
  }

  const staged = [];
  const committed = [];
  const journalPath = `${outputPath}.publication.json`;
  let ownsJournal = false;
  let outputCommitted = false;
  const stage = (target, bytes, original = null) => {
    const filename = `${target}.${randomUUID()}.pending`;
    writeExclusive(filename, bytes);
    const item = { target, filename, bytes, original };
    staged.push(item);
    return item;
  };
  try {
    if (manifest && Array.isArray(estimate.manifest_writeback) && options.manifestWriteback !== false) {
      const writebackMap = new Map(estimate.manifest_writeback.map((w) => [w.id, w]));
      for (const service of manifest.services ?? []) {
        const wb = writebackMap.get(service.id);
        if (wb) {
          service.cost_estimate_monthly_usd = wb.cost_estimate_monthly_usd;
          service.cost_estimated_at = wb.cost_estimated_at;
        }
      }
      const manifestStage = stage(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, manifestSnapshot);

      if (options.renderMarkdown === true) {
        const manifestMdPath = path.join(path.dirname(manifestPath), "sku-manifest.md");
        if (!fs.existsSync(RENDERER)) throw new Error("Requested manifest renderer is unavailable");
        {
          safePath(manifestMdPath);
          const originalMd = fs.existsSync(manifestMdPath) ? readSnapshot(manifestMdPath) : null;
          if (originalMd) snapshots.push(originalMd);
          const markdownStage = `${manifestMdPath}.${randomUUID()}.pending`;
          const rendered = spawnSync(
            process.execPath,
            [RENDERER, "--in", manifestStage.filename, "--out", markdownStage],
            {
              cwd: ROOT,
              encoding: "utf8",
            },
          );
          if (rendered.status !== 0 || !fs.existsSync(markdownStage)) {
            if (fs.existsSync(markdownStage)) fs.unlinkSync(markdownStage);
            throw new Error("Manifest Markdown render failed; publication not committed");
          }
          staged.push({
            target: manifestMdPath,
            filename: markdownStage,
            bytes: readSnapshot(markdownStage).bytes,
            original: originalMd,
          });
        }
      }
    }
    assertSnapshots(snapshots);
    const outputBytes = `${JSON.stringify(estimate, null, 2)}\n`;
    writeExclusive(
      journalPath,
      `${JSON.stringify(
        {
          schema_version: "pricing-publication-v1",
          output_path: outputPath,
          output_sha256: sha256(outputBytes),
          draft_sha256: draftSnapshot.sha256,
          entries: staged.map((item) => ({
            target: item.target,
            staged_sha256: sha256(item.bytes),
            original_sha256: item.original?.sha256 ?? null,
            original_base64: item.original?.bytes.toString("base64") ?? null,
          })),
        },
        null,
        2,
      )}\n`,
    );
    ownsJournal = true;
    for (const item of staged) {
      if (item.original) {
        assertSnapshots([item.original]);
        fs.renameSync(item.filename, item.target);
      } else {
        fs.linkSync(item.filename, item.target);
        fs.unlinkSync(item.filename);
      }
      committed.push(item);
    }
    assertSnapshots(snapshots.filter((snapshot) => !committed.some((item) => item.target === snapshot.path)));
    writeExclusive(outputPath, outputBytes);
    outputCommitted = true;
    if (readSnapshot(draftPath).sha256 === draftSnapshot.sha256) fs.unlinkSync(draftPath);
    fs.unlinkSync(journalPath);
    ownsJournal = false;
  } catch (error) {
    if (outputCommitted) throw error;
    for (const item of committed.reverse()) {
      if (readSnapshot(item.target).sha256 !== sha256(item.bytes)) continue;
      if (item.original) {
        const rollback = `${item.target}.${randomUUID()}.rollback`;
        writeExclusive(rollback, item.original.bytes);
        fs.renameSync(rollback, item.target);
      } else fs.unlinkSync(item.target);
    }
    if (ownsJournal && !fs.existsSync(outputPath)) fs.unlinkSync(journalPath);
    throw error;
  } finally {
    for (const item of staged) if (fs.existsSync(item.filename)) fs.unlinkSync(item.filename);
  }

  const summary = buildCompactSummary(estimate, outputPath);
  return { estimate, summary };
}

export function calculateScenarios(estimate, scenarios, options = {}) {
  const { cwd = process.cwd(), now = new Date(), ttlDays = 30 } = options;
  const validation = validateEstimate(estimate, {
    ...options,
    cwd,
    verifyEvidenceFiles: true,
    now,
    ttlDays,
    legacyAudit: false,
  });
  if (!validation.ok || estimate.status !== "COMPLETE")
    throw new Error(`Current complete evidence required: ${validation.errors.join("; ")}`);
  const queried = Date.parse(estimate.queried_at);
  const age = now.getTime() - queried;
  if (!Number.isFinite(queried) || !Number.isInteger(ttlDays) || ttlDays <= 0 || age < 0 || age > ttlDays * 86400000)
    throw new Error("Scenario meter evidence is stale or future-dated");
  if (!scenarios || typeof scenarios !== "object" || Array.isArray(scenarios) || !Object.keys(scenarios).length)
    throw new Error("Named scenario overrides are required");
  const names = new Set(estimate.resources.map((resource) => resource.name));
  if (names.size !== estimate.resources.length) throw new Error("Scenario resource names must be unique");
  const isV22 = estimate.schema_version === "cost-estimate-v2.2";
  const allowedOverrideKeys = isV22
    ? ["quantity", "usage_amount", "hours_per_month", "dimensions", "month1_factor"]
    : ["quantity", "usage_amount"];
  const results = {};
  for (const [scenario, overrides] of Object.entries(scenarios)) {
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides))
      throw new Error(`Invalid scenario ${scenario}`);
    if (Object.keys(overrides).some((name) => !names.has(name))) throw new Error("Scenario names an unpriced resource");
    const resources = estimate.resources.map((resource) => {
      const override = overrides[resource.name] ?? {};
      if (Object.keys(override).some((key) => !allowedOverrideKeys.includes(key)))
        throw new Error("Scenario cannot change SKU, meter, price, region or commitment");
      const basis = resource.calculation_basis;
      if (!basis && Object.keys(override).length)
        throw new Error("Scenario recalculation requires retained meter calculation inputs");
      if (
        basis &&
        (["name", "service_name", "sku", "region", "quantity"].some((key) => basis[key] !== resource[key]) ||
          calculateLineCost(basis) !== resource.monthly_cost)
      )
        throw new Error("Retained calculation basis differs from the verified resource");
      if (!Object.keys(override).length) return { name: resource.name, monthly_cost: resource.monthly_cost };
      const reqLine = estimate.request_snapshot?.lines?.find((l) => l.name === resource.name);
      const isReservedLine =
        reqLine?.commitment?.type === "reservation" ||
        Boolean(basis?.reservation_term) ||
        Boolean(basis?.components?.some((c) => Boolean(c?.reservation_term)));
      if (
        isReservedLine &&
        ((override.quantity !== undefined && override.quantity < resource.quantity) ||
          override.hours_per_month !== undefined ||
          override.usage_amount !== undefined)
      ) {
        throw new Error(
          "Prepaid Reservation commitment remains payable; model a separate purchase scenario instead of deallocating reserved lines",
        );
      }
      const line = structuredClone(basis);
      if (override.quantity !== undefined && line.components?.some((component) => Object.hasOwn(component, "quantity")))
        throw new Error("Component-specific quantities require an explicit pricing request");
      let month1Factor = 1;
      for (const key of Object.keys(override)) {
        if (key === "dimensions") {
          if (!override.dimensions || typeof override.dimensions !== "object" || Array.isArray(override.dimensions))
            throw new Error("Scenario dimensions must be a map of dimension -> finite nonnegative number");
          if (!Array.isArray(line.components))
            throw new Error("Dimension overrides require componentized calculation_basis");
          for (const [dim, val] of Object.entries(override.dimensions)) {
            if (typeof val !== "number" || !Number.isFinite(val) || val < 0)
              throw new Error("Scenario dimension values must be explicit finite nonnegative numbers");
            const matched = line.components.filter((c) => c.usage_dimension === dim);
            if (!matched.length) throw new Error(`Scenario dimension '${dim}' does not match any component`);
            for (const comp of matched) comp.usage_amount = val;
          }
          continue;
        }
        if (key === "month1_factor") {
          const factor = override.month1_factor;
          if (typeof factor !== "number" || !Number.isFinite(factor) || factor < 0 || factor > 1)
            throw new Error("Scenario month1_factor must be between 0 and 1");
          month1Factor = factor;
          continue;
        }
        if (
          typeof override[key] !== "number" ||
          !Number.isFinite(override[key]) ||
          override[key] < 0 ||
          (!isV22 && key === "quantity" && override[key] === 0)
        )
          throw new Error("Scenario quantity/usage must be explicit finite nonnegative numbers");
        if (key === "hours_per_month") {
          if (Array.isArray(line.components)) {
            for (const comp of line.components) {
              comp.hours_per_month = override[key];
              if (comp.unit_conversion?.usage_unit === "hours") comp.usage_amount = override[key];
            }
          } else {
            line.hours_per_month = override[key];
            if (line.unit_conversion?.usage_unit === "hours") line.usage_amount = override[key];
          }
        } else if (key === "usage_amount" && Array.isArray(line.components)) {
          if (line.components.length !== 1)
            throw new Error("Multi-meter usage requires a new explicit pricing request");
          line.components[0].usage_amount = override[key];
        } else line[key] = override[key];
      }
      const monthly = round6(calculateLineCost(line, { allowZeroQuantity: isV22 }) * month1Factor);
      if (!Number.isFinite(monthly)) throw new Error("Scenario calculation is unresolved");
      return { name: resource.name, monthly_cost: monthly };
    });
    const monthly = round6(resources.reduce((sum, resource) => sum + resource.monthly_cost, 0));
    results[scenario] = { resources, monthly_total: monthly, yearly_total: round6(monthly * 12) };
  }
  const baselineName = options.baselineScenario;
  if (baselineName && results[baselineName]) {
    const baseMonthly = results[baselineName].monthly_total;
    for (const [scenario, entry] of Object.entries(results)) {
      if (scenario === baselineName) continue;
      entry.savings_vs_baseline = round6(baseMonthly - entry.monthly_total);
      entry.savings_pct = baseMonthly > 0 ? round6(((baseMonthly - entry.monthly_total) / baseMonthly) * 100) : 0;
    }
  }
  return {
    status: "COMPARISON_ONLY",
    currency: estimate.currency,
    queried_at: estimate.queried_at,
    source_digest: createHash("sha256").update(JSON.stringify(estimate)).digest("hex"),
    mcp_calls_used: 0,
    direct_api_calls_used: 0,
    scenarios: results,
  };
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const subcommand = argv[0] && !argv[0].startsWith("--") ? argv[0] : null;
    const rawArgs = subcommand ? argv.slice(1) : argv;
    const { values } = parseArgs({
      args: rawArgs,
      options: {
        preflight: { type: "boolean" },
        publish: { type: "boolean" },
        validate: { type: "boolean" },
        "legacy-audit": { type: "boolean" },
        input: { type: "string" },
        request: { type: "string" },
        draft: { type: "string" },
        output: { type: "string" },
        manifest: { type: "string" },
        query: { type: "string" },
        response: { type: "string" },
        "call-id": { type: "string" },
        "native-call-id": { type: "string" },
        "original-request": { type: "string" },
        "retry-of": { type: "string" },
        overwrite: { type: "boolean" },
        "render-markdown": { type: "boolean" },
        help: { type: "boolean" },
      },
    });

    const mode =
      subcommand ??
      (values.preflight ? "preflight" : values.publish ? "publish" : values.validate ? "validate" : "help");

    if (values.help || mode === "help") {
      console.log(
        "Usage:\n" +
          "  node tools/scripts/cost-estimate.mjs preflight --request REQUEST.json\n" +
          "  node tools/scripts/cost-estimate.mjs publish --draft DRAFT.json.tmp --output OUTPUT.json --request ORIGINAL_REQUEST.json [--manifest sku-manifest.json] [--render-markdown]\n" +
          "  node tools/scripts/cost-estimate.mjs validate --input OUTPUT.json --request ORIGINAL_REQUEST.json\n" +
          "  node tools/scripts/cost-estimate.mjs validate --input HISTORICAL.json --legacy-audit\n" +
          "  node tools/scripts/cost-estimate.mjs validate-quote --input QUOTE.json --request ORIGINAL_REQUEST.json\n" +
          "  node tools/scripts/cost-estimate.mjs scenarios --input ESTIMATE.json --request SCENARIOS.json --original-request ORIGINAL_REQUEST.json\n" +
          "  node tools/scripts/cost-estimate.mjs reserve-query|issue-query|capture-response --request REQUEST.json --query QUERY.json --output OUTPUT.json --call-id RESERVATION_ID [--response ACTUAL_RESPONSE_FILE --native-call-id ACTUAL_NATIVE_ID] [--retry-of PRIOR_ID]",
      );
      return 0;
    }
    if (mode === "validate-quote") {
      if (!values.input) throw new Error("validate-quote requires --input");
      const quote = JSON.parse(readSnapshot(resolveWorkspacePath(values.input)).bytes);
      const result = validateRateQuote(quote, { requestPath: values.request });
      console.log(JSON.stringify(result, null, 2));
      return result.ok ? 0 : 1;
    }
    if (["reserve-query", "issue-query", "capture-response"].includes(mode)) {
      if (!values.request || !values.query || !values.output || !values["call-id"])
        throw new Error("Capture lifecycle requires --request --query --output --call-id");
      const raw = JSON.parse(readSnapshot(resolveWorkspacePath(values.request)).bytes);
      const preflight = validateCostRequest(raw);
      if (!preflight.ok) throw new Error(`Preflight failed: ${preflight.unresolved_items.join("; ")}`);
      const query = JSON.parse(readSnapshot(resolveWorkspacePath(values.query)).bytes);
      const output = resolveWorkspacePath(values.output);
      if (path.dirname(output) !== path.dirname(preflight.normalized.output_path))
        throw new Error("Output must share request evidence directory");
      const matchingLines = preflight.normalized.lines.filter(
        (line) =>
          normalizeQueryGroupService(line.service_name) === normalizeQueryGroupService(query.serviceName) &&
          (!query.armRegionName ||
            query.armRegionName === (line.billing_region ?? line.region) ||
            query.armRegionName === "Global") &&
          (!query.armSkuName || query.armSkuName === line.sku),
      );
      const expectedPriceTypes = new Set(
        matchingLines.map((line) => (line.commitment?.type === "reservation" ? "Reservation" : "Consumption")),
      );
      if (
        matchingLines.length === 0 ||
        query.currencyCode !== preflight.normalized.currency ||
        !["Consumption", "Reservation"].includes(query.priceType) ||
        !expectedPriceTypes.has(query.priceType)
      )
        throw new Error("Query must apply to the preflight request");
      const call_id = values["call-id"];
      const binding = bindCostRequest(raw, { requestPath: values.request });
      const reservation = reserveQuery({
        output,
        query,
        call_id,
        request_binding_path: binding.request_binding_path,
        retry_of: values["retry-of"],
        remaining_requests: preflight.normalized.remaining_requests,
      });
      let result;
      if (mode === "reserve-query") result = reservation;
      else if (mode === "issue-query")
        result = updateAttempt(output, call_id, { state: "issued", issued_at: new Date().toISOString() });
      else {
        if (!values.response) throw new Error("capture-response requires --response actual-response-file");
        if (!values["native-call-id"])
          throw new Error("capture-response requires --native-call-id from the actual native invocation");
        result = captureMcpResponse({
          output,
          query,
          call_id,
          native_call_id: values["native-call-id"],
          response_path: resolveWorkspacePath(values.response),
        });
      }
      console.log(JSON.stringify(result, null, 2));
      return result.status === "FAILED" ? 1 : 0;
    }
    if (mode === "scenarios") {
      if (!values.input || !values.request)
        throw new Error("scenarios requires --input estimate.json --request scenarios.json");
      const estimate = JSON.parse(fs.readFileSync(resolveWorkspacePath(values.input), "utf8"));
      const scenarios = JSON.parse(fs.readFileSync(resolveWorkspacePath(values.request), "utf8"));
      console.log(
        JSON.stringify(calculateScenarios(estimate, scenarios, { requestPath: values["original-request"] }), null, 2),
      );
      return 0;
    }

    if (mode === "preflight") {
      const reqArg = values.request ?? values.input;
      if (!reqArg) throw new Error("--request (or --input) is required for preflight");
      const reqPath = resolveWorkspacePath(reqArg);
      const raw = JSON.parse(fs.readFileSync(reqPath, "utf8"));
      const res = validateCostRequest(raw);
      const binding = res.ok ? bindCostRequest(raw, { requestPath: reqPath }) : null;
      console.log(
        JSON.stringify(
          {
            status: res.ok ? "PREFLIGHT_OK" : "PREFLIGHT_FAILED",
            mode: res.normalized?.mode ?? null,
            purpose: res.normalized?.purpose ?? null,
            request_snapshot: res.normalized ? pricingRequestSnapshot(res.normalized) : null,
            request_sha256: res.normalized ? digestObject(pricingRequestSnapshot(res.normalized)) : null,
            request_binding_path: binding?.request_binding_path ?? null,
            request_binding_sha256: binding?.request_binding_sha256 ?? null,
            line_count: res.normalized?.lines.length ?? 0,
            estimated_query_groups: res.normalized?.estimated_query_groups ?? 0,
            unresolved_items: res.unresolved_items,
          },
          null,
          2,
        ),
      );
      return res.ok ? 0 : 1;
    }

    if (mode === "validate") {
      if (!values.input) throw new Error("--input is required for validate");
      const target = resolveWorkspacePath(values.input);
      const est = JSON.parse(fs.readFileSync(target, "utf8"));
      const res = validateEstimate(est, { legacyAudit: Boolean(values["legacy-audit"]), requestPath: values.request });
      console.log(JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings }, null, 2));
      return res.ok ? 0 : 1;
    }

    if (mode === "publish") {
      if (!values.draft || !values.output) {
        throw new Error("--draft and --output are required for publish");
      }
      const { summary } = publishEstimate({
        draftPath: values.draft,
        outputPath: values.output,
        manifestPath: values.manifest ?? null,
        overwrite: Boolean(values.overwrite),
        renderMarkdown: Boolean(values["render-markdown"]),
        requestPath: values.request,
      });
      console.log(summary);
      return 0;
    }

    throw new Error(`Unknown subcommand: ${mode}`);
  } catch (error) {
    console.error(`Cost estimate helper FAILED: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main());
}
