#!/usr/bin/env node
/** Offline, evidence-bound projections. This tool never authorizes or executes actions. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { loadValidator } from "./_lib/ajv-validator.mjs";
import { readJson, writeJson } from "./_lib/json.mjs";
import { sumCosts, validateAssessmentCost, validateScopes } from "./assessment-cost.mjs";
import { comparableLineUsage, resolveWorkspacePath, validateEstimate } from "./cost-estimate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = path.resolve(HERE, "../schemas/assessment-action-register.schema.json");
const validateShape = loadValidator(SCHEMA);
const DAY = 86400000;
export const ACTION_REGISTER_VERSION = "action-register-v1";
export const ACTION_REGISTER_OUTPUTS = Object.freeze({
  input: "contracts/assessment-action-register.json",
  markdown: "04-assessment-action-register.md",
  workbook: "assets/04-assessment-action-register.xlsx",
  derived: "_meta/action-register-derived.json",
  receipt: "_meta/action-register-export.json",
});
const STAGED = {
  markdown: "_meta/action-register-staged.md",
  workbook: "_meta/action-register-staged.xlsx",
};
const TOOL_FILES = [
  "assessment-action-register.mjs",
  "render-assessment-action-register.py",
  "assessment-cost.mjs",
  "cost-estimate.mjs",
  "_lib/ajv-validator.mjs",
  "_lib/json.mjs",
  "_lib/project-paths.mjs",
  "../schemas/assessment-action-register.schema.json",
  "../schemas/assessment-cost.schema.json",
  "../schemas/cost-estimate.schema.json",
];
const CATEGORIES = new Set([
  "Retirements and lifecycle",
  "Security and access",
  "Reliability and recovery",
  "Performance and capacity",
  "Monitoring and operations",
  "Cost optimization and housekeeping",
]);

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function instant(value) {
  requireValue(
    typeof value === "string" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === value.slice(0, 10) &&
      Number(value.slice(11, 13)) <= 23 &&
      Number(value.slice(14, 16)) <= 59 &&
      Number(value.slice(17, 19)) <= 59,
    "Valid explicit ISO timestamp with timezone required",
  );
  return Date.parse(value);
}

/** Refuse symlinks even when they currently resolve inside the project. */
export function projectPath(root, relative, { missing = false } = {}) {
  requireValue(
    typeof relative === "string" &&
      relative.length > 0 &&
      !path.isAbsolute(relative) &&
      !relative.includes("\\") &&
      !relative.includes(":") &&
      !Array.from(relative).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) &&
      !relative.split("/").some((p) => ["", ".", ".."].includes(p)),
    "Path must be safe and project-relative",
  );
  const realRoot = fs.realpathSync(root);
  let target = realRoot;
  for (const part of relative.split("/")) {
    target = path.join(target, part);
    try {
      requireValue(!fs.lstatSync(target).isSymbolicLink(), `Symlink forbidden: ${relative}`);
    } catch (error) {
      requireValue(
        error.code === "ENOENT" && missing,
        error.code === "ENOENT" ? `Missing project file: ${relative}` : error.message,
      );
    }
  }
  return target;
}

function reader(root) {
  return (relative) => {
    const target = projectPath(root, relative);
    const stat = fs.statSync(target);
    requireValue(stat.isFile() && stat.size <= 32 * 1024 * 1024, "Evidence must be a bounded regular file");
    return fs.readFileSync(target);
  };
}

function nestedEvidencePath(root, relative) {
  const project = fs.realpathSync(root);
  const cwd =
    relative.startsWith("agent-output/") && path.basename(path.dirname(project)) === "agent-output"
      ? path.dirname(path.dirname(project))
      : project;
  const resolved = resolveWorkspacePath(relative, cwd);
  const confined = projectPath(root, path.relative(project, resolved).split(path.sep).join("/"));
  return path.relative(project, confined).split(path.sep).join("/");
}

function pointer(value, locator) {
  requireValue(typeof locator === "string" && locator.startsWith("/"), "JSON pointer required");
  for (const token of locator.slice(1).split("/")) {
    requireValue(!/~(?![01])/.test(token), "Invalid JSON pointer escape");
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    requireValue(
      !["__proto__", "prototype", "constructor"].includes(key) && value && Object.hasOwn(value, key),
      `Unresolved source locator: ${locator}`,
    );
    value = value[key];
  }
  return value;
}

function uniqueMap(rows, label) {
  const result = new Map();
  for (const row of rows) {
    requireValue(!result.has(row.id), `Duplicate ${label} ID: ${row.id}`);
    result.set(row.id, row);
  }
  return result;
}

function negate(value) {
  const canonical = sumCosts([value]);
  return canonical === "0" ? "0" : canonical.startsWith("-") ? canonical.slice(1) : `-${canonical}`;
}

/** Half away from zero; Excel receives only bounded two-decimal display values. */
export function displayCost(value) {
  if (value === null) return null;
  const text = sumCosts([value]);
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  let cents = BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
  if (Number(fraction[2] ?? "0") >= 5) cents++;
  requireValue(cents <= 999999999999999n, "Excel numeric magnitude exceeds reliable 15-digit display support");
  const digits = cents.toString().padStart(3, "0");
  return `${negative && cents !== 0n ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

export function safeEvidenceUrl(value) {
  const url = new URL(value);
  requireValue(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      ["learn.microsoft.com", "azure.microsoft.com", "apexops.pro"].includes(url.hostname),
    "Evidence URL must be credential-free HTTPS on an approved documentation host, without query parameters",
  );
  return url.href;
}

function toolHashes() {
  return Object.fromEntries(TOOL_FILES.map((file) => [file, digest(fs.readFileSync(path.resolve(HERE, file)))]));
}

function comparableRetail(leaf, basis) {
  requireValue(basis.source_type === "retail_reference" && basis.cost_view === "Retail", "Retail basis required");
  requireValue(
    leaf.currency === basis.currency &&
      leaf.region === basis.region &&
      leaf.assessment_basis &&
      ["period", "normalization", "cost_view", "tax", "licensing"].every(
        (key) => leaf.assessment_basis[key] === basis[key],
      ),
    "Retail currency/region/period/normalization/tax/licensing basis mismatch; mixed comparisons unsupported",
  );
  if (leaf.assessment_basis.source_unit === "year") {
    requireValue(
      basis.normalization === "annual / 12 (source-evidenced)" &&
        sumCosts(Array(12).fill(leaf.monthly_total)) === sumCosts([leaf.assessment_basis.original_total]),
      "Annual normalization must preserve original source units and exact annual / 12 evidence",
    );
  } else
    requireValue(
      leaf.assessment_basis.source_unit === undefined || leaf.assessment_basis.source_unit === "month",
      "Unsupported source-unit normalization",
    );
}

function rejectCredentialUrls(value) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
      const url = new URL(match[0]);
      requireValue(
        !url.username && !url.password && !url.search,
        "Credential-bearing/query URLs are not report content",
      );
    }
  } else if (Array.isArray(value)) for (const entry of value) rejectCredentialUrls(entry);
  else if (value && typeof value === "object") for (const entry of Object.values(value)) rejectCredentialUrls(entry);
}

function calculateInternal(data, { root, asOf }) {
  rejectCredentialUrls(data);
  const now = instant(asOf);
  requireValue(instant(data.as_of) <= instant(data.generated_at), "Generation cannot precede original as-of");
  requireValue(
    instant(data.generated_at) <= now && now - instant(data.generated_at) <= 7 * DAY,
    "Register is stale or future-dated",
  );
  validateScopes(data.scopes, { allowEmpty: true });
  requireValue(data.source !== "iac" || data.scopes.length === 0, "IaC-only register cannot assert Azure scopes");
  const readEvidence = reader(root);
  const refs = uniqueMap(data.evidence_refs, "evidence");
  const findings = uniqueMap(data.findings, "finding");
  const resources = uniqueMap(data.resources, "resource");
  const actions = uniqueMap(data.actions, "action");
  const bases = uniqueMap(data.bases, "basis");
  uniqueMap(data.scenarios, "scenario");
  const documents = new Map();
  const sourcePaths = new Set();
  for (const ref of refs.values()) {
    requireValue(!sourcePaths.has(ref.path), "Duplicate source path cannot supply independent evidence");
    sourcePaths.add(ref.path);
    const bytes = readEvidence(ref.path);
    requireValue(digest(bytes) === ref.sha256, `Evidence SHA-256 mismatch: ${ref.id}`);
    const age = now - instant(ref.collected_at);
    requireValue(
      age >= 0 && age <= (["retail", "lifecycle"].includes(ref.kind) ? 30 : 7) * DAY,
      `Stale or future evidence: ${ref.id}`,
    );
    requireValue(instant(ref.collected_at) <= instant(data.generated_at), "Evidence collected after generation");
    documents.set(ref.id, JSON.parse(bytes));
  }
  requireValue(
    data.actions.length > 0 ||
      data.coverage.status !== "assessed" ||
      [...refs.values()].some((ref) => ref.kind === "waf"),
    "No evidence-backed actions identified requires assessed WAF evidence; unavailable evidence is a different state",
  );
  const document = (id, kind) => {
    requireValue(refs.has(id) && (!kind || refs.get(id).kind === kind), `Missing/wrong ${kind ?? ""} evidence: ${id}`);
    return documents.get(id);
  };
  for (const finding of findings.values()) {
    const original = pointer(document(finding.evidence_id, "waf"), finding.locator);
    requireValue(
      original.id === finding.id && isDeepStrictEqual(original.pillars, finding.pillars),
      `Finding differs from WAF source: ${finding.id}`,
    );
  }
  for (const resource of resources.values()) {
    const original = pointer(document(resource.evidence_id, "inventory"), resource.locator);
    requireValue(
      ["id", "name", "type"].every((key) => original[key] === resource[key]) &&
        (resource.count === null || original.count === resource.count),
      `Unsupported resource identity/count: ${resource.id}`,
    );
    if (resource.id.toLowerCase().startsWith("/subscriptions/"))
      requireValue(
        data.scopes.some((scope) => resource.id.toLowerCase().startsWith(`${scope.toLowerCase()}/`)),
        "Resource outside captured scope",
      );
  }
  for (const basis of bases.values()) {
    requireValue(
      (basis.source_type === "unpriced" && basis.currency === null) ||
        Intl.supportedValuesOf("currency").includes(basis.currency),
      "Unsupported currency; unknown currency is null only on an unpriced basis",
    );
    requireValue(
      (basis.source_type === "retail_reference") === (basis.cost_view === "Retail") || basis.source_type === "unpriced",
      "Actual and retail basis must remain distinct",
    );
    requireValue(basis.cost_view !== null || basis.source_type === "unpriced", "Unknown cost view is unpriced only");
  }
  const retailCache = new Map();
  const costCache = new Map();
  const retail = (id, basis) => {
    const leaf = document(id, "retail");
    if (!retailCache.has(id)) {
      const result = validateEstimate(leaf, { verifyEvidenceFiles: false });
      requireValue(result.ok, `Invalid retail leaf: ${result.errors.join("; ")}`);
      requireValue(
        leaf.status === "COMPLETE" &&
          !leaf.decisions?.length &&
          leaf.resources.length > 0 &&
          leaf.queried_at === refs.get(id).collected_at &&
          leaf.assumptions?.length > 0,
        "Complete dated retail leaf with explicit assumptions required",
      );
      requireValue(
        sumCosts(leaf.resources.map((r) => r.monthly_cost)) === sumCosts([leaf.monthly_total]),
        "Retail leaf total must equal exact line sum",
      );
      // The existing validator verifies this family when file IO is enabled. Keep IO inside our project reader.
      for (const entry of leaf.retail_api_evidence ?? []) {
        const captured = JSON.parse(readEvidence(nestedEvidencePath(root, entry.evidence_path)));
        requireValue(
          captured.schema_version === "retail-price-evidence-v1" &&
            captured.pages?.length > 0 &&
            captured.pages.length <= 100,
          "Bounded retail meter evidence required",
        );
        const meters = new Set();
        for (const page of captured.pages) {
          requireValue(digest(String(page.raw_response ?? "")) === page.response_sha256, "Retail page hash mismatch");
          for (const item of JSON.parse(page.raw_response).Items ?? []) meters.add(item.meterId);
        }
        requireValue(
          entry.selected_meters?.length > 0 &&
            entry.selected_meters.every((m) => meters.has(m.meterId)) &&
            entry.calculation?.trim(),
          "Selected retail meters/calculation missing from captured source",
        );
      }
      retailCache.set(id, leaf);
    }
    comparableRetail(leaf, basis);
    return sumCosts([leaf.monthly_total]);
  };
  const cost = (id) => {
    if (!costCache.has(id)) {
      const report = document(id, "cost");
      const result = validateAssessmentCost(report, {
        asOf,
        readEvidence: (relative) => readEvidence(nestedEvidencePath(root, relative)),
        approvedScopes: data.scopes,
      });
      requireValue(result.valid, `Invalid cost opportunity source: ${result.errors.join("; ")}`);
      costCache.set(id, report);
    }
    return costCache.get(id);
  };
  const visit = (id, trail = new Set(), complete = new Set()) => {
    requireValue(actions.has(id), `Unresolved dependency: ${id}`);
    requireValue(!trail.has(id), "Action dependencies contain a cycle");
    if (complete.has(id)) return;
    trail.add(id);
    for (const dep of actions.get(id).dependencies) visit(dep, trail, complete);
    trail.delete(id);
    complete.add(id);
  };
  const completed = new Set();
  for (const id of actions.keys()) visit(id, new Set(), completed);
  const derivedActions = [];
  for (const action of actions.values()) {
    requireValue(
      CATEGORIES.has(action.category) || /^Custom: \S/.test(action.category),
      "Custom category must be explicitly labelled 'Custom: ...'",
    );
    for (const id of action.finding_ids) requireValue(findings.has(id), `Unknown WAF finding: ${id}`);
    requireValue(
      action.pillars.every((p) => action.finding_ids.some((id) => findings.get(id).pillars.includes(p))),
      "Action pillar unsupported by referenced findings",
    );
    for (const id of action.resource_ids) requireValue(resources.has(id), `Unknown resource: ${id}`);
    if (action.priority === "Critical") {
      const supporting = document(action.critical_evidence_id);
      requireValue(
        Array.isArray(supporting.critical_risks) &&
          supporting.critical_risks.some(
            (r) => action.finding_ids.includes(r.finding_id) && r.rationale === action.priority_rationale,
          ),
        "Critical priority needs captured serious risk/business/lifecycle evidence, not missing evidence alone",
      );
    }
    if (action.applicability === "conditional") requireValue(action.condition?.trim(), "Conditional trigger required");
    if (action.applicability === "alternative")
      requireValue(action.alternative_group, "Alternative selection group required");
    if (action.category === "Retirements and lifecycle")
      requireValue(action.lifecycle, "Lifecycle actions require deployed version and dated authoritative evidence");
    if (action.lifecycle) {
      const claim = action.lifecycle;
      requireValue(action.resource_ids.includes(claim.resource_id), "Lifecycle resource must belong to action");
      const observed = pointer(
        document(resources.get(claim.resource_id).evidence_id),
        resources.get(claim.resource_id).locator,
      );
      const original = pointer(document(claim.evidence_id, "lifecycle"), claim.locator);
      requireValue(
        original.service === claim.service &&
          original.version === claim.version &&
          original.date === claim.date &&
          observed.version === claim.version &&
          observed.service === claim.service,
        "Lifecycle claim does not match deployed service/version and dated source",
      );
      safeEvidenceUrl(original.url);
    }
    const finance = action.finance;
    const basis = bases.get(finance.basis_id);
    requireValue(basis, "Unknown financial basis");
    let contribution = null;
    let opportunityKey = null;
    let ledger = [];
    const hasRetail = finance.current_ref !== undefined || finance.proposed_ref !== undefined;
    if (finance.kind === "unquantified") {
      requireValue(finance.missing_inputs?.length > 0, "Unquantified action must identify missing inputs");
      requireValue(!hasRetail && !finance.opportunity && finance.ledger.length === 0, "Unknown must not carry amounts");
    } else if (finance.kind === "no_recurring_change") {
      requireValue(!hasRetail && !finance.opportunity && finance.ledger.length === 0, "Zero must not hide costs");
      requireValue(finance.evidence_ids?.length > 0, "Explicit zero requires supported rationale");
      for (const id of finance.evidence_ids) {
        const source = document(id);
        requireValue(
          source.no_recurring_changes?.some((r) => r.action_id === action.id && r.rationale === finance.rationale),
          "Zero rationale not supported by source",
        );
      }
      contribution = "0";
    } else if (finance.opportunity) {
      requireValue(
        finance.kind === "savings" && !hasRetail && finance.ledger.length === 0,
        "Actual opportunity is imported once, without arbitrary allocation or retail inputs",
      );
      const report = cost(finance.opportunity.evidence_id);
      const opportunity = report.opportunities.find((o) => o.id === finance.opportunity.opportunity_id);
      requireValue(opportunity, "Unknown referenced cost opportunity");
      const baseline = report.evidence.find((e) => e.id === opportunity.baseline_evidence_id);
      requireValue(
        basis.source_type === "actual_closed_month" &&
          basis.currency === opportunity.currency &&
          basis.cost_view === baseline.request.cost_type &&
          basis.period === `${baseline.request.period.from}/${baseline.request.period.to}` &&
          basis.normalization === "closed calendar month" &&
          basis.tax === baseline.request.metric,
        "Actual opportunity basis mismatch",
      );
      requireValue(
        opportunity.resource_ids.every((id) => action.resource_ids.includes(id)),
        "Cost opportunity resources must belong to action",
      );
      opportunityKey = `${refs.get(finance.opportunity.evidence_id).sha256}:${opportunity.id}`;
      ledger = opportunity.resource_ids.map((resource_id) => ({
        resource_id: resource_id.toLowerCase(),
        charge_id: "*",
        period: basis.period,
        currency: basis.currency,
        cost_view: basis.cost_view,
        basis_id: basis.id,
        benefit_slice: "entire actual resource baseline",
        source_id: opportunityKey,
      }));
      requireValue(Number(opportunity.amount) > 0, "Savings require a validated positive magnitude");
      contribution = negate(opportunity.amount);
    } else {
      requireValue(
        ["upgrade_delta", "new_service_gross", "savings"].includes(finance.kind),
        "Unsupported financial kind",
      );
      const proposed = retail(finance.proposed_ref, basis);
      requireValue(finance.kind !== "new_service_gross" || !finance.current_ref, "Gross new service has no baseline");
      contribution =
        finance.kind === "new_service_gross"
          ? proposed
          : sumCosts([proposed, negate(retail(finance.current_ref, basis))]);
      if (finance.kind === "savings")
        requireValue(contribution.startsWith("-"), "Retail savings need a genuinely lower like-for-like proposed cost");
      requireValue(finance.ledger.length > 0, "Quantified retail action requires source-bound charge ledger");
      const baselineRef = finance.current_ref ?? finance.proposed_ref;
      const leaf = document(baselineRef, "retail");
      const lineLocators = new Set();
      for (const entry of finance.ledger) {
        requireValue(entry.evidence_id === baselineRef, "Ledger must use current/proposed retail charge source");
        requireValue(/^\/resources\/(0|[1-9]\d*)$/.test(entry.locator), "Ledger locator must identify a retail line");
        const line = pointer(leaf, entry.locator);
        requireValue(
          line.resource_id === entry.resource_id &&
            line.charge_id === entry.charge_id &&
            (action.resource_ids.includes(entry.resource_id) || entry.resource_id === `proposed:${action.id}`),
          "Unsupported shared-resource charge allocation",
        );
        requireValue(!lineLocators.has(entry.locator), "Duplicate ledger charge");
        lineLocators.add(entry.locator);
        ledger.push({
          resource_id: entry.resource_id.toLowerCase(),
          charge_id: entry.charge_id.toLowerCase(),
          period: basis.period,
          currency: basis.currency,
          cost_view: basis.cost_view,
          basis_id: basis.id,
          benefit_slice: "entire evidenced charge",
          source_id: `${refs.get(baselineRef).sha256}:${entry.locator}`,
        });
      }
      requireValue(
        lineLocators.size === leaf.resources.length,
        "Partial retail allocation unsupported; every line needed",
      );
      if (finance.current_ref) {
        const proposedLeaf = document(finance.proposed_ref, "retail");
        requireValue(
          isDeepStrictEqual(
            leaf.resources.map((r) => [r.resource_id, r.charge_id, comparableLineUsage(r)]).sort(),
            proposedLeaf.resources.map((r) => [r.resource_id, r.charge_id, comparableLineUsage(r)]).sort(),
          ) && isDeepStrictEqual(leaf.assumptions, proposedLeaf.assumptions),
          "Replacement current/proposed charge slices, usage quantities, regions or assumptions differ",
        );
      }
    }
    derivedActions.push({
      id: action.id,
      monthly_contribution: contribution,
      display_contribution: displayCost(contribution),
      currency: basis.currency,
      basis_id: basis.id,
      opportunity_key: opportunityKey,
      cost_inputs: [finance.current_ref, finance.proposed_ref].filter(Boolean).map((id) => ({
        evidence_id: id,
        monthly_total: sumCosts([document(id).monthly_total]),
        source_unit: document(id).assessment_basis.source_unit ?? "month",
        original_total: String(document(id).assessment_basis.original_total ?? document(id).monthly_total),
      })),
      ledger,
    });
  }
  const contributions = new Map(derivedActions.map((a) => [a.id, a]));
  const scenarios = [];
  for (const scenario of data.scenarios) {
    const selections = new Map();
    const alternativeGroups = new Set();
    const usedOpportunities = new Set();
    const ledger = [];
    const groups = new Map();
    for (const selection of scenario.selections) {
      requireValue(actions.has(selection.action_id), "Unknown scenario action");
      requireValue(!selections.has(selection.action_id), "Duplicate scenario selection");
      selections.set(selection.action_id, selection);
    }
    requireValue(selections.size === actions.size, "Scenario must explicitly include/exclude every action");
    for (const action of actions.values()) {
      const selection = selections.get(action.id);
      const derived = contributions.get(action.id);
      const basis = bases.get(derived.basis_id);
      // Compare actual versus retail separately; equal basis descriptions cannot manufacture an extra ledger slice.
      const groupKey = JSON.stringify(
        ["source_type", "currency", "period", "normalization", "cost_view", "tax", "licensing", "region"].map(
          (key) => basis[key],
        ),
      );
      if (!groups.has(groupKey))
        groups.set(groupKey, { basis_ids: [], currency: basis.currency, included: [], excluded: [], conditional: [] });
      const group = groups.get(groupKey);
      if (!group.basis_ids.includes(basis.id)) group.basis_ids.push(basis.id);
      if (action.applicability === "conditional") group.conditional.push(action.id);
      if (!selection.included) {
        group.excluded.push({ action_id: action.id, reason: selection.reason });
        continue;
      }
      requireValue(action.applicability !== "unknown", "Unknown applicability must remain excluded");
      if (action.applicability === "conditional")
        requireValue(
          scenario.conditions.includes(action.condition),
          "Conditional action lacks named scenario condition",
        );
      requireValue(
        action.dependencies.every((id) => selections.get(id)?.included),
        "Included action requires its dependencies in the same scenario",
      );
      if (action.alternative_group) {
        requireValue(!alternativeGroups.has(action.alternative_group), "Mutually exclusive alternatives coexist");
        alternativeGroups.add(action.alternative_group);
      }
      if (derived.opportunity_key) {
        requireValue(!usedOpportunities.has(derived.opportunity_key), "Duplicate imported cost opportunity");
        usedOpportunities.add(derived.opportunity_key);
      }
      for (const entry of derived.ledger) {
        requireValue(
          !ledger.some(
            (other) =>
              entry.resource_id === other.resource_id &&
              (entry.charge_id === "*" || other.charge_id === "*" || entry.charge_id === other.charge_id),
          ),
          "Unsupported overlapping benefits/charges; an overlap group cannot waive deduplication",
        );
        ledger.push({ action_id: action.id, ...entry });
      }
      group.included.push(derived);
    }
    if (groups.size === 0) {
      const basis = data.bases[0];
      groups.set(basis.id, {
        basis_ids: [basis.id],
        currency: basis.currency,
        included: [],
        excluded: [],
        conditional: [],
      });
    }
    const summaries = [];
    for (const group of groups.values()) {
      const quantified = group.included.filter((a) => a.monthly_contribution !== null);
      const positive = quantified.filter((a) => !a.monthly_contribution.startsWith("-"));
      const negative = quantified.filter((a) => a.monthly_contribution.startsWith("-"));
      const additions = quantified.length ? sumCosts(positive.map((a) => a.monthly_contribution)) : null;
      const savings = quantified.length ? negate(sumCosts(negative.map((a) => a.monthly_contribution))) : null;
      const net = quantified.length ? sumCosts(quantified.map((a) => a.monthly_contribution)) : null;
      const displayNet = displayCost(net);
      const displayedLines = quantified.map((a) => a.display_contribution);
      const reconciliation = displayNet === null ? null : sumCosts([displayNet, negate(sumCosts(displayedLines))]);
      const additionsReconciliation =
        additions === null
          ? null
          : sumCosts([displayCost(additions), negate(sumCosts(positive.map((a) => a.display_contribution)))]);
      const savingsReconciliation =
        savings === null
          ? null
          : sumCosts([displayCost(savings), sumCosts(negative.map((a) => a.display_contribution))]);
      summaries.push({
        basis_ids: group.basis_ids,
        currency: group.currency,
        additions,
        savings,
        net,
        display_additions: displayCost(additions),
        display_savings: displayCost(savings),
        display_net: displayNet,
        display_reconciliation: displayCost(reconciliation),
        display_additions_reconciliation: displayCost(additionsReconciliation),
        display_savings_reconciliation: displayCost(savingsReconciliation),
        quantified_count: quantified.length,
        unquantified_count: group.included.length - quantified.length,
        excluded_count: group.excluded.length,
        conditional_count: group.conditional.length,
        coverage: quantified.length === 0 ? "Not quantified" : "Quantified subset",
        included_action_ids: group.included.map((a) => a.id),
        excluded: group.excluded,
      });
    }
    scenarios.push({ id: scenario.id, summaries, ledger });
  }
  return {
    schema_version: ACTION_REGISTER_VERSION,
    calculation_version: "1",
    rounding_policy:
      "Half away from zero to two decimals. Additions, savings magnitude and net each disclose rounded exact subtotal minus rounded line sum.",
    actions: derivedActions,
    scenarios,
  };
}

export function calculateAssessmentActionRegister(data, options = {}) {
  const errors = [];
  if (!validateShape(data)) errors.push(...validateShape.errors.map((e) => `${e.instancePath || "/"} ${e.message}`));
  if (errors.length) return { valid: false, errors };
  try {
    return { valid: true, errors, derived: calculateInternal(data, options) };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

export function validateAssessmentActionRegister(data, options = {}) {
  const result = calculateAssessmentActionRegister(data, options);
  return { valid: result.valid, errors: result.errors };
}

function checked(root, input, asOf) {
  instant(asOf);
  const expected = projectPath(root, ACTION_REGISTER_OUTPUTS.input);
  requireValue(path.resolve(input) === expected, `Canonical input must be ${ACTION_REGISTER_OUTPUTS.input}`);
  const bytes = reader(root)(ACTION_REGISTER_OUTPUTS.input);
  const register = JSON.parse(bytes);
  const result = calculateAssessmentActionRegister(register, { root, asOf });
  requireValue(result.valid, result.errors.join("; "));
  return {
    register,
    derived: result.derived,
    source_sha256: digest(bytes),
    derived_sha256: digest(JSON.stringify(result.derived)),
  };
}

function python(operation, root, input, asOf, payload, staged = false) {
  const result = spawnSync(
    "python3",
    [
      path.join(HERE, "render-assessment-action-register.py"),
      operation,
      "--root",
      root,
      "--input",
      input,
      "--as-of",
      asOf,
      ...(staged ? ["--staged"] : []),
    ],
    { input: JSON.stringify(payload), encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 120000 },
  );
  requireValue(
    !result.error && result.status === 0,
    `Workbook ${operation} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`,
  );
  const output = JSON.parse(result.stdout);
  requireValue(output.valid, output.errors?.join("; ") ?? "Workbook readback failed");
  return output;
}

function sourceHashes(payload, root) {
  const hashes = Object.fromEntries(payload.register.evidence_refs.map((ref) => [ref.path, ref.sha256]));
  // Cost-report provenance and captured retail pages are transitive sources, not extra contributions.
  const track = (relative) => {
    const normalized = nestedEvidencePath(root, relative);
    hashes[normalized] = digest(reader(root)(normalized));
  };
  for (const ref of payload.register.evidence_refs) {
    const doc = JSON.parse(reader(root)(ref.path));
    if (ref.kind === "cost") {
      for (const row of [...doc.evidence, ...doc.estimates, ...doc.opportunities]) {
        if (!row.provenance) continue;
        track(row.provenance.path);
        const provenance = JSON.parse(reader(root)(row.provenance.path));
        for (const basis of provenance.basis?.evidence_refs ?? []) track(basis.path);
        for (const entry of provenance.retail_api_evidence ?? []) track(entry.evidence_path);
      }
    }
    if (ref.kind === "retail") for (const entry of doc.retail_api_evidence ?? []) track(entry.evidence_path);
  }
  return hashes;
}

export function validateAssessmentActionRegisterExport({ root, input, asOf }) {
  try {
    const payload = checked(root, input, asOf);
    const receipt = JSON.parse(reader(root)(ACTION_REGISTER_OUTPUTS.receipt));
    requireValue(
      receipt.schema_version === "action-register-export-v1" &&
        receipt.source_sha256 === payload.source_sha256 &&
        receipt.derived_sha256 === payload.derived_sha256 &&
        isDeepStrictEqual(receipt.tool_hashes, toolHashes()) &&
        isDeepStrictEqual(receipt.evidence_hashes, sourceHashes(payload, root)),
      "Stale export receipt/source/derivation hashes",
    );
    requireValue(
      isDeepStrictEqual(Object.keys(receipt.output_hashes).sort(), ["markdown", "workbook", "derived"].sort()),
      "Receipt output contract mismatch",
    );
    for (const name of ["markdown", "workbook", "derived"])
      requireValue(
        digest(reader(root)(ACTION_REGISTER_OUTPUTS[name])) === receipt.output_hashes[name],
        `Export hash mismatch: ${name}`,
      );
    const saved = JSON.parse(reader(root)(ACTION_REGISTER_OUTPUTS.derived));
    requireValue(isDeepStrictEqual(saved, payload.derived), "Derived sidecar mismatch");
    const readback = python("validate", root, input, asOf, payload);
    requireValue(receipt.renderer_version === readback.renderer_version, "Renderer dependency version changed");
    return { valid: true, errors: [], receipt };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

export function renderAssessmentActionRegister({ root, input, asOf, overwrite = false }) {
  const payload = checked(root, input, asOf);
  const current = validateAssessmentActionRegisterExport({ root, input, asOf });
  if (current.valid) return current;
  for (const relative of [...Object.values(ACTION_REGISTER_OUTPUTS), ...Object.values(STAGED)])
    projectPath(root, relative, { missing: true });
  const pendingPath = projectPath(root, "_meta/action-register-export.pending.json", { missing: true });
  const finals = ["markdown", "workbook", "derived", "receipt"];
  let recovering = false;
  if (fs.existsSync(pendingPath)) {
    const pending = readJson(pendingPath);
    recovering =
      pending.source_sha256 === payload.source_sha256 &&
      pending.derived_sha256 === payload.derived_sha256 &&
      isDeepStrictEqual(pending.tool_hashes, toolHashes());
    if (recovering)
      for (const key of finals) {
        const file = projectPath(root, ACTION_REGISTER_OUTPUTS[key], { missing: true });
        if (fs.existsSync(file))
          requireValue(
            [pending.previous_output_hashes?.[key], pending.next_output_hashes?.[key]].includes(
              digest(fs.readFileSync(file)),
            ),
            "Interrupted export contains an unowned conflicting file; explicit overwrite cannot be inferred",
          );
      }
    requireValue(
      recovering || overwrite,
      "Interrupted export has different owned inputs; explicit --overwrite required",
    );
  }
  requireValue(
    overwrite ||
      recovering ||
      finals.every((key) => !fs.existsSync(projectPath(root, ACTION_REGISTER_OUTPUTS[key], { missing: true }))),
    "Existing conflicting/unverified export refused; explicit --overwrite required",
  );
  for (const relative of ["_meta", "assets"])
    fs.mkdirSync(projectPath(root, relative, { missing: true }), { recursive: true });
  const lock = projectPath(root, "_meta/action-register-export.lock", { missing: true });
  if (fs.existsSync(lock)) {
    const lease = readJson(lock);
    requireValue(Number.isInteger(lease.pid) && lease.pid > 0, "Export lock has invalid process identity");
    let alive = true;
    try {
      process.kill(lease.pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") alive = false;
    }
    requireValue(
      !alive && (lease.source_sha256 === payload.source_sha256 || overwrite),
      "Export is locked by another process or stale inputs require explicit --overwrite",
    );
    fs.unlinkSync(lock);
  }
  const handle = fs.openSync(lock, "wx");
  try {
    fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, source_sha256: payload.source_sha256 }));
    const provenance = {
      source_sha256: payload.source_sha256,
      derived_sha256: payload.derived_sha256,
      tool_hashes: toolHashes(),
      evidence_hashes: sourceHashes(payload, root),
    };
    const previousOutputHashes = Object.fromEntries(
      finals.flatMap((key) => {
        const file = projectPath(root, ACTION_REGISTER_OUTPUTS[key], { missing: true });
        return fs.existsSync(file) ? [[key, digest(fs.readFileSync(file))]] : [];
      }),
    );
    writeJson(pendingPath, { ...provenance, previous_output_hashes: previousOutputHashes });
    const rendered = python("render", root, input, asOf, payload, true);
    python("validate", root, input, asOf, payload, true);
    const refreshed = checked(root, input, asOf);
    requireValue(
      refreshed.source_sha256 === payload.source_sha256 &&
        refreshed.derived_sha256 === payload.derived_sha256 &&
        isDeepStrictEqual(sourceHashes(refreshed, root), provenance.evidence_hashes),
      "Source changed during export; no publication",
    );
    const stagedDerived = projectPath(root, "_meta/action-register-staged-derived.json", { missing: true });
    writeJson(stagedDerived, payload.derived);
    const outputHashes = {
      markdown: digest(reader(root)(STAGED.markdown)),
      workbook: digest(reader(root)(STAGED.workbook)),
      derived: digest(fs.readFileSync(stagedDerived)),
    };
    const receipt = {
      schema_version: "action-register-export-v1",
      generated_at: payload.register.generated_at,
      ...provenance,
      renderer_version: rendered.renderer_version,
      output_hashes: outputHashes,
    };
    const stagedReceipt = projectPath(root, "_meta/action-register-staged-receipt.json", { missing: true });
    writeJson(stagedReceipt, receipt);
    writeJson(pendingPath, {
      ...provenance,
      previous_output_hashes: previousOutputHashes,
      next_output_hashes: { ...outputHashes, receipt: digest(fs.readFileSync(stagedReceipt)) },
    });
    for (const key of finals) {
      const file = projectPath(root, ACTION_REGISTER_OUTPUTS[key], { missing: true });
      requireValue(
        fs.existsSync(file)
          ? digest(fs.readFileSync(file)) === previousOutputHashes[key]
          : previousOutputHashes[key] === undefined,
        "Output changed concurrently during export; no publication",
      );
    }
    // Receipt is the commit marker: readers reject any partial pair until it is published last.
    for (const key of ["markdown", "workbook"])
      fs.renameSync(projectPath(root, STAGED[key]), projectPath(root, ACTION_REGISTER_OUTPUTS[key], { missing: true }));
    fs.renameSync(stagedDerived, projectPath(root, ACTION_REGISTER_OUTPUTS.derived, { missing: true }));
    fs.renameSync(stagedReceipt, projectPath(root, ACTION_REGISTER_OUTPUTS.receipt, { missing: true }));
    const result = validateAssessmentActionRegisterExport({ root, input, asOf });
    requireValue(result.valid, result.errors.join("; "));
    fs.unlinkSync(pendingPath);
    return result;
  } finally {
    fs.closeSync(handle);
    fs.unlinkSync(lock);
    for (const relative of Object.values(STAGED)) {
      const target = projectPath(root, relative, { missing: true });
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
  }
}

export function runAssessmentActionRegisterCli(args = process.argv.slice(2)) {
  try {
    const { positionals, values } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        input: { type: "string" },
        root: { type: "string" },
        "as-of": { type: "string" },
        overwrite: { type: "boolean" },
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      console.log(
        "Offline: assessment-action-register.mjs validate|calculate|render|validate-export --input PROJECT/contracts/assessment-action-register.json --root PROJECT --as-of ISO [render --overwrite]. JSON stdout; no actions executed.",
      );
      return 0;
    }
    const [operation, ...extra] = positionals;
    requireValue(
      ["validate", "calculate", "render", "validate-export"].includes(operation) &&
        !extra.length &&
        values.input &&
        values.root &&
        values["as-of"] &&
        (!values.overwrite || operation === "render"),
      "Expected operation, --input, --root and --as-of; --overwrite is render-only",
    );
    const options = {
      root: path.resolve(values.root),
      input: path.resolve(values.input),
      asOf: values["as-of"],
      overwrite: values.overwrite,
    };
    let result;
    if (operation === "render") result = renderAssessmentActionRegister(options);
    else if (operation === "validate-export") result = validateAssessmentActionRegisterExport(options);
    else {
      const payload = checked(options.root, options.input, options.asOf);
      result = { valid: true, errors: [], ...(operation === "calculate" ? payload : {}) };
    }
    console.log(JSON.stringify(result));
    return result.valid ? 0 : 1;
  } catch (error) {
    console.log(JSON.stringify({ valid: false, errors: [error.message] }));
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exit(runAssessmentActionRegisterCli());
