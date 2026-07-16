import { createHash, randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type {
  ApprovalEvidenceV1,
  DeploymentPreviewV1,
  ExecutionPlanAttestationV1,
  OperationRecordV1,
  ResourceInventoryV1,
} from "@apex/contracts";
import {
  BicepCommandAdapter,
  TerraformCommandAdapter,
  type BicepStackTarget,
  type CommandPlan,
  type ResolvedBicepStackTarget,
} from "./command-plans.js";
import {
  authorizeDeploymentPreview,
  IacProviderError,
  sha256,
  type CurrentDeploymentAuthority,
  type IacProvider,
  type ProviderExecutionEvidence,
  type PreviewRequest,
} from "./iac.js";
import {
  normalizeAzureStackResources,
  normalizeAzureWhatIf,
  normalizeTerraformPlan,
  parseJsonProcessOutput,
  selectAzureDeploymentStack,
} from "./iac-normalizers.js";
import type { ProcessRunnerLike } from "./process-runner.js";
import { secretFreeProperties } from "./secret-redaction.js";
import { LocalEncryptedPlanTransport, type LocalEncryptedPlan } from "./local-plan-transport.js";

export interface NativeProviderRuntime {
  readonly runner: ProcessRunnerLike;
  readonly currentAuthority: () => Promise<CurrentDeploymentAuthority>;
  readonly now?: () => Date;
  readonly nextId?: () => string;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
  readonly bindingStore?: PreviewBindingStore;
}

export interface PreviewBindingStore {
  save(previewHash: string, binding: PersistedPreviewBinding): Promise<void>;
  load(previewHash: string): Promise<PersistedPreviewBinding | undefined>;
  loadLatest?(
    projectId: string,
    runId: string,
    operation: "apply" | "destroy",
  ): Promise<PersistedPreviewBinding | undefined>;
}

export interface EncryptedPlanArtifactStore {
  put(reference: string, artifact: LocalEncryptedPlan): Promise<void>;
  get(reference: string): Promise<LocalEncryptedPlan | undefined>;
}

export type PersistedPreviewBinding = BicepPreviewBinding | TerraformPreviewBinding;

export interface NativeBicepProviderOptions extends NativeProviderRuntime {
  readonly target: BicepStackTarget;
}

export interface TerraformNativeTarget {
  readonly cwd: string;
  readonly target: string;
  readonly planPath: (request: PreviewRequest, operation: "apply" | "destroy") => string;
  readonly lockfileHash: string;
  readonly configHash: () => Promise<string>;
}

export type TerraformPlanAttestation = ExecutionPlanAttestationV1;

export interface NativeTerraformProviderOptions extends NativeProviderRuntime {
  readonly target: TerraformNativeTarget;
  readonly keyProvider?: () => Promise<Uint8Array>;
  readonly artifactStore?: EncryptedPlanArtifactStore;
  readonly transport?: LocalEncryptedPlanTransport;
}

export interface BicepPreviewBinding {
  readonly kind: "bicep";
  readonly preview: DeploymentPreviewV1;
  readonly providerBindingHash: string;
  readonly templateHash: string;
  readonly parametersHash: string;
  readonly stackStateHash: string;
}

export interface TerraformPreviewBinding {
  readonly kind: "terraform";
  readonly preview: DeploymentPreviewV1;
  readonly attestation: TerraformPlanAttestation;
}

abstract class NativeProviderBase {
  protected readonly runner: ProcessRunnerLike;
  protected readonly now: () => Date;
  protected readonly nextId: () => string;
  protected readonly currentAuthority: () => Promise<CurrentDeploymentAuthority>;
  readonly #timeoutMs: number;
  readonly #maxOutputBytes: number;
  readonly #operations = new Map<string, OperationRecordV1>();
  readonly #executionEvidence = new Map<string, ProviderExecutionEvidence>();
  protected readonly bindingStore: PreviewBindingStore | undefined;

  protected constructor(options: NativeProviderRuntime) {
    this.runner = options.runner;
    this.currentAuthority = options.currentAuthority;
    this.now = options.now ?? (() => new Date());
    this.nextId = options.nextId ?? randomUUID;
    this.#timeoutMs = options.timeoutMs ?? 15 * 60_000;
    this.#maxOutputBytes = options.maxOutputBytes ?? 16 * 1024 * 1024;
    this.bindingStore = options.bindingStore;
  }

  protected async run(plan: CommandPlan): Promise<string> {
    const result = await this.runner.run({
      executable: plan.executable,
      args: plan.args,
      ...(plan.cwd === undefined ? {} : { cwd: plan.cwd }),
      timeoutMs: this.#timeoutMs,
      maxOutputBytes: this.#maxOutputBytes,
    });
    return result.stdout;
  }

  protected async authorize(
    track: "bicep" | "terraform",
    operation: "apply" | "destroy",
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    suppliedAuthority: CurrentDeploymentAuthority,
    latestPreviewHash: string | undefined,
  ): Promise<CurrentDeploymentAuthority> {
    const authority = await this.currentAuthority();
    if (
      authority.head !== suppliedAuthority.head ||
      authority.dependencyRevision !== suppliedAuthority.dependencyRevision ||
      authority.ownerEpoch !== suppliedAuthority.ownerEpoch ||
      authority.previousOwnerEpoch !== suppliedAuthority.previousOwnerEpoch ||
      authority.writerTransferClaimHash !== suppliedAuthority.writerTransferClaimHash ||
      authority.recipientIdentity !== suppliedAuthority.recipientIdentity
    ) {
      throw new IacProviderError("PREVIEW_OWNER_EPOCH_MISMATCH", "Supplied authority is not the current authority");
    }
    authorizeDeploymentPreview({
      operation,
      track,
      preview,
      approval,
      authority,
      now: this.now(),
      ...(latestPreviewHash === undefined ? {} : { latestPreviewHash }),
    });
    return authority;
  }

  protected record(
    operation: "apply" | "destroy",
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    authority: CurrentDeploymentAuthority,
    providerOperationId?: string,
    validatorIds: readonly string[] = [],
  ): OperationRecordV1 {
    const operationId = this.nextId();
    const record: OperationRecordV1 = {
      schemaVersion: "1.0.0",
      operationId,
      projectId: preview.projectId,
      runId: preview.runId,
      ...(providerOperationId === undefined ? {} : { providerOperationId }),
      operation,
      state: "succeeded",
      previewHash: preview.previewHash,
      approvalHash: sha256(approval),
      ownerEpoch: authority.ownerEpoch,
      updatedAt: this.now().toISOString(),
    };
    this.#operations.set(operationId, record);
    this.#executionEvidence.set(operationId, {
      mode: "native",
      operationId,
      previewHash: preview.previewHash,
      validatorIds: [...validatorIds],
    });
    return record;
  }

  async reconcile(operationId: string): Promise<OperationRecordV1 | undefined> {
    return this.#operations.get(operationId);
  }

  executionEvidence(operationId: string): ProviderExecutionEvidence | undefined {
    return this.#executionEvidence.get(operationId);
  }

  protected previewKey(request: PreviewRequest, operation: "apply" | "destroy"): string {
    return `${request.projectId}\u0000${request.runId}\u0000${operation}`;
  }

  protected createPreview(
    track: "bicep" | "terraform",
    operation: "apply" | "destroy",
    request: PreviewRequest,
    normalized: ReturnType<typeof normalizeAzureWhatIf>,
    extra: Partial<Pick<DeploymentPreviewV1, "artifactHash" | "stateLineage" | "stateSerial">> = {},
  ): DeploymentPreviewV1 {
    const createdAt = this.now();
    const base = {
      schemaVersion: "1.0.0" as const,
      projectId: request.projectId,
      runId: request.runId,
      environment: request.environment,
      track,
      operation,
      target: request.target,
      commit: request.commit,
      dependencyRevision: request.dependencyRevision,
      ownerEpoch: request.ownerEpoch,
      inputHash: request.inputHash,
      iacHash: request.iacHash,
      policyHash: request.policyHash,
      ...extra,
      changes: normalized.changes,
      blockers: [...(request.blockers ?? []), ...normalized.blockers],
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + request.ttlMs).toISOString(),
    };
    return { ...base, previewHash: sha256(base) };
  }
}

export class NativeBicepProvider extends NativeProviderBase implements IacProvider {
  readonly track = "bicep" as const;
  readonly #target: ResolvedBicepStackTarget;
  readonly #commands = new BicepCommandAdapter();
  readonly #bindings = new Map<string, BicepPreviewBinding>();

  constructor(options: NativeBicepProviderOptions) {
    super(options);
    const actionOnUnmanage = options.target.actionOnUnmanage ?? "detachAll";
    this.#target = { ...options.target, actionOnUnmanage };
    if (!(["deleteAll", "deleteResources", "detachAll"] as const).includes(this.#target.actionOnUnmanage)) {
      throw new TypeError("Invalid Bicep stack action-on-unmanage");
    }
    if (!(["denyDelete", "denyWriteAndDelete", "none"] as const).includes(this.#target.denySettingsMode)) {
      throw new TypeError("Invalid Bicep stack deny-settings-mode");
    }
    if (actionOnUnmanage === "deleteResources" && options.target.ownershipAuthorizesDeleteResources !== true) {
      throw new TypeError("deleteResources requires an explicit ownership authorization");
    }
    if (
      actionOnUnmanage === "deleteAll" &&
      (options.target.dedicatedSandboxResourceGroup !== true || options.target.allowDeleteAll !== true)
    ) {
      throw new TypeError("deleteAll requires an explicitly authorized dedicated sandbox resource group");
    }
  }

  async validate(): Promise<readonly string[]> {
    await this.run(this.#commands.validate(this.#target.templateFile, this.#target.cwd));
    return [];
  }

  async previewApply(request: PreviewRequest): Promise<DeploymentPreviewV1> {
    const [stdout, stackResources] = await Promise.all([
      this.run(this.#commands.preview(this.#target)),
      this.#currentStackResources(),
    ]);
    const normalized = normalizeAzureWhatIf(parseJsonProcessOutput("azure-what-if", stdout));
    const previewIds = new Set(normalized.changes.map(({ resourceId }) => resourceId.toLowerCase()));
    const unrepresented = stackResources.filter(({ resourceId }) => !previewIds.has(resourceId.toLowerCase()));
    if (unrepresented.length > 0) {
      normalized.blockers.push(
        `Group what-if cannot prove action-on-unmanage behavior for current stack resources: ${unrepresented.map(({ resourceId }) => resourceId).join(", ")}`,
      );
    }
    return await this.#bind(request, "apply", normalized, stackResources);
  }

  async previewDestroy(request: PreviewRequest): Promise<DeploymentPreviewV1> {
    const resources = await this.#currentStackResources();
    return await this.#bind(
      request,
      "destroy",
      {
        changes: resources.map((resource) => ({ resourceId: resource.resourceId, action: "delete", material: true })),
        blockers: [],
      },
      resources,
    );
  }

  async apply(
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    authority: CurrentDeploymentAuthority,
  ): Promise<OperationRecordV1> {
    return await this.#execute("apply", preview, approval, authority);
  }

  async destroy(
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    authority: CurrentDeploymentAuthority,
  ): Promise<OperationRecordV1> {
    return await this.#execute("destroy", preview, approval, authority);
  }

  async inventory(projectId: string, runId: string): Promise<ResourceInventoryV1> {
    const resources = await this.#currentStackResources();
    return {
      schemaVersion: "1.0.0",
      projectId,
      runId,
      deploymentHash: sha256(resources),
      collectedAt: this.now().toISOString(),
      resources: [...resources],
    };
  }

  async #bind(
    request: PreviewRequest,
    operation: "apply" | "destroy",
    normalized: ReturnType<typeof normalizeAzureWhatIf>,
    stackResources: ReturnType<typeof normalizeAzureStackResources>,
  ): Promise<DeploymentPreviewV1> {
    const templateHash = await this.#rawFileHash(this.#target.templateFile);
    const parametersHash =
      this.#target.parametersFile === undefined
        ? createHash("sha256").update(Buffer.alloc(0)).digest("hex")
        : await this.#rawFileHash(this.#target.parametersFile);
    const stackStateHash = sha256(stackResources);
    const providerBindingHash = sha256({
      resourceGroup: this.#target.resourceGroup,
      stackName: this.#target.stackName,
      actionOnUnmanage: this.#target.actionOnUnmanage,
      denySettingsMode: this.#target.denySettingsMode,
      templateHash,
      parametersHash,
      stackStateHash,
    });
    const preview = this.createPreview(this.track, operation, request, normalized, {
      artifactHash: providerBindingHash,
    });
    const binding: BicepPreviewBinding = {
      kind: "bicep",
      preview,
      providerBindingHash,
      templateHash,
      parametersHash,
      stackStateHash,
    };
    this.#bindings.set(this.previewKey(request, operation), binding);
    await this.bindingStore?.save(preview.previewHash, binding);
    return preview;
  }

  async #rawFileHash(path: string): Promise<string> {
    const filePath = isAbsolute(path) ? path : resolve(this.#target.cwd ?? process.cwd(), path);
    return createHash("sha256")
      .update(await readFile(filePath))
      .digest("hex");
  }

  async #currentStackResources(): Promise<readonly ReturnType<typeof normalizeAzureStackResources>[number][]> {
    const stdout = await this.run(this.#commands.stackList(this.#target));
    const selected = selectAzureDeploymentStack(
      parseJsonProcessOutput("azure-stack", stdout),
      this.#target.resourceGroup,
      this.#target.stackName,
    );
    return selected === null ? [] : normalizeAzureStackResources(selected);
  }

  async #execute(
    operation: "apply" | "destroy",
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    suppliedAuthority: CurrentDeploymentAuthority,
  ): Promise<OperationRecordV1> {
    const key = `${preview.projectId}\u0000${preview.runId}\u0000${operation}`;
    const restoredLatest = await this.bindingStore?.loadLatest?.(preview.projectId, preview.runId, operation);
    const latestBinding = this.#bindings.get(key) ?? (restoredLatest?.kind === "bicep" ? restoredLatest : undefined);
    let binding = latestBinding;
    if (binding === undefined) {
      const restored = await this.bindingStore?.load(preview.previewHash);
      if (restored?.kind === "bicep") binding = restored;
    }
    const authority = await this.authorize(
      this.track,
      operation,
      preview,
      approval,
      suppliedAuthority,
      latestBinding?.preview.previewHash ?? binding?.preview.previewHash,
    );
    if (binding === undefined || binding.preview.previewHash !== preview.previewHash) {
      throw new IacProviderError("PREVIEW_HASH_MISMATCH", "No exact Bicep stack binding is available for this preview");
    }
    const templateHash = await this.#rawFileHash(this.#target.templateFile);
    const parametersHash =
      this.#target.parametersFile === undefined
        ? createHash("sha256").update(Buffer.alloc(0)).digest("hex")
        : await this.#rawFileHash(this.#target.parametersFile);
    const stackStateHash = sha256(await this.#currentStackResources());
    if (
      templateHash !== binding.templateHash ||
      parametersHash !== binding.parametersHash ||
      stackStateHash !== binding.stackStateHash ||
      preview.artifactHash !== binding.providerBindingHash
    ) {
      throw new IacProviderError(
        "PREVIEW_HASH_MISMATCH",
        "Bicep stack inputs, configuration, or managed state changed after preview",
      );
    }
    const stdout = await this.run(
      operation === "apply" ? this.#commands.stackApply(this.#target) : this.#commands.stackDestroy(this.#target),
    );
    let providerOperationId: string | undefined;
    if (stdout.trim().length > 0) {
      const result = parseJsonProcessOutput("azure-stack", stdout) as Record<string, unknown>;
      providerOperationId = typeof result.id === "string" ? result.id : undefined;
    }
    return this.record(operation, preview, approval, authority, providerOperationId, ["deploy:bicep-stack-ownership"]);
  }
}

export class NativeTerraformProvider extends NativeProviderBase implements IacProvider {
  readonly track = "terraform" as const;
  readonly #target: TerraformNativeTarget;
  readonly #commands = new TerraformCommandAdapter();
  readonly #bindings = new Map<string, TerraformPreviewBinding>();
  readonly #keyProvider: (() => Promise<Uint8Array>) | undefined;
  readonly #artifactStore: EncryptedPlanArtifactStore | undefined;
  readonly #transport: LocalEncryptedPlanTransport;

  constructor(options: NativeTerraformProviderOptions) {
    super(options);
    this.#target = options.target;
    this.#keyProvider = options.keyProvider;
    this.#artifactStore = options.artifactStore;
    this.#transport = options.transport ?? new LocalEncryptedPlanTransport(this.now);
  }

  async validate(): Promise<readonly string[]> {
    await this.run(this.#commands.init(this.#target.cwd, false));
    for (const command of this.#commands.validate(this.#target.cwd)) {
      await this.run(command);
    }
    return [];
  }

  async previewApply(request: PreviewRequest): Promise<DeploymentPreviewV1> {
    return await this.#preview(request, "apply");
  }

  async previewDestroy(request: PreviewRequest): Promise<DeploymentPreviewV1> {
    return await this.#preview(request, "destroy");
  }

  async apply(
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    authority: CurrentDeploymentAuthority,
  ): Promise<OperationRecordV1> {
    return await this.#execute("apply", preview, approval, authority);
  }

  async destroy(
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    authority: CurrentDeploymentAuthority,
  ): Promise<OperationRecordV1> {
    return await this.#execute("destroy", preview, approval, authority);
  }

  async inventory(projectId: string, runId: string): Promise<ResourceInventoryV1> {
    const stdout = await this.run({ executable: "terraform", args: ["show", "-json"], cwd: this.#target.cwd });
    const root = parseJsonProcessOutput("terraform-plan", stdout) as Record<string, unknown>;
    const values = root.values as Record<string, unknown> | undefined;
    const rootModule = values?.root_module as Record<string, unknown> | undefined;
    const collectResources = (module: Record<string, unknown> | undefined): readonly unknown[] => [
      ...(Array.isArray(module?.resources) ? module.resources : []),
      ...(Array.isArray(module?.child_modules)
        ? module.child_modules.flatMap((child) =>
            child !== null && typeof child === "object" && !Array.isArray(child)
              ? collectResources(child as Record<string, unknown>)
              : [],
          )
        : []),
    ];
    const resources = collectResources(rootModule);
    const normalized = resources.flatMap((entry) => {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return [];
      const resource = entry as Record<string, unknown>;
      const address = typeof resource.address === "string" ? resource.address : undefined;
      if (address === undefined) return [];
      return [
        {
          logicalId: address,
          resourceId: typeof resource.provider_name === "string" ? `${resource.provider_name}:${address}` : address,
          type: typeof resource.type === "string" ? resource.type : "unknown",
          location: "terraform-managed",
          properties: secretFreeProperties(resource.values, resource.sensitive_values),
        },
      ];
    });
    return {
      schemaVersion: "1.0.0",
      projectId,
      runId,
      deploymentHash: sha256(normalized),
      collectedAt: this.now().toISOString(),
      resources: normalized,
    };
  }

  attestation(previewHash: string): TerraformPlanAttestation | undefined {
    for (const binding of this.#bindings.values()) {
      if (binding.preview.previewHash === previewHash) return binding.attestation;
    }
    return undefined;
  }

  async #preview(request: PreviewRequest, operation: "apply" | "destroy"): Promise<DeploymentPreviewV1> {
    if (this.#keyProvider === undefined || this.#artifactStore === undefined || this.bindingStore === undefined) {
      throw new IacProviderError(
        "PREVIEW_HASH_MISMATCH",
        "Terraform local/reference plan transport requires injected key, artifact, and binding stores",
      );
    }
    const planPath = this.#target.planPath(request, operation);
    await this.run(this.#commands.init(this.#target.cwd, true));
    await this.run(this.#commands.preview(this.#target.cwd, planPath, operation === "destroy"));
    try {
      const planBytes = await readFile(planPath);
      const planDigest = createHash("sha256").update(planBytes).digest("hex");
      const showOutput = await this.run(this.#commands.showJson(this.#target.cwd, planPath));
      const normalized = normalizeTerraformPlan(parseJsonProcessOutput("terraform-plan", showOutput));
      const authority = await this.currentAuthority();
      if (
        authority.ownerEpoch !== request.ownerEpoch ||
        authority.head !== request.commit ||
        authority.dependencyRevision !== request.dependencyRevision
      ) {
        throw new IacProviderError("PREVIEW_OWNER_EPOCH_MISMATCH", "Preview request authority is stale");
      }
      const executionRecipient = request.executionRecipientIdentity ?? authority.recipientIdentity;
      const encrypted = this.#transport.encrypt(planBytes, await this.#keyProvider(), {
        recipient: executionRecipient,
        ttlMs: request.ttlMs,
      });
      const artifactRef = `${request.projectId}/${request.runId}/${operation}/${planDigest}.tfplan.enc`;
      await this.#artifactStore.put(artifactRef, encrypted);
      const configHash = await this.#target.configHash();
      const artifactHash = sha256({
        planDigest,
        configHash,
        lockfileHash: this.#target.lockfileHash,
        recipient: executionRecipient,
        artifactRef,
      });
      const preview = this.createPreview(this.track, operation, request, normalized, {
        artifactHash,
        ...(normalized.stateLineage === undefined ? {} : { stateLineage: normalized.stateLineage }),
        ...(normalized.stateSerial === undefined ? {} : { stateSerial: normalized.stateSerial }),
      });
      const createdAt = this.now();
      const attestation: TerraformPlanAttestation = {
        schemaVersion: "1.0.0",
        projectId: request.projectId,
        runId: request.runId,
        track: this.track,
        previewHash: preview.previewHash,
        inputHash: request.inputHash,
        iacHash: request.iacHash,
        policyHash: request.policyHash,
        configHash,
        lockfileHash: this.#target.lockfileHash,
        recipient: executionRecipient,
        planDigest,
        artifactRef,
        ...(preview.stateLineage === undefined ? {} : { stateLineage: preview.stateLineage }),
        ...(preview.stateSerial === undefined ? {} : { stateSerial: preview.stateSerial }),
        transport: {
          encrypted: true,
          implementation: "local-reference",
          algorithm: "aes-256-gcm",
          recipient: executionRecipient,
          mediaType: "application/vnd.apex.terraform-plan",
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        },
        createdAt: createdAt.toISOString(),
        expiresAt: preview.expiresAt,
      };
      const binding: TerraformPreviewBinding = { kind: "terraform", preview, attestation };
      this.#bindings.set(this.previewKey(request, operation), binding);
      await this.bindingStore.save(preview.previewHash, binding);
      return preview;
    } finally {
      await rm(planPath, { force: true });
    }
  }

  async #execute(
    operation: "apply" | "destroy",
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    suppliedAuthority: CurrentDeploymentAuthority,
  ): Promise<OperationRecordV1> {
    let binding = this.#bindings.get(`${preview.projectId}\u0000${preview.runId}\u0000${operation}`);
    if (binding === undefined) {
      const restored = await this.bindingStore?.load(preview.previewHash);
      if (restored?.kind === "terraform") binding = restored;
    }
    const authority = await this.authorize(
      this.track,
      operation,
      preview,
      approval,
      suppliedAuthority,
      binding?.preview.previewHash,
    );
    if (binding === undefined) {
      throw new IacProviderError("PREVIEW_HASH_MISMATCH", "No exact saved plan is bound to this preview");
    }
    if (binding.attestation.recipient !== authority.recipientIdentity) {
      throw new IacProviderError("APPROVAL_RECIPIENT_MISMATCH", "Saved plan recipient is not the current authority");
    }
    if (
      binding.attestation.configHash !== (await this.#target.configHash()) ||
      binding.attestation.lockfileHash !== this.#target.lockfileHash ||
      binding.attestation.inputHash !== preview.inputHash ||
      binding.attestation.stateLineage !== preview.stateLineage ||
      binding.attestation.stateSerial !== preview.stateSerial
    ) {
      throw new IacProviderError("PREVIEW_HASH_MISMATCH", "Saved plan attestation does not match the preview");
    }
    const providerArtifactHash = sha256({
      planDigest: binding.attestation.planDigest,
      configHash: binding.attestation.configHash,
      lockfileHash: binding.attestation.lockfileHash,
      recipient: binding.attestation.recipient,
      artifactRef: binding.attestation.artifactRef,
    });
    if (preview.artifactHash !== providerArtifactHash) {
      throw new IacProviderError("PREVIEW_HASH_MISMATCH", "Terraform provider binding hash does not match the preview");
    }
    if (this.#keyProvider === undefined || this.#artifactStore === undefined) {
      throw new IacProviderError("PREVIEW_HASH_MISMATCH", "Terraform plan decryption dependencies are unavailable");
    }
    const encrypted = await this.#artifactStore.get(binding.attestation.artifactRef);
    if (encrypted === undefined)
      throw new IacProviderError("PREVIEW_HASH_MISMATCH", "Encrypted plan artifact is missing");
    if (
      encrypted.iv !== binding.attestation.transport.iv ||
      encrypted.authTag !== binding.attestation.transport.authTag ||
      encrypted.metadata.digest !== binding.attestation.planDigest
    ) {
      throw new IacProviderError("PREVIEW_HASH_MISMATCH", "Encrypted plan metadata does not match its attestation");
    }
    const handle = await this.#transport.decryptToRestrictiveTemp(
      encrypted,
      await this.#keyProvider(),
      authority.recipientIdentity,
    );
    try {
      await this.run(this.#commands.applyExact(this.#target.cwd, handle.path));
      return this.record(operation, preview, approval, authority, `terraform-plan:${binding.attestation.planDigest}`, [
        "deploy:exact-saved-plan",
        "deploy:state-lineage-and-serial",
      ]);
    } finally {
      await handle.dispose();
    }
  }
}
