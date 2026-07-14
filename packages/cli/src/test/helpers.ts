import {
  CONTRACT_VERSION,
  type ImplementationIntentV1,
  type QualityScorecardV1,
  type RequirementsV1,
} from "@apex/contracts";
import { sha256Json } from "@apex/kernel";
import { evaluateQualityScorecard } from "@apex/renderers";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
import type { ApexService, TaskOutput } from "../service.js";

const roots: string[] = [];

export async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "apex-cli-"));
  roots.push(root);
  return root;
}

after(async () => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

export function requirements(projectId = "demo"): RequirementsV1 {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId,
    workload: "offline service",
    environment: "dev",
    requirements: [
      { id: "REQ-1", statement: "Deploy deterministically", priority: "must", status: "confirmed", source: "user" },
    ],
    assumptions: [],
    unknowns: [],
  };
}

export function intent(
  runId: string,
  projectId = "demo",
  sourceHashes: Record<string, string> = { requirements: "a".repeat(64) },
): ImplementationIntentV1 {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId,
    runId,
    sourceHashes,
    resources: [{ id: "api", type: "fake/service", purpose: "Serve requests", dependsOn: [], controls: [] }],
    outputs: ["endpoint"],
  };
}

export function skuManifest(sourceHash = "a".repeat(64)) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "demo",
    environments: ["dev"],
    services: [],
    revisions: [{ number: 1, createdAt: "2026-01-01T00:00:00.000Z", sourceHash, reason: "Initial" }],
  };
}

export function architecture(runId: string) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "demo",
    runId,
    title: "Demo",
    summary: "Demo architecture",
    sourceHashes: { requirements: "a".repeat(64) },
    components: [{ id: "api", service: "fake/service", purpose: "Serve", requirementIds: ["REQ-1"], dependsOn: [] }],
    decisions: [],
    risks: [],
  };
}

export function costEstimate(runId: string, monthlyCost = 1) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "demo",
    runId,
    currency: "USD",
    pricingDate: "2026-01-01",
    lineItems: [
      {
        id: "api",
        service: "fake/service",
        sku: "test",
        quantity: 1,
        unitPrice: 1,
        unitsPerMonth: 1,
        monthlyCost,
        source: { provider: "test", uri: "https://example.test", retrievedAt: "2026-01-01T00:00:00.000Z" },
        uncertainty: { lowerMonthlyCost: 0, upperMonthlyCost: 2, confidence: "high", basis: "test" },
      },
    ],
    totalMonthlyCost: monthlyCost,
    assumptions: [],
  };
}

export function review(runId: string, subjectKind: string, subjectHash: string, findings: unknown[] = []) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "demo",
    runId,
    subjectKind,
    subjectHash,
    reviewedAt: "2026-01-01T00:00:00.000Z",
    findings,
  };
}

export function governance(runId: string) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "demo",
    runId,
    targetScope: "local",
    discoveredAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    summary: { assignmentCount: 0, denyCount: 0, modifyCount: 0, auditCount: 0, exemptionCount: 0 },
    constraintsRef: { mediaType: "application/json", uri: "memory://constraints", digest: "b".repeat(64), bytes: 0 },
  };
}

export function availabilityEvidence(
  runId: string,
  projectId = "demo",
  targetScope = "local",
  mode: "native" | "simulated" = "simulated",
  evidenceRefs = {
    pricing: "1".repeat(64),
    quota: "2".repeat(64),
    regionalAvailability: "3".repeat(64),
  },
  expiresAt = "2099-01-01T00:00:00.000Z",
  unavailableCheck?: "pricing" | "quota" | "regionalAvailability",
  collectedAt = "2026-01-01T00:00:00.000Z",
) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId,
    runId,
    targetScope,
    mode,
    collectedAt,
    expiresAt,
    checks: {
      pricing: {
        status: unavailableCheck === "pricing" ? ("unavailable" as const) : ("current" as const),
        evidenceRef: evidenceRefs.pricing,
      },
      quota: {
        status: unavailableCheck === "quota" ? ("unavailable" as const) : ("current" as const),
        evidenceRef: evidenceRefs.quota,
      },
      regionalAvailability: {
        status: unavailableCheck === "regionalAvailability" ? ("unavailable" as const) : ("current" as const),
        evidenceRef: evidenceRefs.regionalAvailability,
      },
    },
  };
}

export async function acceptAvailabilityEvidence(
  service: ApexService,
  runId: string,
  projectId = "demo",
  targetScope = "local",
  options: {
    evidenceTargetScope?: string;
    expiresAt?: string;
    unavailableCheck?: "pricing" | "quota" | "regionalAvailability";
    collectedAt?: string;
    mode?: "native" | "simulated";
  } = {},
): Promise<string> {
  const refs = { pricing: "", quota: "", regionalAvailability: "" };
  for (const source of ["pricing", "quota", "regionalAvailability"] as const) {
    const accepted = (await service.acceptEvidence({
      kind: `${source}-evidence`,
      contentType: "application/json",
      value: { source, mode: "simulated", status: "current" },
      required: true,
    })) as { hash?: string };
    if (accepted.hash === undefined) throw new Error(`${source} evidence was not accepted`);
    refs[source] = accepted.hash;
  }
  const accepted = (await service.acceptEvidence({
    kind: "architecture-availability-v1",
    contentType: "application/json",
    value: availabilityEvidence(
      runId,
      projectId,
      options.evidenceTargetScope ?? targetScope,
      options.mode ?? "simulated",
      refs,
      options.expiresAt,
      options.unavailableCheck,
      options.collectedAt,
    ),
    required: true,
  })) as { hash?: string };
  if (accepted.hash === undefined) throw new Error("Availability evidence was not accepted");
  return accepted.hash;
}

export function policyMap(runId: string, governanceHash: string) {
  return { schemaVersion: CONTRACT_VERSION, projectId: "demo", runId, governanceHash, mappings: [] };
}

export function planBundle(
  runId: string,
  track: "bicep" | "terraform",
  environmentInputs: Record<string, unknown> = {},
  sourceHashes: Record<string, string> = { requirements: "a".repeat(64) },
) {
  const implementation = intent(runId, "demo", sourceHashes);
  return [
    { kind: "implementation-intent" as const, value: implementation },
    {
      kind: "iac-binding" as const,
      value: {
        schemaVersion: CONTRACT_VERSION,
        projectId: "demo",
        runId,
        track,
        intentHash: sha256Json(implementation),
        resourceBindings: {
          api: {
            implementation: "native:Microsoft.Storage/storageAccounts@2023-05-01",
            version: "2023-05-01",
            parameters: { name: "apidemo", location: "swedencentral", parentId: "/", properties: {} },
          },
        },
      },
    },
    {
      kind: "environment-inputs" as const,
      value: {
        schemaVersion: CONTRACT_VERSION,
        projectId: "demo",
        runId,
        environment: "dev",
        inputs: environmentInputs,
      },
    },
  ];
}

export function codegenBundle(runId: string, track: "bicep" | "terraform", plan: ReturnType<typeof planBundle>) {
  const manifest = {
    schemaVersion: CONTRACT_VERSION,
    projectId: "demo",
    runId,
    track,
    resources: [
      {
        logicalId: "api",
        type: "fake/service",
        implementationAddress: "api",
        implementationKind: "resource",
        ownership: "managed",
        dependsOn: [],
        generatedDependencies: [],
        sourcePath: "main",
      },
    ],
  };
  return [
    { kind: "logical-resource-manifest" as const, value: manifest },
    {
      kind: "iac-handoff" as const,
      value: {
        schemaVersion: CONTRACT_VERSION,
        projectId: "demo",
        runId,
        track,
        rootPath: ".apex/work/code",
        treeHash: "c".repeat(64),
        intentHash: sha256Json(plan[0]!.value),
        bindingHash: sha256Json(plan[1]!.value),
        environmentInputsHash: sha256Json(plan[2]!.value),
        logicalResourceManifestHash: sha256Json(manifest),
        requiredToolVersions: { [track]: "test" },
        generatedAt: "2026-01-01T00:00:00.000Z",
      },
    },
  ];
}

export function validationEvidence(runId: string, track: "bicep" | "terraform") {
  const validatorIds =
    track === "bicep"
      ? ["bicep:format", "bicep:build", "bicep:lint"]
      : ["terraform:format", "terraform:init-backend-false", "terraform:validate"];
  validatorIds.push("business:security-baseline", "business:policy-property-map", "business:logical-resource-parity");
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: "demo",
    runId,
    createdAt: "2026-01-01T00:00:00.000Z",
    entries: validatorIds.map((kind) => ({
      kind,
      hash: "d".repeat(64),
      bytes: 1,
      required: true,
      retention: "immutable",
    })),
  };
}

export async function qualityReport(root: string, runId: string, projectId = "demo") {
  const scorecard = JSON.parse(
    await readFile(join(root, ".apex", "runtime", "quality-scorecard.v1.json"), "utf8"),
  ) as QualityScorecardV1;
  const measurements = [...scorecard.rules]
    .map(({ metric, scenario }) => ({ metric, scenario, samples: 0, evidenceRefs: [] as string[] }))
    .sort((left, right) =>
      `${left.metric}\u0000${left.scenario}`.localeCompare(`${right.metric}\u0000${right.scenario}`),
    );
  const measurementSet = { schemaVersion: CONTRACT_VERSION, measurements };
  await writeJson(join(root, ".apex", "quality", "measurements.json"), measurementSet);
  const measurementsHash = sha256Json(measurementSet);
  const evaluations = evaluateQualityScorecard(scorecard, measurements);
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId,
    runId,
    evaluatedAt: "2026-01-01T00:00:00.000Z",
    scorecardHash: sha256Json(scorecard),
    measurementsHash,
    status:
      evaluations.some(({ decision }) => decision === "fail") ||
      !evaluations.some(({ decision }) => decision === "pass")
        ? ("fail" as const)
        : ("pass" as const),
    checks: evaluations.map(({ metric, scenario, decision, value, samples, reason }) => ({
      id: metric,
      scenario,
      status: decision,
      ...(value === undefined ? {} : { value }),
      samples,
      evidenceRefs: decision === "omitted" ? [] : [measurementsHash],
      detail: reason,
    })),
  };
}

export async function prepareValidatedRun(service: ApexService, runId: string, track: "bicep" | "terraform") {
  const nextTask = async (expected: string) => {
    const next = await service.nextTask();
    if (next.status !== "task" || next.task.taskType !== expected) throw new Error(`Expected ${expected}`);
    return next.task.taskId;
  };
  const complete = async (expected: string, outputs: TaskOutput[]) =>
    service.completeTaskOutputs(await nextTask(expected), outputs);
  await service.nextTask();
  const requirementHashes = await complete("requirements", [
    { kind: "requirements", value: requirements() },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
  ]);
  await complete("requirements-review", [
    { kind: "review-findings", value: review(runId, "requirements", requirementHashes.outputHashes.requirements!) },
  ]);
  await service.decideGateNumber(1, "approved", "tester");
  await acceptAvailabilityEvidence(service, runId);
  const architectureHashes = await complete("architecture", [
    { kind: "architecture", value: architecture(runId) },
    { kind: "cost-estimate", value: costEstimate(runId) },
  ]);
  await complete("architecture-review", [
    { kind: "review-findings", value: review(runId, "architecture", architectureHashes.outputHashes.architecture!) },
  ]);
  const governanceHashes = await complete("governance-discovery", [
    { kind: "governance-constraints", value: governance(runId) },
  ]);
  const policyHashes = await complete("governance-reconciliation", [
    {
      kind: "policy-property-map",
      value: policyMap(runId, governanceHashes.outputHashes["governance-constraints"]!),
    },
  ]);
  await complete("governance-review", [
    {
      kind: "review-findings",
      value: review(runId, "policy-property-map", policyHashes.outputHashes["policy-property-map"]!),
    },
  ]);
  await service.decideGateNumber(2, "approved", "tester");
  const plan = planBundle(
    runId,
    track,
    {},
    {
      requirements: requirementHashes.outputHashes.requirements!,
      architecture: architectureHashes.outputHashes.architecture!,
      "governance-constraints": governanceHashes.outputHashes["governance-constraints"]!,
      "policy-property-map": policyHashes.outputHashes["policy-property-map"]!,
    },
  );
  const planHashes = await complete("plan", plan);
  await complete("plan-review", [
    { kind: "review-findings", value: review(runId, "plan", planHashes.outputHashes["implementation-intent"]!) },
  ]);
  await service.decideGateNumber(3, "approved", "tester");
  await complete(`codegen-${track}`, codegenBundle(runId, track, plan));
  await complete(`validation-${track}`, [{ kind: "validation-evidence", value: validationEvidence(runId, track) }]);
}
