import type {
  ApprovalEvidenceV1,
  DeploymentPreviewV1,
  IacBindingV1,
  ImplementationIntentV1,
  OperationRecordV1,
  ProjectConfigV1,
  RequirementsV1,
  ResourceInventoryV1,
  RunConfigV1,
  RuntimeBundleLockV1,
  TaskEnvelopeV1,
} from "@apex/contracts";
import { CONTRACT_VERSION } from "@apex/contracts";
import { sha256 } from "@apex/capabilities";
import { sha256Text } from "@apex/kernel";

export const FIXTURE_TIME = "2026-01-01T00:00:00.000Z";
export const FIXTURE_EXPIRY = "2026-01-01T01:00:00.000Z";

export function fixtureHash(label: string): string {
  return sha256Text(`apex-testkit:${label}`);
}

export function runtimeLockFixture(overrides: Partial<RuntimeBundleLockV1> = {}): RuntimeBundleLockV1 {
  return {
    schemaVersion: CONTRACT_VERSION,
    cliVersion: "0.1.0",
    customizationVersion: "0.1.0",
    workflowHash: fixtureHash("workflow"),
    defaultsHash: fixtureHash("defaults"),
    validatorHash: fixtureHash("validator"),
    qualityScorecardHash: fixtureHash("quality-scorecard"),
    requiredCapabilityPacks: ["iac"],
    ...overrides,
  };
}

export function projectFixture(overrides: Partial<ProjectConfigV1> = {}): ProjectConfigV1 {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "test-project",
    displayName: "Test Project",
    createdAt: FIXTURE_TIME,
    defaultIacTool: "bicep",
    ...overrides,
  };
}

export function runFixture(overrides: Partial<RunConfigV1> = {}): RunConfigV1 {
  const dependencyHash = overrides.runtimeLockHash ?? fixtureHash("runtime-lock");
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "test-project",
    runId: "run-0001",
    environment: "test",
    targetScope: "/subscriptions/00000000-0000-0000-0000-000000000000",
    iacTool: "bicep",
    createdAt: FIXTURE_TIME,
    runtimeLockHash: dependencyHash,
    ownerEpoch: 1,
    gates: [1, 2, 3, 4].map((gate) => ({ gate, state: "closed", dependencyHash })),
    ...overrides,
  };
}

export function taskFixture(overrides: Partial<TaskEnvelopeV1> = {}): TaskEnvelopeV1 {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "test-project",
    runId: "run-0001",
    taskId: "task-0001",
    role: "test-agent",
    taskType: "render",
    expectedHead: fixtureHash("journal-head"),
    ownerEpoch: 1,
    createdAt: FIXTURE_TIME,
    expiresAt: FIXTURE_EXPIRY,
    inputRefs: [fixtureHash("input")],
    allowedOutputKinds: ["implementation-intent"],
    capabilityGrants: [{ capability: "filesystem.read", sideEffect: "none", expiresAt: FIXTURE_EXPIRY }],
    maxOutputBytes: 1024 * 1024,
    ...overrides,
  };
}

export function requirementsFixture(overrides: Partial<RequirementsV1> = {}): RequirementsV1 {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "test-project",
    workload: "test workload",
    environment: "test",
    requirements: [
      {
        id: "req-001",
        statement: "Provision deterministic infrastructure",
        priority: "must",
        status: "confirmed",
        source: "test",
      },
    ],
    assumptions: [],
    unknowns: [],
    ...overrides,
  };
}

export function intentFixture(overrides: Partial<ImplementationIntentV1> = {}): ImplementationIntentV1 {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "test-project",
    runId: "run-0001",
    sourceHashes: { requirements: fixtureHash("requirements") },
    resources: [
      {
        id: "storage",
        type: "Microsoft.Storage/storageAccounts",
        purpose: "Store artifacts",
        dependsOn: [],
        controls: ["https-only"],
      },
    ],
    outputs: ["storageResourceId"],
    ...overrides,
  };
}

export function bindingFixture(overrides: Partial<IacBindingV1> = {}): IacBindingV1 {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "test-project",
    runId: "run-0001",
    track: "bicep",
    intentHash: fixtureHash("intent"),
    resourceBindings: {
      storage: {
        implementation: "br/public:avm/res/storage/storage-account",
        version: "0.31.0",
        parameters: { location: "swedencentral" },
      },
    },
    ...overrides,
  };
}

export function previewFixture(overrides: Partial<DeploymentPreviewV1> = {}): DeploymentPreviewV1 {
  const body: Omit<DeploymentPreviewV1, "previewHash"> = {
    schemaVersion: CONTRACT_VERSION,
    projectId: "test-project",
    runId: "run-0001",
    environment: "test",
    track: "bicep",
    operation: "apply",
    target: "/subscriptions/00000000-0000-0000-0000-000000000000",
    commit: fixtureHash("commit"),
    dependencyRevision: fixtureHash("commit"),
    ownerEpoch: 1,
    inputHash: fixtureHash("input"),
    iacHash: fixtureHash("iac"),
    policyHash: fixtureHash("policy"),
    changes: [{ resourceId: "storage", action: "create", material: true }],
    blockers: [],
    createdAt: FIXTURE_TIME,
    expiresAt: FIXTURE_EXPIRY,
    ...without(overrides, "previewHash"),
  };
  return { ...body, previewHash: overrides.previewHash ?? sha256(body) };
}

export function approvalFixture(
  overrides: Partial<Extract<ApprovalEvidenceV1, { mechanism: "tty" }>> = {},
): ApprovalEvidenceV1 {
  const previewHash = overrides.previewHash ?? fixtureHash("preview");
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "test-project",
    runId: "run-0001",
    gate: 4,
    decision: "approved",
    actor: "test-user",
    mechanism: "tty",
    dependencyHash: previewHash,
    previewHash,
    writerEpoch: 1,
    recipientIdentity: "test-writer",
    decidedAt: FIXTURE_TIME,
    expiresAt: FIXTURE_EXPIRY,
    ...overrides,
  };
}

export function operationFixture(overrides: Partial<OperationRecordV1> = {}): OperationRecordV1 {
  return {
    schemaVersion: CONTRACT_VERSION,
    operationId: "operation-0001",
    projectId: "test-project",
    runId: "run-0001",
    providerOperationId: "fake-operation-0001",
    operation: "apply",
    state: "succeeded",
    previewHash: fixtureHash("preview"),
    approvalHash: fixtureHash("approval"),
    ownerEpoch: 1,
    updatedAt: FIXTURE_TIME,
    ...overrides,
  };
}

export function inventoryFixture(overrides: Partial<ResourceInventoryV1> = {}): ResourceInventoryV1 {
  const resources = overrides.resources ?? [
    {
      logicalId: "storage",
      resourceId: "/subscriptions/test/resourceGroups/test/providers/Microsoft.Storage/storageAccounts/test",
      type: "Microsoft.Storage/storageAccounts",
      location: "swedencentral",
      properties: { httpsOnly: true },
    },
  ];
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "test-project",
    runId: "run-0001",
    deploymentHash: sha256(resources),
    collectedAt: FIXTURE_TIME,
    ...overrides,
    resources,
  };
}

function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}
