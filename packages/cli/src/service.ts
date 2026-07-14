import {
  ApprovalEvidenceV1Schema,
  ArchitectureV1Schema,
  CONTRACT_VERSION,
  CostEstimateV1Schema,
  DeploymentPreviewV1Schema,
  DiagnosisV1Schema,
  EnvironmentInputsV1Schema,
  EvidenceManifestV1Schema,
  ExecutionPlanAttestationV1Schema,
  GovernanceConstraintsV1Schema,
  IacBindingV1Schema,
  IacHandoffV1Schema,
  ImplementationIntentV1Schema,
  LogicalResourceManifestV1Schema,
  OperationRecordV1Schema,
  PolicyPropertyMapV1Schema,
  QualityReportV1Schema,
  RequirementsV1Schema,
  ResourceInventoryV1Schema,
  ReviewFindingsV1Schema,
  RuntimeBundleLockV1Schema,
  SkuManifestV1Schema,
  hasOnlyTypedSecretReferences,
  hasValidCostArithmetic,
  hasValidLogicalResourceReferences,
  type ApprovalEvidenceV1,
  type CostEstimateV1,
  type DeploymentPreviewV1,
  type EnvironmentInputsV1,
  type IacBindingV1,
  type LogicalResourceManifestV1,
  type ImplementationIntentV1,
  type Operation,
  type ProjectId,
  type ResourceInventoryV1,
  type ReviewFindingsV1,
  type RunConfigV1,
  type RunId,
  type RuntimeBundleLockV1,
  type TaskEnvelopeV1,
  type ExecutionPlanAttestationV1,
} from "@apex/contracts";
import {
  CapabilityPackManager,
  FakeIaCProvider,
  ProcessRunner,
  generateBicepTree,
  generateTerraformTree,
  type CapabilityPackInstallOptions,
  type IacProvider,
  type ProcessRunnerLike,
} from "@apex/capabilities";
import {
  ContentCache,
  EvidencePolicy,
  EvidenceStore,
  EventJournal,
  ObjectStore,
  ProjectStore,
  RunRepository,
  ValidatorRegistry,
  WriterTransferStore,
  WorkflowEngine,
  assertTaskCurrent,
  atomicWriteBytes,
  atomicWriteJson,
  createTaskEnvelope,
  decideGate,
  inheritGate,
  openGate,
  sha256Bytes,
  sha256Json,
  workflowValidatorOwnership,
  type JsonValue,
} from "@apex/kernel";
import {
  renderApprovalEvidence,
  renderDeploymentPreview,
  renderRequirements,
  renderResourceInventory,
  renderRunStatus,
} from "@apex/renderers";
import { constants } from "node:fs";
import { access, cp, lstat, mkdir, readFile, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import { basename, delimiter, isAbsolute, join, relative, resolve, sep } from "node:path";
import { resolveBundledAssets } from "./assets.js";
import { ApexError, EXIT_CODES } from "./errors.js";
import {
  registerTaskWorkflowValidators,
  taskWorkflowValidatorInput,
  type WorkflowTaskValidatorContext,
} from "./workflow-validators.js";

const ZERO_HASH = "0".repeat(64);
const TASK_TTL_MS = 24 * 60 * 60 * 1000;
const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

interface Selection {
  projectId: ProjectId;
  runId: RunId;
}

interface ManagedFile {
  path: string;
  sourceHash: string;
  baseHash: string;
  currentHash: string;
  baseRef?: string;
}

interface CustomizationLock {
  version: 1;
  source: string;
  runtime: ManagedFile[];
  files: ManagedFile[];
  previousLockRef?: string;
}

interface CustomizationTransactionEntry {
  destination: string;
  staged?: string;
  backup?: string;
  existed: boolean;
  remove?: boolean;
}

interface CustomizationTransaction {
  version: 1;
  status: "applying";
  entries: CustomizationTransactionEntry[];
}

export interface TaskOutput {
  kind: ArtifactKind;
  value: unknown;
  summary?: string;
}

export interface StagedArtifact {
  taskId: string;
  kind: TaskOutput["kind"];
  path: string;
  bytes: number;
  hash: string;
}

export interface StagedFile {
  taskId: string;
  path: string;
  bytes: number;
  hash: string;
  idempotent: boolean;
}

export interface GenerateIacOptions {
  existingResources?: string[];
  azurermProviderConstraint?: string;
  azapiProviderConstraint?: string;
  lockFileContent?: string;
  requiredToolVersions?: Record<string, string>;
}

interface PreviewOptions {
  operation: Operation;
  provider: "fake" | "bicep" | "terraform";
  expiresInMs?: number;
}

export interface ReviewResolution {
  findingId: string;
  reviewHash: string;
  subjectHash: string;
  disposition: "fixed" | "accepted-risk";
  actor: string;
  rationale: string;
  evidenceRefs: string[];
  expiresAt?: string;
  dependencyHash: string;
}

export interface ServiceOptions {
  clock?: () => Date;
  idSource?: () => string;
  providers?: Partial<Record<"fake" | "bicep" | "terraform", IacProvider>>;
  executableChecker?: (executable: string) => Promise<boolean>;
  azureAuthStatus?: (live: boolean) => Promise<{ authenticated: boolean; detail: string }>;
  customizationFailureInjector?: (index: number, destination: string) => void | Promise<void>;
  processRunner?: ProcessRunnerLike;
}

interface DoctorCheck {
  id: string;
  ok: boolean;
  value: string;
  remedy?: string;
}

const ARTIFACTS = {
  requirements: ["requirements", RequirementsV1Schema],
  "sku-manifest": ["sku-manifest", SkuManifestV1Schema],
  architecture: ["architecture", ArchitectureV1Schema],
  "cost-estimate": ["cost-estimate", CostEstimateV1Schema],
  "review-findings": ["review-findings", ReviewFindingsV1Schema],
  "governance-constraints": ["governance-constraints", GovernanceConstraintsV1Schema],
  "policy-property-map": ["policy-property-map", PolicyPropertyMapV1Schema],
  "implementation-intent": ["implementation-intent", ImplementationIntentV1Schema],
  "iac-binding": ["iac-binding", IacBindingV1Schema],
  "environment-inputs": ["environment-inputs", EnvironmentInputsV1Schema],
  "logical-resource-manifest": ["logical-resource-manifest", LogicalResourceManifestV1Schema],
  "iac-handoff": ["iac-handoff", IacHandoffV1Schema],
  "validation-evidence": ["validation-evidence", EvidenceManifestV1Schema],
  "deployment-preview": ["preview", DeploymentPreviewV1Schema],
  "execution-plan-attestation": ["execution-plan-attestation", ExecutionPlanAttestationV1Schema],
  "operation-record": ["operation", OperationRecordV1Schema],
  "resource-inventory": ["inventory", ResourceInventoryV1Schema],
  diagnosis: ["diagnosis", DiagnosisV1Schema],
  "quality-report": ["quality-report", QualityReportV1Schema],
} as const;

export type ArtifactKind = keyof typeof ARTIFACTS;
export const SUPPORTED_ARTIFACT_KINDS = Object.keys(ARTIFACTS) as ArtifactKind[];

interface WorkflowTaskDescriptor {
  id: string;
  role: string;
  outputs: ArtifactKind[];
  gate?: number;
  track?: "bicep" | "terraform";
  reviewSubject?: string;
  capabilities?: string[];
}

const TASKS: readonly WorkflowTaskDescriptor[] = [
  { id: "requirements", role: "requirements", outputs: ["requirements", "sku-manifest"] },
  { id: "requirements-review", role: "reviewer", outputs: ["review-findings"], reviewSubject: "requirements", gate: 1 },
  { id: "architecture", role: "architect", outputs: ["architecture", "cost-estimate"] },
  { id: "architecture-review", role: "reviewer", outputs: ["review-findings"], reviewSubject: "architecture" },
  {
    id: "governance-discovery",
    role: "governance-operator",
    outputs: ["governance-constraints"],
    capabilities: ["governance-discovery"],
  },
  { id: "governance-reconciliation", role: "governance-operator", outputs: ["policy-property-map"] },
  {
    id: "governance-review",
    role: "reviewer",
    outputs: ["review-findings"],
    reviewSubject: "governance-reconciliation",
    gate: 2,
  },
  { id: "plan", role: "planner", outputs: ["implementation-intent", "iac-binding", "environment-inputs"] },
  { id: "plan-review", role: "reviewer", outputs: ["review-findings"], reviewSubject: "plan", gate: 3 },
  { id: "codegen-bicep", role: "bicep-codegen", outputs: ["logical-resource-manifest", "iac-handoff"], track: "bicep" },
  {
    id: "codegen-terraform",
    role: "terraform-codegen",
    outputs: ["logical-resource-manifest", "iac-handoff"],
    track: "terraform",
  },
  { id: "validation-bicep", role: "validator", outputs: ["validation-evidence"], track: "bicep" },
  { id: "validation-terraform", role: "validator", outputs: ["validation-evidence"], track: "terraform" },
  { id: "diagnosis", role: "diagnostic-operator", outputs: ["diagnosis"] },
  { id: "quality", role: "quality-evaluator", outputs: ["quality-report"] },
] as const;

export class ApexService {
  readonly root: string;
  private readonly clock: () => Date;
  private readonly idSource: () => string;
  private readonly projects: ProjectStore;
  private readonly objects: ObjectStore;
  private readonly cache: ContentCache;
  private readonly validators = new ValidatorRegistry();
  private readonly providers: Partial<Record<"fake" | "bicep" | "terraform", IacProvider>>;
  private readonly executableChecker: (executable: string) => Promise<boolean>;
  private readonly azureAuthStatus: (live: boolean) => Promise<{ authenticated: boolean; detail: string }>;
  private readonly customizationFailureInjector?: ServiceOptions["customizationFailureInjector"];
  private readonly processRunner: ProcessRunnerLike;

  constructor(root: string, options: ServiceOptions = {}) {
    this.root = resolve(root);
    this.clock = options.clock ?? (() => new Date());
    this.idSource = options.idSource ?? (() => crypto.randomUUID());
    this.projects = new ProjectStore(this.root, this.clock, this.idSource);
    this.objects = new ObjectStore(this.root);
    this.cache = new ContentCache(this.root);
    for (const [, [validator, schema]] of Object.entries(ARTIFACTS)) this.validators.register(validator, schema);
    this.validators.register("approval", ApprovalEvidenceV1Schema);
    this.validators.register("runtime-lock", RuntimeBundleLockV1Schema);
    registerTaskWorkflowValidators(this.validators);
    this.providers = {
      fake: new FakeIaCProvider({ track: "bicep", now: this.clock, nextId: this.idSource }),
      ...options.providers,
    };
    this.executableChecker = options.executableChecker ?? (async (executable) => this.pathExecutableExists(executable));
    this.azureAuthStatus =
      options.azureAuthStatus ?? (async () => ({ authenticated: false, detail: "not-checked; run setup --live" }));
    this.customizationFailureInjector = options.customizationFailureInjector;
    this.processRunner = options.processRunner ?? new ProcessRunner();
  }

  async capabilityList(manifestPath?: string): Promise<unknown> {
    return this.capabilityPacks(manifestPath).list();
  }

  async capabilityStatus(id: string, manifestPath?: string): Promise<unknown> {
    return this.capabilityPacks(manifestPath).status(id);
  }

  async capabilityInstall(
    id: string,
    manifestPath?: string,
    options: CapabilityPackInstallOptions = {},
  ): Promise<unknown> {
    return this.capabilityPacks(manifestPath).install(id, options);
  }

  async capabilityUpdate(
    id: string,
    manifestPath?: string,
    options: CapabilityPackInstallOptions = {},
  ): Promise<unknown> {
    return this.capabilityPacks(manifestPath).update(id, options);
  }

  async capabilityRollback(id: string, manifestPath?: string): Promise<unknown> {
    return this.capabilityPacks(manifestPath).rollback(id);
  }

  async capabilityVerify(id: string, manifestPath?: string): Promise<unknown> {
    return this.capabilityPacks(manifestPath).verify(id);
  }

  async init(input: {
    projectId: ProjectId;
    displayName?: string;
    environment?: string;
    targetScope?: string;
    iacTool?: "bicep" | "terraform";
    customizationsSource?: string;
  }): Promise<{ projectId: ProjectId; runId: RunId }> {
    await this.assertCleanInitialization();
    await mkdir(join(this.root, ".apex"), { recursive: true });
    try {
      const assets = await resolveBundledAssets();
      await this.installCustomizations(input.customizationsSource ?? assets.customizations, false, assets.config);
      await this.installCapabilityAssets(assets);
      const runtimeLock = await this.createRuntimeLock(assets);
      const runtimeLockHash = sha256Json(runtimeLock);
      await atomicWriteJson(join(this.root, ".apex", "apex.lock.json"), runtimeLock);
      await this.projects.initializeProject({
        projectId: input.projectId,
        displayName: input.displayName ?? input.projectId,
        defaultIacTool: input.iacTool ?? "bicep",
      });
      const run = await this.projects.createRun(input.projectId, {
        environment: input.environment ?? "dev",
        targetScope: input.targetScope ?? "local",
        runtimeLockHash,
      });
      await this.writeSelection({ projectId: input.projectId, runId: run.runId });
      await this.append(run, "workspace.initialized", { runtimeLockHash });
      return { projectId: input.projectId, runId: run.runId };
    } catch (error) {
      if (await this.pathExistsLstat(join(this.root, ".apex", "customizations.lock.json"))) {
        await this.uninstallCustomizations();
      }
      await rm(join(this.root, ".apex"), { recursive: true, force: true });
      throw error;
    }
  }

  async update(customizationsSource?: string): Promise<{ updated: string[] }> {
    const selection = await this.selection();
    const assets = await resolveBundledAssets();
    const source = customizationsSource ?? assets.customizations;
    const updated = await this.installCustomizations(source, true, assets.config);
    await this.append(await this.run(selection), "customizations.updated", { source: resolve(source), updated });
    return { updated };
  }

  async rollbackCustomizations(): Promise<{ restored: string[]; conflicts: string[] }> {
    await this.recoverCustomizationTransaction();
    const lockPath = join(this.root, ".apex", "customizations.lock.json");
    const current = JSON.parse(await readFile(lockPath, "utf8")) as CustomizationLock;
    if (current.previousLockRef === undefined)
      throw new ApexError("APEX_NOT_FOUND", "No prior customization bundle is available", EXIT_CODES.notFound);
    const previous = JSON.parse(await readFile(join(this.root, current.previousLockRef), "utf8")) as CustomizationLock;
    const restored: string[] = [];
    const conflicts: string[] = [];
    for (const [root, desired, installed] of [
      [this.root, previous.files, current.files],
      [join(this.root, ".apex", "runtime"), previous.runtime, current.runtime],
    ] as const) {
      for (const file of desired) {
        const destination = join(root, file.path);
        const installedFile = installed.find(({ path }) => path === file.path);
        const incoming =
          file.baseRef === undefined ? undefined : await this.readOptional(join(this.root, file.baseRef));
        if (incoming === undefined) {
          conflicts.push(file.path);
          continue;
        }
        if (await this.pathExistsLstat(destination)) {
          const local = await readFile(destination);
          const localHash = sha256Bytes(local);
          if (
            installedFile !== undefined &&
            localHash !== installedFile.currentHash &&
            localHash !== installedFile.baseHash
          ) {
            const base =
              installedFile.baseRef === undefined
                ? undefined
                : await this.readOptional(join(this.root, installedFile.baseRef));
            const merged = base === undefined ? undefined : this.mergeText(base, local, incoming);
            if (merged === undefined) {
              conflicts.push(file.path);
              continue;
            }
            await atomicWriteBytes(destination, merged);
          } else await atomicWriteBytes(destination, incoming);
        } else await atomicWriteBytes(destination, incoming);
        restored.push(file.path);
      }
    }
    if (conflicts.length === 0) await atomicWriteJson(lockPath, previous);
    return { restored, conflicts };
  }

  async uninstallCustomizations(): Promise<{ removed: string[]; conflicts: string[] }> {
    await this.recoverCustomizationTransaction();
    const lockPath = join(this.root, ".apex", "customizations.lock.json");
    const lock = JSON.parse(await readFile(lockPath, "utf8")) as CustomizationLock;
    const removed: string[] = [];
    const conflicts: string[] = [];
    for (const file of lock.files) {
      const destination = join(this.root, file.path);
      if (!(await this.pathExistsLstat(destination))) continue;
      await this.assertSafeDestination(this.root, destination);
      if (sha256Bytes(await readFile(destination)) !== file.currentHash) {
        conflicts.push(file.path);
        continue;
      }
      await rm(destination);
      removed.push(file.path);
    }
    await rm(lockPath, { force: true });
    return { removed, conflicts };
  }

  async listProjects(): Promise<Array<{ projectId: string; displayName: string }>> {
    const directory = join(this.root, ".apex", "projects");
    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const projects = await Promise.all(
      names.sort().map(async (projectId) => this.projects.getProject(projectId as ProjectId)),
    );
    return projects.map(({ projectId, displayName }) => ({ projectId, displayName }));
  }

  async use(projectId: ProjectId, runId?: RunId): Promise<Selection> {
    await this.projects.getProject(projectId);
    const selectedRun = runId ?? (await this.latestRun(projectId));
    await this.projects.getRun(projectId, selectedRun);
    const selection = { projectId, runId: selectedRun };
    await this.writeSelection(selection);
    await this.append(await this.run(selection), "selection.changed", selection);
    return selection;
  }

  async show(projectId?: ProjectId): Promise<unknown> {
    if (projectId !== undefined) return this.projects.getProject(projectId);
    const selection = await this.selection();
    return { project: await this.projects.getProject(selection.projectId), run: await this.run(selection) };
  }

  async search(
    term: string,
    limit = 50,
  ): Promise<
    Array<{
      projectId: string;
      displayName: string;
      matches?: Array<{ runId: string; type: string; sequence: number }>;
    }>
  > {
    const needle = term.toLowerCase();
    const results: Array<{
      projectId: string;
      displayName: string;
      matches?: Array<{ runId: string; type: string; sequence: number }>;
    }> = [];
    for (const project of await this.listProjects()) {
      const matches: Array<{ runId: string; type: string; sequence: number }> = [];
      const runNames = await readdir(join(this.projects.projectDirectory(project.projectId as ProjectId), "runs"));
      for (const runName of runNames.sort()) {
        const run = await this.projects.getRun(project.projectId as ProjectId, runName as RunId);
        for (const event of await this.journal(run).replay()) {
          if (`${event.type}\n${JSON.stringify(event.payload)}`.toLowerCase().includes(needle)) {
            matches.push({ runId: run.runId, type: event.type, sequence: event.sequence });
            if (matches.length >= limit) break;
          }
        }
        if (matches.length >= limit) break;
      }
      if (
        project.projectId.toLowerCase().includes(needle) ||
        project.displayName.toLowerCase().includes(needle) ||
        matches.length > 0
      ) {
        results.push({ ...project, ...(matches.length === 0 ? {} : { matches }) });
      }
      if (results.length >= limit) break;
    }
    return results;
  }

  async history(
    limit = 100,
  ): Promise<
    Array<{ sequence: number; type: string; timestamp: string; artifactKinds: string[]; payload: JsonValue }>
  > {
    const events = await this.journal(await this.currentRun()).replay();
    return events
      .slice(-Math.max(1, Math.min(limit, 500)))
      .reverse()
      .map((event) => ({
        sequence: event.sequence,
        type: event.type,
        timestamp: event.timestamp,
        artifactKinds: Object.keys(
          (event.payload as { artifactHashes?: Record<string, unknown> }).artifactHashes ?? {},
        ).sort(),
        payload: event.payload as JsonValue,
      }));
  }

  async status(): Promise<{
    run: RunConfigV1;
    head: string | null;
    events: number;
    task: string | null;
    blockers: string[];
  }> {
    const selection = await this.selection();
    const run = await this.run(selection);
    const events = await this.journal(run).replay();
    const route = await this.route(run, events);
    return {
      run,
      head: events.at(-1)?.hash ?? null,
      events: events.length,
      task: route.task?.id ?? null,
      blockers: route.blockers,
    };
  }

  async nextTask(): Promise<
    { status: "needs_input"; questions: unknown[] } | { status: "task"; task: TaskEnvelopeV1 }
  > {
    const selection = await this.selection();
    const run = await this.run(selection);
    const events = await this.journal(run).replay();
    const requirements = this.artifactHash(events, "requirements");
    if (requirements === undefined) {
      if (
        !events.some(
          (event) => event.type === "requirements.input-requested" || event.type === "requirements.input-recorded",
        )
      ) {
        await this.append(run, "requirements.input-requested", { questionIds: ["workload", "requirements"] });
        return {
          status: "needs_input",
          questions: [
            { id: "workload", prompt: "What workload should this project deliver?" },
            { id: "requirements", prompt: "What outcomes and constraints are required?" },
          ],
        };
      }
      return { status: "task", task: await this.issueTask(run, TASKS[0]!, []) };
    }
    const route = await this.route(run, events);
    if (route.blockers.length > 0)
      throw new ApexError("APEX_AUTHORIZATION", route.blockers.join("; "), EXIT_CODES.authorization, route.blockers);
    if (route.task === undefined)
      throw new ApexError("APEX_NOT_FOUND", "No task is currently available", EXIT_CODES.notFound);
    return { status: "task", task: await this.issueTask(run, route.task, this.inputRefs(events)) };
  }

  async recordRequirementsInput(value: unknown): Promise<void> {
    const selection = await this.selection();
    await this.append(await this.run(selection), "requirements.input-recorded", { value: value as JsonValue });
  }

  async taskContext(
    taskId: string,
  ): Promise<{ task: TaskEnvelopeV1; inputs: unknown[]; outputRoot: string; status: string; blockers: string[] }> {
    const run = await this.currentRun();
    const task = await this.readTask(run, taskId);
    const events = await this.journal(run).replay();
    const route = await this.route(run, events);
    return {
      task,
      inputs: await Promise.all(task.inputRefs.map((hash) => this.objects.getJson(hash))),
      outputRoot: join(this.root, ".apex", "work", run.runId, taskId),
      status: this.completedNodeIds(events).has(task.taskType) ? "completed" : "active",
      blockers: route.blockers,
    };
  }

  async stageArtifact(taskId: string, output: TaskOutput): Promise<StagedArtifact> {
    const run = await this.currentRun();
    const task = await this.readTask(run, taskId);
    const head = await this.journal(run).head();
    if (head === null) throw new ApexError("APEX_STALE", "Task journal is empty", EXIT_CODES.stale);
    assertTaskCurrent(task, head, run.ownerEpoch, this.clock);
    if (!task.allowedOutputKinds.includes(output.kind)) {
      throw new ApexError("APEX_VALIDATION", `Task does not allow ${output.kind}`, EXIT_CODES.validation);
    }
    this.validateOutput(run, output);
    const bytes = Buffer.from(JSON.stringify(output.value), "utf8");
    if (bytes.byteLength > task.maxOutputBytes) {
      throw new ApexError("APEX_VALIDATION", "Task output exceeds its size limit", EXIT_CODES.validation);
    }
    const directory = join(this.root, ".apex", "work", run.runId, taskId);
    const path = join(directory, `${output.kind}.json`);
    await mkdir(directory, { recursive: true });
    await atomicWriteJson(path, output.value);
    const hash = sha256Bytes(await readFile(path));
    await this.append(run, "artifact.staged", { taskId, kind: output.kind, hash, bytes: bytes.byteLength });
    const expectedHead = await this.journal(run).head();
    if (expectedHead === null) throw new ApexError("APEX_STALE", "Staging event was not recorded", EXIT_CODES.stale);
    await atomicWriteJson(join(this.projects.runDirectory(run.projectId, run.runId), "tasks", `${taskId}.json`), {
      ...task,
      expectedHead,
    });
    return { taskId, kind: output.kind, path, bytes: bytes.byteLength, hash };
  }

  async stageFile(
    taskId: string,
    relativePath: string,
    content: string | Uint8Array,
    expectedSha?: string,
  ): Promise<StagedFile> {
    const run = await this.currentRun();
    const task = await this.readTask(run, taskId);
    const head = await this.journal(run).head();
    if (head === null) throw new ApexError("APEX_STALE", "Task journal is empty", EXIT_CODES.stale);
    assertTaskCurrent(task, head, run.ownerEpoch, this.clock);
    if (!task.taskType.startsWith("codegen-"))
      throw new ApexError("APEX_AUTHORIZATION", "Only code generation tasks may stage files", EXIT_CODES.authorization);
    const normalized = relativePath.replaceAll("\\", "/");
    const suffixes = [".terraform.lock.hcl", ".tfvars.example", ".bicep", ".json", ".tf", ".md"];
    if (
      isAbsolute(relativePath) ||
      normalized.length === 0 ||
      normalized.split("/").some((part) => part === "" || part === "." || part === "..") ||
      !suffixes.some((suffix) => normalized.endsWith(suffix))
    ) {
      throw new ApexError(
        "APEX_VALIDATION",
        `Unsafe or unsupported staged path: ${relativePath}`,
        EXIT_CODES.validation,
      );
    }
    const codeRoot = resolve(this.root, ".apex", "work", run.runId, taskId, "code");
    const path = resolve(codeRoot, normalized);
    if (path !== codeRoot && !path.startsWith(`${codeRoot}${sep}`))
      throw new ApexError("APEX_VALIDATION", "Staged path escapes the code root", EXIT_CODES.validation);
    await this.assertNoSymlinkPath(codeRoot, path);
    const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content);
    const hash = sha256Bytes(bytes);
    if (expectedSha !== undefined && expectedSha !== hash)
      throw new ApexError("APEX_STALE", "Staged content hash does not match expected SHA", EXIT_CODES.stale);
    let idempotent = false;
    if (await this.exists(path)) {
      const entry = await lstat(path);
      if (!entry.isFile() || entry.isSymbolicLink())
        throw new ApexError("APEX_VALIDATION", "Staged destination must be a regular file", EXIT_CODES.validation);
      if (sha256Bytes(await readFile(path)) !== hash)
        throw new ApexError("APEX_CONFLICT", `Refusing to overwrite staged file: ${normalized}`, EXIT_CODES.conflict);
      idempotent = true;
    } else {
      const used = await this.directoryBytes(codeRoot);
      if (used + bytes.byteLength > task.maxOutputBytes)
        throw new ApexError("APEX_VALIDATION", "Task output exceeds its cumulative size limit", EXIT_CODES.validation);
      await atomicWriteBytes(path, bytes, { refuseOverwrite: true });
      await this.append(run, "file.staged", { taskId, path: normalized, hash, bytes: bytes.byteLength });
      await this.refreshTaskHead(run, task);
    }
    return { taskId, path, bytes: bytes.byteLength, hash, idempotent };
  }

  async generateIac(
    taskId: string,
    options: GenerateIacOptions = {},
  ): Promise<{
    files: StagedFile[];
    outputHashes: Partial<Record<ArtifactKind, string>>;
    treeHash: string;
  }> {
    const run = await this.currentRun();
    const task = await this.readTask(run, taskId);
    if (task.taskType !== `codegen-${run.iacTool}`)
      throw new ApexError(
        "APEX_AUTHORIZATION",
        "Task is not the selected code generation task",
        EXIT_CODES.authorization,
      );
    const inputs = await Promise.all(task.inputRefs.map((hash) => this.objects.getJson<unknown>(hash)));
    const intent = inputs.find((value): value is ImplementationIntentV1 => this.looksLikeIntent(value));
    const binding = inputs.find((value): value is IacBindingV1 => this.looksLikeBinding(value, run.iacTool));
    const environmentInputs = inputs.find((value): value is EnvironmentInputsV1 =>
      this.looksLikeEnvironmentInputs(value),
    );
    if (intent === undefined || binding === undefined || environmentInputs === undefined) {
      throw new ApexError(
        "APEX_VALIDATION",
        "Code generation requires accepted intent, binding, and environment inputs",
        EXIT_CODES.validation,
      );
    }
    const tree =
      run.iacTool === "bicep"
        ? generateBicepTree(intent, binding, {
            ...(options.existingResources === undefined ? {} : { existingResources: options.existingResources }),
          })
        : generateTerraformTree(intent, binding, {
            ...(options.existingResources === undefined ? {} : { existingResources: options.existingResources }),
            ...(options.azurermProviderConstraint === undefined
              ? {}
              : { azurermProviderConstraint: options.azurermProviderConstraint }),
            ...(options.azapiProviderConstraint === undefined
              ? {}
              : { azapiProviderConstraint: options.azapiProviderConstraint }),
            ...(options.lockFileContent === undefined ? {} : { lockFileContent: options.lockFileContent }),
          });
    const files: StagedFile[] = [];
    for (const file of tree.files) files.push(await this.stageFile(taskId, file.path, file.content));
    const intentHash = sha256Json(intent);
    const bindingHash = sha256Json(binding);
    const environmentInputsHash = sha256Json(environmentInputs);
    const handoff = {
      schemaVersion: CONTRACT_VERSION,
      projectId: run.projectId,
      runId: run.runId,
      track: run.iacTool,
      rootPath: relative(this.root, resolve(this.root, ".apex", "work", run.runId, taskId, "code")),
      treeHash: tree.treeHash,
      intentHash,
      bindingHash,
      environmentInputsHash,
      logicalResourceManifestHash: sha256Json(tree.logicalManifest),
      requiredToolVersions: options.requiredToolVersions ?? { [run.iacTool]: "system" },
      generatedAt: this.clock().toISOString(),
    };
    const completed = await this.completeTaskOutputs(taskId, [
      { kind: "logical-resource-manifest", value: tree.logicalManifest },
      { kind: "iac-handoff", value: handoff },
    ]);
    return { files, outputHashes: completed.outputHashes, treeHash: tree.treeHash };
  }

  async validateTask(
    taskId: string,
    output?: TaskOutput | TaskOutput[],
  ): Promise<{ valid: true; taskId: string; staged?: StagedArtifact | StagedArtifact[] }> {
    const run = await this.currentRun();
    const task = await this.readTask(run, taskId);
    const head = await this.journal(run).head();
    if (head === null) throw new ApexError("APEX_STALE", "Task journal is empty", EXIT_CODES.stale);
    assertTaskCurrent(task, head, run.ownerEpoch, this.clock);
    const staged =
      output === undefined
        ? undefined
        : Array.isArray(output)
          ? await Promise.all(output.map((item) => this.stageArtifact(taskId, item)))
          : await this.stageArtifact(taskId, output);
    return { valid: true, taskId, ...(staged === undefined ? {} : { staged }) };
  }

  async completeTask(taskId: string, output: TaskOutput): Promise<{ outputHash: string; summary: string }> {
    const completed = await this.acceptTaskOutputs(taskId, [output], true);
    return { outputHash: completed.outputHashes[output.kind]!, summary: output.summary ?? `${output.kind} accepted` };
  }

  async completeTaskOutputs(
    taskId: string,
    outputs: TaskOutput[],
  ): Promise<{ outputHashes: Partial<Record<ArtifactKind, string>>; summary: string }> {
    return this.acceptTaskOutputs(taskId, outputs, false);
  }

  private async acceptTaskOutputs(
    taskId: string,
    outputs: TaskOutput[],
    legacy: boolean,
  ): Promise<{ outputHashes: Partial<Record<ArtifactKind, string>>; summary: string }> {
    const run = await this.currentRun();
    const task = await this.readTask(run, taskId);
    const head = await this.journal(run).head();
    if (head === null) throw new ApexError("APEX_STALE", "Task journal is empty", EXIT_CODES.stale);
    assertTaskCurrent(task, head, run.ownerEpoch, this.clock);
    if (outputs.length === 0)
      throw new ApexError("APEX_VALIDATION", "Task bundle must contain outputs", EXIT_CODES.validation);
    const kinds = outputs.map(({ kind }) => kind);
    if (new Set(kinds).size !== kinds.length)
      throw new ApexError("APEX_VALIDATION", "Task bundle contains duplicate kinds", EXIT_CODES.validation);
    const descriptor = TASKS.find(({ id }) => id === task.taskType);
    if (descriptor === undefined)
      throw new ApexError("APEX_VALIDATION", `Unknown task type ${task.taskType}`, EXIT_CODES.validation);
    const missing = descriptor.outputs.filter((kind) => !kinds.includes(kind));
    if (missing.length > 0) {
      if (legacy && descriptor.id === "requirements" && kinds.length === 1 && kinds[0] === "requirements") {
        outputs = [...outputs, { kind: "sku-manifest", value: this.initialSkuManifest(run, outputs[0]!.value) }];
      } else if (legacy && descriptor.id === "plan" && kinds.length === 1 && kinds[0] === "implementation-intent") {
        outputs = [...outputs, ...this.legacyPlanOutputs(run, outputs[0]!.value)];
      } else {
        throw new ApexError("APEX_VALIDATION", `Task bundle is missing: ${missing.join(", ")}`, EXIT_CODES.validation);
      }
    }
    for (const output of outputs) {
      if (!task.allowedOutputKinds.includes(output.kind))
        throw new ApexError("APEX_VALIDATION", `Task does not allow ${output.kind}`, EXIT_CODES.validation);
      const bytes = Buffer.byteLength(JSON.stringify(output.value));
      if (bytes > task.maxOutputBytes)
        throw new ApexError("APEX_VALIDATION", "Task output exceeds its size limit", EXIT_CODES.validation);
      this.validateOutput(run, output);
    }
    await this.validateBundle(run, descriptor, outputs);
    const validatorIds = await this.validateTaskValidators(descriptor, outputs);
    const outputHashes: Partial<Record<ArtifactKind, string>> = {};
    for (const output of outputs) outputHashes[output.kind] = await this.objects.putJson(output.value);
    const reviewBlockers = descriptor.reviewSubject === undefined ? [] : this.openReviewFindings(outputs[0]!.value);
    const dependencyHash = sha256Json(outputHashes);
    await this.append(run, "task.completed", {
      taskId,
      nodeId: descriptor.id,
      artifactHashes: outputHashes,
      validatorIds,
      reviewBlockers,
      ...(descriptor.reviewSubject === undefined
        ? {}
        : {
            reviewHash: outputHashes["review-findings"],
            subjectHash: (outputs[0]!.value as ReviewFindingsV1).subjectHash,
            dependencyHash,
          }),
      legacy,
    });
    if (descriptor.reviewSubject !== undefined) {
      if (reviewBlockers.length === 0 && descriptor.gate !== undefined) {
        await this.openRunGate(await this.currentRun(), descriptor.gate, dependencyHash);
      }
    } else if (legacy && descriptor.id === "requirements") {
      await this.openRunGate(await this.currentRun(), 1, sha256Json(outputHashes));
    }
    return { outputHashes, summary: outputs.map(({ kind }) => kind).join(", ") + " accepted" };
  }

  async cancelTask(taskId: string): Promise<void> {
    const run = await this.currentRun();
    await this.readTask(run, taskId);
    await this.append(run, "task.cancelled", { taskId });
  }

  async resolveReview(resolution: ReviewResolution): Promise<void> {
    const run = await this.currentRun();
    const events = await this.journal(run).replay();
    const reviewEvent = [...events]
      .reverse()
      .find(
        (event) =>
          event.type === "task.completed" &&
          (event.payload as { reviewHash?: unknown }).reviewHash === resolution.reviewHash,
      );
    if (reviewEvent === undefined)
      throw new ApexError("APEX_STALE", "Resolution reviewHash is not the current accepted review", EXIT_CODES.stale);
    const reviewPayload = reviewEvent.payload as {
      nodeId?: unknown;
      subjectHash?: unknown;
      dependencyHash?: unknown;
    };
    if (
      reviewPayload.subjectHash !== resolution.subjectHash ||
      reviewPayload.dependencyHash !== resolution.dependencyHash
    ) {
      throw new ApexError("APEX_STALE", "Resolution is not bound to the accepted review dependency", EXIT_CODES.stale);
    }
    this.assertReviewResolution(resolution);
    const review = await this.objects.getJson<ReviewFindingsV1>(resolution.reviewHash);
    const finding = review.findings.find(({ id }) => id === resolution.findingId);
    if (finding === undefined || finding.disposition !== "open")
      throw new ApexError(
        "APEX_VALIDATION",
        "Resolution finding does not exist and remain open",
        EXIT_CODES.validation,
      );
    if (resolution.disposition === "accepted-risk" && ["critical", "high"].includes(finding.severity))
      throw new ApexError(
        "APEX_AUTHORIZATION",
        `${finding.severity} findings cannot be accepted as risk by default policy`,
        EXIT_CODES.authorization,
      );
    const prior = events.find(
      (event) =>
        event.type === "review.resolved" &&
        (event.payload as { resolution?: ReviewResolution }).resolution?.reviewHash === resolution.reviewHash &&
        (event.payload as { resolution?: ReviewResolution }).resolution?.findingId === resolution.findingId,
    );
    if (prior !== undefined) {
      if (sha256Json((prior.payload as { resolution: ReviewResolution }).resolution) === sha256Json(resolution)) return;
      throw new ApexError("APEX_CONFLICT", "Finding already has a conflicting resolution", EXIT_CODES.conflict);
    }
    await this.append(run, "review.resolved", { resolution: resolution as unknown as JsonValue });
    const updatedEvents = await this.journal(run).replay();
    const nodeId = reviewPayload.nodeId;
    const descriptor = typeof nodeId === "string" ? TASKS.find(({ id }) => id === nodeId) : undefined;
    if (
      descriptor?.gate !== undefined &&
      this.reviewBlockers(updatedEvents, descriptor.id).length === 0 &&
      !this.gateApproved(await this.currentRun(), descriptor.gate)
    ) {
      await this.openRunGate(await this.currentRun(), descriptor.gate, resolution.dependencyHash);
    }
  }

  private assertReviewResolution(value: ReviewResolution): void {
    const hashes = [value.reviewHash, value.subjectHash, value.dependencyHash, ...value.evidenceRefs];
    if (
      !value.findingId ||
      !value.actor ||
      !value.rationale ||
      !["fixed", "accepted-risk"].includes(value.disposition) ||
      !hashes.every((hash) => /^[0-9a-f]{64}$/.test(hash))
    ) {
      throw new ApexError("APEX_VALIDATION", "Invalid review resolution document", EXIT_CODES.validation);
    }
    if (value.disposition === "fixed" && value.evidenceRefs.length === 0)
      throw new ApexError("APEX_VALIDATION", "Fixed findings require evidenceRefs", EXIT_CODES.validation);
    if (
      value.disposition === "accepted-risk" &&
      (value.expiresAt === undefined || Date.parse(value.expiresAt) <= this.clock().getTime())
    ) {
      throw new ApexError("APEX_VALIDATION", "Accepted risk requires a future expiry", EXIT_CODES.validation);
    }
  }

  async decideGateNumber(
    gateNumber: number,
    decision: "approved" | "rejected",
    actor: string,
  ): Promise<ApprovalEvidenceV1> {
    const run = await this.currentRun();
    const gate = run.gates.find(({ gate }) => gate === gateNumber);
    if (gate === undefined) throw new ApexError("APEX_USAGE", `Unknown gate ${gateNumber}`, EXIT_CODES.usage);
    const events = await this.journal(run).replay();
    const previewHash = gateNumber === 4 ? this.latestPayloadHash(events, "preview.created", "previewHash") : undefined;
    if (gateNumber === 4 && previewHash === undefined) {
      throw new ApexError("APEX_VALIDATION", "Gate 4 requires a deployment preview", EXIT_CODES.validation);
    }
    const decidedAt = this.clock().toISOString();
    const approval: ApprovalEvidenceV1 = {
      schemaVersion: CONTRACT_VERSION,
      projectId: run.projectId,
      runId: run.runId,
      gate: gateNumber,
      decision,
      actor,
      mechanism: "tty",
      recipientIdentity: "local",
      dependencyHash: gate.dependencyHash,
      ...(previewHash === undefined ? {} : { previewHash }),
      writerEpoch: run.ownerEpoch,
      decidedAt,
      ...(gateNumber === 4 ? { expiresAt: new Date(this.clock().getTime() + PREVIEW_TTL_MS).toISOString() } : {}),
    };
    this.assertValid("approval", approval);
    const approvalHash = await this.objects.putJson(approval);
    const updated = {
      ...run,
      gates: run.gates.map((item) => (item.gate === gateNumber ? decideGate(item, decision, decidedAt) : item)),
    };
    await this.mutateRun(run, updated, "gate.decided", {
      gate: gateNumber,
      approvalHash,
      ...(previewHash === undefined ? {} : { previewHash }),
    });
    return approval;
  }

  async preview(options: PreviewOptions): Promise<DeploymentPreviewV1> {
    const run = await this.currentRun();
    const events = await this.journal(run).replay();
    await this.assertPreviewReady(run, events);
    const dependencyRevision = this.dependencyRevision(run, events);
    const intentHash = this.artifactHash(events, "implementation-intent");
    if (intentHash === undefined)
      throw new ApexError("APEX_VALIDATION", "Implementation intent is required", EXIT_CODES.validation);
    const intent = await this.objects.getJson<ImplementationIntentV1>(intentHash);
    await this.append(run, "preview.requested", {
      provider: options.provider,
      operation: options.operation,
      track: run.iacTool,
      targetScope: run.targetScope,
    });
    if (options.provider !== "fake") {
      if (options.provider !== run.iacTool) {
        throw new ApexError(
          "APEX_VALIDATION",
          `Provider '${options.provider}' does not match selected track '${run.iacTool}'`,
          EXIT_CODES.validation,
        );
      }
      const provider = this.providers[options.provider];
      if (provider === undefined) {
        throw new ApexError(
          "APEX_VALIDATION",
          `${options.provider} provider is not configured; inject it through ApexService providers or configure the CLI provider registry`,
          EXIT_CODES.validation,
        );
      }
      const request = {
        projectId: run.projectId,
        runId: run.runId,
        environment: run.environment,
        target: run.targetScope,
        commit: dependencyRevision,
        dependencyRevision,
        ownerEpoch: run.ownerEpoch,
        inputHash: intentHash,
        iacHash: this.artifactHash(events, "iac-handoff") ?? sha256Json(intent.resources),
        policyHash: this.artifactHash(events, "policy-property-map") ?? run.runtimeLockHash,
        resources: intent.resources.map((resource) => ({
          logicalId: resource.id,
          resourceId: `${options.provider}://${run.environment}/${resource.id}`,
          type: resource.type,
          location: run.environment,
          properties: { purpose: resource.purpose },
        })),
        blockers: [],
        ttlMs: options.expiresInMs ?? PREVIEW_TTL_MS,
      };
      const preview =
        options.operation === "apply" ? await provider.previewApply(request) : await provider.previewDestroy(request);
      this.assertValid("preview", preview);
      const previewObjectHash = await this.objects.putJson(preview);
      let attestationHash: string | undefined;
      if (options.provider === "terraform" && "attestation" in provider && typeof provider.attestation === "function") {
        const attestation = (provider.attestation as (previewHash: string) => ExecutionPlanAttestationV1 | undefined)(
          preview.previewHash,
        );
        if (attestation !== undefined) {
          this.assertValid("execution-plan-attestation", attestation);
          attestationHash = await this.objects.putJson(attestation);
        }
      }
      await this.append(await this.currentRun(), "preview.created", {
        previewHash: preview.previewHash,
        previewObjectHash,
        provider: options.provider,
        providerRequestHash: sha256Json(request),
        commit: preview.commit,
        ...(attestationHash === undefined ? {} : { attestationHash }),
      });
      await this.openRunGate(await this.currentRun(), 4, preview.previewHash);
      return preview;
    }
    const createdAt = this.clock().toISOString();
    const base = {
      schemaVersion: CONTRACT_VERSION,
      projectId: run.projectId,
      runId: run.runId,
      environment: run.environment,
      track: run.iacTool,
      operation: options.operation,
      target: run.targetScope,
      commit: dependencyRevision,
      dependencyRevision,
      ownerEpoch: run.ownerEpoch,
      inputHash: intentHash,
      iacHash: sha256Json(intent.resources),
      policyHash: run.runtimeLockHash,
      changes: intent.resources.map((resource) => ({
        resourceId: `fake://${run.environment}/${resource.id}`,
        action: options.operation === "destroy" ? ("delete" as const) : ("create" as const),
        material: true,
        details: resource.type,
      })),
      blockers: [],
      createdAt,
      expiresAt: new Date(this.clock().getTime() + (options.expiresInMs ?? PREVIEW_TTL_MS)).toISOString(),
    };
    const preview: DeploymentPreviewV1 = { ...base, previewHash: sha256Json(base) };
    this.assertValid("preview", preview);
    const previewObjectHash = await this.objects.putJson(preview);
    await this.append(run, "preview.created", {
      previewHash: preview.previewHash,
      previewObjectHash,
      provider: options.provider,
      commit: preview.commit,
    });
    await this.openRunGate(await this.currentRun(), 4, preview.previewHash);
    return preview;
  }

  async currentPreview(): Promise<string> {
    const run = await this.currentRun();
    const events = await this.journal(run).replay();
    await this.assertPreviewReady(run, events);
    return this.render("preview");
  }

  async deploy(expectedPreviewHash?: string): Promise<{ operation: unknown; inventory: ResourceInventoryV1 }> {
    const run = await this.currentRun();
    const events = await this.journal(run).replay();
    await this.assertPreviewReady(run, events);
    const previewHash = this.latestPayloadHash(events, "preview.created", "previewHash");
    const previewObjectHash = this.latestPayloadHash(events, "preview.created", "previewObjectHash");
    const approvalHash = this.latestPayloadHash(
      events,
      "gate.decided",
      "approvalHash",
      (payload) => payload.gate === 4,
    );
    if (previewHash === undefined || previewObjectHash === undefined || approvalHash === undefined) {
      throw new ApexError("APEX_AUTHORIZATION", "Preview and Gate 4 approval are required", EXIT_CODES.authorization);
    }
    if (expectedPreviewHash !== undefined && expectedPreviewHash !== previewHash) {
      throw new ApexError("APEX_STALE", "Requested preview hash is not current", EXIT_CODES.stale);
    }
    const preview = await this.objects.getJson<DeploymentPreviewV1>(previewObjectHash);
    const approval = await this.objects.getJson<ApprovalEvidenceV1>(approvalHash);
    if (Date.parse(preview.expiresAt) <= this.clock().getTime())
      throw new ApexError("APEX_STALE", "Deployment preview has expired", EXIT_CODES.stale);
    if (preview.ownerEpoch !== run.ownerEpoch || approval.writerEpoch !== run.ownerEpoch)
      throw new ApexError("APEX_STALE", "Owner epoch changed", EXIT_CODES.stale);
    const dependencyRevision = this.dependencyRevision(run, events);
    if (preview.dependencyRevision !== dependencyRevision || preview.commit !== dependencyRevision)
      throw new ApexError("APEX_STALE", "Deployment dependencies changed after preview", EXIT_CODES.stale);
    if (
      approval.decision !== "approved" ||
      approval.previewHash !== preview.previewHash ||
      approval.dependencyHash !== preview.previewHash
    ) {
      throw new ApexError(
        "APEX_AUTHORIZATION",
        "Approval does not authorize the exact preview",
        EXIT_CODES.authorization,
      );
    }
    const providerName = [...events].reverse().find((event) => event.type === "preview.created")?.payload as
      { provider?: unknown } | undefined;
    if (providerName?.provider === "bicep" || providerName?.provider === "terraform") {
      const provider = this.providers[providerName.provider];
      if (provider === undefined)
        throw new ApexError(
          "APEX_VALIDATION",
          `${providerName.provider} provider is no longer configured`,
          EXIT_CODES.validation,
        );
      const operation =
        preview.operation === "apply"
          ? await provider.apply(preview, approval, {
              head: preview.commit,
              dependencyRevision,
              ownerEpoch: run.ownerEpoch,
              recipientIdentity: approval.recipientIdentity ?? "local",
            })
          : await provider.destroy(preview, approval, {
              head: preview.commit,
              dependencyRevision,
              ownerEpoch: run.ownerEpoch,
              recipientIdentity: approval.recipientIdentity ?? "local",
            });
      this.assertValid("operation", operation);
      const operationHash = await this.objects.putJson(operation);
      const inventory = await provider.inventory(run.projectId, run.runId);
      this.assertValid("inventory", inventory);
      const inventoryHash = await this.objects.putJson(inventory);
      await this.append(run, "deployment.completed", {
        operationHash,
        inventoryHash,
        previewHash,
        approvalHash,
        provider: providerName.provider,
      });
      return { operation, inventory };
    }
    const now = this.clock().toISOString();
    const operation = {
      schemaVersion: CONTRACT_VERSION,
      operationId: this.idSource(),
      projectId: run.projectId,
      runId: run.runId,
      providerOperationId: `fake-${preview.previewHash.slice(0, 16)}`,
      operation: preview.operation,
      state: "succeeded" as const,
      previewHash,
      approvalHash,
      ownerEpoch: run.ownerEpoch,
      updatedAt: now,
    };
    this.assertValid("operation", operation);
    const operationHash = await this.objects.putJson(operation);
    const inventory: ResourceInventoryV1 = {
      schemaVersion: CONTRACT_VERSION,
      projectId: run.projectId,
      runId: run.runId,
      deploymentHash: operationHash,
      collectedAt: now,
      resources:
        preview.operation === "destroy"
          ? []
          : preview.changes.map((change) => ({
              logicalId: basename(change.resourceId),
              resourceId: change.resourceId,
              type: change.details ?? "fake/resource",
              location: run.environment,
              properties: { provider: "fake", previewHash },
            })),
    };
    this.assertValid("inventory", inventory);
    const inventoryHash = await this.objects.putJson(inventory);
    await this.append(run, "deployment.completed", { operationHash, inventoryHash, previewHash, approvalHash });
    return { operation, inventory };
  }

  async inventory(): Promise<ResourceInventoryV1> {
    const run = await this.currentRun();
    const hash = this.latestPayloadHash(await this.journal(run).replay(), "deployment.completed", "inventoryHash");
    if (hash === undefined)
      throw new ApexError("APEX_NOT_FOUND", "No inventory exists for this run", EXIT_CODES.notFound);
    return this.objects.getJson(hash);
  }

  async promote(environment: string, targetScope: string): Promise<RunConfigV1> {
    const source = await this.currentRun();
    const sourceEvents = await this.journal(source).replay();
    if (![1, 2, 3].every((gate) => this.gateApproved(source, gate)))
      throw new ApexError("APEX_AUTHORIZATION", "Promotion requires approved Gates 1-3", EXIT_CODES.authorization);
    const promoted = await this.projects.createRun(source.projectId, {
      environment,
      targetScope,
      runtimeLockHash: source.runtimeLockHash,
      iacTool: source.iacTool,
      parentRunId: source.runId,
    });
    const sameScope = source.targetScope === targetScope;
    const inherited = promoted.gates.map((gate) => {
      const sourceGate = source.gates.find(({ gate: number }) => number === gate.gate)!;
      const inheritable = gate.gate === 1 || (sameScope && gate.gate <= 3);
      return inheritable && (sourceGate.state === "approved" || sourceGate.state === "inherited")
        ? inheritGate(sourceGate, source.runId, sourceGate.dependencyHash, this.clock().toISOString())
        : gate;
    });
    const updated = { ...promoted, gates: inherited };
    await atomicWriteJson(this.runPath(updated), updated);
    const neutralNodes = new Set([
      "requirements",
      "requirements-review",
      "architecture",
      "architecture-review",
      ...(sameScope ? ["plan", "plan-review"] : []),
      ...(sameScope ? ["governance-discovery", "governance-reconciliation", "governance-review"] : []),
    ]);
    const inheritedReviewHashes = new Set<string>();
    for (const event of sourceEvents) {
      if (event.type !== "task.completed") continue;
      const payload = event.payload as { nodeId?: unknown; reviewHash?: unknown };
      if (typeof payload.nodeId !== "string" || !neutralNodes.has(payload.nodeId)) continue;
      if (typeof payload.reviewHash === "string") inheritedReviewHashes.add(payload.reviewHash);
      await this.append(updated, "task.completed", {
        ...(event.payload as Record<string, JsonValue>),
        inherited: true,
        inheritedFromRunId: source.runId,
        inheritedEventHash: event.hash,
      });
    }
    if (!sameScope) {
      for (const event of sourceEvents) {
        if (event.type !== "task.completed") continue;
        const payload = event.payload as { nodeId?: unknown; artifactHashes?: Record<string, unknown> };
        if (payload.nodeId !== "plan") continue;
        await this.append(updated, "artifacts.inherited", {
          nodeId: "plan",
          artifactHashes: (payload.artifactHashes ?? {}) as JsonValue,
          inheritedFromRunId: source.runId,
          inheritedEventHash: event.hash,
          requiresRevalidation: true,
        });
      }
    }
    for (const event of sourceEvents) {
      if (event.type !== "review.resolved") continue;
      const resolution = (event.payload as { resolution?: ReviewResolution }).resolution;
      if (resolution === undefined || !inheritedReviewHashes.has(resolution.reviewHash)) continue;
      await this.append(updated, "review.resolved", {
        resolution: resolution as unknown as JsonValue,
        inherited: true,
        inheritedFromRunId: source.runId,
        inheritedEventHash: event.hash,
      });
    }
    await this.append(updated, "run.promoted", {
      parentRunId: source.runId,
      sourceDependencyRevision: this.dependencyRevision(source, sourceEvents),
      targetScopeChanged: !sameScope,
      invalidated: [
        ...(!sameScope ? ["governance", "gate-2", "gate-3"] : []),
        "codegen",
        "validation",
        "preview",
        "gate-4",
        "deploy",
        "inventory",
      ],
    });
    await this.writeSelection({ projectId: updated.projectId, runId: updated.runId });
    return updated;
  }

  async doctor(
    fix = false,
    yes = false,
    live = false,
  ): Promise<{ healthy: boolean; checks: DoctorCheck[]; remedies: string[]; nextAction: string }> {
    const apexExists = await this.exists(join(this.root, ".apex"));
    if (fix && yes && apexExists) {
      const assets = await resolveBundledAssets();
      await this.installCustomizations(assets.customizations, true, assets.config, true);
      await this.installCapabilityAssets(assets);
      await atomicWriteJson(join(this.root, ".apex", "apex.lock.json"), await this.createRuntimeLock(assets));
    }
    const checks: DoctorCheck[] = [
      {
        id: "node",
        ok: Number(process.versions.node.split(".")[0]) >= 24,
        value: process.versions.node,
        remedy: "Install Node.js 24 or newer",
      },
      { id: "workspace", ok: await this.exists(this.root), value: this.root, remedy: "Restore the workspace root" },
      { id: "apex", ok: apexExists, value: join(this.root, ".apex"), remedy: "Run apex init" },
    ];
    if (apexExists) {
      const run = await this.currentRun();
      for (const executable of run.iacTool === "bicep" ? ["az", "bicep"] : ["az", "terraform"]) {
        checks.push({
          id: `executable:${executable}`,
          ok: await this.executableChecker(executable),
          value: executable,
          remedy: `Install ${executable} and add it to PATH`,
        });
      }
      const auth = await this.azureAuthStatus(live);
      checks.push({
        id: "azure-auth",
        ok: auth.authenticated,
        value: auth.detail,
        remedy: "Authenticate with Azure outside doctor, then run setup --live",
      });
      checks.push(...(await this.managedFileChecks()));
      checks.push(...(await this.runtimeLockChecks(run)));
      const route = await this.route(run, await this.journal(run).replay());
      if (route.task !== undefined) {
        const packStatuses = await this.capabilityPacks().requiredForWorkflows([route.task.id]);
        checks.push(
          ...packStatuses.map((status): DoctorCheck => ({
            id: `capability-pack:${status.id}`,
            ok: status.state === "installed",
            value: status.reason ?? status.state,
            remedy: status.action,
          })),
        );
      }
      const providerConfigured = await this.exists(join(this.root, ".apex", "provider-config.json"));
      checks.push({
        id: "provider-config",
        ok: providerConfigured,
        value: providerConfigured ? "configured" : "missing",
        remedy: "Provide --provider-config with non-secret backend settings",
      });
      checks.push({
        id: "backend-readiness",
        ok: providerConfigured,
        value: providerConfigured ? "configured; connectivity not executed" : "not configured",
        remedy: "Configure the selected provider backend",
      });
      checks.push({
        id: "ci-plan-transport",
        ok: false,
        value: "production CI transport unavailable; local encrypted exact-plan supported",
        remedy: "Use local exact-plan deployment or provide an approved CI transport implementation",
      });
    }
    const remedies = checks
      .filter((check) => !check.ok && check.remedy !== undefined)
      .map((check) => `${fix && !yes ? "Preview: " : ""}${check.remedy!}`);
    const actionable = checks.find((check) => !check.ok && check.id !== "ci-plan-transport");
    return {
      healthy: checks.every((check) => check.ok || check.id === "ci-plan-transport"),
      checks,
      remedies,
      nextAction:
        actionable?.remedy ??
        (checks.some((check) => check.id === "ci-plan-transport")
          ? "Use local exact-plan deployment"
          : "No action required"),
    };
  }

  async validate(): Promise<{ valid: boolean; events: number }> {
    const run = await this.currentRun();
    const head = await this.journal(run).head();
    const input = {
      dependencies: { journalHead: head ?? ZERO_HASH },
      config: { runtimeLockHash: run.runtimeLockHash },
      toolchain: { cliVersion: "0.1.0" },
    };
    const cached = await this.cache.get<{ valid: boolean; events: number }>(input);
    if (cached !== null) return cached;
    const result = { valid: true, events: (await this.journal(run).replay()).length };
    await this.cache.set(input, result);
    return result;
  }

  async cacheStatus(): Promise<{ entries: number }> {
    const directory = join(this.root, ".apex", "cache", "content");
    if (!(await this.exists(directory))) return { entries: 0 };
    return { entries: (await readdir(directory)).filter((name) => /^[0-9a-f]{64}\.json$/.test(name)).length };
  }

  async clearCache(): Promise<{ cleared: number }> {
    return { cleared: await this.cache.invalidate() };
  }

  async createWriterTransfer(input: {
    repository: string;
    branch: string;
    commit: string;
    workflowId: string;
    sender: string;
    recipient: string;
    currentHead: string;
    ttlMs: number;
  }): Promise<unknown> {
    const run = await this.currentRun();
    if (input.commit !== input.currentHead)
      throw new ApexError("APEX_STALE", "Transfer commit does not match current Git head", EXIT_CODES.stale);
    const transfers = new WriterTransferStore(this.projects.runDirectory(run.projectId, run.runId), this.clock);
    if ((await transfers.leaseStore().current()) === null)
      await transfers.leaseStore().acquire(input.sender, input.ttlMs);
    return transfers.create({
      projectId: run.projectId,
      runId: run.runId,
      repository: input.repository,
      branch: input.branch,
      commit: input.commit,
      workflowId: input.workflowId,
      sender: input.sender,
      recipient: input.recipient,
      currentEpoch: run.ownerEpoch,
      currentGitHead: input.currentHead,
      ttlMs: input.ttlMs,
      eventId: this.idSource(),
    });
  }

  async acceptWriterTransfer(claimHash: string, recipient: string, currentHead: string): Promise<unknown> {
    const run = await this.currentRun();
    return new WriterTransferStore(this.projects.runDirectory(run.projectId, run.runId), this.clock).accept({
      claimHash,
      recipient,
      currentGitHead: currentHead,
      eventId: this.idSource(),
    });
  }

  async currentWriter(): Promise<unknown> {
    const run = await this.currentRun();
    return new WriterTransferStore(this.projects.runDirectory(run.projectId, run.runId), this.clock).currentOwnership();
  }

  async acceptEvidence(input: {
    kind: string;
    contentType: string;
    value?: JsonValue;
    file?: string;
    required: boolean;
  }): Promise<unknown> {
    if ((input.value === undefined) === (input.file === undefined))
      throw new ApexError("APEX_USAGE", "Evidence requires exactly one value or file", EXIT_CODES.usage);
    const store = await this.evidenceStore(input.kind, input.contentType);
    const value = input.file === undefined ? input.value! : await readFile(resolve(input.file));
    const accepted = await store.accept({
      kind: input.kind,
      contentType: input.contentType,
      value,
      required: input.required,
    });
    await this.append(await this.currentRun(), "evidence.accepted", {
      kind: input.kind,
      contentType: input.contentType,
      status: accepted.status,
      bytes: accepted.bytes,
      ...(accepted.hash === undefined ? {} : { hash: accepted.hash }),
    });
    return accepted;
  }

  async setTelemetryConsent(consent: boolean): Promise<{ consent: boolean }> {
    await (await this.evidenceStore()).setTelemetryConsent(consent);
    return { consent };
  }

  async exportTelemetry(): Promise<JsonValue | null> {
    return (await this.evidenceStore()).exportTelemetry();
  }
  async deleteTelemetry(): Promise<{ deleted: true }> {
    await (await this.evidenceStore()).deleteTelemetry();
    return { deleted: true };
  }

  async render(kind: "status" | "requirements" | "preview" | "approval" | "inventory"): Promise<string> {
    const run = await this.currentRun();
    if (kind === "status") return renderRunStatus(run);
    const events = await this.journal(run).replay();
    const map = {
      requirements: ["task.completed", "requirementsHash", renderRequirements],
      preview: ["preview.created", "previewObjectHash", renderDeploymentPreview],
      approval: ["gate.decided", "approvalHash", renderApprovalEvidence],
      inventory: ["deployment.completed", "inventoryHash", renderResourceInventory],
    } as const;
    const [eventType, field, renderer] = map[kind];
    const hash = this.latestPayloadHash(events, eventType, field);
    if (hash === undefined) throw new ApexError("APEX_NOT_FOUND", `No ${kind} artifact exists`, EXIT_CODES.notFound);
    return renderer((await this.objects.getJson(hash)) as never);
  }

  async diagnose(): Promise<unknown> {
    return { status: await this.status(), doctor: await this.doctor() };
  }
  async reconcile(): Promise<unknown> {
    const inventory = await this.inventory();
    await this.append(await this.currentRun(), "deployment.reconciled", { deploymentHash: inventory.deploymentHash });
    return inventory;
  }
  async setup(live = false): Promise<unknown> {
    return this.doctor(false, false, live);
  }

  private async issueTask(
    run: RunConfigV1,
    descriptor: WorkflowTaskDescriptor,
    inputRefs: string[] = [],
  ): Promise<TaskEnvelopeV1> {
    const head = await this.journal(run).head();
    if (head === null)
      throw new ApexError("APEX_STALE", "Cannot issue a task before run initialization", EXIT_CODES.stale);
    const task = createTaskEnvelope(
      {
        projectId: run.projectId,
        runId: run.runId,
        role: descriptor.role,
        taskType: descriptor.id,
        expectedHead: head,
        ownerEpoch: run.ownerEpoch,
        inputRefs,
        allowedOutputKinds: descriptor.outputs,
        capabilityGrants: (descriptor.capabilities ?? []).map((capability) => ({
          capability,
          sideEffect: "remote" as const,
          expiresAt: new Date(this.clock().getTime() + TASK_TTL_MS).toISOString(),
        })),
        maxOutputBytes: 4 * 1024 * 1024,
        ttlMs: TASK_TTL_MS,
      },
      this.clock,
      this.idSource,
    );
    await atomicWriteJson(
      join(this.projects.runDirectory(run.projectId, run.runId), "tasks", `${task.taskId}.json`),
      task,
      { refuseOverwrite: true },
    );
    await this.append(run, "task.issued", { taskId: task.taskId, taskType: descriptor.id });
    const currentHead = await this.journal(run).head();
    const current = { ...task, expectedHead: currentHead! };
    await atomicWriteJson(
      join(this.projects.runDirectory(run.projectId, run.runId), "tasks", `${task.taskId}.json`),
      current,
    );
    return current;
  }

  private async openRunGate(run: RunConfigV1, gateNumber: number, dependencyHash: string): Promise<void> {
    const gate = run.gates.find(({ gate }) => gate === gateNumber)!;
    const updated = {
      ...run,
      gates: run.gates.map((item) => (item.gate === gateNumber ? openGate(gate, dependencyHash) : item)),
    };
    await this.mutateRun(run, updated, "gate.opened", { gate: gateNumber, dependencyHash });
  }

  private async mutateRun(
    before: RunConfigV1,
    after: RunConfigV1,
    eventType: string,
    payload: JsonValue,
  ): Promise<void> {
    const repository = this.runRepository(before);
    try {
      await repository.mutate({
        expectedRunHash: sha256Json(before),
        event: {
          eventId: this.idSource(),
          projectId: before.projectId,
          runId: before.runId,
          type: eventType,
          timestamp: this.clock().toISOString(),
          ownerEpoch: after.ownerEpoch,
          payload,
        },
        update: () => after,
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Stale run hash"))
        throw new ApexError("APEX_STALE", "Run state changed", EXIT_CODES.stale, undefined, error);
      throw error;
    }
  }

  private async append(run: RunConfigV1, type: string, payload: JsonValue): Promise<void> {
    const journal = this.journal(run);
    await journal.append({
      eventId: this.idSource(),
      projectId: run.projectId,
      runId: run.runId,
      type,
      timestamp: this.clock().toISOString(),
      ownerEpoch: run.ownerEpoch,
      expectedHead: await journal.head(),
      payload,
    });
  }

  private journal(run: RunConfigV1): EventJournal {
    return new EventJournal(join(this.projects.runDirectory(run.projectId, run.runId), "journal"));
  }

  private runPath(run: RunConfigV1): string {
    return join(this.projects.runDirectory(run.projectId, run.runId), "run.json");
  }
  private async currentRun(): Promise<RunConfigV1> {
    await this.recoverCustomizationTransaction();
    return this.run(await this.selection());
  }
  private async run(selection: Selection): Promise<RunConfigV1> {
    return this.runRepository(selection).read();
  }

  private runRepository(selection: Selection): RunRepository {
    return new RunRepository(this.projects.runDirectory(selection.projectId, selection.runId), {
      clock: this.clock,
      idSource: this.idSource,
    });
  }
  private async selection(): Promise<Selection> {
    return JSON.parse(await readFile(join(this.root, ".apex", "config.json"), "utf8")) as Selection;
  }
  private async writeSelection(selection: Selection): Promise<void> {
    await atomicWriteJson(join(this.root, ".apex", "config.json"), selection);
  }

  private latestPayloadHash(
    events: Awaited<ReturnType<EventJournal["replay"]>>,
    type: string,
    field: string,
    predicate?: (payload: Record<string, unknown>) => boolean,
  ): string | undefined {
    for (const event of [...events].reverse()) {
      const payload = event.payload as Record<string, unknown>;
      if (event.type === type && (predicate?.(payload) ?? true) && typeof payload[field] === "string")
        return payload[field];
    }
    return undefined;
  }

  private artifactHash(events: Awaited<ReturnType<EventJournal["replay"]>>, kind: ArtifactKind): string | undefined {
    for (const event of [...events].reverse()) {
      if (event.type !== "task.completed") continue;
      const hashes = (event.payload as { artifactHashes?: Partial<Record<ArtifactKind, unknown>> }).artifactHashes;
      if (typeof hashes?.[kind] === "string") return hashes[kind];
    }
    const legacyFields: Partial<Record<ArtifactKind, string>> = {
      requirements: "requirementsHash",
      "implementation-intent": "intentHash",
    };
    const field = legacyFields[kind];
    return field === undefined ? undefined : this.latestPayloadHash(events, "task.completed", field);
  }

  private inputRefs(events: Awaited<ReturnType<EventJournal["replay"]>>): string[] {
    const hashes = events.flatMap((event) => {
      if (event.type !== "task.completed") return [];
      const artifactHashes = (event.payload as { artifactHashes?: Record<string, unknown> }).artifactHashes ?? {};
      return Object.values(artifactHashes).filter((hash): hash is string => typeof hash === "string");
    });
    return [...new Set(hashes)];
  }

  private completedNodeIds(events: Awaited<ReturnType<EventJournal["replay"]>>): Set<string> {
    return new Set(
      events.flatMap((event) => {
        if (event.type !== "task.completed") return [];
        const nodeId = (event.payload as { nodeId?: unknown }).nodeId;
        return typeof nodeId === "string" ? [nodeId] : [];
      }),
    );
  }

  private async route(
    run: RunConfigV1,
    events: Awaited<ReturnType<EventJournal["replay"]>>,
  ): Promise<{
    task?: WorkflowTaskDescriptor;
    blockers: string[];
    reviewGate?: number;
  }> {
    const completed = this.completedNodeIds(events);
    const legacy = events.some(
      (event) => event.type === "task.completed" && (event.payload as { legacy?: unknown }).legacy === true,
    );
    if (legacy) {
      if (!completed.has("requirements")) return { task: TASKS[0]!, blockers: [] };
      if (!this.gateApproved(run, 1)) return { blockers: ["Gate 1 approval is required"] };
      if (!completed.has("plan")) return { task: TASKS.find(({ id }) => id === "plan")!, blockers: [] };
      return { blockers: [] };
    }
    const manifest = new WorkflowEngine(
      JSON.parse(await readFile(join(this.root, ".apex", "runtime", "workflow.v1.json"), "utf8")),
    ).manifest;
    const ordered = manifest.nodes
      .flatMap((node) => {
        const descriptor = TASKS.find(({ id }) => id === node.id);
        const reviews = TASKS.filter(({ reviewSubject }) => reviewSubject === node.id);
        return [...(descriptor === undefined ? [] : [descriptor]), ...reviews];
      })
      .filter(({ track }) => track === undefined || track === run.iacTool);
    for (const descriptor of ordered) {
      if (completed.has(descriptor.id)) {
        const reviewBlockers = descriptor.reviewSubject === undefined ? [] : this.reviewBlockers(events, descriptor.id);
        if (reviewBlockers.length > 0)
          return {
            blockers: reviewBlockers,
            ...(descriptor.gate === undefined ? {} : { reviewGate: descriptor.gate }),
          };
        if (descriptor.gate !== undefined && !this.gateApproved(run, descriptor.gate)) {
          return { blockers: [`Gate ${descriptor.gate} approval is required`] };
        }
        continue;
      }
      if (descriptor.id === "diagnosis" && !events.some(({ type }) => type === "deployment.completed")) {
        const preview = this.latestPayloadHash(events, "preview.created", "previewHash");
        if (preview === undefined) return { blockers: ["Deployment preview is required"] };
        if (!this.gateApproved(run, 4)) return { blockers: ["Gate 4 approval is required"] };
        return { blockers: ["Deployment and inventory are required"] };
      }
      return { task: descriptor, blockers: [] };
    }
    return { blockers: [] };
  }

  private gateApproved(run: RunConfigV1, gateNumber: number): boolean {
    const state = run.gates.find(({ gate }) => gate === gateNumber)?.state;
    return state === "approved" || state === "inherited";
  }

  private reviewBlockers(events: Awaited<ReturnType<EventJournal["replay"]>>, nodeId: string): string[] {
    const event = [...events]
      .reverse()
      .find(
        (candidate) =>
          candidate.type === "task.completed" && (candidate.payload as { nodeId?: unknown }).nodeId === nodeId,
      );
    const reviewHash = (event?.payload as { reviewHash?: unknown } | undefined)?.reviewHash;
    const subjectHash = (event?.payload as { subjectHash?: unknown } | undefined)?.subjectHash;
    const dependencyHash = (event?.payload as { dependencyHash?: unknown } | undefined)?.dependencyHash;
    const resolutions = new Set(
      events.flatMap((candidate) => {
        if (candidate.type !== "review.resolved") return [];
        const resolution = (candidate.payload as { resolution?: ReviewResolution }).resolution;
        if (resolution === undefined) return [];
        return resolution.reviewHash === reviewHash &&
          resolution.subjectHash === subjectHash &&
          resolution.dependencyHash === dependencyHash &&
          (resolution.disposition === "fixed" ||
            (resolution.expiresAt !== undefined && Date.parse(resolution.expiresAt) > this.clock().getTime()))
          ? [resolution.findingId]
          : [];
      }),
    );
    const blockers = (event?.payload as { reviewBlockers?: unknown } | undefined)?.reviewBlockers;
    return Array.isArray(blockers)
      ? blockers
          .filter((id): id is string => typeof id === "string" && !resolutions.has(id))
          .map((id) => `Review finding ${id} must be resolved`)
      : [];
  }

  private dependencyRevision(run: RunConfigV1, events: Awaited<ReturnType<EventJournal["replay"]>>): string {
    const artifacts = events.reduce<Record<string, string>>((current, event) => {
      if (event.type !== "task.completed") return current;
      const hashes = (event.payload as { artifactHashes?: Record<string, unknown> }).artifactHashes ?? {};
      for (const [kind, hash] of Object.entries(hashes)) if (typeof hash === "string") current[kind] = hash;
      return current;
    }, {});
    return sha256Json({
      projectId: run.projectId,
      runId: run.runId,
      targetScope: run.targetScope,
      iacTool: run.iacTool,
      runtimeLockHash: run.runtimeLockHash,
      ownerEpoch: run.ownerEpoch,
      artifacts,
    });
  }

  private async assertPreviewReady(
    run: RunConfigV1,
    events: Awaited<ReturnType<EventJournal["replay"]>>,
  ): Promise<void> {
    if (!this.gateApproved(run, 3))
      throw new ApexError("APEX_AUTHORIZATION", "Gate 3 approval is required before preview", EXIT_CODES.authorization);
    const runtimeRoot = join(this.root, ".apex", "runtime");
    const workflowBytes = await readFile(join(runtimeRoot, "workflow.v1.json"));
    const lock = JSON.parse(await readFile(join(this.root, ".apex", "apex.lock.json"), "utf8")) as RuntimeBundleLockV1;
    if (sha256Json(lock) !== run.runtimeLockHash || sha256Bytes(workflowBytes) !== lock.workflowHash)
      throw new ApexError("APEX_STALE", "Runtime workflow lock is not current", EXIT_CODES.stale);
    const engine = new WorkflowEngine(JSON.parse(workflowBytes.toString("utf8")));
    const aliases: Partial<Record<ArtifactKind, string>> = {
      requirements: "requirements-v1",
      "sku-manifest": "sku-manifest-v1",
      architecture: "architecture-v1",
      "cost-estimate": "cost-estimate-v1",
      "governance-constraints": "governance-constraints-v1",
      "policy-property-map": "policy-property-map-v1",
      "implementation-intent": "implementation-intent-v1",
      "iac-binding": "iac-binding-v1",
      "environment-inputs": "environment-inputs-v1",
      "logical-resource-manifest": "logical-resource-manifest-v1",
      "iac-handoff": "iac-handoff-v1",
      "validation-evidence": "validation-evidence-v1",
    };
    const artifacts: Record<string, JsonValue> = {
      "project-config": true,
      defaults: true,
      toolchain: true,
      "runtime-bundle": true,
      "governance-capability-lock": true,
      "quota-evidence": true,
      "pricing-evidence": true,
      "regional-availability-evidence": true,
      "quota-evidence-current": true,
      "accepted-risk-scopes": true,
      ...(run.iacTool === "bicep"
        ? { "bicep-tree": true }
        : { "terraform-tree": true, "terraform-lockfile": true, "terraform-state-lineage-and-serial": true }),
    };
    for (const event of events) {
      if (event.type !== "task.completed") continue;
      const payload = event.payload as {
        nodeId?: unknown;
        artifactHashes?: Partial<Record<ArtifactKind, unknown>>;
      };
      for (const [kind, hash] of Object.entries(payload.artifactHashes ?? {})) {
        const alias = aliases[kind as ArtifactKind];
        if (alias !== undefined && typeof hash === "string") artifacts[alias] = hash;
      }
      if (typeof payload.nodeId === "string" && payload.nodeId.endsWith("-review")) {
        artifacts[payload.nodeId] = true;
        if (payload.nodeId === "governance-review") artifacts["governance-reconciliation-review"] = true;
      }
    }
    const completedNodes = [
      ...this.completedNodeIds(events),
      ...run.gates.flatMap((gate) =>
        gate.state === "approved" || gate.state === "inherited" ? [`gate-${gate.gate}`] : [],
      ),
    ];
    const route = engine.route({
      run: { iacTool: run.iacTool, targetScope: run.targetScope },
      artifacts,
      completedNodes,
      gateStates: Object.fromEntries(run.gates.map((gate) => [`gate-${gate.gate}`, gate.state])),
    });
    const expectedNode = `preview-${run.iacTool}`;
    if (route.nextTask !== expectedNode) {
      const blockers = route.blockers.length > 0 ? route.blockers : [`workflow-route:${route.currentNode ?? "none"}`];
      throw new ApexError(
        "APEX_AUTHORIZATION",
        `Workflow is not ready for ${expectedNode}: ${blockers.join(", ")}`,
        EXIT_CODES.authorization,
        blockers,
      );
    }
    for (const reviewNode of ["requirements-review", "architecture-review", "governance-review", "plan-review"]) {
      const blockers = this.reviewBlockers(events, reviewNode);
      if (blockers.length > 0)
        throw new ApexError("APEX_AUTHORIZATION", blockers.join("; "), EXIT_CODES.authorization, blockers);
    }
  }

  private openReviewFindings(value: unknown): string[] {
    const review = value as { findings?: Array<{ id: string; disposition: string; severity: string }> };
    return (review.findings ?? [])
      .filter((finding) => finding.disposition === "open" && finding.severity !== "info")
      .map(({ id }) => id);
  }

  private validateOutput(run: RunConfigV1, output: TaskOutput): void {
    const descriptor = ARTIFACTS[output.kind];
    this.assertValid(descriptor[0], output.value);
    if (output.value === null || typeof output.value !== "object") return;
    const identity = output.value as { projectId?: unknown; runId?: unknown; track?: unknown; environment?: unknown };
    if (identity.projectId !== undefined && identity.projectId !== run.projectId) {
      throw new ApexError(
        "APEX_VALIDATION",
        "Task output project identity does not match the selected run",
        EXIT_CODES.validation,
      );
    }
    if (identity.runId !== undefined && identity.runId !== run.runId) {
      throw new ApexError(
        "APEX_VALIDATION",
        "Task output run identity does not match the selected run",
        EXIT_CODES.validation,
      );
    }
    if (identity.track !== undefined && identity.track !== run.iacTool) {
      throw new ApexError(
        "APEX_VALIDATION",
        `Artifact track '${String(identity.track)}' does not match selected track '${run.iacTool}'`,
        EXIT_CODES.validation,
      );
    }
    if (output.kind === "environment-inputs") {
      const inputs = output.value as EnvironmentInputsV1;
      if (inputs.environment !== run.environment || !hasOnlyTypedSecretReferences(inputs)) {
        throw new ApexError(
          "APEX_VALIDATION",
          "Environment inputs do not match the run or contain an invalid secret reference",
          EXIT_CODES.validation,
        );
      }
      for (const [name, input] of Object.entries(inputs.inputs)) {
        if (input.kind === "value" && /secret|password|token|credential|api[-_]?key/i.test(name)) {
          throw new ApexError(
            "APEX_VALIDATION",
            `Environment input '${name}' must use a secret-reference`,
            EXIT_CODES.validation,
          );
        }
      }
    }
    if (output.kind === "cost-estimate" && !hasValidCostArithmetic(output.value as CostEstimateV1)) {
      throw new ApexError("APEX_VALIDATION", "Cost estimate arithmetic does not reconcile", EXIT_CODES.validation);
    }
    if (
      output.kind === "logical-resource-manifest" &&
      !hasValidLogicalResourceReferences(output.value as LogicalResourceManifestV1)
    ) {
      throw new ApexError("APEX_VALIDATION", "Logical resource dependencies are invalid", EXIT_CODES.validation);
    }
  }

  private async validateBundle(
    run: RunConfigV1,
    descriptor: WorkflowTaskDescriptor,
    outputs: TaskOutput[],
  ): Promise<void> {
    const byKind = Object.fromEntries(outputs.map((output) => [output.kind, output.value])) as Partial<
      Record<ArtifactKind, unknown>
    >;
    const events = await this.journal(run).replay();
    if (descriptor.id === "plan") {
      const intent = byKind["implementation-intent"] as ImplementationIntentV1;
      const binding = byKind["iac-binding"] as IacBindingV1;
      const resourceIds = new Set(intent.resources.map(({ id }) => id));
      const bindingIds = Object.keys(binding.resourceBindings);
      if (
        binding.track !== run.iacTool ||
        binding.intentHash !== sha256Json(intent) ||
        bindingIds.length !== resourceIds.size ||
        bindingIds.some((id) => !resourceIds.has(id))
      ) {
        throw new ApexError(
          "APEX_VALIDATION",
          "IaC binding track, intent hash, or resource coverage is invalid",
          EXIT_CODES.validation,
        );
      }
    }
    if (descriptor.id.startsWith("codegen-")) {
      const manifest = byKind["logical-resource-manifest"] as LogicalResourceManifestV1;
      const handoff = byKind["iac-handoff"] as {
        logicalResourceManifestHash: string;
        treeHash: string;
        intentHash: string;
        bindingHash: string;
        environmentInputsHash: string;
      };
      if (
        handoff.logicalResourceManifestHash !== sha256Json(manifest) ||
        handoff.intentHash !== this.artifactHash(events, "implementation-intent") ||
        handoff.bindingHash !== this.artifactHash(events, "iac-binding") ||
        handoff.environmentInputsHash !== this.artifactHash(events, "environment-inputs") ||
        !/^[0-9a-f]{64}$/.test(handoff.treeHash)
      ) {
        throw new ApexError(
          "APEX_VALIDATION",
          "IaC handoff does not bind the accepted logical manifest and code tree",
          EXIT_CODES.validation,
        );
      }
    }
    if (descriptor.id === "governance-reconciliation") {
      const policy = byKind["policy-property-map"] as { governanceHash: string };
      if (policy.governanceHash !== this.artifactHash(events, "governance-constraints")) {
        throw new ApexError(
          "APEX_VALIDATION",
          "Policy property map does not bind accepted governance constraints",
          EXIT_CODES.validation,
        );
      }
    }
    if (descriptor.reviewSubject !== undefined) {
      const review = byKind["review-findings"] as {
        subjectKind: string;
        subjectHash: string;
        findings: Array<{ id: string; disposition: string; severity: string }>;
      };
      const subjectKind =
        descriptor.reviewSubject === "governance-reconciliation" ? "policy-property-map" : descriptor.reviewSubject;
      if (review.subjectKind !== subjectKind)
        throw new ApexError("APEX_VALIDATION", `Review subject must be ${subjectKind}`, EXIT_CODES.validation);
      const expectedHash =
        subjectKind === "plan"
          ? this.artifactHash(events, "implementation-intent")
          : this.artifactHash(events, subjectKind as ArtifactKind);
      if (expectedHash === undefined || review.subjectHash !== expectedHash) {
        throw new ApexError(
          "APEX_VALIDATION",
          `Review does not bind the accepted ${subjectKind} artifact`,
          EXIT_CODES.validation,
        );
      }
    }
  }

  private async validateTaskValidators(descriptor: WorkflowTaskDescriptor, outputs: TaskOutput[]): Promise<string[]> {
    const workflow = new WorkflowEngine(
      JSON.parse(await readFile(join(this.root, ".apex", "runtime", "workflow.v1.json"), "utf8")),
    );
    const nodeId = descriptor.reviewSubject ?? descriptor.id;
    const node = workflow.manifest.nodes.find(({ id }) => id === nodeId);
    if (node === undefined) throw new Error(`Workflow task ${nodeId} has no manifest node`);
    const boundary =
      descriptor.reviewSubject !== undefined
        ? "review"
        : descriptor.id.startsWith("validation-")
          ? "validation"
          : "task-output";
    const validatorIds = node.validators.filter((id) => workflowValidatorOwnership(id)?.boundary === boundary);
    const run = await this.currentRun();
    const events = await this.journal(run).replay();
    const artifactHashes: Record<string, string> = {};
    for (const event of events) {
      if (event.type !== "task.completed") continue;
      const hashes = (event.payload as { artifactHashes?: Record<string, unknown> }).artifactHashes ?? {};
      for (const [kind, hash] of Object.entries(hashes)) if (typeof hash === "string") artifactHashes[kind] = hash;
    }
    const artifacts = Object.fromEntries(
      await Promise.all(
        Object.entries(artifactHashes).map(async ([kind, hash]) => [kind, await this.objects.getJson<unknown>(hash)]),
      ),
    );
    const context: WorkflowTaskValidatorContext = {
      nodeId,
      now: this.clock().toISOString(),
      track: run.iacTool,
      outputs: Object.fromEntries(outputs.map(({ kind, value }) => [kind, value])),
      artifacts,
      artifactHashes,
    };
    for (const id of validatorIds) {
      this.assertValid(id, taskWorkflowValidatorInput(id, context));
    }
    return validatorIds;
  }

  private initialSkuManifest(run: RunConfigV1, requirements: unknown): unknown {
    return {
      schemaVersion: CONTRACT_VERSION,
      projectId: run.projectId,
      environments: [run.environment],
      services: [],
      revisions: [
        {
          number: 1,
          createdAt: this.clock().toISOString(),
          sourceHash: sha256Json(requirements),
          reason: "Initial requirements",
        },
      ],
    };
  }

  private legacyPlanOutputs(run: RunConfigV1, intent: unknown): TaskOutput[] {
    const intentHash = sha256Json(intent);
    const resources = (intent as ImplementationIntentV1).resources;
    return [
      {
        kind: "iac-binding",
        value: {
          schemaVersion: CONTRACT_VERSION,
          projectId: run.projectId,
          runId: run.runId,
          track: run.iacTool,
          intentHash,
          resourceBindings: Object.fromEntries(
            resources.map(({ id, type }) => [id, { implementation: type, version: "legacy", parameters: {} }]),
          ),
        },
      },
      {
        kind: "environment-inputs",
        value: {
          schemaVersion: CONTRACT_VERSION,
          projectId: run.projectId,
          runId: run.runId,
          environment: run.environment,
          inputs: {},
        },
      },
    ];
  }

  private async readTask(run: RunConfigV1, taskId: string): Promise<TaskEnvelopeV1> {
    return JSON.parse(
      await readFile(join(this.projects.runDirectory(run.projectId, run.runId), "tasks", `${taskId}.json`), "utf8"),
    ) as TaskEnvelopeV1;
  }

  private async refreshTaskHead(run: RunConfigV1, task: TaskEnvelopeV1): Promise<void> {
    const expectedHead = await this.journal(run).head();
    if (expectedHead === null) throw new ApexError("APEX_STALE", "Task journal is empty", EXIT_CODES.stale);
    await atomicWriteJson(join(this.projects.runDirectory(run.projectId, run.runId), "tasks", `${task.taskId}.json`), {
      ...task,
      expectedHead,
    });
  }

  private async assertNoSymlinkPath(root: string, destination: string): Promise<void> {
    await mkdir(root, { recursive: true });
    const rootStat = await lstat(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory())
      throw new ApexError("APEX_VALIDATION", "Code staging root must be a real directory", EXIT_CODES.validation);
    let current = root;
    for (const segment of relative(root, destination).split(sep).slice(0, -1)) {
      current = join(current, segment);
      if (!(await this.exists(current))) continue;
      const entry = await lstat(current);
      if (entry.isSymbolicLink() || !entry.isDirectory())
        throw new ApexError(
          "APEX_VALIDATION",
          "Code staging path contains a non-directory or symlink",
          EXIT_CODES.validation,
        );
    }
  }

  private async directoryBytes(directory: string): Promise<number> {
    if (!(await this.exists(directory))) return 0;
    let total = 0;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new ApexError("APEX_VALIDATION", "Code staging tree contains a symlink", EXIT_CODES.validation);
      total += entry.isDirectory() ? await this.directoryBytes(path) : (await stat(path)).size;
    }
    return total;
  }

  private looksLikeIntent(value: unknown): value is ImplementationIntentV1 {
    return (
      value !== null &&
      typeof value === "object" &&
      Array.isArray((value as { resources?: unknown }).resources) &&
      Array.isArray((value as { outputs?: unknown }).outputs) &&
      typeof (value as { sourceHashes?: unknown }).sourceHashes === "object"
    );
  }

  private looksLikeBinding(value: unknown, track: "bicep" | "terraform"): value is IacBindingV1 {
    return (
      value !== null &&
      typeof value === "object" &&
      (value as { track?: unknown }).track === track &&
      typeof (value as { intentHash?: unknown }).intentHash === "string" &&
      typeof (value as { resourceBindings?: unknown }).resourceBindings === "object"
    );
  }

  private looksLikeEnvironmentInputs(value: unknown): value is EnvironmentInputsV1 {
    return (
      value !== null &&
      typeof value === "object" &&
      typeof (value as { environment?: unknown }).environment === "string" &&
      typeof (value as { inputs?: unknown }).inputs === "object"
    );
  }

  private assertValid(name: string, value: unknown): void {
    const result = this.validators.validate(name, value);
    const issues = result.issues.filter((issue) => !issue.message.startsWith("Unknown format 'date"));
    const invalidDateTimes = this.invalidDateTimes(value);
    if (issues.length > 0 || invalidDateTimes.length > 0) {
      throw new ApexError("APEX_VALIDATION", `${name} validation failed`, EXIT_CODES.validation, [
        ...issues,
        ...invalidDateTimes.map((path) => ({ path, message: "Invalid ISO date-time" })),
      ]);
    }
  }

  private invalidDateTimes(value: unknown, path = ""): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => this.invalidDateTimes(item, `${path}/${index}`));
    }
    if (value === null || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([key, item]) => {
      const itemPath = `${path}/${key}`;
      if ((key.endsWith("At") || key === "expiresAt") && typeof item === "string") {
        return Number.isNaN(Date.parse(item)) || new Date(item).toISOString() !== item ? [itemPath] : [];
      }
      return this.invalidDateTimes(item, itemPath);
    });
  }

  private async latestRun(projectId: ProjectId): Promise<RunId> {
    const names = await readdir(join(this.projects.projectDirectory(projectId), "runs"));
    const runs = await Promise.all(names.map((name) => this.projects.getRun(projectId, name as RunId)));
    const latest = runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (latest === undefined) throw new ApexError("APEX_NOT_FOUND", "Project has no runs", EXIT_CODES.notFound);
    return latest.runId;
  }

  private async assertCleanInitialization(): Promise<void> {
    if (await this.exists(join(this.root, ".apex")))
      throw new ApexError("APEX_CONFLICT", "Workspace is already initialized", EXIT_CODES.conflict);
  }

  private async createRuntimeLock(
    assets: Awaited<ReturnType<typeof resolveBundledAssets>>,
  ): Promise<RuntimeBundleLockV1> {
    const runtimeRoot = join(this.root, ".apex", "runtime");
    const packs = JSON.parse(await readFile(join(runtimeRoot, "capability-packs.registry.json"), "utf8")) as {
      packs?: Array<{ id?: unknown; name?: unknown }>;
    };
    const requiredCapabilityPacks = (packs.packs ?? []).map((pack) => {
      const id = typeof pack.id === "string" ? pack.id : pack.name;
      if (typeof id !== "string" || id.length === 0)
        throw new ApexError("APEX_VALIDATION", "Capability pack has no identifier", EXIT_CODES.validation);
      return id;
    });
    const validatorPath = (await this.exists(join(runtimeRoot, "runtime-bundle.v1.json")))
      ? join(runtimeRoot, "runtime-bundle.v1.json")
      : join(runtimeRoot, "toolchain.v1.json");
    const lock: RuntimeBundleLockV1 = {
      schemaVersion: CONTRACT_VERSION,
      cliVersion: "0.1.0",
      customizationVersion: assets.manifest.sources.customizations,
      workflowHash: sha256Bytes(await readFile(join(runtimeRoot, "workflow.v1.json"))),
      defaultsHash: sha256Bytes(await readFile(join(runtimeRoot, "defaults.v1.json"))),
      validatorHash: sha256Bytes(await readFile(validatorPath)),
      requiredCapabilityPacks: [...new Set(requiredCapabilityPacks)].sort(),
    };
    this.assertValid("runtime-lock", lock);
    return lock;
  }

  private capabilityPacks(manifestPath?: string): CapabilityPackManager {
    return new CapabilityPackManager({
      root: this.root,
      manifestPath: manifestPath ?? join(this.root, ".apex", "runtime", "capability-packs.registry.json"),
      processRunner: this.processRunner,
    });
  }

  private async runtimeLockChecks(run: RunConfigV1): Promise<DoctorCheck[]> {
    const path = join(this.root, ".apex", "apex.lock.json");
    try {
      const lock = JSON.parse(await readFile(path, "utf8")) as RuntimeBundleLockV1;
      this.assertValid("runtime-lock", lock);
      const runtimeRoot = join(this.root, ".apex", "runtime");
      const validatorPath = (await this.exists(join(runtimeRoot, "runtime-bundle.v1.json")))
        ? join(runtimeRoot, "runtime-bundle.v1.json")
        : join(runtimeRoot, "toolchain.v1.json");
      const hashes = [
        { id: "runtime-lock:workflow", expected: lock.workflowHash, path: join(runtimeRoot, "workflow.v1.json") },
        { id: "runtime-lock:defaults", expected: lock.defaultsHash, path: join(runtimeRoot, "defaults.v1.json") },
        { id: "runtime-lock:validators", expected: lock.validatorHash, path: validatorPath },
      ];
      const checks = await Promise.all(
        hashes.map(async (item): Promise<DoctorCheck> => {
          const actual = (await this.exists(item.path)) ? sha256Bytes(await readFile(item.path)) : "missing";
          return {
            id: item.id,
            ok: actual === item.expected,
            value: actual,
            remedy: "Run doctor --fix --yes to reinstall bundled runtime files",
          };
        }),
      );
      checks.unshift({
        id: "runtime-lock:run-binding",
        ok: sha256Json(lock) === run.runtimeLockHash,
        value: sha256Json(lock),
        remedy: "Reinitialize the run against the installed runtime lock",
      });
      const packs = JSON.parse(await readFile(join(runtimeRoot, "capability-packs.registry.json"), "utf8")) as {
        packs?: Array<{ id?: string }>;
      };
      const available = new Set((packs.packs ?? []).flatMap(({ id }) => (id === undefined ? [] : [id])));
      checks.push({
        id: "capability-packs",
        ok: lock.requiredCapabilityPacks.every((id) => available.has(id)),
        value: [...available].sort().join(","),
        remedy: "Run doctor --fix --yes to reinstall the capability pack manifest",
      });
      return checks;
    } catch (error) {
      return [
        {
          id: "runtime-lock",
          ok: false,
          value: error instanceof Error ? error.message : "invalid",
          remedy: "Run doctor --fix --yes to reinstall the runtime lock",
        },
      ];
    }
  }

  private async managedFileChecks(): Promise<DoctorCheck[]> {
    const path = join(this.root, ".apex", "customizations.lock.json");
    try {
      const lock = JSON.parse(await readFile(path, "utf8")) as CustomizationLock;
      return await Promise.all(
        [
          ...lock.files.map((file) => ({ ...file, destination: join(this.root, file.path) })),
          ...lock.runtime.map((file) => ({ ...file, destination: join(this.root, ".apex", "runtime", file.path) })),
        ].map(async (file): Promise<DoctorCheck> => {
          const actual = (await this.exists(file.destination))
            ? sha256Bytes(await readFile(file.destination))
            : "missing";
          const hashesValid = [file.sourceHash, file.baseHash, file.currentHash].every((hash) =>
            /^[0-9a-f]{64}$/.test(hash),
          );
          return {
            id: `managed:${relative(this.root, file.destination)}`,
            ok: hashesValid && actual === file.currentHash,
            value: actual,
            remedy: "Run doctor --fix --yes to reinstall bundled managed files",
          };
        }),
      );
    } catch (error) {
      return [
        {
          id: "managed-files",
          ok: false,
          value: error instanceof Error ? error.message : "invalid",
          remedy: "Run doctor --fix --yes to reinstall bundled managed files",
        },
      ];
    }
  }

  private async evidenceStore(kind?: string, contentType?: string): Promise<EvidenceStore> {
    const defaults = JSON.parse(await readFile(join(this.root, ".apex", "runtime", "defaults.v1.json"), "utf8")) as {
      evidence?: { budgets?: { perEntryBytes?: number }; immutableKinds?: string[] };
    };
    const maxBytes = defaults.evidence?.budgets?.perEntryBytes;
    if (!Number.isInteger(maxBytes) || maxBytes === undefined || maxBytes < 1)
      throw new ApexError("APEX_VALIDATION", "Runtime evidence byte budget is invalid", EXIT_CODES.validation);
    const kinds =
      kind === undefined
        ? {}
        : {
            [kind]: {
              contentTypes: [contentType!],
              maxBytes,
              retention: defaults.evidence?.immutableKinds?.includes(kind)
                ? ("immutable" as const)
                : ("project" as const),
            },
          };
    return new EvidenceStore(this.root, new EvidencePolicy({ kinds }));
  }

  private async pathExecutableExists(executable: string): Promise<boolean> {
    for (const directory of (process.env.PATH ?? "").split(delimiter).filter((item) => item.length > 0)) {
      try {
        await access(join(directory, executable), constants.X_OK);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" && (error as NodeJS.ErrnoException).code !== "EACCES")
          throw error;
      }
    }
    return false;
  }

  private async installCustomizations(
    sourcePath: string,
    update: boolean,
    runtimeSource?: string,
    repair = false,
  ): Promise<string[]> {
    await this.recoverCustomizationTransaction();
    const source = resolve(sourcePath);
    const sourceStat = await lstat(source);
    if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink())
      throw new ApexError("APEX_VALIDATION", "Customizations source must be a real directory", EXIT_CODES.validation);
    await this.assertSafeExistingPath(source, source);
    const lockPath = join(this.root, ".apex", "customizations.lock.json");
    let previous: CustomizationLock | undefined;
    if (update) previous = JSON.parse(await readFile(lockPath, "utf8")) as CustomizationLock;
    const transactionRoot = join(this.root, ".apex", "local", `update-${this.idSource()}`);
    const entries: CustomizationTransactionEntry[] = [];
    const prepare = async (
      sourceRoot: string,
      destinationRoot: string,
      oldFiles: ManagedFile[],
      label: string,
    ): Promise<ManagedFile[]> => {
      const sourceFiles = await this.walkFiles(sourceRoot);
      const managed: ManagedFile[] = [];
      const incomingPaths = new Set<string>();
      for (const absoluteSource of sourceFiles) {
        const path = relative(sourceRoot, absoluteSource);
        incomingPaths.add(path);
        const destination = resolve(destinationRoot, path);
        if (destination !== destinationRoot && !destination.startsWith(`${destinationRoot}${sep}`))
          throw new ApexError("APEX_VALIDATION", `${label} destination escapes its root`, EXIT_CODES.validation);
        await this.assertSafeDestination(destinationRoot, destination);
        const incoming = await readFile(absoluteSource);
        const sourceHash = sha256Bytes(incoming);
        const old = oldFiles.find((file) => file.path === path);
        let output = incoming;
        const existed = await this.pathExistsLstat(destination);
        if (existed) {
          const current = await readFile(destination);
          const currentHash = sha256Bytes(current);
          if (old === undefined && currentHash !== sourceHash)
            throw new ApexError(
              "APEX_CONFLICT",
              `Existing file conflicts with managed ${label}: ${path}`,
              EXIT_CODES.conflict,
            );
          if (!repair && old !== undefined && currentHash !== old.currentHash && currentHash !== old.baseHash) {
            const base = old.baseRef === undefined ? undefined : await this.readOptional(join(this.root, old.baseRef));
            const merged = base === undefined ? undefined : this.mergeText(base, current, incoming);
            if (merged === undefined)
              throw new ApexError("APEX_CONFLICT", `Managed ${label} conflict: ${path}`, EXIT_CODES.conflict);
            output = Buffer.from(merged);
          }
        }
        const staged = join(transactionRoot, "incoming", label, path);
        await atomicWriteBytes(staged, output);
        const backup = existed ? join(transactionRoot, "backup", label, path) : undefined;
        if (backup !== undefined) await atomicWriteBytes(backup, await readFile(destination));
        entries.push({ destination, staged, ...(backup === undefined ? {} : { backup }), existed });
        const baseRef = join(".apex", "customization-bases", sourceHash, label, path);
        const baseDestination = join(this.root, baseRef);
        await this.assertSafeDestination(this.root, baseDestination);
        entries.push({
          destination: baseDestination,
          staged: join(transactionRoot, "bases", sourceHash, label, path),
          existed: await this.pathExistsLstat(baseDestination),
        });
        await atomicWriteBytes(entries.at(-1)!.staged!, incoming);
        managed.push({ path, sourceHash, baseHash: sourceHash, currentHash: sha256Bytes(output), baseRef });
      }
      for (const old of oldFiles.filter((file) => !incomingPaths.has(file.path))) {
        const destination = resolve(destinationRoot, old.path);
        await this.assertSafeDestination(destinationRoot, destination);
        if (!(await this.pathExistsLstat(destination))) continue;
        const currentHash = sha256Bytes(await readFile(destination));
        if (currentHash !== old.currentHash && currentHash !== old.baseHash)
          throw new ApexError(
            "APEX_CONFLICT",
            `Removed managed ${label} was locally modified: ${old.path}`,
            EXIT_CODES.conflict,
          );
        const backup = join(transactionRoot, "backup", label, old.path);
        await atomicWriteBytes(backup, await readFile(destination));
        entries.push({ destination, backup, existed: true, remove: true });
      }
      return managed;
    };
    const managed = await prepare(source, this.root, previous?.files ?? [], "customization");
    const runtime =
      runtimeSource === undefined
        ? (previous?.runtime ?? [])
        : await prepare(
            resolve(runtimeSource),
            join(this.root, ".apex", "runtime"),
            previous?.runtime ?? [],
            "runtime",
          );
    let previousLockRef: string | undefined;
    if (previous !== undefined) {
      const previousHash = sha256Json(previous as unknown as JsonValue);
      previousLockRef = join(".apex", "customization-bases", "locks", `${previousHash}.json`);
      const previousLockDestination = join(this.root, previousLockRef);
      if (!(await this.pathExistsLstat(previousLockDestination))) {
        const stagedPreviousLock = join(transactionRoot, "previous-lock.json");
        await atomicWriteJson(stagedPreviousLock, previous);
        entries.push({ destination: previousLockDestination, staged: stagedPreviousLock, existed: false });
      }
    }
    const nextLock = {
      version: 1,
      source,
      runtime,
      files: managed,
      ...(previousLockRef === undefined ? {} : { previousLockRef }),
    } satisfies CustomizationLock;
    const stagedLock = join(transactionRoot, "customizations.lock.json");
    await atomicWriteJson(stagedLock, nextLock);
    const lockExisted = await this.pathExistsLstat(lockPath);
    const lockBackup = lockExisted ? join(transactionRoot, "backup", "customizations.lock.json") : undefined;
    if (lockBackup !== undefined) await atomicWriteBytes(lockBackup, await readFile(lockPath));
    entries.push({
      destination: lockPath,
      staged: stagedLock,
      ...(lockBackup === undefined ? {} : { backup: lockBackup }),
      existed: lockExisted,
    });
    const transactionPath = join(transactionRoot, "transaction.json");
    await atomicWriteJson(transactionPath, {
      version: 1,
      status: "applying",
      entries,
    } satisfies CustomizationTransaction);
    await atomicWriteJson(join(this.root, ".apex", "local", "customization-transaction.json"), { transactionPath });
    try {
      for (const [index, entry] of entries.entries()) {
        await this.customizationFailureInjector?.(index, entry.destination);
        if (entry.remove) await rm(entry.destination, { force: true });
        else {
          await mkdir(resolve(entry.destination, ".."), { recursive: true });
          await rename(entry.staged!, entry.destination);
        }
      }
      await rm(join(this.root, ".apex", "local", "customization-transaction.json"), { force: true });
      await rm(transactionRoot, { recursive: true, force: true });
      return managed.map(({ path }) => path);
    } catch (error) {
      await this.rollbackCustomizationTransaction({ version: 1, status: "applying", entries });
      await rm(join(this.root, ".apex", "local", "customization-transaction.json"), { force: true });
      await rm(transactionRoot, { recursive: true, force: true });
      throw error;
    }
  }

  private async installCapabilityAssets(assets: Awaited<ReturnType<typeof resolveBundledAssets>>): Promise<void> {
    const runtimeRoot = join(this.root, ".apex", "runtime");
    const destination = join(runtimeRoot, "capability-packs");
    await this.assertSafeExistingPath(assets.capabilityPacks, assets.capabilityPacks);
    await rm(destination, { recursive: true, force: true });
    await cp(assets.capabilityPacks, destination, {
      recursive: true,
      dereference: false,
      errorOnExist: true,
      force: false,
    });
    await rename(join(destination, "registry.v1.json"), join(runtimeRoot, "capability-packs.registry.json"));
  }

  private async recoverCustomizationTransaction(): Promise<void> {
    const pointer = join(this.root, ".apex", "local", "customization-transaction.json");
    try {
      const { transactionPath } = JSON.parse(await readFile(pointer, "utf8")) as { transactionPath: string };
      const transaction = JSON.parse(await readFile(transactionPath, "utf8")) as CustomizationTransaction;
      await this.rollbackCustomizationTransaction(transaction);
      await rm(resolve(transactionPath, ".."), { recursive: true, force: true });
      await rm(pointer, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private async rollbackCustomizationTransaction(transaction: CustomizationTransaction): Promise<void> {
    for (const entry of [...transaction.entries].reverse()) {
      if (entry.existed && entry.backup !== undefined && (await this.pathExistsLstat(entry.backup)))
        await atomicWriteBytes(entry.destination, await readFile(entry.backup));
      else if (!entry.existed) await rm(entry.destination, { force: true });
    }
  }

  private mergeText(base: Buffer, local: Buffer, incoming: Buffer): Buffer | undefined {
    if ([base, local, incoming].some((value) => value.includes(0))) return undefined;
    const baseText = base.toString("utf8");
    const localText = local.toString("utf8");
    const incomingText = incoming.toString("utf8");
    if (localText === baseText) return incoming;
    if (incomingText === baseText) return local;
    const baseLines = baseText.split("\n");
    const localLines = localText.split("\n");
    const incomingLines = incomingText.split("\n");
    if (baseLines.length !== localLines.length || baseLines.length !== incomingLines.length) return undefined;
    const merged = baseLines.map((line, index) => {
      const localLine = localLines[index]!;
      const incomingLine = incomingLines[index]!;
      if (localLine !== line && incomingLine !== line && localLine !== incomingLine) return undefined;
      return localLine !== line ? localLine : incomingLine;
    });
    return merged.includes(undefined) ? undefined : Buffer.from(merged.join("\n"));
  }

  private async assertSafeDestination(root: string, destination: string): Promise<void> {
    const resolvedRoot = resolve(root);
    const resolvedDestination = resolve(destination);
    if (resolvedDestination !== resolvedRoot && !resolvedDestination.startsWith(`${resolvedRoot}${sep}`))
      throw new ApexError("APEX_VALIDATION", "Managed destination escapes its root", EXIT_CODES.validation);
    let current = resolvedRoot;
    if (await this.pathExistsLstat(current)) await this.assertSafeExistingPath(resolvedRoot, current);
    for (const segment of relative(resolvedRoot, resolvedDestination).split(sep)) {
      if (!segment) continue;
      current = join(current, segment);
      if (await this.pathExistsLstat(current)) await this.assertSafeExistingPath(resolvedRoot, current);
    }
  }

  private async assertSafeExistingPath(root: string, path: string): Promise<void> {
    const entry = await lstat(path);
    if (entry.isSymbolicLink())
      throw new ApexError("APEX_VALIDATION", `Managed path contains a symlink: ${path}`, EXIT_CODES.validation);
    const actual = await realpath(path);
    const actualRoot = await realpath(root);
    if (actual !== actualRoot && !actual.startsWith(`${actualRoot}${sep}`))
      throw new ApexError("APEX_VALIDATION", `Managed path escapes its root: ${path}`, EXIT_CODES.validation);
  }

  private async pathExistsLstat(path: string): Promise<boolean> {
    try {
      await lstat(path);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  private async readOptional(path: string): Promise<Buffer | undefined> {
    try {
      return await readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  private async walkFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new ApexError(
          "APEX_VALIDATION",
          `Customization source contains a symlink: ${path}`,
          EXIT_CODES.validation,
        );
      if (entry.isDirectory()) files.push(...(await this.walkFiles(path)));
      else if (entry.isFile()) files.push(path);
    }
    return files;
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
}
