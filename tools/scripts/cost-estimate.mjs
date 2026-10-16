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
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RENDERER = path.join(ROOT, "tools/scripts/render-sku-manifest-md.mjs");
const MAX_SHARED_REQUESTS = 20;
const HOURS_PER_MONTH = 730;
const DAYS_PER_MONTH = 365 / 12;

const ALLOWED_DATA_SOURCES = new Set([
  "Azure MCP pricing_get",
  "Azure MCP pricing_get + Azure Retail Prices API (direct fallback)",
  "Azure Retail Prices API (direct fallback)",
]);

const VARIABLE_SERVICE_NAMES = new Set(["Key Vault", "Log Analytics", "Azure DNS"]);

export function round6(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
}

export function resolveWorkspacePath(targetPath, cwd = process.cwd()) {
  if (typeof targetPath !== "string" || !targetPath.trim()) {
    throw new Error("Path must be a non-empty string");
  }
  if (path.isAbsolute(targetPath)) return path.normalize(targetPath);
  const resolvedCwd = path.resolve(cwd);
  const normalizedRel = targetPath.replaceAll("\\", "/");
  if (
    (resolvedCwd === ROOT || resolvedCwd.startsWith(`${ROOT}${path.sep}`)) &&
    (normalizedRel.startsWith("agent-output/") ||
      normalizedRel.startsWith("tools/") ||
      normalizedRel.startsWith(".github/"))
  ) {
    return path.resolve(ROOT, targetPath);
  }
  return path.resolve(resolvedCwd, targetPath);
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
    const usageSpec = manifestUsage[service.id] ?? service.usage ?? null;
    for (const stamp of stamps) {
      const stampEnvs =
        stamp && Array.isArray(stamp.environments) && stamp.environments.length > 0 ? stamp.environments : topEnvs;
      const stampSvcOverride = stamp?.service_overrides?.[service.id] ?? {};
      for (const env of stampEnvs) {
        const envOverride = service.environment_overrides?.[env] ?? {};
        const effective = mergeSparseService(service, envOverride, stampSvcOverride);
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
            name: `${service.id} (${env}${stampLabel}, ${region})`,
            manifest_service_id: service.id,
            source_kind: "manifest",
            environment: env,
            stamp: stamp?.id ?? null,
            service_name: effective.service,
            sku: effective.size,
            region,
            quantity,
            commitment: effective.commitment ?? { type: "on-demand" },
            usage: usageSpec,
            meter_name: effective.meter_name ?? usageSpec?.meter_name ?? null,
            upper_bound_ok: Boolean(usageSpec?.upper_bound_ok),
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
    if (VARIABLE_SERVICE_NAMES.has(serviceName)) {
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
    if (Object.hasOwn(item, "amount")) {
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount < 0 || (amount === 0 && !item.zero_usage_confirmed)) {
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
  const remainingRequests = Number(rawRequest.recovery?.remaining_requests ?? MAX_SHARED_REQUESTS);

  let manifestPath = null;
  let manifestServiceIds = [];
  let lines = [];

  if (mode === "manifest_path") {
    manifestPath = resolveWorkspacePath(rawRequest.manifest_path, cwd);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
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
      name: item.name ?? `${item.service_name}-${idx + 1}`,
      source_kind: "resource_list",
      service_name: item.service_name,
      sku: item.sku,
      region: item.region ?? rawRequest.region,
      quantity: Number(item.quantity ?? 1),
      usage: item.usage ?? null,
      meter_name: item.meter_name ?? null,
      upper_bound_ok: Boolean(item.upper_bound_ok),
    }));
  } else {
    if (!Array.isArray(rawRequest.candidate_sets) || rawRequest.candidate_sets.length === 0) {
      throw new Error("candidate_sets must be a non-empty array");
    }
    for (const set of rawRequest.candidate_sets) {
      if (!set.decision_id || !Array.isArray(set.candidates) || set.candidates.length === 0) {
        throw new Error("Each candidate_sets entry requires decision_id and a non-empty candidates[] array");
      }
      for (const candidate of set.candidates) {
        lines.push({
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

  const queryGroups = new Set(
    lines.map((line) => `${line.service_name}|${line.region}|${line.meter_name ?? "*"}|${currency}`),
  );

  return {
    mode,
    project_name: rawRequest.project_name.trim(),
    region: rawRequest.region.trim(),
    currency,
    output_path: outputPath,
    draft_path: draftPath,
    manifest_path: manifestPath,
    manifest_writeback: mode === "manifest_path" ? rawRequest.manifest_writeback !== false : false,
    manifest_service_ids: manifestServiceIds,
    overwrite,
    remaining_requests: remainingRequests,
    estimated_query_groups: queryGroups.size,
    lines,
    recovery: rawRequest.recovery ?? null,
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

  assertNotSymlink(normalized.output_path, "output_path");
  assertNotSymlink(normalized.draft_path, "draft_path");
  if (normalized.manifest_path) assertNotSymlink(normalized.manifest_path, "manifest_path");

  if (fs.existsSync(normalized.output_path) && !normalized.overwrite && !normalized.recovery) {
    unresolved.push(`output_path already exists and overwrite is false: ${normalized.output_path}`);
  }
  if (fs.existsSync(normalized.draft_path) && !normalized.recovery?.draft_path) {
    unresolved.push(
      `Stale temporary draft already exists (preserve or clear before running): ${normalized.draft_path}`,
    );
  }
  if (
    !Number.isInteger(normalized.remaining_requests) ||
    normalized.remaining_requests < 1 ||
    normalized.remaining_requests > MAX_SHARED_REQUESTS
  ) {
    unresolved.push(`remaining_requests must be an integer between 1 and ${MAX_SHARED_REQUESTS}`);
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
    if (line.usage !== null && line.usage !== undefined) {
      unresolved.push(...validateUsageEntry(line.name, line.service_name, line.sku, line.usage));
    } else if (
      VARIABLE_SERVICE_NAMES.has(line.service_name) ||
      (line.service_name === "Azure Monitor" && /alert/i.test(`${line.sku} ${line.name}`))
    ) {
      unresolved.push(...validateUsageEntry(line.name, line.service_name, line.sku, null));
    }
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

function computeComponentCost(component, defaultQuantity = 1) {
  const quantity = Number(component.quantity ?? defaultQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Component quantity must be a positive number");
  }
  const unit = (component.unit_of_measure ?? component.unitOfMeasure ?? "1 Hour").trim();
  const usageAmount = component.usage_amount ?? component.usage?.amount;
  const scope = component.usage_scope ?? component.usage?.scope ?? "per-instance";
  const multiplier = scope === "aggregate" ? 1 : quantity;
  const freeGrant = Number(component.free_grant_units ?? 0);

  if (Array.isArray(component.tier_bands) && component.tier_bands.length > 0) {
    if (!Number.isFinite(Number(usageAmount)) || Number(usageAmount) < 0) {
      throw new Error(`Tiered component requires finite usage_amount`);
    }
    const rawUnits = Math.max(0, Number(usageAmount) * multiplier - freeGrant);
    const unitScale = /^10k\b/i.test(unit) ? 10000 : /^1m\b/i.test(unit) ? 1000000 : 1;
    return computeTieredCharge(rawUnits / unitScale, component.tier_bands);
  }

  const rate = Number(component.retail_price ?? component.retailPrice ?? component.hourly_rate);
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error(`Component rate must be a nonnegative number`);
  }

  if (/^(1\s*)?hours?$/i.test(unit)) {
    const hours = Number(component.hours_per_month ?? HOURS_PER_MONTH);
    return rate * hours * quantity;
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
  if (/^10k\b|^10,000\b/i.test(unit)) {
    if (!Number.isFinite(Number(usageAmount)) || Number(usageAmount) < 0) {
      throw new Error(`Unit '${unit}' requires explicit usage_amount`);
    }
    const billableOps = Math.max(0, Number(usageAmount) * multiplier - freeGrant);
    return rate * (billableOps / 10000);
  }
  if (/^1m\b|^1,000,000\b/i.test(unit)) {
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

export function calculateLineCost(line) {
  if (!line || typeof line !== "object") throw new Error("Resource line must be an object");
  if (Array.isArray(line.components) && line.components.length > 0) {
    const total = line.components.reduce((sum, comp) => sum + computeComponentCost(comp, line.quantity ?? 1), 0);
    return round6(total);
  }
  if (line.unit_of_measure || line.unitOfMeasure || line.retail_price !== undefined || line.tier_bands) {
    return round6(computeComponentCost(line, line.quantity ?? 1));
  }
  if (line.monthly_cost !== undefined && line.monthly_cost !== null) {
    const val = Number(line.monthly_cost);
    if (!Number.isFinite(val) || val < 0) throw new Error(`Invalid monthly_cost on '${line.name}'`);
    return round6(val);
  }
  return null;
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
    const evidenceFile = resolveWorkspacePath(entry.evidence_path, cwd);
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

  if (!estimate || typeof estimate !== "object" || Array.isArray(estimate)) {
    return { ok: false, errors: ["Estimate must be a JSON object"], warnings };
  }

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

  const mcpCalls = Number(estimate.mcp_calls_used);
  const directCalls = Number(estimate.direct_api_calls_used ?? 0);
  if (!Number.isInteger(mcpCalls) || mcpCalls < 0 || !Number.isInteger(directCalls) || directCalls < 0) {
    errors.push("mcp_calls_used and direct_api_calls_used must be nonnegative integers");
  } else if (mcpCalls + directCalls > MAX_SHARED_REQUESTS) {
    errors.push(`Total requests (${mcpCalls} MCP + ${directCalls} direct) exceed ceiling of ${MAX_SHARED_REQUESTS}`);
  }

  if (!Array.isArray(estimate.resources)) {
    errors.push("resources must be an array");
    return { ok: false, errors, warnings };
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

  const isCandidateMode = Array.isArray(estimate.decisions) && estimate.decisions.length > 0;

  if (estimate.status === "COMPLETE") {
    if (!Array.isArray(estimate.unresolved_items) || estimate.unresolved_items.length > 0) {
      errors.push("COMPLETE estimate must have an empty unresolved_items[] array");
    }
    if (estimate.budget_exceeded === true) {
      errors.push("COMPLETE estimate cannot have budget_exceeded = true");
    }
    if (isCandidateMode) {
      if (Number(estimate.monthly_total) !== 0 || Number(estimate.yearly_total) !== 0) {
        errors.push("candidate_sets mode must report monthly_total = 0 and yearly_total = 0");
      }
      for (const decision of estimate.decisions) {
        const candidates = decision.candidates ?? [];
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
  }

  if (Array.isArray(estimate.retail_api_evidence) && estimate.retail_api_evidence.length > 0) {
    if (!estimate.data_source.includes("direct fallback")) {
      errors.push("Estimate with retail_api_evidence[] must identify direct fallback in data_source");
    }
    if (options.verifyEvidenceFiles !== false) {
      errors.push(...validateEvidenceReferences(estimate, cwd));
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
    `mcp_calls_used: ${estimate.mcp_calls_used}/${MAX_SHARED_REQUESTS}`,
    `budget_exceeded: ${Boolean(estimate.budget_exceeded)}`,
  ];
  return lines.join("\n");
}

export function publishEstimate(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const draftPath = resolveWorkspacePath(options.draftPath, cwd);
  const outputPath = resolveWorkspacePath(options.outputPath, cwd);
  const manifestPath = options.manifestPath ? resolveWorkspacePath(options.manifestPath, cwd) : null;
  const overwrite = Boolean(options.overwrite);

  assertNotSymlink(draftPath, "draftPath");
  assertNotSymlink(outputPath, "outputPath");
  if (manifestPath) assertNotSymlink(manifestPath, "manifestPath");

  if (!fs.existsSync(draftPath)) {
    throw new Error(`Draft file does not exist: ${draftPath}`);
  }
  if (fs.existsSync(outputPath) && !overwrite) {
    const err = new Error(`refuse_on_exists: ${outputPath} already exists and overwrite is false`);
    err.code = "REFUSE_ON_EXISTS";
    throw err;
  }

  const estimate = JSON.parse(fs.readFileSync(draftPath, "utf8"));
  for (const res of estimate.resources ?? []) {
    if (Array.isArray(res.components) || res.unit_of_measure || res.tier_bands) {
      res.monthly_cost = calculateLineCost(res);
      delete res.components;
      delete res.unit_of_measure;
      delete res.tier_bands;
    } else if (res.monthly_cost !== null && res.monthly_cost !== undefined) {
      res.monthly_cost = round6(res.monthly_cost);
    }
  }

  const isCandidateMode = Array.isArray(estimate.decisions) && estimate.decisions.length > 0;
  if (isCandidateMode) {
    estimate.monthly_total = 0;
    estimate.yearly_total = 0;
  } else if (
    estimate.status === "COMPLETE" ||
    (Array.isArray(estimate.resources) &&
      estimate.resources.length > 0 &&
      estimate.resources.every((r) => r.monthly_cost !== null && r.monthly_cost !== undefined))
  ) {
    const sum = round6(estimate.resources.reduce((acc, r) => acc + Number(r.monthly_cost ?? 0), 0));
    estimate.monthly_total = sum;
    estimate.yearly_total = round6(sum * 12);
  }

  let manifest = null;
  if (manifestPath && estimate.status === "COMPLETE") {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
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

  const validation = validateEstimate(estimate, { cwd, verifyEvidenceFiles: options.verifyEvidenceFiles !== false });
  if (!validation.ok) {
    throw new Error(`Estimate validation failed: ${validation.errors.join("; ")}`);
  }

  fs.writeFileSync(draftPath, `${JSON.stringify(estimate, null, 2)}\n`, "utf8");
  fs.renameSync(draftPath, outputPath);

  if (manifest && Array.isArray(estimate.manifest_writeback) && options.manifestWriteback !== false) {
    const writebackMap = new Map(estimate.manifest_writeback.map((w) => [w.id, w]));
    for (const service of manifest.services ?? []) {
      const wb = writebackMap.get(service.id);
      if (wb) {
        service.cost_estimate_monthly_usd = wb.cost_estimate_monthly_usd;
        service.cost_estimated_at = wb.cost_estimated_at;
      }
    }
    const manifestTmp = `${manifestPath}.tmp`;
    assertNotSymlink(manifestTmp, "manifestTmp");
    fs.writeFileSync(manifestTmp, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    fs.renameSync(manifestTmp, manifestPath);

    const manifestMdPath = path.join(path.dirname(manifestPath), "sku-manifest.md");
    if (fs.existsSync(RENDERER) && (fs.existsSync(manifestMdPath) || manifestPath.startsWith(ROOT))) {
      spawnSync(process.execPath, [RENDERER, "--in", manifestPath, "--out", manifestMdPath], {
        cwd: ROOT,
        encoding: "utf8",
      });
    }
  }

  const summary = buildCompactSummary(estimate, outputPath);
  return { estimate, summary };
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
        overwrite: { type: "boolean" },
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
          "  node tools/scripts/cost-estimate.mjs publish --draft DRAFT.json.tmp --output OUTPUT.json [--manifest sku-manifest.json] [--overwrite]\n" +
          "  node tools/scripts/cost-estimate.mjs validate --input OUTPUT.json [--legacy-audit]",
      );
      return 0;
    }

    if (mode === "preflight") {
      const reqArg = values.request ?? values.input;
      if (!reqArg) throw new Error("--request (or --input) is required for preflight");
      const reqPath = resolveWorkspacePath(reqArg);
      const raw = JSON.parse(fs.readFileSync(reqPath, "utf8"));
      const res = validateCostRequest(raw);
      console.log(
        JSON.stringify(
          {
            status: res.ok ? "PREFLIGHT_OK" : "PREFLIGHT_FAILED",
            mode: res.normalized?.mode ?? null,
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
      const res = validateEstimate(est, { legacyAudit: Boolean(values["legacy-audit"]) });
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
