#!/usr/bin/env node
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { NativeBicepProvider, NativeTerraformProvider, ProcessRunner, type IacProvider } from "@apex/capabilities";
import type { QualityScorecardV1 } from "@apex/contracts";
import { EventJournal, atomicWriteJson, sha256Bytes, sha256Json } from "@apex/kernel";
import { evaluateQualityScorecard, renderQualityScorecardEvaluation, type ScorecardMeasurement } from "@apex/renderers";
import { join, resolve } from "node:path";
import { ApexError, EXIT_CODES, normalizeError } from "./errors.js";
import { resolveBundledAssets } from "./assets.js";
import { serveMcp } from "./mcp.js";
import { ApexService, type ArtifactKind, type TaskOutput } from "./service.js";

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
      iacTool: string;
      runtimeLockHash: string;
      ownerEpoch: number;
    };
    const journal = new EventJournal(join(runDirectory, "journal"));
    const events = await journal.replay();
    const artifacts = events.reduce<Record<string, string>>((current, event) => {
      if (event.type !== "task.completed") return current;
      const hashes = (event.payload as { artifactHashes?: Record<string, unknown> }).artifactHashes ?? {};
      for (const [kind, hash] of Object.entries(hashes)) if (typeof hash === "string") current[kind] = hash;
      return current;
    }, {});
    const dependencyRevision = sha256Json({
      projectId: run.projectId,
      runId: run.runId,
      targetScope: run.targetScope,
      iacTool: run.iacTool,
      runtimeLockHash: run.runtimeLockHash,
      ownerEpoch: run.ownerEpoch,
      artifacts,
    });
    return { head: dependencyRevision, dependencyRevision, ownerEpoch: run.ownerEpoch, recipientIdentity: "local" };
  };
  const providers: Partial<Record<"bicep" | "terraform", IacProvider>> = {};
  if (config.bicep !== undefined) {
    const value = config.bicep;
    for (const key of ["resourceGroup", "deploymentName", "stackName", "templateFile"] as const) {
      if (typeof value[key] !== "string" || value[key].length === 0)
        throw new ApexError("APEX_USAGE", `Bicep provider config requires ${key}`, EXIT_CODES.usage);
    }
    providers.bicep = new NativeBicepProvider({
      runner,
      currentAuthority,
      target: {
        resourceGroup: value.resourceGroup,
        deploymentName: value.deploymentName,
        stackName: value.stackName,
        templateFile: value.templateFile,
        actionOnUnmanage: value.actionOnUnmanage ?? "deleteResources",
        denySettingsMode: value.denySettingsMode ?? "denyDelete",
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
    providers.terraform = new NativeTerraformProvider({
      runner,
      currentAuthority,
      target: {
        cwd: value.cwd,
        target: value.target,
        lockfileHash: value.lockfileHash,
        configHash: async () =>
          value.configHash ?? sha256Bytes(await readFile(join(resolve(root, value.cwd), ".terraform.lock.hcl"))),
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

async function evaluateQuality(root: string, flags: Flags): Promise<QualityEvaluationArtifact> {
  const assets = await resolveBundledAssets();
  const scorecardPath =
    typeof flags.scorecard === "string" ? resolve(flags.scorecard) : join(assets.config, "quality-scorecard.v1.json");
  const measurementPath = resolve(required(flags, "measurements"));
  const scorecard = JSON.parse(await readFile(scorecardPath, "utf8")) as QualityScorecardV1;
  const measurementInput = JSON.parse(await readFile(measurementPath, "utf8")) as
    readonly ScorecardMeasurement[] | { measurements?: readonly ScorecardMeasurement[] };
  const measurements = Array.isArray(measurementInput)
    ? measurementInput
    : (measurementInput as { measurements?: readonly ScorecardMeasurement[] }).measurements;
  if (!Array.isArray(measurements))
    throw new ApexError("APEX_USAGE", "Measurements file must be an array or contain measurements[]", EXIT_CODES.usage);
  const evaluations = evaluateQualityScorecard(scorecard, measurements);
  const artifact: QualityEvaluationArtifact = {
    schemaVersion: "1.0.0",
    scorecardHash: sha256Json(scorecard),
    measurementsHash: sha256Json(measurements),
    status: evaluations.some(({ decision }) => decision === "fail") ? "fail" : "pass",
    evaluations,
  };
  const outputDirectory = join(root, ".apex", "quality");
  await mkdir(outputDirectory, { recursive: true });
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
    case "gate decide":
      return service.decideGateNumber(
        Number(required(flags, "gate")),
        required(flags, "decision") as "approved" | "rejected",
        required(flags, "actor"),
      );
    case "validate":
      return service.validate();
    case "preview":
      return service.preview({
        operation: required(flags, "operation") as "apply" | "destroy",
        provider: required(flags, "provider") as "fake" | "bicep" | "terraform",
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
