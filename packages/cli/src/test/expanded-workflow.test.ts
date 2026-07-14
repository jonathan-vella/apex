import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type {
  DeploymentPreviewV1,
  ExecutionPlanAttestationV1,
  IacBindingV1,
  ImplementationIntentV1,
  LogicalResourceManifestV1,
} from "@apex/contracts";
import type { IacProvider, PreviewRequest } from "@apex/capabilities";
import { EventJournal, ValidatorRegistry, sha256Json } from "@apex/kernel";
import { ApexError } from "../errors.js";
import { createMcpServer } from "../mcp.js";
import { ApexService, type TaskOutput } from "../service.js";
import { registerWorkflowValidators } from "../workflow-validators.js";
import {
  architecture,
  acceptAvailabilityEvidence,
  availabilityEvidence,
  codegenBundle,
  costEstimate,
  governance,
  planBundle,
  policyMap,
  qualityReport,
  requirements,
  review,
  skuManifest,
  tempRoot,
  validationEvidence,
  writeJson,
} from "./helpers.js";

async function task(service: ApexService, expected: string): Promise<string> {
  const next = await service.nextTask();
  assert.equal(next.status, "task");
  if (next.status !== "task") throw new Error("Expected task");
  assert.equal(next.task.taskType, expected);
  return next.task.taskId;
}

async function complete(
  service: ApexService,
  expected: string,
  outputs: TaskOutput[],
): Promise<Record<string, string>> {
  const result = await service.completeTaskOutputs(await task(service, expected), outputs);
  return result.outputHashes as Record<string, string>;
}

async function reachCodegen(
  service: ApexService,
  runId: string,
  track: "bicep" | "terraform",
): Promise<{ taskId: string; plan: ReturnType<typeof planBundle> }> {
  await service.nextTask();
  const requirementValues: TaskOutput[] = [
    { kind: "requirements", value: requirements() },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
  ];
  const requirementHashes = await complete(service, "requirements", requirementValues);
  await complete(service, "requirements-review", [
    { kind: "review-findings", value: review(runId, "requirements", requirementHashes.requirements!) },
  ]);
  await service.decideGateNumber(1, "approved", "tester");
  await acceptAvailabilityEvidence(service, runId);

  const architectureValues: TaskOutput[] = [
    { kind: "architecture", value: architecture(runId) },
    { kind: "cost-estimate", value: costEstimate(runId) },
  ];
  const architectureHashes = await complete(service, "architecture", architectureValues);
  await complete(service, "architecture-review", [
    { kind: "review-findings", value: review(runId, "architecture", architectureHashes.architecture!) },
  ]);
  const governanceValue = governance(runId);
  const governanceHashes = await complete(service, "governance-discovery", [
    { kind: "governance-constraints", value: governanceValue },
  ]);
  const policyHashes = await complete(service, "governance-reconciliation", [
    { kind: "policy-property-map", value: policyMap(runId, governanceHashes["governance-constraints"]!) },
  ]);
  await complete(service, "governance-review", [
    { kind: "review-findings", value: review(runId, "policy-property-map", policyHashes["policy-property-map"]!) },
  ]);
  await service.decideGateNumber(2, "approved", "tester");

  const plan = planBundle(
    runId,
    track,
    {},
    {
      requirements: requirementHashes.requirements!,
      architecture: architectureHashes.architecture!,
      "governance-constraints": governanceHashes["governance-constraints"]!,
      "policy-property-map": policyHashes["policy-property-map"]!,
    },
  );
  const planHashes = await complete(service, "plan", plan);
  await complete(service, "plan-review", [
    { kind: "review-findings", value: review(runId, "plan", planHashes["implementation-intent"]!) },
  ]);
  await service.decideGateNumber(3, "approved", "tester");
  return { taskId: await task(service, `codegen-${track}`), plan };
}

async function reachValidation(service: ApexService, runId: string, track: "bicep" | "terraform"): Promise<void> {
  const codegen = await reachCodegen(service, runId, track);
  await service.completeTaskOutputs(codegen.taskId, codegenBundle(runId, track, codegen.plan));
  await complete(service, `validation-${track}`, [
    { kind: "validation-evidence", value: validationEvidence(runId, track) },
  ]);
}

function terraformPreviewProvider(
  now: Date,
  mutation?:
    | "input-hash"
    | "operation"
    | "state"
    | "apply-error"
    | "missing-receipt"
    | "extra-receipt"
    | "inventory-once"
    | "secret-inventory"
    | "incomplete-inventory",
): IacProvider & {
  attestation(previewHash: string): ExecutionPlanAttestationV1 | undefined;
} {
  let attestation: ExecutionPlanAttestationV1 | undefined;
  let executionEvidence:
    { mode: "native"; operationId: string; previewHash: string; validatorIds: string[] } | undefined;
  let inventoryCalls = 0;
  let latestPreview: DeploymentPreviewV1 | undefined;
  const createPreview = async (request: PreviewRequest): Promise<DeploymentPreviewV1> => {
    const plan = {
      planDigest: "1".repeat(64),
      configHash: "2".repeat(64),
      lockfileHash: "3".repeat(64),
      recipient: "local",
      artifactRef: "plans/test.tfplan.enc",
    };
    const base = {
      schemaVersion: "1.0.0" as const,
      projectId: request.projectId,
      runId: request.runId,
      environment: request.environment as "dev",
      track: "terraform" as const,
      operation: (mutation === "operation" ? "destroy" : "apply") as "apply" | "destroy",
      target: request.target,
      commit: request.commit,
      dependencyRevision: request.dependencyRevision,
      ownerEpoch: request.ownerEpoch,
      inputHash: mutation === "input-hash" ? "f".repeat(64) : request.inputHash,
      iacHash: request.iacHash,
      policyHash: request.policyHash,
      artifactHash: sha256Json(plan),
      stateLineage: "lineage-1",
      stateSerial: 1,
      changes: request.resources.map(({ resourceId }) => ({ resourceId, action: "create" as const, material: true })),
      blockers: [],
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + request.ttlMs).toISOString(),
    };
    const preview = { ...base, previewHash: sha256Json(base) };
    latestPreview = preview;
    attestation = {
      schemaVersion: "1.0.0",
      projectId: request.projectId,
      runId: request.runId,
      track: "terraform",
      previewHash: preview.previewHash,
      inputHash: preview.inputHash,
      iacHash: preview.iacHash,
      policyHash: preview.policyHash,
      configHash: plan.configHash,
      lockfileHash: plan.lockfileHash,
      recipient: plan.recipient,
      planDigest: plan.planDigest,
      artifactRef: plan.artifactRef,
      stateLineage: mutation === "state" ? "lineage-other" : preview.stateLineage,
      stateSerial: preview.stateSerial,
      transport: {
        encrypted: true,
        implementation: "local-reference",
        algorithm: "aes-256-gcm",
        recipient: "local",
        mediaType: "application/vnd.apex.terraform-plan",
        iv: "iv",
        authTag: "tag",
      },
      createdAt: now.toISOString(),
      expiresAt: preview.expiresAt,
    };
    return preview;
  };
  return {
    track: "terraform",
    validate: async () => [],
    previewApply: createPreview,
    previewDestroy: createPreview,
    apply: async (preview, approval, authority) => {
      if (mutation === "apply-error") throw new Error("provider apply outcome is unknown");
      const operation = {
        schemaVersion: "1.0.0" as const,
        operationId: "terraform-operation",
        projectId: preview.projectId,
        runId: preview.runId,
        providerOperationId: "terraform-plan:test",
        operation: preview.operation,
        state: "succeeded" as const,
        previewHash: preview.previewHash,
        approvalHash: sha256Json(approval),
        ownerEpoch: authority.ownerEpoch,
        updatedAt: now.toISOString(),
      };
      if (mutation !== "missing-receipt") {
        executionEvidence = {
          mode: "native",
          operationId: operation.operationId,
          previewHash: preview.previewHash,
          validatorIds: [
            "deploy:exact-saved-plan",
            "deploy:state-lineage-and-serial",
            ...(mutation === "extra-receipt" ? ["deploy:undeclared"] : []),
          ],
        };
      }
      return operation;
    },
    destroy: async () => {
      throw new Error("not used");
    },
    inventory: async (projectId, runId) => {
      inventoryCalls += 1;
      if (mutation === "inventory-once" && inventoryCalls === 1) throw new Error("inventory unavailable");
      return {
        schemaVersion: "1.0.0" as const,
        projectId,
        runId,
        deploymentHash: "9".repeat(64),
        collectedAt: now.toISOString(),
        resources:
          mutation === "incomplete-inventory"
            ? []
            : (latestPreview?.changes ?? []).map(({ resourceId }) => ({
                logicalId: resourceId,
                resourceId,
                type: "terraform/resource",
                location: "terraform-managed",
                properties:
                  mutation === "secret-inventory" ? { token: "Bearer secret-token-value" } : { provider: "terraform" },
              })),
      };
    },
    reconcile: async () => undefined,
    attestation: (previewHash) => (attestation?.previewHash === previewHash ? attestation : undefined),
    executionEvidence: (operationId) =>
      executionEvidence?.operationId === operationId ? executionEvidence : undefined,
  };
}

function bicepPreviewProvider(now: Date): IacProvider {
  let executionEvidence:
    { mode: "native"; operationId: string; previewHash: string; validatorIds: string[] } | undefined;
  let latestPreview: DeploymentPreviewV1 | undefined;
  const createPreview = async (request: PreviewRequest): Promise<DeploymentPreviewV1> => {
    const base = {
      schemaVersion: "1.0.0" as const,
      projectId: request.projectId,
      runId: request.runId,
      environment: request.environment as "dev",
      track: "bicep" as const,
      operation: "apply" as const,
      target: request.target,
      commit: request.commit,
      dependencyRevision: request.dependencyRevision,
      ownerEpoch: request.ownerEpoch,
      inputHash: request.inputHash,
      iacHash: request.iacHash,
      policyHash: request.policyHash,
      artifactHash: "8".repeat(64),
      changes: request.resources.map(({ resourceId }) => ({ resourceId, action: "create" as const, material: true })),
      blockers: [],
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + request.ttlMs).toISOString(),
    };
    latestPreview = { ...base, previewHash: sha256Json(base) };
    return latestPreview;
  };
  return {
    track: "bicep",
    validate: async () => [],
    previewApply: createPreview,
    previewDestroy: createPreview,
    apply: async (preview, approval, authority) => {
      const operation = {
        schemaVersion: "1.0.0" as const,
        operationId: "bicep-operation",
        projectId: preview.projectId,
        runId: preview.runId,
        providerOperationId: "/stack/workload",
        operation: preview.operation,
        state: "succeeded" as const,
        previewHash: preview.previewHash,
        approvalHash: sha256Json(approval),
        ownerEpoch: authority.ownerEpoch,
        updatedAt: now.toISOString(),
      };
      executionEvidence = {
        mode: "native",
        operationId: operation.operationId,
        previewHash: preview.previewHash,
        validatorIds: ["deploy:bicep-stack-ownership"],
      };
      return operation;
    },
    destroy: async () => {
      throw new Error("not used");
    },
    inventory: async (projectId, runId) => ({
      schemaVersion: "1.0.0",
      projectId,
      runId,
      deploymentHash: "7".repeat(64),
      collectedAt: now.toISOString(),
      resources: (latestPreview?.changes ?? []).map(({ resourceId }) => ({
        logicalId: resourceId,
        resourceId,
        type: "bicep/resource",
        location: "swedencentral",
        properties: { provider: "bicep" },
      })),
    }),
    reconcile: async () => undefined,
    executionEvidence: (operationId) =>
      executionEvidence?.operationId === operationId ? executionEvidence : undefined,
  };
}

test("task completion records executed manifest validators in order", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const { runId } = await service.init({ projectId: "demo" });
  await service.nextTask();
  await complete(service, "requirements", [
    { kind: "requirements", value: requirements() },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
  ]);

  const events = await new EventJournal(join(root, ".apex", "projects", "demo", "runs", runId, "journal")).replay();
  const completed = events.find(
    (event) => event.type === "task.completed" && (event.payload as { nodeId?: unknown }).nodeId === "requirements",
  );
  assert.deepEqual((completed?.payload as { validatorIds?: unknown }).validatorIds, [
    "schema:requirements-v1",
    "business:requirements-completeness",
  ]);
});

test("task validation refuses workflow bytes outside the run lock", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  await service.init({ projectId: "demo" });
  await service.nextTask();
  const issued = await service.nextTask();
  assert.equal(issued.status, "task");
  if (issued.status !== "task") return;
  const workflowPath = join(root, ".apex", "runtime", "workflow.v1.json");
  const workflowBytes = await readFile(workflowPath);
  await writeFile(workflowPath, Buffer.concat([workflowBytes, Buffer.from("\n")]));
  await assert.rejects(
    service.completeTaskOutputs(issued.task.taskId, [
      { kind: "requirements", value: requirements() },
      { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
    ]),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_STALE",
  );
});

test("gate approval records executed manifest validators in order", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const { runId } = await service.init({ projectId: "demo" });
  await service.nextTask();
  const requirementHashes = await complete(service, "requirements", [
    { kind: "requirements", value: requirements() },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
  ]);
  await complete(service, "requirements-review", [
    {
      kind: "review-findings",
      value: review(runId, "requirements", requirementHashes.requirements!),
    },
  ]);
  const workflowPath = join(root, ".apex", "runtime", "workflow.v1.json");
  const workflowBytes = await readFile(workflowPath);
  await writeFile(workflowPath, Buffer.concat([workflowBytes, Buffer.from("\n")]));
  await assert.rejects(
    service.decideGateNumber(1, "approved", "tester"),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_STALE",
  );
  await writeFile(workflowPath, workflowBytes);
  await service.decideGateNumber(1, "approved", "tester");

  const events = await new EventJournal(join(root, ".apex", "projects", "demo", "runs", runId, "journal")).replay();
  const decided = events.find(
    (event) => event.type === "gate.decided" && (event.payload as { gate?: unknown }).gate === 1,
  );
  assert.deepEqual((decided?.payload as { validatorIds?: unknown }).validatorIds, ["gate:requirements-ready"]);
});

test("task-bound workflow validators reject semantic and evidence mutations", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const { runId } = await service.init({ projectId: "demo", iacTool: "bicep" });
  await service.nextTask();

  const requirementTask = await task(service, "requirements");
  const duplicateRequirements = structuredClone(requirements());
  duplicateRequirements.requirements.push({ ...duplicateRequirements.requirements[0]! });
  await assert.rejects(
    service.completeTaskOutputs(requirementTask, [
      { kind: "requirements", value: duplicateRequirements },
      { kind: "sku-manifest", value: skuManifest(sha256Json(duplicateRequirements)) },
    ]),
    /business:requirements-completeness/,
  );
  const requirementValues = requirements();
  const requirementHashes = await service.completeTaskOutputs(requirementTask, [
    { kind: "requirements", value: requirementValues },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirementValues)) },
  ]);

  const requirementReviewTask = await task(service, "requirements-review");
  const duplicateFinding = {
    id: "F-1",
    severity: "info",
    disposition: "dismissed",
    title: "Duplicate",
    detail: "Duplicate review identifier",
    evidenceRefs: [],
  };
  await assert.rejects(
    service.completeTaskOutputs(requirementReviewTask, [
      {
        kind: "review-findings",
        value: review(runId, "requirements", requirementHashes.outputHashes.requirements!, [
          duplicateFinding,
          duplicateFinding,
        ]),
      },
    ]),
    /review:requirements-comprehensive/,
  );
  await service.completeTaskOutputs(requirementReviewTask, [
    {
      kind: "review-findings",
      value: review(runId, "requirements", requirementHashes.outputHashes.requirements!),
    },
  ]);
  await service.decideGateNumber(1, "approved", "tester");
  const availabilityHash = await acceptAvailabilityEvidence(service, runId);

  const architectureTask = await task(service, "architecture");
  const untraceableArchitecture = architecture(runId);
  untraceableArchitecture.components[0]!.requirementIds = ["REQ-UNKNOWN"];
  await assert.rejects(
    service.completeTaskOutputs(architectureTask, [
      { kind: "architecture", value: untraceableArchitecture },
      { kind: "cost-estimate", value: costEstimate(runId) },
    ]),
    /business:requirements-traceability/,
  );
  const architectureHashes = await service.completeTaskOutputs(architectureTask, [
    { kind: "architecture", value: architecture(runId) },
    { kind: "cost-estimate", value: costEstimate(runId) },
  ]);
  const architectureEvents = await new EventJournal(
    join(root, ".apex", "projects", "demo", "runs", runId, "journal"),
  ).replay();
  const architectureCompleted = architectureEvents.find(
    (event) => event.type === "task.completed" && (event.payload as { nodeId?: unknown }).nodeId === "architecture",
  );
  assert.deepEqual((architectureCompleted?.payload as { validatorIds?: unknown }).validatorIds, [
    "schema:architecture-v1",
    "business:requirements-traceability",
    "business:cost-arithmetic",
    "business:availability-current",
  ]);
  assert.deepEqual((architectureCompleted?.payload as { validatorEvidenceRefs?: unknown }).validatorEvidenceRefs, {
    "business:availability-current": availabilityHash,
  });
  assert.deepEqual((architectureCompleted?.payload as { validatorEvidenceModes?: unknown }).validatorEvidenceModes, {
    "business:availability-current": "simulated",
  });
  await complete(service, "architecture-review", [
    {
      kind: "review-findings",
      value: review(runId, "architecture", architectureHashes.outputHashes.architecture!),
    },
  ]);

  const governanceTask = await task(service, "governance-discovery");
  await assert.rejects(
    service.completeTaskOutputs(governanceTask, [
      { kind: "governance-constraints", value: { ...governance(runId), expiresAt: "2020-01-01T00:00:00.000Z" } },
    ]),
    /business:governance-freshness/,
  );
  const multiEffectGovernance = governance(runId);
  multiEffectGovernance.summary.assignmentCount = 1;
  multiEffectGovernance.summary.denyCount = 1;
  multiEffectGovernance.summary.auditCount = 1;
  multiEffectGovernance.constraintsRef.bytes = 1;
  const governanceHashes = await service.completeTaskOutputs(governanceTask, [
    { kind: "governance-constraints", value: multiEffectGovernance },
  ]);
  const policyHashes = await complete(service, "governance-reconciliation", [
    {
      kind: "policy-property-map",
      value: {
        ...policyMap(runId, governanceHashes.outputHashes["governance-constraints"]!),
        mappings: [
          {
            policyAssignmentId: "assignment-1",
            effect: "deny",
            logicalResourceId: "api",
            propertyPath: "properties.deny",
            disposition: "planned",
          },
          {
            policyAssignmentId: "assignment-1",
            effect: "audit",
            logicalResourceId: "api",
            propertyPath: "properties.audit",
            disposition: "planned",
          },
        ],
      },
    },
  ]);
  await complete(service, "governance-review", [
    {
      kind: "review-findings",
      value: review(runId, "policy-property-map", policyHashes["policy-property-map"]!),
    },
  ]);
  await service.decideGateNumber(2, "approved", "tester");

  const sourceHashes = {
    requirements: requirementHashes.outputHashes.requirements!,
    architecture: architectureHashes.outputHashes.architecture!,
    "governance-constraints": governanceHashes.outputHashes["governance-constraints"]!,
    "policy-property-map": policyHashes["policy-property-map"]!,
  };
  const validPlan = planBundle(runId, "bicep", {}, sourceHashes);
  const cyclicPlan = structuredClone(validPlan) as TaskOutput[];
  const cyclicIntent = cyclicPlan[0]!.value as ImplementationIntentV1;
  cyclicIntent.resources[0]!.dependsOn = ["worker"];
  cyclicIntent.resources.push({ ...cyclicIntent.resources[0]!, id: "worker", dependsOn: ["api"] });
  const cyclicBinding = cyclicPlan[1]!.value as IacBindingV1;
  cyclicBinding.resourceBindings.worker = { ...cyclicBinding.resourceBindings.api! };
  cyclicBinding.intentHash = sha256Json(cyclicIntent);
  const planTask = await task(service, "plan");
  await assert.rejects(service.completeTaskOutputs(planTask, cyclicPlan), /business:dependency-acyclic/);
  const planHashes = await service.completeTaskOutputs(planTask, validPlan);
  await complete(service, "plan-review", [
    {
      kind: "review-findings",
      value: review(runId, "plan", planHashes.outputHashes["implementation-intent"]!),
    },
  ]);
  await service.decideGateNumber(3, "approved", "tester");

  const validCodegen = codegenBundle(runId, "bicep", validPlan);
  const incompleteCodegen = structuredClone(validCodegen) as TaskOutput[];
  const incompleteManifest = incompleteCodegen[0]!.value as LogicalResourceManifestV1;
  incompleteManifest.resources[0]!.logicalId = "other";
  (incompleteCodegen[1]!.value as { logicalResourceManifestHash: string }).logicalResourceManifestHash =
    sha256Json(incompleteManifest);
  const codegenTask = await task(service, "codegen-bicep");
  await assert.rejects(service.completeTaskOutputs(codegenTask, incompleteCodegen), /business:bicep-binding-coverage/);
  await service.completeTaskOutputs(codegenTask, validCodegen);

  const validEvidence = validationEvidence(runId, "bicep");
  const incompleteEvidence = {
    ...validEvidence,
    entries: validEvidence.entries.filter(({ kind }) => kind !== "bicep:format"),
  };
  const validationTask = await task(service, "validation-bicep");
  await assert.rejects(
    service.completeTaskOutputs(validationTask, [{ kind: "validation-evidence", value: incompleteEvidence }]),
    /bicep:format/,
  );
  await service.completeTaskOutputs(validationTask, [{ kind: "validation-evidence", value: validEvidence }]);
});

test("architecture requires current scope-bound availability evidence", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const { runId } = await service.init({ projectId: "demo" });
  await service.nextTask();
  const requirementHashes = await complete(service, "requirements", [
    { kind: "requirements", value: requirements() },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
  ]);
  await complete(service, "requirements-review", [
    {
      kind: "review-findings",
      value: review(runId, "requirements", requirementHashes.requirements!),
    },
  ]);
  await service.decideGateNumber(1, "approved", "tester");

  const malformedPath = join(root, "invalid-availability.json");
  await writeFile(malformedPath, "{", "utf8");
  await assert.rejects(
    service.acceptEvidence({
      kind: "architecture-availability-v1",
      contentType: "application/json",
      file: malformedPath,
      required: true,
    }),
    /not valid JSON/,
  );

  await assert.rejects(
    service.acceptEvidence({
      kind: "architecture-availability-v1",
      contentType: "application/json",
      value: availabilityEvidence(runId),
      required: true,
    }),
    /source evidence is unavailable/,
  );
  const architectureOutputs: TaskOutput[] = [
    { kind: "architecture", value: architecture(runId) },
    { kind: "cost-estimate", value: costEstimate(runId) },
  ];
  await assert.rejects(
    service.completeTaskOutputs(await task(service, "architecture"), architectureOutputs),
    /business:availability-current/,
  );

  const staleHash = await acceptAvailabilityEvidence(service, runId, "demo", "local", {
    expiresAt: "2020-01-01T00:00:00.000Z",
  });
  const staleTask = await service.nextTask();
  assert.equal(staleTask.status, "task");
  if (staleTask.status !== "task") return;
  assert.ok(staleTask.task.inputRefs.includes(staleHash));
  await assert.rejects(
    service.completeTaskOutputs(staleTask.task.taskId, architectureOutputs),
    /business:availability-current/,
  );

  await acceptAvailabilityEvidence(service, runId, "demo", "local", {
    collectedAt: "2099-01-01T00:00:00.000Z",
  });
  await assert.rejects(
    service.completeTaskOutputs(await task(service, "architecture"), architectureOutputs),
    (error: unknown) =>
      error instanceof ApexError && JSON.stringify(error.details).includes("future collection timestamp"),
  );

  await acceptAvailabilityEvidence(service, runId, "demo", "local", {
    evidenceTargetScope: "other-scope",
  });
  await assert.rejects(
    service.completeTaskOutputs(await task(service, "architecture"), architectureOutputs),
    /business:availability-current/,
  );

  await assert.rejects(
    acceptAvailabilityEvidence(service, runId, "demo", "local", { mode: "native" }),
    /authorized capability adapter/,
  );

  await acceptAvailabilityEvidence(service, runId, "demo", "local", { unavailableCheck: "quota" });
  await assert.rejects(
    service.completeTaskOutputs(await task(service, "architecture"), architectureOutputs),
    /business:availability-current/,
  );

  const currentHash = await acceptAvailabilityEvidence(service, runId);
  const currentTask = await service.nextTask();
  assert.equal(currentTask.status, "task");
  if (currentTask.status !== "task") return;
  assert.ok(currentTask.task.inputRefs.includes(currentHash));
  await acceptAvailabilityEvidence(service, runId, "demo", "local", {
    expiresAt: "2020-01-01T00:00:00.000Z",
  });
  await assert.rejects(
    service.completeTaskOutputs(currentTask.task.taskId, architectureOutputs),
    (error: unknown) => error instanceof Error && /stale/i.test(error.message),
  );
  const replacementHash = await acceptAvailabilityEvidence(service, runId);
  const replacementTask = await service.nextTask();
  assert.equal(replacementTask.status, "task");
  if (replacementTask.status !== "task") return;
  assert.ok(replacementTask.task.inputRefs.includes(replacementHash));
  await service.completeTaskOutputs(replacementTask.task.taskId, architectureOutputs);
});

for (const track of ["bicep", "terraform"] as const) {
  test(`full logical ${track} workflow reaches fake deploy and quality`, async () => {
    const root = await tempRoot();
    const service = new ApexService(root);
    const { runId } = await service.init({ projectId: "demo", iacTool: track });
    await reachValidation(service, runId, track);
    const preview = await service.preview({ operation: "apply", provider: "fake" });
    const previewEvents = await new EventJournal(
      join(root, ".apex", "projects", "demo", "runs", runId, "journal"),
    ).replay();
    const previewCreated = [...previewEvents].reverse().find((event) => event.type === "preview.created");
    assert.deepEqual((previewCreated?.payload as { validatorIds?: unknown }).validatorIds, [
      "preview:hash-bindings",
      "preview:policy-precheck",
      "preview:coverage",
      "preview:freshness",
    ]);
    assert.equal((previewCreated?.payload as { evidenceMode?: unknown }).evidenceMode, "simulated");
    assert.deepEqual(
      (previewCreated?.payload as { omittedValidatorIds?: unknown }).omittedValidatorIds,
      track === "terraform" ? ["terraform:saved-plan-binding"] : undefined,
    );
    await service.decideGateNumber(4, "approved", "tester");
    const deployed = await service.deploy(preview.previewHash);
    assert.equal(deployed.inventory.resources.length, 1);
    const deploymentEvents = await new EventJournal(
      join(root, ".apex", "projects", "demo", "runs", runId, "journal"),
    ).replay();
    const deployment = [...deploymentEvents].reverse().find((event) => event.type === "deployment.completed");
    assert.deepEqual((deployment?.payload as { validatorIds?: unknown }).validatorIds, [
      "deploy:exact-approved-operation",
      "deploy:stale-writer-rejection",
    ]);
    assert.deepEqual((deployment?.payload as { preValidatorIds?: unknown }).preValidatorIds, [
      "deploy:exact-approved-operation",
      "deploy:stale-writer-rejection",
    ]);
    assert.deepEqual((deployment?.payload as { postValidatorIds?: unknown }).postValidatorIds, []);
    assert.deepEqual(
      (deployment?.payload as { omittedValidatorIds?: unknown }).omittedValidatorIds,
      track === "bicep"
        ? ["deploy:bicep-stack-ownership"]
        : ["deploy:exact-saved-plan", "deploy:state-lineage-and-serial"],
    );
    assert.equal((deployment?.payload as { evidenceMode?: unknown }).evidenceMode, "simulated");
    assert.deepEqual((deployment?.payload as { inventoryValidatorIds?: unknown }).inventoryValidatorIds, [
      "inventory:secret-free",
      "inventory:source-coverage",
      "inventory:eventual-consistency-reconciled",
    ]);
    const diagnosisTask = await task(service, "diagnosis");
    const diagnosis = {
      schemaVersion: "1.0.0" as const,
      projectId: "demo",
      runId,
      diagnosedAt: deployed.inventory.collectedAt,
      status: "healthy" as const,
      observations: ["deployed"],
      causes: [],
    };
    await assert.rejects(
      service.completeTaskOutputs(diagnosisTask, [
        { kind: "diagnosis", value: { ...diagnosis, observations: ["Bearer secret-token-value"] } },
      ]),
      /diagnosis:secret-free/,
    );
    await assert.rejects(
      service.completeTaskOutputs(diagnosisTask, [
        { kind: "diagnosis", value: { ...diagnosis, diagnosedAt: "2099-01-01T00:00:00.000Z" } },
      ]),
      /diagnosis:read-only/,
    );
    await assert.rejects(
      service.completeTaskOutputs(diagnosisTask, [
        {
          kind: "diagnosis",
          value: {
            ...diagnosis,
            causes: [
              {
                id: "cause-1",
                summary: "Observed mismatch",
                confidence: "medium",
                evidenceRefs: ["e".repeat(64)],
              },
            ],
          },
        },
      ]),
      /diagnosis:read-only/,
    );
    await service.completeTaskOutputs(diagnosisTask, [{ kind: "diagnosis", value: diagnosis }]);
    const qualityTask = await task(service, "quality");
    const report = await qualityReport(root, runId);
    const staleScorecard = { ...report, scorecardHash: "f".repeat(64) };
    await assert.rejects(
      service.completeTaskOutputs(qualityTask, [{ kind: "quality-report", value: staleScorecard }]),
      /quality:scorecard-decidable/,
    );
    await writeJson(join(root, ".apex", "quality", "measurements.json"), {
      schemaVersion: "1.0.0",
      measurements: [],
    });
    await assert.rejects(
      service.completeTaskOutputs(qualityTask, [{ kind: "quality-report", value: report }]),
      /quality:scorecard-decidable/,
    );
    await qualityReport(root, runId);
    const reordered = structuredClone(report);
    [reordered.checks[0], reordered.checks[1]] = [reordered.checks[1]!, reordered.checks[0]!];
    await assert.rejects(
      service.completeTaskOutputs(qualityTask, [{ kind: "quality-report", value: reordered }]),
      /quality:no-subjective-deterministic-claims/,
    );
    const measurementPath = join(root, ".apex", "quality", "measurements.json");
    const duplicatedMeasurements = JSON.parse(await readFile(measurementPath, "utf8")) as {
      schemaVersion: "1.0.0";
      measurements: Array<Record<string, unknown>>;
    };
    duplicatedMeasurements.measurements.push({ ...duplicatedMeasurements.measurements[0]! });
    await writeJson(measurementPath, duplicatedMeasurements);
    const duplicateMeasurementReport = {
      ...report,
      measurementsHash: sha256Json(duplicatedMeasurements),
    };
    await assert.rejects(
      service.completeTaskOutputs(qualityTask, [{ kind: "quality-report", value: duplicateMeasurementReport }]),
      /quality:no-subjective-deterministic-claims/,
    );
    await qualityReport(root, runId);
    const inventedPass = structuredClone(report);
    inventedPass.checks[0]!.status = "pass";
    inventedPass.checks[0]!.detail = "target satisfied";
    inventedPass.status = "pass";
    await assert.rejects(
      service.completeTaskOutputs(qualityTask, [{ kind: "quality-report", value: inventedPass }]),
      /quality:scorecard-decidable/,
    );
    const unsupportedClaim = structuredClone(report);
    const claimed = unsupportedClaim.checks.find(({ status }) => status !== "omitted")!;
    claimed.evidenceRefs = [];
    await assert.rejects(
      service.completeTaskOutputs(qualityTask, [{ kind: "quality-report", value: unsupportedClaim }]),
      /quality:no-subjective-deterministic-claims/,
    );
    await service.completeTaskOutputs(qualityTask, [{ kind: "quality-report", value: report }]);
    const qualityEvents = await new EventJournal(
      join(root, ".apex", "projects", "demo", "runs", runId, "journal"),
    ).replay();
    const qualityCompleted = [...qualityEvents]
      .reverse()
      .find((event) => event.type === "task.completed" && (event.payload as { nodeId?: unknown }).nodeId === "quality");
    assert.deepEqual((qualityCompleted?.payload as { validatorIds?: unknown }).validatorIds, [
      "quality:scorecard-decidable",
      "quality:no-subjective-deterministic-claims",
    ]);
    if (track === "bicep") {
      const workflowPath = join(root, ".apex", "runtime", "workflow.v1.json");
      const workflowBytes = await readFile(workflowPath);
      await writeFile(workflowPath, Buffer.concat([workflowBytes, Buffer.from("\n")]));
      await assert.rejects(
        service.status(),
        (error: unknown) => error instanceof ApexError && error.code === "APEX_STALE",
      );
      await writeFile(workflowPath, workflowBytes);
    }
    assert.equal((await service.status()).task, null);
    assert.equal((await service.status()).task, null);
    const finalEvents = await new EventJournal(
      join(root, ".apex", "projects", "demo", "runs", runId, "journal"),
    ).replay();
    const diagnosisCompleted = [...finalEvents]
      .reverse()
      .find(
        (event) => event.type === "task.completed" && (event.payload as { nodeId?: unknown }).nodeId === "diagnosis",
      );
    assert.deepEqual((diagnosisCompleted?.payload as { validatorIds?: unknown }).validatorIds, [
      "diagnosis:read-only",
      "diagnosis:secret-free",
    ]);
    const workflowCompleted = [...finalEvents].reverse().find((event) => event.type === "workflow.completed");
    assert.deepEqual((workflowCompleted?.payload as { validatorIds?: unknown }).validatorIds, [
      "terminal:run-evidence-complete",
    ]);
    const terminalPayload = workflowCompleted?.payload as {
      activeValidatorIds?: string[];
      executedValidatorIds?: string[];
      simulatedOmittedValidatorIds?: string[];
    };
    const accounted = new Set([
      ...(terminalPayload.executedValidatorIds ?? []),
      ...(terminalPayload.simulatedOmittedValidatorIds ?? []),
    ]);
    assert.equal(
      (terminalPayload.activeValidatorIds ?? [])
        .filter((id) => id !== "terminal:run-evidence-complete")
        .every((id) => accounted.has(id)),
      true,
    );
    const trackValidator = track === "bicep" ? "bicep:build" : "terraform:validate";
    const opposingTrackValidator = track === "bicep" ? "terraform:validate" : "bicep:build";
    assert.equal((terminalPayload.activeValidatorIds ?? []).includes(trackValidator), true);
    assert.equal((terminalPayload.activeValidatorIds ?? []).includes(opposingTrackValidator), false);
    assert.equal(finalEvents.filter(({ type }) => type === "workflow.completed").length, 1);
  });
}

test("native Bicep deploy records stack ownership evidence in manifest order", async () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const root = await tempRoot();
  const service = new ApexService(root, { clock: () => now, providers: { bicep: bicepPreviewProvider(now) } });
  const { runId } = await service.init({ projectId: "demo", iacTool: "bicep" });
  await reachValidation(service, runId, "bicep");
  const preview = await service.preview({ operation: "apply", provider: "bicep" });
  await service.decideGateNumber(4, "approved", "tester");
  await service.deploy(preview.previewHash);
  const events = await new EventJournal(join(root, ".apex", "projects", "demo", "runs", runId, "journal")).replay();
  const completed = [...events].reverse().find((event) => event.type === "deployment.completed");
  assert.deepEqual((completed?.payload as { validatorIds?: unknown }).validatorIds, [
    "deploy:exact-approved-operation",
    "deploy:bicep-stack-ownership",
    "deploy:stale-writer-rejection",
  ]);
  assert.deepEqual((completed?.payload as { preValidatorIds?: unknown }).preValidatorIds, [
    "deploy:exact-approved-operation",
    "deploy:stale-writer-rejection",
  ]);
  assert.deepEqual((completed?.payload as { postValidatorIds?: unknown }).postValidatorIds, [
    "deploy:bicep-stack-ownership",
  ]);
  assert.equal((completed?.payload as { evidenceMode?: unknown }).evidenceMode, "native");
});

test("native Terraform preview records saved-plan validation and rejects wrong bindings", async () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const root = await tempRoot();
  const provider = terraformPreviewProvider(now);
  const service = new ApexService(root, { clock: () => now, providers: { terraform: provider } });
  const { runId } = await service.init({ projectId: "demo", iacTool: "terraform" });
  await reachValidation(service, runId, "terraform");
  const preview = await service.preview({ operation: "apply", provider: "terraform" });
  const events = await new EventJournal(join(root, ".apex", "projects", "demo", "runs", runId, "journal")).replay();
  const created = [...events].reverse().find((event) => event.type === "preview.created");
  assert.deepEqual((created?.payload as { validatorIds?: unknown }).validatorIds, [
    "preview:hash-bindings",
    "preview:policy-precheck",
    "preview:coverage",
    "preview:freshness",
    "terraform:saved-plan-binding",
  ]);
  assert.equal((created?.payload as { evidenceMode?: unknown }).evidenceMode, "native");
  assert.match((created?.payload as { attestationHash?: string }).attestationHash!, /^[0-9a-f]{64}$/);
  await service.decideGateNumber(4, "approved", "tester");
  await service.deploy(preview.previewHash);
  const completedEvents = await new EventJournal(
    join(root, ".apex", "projects", "demo", "runs", runId, "journal"),
  ).replay();
  const deployment = [...completedEvents].reverse().find((event) => event.type === "deployment.completed");
  assert.deepEqual((deployment?.payload as { validatorIds?: unknown }).validatorIds, [
    "deploy:exact-approved-operation",
    "deploy:exact-saved-plan",
    "deploy:state-lineage-and-serial",
    "deploy:stale-writer-rejection",
  ]);
  assert.deepEqual((deployment?.payload as { preValidatorIds?: unknown }).preValidatorIds, [
    "deploy:exact-approved-operation",
    "deploy:stale-writer-rejection",
  ]);
  assert.deepEqual((deployment?.payload as { postValidatorIds?: unknown }).postValidatorIds, [
    "deploy:exact-saved-plan",
    "deploy:state-lineage-and-serial",
  ]);
  assert.equal((deployment?.payload as { evidenceMode?: unknown }).evidenceMode, "native");
  assert.equal((deployment?.payload as { omittedValidatorIds?: unknown }).omittedValidatorIds, undefined);

  const receiptRoot = await tempRoot();
  const missingReceipt = new ApexService(receiptRoot, {
    clock: () => now,
    providers: { terraform: terraformPreviewProvider(now, "missing-receipt") },
  });
  const receiptRun = await missingReceipt.init({ projectId: "demo", iacTool: "terraform" });
  await reachValidation(missingReceipt, receiptRun.runId, "terraform");
  const receiptPreview = await missingReceipt.preview({ operation: "apply", provider: "terraform" });
  await missingReceipt.decideGateNumber(4, "approved", "tester");
  await assert.rejects(missingReceipt.deploy(receiptPreview.previewHash), /deploy:exact-saved-plan/);
  const receiptEvents = await new EventJournal(
    join(receiptRoot, ".apex", "projects", "demo", "runs", receiptRun.runId, "journal"),
  ).replay();
  assert.equal(
    receiptEvents.some(({ type }) => type === "deployment.executed"),
    true,
  );
  assert.equal(
    receiptEvents.some(({ type }) => type === "deployment.completed"),
    false,
  );
  await assert.rejects(missingReceipt.deploy(receiptPreview.previewHash), /run reconcile before retrying/);
  assert.match((await missingReceipt.status()).blockers.join(" "), /requires reconciliation/);

  const extraRoot = await tempRoot();
  const extraReceipt = new ApexService(extraRoot, {
    clock: () => now,
    providers: { terraform: terraformPreviewProvider(now, "extra-receipt") },
  });
  const extraRun = await extraReceipt.init({ projectId: "demo", iacTool: "terraform" });
  await reachValidation(extraReceipt, extraRun.runId, "terraform");
  const extraPreview = await extraReceipt.preview({ operation: "apply", provider: "terraform" });
  await extraReceipt.decideGateNumber(4, "approved", "tester");
  await assert.rejects(extraReceipt.deploy(extraPreview.previewHash), /receipt validator IDs/);

  const reconcileRoot = await tempRoot();
  const reconcileProvider = terraformPreviewProvider(now, "inventory-once");
  const reconciling = new ApexService(reconcileRoot, {
    clock: () => now,
    providers: { terraform: reconcileProvider },
  });
  const reconcileRun = await reconciling.init({ projectId: "demo", iacTool: "terraform" });
  await reachValidation(reconciling, reconcileRun.runId, "terraform");
  const reconcilePreview = await reconciling.preview({ operation: "apply", provider: "terraform" });
  await reconciling.decideGateNumber(4, "approved", "tester");
  await assert.rejects(reconciling.deploy(reconcilePreview.previewHash), /inventory unavailable/);
  await assert.rejects(reconciling.deploy(reconcilePreview.previewHash), /run reconcile before retrying/);
  const reconciled = (await reconciling.reconcile()) as { deploymentHash: string };
  assert.equal(reconciled.deploymentHash, "9".repeat(64));
  await reconciling.deploy(reconcilePreview.previewHash);
  const reconciledEvents = await new EventJournal(
    join(reconcileRoot, ".apex", "projects", "demo", "runs", reconcileRun.runId, "journal"),
  ).replay();
  assert.equal(reconciledEvents.filter(({ type }) => type === "deployment.executed").length, 1);
  assert.equal(reconciledEvents.filter(({ type }) => type === "deployment.completed").length, 1);

  const indeterminateRoot = await tempRoot();
  const indeterminate = new ApexService(indeterminateRoot, {
    clock: () => now,
    providers: { terraform: terraformPreviewProvider(now, "apply-error") },
  });
  const indeterminateRun = await indeterminate.init({ projectId: "demo", iacTool: "terraform" });
  await reachValidation(indeterminate, indeterminateRun.runId, "terraform");
  const indeterminatePreview = await indeterminate.preview({ operation: "apply", provider: "terraform" });
  await indeterminate.decideGateNumber(4, "approved", "tester");
  await assert.rejects(indeterminate.deploy(indeterminatePreview.previewHash), /outcome is unknown/);
  await assert.rejects(indeterminate.deploy(indeterminatePreview.previewHash), /run reconcile before retrying/);
  const indeterminateEvents = await new EventJournal(
    join(indeterminateRoot, ".apex", "projects", "demo", "runs", indeterminateRun.runId, "journal"),
  ).replay();
  assert.equal(
    indeterminateEvents.some(({ type }) => type === "deployment.indeterminate"),
    true,
  );
  assert.equal(
    indeterminateEvents.some(({ type }) => type === "deployment.completed"),
    false,
  );

  for (const mutation of ["secret-inventory", "incomplete-inventory"] as const) {
    const inventoryRoot = await tempRoot();
    const inventoryService = new ApexService(inventoryRoot, {
      clock: () => now,
      providers: { terraform: terraformPreviewProvider(now, mutation) },
    });
    const inventoryRun = await inventoryService.init({ projectId: "demo", iacTool: "terraform" });
    await reachValidation(inventoryService, inventoryRun.runId, "terraform");
    const inventoryPreview = await inventoryService.preview({ operation: "apply", provider: "terraform" });
    await inventoryService.decideGateNumber(4, "approved", "tester");
    await assert.rejects(
      inventoryService.deploy(inventoryPreview.previewHash),
      mutation === "secret-inventory" ? /inventory:secret-free/ : /inventory:source-coverage/,
    );
    const inventoryEvents = await new EventJournal(
      join(inventoryRoot, ".apex", "projects", "demo", "runs", inventoryRun.runId, "journal"),
    ).replay();
    assert.equal(
      inventoryEvents.some(({ type }) => type === "deployment.executed"),
      true,
    );
    assert.equal(
      inventoryEvents.some(({ type }) => type === "deployment.completed"),
      false,
    );
  }

  const invalidRoot = await tempRoot();
  const invalid = new ApexService(invalidRoot, {
    clock: () => now,
    providers: { terraform: terraformPreviewProvider(now, "input-hash") },
  });
  const initialized = await invalid.init({ projectId: "demo", iacTool: "terraform" });
  await reachValidation(invalid, initialized.runId, "terraform");
  await assert.rejects(invalid.preview({ operation: "apply", provider: "terraform" }), /preview:hash-bindings/);
  assert.equal((await invalid.status()).run.gates[3]?.state, "closed");
  const invalidEvents = await new EventJournal(
    join(invalidRoot, ".apex", "projects", "demo", "runs", initialized.runId, "journal"),
  ).replay();
  assert.equal(
    invalidEvents.some(({ type }) => type === "preview.created"),
    false,
  );
  assert.equal(
    invalidEvents.some(({ type }) => type === "preview.requested"),
    false,
  );

  const operationRoot = await tempRoot();
  const wrongOperation = new ApexService(operationRoot, {
    clock: () => now,
    providers: { terraform: terraformPreviewProvider(now, "operation") },
  });
  const operationRun = await wrongOperation.init({ projectId: "demo", iacTool: "terraform" });
  await reachValidation(wrongOperation, operationRun.runId, "terraform");
  await assert.rejects(wrongOperation.preview({ operation: "apply", provider: "terraform" }), /preview:hash-bindings/);

  const stateRoot = await tempRoot();
  const wrongState = new ApexService(stateRoot, {
    clock: () => now,
    providers: { terraform: terraformPreviewProvider(now, "state") },
  });
  const stateRun = await wrongState.init({ projectId: "demo", iacTool: "terraform" });
  await reachValidation(wrongState, stateRun.runId, "terraform");
  await assert.rejects(
    wrongState.preview({ operation: "apply", provider: "terraform" }),
    /terraform:saved-plan-binding/,
  );

  const recovering = new ApexService(invalidRoot, {
    clock: () => now,
    providers: { terraform: terraformPreviewProvider(now) },
  });
  await recovering.preview({ operation: "apply", provider: "terraform" });
  assert.equal((await recovering.status()).run.gates[3]?.state, "open");
});

test("terminal validator rejects unaccounted active validators", () => {
  const registry = new ValidatorRegistry();
  registerWorkflowValidators(registry);
  const result = registry.validate("terminal:run-evidence-complete", {
    activeValidatorIds: ["schema:requirements-v1", "terminal:run-evidence-complete"],
    executedValidatorIds: [],
    simulatedOmittedValidatorIds: [],
  });
  assert.equal(result.valid, false);
  assert.match(result.issues[0]?.message ?? "", /schema:requirements-v1/);
});

test("review blockers persist, resolve, and permit gate approval", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const { runId } = await service.init({ projectId: "demo" });
  await service.nextTask();
  const hashes = await complete(service, "requirements", [
    { kind: "requirements", value: requirements() },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
  ]);
  const reviewHashes = await complete(service, "requirements-review", [
    {
      kind: "review-findings",
      value: review(runId, "requirements", hashes.requirements!, [
        { id: "F-1", severity: "high", disposition: "open", title: "Block", detail: "Resolve", evidenceRefs: [] },
      ]),
    },
  ]);
  await assert.rejects(service.nextTask(), (error: unknown) => error instanceof ApexError && /F-1/.test(error.message));
  const restarted = new ApexService(root);
  const reviewHash = reviewHashes["review-findings"]!;
  const dependencyHash = sha256Json({ "review-findings": reviewHash });
  await assert.rejects(
    restarted.resolveReview({
      findingId: "F-1",
      reviewHash,
      subjectHash: hashes.requirements!,
      disposition: "accepted-risk",
      actor: "tester",
      rationale: "not permitted",
      evidenceRefs: [],
      expiresAt: "2027-01-01T00:00:00.000Z",
      dependencyHash,
    }),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_AUTHORIZATION",
  );
  await restarted.resolveReview({
    findingId: "F-1",
    reviewHash,
    subjectHash: hashes.requirements!,
    disposition: "fixed",
    actor: "tester",
    rationale: "corrected requirement",
    evidenceRefs: [hashes.requirements!],
    dependencyHash,
  });
  assert.equal((await restarted.status()).run.gates[0]?.state, "open");
  await restarted.decideGateNumber(1, "approved", "tester");
  assert.equal((await restarted.nextTask()).status, "task");
});

test("expired accepted risk can be replaced without reopening an open gate", async () => {
  let now = Date.parse("2026-01-01T00:00:00.000Z");
  const service = new ApexService(await tempRoot(), { clock: () => new Date(now) });
  const { runId } = await service.init({ projectId: "demo" });
  await service.nextTask();
  const hashes = await complete(service, "requirements", [
    { kind: "requirements", value: requirements() },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
  ]);
  const reviewHashes = await complete(service, "requirements-review", [
    {
      kind: "review-findings",
      value: review(runId, "requirements", hashes.requirements!, [
        { id: "F-1", severity: "medium", disposition: "open", title: "Risk", detail: "Resolve", evidenceRefs: [] },
      ]),
    },
  ]);
  const dependencyHash = sha256Json({ "review-findings": reviewHashes["review-findings"]! });
  await service.resolveReview({
    findingId: "F-1",
    reviewHash: reviewHashes["review-findings"]!,
    subjectHash: hashes.requirements!,
    disposition: "accepted-risk",
    actor: "tester",
    rationale: "temporary exception",
    evidenceRefs: [],
    expiresAt: "2026-01-02T00:00:00.000Z",
    dependencyHash,
  });
  assert.equal((await service.status()).run.gates[0]?.state, "open");

  now = Date.parse("2026-01-03T00:00:00.000Z");
  await assert.rejects(service.decideGateNumber(1, "approved", "tester"), /gate:requirements-ready/);
  await service.resolveReview({
    findingId: "F-1",
    reviewHash: reviewHashes["review-findings"]!,
    subjectHash: hashes.requirements!,
    disposition: "fixed",
    actor: "tester",
    rationale: "permanent correction",
    evidenceRefs: [hashes.requirements!],
    dependencyHash,
  });
  assert.equal((await service.status()).run.gates[0]?.state, "open");
  await service.decideGateNumber(1, "approved", "tester");
});

test("promotion inherits neutral progression and restarts at the first environment-specific dependency", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const { runId } = await service.init({ projectId: "demo" });
  const codegen = await reachCodegen(service, runId, "bicep");
  await service.cancelTask(codegen.taskId);
  const sameScope = await service.promote("stage", "local");
  assert.deepEqual(
    sameScope.gates.map(({ state }) => state),
    ["inherited", "inherited", "inherited", "closed"],
  );
  assert.equal((await service.nextTask()).status, "task");
  assert.equal((await service.status()).task, "codegen-bicep");

  await service.use("demo", runId);
  const changedScope = await service.promote("prod", "subscription/prod");
  assert.deepEqual(
    changedScope.gates.map(({ state }) => state),
    ["inherited", "closed", "closed", "closed"],
  );
  const next = await service.nextTask();
  assert.equal(next.status, "task");
  if (next.status === "task") assert.equal(next.task.taskType, "governance-discovery");
});

test("approval bookkeeping preserves authority while runtime dependency mutation blocks deploy", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const { runId } = await service.init({ projectId: "demo" });
  await reachValidation(service, runId, "bicep");
  const preview = await service.preview({ operation: "apply", provider: "fake" });
  await service.decideGateNumber(4, "approved", "tester");
  const deployed = await service.deploy(preview.previewHash);
  assert.equal(deployed.inventory.resources.length, 1);

  const secondRoot = await tempRoot();
  const second = new ApexService(secondRoot);
  const initialized = await second.init({ projectId: "demo" });
  await reachValidation(second, initialized.runId, "bicep");
  const stalePreview = await second.preview({ operation: "apply", provider: "fake" });
  await second.decideGateNumber(4, "approved", "tester");
  await import("node:fs/promises").then(({ appendFile }) =>
    appendFile(join(secondRoot, ".apex", "runtime", "workflow.v1.json"), "\n"),
  );
  await assert.rejects(
    second.deploy(stalePreview.previewHash),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_STALE",
  );
});

test("invalid bundles are rejected before completion state changes", async () => {
  const service = new ApexService(await tempRoot());
  const { runId } = await service.init({ projectId: "demo" });
  await service.nextTask();
  const requirementTask = await task(service, "requirements");
  const before = await service.status();
  await assert.rejects(
    service.completeTaskOutputs(requirementTask, [{ kind: "requirements", value: requirements() }]),
    /missing/i,
  );
  assert.equal((await service.status()).events, before.events);

  const accepted = await service.completeTaskOutputs(requirementTask, [
    { kind: "requirements", value: requirements() },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
  ]);
  const hashes = await complete(service, "requirements-review", [
    { kind: "review-findings", value: review(runId, "requirements", accepted.outputHashes.requirements!) },
  ]);
  assert.ok(hashes["review-findings"]);
  await service.decideGateNumber(1, "approved", "tester");
  const architectureTask = await task(service, "architecture");
  await assert.rejects(
    service.completeTaskOutputs(architectureTask, [
      { kind: "architecture", value: architecture(runId) },
      { kind: "cost-estimate", value: costEstimate(runId, 2) },
    ]),
    /arithmetic/i,
  );
});

test("plan rejects wrong track and secret literals", async () => {
  const service = new ApexService(await tempRoot());
  const { runId } = await service.init({ projectId: "demo", iacTool: "bicep" });
  await reachValidation(service, runId, "bicep");
  const promoted = await service.promote("dev", "local-next");
  assert.equal(promoted.parentRunId, runId);

  const isolated = new ApexService(await tempRoot());
  const initialized = await isolated.init({ projectId: "demo", iacTool: "bicep" });
  await isolated.nextTask();
  const acceptedRequirements = await isolated.completeTask(await task(isolated, "requirements"), {
    kind: "requirements",
    value: requirements(),
  });
  await isolated.decideGateNumber(1, "approved", "tester");
  const planTask = await task(isolated, "plan");
  const sourceHashes = { requirements: acceptedRequirements.outputHash };
  await assert.rejects(
    isolated.completeTaskOutputs(planTask, planBundle(initialized.runId, "terraform", {}, sourceHashes)),
    /track/i,
  );
  await assert.rejects(
    isolated.completeTaskOutputs(
      planTask,
      planBundle(initialized.runId, "bicep", { password: { kind: "value", value: "literal" } }, sourceHashes),
    ),
    /secret-reference/i,
  );
});

test("MCP completeTask accepts an output bundle", async () => {
  const service = new ApexService(await tempRoot());
  await service.init({ projectId: "demo" });
  await service.nextTask();
  const issued = await service.nextTask();
  assert.equal(issued.status, "task");
  if (issued.status !== "task") return;
  const server = createMcpServer(service);
  const client = new Client({ name: "test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const response = await client.callTool({
    name: "completeTask",
    arguments: {
      taskId: issued.task.taskId,
      outputs: [
        { kind: "requirements", value: requirements() },
        { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
      ],
    },
  });
  assert.equal(response.isError, undefined);
  await client.close();
  await server.close();
});

test("restricted staging and generateIac produce a real accepted tree", async () => {
  const service = new ApexService(await tempRoot());
  const { runId } = await service.init({ projectId: "demo", iacTool: "bicep" });
  const { taskId } = await reachCodegen(service, runId, "bicep");
  const first = await service.stageFile(taskId, "notes.md", "bounded\n");
  const second = await service.stageFile(taskId, "notes.md", "bounded\n");
  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  await assert.rejects(service.stageFile(taskId, "../escape.tf", "bad"), /unsafe/i);
  await assert.rejects(service.stageFile(taskId, "notes.md", "changed\n"), /overwrite/i);
  const generated = await service.generateIac(taskId, { requiredToolVersions: { bicep: "test" } });
  assert.match(generated.treeHash, /^[0-9a-f]{64}$/);
  assert.ok(generated.files.some(({ path }) => path.endsWith("main.bicep")));
  assert.match(generated.outputHashes["iac-handoff"]!, /^[0-9a-f]{64}$/);
});
