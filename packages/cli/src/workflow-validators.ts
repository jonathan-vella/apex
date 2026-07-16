import {
  ArchitectureV1Schema,
  GovernanceConstraintsV1Schema,
  IacBindingV1Schema,
  ImplementationIntentV1Schema,
  PolicyPropertyMapV1Schema,
  RequirementsV1Schema,
  SECRET_FIELD_PATTERN,
  SECRET_VALUE_PATTERN,
  hasValidCostArithmetic,
  type ApprovalEvidenceV1,
  type ArchitectureAvailabilityV1,
  type ArchitectureV1,
  type CostEstimateV1,
  type DiagnosisV1,
  type EvidenceManifestV1,
  type ExecutionPlanAttestationV1,
  type GateRecordV1,
  type GovernanceConstraintsV1,
  type IacBindingV1,
  type ImplementationIntentV1,
  type LogicalResourceManifestV1,
  type OperationRecordV1,
  type PolicyPropertyMapV1,
  type QualityMeasurementsV1,
  type QualityReportV1,
  type QualityScorecardV1,
  type RequirementsV1,
  type ReviewFindingsV1,
  type ResourceInventoryV1,
  type RunConfigV1,
  type DeploymentPreviewV1,
} from "@apex/contracts";
import { WORKFLOW_VALIDATOR_OWNERSHIP, sha256Json, type ValidationIssue, type ValidatorRegistry } from "@apex/kernel";
import { evaluateQualityScorecard } from "@apex/renderers";

export interface WorkflowTaskValidatorContext {
  readonly nodeId: string;
  readonly now: string;
  readonly track: "bicep" | "terraform";
  readonly targetScope: string;
  readonly inputRefs: readonly string[];
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly artifacts: Readonly<Record<string, unknown>>;
  readonly artifactHashes: Readonly<Record<string, string>>;
  readonly scorecard?: QualityScorecardV1;
  readonly qualityMeasurements?: QualityMeasurementsV1;
  readonly availabilityEvidence?: ArchitectureAvailabilityV1;
  readonly deploymentOperation?: OperationRecordV1;
  readonly deploymentInventory?: ResourceInventoryV1;
}

export interface WorkflowGateValidatorContext {
  readonly gateNumber: number;
  readonly now: string;
  readonly run: RunConfigV1;
  readonly gate: GateRecordV1;
  readonly approval: ApprovalEvidenceV1;
  readonly artifactHashes: Readonly<Record<string, string>>;
  readonly completedNodes: readonly string[];
  readonly reviewBlockers: readonly string[];
  readonly expectedDependencyHash?: string;
  readonly currentDependencyRevision: string;
  readonly legacyRequirements: boolean;
  readonly currentRecipientIdentity: string;
  readonly provedPreviewTransferClaimHash?: string;
  readonly preview?: DeploymentPreviewV1;
}

export interface WorkflowPreviewValidatorContext {
  readonly now: string;
  readonly run: RunConfigV1;
  readonly provider: "fake" | "bicep" | "terraform";
  readonly expectedOperation: "apply" | "destroy";
  readonly preview: DeploymentPreviewV1;
  readonly intent: ImplementationIntentV1;
  readonly expectedInputHash: string;
  readonly expectedIacHash: string;
  readonly expectedPolicyHash: string;
  readonly currentDependencyRevision: string;
  readonly expectedResourceIds: readonly string[];
  readonly intendedExecutionRecipientIdentity: string;
  readonly attestation?: ExecutionPlanAttestationV1;
}

export interface WorkflowDeployValidatorContext {
  readonly now: string;
  readonly run: RunConfigV1;
  readonly provider: "fake" | "bicep" | "terraform";
  readonly preview: DeploymentPreviewV1;
  readonly approval: ApprovalEvidenceV1;
  readonly expectedPreviewHash: string;
  readonly currentDependencyRevision: string;
  readonly provedPreviewTransferClaimHash?: string;
  readonly operation?: OperationRecordV1;
  readonly attestation?: ExecutionPlanAttestationV1;
  readonly executionEvidence?: {
    readonly mode: "native";
    readonly operationId: string;
    readonly previewHash: string;
    readonly validatorIds: readonly string[];
  };
}

export interface WorkflowInventoryValidatorContext {
  readonly run: RunConfigV1;
  readonly preview: DeploymentPreviewV1;
  readonly operation: OperationRecordV1;
  readonly inventory: ResourceInventoryV1;
}

export interface WorkflowTerminalValidatorContext {
  readonly activeValidatorIds: readonly string[];
  readonly executedValidatorIds: readonly string[];
  readonly simulatedOmittedValidatorIds: readonly string[];
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

function secretIssues(value: unknown, path = ""): ValidationIssue[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => secretIssues(item, `${path}/${index}`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([key, item]) => [
        ...(SECRET_FIELD_PATTERN.test(key)
          ? [{ path: `${path}/${key}`, message: "Secret-bearing field is not allowed" }]
          : []),
        ...secretIssues(item, `${path}/${key}`),
      ]);
  }
  return typeof value === "string" && SECRET_VALUE_PATTERN.test(value)
    ? [{ path, message: "Secret-bearing value is not allowed" }]
    : [];
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

function availabilityCurrent(value: unknown): ValidationIssue[] {
  const context = taskContext(value);
  const evidence = context.availabilityEvidence;
  if (evidence === undefined)
    return issue("/availabilityEvidence", "Current architecture availability evidence is required");
  const architecture = context.outputs.architecture as ArchitectureV1;
  const issues: ValidationIssue[] = [];
  if (
    evidence.projectId !== architecture.projectId ||
    evidence.runId !== architecture.runId ||
    evidence.targetScope !== context.targetScope
  ) {
    issues.push({
      path: "/availabilityEvidence",
      message: "Availability evidence does not match the architecture run",
    });
  }
  const missingSourceRefs = Object.values(evidence.checks)
    .map(({ evidenceRef }) => evidenceRef)
    .filter((reference) => !context.inputRefs.includes(reference))
    .sort();
  if (missingSourceRefs.length > 0) {
    issues.push({
      path: "/availabilityEvidence/checks",
      message: `Availability source evidence was not pinned to the task: ${missingSourceRefs.join(", ")}`,
    });
  }
  const now = Date.parse(context.now);
  if (Date.parse(evidence.collectedAt) > now) {
    issues.push({
      path: "/availabilityEvidence/collectedAt",
      message: "Architecture availability evidence has a future collection timestamp",
    });
  }
  if (Date.parse(evidence.expiresAt) <= now) {
    issues.push({ path: "/availabilityEvidence/expiresAt", message: "Architecture availability evidence is expired" });
  }
  const unavailable = Object.entries(evidence.checks)
    .filter(([, check]) => check.status !== "current")
    .map(([name]) => name)
    .sort();
  if (unavailable.length > 0) {
    issues.push({
      path: "/availabilityEvidence/checks",
      message: `Architecture availability checks are not current: ${unavailable.join(", ")}`,
    });
  }
  return issues;
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

function gateContext(value: unknown): WorkflowGateValidatorContext {
  return value as WorkflowGateValidatorContext;
}

function gateReady(expectedGate: 1 | 2 | 3, value: unknown): ValidationIssue[] {
  const context = gateContext(value);
  const requiredArtifacts: Record<1 | 2 | 3, readonly string[]> = {
    1: ["requirements", "sku-manifest"],
    2: ["architecture", "cost-estimate", "governance-constraints", "policy-property-map"],
    3: ["implementation-intent", "iac-binding", "environment-inputs"],
  };
  const requiredReviews: Record<1 | 2 | 3, readonly string[]> = {
    1: context.legacyRequirements ? [] : ["requirements-review"],
    2: ["architecture-review", "governance-review"],
    3: ["plan-review"],
  };
  const issues: ValidationIssue[] = [];
  if (context.gateNumber !== expectedGate || context.gate.gate !== expectedGate) {
    issues.push({ path: "/gateNumber", message: `Expected Gate ${expectedGate}` });
  }
  if (context.gate.state !== "open") issues.push({ path: "/gate/state", message: "Gate is not open" });
  const missingArtifacts = requiredArtifacts[expectedGate].filter((kind) => context.artifactHashes[kind] === undefined);
  if (missingArtifacts.length > 0) {
    issues.push({ path: "/artifactHashes", message: `Missing required artifacts: ${missingArtifacts.join(", ")}` });
  }
  const completed = new Set(context.completedNodes);
  const missingReviews = requiredReviews[expectedGate].filter((nodeId) => !completed.has(nodeId));
  if (missingReviews.length > 0) {
    issues.push({ path: "/completedNodes", message: `Missing required reviews: ${missingReviews.join(", ")}` });
  }
  if (context.reviewBlockers.length > 0) {
    issues.push({
      path: "/reviewBlockers",
      message: `Unresolved review findings: ${context.reviewBlockers.join(", ")}`,
    });
  }
  if (context.expectedDependencyHash === undefined || context.gate.dependencyHash !== context.expectedDependencyHash) {
    issues.push({ path: "/gate/dependencyHash", message: "Gate is not bound to the current review dependency" });
  }
  if (context.approval.dependencyHash !== context.gate.dependencyHash) {
    issues.push({ path: "/approval/dependencyHash", message: "Approval is not bound to the open gate" });
  }
  return issues;
}

function gatePreviewCurrent(value: unknown): ValidationIssue[] {
  const context = gateContext(value);
  const preview = context.preview;
  if (preview === undefined) return issue("/preview", "Current deployment preview is required");
  const issues: ValidationIssue[] = [];
  if (context.gateNumber !== 4 || context.gate.gate !== 4 || context.gate.state !== "open") {
    issues.push({ path: "/gate", message: "Gate 4 is not open" });
  }
  if (context.gate.dependencyHash !== preview.previewHash) {
    issues.push({ path: "/gate/dependencyHash", message: "Gate 4 is not bound to the current preview" });
  }
  if (
    preview.projectId !== context.run.projectId ||
    preview.runId !== context.run.runId ||
    preview.track !== context.run.iacTool ||
    preview.target !== context.run.targetScope
  ) {
    issues.push({ path: "/preview", message: "Preview identity does not match the selected run" });
  }
  if (
    preview.dependencyRevision !== context.currentDependencyRevision ||
    preview.commit !== context.currentDependencyRevision
  ) {
    issues.push({ path: "/preview/dependencyRevision", message: "Preview dependencies are stale" });
  }
  const writerCurrent =
    (preview.ownerEpoch === context.run.ownerEpoch && context.provedPreviewTransferClaimHash === undefined) ||
    (preview.ownerEpoch + 1 === context.run.ownerEpoch && context.provedPreviewTransferClaimHash !== undefined);
  if (!writerCurrent) {
    issues.push({ path: "/preview/ownerEpoch", message: "Preview writer epoch is stale" });
  }
  const now = Date.parse(context.now);
  if (Date.parse(preview.createdAt) > now || Date.parse(preview.expiresAt) <= now) {
    issues.push({ path: "/preview/expiresAt", message: "Preview is not current" });
  }
  return issues;
}

function gateApprovalBindingComplete(value: unknown): ValidationIssue[] {
  const context = gateContext(value);
  const preview = context.preview;
  if (preview === undefined) return issue("/preview", "Current deployment preview is required");
  const approval = context.approval;
  const valid =
    approval.gate === 4 &&
    approval.decision === "approved" &&
    approval.projectId === context.run.projectId &&
    approval.runId === context.run.runId &&
    approval.previewHash === preview.previewHash &&
    approval.dependencyHash === preview.previewHash &&
    approval.writerEpoch === context.run.ownerEpoch &&
    approval.writerTransferClaimHash === context.provedPreviewTransferClaimHash &&
    approval.recipientIdentity === context.currentRecipientIdentity &&
    approval.expiresAt !== undefined &&
    Date.parse(approval.expiresAt) > Date.parse(context.now);
  return valid ? [] : issue("/approval", "Approval does not completely bind the current preview and writer");
}

function gateNoHardBlockers(value: unknown): ValidationIssue[] {
  const context = gateContext(value);
  const blockers = [...(context.preview?.blockers ?? []), ...context.reviewBlockers];
  return blockers.length === 0 ? [] : issue("/blockers", `Hard blockers remain: ${blockers.join(", ")}`);
}

function previewContext(value: unknown): WorkflowPreviewValidatorContext {
  return value as WorkflowPreviewValidatorContext;
}

function previewHashBindings(value: unknown): ValidationIssue[] {
  const context = previewContext(value);
  const preview = context.preview;
  const { previewHash, ...body } = preview;
  const issues: ValidationIssue[] = [];
  if (sha256Json(body) !== previewHash) issues.push({ path: "/previewHash", message: "Preview hash is invalid" });
  if (
    preview.projectId !== context.run.projectId ||
    preview.runId !== context.run.runId ||
    preview.track !== context.run.iacTool ||
    preview.environment !== context.run.environment ||
    preview.target !== context.run.targetScope ||
    preview.operation !== context.expectedOperation
  ) {
    issues.push({ path: "/preview", message: "Preview identity does not match the selected run" });
  }
  if (
    preview.inputHash !== context.expectedInputHash ||
    preview.iacHash !== context.expectedIacHash ||
    preview.policyHash !== context.expectedPolicyHash
  ) {
    issues.push({ path: "/preview", message: "Preview does not bind the accepted input, IaC, and policy artifacts" });
  }
  if (preview.ownerEpoch !== context.run.ownerEpoch) {
    issues.push({ path: "/ownerEpoch", message: "Preview writer epoch is stale" });
  }
  return issues;
}

function previewPolicyPrecheck(value: unknown): ValidationIssue[] {
  const context = previewContext(value);
  return context.preview.policyHash === context.expectedPolicyHash
    ? []
    : issue("/policyHash", "Preview policy precheck is not bound to the current policy artifact");
}

function previewCoverage(value: unknown): ValidationIssue[] {
  const context = previewContext(value);
  const changes = context.preview.changes;
  const resourceIds = changes.map(({ resourceId }) => resourceId);
  const issues: ValidationIssue[] = [];
  if (new Set(resourceIds).size !== resourceIds.length) {
    issues.push({ path: "/changes", message: "Preview contains duplicate resource changes" });
  }
  if (changes.some(({ action }) => action === "unknown")) {
    issues.push({ path: "/changes", message: "Preview contains unknown resource actions" });
  }
  if (context.provider === "fake") {
    const actual = [...resourceIds].sort();
    const expected = [...context.expectedResourceIds].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      issues.push({ path: "/changes", message: "Fake preview does not cover every requested resource" });
    }
  }
  return issues;
}

function previewFreshness(value: unknown): ValidationIssue[] {
  const context = previewContext(value);
  const preview = context.preview;
  const now = Date.parse(context.now);
  return preview.commit === context.currentDependencyRevision &&
    preview.dependencyRevision === context.currentDependencyRevision &&
    Date.parse(preview.createdAt) <= now &&
    Date.parse(preview.expiresAt) > now
    ? []
    : issue("/preview", "Preview is stale or expired");
}

function terraformSavedPlanBinding(value: unknown): ValidationIssue[] {
  const context = previewContext(value);
  const attestation = context.attestation;
  if (attestation === undefined) return issue("/attestation", "Terraform saved-plan attestation is required");
  const preview = context.preview;
  const providerArtifactHash = sha256Json({
    planDigest: attestation.planDigest,
    configHash: attestation.configHash,
    lockfileHash: attestation.lockfileHash,
    recipient: attestation.recipient,
    artifactRef: attestation.artifactRef,
  });
  const valid =
    attestation.projectId === preview.projectId &&
    attestation.runId === preview.runId &&
    attestation.track === "terraform" &&
    attestation.previewHash === preview.previewHash &&
    attestation.inputHash === preview.inputHash &&
    attestation.iacHash === preview.iacHash &&
    attestation.policyHash === preview.policyHash &&
    attestation.stateLineage === preview.stateLineage &&
    attestation.stateSerial === preview.stateSerial &&
    attestation.recipient === attestation.transport.recipient &&
    attestation.recipient === context.intendedExecutionRecipientIdentity &&
    attestation.expiresAt === preview.expiresAt &&
    preview.artifactHash === providerArtifactHash;
  return valid ? [] : issue("/attestation", "Terraform saved plan is not bound to the exact preview");
}

function deployContext(value: unknown): WorkflowDeployValidatorContext {
  return value as WorkflowDeployValidatorContext;
}

function deployExactApprovedOperation(value: unknown): ValidationIssue[] {
  const context = deployContext(value);
  const preview = context.preview;
  const approval = context.approval;
  const { previewHash, ...previewBody } = preview;
  const valid =
    sha256Json(previewBody) === previewHash &&
    context.expectedPreviewHash === previewHash &&
    approval.projectId === context.run.projectId &&
    approval.runId === context.run.runId &&
    approval.gate === 4 &&
    approval.decision === "approved" &&
    approval.previewHash === previewHash &&
    approval.dependencyHash === previewHash &&
    approval.recipientIdentity !== undefined;
  return valid ? [] : issue("/approval", "Deployment is not authorized by the exact approved operation");
}

function deployStaleWriterRejection(value: unknown): ValidationIssue[] {
  const context = deployContext(value);
  const preview = context.preview;
  const approval = context.approval;
  const now = Date.parse(context.now);
  const valid =
    ((preview.ownerEpoch === context.run.ownerEpoch &&
      context.provedPreviewTransferClaimHash === undefined &&
      approval.writerTransferClaimHash === undefined) ||
      (preview.ownerEpoch + 1 === context.run.ownerEpoch &&
        context.provedPreviewTransferClaimHash !== undefined &&
        approval.writerTransferClaimHash === context.provedPreviewTransferClaimHash)) &&
    approval.writerEpoch === context.run.ownerEpoch &&
    preview.commit === context.currentDependencyRevision &&
    preview.dependencyRevision === context.currentDependencyRevision &&
    Date.parse(preview.expiresAt) > now &&
    approval.expiresAt !== undefined &&
    Date.parse(approval.expiresAt) > now;
  return valid ? [] : issue("/run", "Deployment writer or dependency authority is stale");
}

function providerReceiptIncludes(id: string, context: WorkflowDeployValidatorContext): boolean {
  const operation = context.operation;
  const evidence = context.executionEvidence;
  return (
    operation !== undefined &&
    operation.state === "succeeded" &&
    operation.projectId === context.run.projectId &&
    operation.runId === context.run.runId &&
    operation.operation === context.preview.operation &&
    operation.previewHash === context.preview.previewHash &&
    operation.approvalHash === sha256Json(context.approval) &&
    operation.ownerEpoch === context.run.ownerEpoch &&
    evidence?.mode === "native" &&
    evidence.operationId === operation.operationId &&
    evidence.previewHash === context.preview.previewHash &&
    evidence.validatorIds.includes(id)
  );
}

function deployBicepStackOwnership(value: unknown): ValidationIssue[] {
  const context = deployContext(value);
  return context.provider === "bicep" && providerReceiptIncludes("deploy:bicep-stack-ownership", context)
    ? []
    : issue("/executionEvidence", "Native Bicep stack ownership evidence is missing");
}

function deployExactSavedPlan(value: unknown): ValidationIssue[] {
  const context = deployContext(value);
  const attestation = context.attestation;
  const valid =
    context.provider === "terraform" &&
    providerReceiptIncludes("deploy:exact-saved-plan", context) &&
    attestation !== undefined &&
    attestation.previewHash === context.preview.previewHash &&
    attestation.inputHash === context.preview.inputHash &&
    attestation.iacHash === context.preview.iacHash &&
    attestation.policyHash === context.preview.policyHash;
  return valid ? [] : issue("/executionEvidence", "Native Terraform exact saved-plan evidence is missing");
}

function deployStateLineageAndSerial(value: unknown): ValidationIssue[] {
  const context = deployContext(value);
  const attestation = context.attestation;
  const valid =
    context.provider === "terraform" &&
    providerReceiptIncludes("deploy:state-lineage-and-serial", context) &&
    attestation !== undefined &&
    attestation.stateLineage === context.preview.stateLineage &&
    attestation.stateSerial === context.preview.stateSerial;
  return valid ? [] : issue("/executionEvidence", "Terraform state lineage or serial evidence is missing");
}

function inventoryContext(value: unknown): WorkflowInventoryValidatorContext {
  return value as WorkflowInventoryValidatorContext;
}

function inventorySecretFree(value: unknown): ValidationIssue[] {
  return secretIssues(inventoryContext(value).inventory, "/inventory");
}

function inventorySourceCoverage(value: unknown): ValidationIssue[] {
  const context = inventoryContext(value);
  const inventory = context.inventory;
  const resourceIds = inventory.resources.map(({ resourceId }) => resourceId);
  const logicalIds = inventory.resources.map(({ logicalId }) => logicalId);
  const issues: ValidationIssue[] = [];
  if (new Set(resourceIds).size !== resourceIds.length || new Set(logicalIds).size !== logicalIds.length) {
    issues.push({ path: "/inventory/resources", message: "Inventory resource identities must be unique" });
  }
  const expected = context.preview.changes
    .filter(({ material, action }) => material && action !== "delete" && action !== "no-op")
    .map(({ resourceId }) => resourceId);
  const missing = expected.filter(
    (expectedId) =>
      !inventory.resources.some(
        ({ logicalId, resourceId }) =>
          logicalId === expectedId || resourceId === expectedId || resourceId.endsWith(`:${expectedId}`),
      ),
  );
  if (missing.length > 0) {
    issues.push({
      path: "/inventory/resources",
      message: `Inventory is missing preview resources: ${missing.sort().join(", ")}`,
    });
  }
  return issues;
}

function inventoryEventuallyReconciled(value: unknown): ValidationIssue[] {
  const context = inventoryContext(value);
  const inventory = context.inventory;
  const operation = context.operation;
  const valid =
    operation.state === "succeeded" &&
    operation.projectId === context.run.projectId &&
    operation.runId === context.run.runId &&
    operation.previewHash === context.preview.previewHash &&
    inventory.projectId === context.run.projectId &&
    inventory.runId === context.run.runId &&
    Date.parse(inventory.collectedAt) >= Date.parse(operation.updatedAt) &&
    (context.preview.operation !== "destroy" || inventory.resources.length === 0);
  return valid ? [] : issue("/inventory", "Inventory does not reconcile the completed operation");
}

function diagnosisReadOnly(value: unknown): ValidationIssue[] {
  const context = taskContext(value);
  const diagnosis = context.outputs.diagnosis as DiagnosisV1;
  const operation = context.deploymentOperation;
  const inventory = context.deploymentInventory;
  if (operation === undefined || inventory === undefined) {
    return issue("/deployment", "Accepted operation and inventory are required for diagnosis");
  }
  const issues: ValidationIssue[] = [];
  if (
    diagnosis.projectId !== operation.projectId ||
    diagnosis.runId !== operation.runId ||
    Date.parse(diagnosis.diagnosedAt) < Date.parse(inventory.collectedAt) ||
    Date.parse(diagnosis.diagnosedAt) > Date.parse(context.now)
  ) {
    issues.push({
      path: "/outputs/diagnosis",
      message: "Diagnosis is not a read-only observation of current inventory",
    });
  }
  const unpinned = diagnosis.causes
    .flatMap(({ evidenceRefs }) => evidenceRefs)
    .filter((reference) => !context.inputRefs.includes(reference))
    .sort();
  if (unpinned.length > 0) {
    issues.push({
      path: "/outputs/diagnosis/causes",
      message: `Diagnosis evidence was not pinned to the task: ${unpinned.join(", ")}`,
    });
  }
  return issues;
}

function diagnosisSecretFree(value: unknown): ValidationIssue[] {
  return secretIssues(taskContext(value).outputs.diagnosis, "/outputs/diagnosis");
}

function terminalRunEvidenceComplete(value: unknown): ValidationIssue[] {
  const context = value as WorkflowTerminalValidatorContext;
  const accounted = new Set([...context.executedValidatorIds, ...context.simulatedOmittedValidatorIds]);
  const missing = [...new Set(context.activeValidatorIds)]
    .filter((id) => id !== "terminal:run-evidence-complete" && !accounted.has(id))
    .sort();
  return missing.length === 0
    ? []
    : issue("/validatorEvidence", `Run is missing validator evidence: ${missing.join(", ")}`);
}

function qualityContext(value: unknown): WorkflowTaskValidatorContext & {
  readonly scorecard: QualityScorecardV1;
  readonly qualityMeasurements: QualityMeasurementsV1;
} {
  return value as WorkflowTaskValidatorContext & {
    readonly scorecard: QualityScorecardV1;
    readonly qualityMeasurements: QualityMeasurementsV1;
  };
}

function qualityScorecardDecidable(value: unknown): ValidationIssue[] {
  const context = qualityContext(value);
  if (context.scorecard === undefined) return issue("/scorecard", "Quality scorecard context is required");
  if (context.qualityMeasurements === undefined)
    return issue("/qualityMeasurements", "Quality measurements context is required");
  const report = context.outputs["quality-report"] as QualityReportV1;
  const measurementSet = context.qualityMeasurements;
  const measurements = measurementSet.measurements;
  const evaluations = evaluateQualityScorecard(context.scorecard, measurements);
  const checks = new Map(report.checks.map((check) => [`${check.id}\u0000${check.scenario}`, check]));
  const issues: ValidationIssue[] = [];
  if (report.scorecardHash !== sha256Json(context.scorecard)) {
    issues.push({ path: "/outputs/quality-report/scorecardHash", message: "Quality report scorecard hash is stale" });
  }
  if (report.measurementsHash !== sha256Json(measurementSet)) {
    issues.push({ path: "/outputs/quality-report/measurementsHash", message: "Quality measurement hash is invalid" });
  }
  if (checks.size !== report.checks.length || checks.size !== context.scorecard.rules.length) {
    issues.push({
      path: "/outputs/quality-report/checks",
      message: "Quality report must contain one check per scorecard rule",
    });
  }
  for (const evaluation of evaluations) {
    const check = checks.get(`${evaluation.metric}\u0000${evaluation.scenario}`);
    if (
      check === undefined ||
      check.status !== evaluation.decision ||
      check.samples !== evaluation.samples ||
      check.value !== evaluation.value ||
      check.detail !== evaluation.reason
    ) {
      issues.push({
        path: "/outputs/quality-report/checks",
        message: `Quality decision does not reconcile for ${evaluation.metric}/${evaluation.scenario}`,
      });
    }
  }
  const expectedStatus =
    evaluations.some(({ decision }) => decision === "fail") || !evaluations.some(({ decision }) => decision === "pass")
      ? "fail"
      : "pass";
  if (report.status !== expectedStatus) {
    issues.push({ path: "/outputs/quality-report/status", message: `Quality report status must be ${expectedStatus}` });
  }
  return issues;
}

function qualityNoSubjectiveClaims(value: unknown): ValidationIssue[] {
  const context = qualityContext(value);
  if (context.qualityMeasurements === undefined)
    return issue("/qualityMeasurements", "Quality measurements context is required");
  const report = context.outputs["quality-report"] as QualityReportV1;
  const measurements = new Map(
    context.qualityMeasurements.measurements.map((measurement) => [
      `${measurement.metric}\u0000${measurement.scenario}`,
      measurement,
    ]),
  );
  const keys = report.checks.map(({ id, scenario }) => `${id}\u0000${scenario}`);
  const measurementKeys = context.qualityMeasurements.measurements.map(
    ({ metric, scenario }) => `${metric}\u0000${scenario}`,
  );
  const issues: ValidationIssue[] = [];
  if (new Set(keys).size !== keys.length) {
    issues.push({ path: "/outputs/quality-report/checks", message: "Quality checks must be unique" });
  }
  if (JSON.stringify(keys) !== JSON.stringify([...keys].sort())) {
    issues.push({ path: "/outputs/quality-report/checks", message: "Quality checks must use canonical order" });
  }
  if (new Set(measurementKeys).size !== measurementKeys.length) {
    issues.push({ path: "/qualityMeasurements/measurements", message: "Quality measurements must be unique" });
  }
  if (JSON.stringify(measurementKeys) !== JSON.stringify([...measurementKeys].sort())) {
    issues.push({
      path: "/qualityMeasurements/measurements",
      message: "Quality measurements must use canonical order",
    });
  }
  for (const check of report.checks) {
    if (check.value !== undefined && !Number.isFinite(check.value)) {
      issues.push({ path: "/outputs/quality-report/checks/value", message: "Quality values must be finite" });
    }
    const measurement = measurements.get(`${check.id}\u0000${check.scenario}`);
    const requiredEvidence = new Set([report.measurementsHash, ...(measurement?.evidenceRefs ?? [])]);
    if (check.status !== "omitted" && [...requiredEvidence].some((hash) => !check.evidenceRefs.includes(hash))) {
      issues.push({
        path: "/outputs/quality-report/checks/evidenceRefs",
        message: `Quality claim ${check.id}/${check.scenario} is missing measurement evidence`,
      });
    }
  }
  return issues;
}

export function registerWorkflowValidators(registry: ValidatorRegistry): void {
  registry.register("schema:requirements-v1", RequirementsV1Schema);
  registry.register("schema:architecture-v1", ArchitectureV1Schema);
  registry.register("schema:governance-constraints-v1", GovernanceConstraintsV1Schema);
  registry.register("schema:policy-property-map-v1", PolicyPropertyMapV1Schema);
  registry.register("schema:implementation-intent-v1", ImplementationIntentV1Schema);
  registry.register("schema:iac-binding-v1", IacBindingV1Schema);

  registry.registerHandler("business:requirements-completeness", requirementsCompleteness);
  registry.registerHandler("business:requirements-traceability", requirementsTraceability);
  registry.registerHandler("business:cost-arithmetic", costArithmetic);
  registry.registerHandler("business:availability-current", availabilityCurrent, "freshness");
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

  registry.registerHandler("gate:requirements-ready", (value) => gateReady(1, value), "authorization");
  registry.registerHandler("gate:architecture-cost-governance-ready", (value) => gateReady(2, value), "authorization");
  registry.registerHandler("gate:implementation-plan-ready", (value) => gateReady(3, value), "authorization");
  registry.registerHandler("gate:preview-current", gatePreviewCurrent, "authorization");
  registry.registerHandler("gate:approval-binding-complete", gateApprovalBindingComplete, "authorization");
  registry.registerHandler("gate:no-hard-blockers", gateNoHardBlockers, "authorization");

  registry.registerHandler("preview:hash-bindings", previewHashBindings);
  registry.registerHandler("preview:policy-precheck", previewPolicyPrecheck);
  registry.registerHandler("preview:coverage", previewCoverage);
  registry.registerHandler("preview:freshness", previewFreshness, "freshness");
  registry.registerHandler("terraform:saved-plan-binding", terraformSavedPlanBinding, "authorization");

  registry.registerHandler("deploy:exact-approved-operation", deployExactApprovedOperation, "authorization");
  registry.registerHandler("deploy:stale-writer-rejection", deployStaleWriterRejection, "authorization");
  registry.registerHandler("deploy:bicep-stack-ownership", deployBicepStackOwnership, "authorization");
  registry.registerHandler("deploy:exact-saved-plan", deployExactSavedPlan, "authorization");
  registry.registerHandler("deploy:state-lineage-and-serial", deployStateLineageAndSerial, "authorization");

  registry.registerHandler("inventory:secret-free", inventorySecretFree);
  registry.registerHandler("inventory:source-coverage", inventorySourceCoverage);
  registry.registerHandler("inventory:eventual-consistency-reconciled", inventoryEventuallyReconciled, "freshness");

  registry.registerHandler("diagnosis:read-only", diagnosisReadOnly);
  registry.registerHandler("diagnosis:secret-free", diagnosisSecretFree);

  registry.registerHandler("quality:scorecard-decidable", qualityScorecardDecidable);
  registry.registerHandler("quality:no-subjective-deterministic-claims", qualityNoSubjectiveClaims);

  registry.registerHandler("terminal:run-evidence-complete", terminalRunEvidenceComplete, "authorization");

  const requiredBoundaries = new Set([
    "task-output",
    "review",
    "external-evidence",
    "validation",
    "gate",
    "preview",
    "deploy",
    "inventory",
    "diagnosis",
    "quality",
    "terminal",
  ]);
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
