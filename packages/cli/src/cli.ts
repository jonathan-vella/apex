#!/usr/bin/env node
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { NativeBicepProvider, NativeTerraformProvider, ProcessRunner, type IacProvider } from "@apex/capabilities";
import { QualityMeasurementsV1Schema, type QualityMeasurementsV1, type QualityScorecardV1 } from "@apex/contracts";
import { EventJournal, ValidatorRegistry, WriterTransferStore, atomicWriteJson, sha256Json } from "@apex/kernel";
import { evaluateQualityScorecard, renderQualityScorecardEvaluation, type ScorecardMeasurement } from "@apex/renderers";
import { join, resolve } from "node:path";
import { ApexError, EXIT_CODES, normalizeError } from "./errors.js";
import { dependencyRevision as calculateDependencyRevision } from "./dependency-revision.js";
import { githubApprovalContext } from "./github-approval.js";
import { resolveBundledAssets } from "./assets.js";
import { serveMcp } from "./mcp.js";
import { createFileProviderRuntime, hashTerraformConfiguration, hashTerraformLockFile } from "./provider-runtime.js";
import { exportProviderTransfer, importProviderTransfer } from "./provider-transfer.js";
import { ApexService, type ArtifactKind, type TaskOutput } from "./service.js";
import { exportStateTransfer, importStateTransfer } from "./state-transfer.js";

type FlagValue = string | string[] | boolean;
type Flags = Record<string, FlagValue>;

function addFlag(flags: Flags, name: string, value: string | boolean): void {
  const current = flags[name];
  if (current === undefined) flags[name] = value;
  else if (typeof current === "string" && typeof value === "string") flags[name] = [current, value];
  else if (Array.isArray(current) && typeof value === "string") current.push(value);
  else flags[name] = value;
}

function parse(argv: string[]): { words: string[]; flags: Flags } {
  const words: string[] = [];
  const flags: Flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]!;
    if (!item.startsWith("--")) {
      words.push(item);
      continue;
    }
    const [name, inline] = item.slice(2).split("=", 2);
    if (inline !== undefined) addFlag(flags, name!, inline);
    else if (argv[index + 1] !== undefined && !argv[index + 1]!.startsWith("--")) addFlag(flags, name!, argv[++index]!);
    else addFlag(flags, name!, true);
  }
  return { words, flags };
}

function required(flags: Flags, name: string): string {
  const value = flags[name];
  if (typeof value !== "string") throw new ApexError("APEX_USAGE", `Missing --${name}`, EXIT_CODES.usage);
  return value;
}

function confirmed(flags: Flags, command: string): void {
  if (flags.yes !== true) throw new ApexError("APEX_USAGE", `${command} requires --yes`, EXIT_CODES.usage);
}

async function inputJson(flags: Flags): Promise<unknown> {
  return JSON.parse(await readFile(required(flags, "file"), "utf8")) as unknown;
}

interface NativeProviderConfig {
  bicep?: {
    resourceGroup: string;
    deploymentName: string;
    stackName: string;
    templateFile: string;
    parametersFile?: string;
    cwd?: string;
    actionOnUnmanage?: "deleteAll" | "deleteResources" | "detachAll";
    denySettingsMode?: "denyDelete" | "denyWriteAndDelete" | "none";
    ownershipAuthorizesDeleteResources?: boolean;
    dedicatedSandboxResourceGroup?: boolean;
    allowDeleteAll?: boolean;
  };
  terraform?: {
    cwd: string;
    target: string;
    planDirectory: string;
    lockfileHash: string;
    configHash?: string;
  };
}

async function configuredProviders(
  root: string,
  flags: Flags,
): Promise<Partial<Record<"bicep" | "terraform", IacProvider>>> {
  const persistedPath = join(root, ".apex", "provider-config.json");
  const explicitPath = typeof flags["provider-config"] === "string" ? resolve(flags["provider-config"]) : undefined;
  let config: NativeProviderConfig;
  try {
    config = JSON.parse(await readFile(explicitPath ?? persistedPath, "utf8")) as NativeProviderConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
  assertSecretFreeConfig(config);
  if (explicitPath !== undefined) {
    await mkdir(join(root, ".apex"), { recursive: true });
    await atomicWriteJson(persistedPath, config);
  }
  const runner = new ProcessRunner();
  let providerRuntime: Awaited<ReturnType<typeof createFileProviderRuntime>> | undefined;
  const runtime = async () => (providerRuntime ??= await createFileProviderRuntime(root));
  const currentAuthority = async () => {
    const selection = JSON.parse(await readFile(join(root, ".apex", "config.json"), "utf8")) as {
      projectId: string;
      runId: string;
    };
    const runDirectory = join(root, ".apex", "projects", selection.projectId, "runs", selection.runId);
    const run = JSON.parse(await readFile(join(runDirectory, "run.json"), "utf8")) as {
      projectId: string;
      runId: string;
      targetScope: string;
      iacTool: "bicep" | "terraform";
      runtimeLockHash: string;
      ownerEpoch: number;
    };
    const journal = new EventJournal(join(runDirectory, "journal"));
    const events = await journal.replay();
    const dependencyRevision = calculateDependencyRevision(run, events);
    let recipientIdentity = "local";
    let previousOwnerEpoch: number | undefined;
    let writerTransferClaimHash: string | undefined;
    try {
      const ownership = await new WriterTransferStore(runDirectory).currentActiveOwnership();
      if (ownership === null)
        return { head: dependencyRevision, dependencyRevision, ownerEpoch: run.ownerEpoch, recipientIdentity };
      if (ownership.ownerEpoch === run.ownerEpoch && typeof ownership.ownerId === "string") {
        recipientIdentity = ownership.ownerId;
        if (
          typeof ownership.previousOwnerEpoch === "number" &&
          ownership.previousOwnerEpoch + 1 === run.ownerEpoch &&
          typeof ownership.claimHash === "string" &&
          /^[0-9a-f]{64}$/.test(ownership.claimHash)
        ) {
          previousOwnerEpoch = ownership.previousOwnerEpoch;
          writerTransferClaimHash = ownership.claimHash;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return {
      head: dependencyRevision,
      dependencyRevision,
      ownerEpoch: run.ownerEpoch,
      ...(previousOwnerEpoch === undefined || writerTransferClaimHash === undefined
        ? {}
        : { previousOwnerEpoch, writerTransferClaimHash }),
      recipientIdentity,
    };
  };
  const providers: Partial<Record<"bicep" | "terraform", IacProvider>> = {};
  if (config.bicep !== undefined) {
    const value = config.bicep;
    for (const key of ["resourceGroup", "deploymentName", "stackName", "templateFile"] as const) {
      if (typeof value[key] !== "string" || value[key].length === 0)
        throw new ApexError("APEX_USAGE", `Bicep provider config requires ${key}`, EXIT_CODES.usage);
    }
    const localRuntime = await runtime();
    providers.bicep = new NativeBicepProvider({
      runner,
      currentAuthority,
      bindingStore: localRuntime.bindingStores.bicep,
      target: {
        resourceGroup: value.resourceGroup,
        deploymentName: value.deploymentName,
        stackName: value.stackName,
        templateFile: value.templateFile,
        actionOnUnmanage: value.actionOnUnmanage ?? "detachAll",
        denySettingsMode: value.denySettingsMode ?? "denyDelete",
        ...(value.ownershipAuthorizesDeleteResources === undefined
          ? {}
          : { ownershipAuthorizesDeleteResources: value.ownershipAuthorizesDeleteResources }),
        ...(value.dedicatedSandboxResourceGroup === undefined
          ? {}
          : { dedicatedSandboxResourceGroup: value.dedicatedSandboxResourceGroup }),
        ...(value.allowDeleteAll === undefined ? {} : { allowDeleteAll: value.allowDeleteAll }),
        ...(value.parametersFile === undefined ? {} : { parametersFile: value.parametersFile }),
        ...(value.cwd === undefined ? {} : { cwd: value.cwd }),
      },
    });
  }
  if (config.terraform !== undefined) {
    const value = config.terraform;
    for (const key of ["cwd", "target", "planDirectory", "lockfileHash"] as const) {
      if (typeof value[key] !== "string" || value[key].length === 0)
        throw new ApexError("APEX_USAGE", `Terraform provider config requires ${key}`, EXIT_CODES.usage);
    }
    const localRuntime = await runtime();
    const terraformRoot = resolve(root, value.cwd);
    const actualLockfileHash = await hashTerraformLockFile(terraformRoot);
    if (actualLockfileHash !== value.lockfileHash) {
      throw new ApexError(
        "APEX_STALE",
        `Terraform lockfileHash is stale: expected ${value.lockfileHash}, found ${actualLockfileHash}`,
        EXIT_CODES.stale,
      );
    }
    const configHash = async () => {
      const actual = await hashTerraformConfiguration(terraformRoot);
      if (value.configHash !== undefined && value.configHash !== actual) {
        throw new ApexError(
          "APEX_STALE",
          `Terraform configHash is stale: expected ${value.configHash}, found ${actual}`,
          EXIT_CODES.stale,
        );
      }
      return actual;
    };
    providers.terraform = new NativeTerraformProvider({
      runner,
      currentAuthority,
      bindingStore: localRuntime.bindingStores.terraform,
      artifactStore: localRuntime.artifactStore,
      keyProvider: localRuntime.keyProvider,
      target: {
        cwd: value.cwd,
        target: value.target,
        lockfileHash: actualLockfileHash,
        configHash,
        planPath: (request, operation) => join(value.planDirectory, `${request.runId}-${operation}.tfplan`),
      },
    });
  }
  return providers;
}

function assertSecretFreeConfig(value: unknown, path = "provider-config"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSecretFreeConfig(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (/secret|password|token|credential|api[-_]?key|private[-_]?key|access[-_]?key/i.test(key)) {
      throw new ApexError(
        "APEX_VALIDATION",
        `Provider config must not contain secret key '${path}.${key}'`,
        EXIT_CODES.validation,
      );
    }
    assertSecretFreeConfig(item, `${path}.${key}`);
  }
}

function files(flags: Flags): string[] {
  const value = flags.file;
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.length > 0) return value;
  throw new ApexError("APEX_USAGE", "Missing --file", EXIT_CODES.usage);
}

interface QualityEvaluationArtifact {
  readonly schemaVersion: "1.0.0";
  readonly scorecardHash: string;
  readonly measurementsHash: string;
  readonly status: "pass" | "fail";
  readonly evaluations: ReturnType<typeof evaluateQualityScorecard>;
}

type QualityMeasurementInput = ScorecardMeasurement & {
  evidenceRefs?: readonly string[];
  provenance?: { inputReportHashes?: readonly string[] };
};

async function evaluateQuality(root: string, flags: Flags): Promise<QualityEvaluationArtifact> {
  const assets = await resolveBundledAssets();
  const scorecardPath =
    typeof flags.scorecard === "string" ? resolve(flags.scorecard) : join(assets.config, "quality-scorecard.v1.json");
  const measurementPath = resolve(required(flags, "measurements"));
  const scorecard = JSON.parse(await readFile(scorecardPath, "utf8")) as QualityScorecardV1;
  const measurementInput = JSON.parse(await readFile(measurementPath, "utf8")) as unknown;
  const inputMeasurements: readonly QualityMeasurementInput[] | undefined = Array.isArray(measurementInput)
    ? (measurementInput as QualityMeasurementInput[])
    : measurementInput !== null && typeof measurementInput === "object"
      ? (measurementInput as { measurements?: readonly QualityMeasurementInput[] }).measurements
      : undefined;
  if (inputMeasurements === undefined)
    throw new ApexError("APEX_USAGE", "Measurements file must be an array or contain measurements[]", EXIT_CODES.usage);
  const measurements = inputMeasurements
    .map((measurement) => ({
      metric: measurement.metric,
      scenario: measurement.scenario,
      ...(measurement.value === undefined ? {} : { value: measurement.value }),
      samples: measurement.samples,
      evidenceRefs: [
        ...new Set(
          (measurement.evidenceRefs ?? measurement.provenance?.inputReportHashes ?? []).filter(
            (reference): reference is string => typeof reference === "string",
          ),
        ),
      ].sort(),
    }))
    .sort((left, right) =>
      `${left.metric}\u0000${left.scenario}`.localeCompare(`${right.metric}\u0000${right.scenario}`),
    );
  const measurementSet: QualityMeasurementsV1 = { schemaVersion: "1.0.0", measurements };
  const measurementRegistry = new ValidatorRegistry();
  measurementRegistry.register("quality-measurements", QualityMeasurementsV1Schema);
  const measurementValidation = measurementRegistry.validate("quality-measurements", measurementSet);
  if (!measurementValidation.valid)
    throw new ApexError(
      "APEX_VALIDATION",
      "Quality measurements validation failed",
      EXIT_CODES.validation,
      measurementValidation.issues,
    );
  const keys = measurements.map(({ metric, scenario }) => `${metric}\u0000${scenario}`);
  if (new Set(keys).size !== keys.length)
    throw new ApexError(
      "APEX_VALIDATION",
      "Quality measurements contain duplicate metric/scenario pairs",
      EXIT_CODES.validation,
    );
  const evaluations = evaluateQualityScorecard(scorecard, measurements);
  const artifact: QualityEvaluationArtifact = {
    schemaVersion: "1.0.0",
    scorecardHash: sha256Json(scorecard),
    measurementsHash: sha256Json(measurementSet),
    status:
      evaluations.some(({ decision }) => decision === "fail") ||
      !evaluations.some(({ decision }) => decision === "pass")
        ? "fail"
        : "pass",
    evaluations,
  };
  const outputDirectory = join(root, ".apex", "quality");
  await mkdir(outputDirectory, { recursive: true });
  await atomicWriteJson(join(outputDirectory, "measurements.json"), measurementSet);
  await atomicWriteJson(join(outputDirectory, "evaluation.json"), artifact);
  await writeFile(
    join(outputDirectory, "evaluation.md"),
    `${renderQualityScorecardEvaluation(scorecard, measurements)}\n`,
    "utf8",
  );
  if (artifact.status === "fail")
    throw new ApexError("APEX_VALIDATION", "Quality scorecard evaluation failed", EXIT_CODES.validation, artifact);
  return artifact;
}

async function qualityStatus(root: string): Promise<QualityEvaluationArtifact> {
  try {
    return JSON.parse(
      await readFile(join(root, ".apex", "quality", "evaluation.json"), "utf8"),
    ) as QualityEvaluationArtifact;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new ApexError("APEX_VALIDATION", "No quality evaluation is available", EXIT_CODES.validation);
    throw error;
  }
}

export async function execute(argv: string[], root = process.cwd()): Promise<unknown> {
  const { words, flags } = parse(argv);
  const command = words.join(" ");
  const runner = new ProcessRunner();
  const service = new ApexService(root, {
    providers: await configuredProviders(root, flags),
    azureAuthStatus: async (live) => {
      if (!live || command !== "setup") return { authenticated: false, detail: "not-checked; run setup --live" };
      try {
        const result = await runner.run({
          executable: "az",
          args: ["account", "show", "--output", "json"],
          timeoutMs: 15_000,
          maxOutputBytes: 64 * 1024,
        });
        const account = JSON.parse(result.stdout) as { id?: unknown; tenantId?: unknown };
        return {
          authenticated: typeof account.id === "string",
          detail: typeof account.tenantId === "string" ? `tenant:${account.tenantId}` : "authenticated",
        };
      } catch {
        return { authenticated: false, detail: "Azure CLI is not authenticated" };
      }
    },
  });
  switch (command) {
    case "version": {
      const assets = await resolveBundledAssets();
      return {
        version: "0.1.0",
        bundleVersion: assets.manifest.sources.customizations,
        configVersion: assets.manifest.sources.config,
      };
    }
    case "init":
      return service.init({
        projectId: required(flags, "project") as never,
        ...(typeof flags.name === "string" ? { displayName: flags.name } : {}),
        ...(typeof flags.environment === "string" ? { environment: flags.environment } : {}),
        ...(typeof flags.target === "string" ? { targetScope: flags.target } : {}),
        iacTool: flags.iac === "terraform" ? "terraform" : "bicep",
        ...(typeof flags["customizations-source"] === "string"
          ? { customizationsSource: flags["customizations-source"] }
          : {}),
      });
    case "update":
      return service.update(
        typeof flags["customizations-source"] === "string" ? flags["customizations-source"] : undefined,
      );
    case "setup":
      return service.setup(flags.live === true);
    case "doctor":
      return service.doctor(flags.fix === true, flags.yes === true, false);
    case "capability list":
      return service.capabilityList(typeof flags.manifest === "string" ? flags.manifest : undefined);
    case "capability status":
      return service.capabilityStatus(
        required(flags, "pack"),
        typeof flags.manifest === "string" ? flags.manifest : undefined,
      );
    case "capability install":
      confirmed(flags, "capability install");
      return service.capabilityInstall(
        required(flags, "pack"),
        typeof flags.manifest === "string" ? flags.manifest : undefined,
        { cacheDeno: flags.cache === true },
      );
    case "capability update":
      confirmed(flags, "capability update");
      return service.capabilityUpdate(
        required(flags, "pack"),
        typeof flags.manifest === "string" ? flags.manifest : undefined,
        { cacheDeno: flags.cache === true },
      );
    case "capability rollback":
      confirmed(flags, "capability rollback");
      return service.capabilityRollback(
        required(flags, "pack"),
        typeof flags.manifest === "string" ? flags.manifest : undefined,
      );
    case "capability verify":
      return service.capabilityVerify(
        required(flags, "pack"),
        typeof flags.manifest === "string" ? flags.manifest : undefined,
      );
    case "capability uninstall":
      confirmed(flags, "capability uninstall");
      return service.capabilityUninstall(
        required(flags, "pack"),
        typeof flags.manifest === "string" ? flags.manifest : undefined,
      );
    case "project list":
      return service.listProjects();
    case "project use":
      return service.use(
        required(flags, "project") as never,
        typeof flags.run === "string" ? (flags.run as never) : undefined,
      );
    case "project show":
      return service.show(typeof flags.project === "string" ? (flags.project as never) : undefined);
    case "project search":
      return service.search(required(flags, "query"));
    case "project history":
      return service.history(typeof flags.limit === "string" ? Number(flags.limit) : undefined);
    case "state transfer-export": {
      confirmed(flags, "state transfer-export");
      const ttlSeconds = Number(required(flags, "ttl-seconds"));
      if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
        throw new ApexError("APEX_USAGE", "--ttl-seconds must be a positive integer", EXIT_CODES.usage);
      }
      const runtime = await createFileProviderRuntime(root);
      return exportStateTransfer(
        root,
        required(flags, "file"),
        {
          claimHash: required(flags, "claim"),
          recipient: required(flags, "recipient"),
          ttlMs: ttlSeconds * 1_000,
        },
        { key: await runtime.keyProvider() },
      );
    }
    case "state transfer-import": {
      confirmed(flags, "state transfer-import");
      const runtime = await createFileProviderRuntime(root);
      return importStateTransfer(
        root,
        JSON.parse(await readFile(required(flags, "file"), "utf8")) as unknown,
        required(flags, "recipient"),
        await runtime.keyProvider(),
      );
    }
    case "provider transfer-export": {
      confirmed(flags, "provider transfer-export");
      const ttlSeconds = Number(required(flags, "ttl-seconds"));
      if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
        throw new ApexError("APEX_USAGE", "--ttl-seconds must be a positive integer", EXIT_CODES.usage);
      }
      const provider = required(flags, "provider");
      if (provider !== "bicep" && provider !== "terraform") {
        throw new ApexError("APEX_USAGE", "--provider must be bicep or terraform", EXIT_CODES.usage);
      }
      const runtime = await createFileProviderRuntime(root);
      return exportProviderTransfer(
        root,
        required(flags, "file"),
        {
          previewHash: required(flags, "preview"),
          provider,
          recipient: required(flags, "recipient"),
          ttlMs: ttlSeconds * 1_000,
        },
        { key: await runtime.keyProvider() },
      );
    }
    case "provider transfer-import": {
      confirmed(flags, "provider transfer-import");
      const runtime = await createFileProviderRuntime(root);
      return importProviderTransfer(
        root,
        JSON.parse(await readFile(required(flags, "file"), "utf8")) as unknown,
        required(flags, "recipient"),
        await runtime.keyProvider(),
      );
    }
    case "status":
      return service.status();
    case "task next":
      return service.nextTask();
    case "task context":
      return service.taskContext(required(flags, "task"));
    case "task complete": {
      const paths = files(flags);
      if (paths.length > 1) {
        const outputs = await Promise.all(
          paths.map(async (path) => JSON.parse(await readFile(path, "utf8")) as TaskOutput),
        );
        return service.completeTaskOutputs(required(flags, "task"), outputs);
      }
      return service.completeTask(required(flags, "task"), {
        kind: required(flags, "kind") as ArtifactKind,
        value: JSON.parse(await readFile(paths[0]!, "utf8")) as unknown,
        ...(typeof flags.summary === "string" ? { summary: flags.summary } : {}),
      });
    }
    case "task complete-bundle": {
      const bundle = (await inputJson(flags)) as { taskId?: string; outputs?: TaskOutput[] } | TaskOutput[];
      const outputs = Array.isArray(bundle) ? bundle : bundle.outputs;
      if (!Array.isArray(outputs))
        throw new ApexError("APEX_USAGE", "Bundle file must contain outputs[]", EXIT_CODES.usage);
      const taskId = Array.isArray(bundle) ? required(flags, "task") : (bundle.taskId ?? required(flags, "task"));
      return service.completeTaskOutputs(taskId, outputs);
    }
    case "task cancel":
      return service.cancelTask(required(flags, "task"));
    case "task stage-file":
      return service.stageFile(
        required(flags, "task"),
        required(flags, "path"),
        await readFile(required(flags, "file")),
        typeof flags.sha === "string" ? flags.sha : undefined,
      );
    case "task generate-iac":
      return service.generateIac(required(flags, "task"));
    case "review resolve":
      return service.resolveReview(JSON.parse(await readFile(required(flags, "file"), "utf8")));
    case "gate decide": {
      const mechanism = flags.mechanism ?? "tty";
      if (mechanism !== "tty" && mechanism !== "github-environment") {
        throw new ApexError("APEX_USAGE", "--mechanism must be tty or github-environment", EXIT_CODES.usage);
      }
      if (mechanism === "tty") {
        return service.decideGateNumber(
          Number(required(flags, "gate")),
          required(flags, "decision") as "approved" | "rejected",
          required(flags, "actor"),
        );
      }
      if (flags.actor !== undefined) {
        throw new ApexError("APEX_USAGE", "--actor is not accepted for github-environment", EXIT_CODES.usage);
      }
      const githubContext = githubApprovalContext(process.env);
      return service.decideGateNumber(
        Number(required(flags, "gate")),
        required(flags, "decision") as "approved" | "rejected",
        `github:${githubContext.actorId}:${githubContext.actor}`,
        { mechanism, githubContext },
      );
    }
    case "validate":
      return service.validate();
    case "preview":
      if (flags.recipient === true || Array.isArray(flags.recipient) || flags.recipient === "") {
        throw new ApexError("APEX_USAGE", "--recipient must be a nonempty identity", EXIT_CODES.usage);
      }
      return service.preview({
        operation: required(flags, "operation") as "apply" | "destroy",
        provider: required(flags, "provider") as "fake" | "bicep" | "terraform",
        ...(typeof flags.recipient === "string" && flags.recipient.length > 0
          ? { recipientIdentity: flags.recipient }
          : {}),
      });
    case "deploy":
      return service.deploy(typeof flags.preview === "string" ? flags.preview : undefined);
    case "reconcile":
      return service.reconcile();
    case "inventory":
      return service.inventory();
    case "diagnose":
      return service.diagnose();
    case "render":
      return service.render(required(flags, "kind") as never);
    case "promote":
      return service.promote(required(flags, "environment"), required(flags, "target"));
    case "customizations rollback":
      return service.rollbackCustomizations();
    case "customizations uninstall":
      return service.uninstallCustomizations();
    case "writer transfer-create":
      return service.createWriterTransfer({
        repository: required(flags, "repo"),
        branch: required(flags, "branch"),
        commit: required(flags, "commit"),
        workflowId: required(flags, "workflow"),
        sender: required(flags, "sender"),
        recipient: required(flags, "recipient"),
        ...(typeof flags.environment === "string" ? { approvalEnvironment: flags.environment } : {}),
        currentHead: required(flags, "head"),
        ttlMs: Number(required(flags, "ttl")),
      });
    case "writer transfer-accept":
      return service.acceptWriterTransfer(
        required(flags, "claim"),
        required(flags, "recipient"),
        required(flags, "head"),
      );
    case "writer show":
      return service.currentWriter();
    case "evidence accept":
      return service.acceptEvidence({
        kind: required(flags, "kind"),
        contentType: required(flags, "content-type"),
        ...(typeof flags.file === "string"
          ? { file: flags.file }
          : { value: JSON.parse(required(flags, "value")) as never }),
        required: flags.required === true,
      });
    case "telemetry consent":
      return service.setTelemetryConsent(required(flags, "value") === "true");
    case "telemetry export":
      return service.exportTelemetry();
    case "telemetry delete":
      return service.deleteTelemetry();
    case "cache status":
      return service.cacheStatus();
    case "cache clear":
      return service.clearCache();
    case "quality evaluate":
      return evaluateQuality(root, flags);
    case "quality status":
      return qualityStatus(root);
    case "mcp serve":
      await serveMcp(service);
      return undefined;
    default:
      throw new ApexError("APEX_USAGE", `Unknown command: ${command || "<none>"}`, EXIT_CODES.usage);
  }
}

async function main(): Promise<void> {
  const json = process.argv.includes("--json");
  try {
    const result = await execute(process.argv.slice(2));
    if (result !== undefined)
      process.stdout.write(
        json
          ? `${JSON.stringify({ ok: true, result })}\n`
          : `${typeof result === "string" ? result : JSON.stringify(result, null, 2)}\n`,
      );
  } catch (error) {
    const normalized = normalizeError(error);
    const value = {
      ok: false,
      error: { code: normalized.code, message: normalized.message, details: normalized.details },
    };
    process.stderr.write(json ? `${JSON.stringify(value)}\n` : `${normalized.code}: ${normalized.message}\n`);
    process.exitCode = normalized.exitCode;
  }
}

if (process.argv[1] !== undefined && (await realpath(process.argv[1])) === (await realpath(new URL(import.meta.url))))
  await main();
