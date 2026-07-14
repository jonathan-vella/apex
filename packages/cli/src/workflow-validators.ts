import {
  ArchitectureV1Schema,
  GovernanceConstraintsV1Schema,
  IacBindingV1Schema,
  ImplementationIntentV1Schema,
  PolicyPropertyMapV1Schema,
  RequirementsV1Schema,
  hasValidCostArithmetic,
  type ArchitectureV1,
  type CostEstimateV1,
  type EvidenceManifestV1,
  type GovernanceConstraintsV1,
  type IacBindingV1,
  type ImplementationIntentV1,
  type LogicalResourceManifestV1,
  type PolicyPropertyMapV1,
  type RequirementsV1,
  type ReviewFindingsV1,
} from "@apex/contracts";
import { WORKFLOW_VALIDATOR_OWNERSHIP, sha256Json, type ValidationIssue, type ValidatorRegistry } from "@apex/kernel";

export interface WorkflowTaskValidatorContext {
  readonly nodeId: string;
  readonly now: string;
  readonly track: "bicep" | "terraform";
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly artifacts: Readonly<Record<string, unknown>>;
  readonly artifactHashes: Readonly<Record<string, string>>;
}

const VALIDATION_EVIDENCE_IDS = new Set([
  "bicep:build",
  "bicep:format",
  "bicep:lint",
  "business:logical-resource-parity",
  "business:policy-property-map",
  "business:security-baseline",
  "terraform:format",
  "terraform:init-backend-false",
  "terraform:validate",
]);

function issue(path: string, message: string): ValidationIssue[] {
  return [{ path, message }];
}

function taskContext(value: unknown): WorkflowTaskValidatorContext {
  return value as WorkflowTaskValidatorContext;
}

function requirementsCompleteness(value: unknown): ValidationIssue[] {
  const requirements = taskContext(value).outputs.requirements as RequirementsV1;
  const ids = requirements.requirements.map(({ id }) => id);
  return new Set(ids).size === ids.length ? [] : issue("/requirements", "Requirement IDs must be unique");
}

function requirementsTraceability(value: unknown): ValidationIssue[] {
  const context = taskContext(value);
  const architecture = context.outputs.architecture as ArchitectureV1;
  const requirements = context.artifacts.requirements as RequirementsV1 | undefined;
  if (requirements === undefined) return issue("/artifacts/requirements", "Accepted requirements are required");
  const knownIds = new Set(requirements.requirements.map(({ id }) => id));
  const referencedIds = architecture.components.flatMap(({ requirementIds }) => requirementIds);
  const unknown = [...new Set(referencedIds.filter((id) => !knownIds.has(id)))].sort();
  if (unknown.length > 0) {
    return issue("/outputs/architecture/components", `Unknown requirement IDs: ${unknown.join(", ")}`);
  }
  const referenced = new Set(referencedIds);
  const missing = requirements.requirements
    .filter(({ priority, status, id }) => priority === "must" && status === "confirmed" && !referenced.has(id))
    .map(({ id }) => id)
    .sort();
  return missing.length === 0
    ? []
    : issue("/outputs/architecture/components", `Uncovered confirmed must requirements: ${missing.join(", ")}`);
}

function costArithmetic(value: unknown): ValidationIssue[] {
  const estimate = taskContext(value).outputs["cost-estimate"] as CostEstimateV1;
  return hasValidCostArithmetic(estimate) ? [] : issue("/outputs/cost-estimate", "Cost arithmetic does not reconcile");
}

function governanceCompleteness(value: unknown): ValidationIssue[] {
  const governance = taskContext(value).outputs["governance-constraints"] as GovernanceConstraintsV1;
  const discoveredItems = Object.values(governance.summary).reduce((total, count) => total + count, 0);
  return discoveredItems > 0 && governance.constraintsRef.bytes === 0
    ? issue("/outputs/governance-constraints/constraintsRef/bytes", "Non-empty discovery requires evidence bytes")
    : [];
}

function governanceFreshness(value: unknown): ValidationIssue[] {
  const context = taskContext(value);
  const governance = context.outputs["governance-constraints"] as GovernanceConstraintsV1;
  const now = Date.parse(context.now);
  if (Date.parse(governance.discoveredAt) > now) {
    return issue("/outputs/governance-constraints/discoveredAt", "Governance discovery is from the future");
  }
  return Date.parse(governance.expiresAt) <= now
    ? issue("/outputs/governance-constraints/expiresAt", "Governance discovery is stale")
    : [];
}

function policyEffectCoverage(value: unknown): ValidationIssue[] {
  const context = taskContext(value);
  const governance = context.artifacts["governance-constraints"] as GovernanceConstraintsV1 | undefined;
  const policyMap = context.outputs["policy-property-map"] as PolicyPropertyMapV1;
  if (governance === undefined) {
    return issue("/artifacts/governance-constraints", "Accepted governance constraints are required");
  }
  const counts = new Map<string, number>();
  for (const mapping of policyMap.mappings) counts.set(mapping.effect, (counts.get(mapping.effect) ?? 0) + 1);
  const missing = [
    ["deny", governance.summary.denyCount],
    ["modify", governance.summary.modifyCount],
    ["audit", governance.summary.auditCount],
  ].flatMap(([effect, required]) =>
    (counts.get(effect as string) ?? 0) < (required as number) ? [effect as string] : [],
  );
  return missing.length === 0
    ? []
    : issue("/outputs/policy-property-map/mappings", `Missing policy effect coverage: ${missing.join(", ")}`);
}

function planSourceCoverage(value: unknown): ValidationIssue[] {
  const context = taskContext(value);
  const intent = context.outputs["implementation-intent"] as ImplementationIntentV1;
  const requiredSources = ["requirements", "architecture", "governance-constraints", "policy-property-map"].filter(
    (kind) => context.artifactHashes[kind] !== undefined,
  );
  const invalid = requiredSources.filter((kind) => intent.sourceHashes[kind] !== context.artifactHashes[kind]);
  return invalid.length === 0
    ? []
    : issue("/outputs/implementation-intent/sourceHashes", `Missing or stale source hashes: ${invalid.join(", ")}`);
}

function bindingTrackMatch(value: unknown): ValidationIssue[] {
  const context = taskContext(value);
  const intent = context.outputs["implementation-intent"] as ImplementationIntentV1;
  const binding = context.outputs["iac-binding"] as IacBindingV1;
  const resourceIds = new Set(intent.resources.map(({ id }) => id));
  const bindingIds = Object.keys(binding.resourceBindings);
  return binding.track === context.track &&
    binding.intentHash === sha256Json(intent) &&
    bindingIds.length === resourceIds.size &&
    bindingIds.every((id) => resourceIds.has(id))
    ? []
    : issue("/outputs/iac-binding", "IaC binding track, intent, or resource coverage is invalid");
}

function dependencyAcyclic(value: unknown): ValidationIssue[] {
  const intent = taskContext(value).outputs["implementation-intent"] as ImplementationIntentV1;
  const ids = intent.resources.map(({ id }) => id);
  const known = new Set(ids);
  if (known.size !== ids.length)
    return issue("/outputs/implementation-intent/resources", "Resource IDs must be unique");
  const unknown = intent.resources.flatMap(({ dependsOn }) => dependsOn.filter((id) => !known.has(id)));
  if (unknown.length > 0) {
    return issue(
      "/outputs/implementation-intent/resources",
      `Unknown resource dependencies: ${[...new Set(unknown)].sort().join(", ")}`,
    );
  }
  const incoming = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));
  for (const resource of intent.resources) {
    for (const dependency of resource.dependsOn) {
      incoming.set(resource.id, (incoming.get(resource.id) ?? 0) + 1);
      outgoing.get(dependency)?.push(resource.id);
    }
  }
  const pending = ids.filter((id) => incoming.get(id) === 0);
  let visited = 0;
  while (pending.length > 0) {
    const id = pending.shift();
    if (id === undefined) break;
    visited += 1;
    for (const dependent of outgoing.get(id) ?? []) {
      const count = (incoming.get(dependent) ?? 0) - 1;
      incoming.set(dependent, count);
      if (count === 0) pending.push(dependent);
    }
  }
  return visited === ids.length ? [] : issue("/outputs/implementation-intent/resources", "Resource graph has a cycle");
}

function bindingCoverage(expectedTrack: "bicep" | "terraform", value: unknown): ValidationIssue[] {
  const context = taskContext(value);
  const intent = context.artifacts["implementation-intent"] as ImplementationIntentV1 | undefined;
  const binding = context.artifacts["iac-binding"] as IacBindingV1 | undefined;
  const manifest = context.outputs["logical-resource-manifest"] as LogicalResourceManifestV1;
  if (intent === undefined || binding === undefined) {
    return issue("/artifacts", "Accepted implementation intent and IaC binding are required");
  }
  const expectedIds = intent.resources.map(({ id }) => id).sort();
  const bindingIds = Object.keys(binding.resourceBindings).sort();
  const manifestIds = manifest.resources.map(({ logicalId }) => logicalId).sort();
  return binding.track === expectedTrack &&
    manifest.track === expectedTrack &&
    JSON.stringify(bindingIds) === JSON.stringify(expectedIds) &&
    JSON.stringify(manifestIds) === JSON.stringify(expectedIds)
    ? []
    : issue("/outputs/logical-resource-manifest", `${expectedTrack} binding coverage is incomplete`);
}

function comprehensiveReview(expectedNode: string, value: unknown): ValidationIssue[] {
  const context = taskContext(value);
  const review = context.outputs["review-findings"] as ReviewFindingsV1;
  const subjectKind = expectedNode === "governance-reconciliation" ? "policy-property-map" : expectedNode;
  const artifactKind = subjectKind === "plan" ? "implementation-intent" : subjectKind;
  const expectedHash = context.artifactHashes[artifactKind];
  const findingIds = review.findings.map(({ id }) => id);
  if (new Set(findingIds).size !== findingIds.length) {
    return issue("/outputs/review-findings/findings", "Review finding IDs must be unique");
  }
  return review.subjectKind === subjectKind && expectedHash !== undefined && review.subjectHash === expectedHash
    ? []
    : issue("/outputs/review-findings", `Review does not bind the accepted ${subjectKind} artifact`);
}

function requiredValidationEvidence(id: string, value: unknown): ValidationIssue[] {
  const evidence = value as EvidenceManifestV1;
  const matches = evidence.entries.filter(({ kind }) => kind === id);
  return matches.length === 1 && matches[0]?.required === true && matches[0]?.retention === "immutable"
    ? []
    : issue("/entries", `Required immutable validation evidence is missing for ${id}`);
}

export function registerTaskWorkflowValidators(registry: ValidatorRegistry): void {
  registry.register("schema:requirements-v1", RequirementsV1Schema);
  registry.register("schema:architecture-v1", ArchitectureV1Schema);
  registry.register("schema:governance-constraints-v1", GovernanceConstraintsV1Schema);
  registry.register("schema:policy-property-map-v1", PolicyPropertyMapV1Schema);
  registry.register("schema:implementation-intent-v1", ImplementationIntentV1Schema);
  registry.register("schema:iac-binding-v1", IacBindingV1Schema);

  registry.registerHandler("business:requirements-completeness", requirementsCompleteness);
  registry.registerHandler("business:requirements-traceability", requirementsTraceability);
  registry.registerHandler("business:cost-arithmetic", costArithmetic);
  registry.registerHandler("business:governance-completeness", governanceCompleteness);
  registry.registerHandler("business:governance-freshness", governanceFreshness, "freshness");
  registry.registerHandler("business:policy-effect-coverage", policyEffectCoverage);
  registry.registerHandler("business:plan-source-coverage", planSourceCoverage);
  registry.registerHandler("business:binding-track-match", bindingTrackMatch);
  registry.registerHandler("business:dependency-acyclic", dependencyAcyclic);
  registry.registerHandler("business:bicep-binding-coverage", (value) => bindingCoverage("bicep", value));
  registry.registerHandler("business:terraform-binding-coverage", (value) => bindingCoverage("terraform", value));

  registry.registerHandler("review:requirements-comprehensive", (value) => comprehensiveReview("requirements", value));
  registry.registerHandler("review:architecture-comprehensive", (value) => comprehensiveReview("architecture", value));
  registry.registerHandler("review:governance-reconciliation", (value) =>
    comprehensiveReview("governance-reconciliation", value),
  );
  registry.registerHandler("review:plan-comprehensive", (value) => comprehensiveReview("plan", value));

  for (const id of VALIDATION_EVIDENCE_IDS) {
    registry.registerHandler(id, (value) => requiredValidationEvidence(id, value));
  }

  const requiredBoundaries = new Set(["task-output", "review", "validation"]);
  for (const [id, ownership] of WORKFLOW_VALIDATOR_OWNERSHIP) {
    if (requiredBoundaries.has(ownership.boundary) && !registry.has(id)) {
      throw new Error(`Workflow validator ${id} has no registered ${ownership.boundary} handler`);
    }
  }
}

export function taskWorkflowValidatorInput(id: string, context: WorkflowTaskValidatorContext): unknown {
  const schemaInputs: Readonly<Record<string, string>> = {
    "schema:requirements-v1": "requirements",
    "schema:architecture-v1": "architecture",
    "schema:governance-constraints-v1": "governance-constraints",
    "schema:policy-property-map-v1": "policy-property-map",
    "schema:implementation-intent-v1": "implementation-intent",
    "schema:iac-binding-v1": "iac-binding",
  };
  const outputKind = schemaInputs[id];
  if (outputKind !== undefined) return context.outputs[outputKind];
  if (VALIDATION_EVIDENCE_IDS.has(id)) return context.outputs["validation-evidence"];
  return context;
}
