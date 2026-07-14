import { CapabilityPackLoader } from "@apex/capabilities";
import { ApexError, ApexService, type ServiceOptions, type TaskOutput } from "@apex/cli";
import { CONTRACT_VERSION, type QualityScorecardV1, type ResourceInventoryV1 } from "@apex/contracts";
import { ContentCache, EventJournal, ObjectStore, benchmarkKernel, contentCacheKey, sha256Json } from "@apex/kernel";
import { evaluateQualityScorecard, renderResourceInventory } from "@apex/renderers";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { FakeClock, SequenceIds } from "./determinism.js";

export type QualificationTrack = "bicep" | "terraform";
export type QualificationCheckStatus = "pass" | "fail";

export interface QualificationCheck {
  id: string;
  status: QualificationCheckStatus;
  durationMs: number;
  detail?: string;
}

export interface QualificationTrackReport {
  track: QualificationTrack;
  status: QualificationCheckStatus;
  checks: QualificationCheck[];
  eventCount: number;
  hashes: Record<string, string>;
}

export interface QualificationReport {
  schemaVersion: "1.0.0";
  status: QualificationCheckStatus;
  durationMs: number;
  tracks: QualificationTrackReport[];
  checks: QualificationCheck[];
  eventCount: number;
  hashes: Record<string, string>;
}

export interface QualificationOptions {
  workspaceRoot: string;
  customizationsSource: string;
  clock?: FakeClock;
  ids?: SequenceIds;
  injectFailure?: string;
}

export interface BenchmarkBudgets {
  appendP95Ms: number;
  replayP95Ms: number;
  statusP95Ms: number;
}

export interface QualificationBenchmarkReport {
  schemaVersion: "1.0.0";
  status: QualificationCheckStatus;
  eventCount: number;
  budgets: BenchmarkBudgets;
  metrics: ReturnType<typeof benchmarkKernel>;
  checks: QualificationCheck[];
}

interface TrackContext {
  root: string;
  source: string;
  track: QualificationTrack;
  clock: FakeClock;
  ids: SequenceIds;
  options: ServiceOptions;
  runId: string;
  service: ApexService;
  checks: QualificationCheck[];
}

const HASH = "a".repeat(64);

export async function runQualification(options: QualificationOptions): Promise<QualificationReport> {
  const clock = options.clock ?? new FakeClock();
  const ids = options.ids ?? new SequenceIds("qualification");
  const tracks: QualificationTrackReport[] = [];
  const started = clock.now().getTime();
  for (const track of ["bicep", "terraform"] as const) {
    const root = join(options.workspaceRoot, track);
    const source = join(options.workspaceRoot, `.customizations-${track}`);
    await cp(options.customizationsSource, source, { recursive: true });
    const report = await runTrack(root, source, track, clock, ids, options.injectFailure);
    tracks.push(report);
  }
  const parityChecks: QualificationCheck[] = [];
  await checked(parityChecks, clock, "logical-parity", async () => {
    const [bicep, terraform] = tracks;
    if (bicep?.hashes.logicalInventory !== terraform?.hashes.logicalInventory)
      throw new Error("Track inventories differ logically");
  });
  const hashes = {
    report: sha256Json(
      tracks.map(({ track, eventCount, hashes: trackHashes }) => ({ track, eventCount, hashes: trackHashes })),
    ),
    logicalInventory: tracks[0]?.hashes.logicalInventory ?? "",
  };
  const checks = [...tracks.flatMap(({ checks: trackChecks }) => trackChecks), ...parityChecks];
  return {
    schemaVersion: "1.0.0",
    status: qualificationStatus(checks),
    durationMs: clock.now().getTime() - started,
    tracks,
    checks: parityChecks,
    eventCount: tracks.reduce((total, track) => total + track.eventCount, 0),
    hashes,
  };
}

export function qualificationStatus(checks: readonly QualificationCheck[]): QualificationCheckStatus {
  return checks.every(({ status }) => status === "pass") ? "pass" : "fail";
}

export function qualificationJson(report: QualificationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function runQualificationBenchmark(eventCount: number, budgets: BenchmarkBudgets): QualificationBenchmarkReport {
  const metrics = benchmarkKernel(eventCount);
  const checks = [
    budgetCheck("append-budget", metrics.append.p95Ms, budgets.appendP95Ms),
    budgetCheck("replay-budget", metrics.replay.p95Ms, budgets.replayP95Ms),
    budgetCheck("status-budget", metrics.status.p95Ms, budgets.statusP95Ms),
  ];
  return { schemaVersion: "1.0.0", status: qualificationStatus(checks), eventCount, budgets, metrics, checks };
}

async function runTrack(
  root: string,
  source: string,
  track: QualificationTrack,
  clock: FakeClock,
  ids: SequenceIds,
  injectFailure?: string,
): Promise<QualificationTrackReport> {
  await mkdir(root, { recursive: true });
  const serviceOptions = { clock: clock.now, idSource: ids.next };
  const context: TrackContext = {
    root,
    source,
    track,
    clock,
    ids,
    options: serviceOptions,
    runId: "",
    service: new ApexService(root, serviceOptions),
    checks: [],
  };
  await checked(
    context.checks,
    clock,
    "initialize-customizations",
    async () => {
      context.runId = (
        await context.service.init({
          projectId: `qualification-${track}`,
          iacTool: track,
          customizationsSource: source,
        })
      ).runId;
    },
    injectFailure,
  );
  await checked(
    context.checks,
    clock,
    "creative-workflow-gates-1-3",
    async () => {
      await completeCreativeWorkflow(context);
    },
    injectFailure,
  );
  restart(context);
  let inventory: ResourceInventoryV1 | undefined;
  await checked(
    context.checks,
    clock,
    "preview-gate-4-deploy-inventory",
    async () => {
      const preview = await context.service.preview({ operation: "apply", provider: "fake" });
      await context.service.decideGateNumber(4, "approved", "qualification");
      inventory = (await context.service.deploy(preview.previewHash)).inventory;
      await complete(context.service, "diagnosis", [{ kind: "diagnosis", value: diagnosis(context) }]);
      await complete(context.service, "quality", [{ kind: "quality-report", value: await quality(context) }]);
      await context.service.render("preview");
      await context.service.render("approval");
      await context.service.render("inventory");
    },
    injectFailure,
  );
  restart(context);
  await checked(
    context.checks,
    clock,
    "promotion-inheritance-fresh-gate-4",
    async () => {
      const sameScope = await context.service.promote("stage", "local");
      const sameScopeStates = sameScope.gates.map(({ state }) => state);
      if (sameScopeStates.join(",") !== "inherited,inherited,inherited,closed")
        throw new Error(`Unexpected same-scope promoted gates: ${sameScopeStates.join(",")}`);
      await context.service.use(sameScope.projectId, context.runId as never);
      const changedScope = await context.service.promote("prod", "local/prod");
      const changedScopeStates = changedScope.gates.map(({ state }) => state);
      if (changedScopeStates.join(",") !== "inherited,closed,closed,closed")
        throw new Error(`Unexpected changed-scope promoted gates: ${changedScopeStates.join(",")}`);
      await context.service.use(changedScope.projectId, context.runId as never);
    },
    injectFailure,
  );
  await checked(
    context.checks,
    clock,
    "destroy-preview-approval-destroy",
    async () => {
      const destroy = await minimalService(join(root, ".scenarios", "destroy"), track, clock, ids);
      const preview = await destroy.preview({ operation: "destroy", provider: "fake" });
      await destroy.decideGateNumber(4, "approved", "qualification");
      const destroyed = await destroy.deploy(preview.previewHash);
      if (destroyed.inventory.resources.length !== 0) throw new Error("Destroy inventory is not empty");
    },
    injectFailure,
  );
  await checked(
    context.checks,
    clock,
    "customization-conflict-preserves-edit",
    async () => verifyCustomizationConflict(context),
    injectFailure,
  );
  await checked(
    context.checks,
    clock,
    "fault-stale-task",
    async () => faultStaleTask(root, track, clock, ids),
    injectFailure,
  );
  await checked(
    context.checks,
    clock,
    "fault-corrupted-journal",
    async () => faultCorruptJournal(root, clock, ids),
    injectFailure,
  );
  await checked(
    context.checks,
    clock,
    "fault-stale-writer-epoch",
    async () => faultStaleEpoch(root, clock, ids),
    injectFailure,
  );
  await checked(
    context.checks,
    clock,
    "fault-changed-preview",
    async () => faultChangedPreview(root, track, clock, ids),
    injectFailure,
  );
  await checked(
    context.checks,
    clock,
    "fault-cache-invalidation",
    async () => faultCacheInvalidation(root),
    injectFailure,
  );
  await checked(context.checks, clock, "fault-missing-capability-pack", faultMissingCapabilityPack, injectFailure);
  await checked(
    context.checks,
    clock,
    "fault-crash-after-side-effect-reconciliation",
    async () => {
      await context.service.use(projectId(track) as never, context.runId as never);
      try {
        await context.service.reconcile();
        throw new Error("simulated crash after reconciliation side effect");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("simulated crash")) throw error;
      }
      restart(context);
      const reconciled = await context.service.reconcile();
      if (reconciled === undefined) throw new Error("Reconciliation returned no inventory");
    },
    injectFailure,
  );
  await checked(
    context.checks,
    clock,
    "repository-byte-hygiene",
    async () => verifyRepositoryBytes(root),
    injectFailure,
  );
  const status = await context.service.status();
  const journal = new EventJournal(
    join(root, ".apex", "projects", `qualification-${track}`, "runs", context.runId, "journal"),
  );
  const replay = await journal.replay();
  const objectStore = new ObjectStore(root);
  await checked(
    context.checks,
    clock,
    "event-replay-object-hashes",
    async () => {
      if (replay.length === 0 || status.head !== replay.at(-1)?.hash)
        throw new Error("Replay head does not match service status");
      for (const event of replay) {
        const payload = event.payload as Record<string, unknown>;
        for (const [key, value] of Object.entries(payload)) {
          if (
            (key.endsWith("ObjectHash") || key === "inventoryHash" || key === "approvalHash") &&
            typeof value === "string"
          )
            await objectStore.getJson(value);
        }
      }
    },
    injectFailure,
  );
  const logicalInventory = logicalInventoryHash(inventory);
  const renderedInventory = inventory === undefined ? "" : sha256Json(renderResourceInventory(inventory));
  return {
    track,
    status: qualificationStatus(context.checks),
    checks: context.checks,
    eventCount: replay.length,
    hashes: {
      eventHead: replay.at(-1)?.hash ?? "",
      logicalInventory,
      renderedInventory,
    },
  };
}

function restart(context: TrackContext): void {
  context.clock.advance(10);
  context.service = new ApexService(context.root, context.options);
}

async function completeCreativeWorkflow(context: TrackContext): Promise<void> {
  const { service, runId, track } = context;
  await service.nextTask();
  const requirementValue = requirements(track);
  const requirementHashes = await complete(service, "requirements", [
    { kind: "requirements", value: requirementValue },
    { kind: "sku-manifest", value: skuManifest(track, sha256Json(requirementValue)) },
  ]);
  await complete(service, "requirements-review", [
    { kind: "review-findings", value: review(context, "requirements", requirementHashes.requirements!) },
  ]);
  await service.decideGateNumber(1, "approved", "qualification");
  const availabilityRefs: Record<string, string> = {};
  for (const source of ["pricing", "quota", "regionalAvailability"] as const) {
    const accepted = (await service.acceptEvidence({
      kind: `${source}-evidence`,
      contentType: "application/json",
      value: { source, mode: "simulated", status: "current" },
      required: true,
    })) as { hash?: string };
    if (accepted.hash === undefined) throw new Error(`${source} evidence was not accepted`);
    availabilityRefs[source] = accepted.hash;
  }
  await service.acceptEvidence({
    kind: "architecture-availability-v1",
    contentType: "application/json",
    value: availabilityEvidence(context, availabilityRefs),
    required: true,
  });
  restart(context);
  const architectureHashes = await complete(context.service, "architecture", [
    { kind: "architecture", value: architecture(context) },
    { kind: "cost-estimate", value: costEstimate(context) },
  ]);
  await complete(context.service, "architecture-review", [
    { kind: "review-findings", value: review(context, "architecture", architectureHashes.architecture!) },
  ]);
  const governanceHashes = await complete(context.service, "governance-discovery", [
    { kind: "governance-constraints", value: governance(context) },
  ]);
  const policyHashes = await complete(context.service, "governance-reconciliation", [
    { kind: "policy-property-map", value: policyMap(context, governanceHashes["governance-constraints"]!) },
  ]);
  await complete(context.service, "governance-review", [
    { kind: "review-findings", value: review(context, "policy-property-map", policyHashes["policy-property-map"]!) },
  ]);
  await context.service.decideGateNumber(2, "approved", "qualification");
  restart(context);
  const plan = planBundle(context, {
    requirements: requirementHashes.requirements!,
    architecture: architectureHashes.architecture!,
    "governance-constraints": governanceHashes["governance-constraints"]!,
    "policy-property-map": policyHashes["policy-property-map"]!,
  });
  const planHashes = await complete(context.service, "plan", plan);
  await complete(context.service, "plan-review", [
    { kind: "review-findings", value: review(context, "plan", planHashes["implementation-intent"]!) },
  ]);
  await context.service.decideGateNumber(3, "approved", "qualification");
  restart(context);
  await complete(context.service, `codegen-${track}`, codegenBundle(context, plan));
  await complete(context.service, `validation-${track}`, [{ kind: "validation-evidence", value: validation(context) }]);
  if (runId.length === 0) throw new Error("Run was not initialized");
}

async function complete(
  service: ApexService,
  expected: string,
  outputs: TaskOutput[],
): Promise<Partial<Record<TaskOutput["kind"], string>>> {
  const issued = await service.nextTask();
  if (issued.status !== "task" || issued.task.taskType !== expected)
    throw new Error(
      `Expected ${expected}, received ${issued.status === "task" ? issued.task.taskType : issued.status}`,
    );
  return (await service.completeTaskOutputs(issued.task.taskId, outputs)).outputHashes;
}

function projectId(track: QualificationTrack): string {
  return `qualification-${track}`;
}
function requirements(track: QualificationTrack) {
  return requirementsFor(projectId(track));
}
function requirementsFor(id: string) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: id,
    workload: "qualification service",
    environment: "dev",
    requirements: [
      {
        id: "REQ-1",
        statement: "Deploy deterministically",
        priority: "must",
        status: "confirmed",
        source: "qualification",
      },
    ],
    assumptions: [],
    unknowns: [],
  };
}
function intentFor(id: string, runId: string, sourceHashes: Record<string, string>) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: id,
    runId,
    sourceHashes,
    resources: [{ id: "api", type: "fake/service", purpose: "Serve requests", dependsOn: [], controls: [] }],
    outputs: ["endpoint"],
  };
}
function skuManifest(track: QualificationTrack, sourceHash: string) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: projectId(track),
    environments: ["dev", "prod"],
    services: [],
    revisions: [{ number: 1, createdAt: "2026-01-01T00:00:00.000Z", sourceHash, reason: "qualification" }],
  };
}
function architecture(context: TrackContext) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: projectId(context.track),
    runId: context.runId,
    title: "Qualification",
    summary: "Equivalent fake architecture",
    sourceHashes: { requirements: HASH },
    components: [{ id: "api", service: "fake/service", purpose: "Serve", requirementIds: ["REQ-1"], dependsOn: [] }],
    decisions: [],
    risks: [],
  };
}
function costEstimate(context: TrackContext) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: projectId(context.track),
    runId: context.runId,
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
        monthlyCost: 1,
        source: { provider: "qualification", uri: "https://example.test", retrievedAt: "2026-01-01T00:00:00.000Z" },
        uncertainty: { lowerMonthlyCost: 1, upperMonthlyCost: 1, confidence: "high", basis: "fixed" },
      },
    ],
    totalMonthlyCost: 1,
    assumptions: [],
  };
}
function review(context: TrackContext, subjectKind: string, subjectHash: string) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: projectId(context.track),
    runId: context.runId,
    subjectKind,
    subjectHash,
    reviewedAt: context.clock.now().toISOString(),
    findings: [],
  };
}
function governance(context: TrackContext) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: projectId(context.track),
    runId: context.runId,
    targetScope: "local",
    discoveredAt: context.clock.now().toISOString(),
    expiresAt: "2027-01-01T00:00:00.000Z",
    summary: { assignmentCount: 0, denyCount: 0, modifyCount: 0, auditCount: 0, exemptionCount: 0 },
    constraintsRef: { mediaType: "application/json", uri: "memory://constraints", digest: HASH, bytes: 0 },
  };
}
function availabilityEvidence(context: TrackContext, evidenceRefs: Record<string, string>) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: projectId(context.track),
    runId: context.runId,
    targetScope: "local",
    mode: "simulated" as const,
    collectedAt: context.clock.now().toISOString(),
    expiresAt: "2099-01-01T00:00:00.000Z",
    checks: {
      pricing: { status: "current" as const, evidenceRef: evidenceRefs.pricing! },
      quota: { status: "current" as const, evidenceRef: evidenceRefs.quota! },
      regionalAvailability: {
        status: "current" as const,
        evidenceRef: evidenceRefs.regionalAvailability!,
      },
    },
  };
}
function policyMap(context: TrackContext, governanceHash: string) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: projectId(context.track),
    runId: context.runId,
    governanceHash,
    mappings: [],
  };
}
function planBundle(context: TrackContext, sourceHashes: Record<string, string>): TaskOutput[] {
  const intent = intentFor(projectId(context.track), context.runId, sourceHashes);
  return [
    { kind: "implementation-intent", value: intent },
    {
      kind: "iac-binding",
      value: {
        schemaVersion: CONTRACT_VERSION,
        projectId: projectId(context.track),
        runId: context.runId,
        track: context.track,
        intentHash: sha256Json(intent),
        resourceBindings: { api: { implementation: "fake/service", version: "1", parameters: {} } },
      },
    },
    {
      kind: "environment-inputs",
      value: {
        schemaVersion: CONTRACT_VERSION,
        projectId: projectId(context.track),
        runId: context.runId,
        environment: "dev",
        inputs: {},
      },
    },
  ];
}
function codegenBundle(context: TrackContext, plan: TaskOutput[]): TaskOutput[] {
  const manifest = {
    schemaVersion: CONTRACT_VERSION,
    projectId: projectId(context.track),
    runId: context.runId,
    track: context.track,
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
    { kind: "logical-resource-manifest", value: manifest },
    {
      kind: "iac-handoff",
      value: {
        schemaVersion: CONTRACT_VERSION,
        projectId: projectId(context.track),
        runId: context.runId,
        track: context.track,
        rootPath: ".apex/work/code",
        treeHash: HASH,
        intentHash: sha256Json(plan[0]!.value),
        bindingHash: sha256Json(plan[1]!.value),
        environmentInputsHash: sha256Json(plan[2]!.value),
        logicalResourceManifestHash: sha256Json(manifest),
        requiredToolVersions: { [context.track]: "test" },
        generatedAt: context.clock.now().toISOString(),
      },
    },
  ];
}
function validation(context: TrackContext) {
  const validatorIds =
    context.track === "bicep"
      ? ["bicep:format", "bicep:build", "bicep:lint"]
      : ["terraform:format", "terraform:init-backend-false", "terraform:validate"];
  validatorIds.push("business:security-baseline", "business:policy-property-map", "business:logical-resource-parity");
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: projectId(context.track),
    runId: context.runId,
    createdAt: context.clock.now().toISOString(),
    entries: validatorIds.map((kind) => ({ kind, hash: HASH, bytes: 1, required: true, retention: "immutable" })),
  };
}
function diagnosis(context: TrackContext) {
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: projectId(context.track),
    runId: context.runId,
    diagnosedAt: context.clock.now().toISOString(),
    status: "healthy",
    observations: ["deployed"],
    causes: [],
  };
}
async function quality(context: TrackContext) {
  const scorecard = JSON.parse(
    await readFile(join(context.root, ".apex", "runtime", "quality-scorecard.v1.json"), "utf8"),
  ) as QualityScorecardV1;
  const measurements = [...scorecard.rules]
    .map(({ metric, scenario }) => ({ metric, scenario, samples: 0, evidenceRefs: [] as string[] }))
    .sort((left, right) =>
      `${left.metric}\u0000${left.scenario}`.localeCompare(`${right.metric}\u0000${right.scenario}`),
    );
  const measurementSet = { schemaVersion: CONTRACT_VERSION, measurements };
  await mkdir(join(context.root, ".apex", "quality"), { recursive: true });
  await writeFile(
    join(context.root, ".apex", "quality", "measurements.json"),
    `${JSON.stringify(measurementSet)}\n`,
    "utf8",
  );
  const measurementsHash = sha256Json(measurementSet);
  const evaluations = evaluateQualityScorecard(scorecard, measurements);
  return {
    schemaVersion: CONTRACT_VERSION,
    projectId: projectId(context.track),
    runId: context.runId,
    evaluatedAt: context.clock.now().toISOString(),
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

async function verifyCustomizationConflict(context: TrackContext): Promise<void> {
  const sourceFile = join(context.source, "managed.txt");
  const localFile = join(context.root, "managed.txt");
  await writeFile(localFile, "deliberate-user-edit\n", "utf8");
  await writeFile(sourceFile, "upstream-update\n", "utf8");
  try {
    await context.service.update(context.source);
    throw new Error("Customization conflict was not detected");
  } catch (error) {
    if (!(error instanceof ApexError) || error.code !== "APEX_CONFLICT") throw error;
  }
  if ((await readFile(localFile, "utf8")) !== "deliberate-user-edit\n")
    throw new Error("Deliberate edit was overwritten");
}

async function faultStaleTask(
  root: string,
  track: QualificationTrack,
  clock: FakeClock,
  ids: SequenceIds,
): Promise<void> {
  const service = new ApexService(join(root, ".scenarios", "stale-task"), { clock: clock.now, idSource: ids.next });
  await service.init({ projectId: `stale-${track}`, iacTool: track });
  await service.nextTask();
  const issued = await service.nextTask();
  if (issued.status !== "task") throw new Error("Expected fault task");
  await service.recordRequirementsInput({ marker: "advance journal" });
  await expectFailure(
    () =>
      service.completeTaskOutputs(issued.task.taskId, [
        { kind: "requirements", value: requirementsFor(`stale-${track}`) },
      ]),
    /stale/i,
  );
}

async function faultCorruptJournal(root: string, clock: FakeClock, ids: SequenceIds): Promise<void> {
  const directory = join(root, ".faults", ids.next(), "journal");
  const journal = new EventJournal(directory);
  await journal.append({
    eventId: ids.next(),
    projectId: "fault",
    runId: "fault",
    type: "fault",
    timestamp: clock.now().toISOString(),
    ownerEpoch: 1,
    expectedHead: null,
    payload: { value: 1 },
  });
  const file = join(directory, (await readdir(directory))[0]!);
  await writeFile(file, (await readFile(file, "utf8")).replace('"value":1', '"value":2'), "utf8");
  await expectFailure(() => journal.replay(), /corrupt/i);
}

async function faultStaleEpoch(root: string, clock: FakeClock, ids: SequenceIds): Promise<void> {
  const journal = new EventJournal(join(root, ".faults", ids.next(), "journal"));
  const first = await journal.append({
    eventId: ids.next(),
    projectId: "fault",
    runId: "fault",
    type: "first",
    timestamp: clock.now().toISOString(),
    ownerEpoch: 2,
    expectedHead: null,
    payload: {},
  });
  await expectFailure(
    () =>
      journal.append({
        eventId: ids.next(),
        projectId: "fault",
        runId: "fault",
        type: "stale",
        timestamp: clock.now().toISOString(),
        ownerEpoch: 1,
        expectedHead: first.hash,
        payload: {},
      }),
    /epoch/i,
  );
}

async function faultChangedPreview(
  root: string,
  track: QualificationTrack,
  clock: FakeClock,
  ids: SequenceIds,
): Promise<void> {
  const service = await minimalService(join(root, ".scenarios", "changed-preview"), track, clock, ids);
  const preview = await service.preview({ operation: "apply", provider: "fake" });
  await service.decideGateNumber(4, "approved", "qualification");
  await expectFailure(() => service.deploy(sha256Json({ changed: preview.previewHash })), /current/i);
}

async function minimalService(
  root: string,
  track: QualificationTrack,
  clock: FakeClock,
  ids: SequenceIds,
): Promise<ApexService> {
  const service = new ApexService(root, { clock: clock.now, idSource: ids.next });
  const context: TrackContext = {
    root,
    source: "",
    track,
    clock,
    ids,
    options: { clock: clock.now, idSource: ids.next },
    runId: "",
    service,
    checks: [],
  };
  context.runId = (await service.init({ projectId: projectId(track), iacTool: track })).runId;
  await completeCreativeWorkflow(context);
  return service;
}

async function faultCacheInvalidation(root: string): Promise<void> {
  const cache = new ContentCache(root);
  const input = { dependencies: { source: HASH }, config: { mode: "qualification" }, toolchain: { version: "1" } };
  contentCacheKey(input);
  await cache.set(input, { valid: true });
  if ((await cache.invalidate("source")) !== 1 || (await cache.get(input)) !== null)
    throw new Error("Cache dependency was not invalidated");
}

async function faultMissingCapabilityPack(): Promise<void> {
  const loader = new CapabilityPackLoader({ resolvePackageJson: async () => undefined });
  const status = await loader.check({ packageName: "@apex/missing-qualification-pack", version: "1.0.0" });
  if (status.available || status.compatible || !status.actionableMessage.includes("missing"))
    throw new Error("Missing pack was not actionable");
}

async function verifyRepositoryBytes(root: string): Promise<void> {
  const forbidden = [/ghp_[A-Za-z0-9]+/, /BEGIN PRIVATE KEY/, /terraform\.tfstate/, /\.tfplan/];
  for (const file of await files(root)) {
    const path = relative(root, file);
    if (path === ".apex" || path.startsWith(`.apex/`) || path.startsWith(".faults/")) continue;
    const bytes = await readFile(file);
    const text = bytes.toString("utf8");
    if (forbidden.some((pattern) => pattern.test(text)) || /(^|\/)terraform\.tfstate($|\.)|\.tfplan$/i.test(path))
      throw new Error(`Forbidden repository bytes in ${path}`);
  }
}

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) =>
      entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)],
    ),
  );
  return nested.flat();
}

function logicalInventoryHash(inventory: ResourceInventoryV1 | undefined): string {
  if (inventory === undefined) return "";
  return sha256Json(
    inventory.resources
      .map(({ logicalId, type, location }) => ({ logicalId, type, location }))
      .sort((left, right) => left.logicalId.localeCompare(right.logicalId)),
  );
}

async function checked(
  checks: QualificationCheck[],
  clock: FakeClock,
  id: string,
  callback: () => void | Promise<void>,
  injectFailure?: string,
): Promise<void> {
  const started = clock.now().getTime();
  clock.advance(1);
  try {
    if (injectFailure === id) throw new Error(`Injected qualification failure: ${id}`);
    await callback();
    checks.push({ id, status: "pass", durationMs: clock.now().getTime() - started });
  } catch (error) {
    checks.push({
      id,
      status: "fail",
      durationMs: clock.now().getTime() - started,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function expectFailure(callback: () => unknown | Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await callback();
  } catch (error) {
    if (error instanceof Error && pattern.test(error.message)) return;
    throw error;
  }
  throw new Error(`Expected failure matching ${pattern}`);
}

function budgetCheck(id: string, actual: number, maximum: number): QualificationCheck {
  return actual <= maximum
    ? { id, status: "pass", durationMs: 0 }
    : { id, status: "fail", durationMs: 0, detail: `${actual}ms exceeds ${maximum}ms` };
}
