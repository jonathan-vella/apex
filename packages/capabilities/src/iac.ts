import { createHash } from "node:crypto";
import type {
  ApprovalEvidenceV1,
  DeploymentPreviewV1,
  IacTool,
  Operation,
  OperationRecordV1,
  ResourceInventoryV1,
} from "@apex/contracts";

export type IacProviderErrorCode =
  | "APPROVAL_EXPIRED"
  | "APPROVAL_DEPENDENCY_HASH_MISMATCH"
  | "APPROVAL_HASH_MISMATCH"
  | "APPROVAL_RECIPIENT_MISMATCH"
  | "APPROVAL_REJECTED"
  | "APPROVAL_WRITER_EPOCH_MISMATCH"
  | "PREVIEW_BLOCKED"
  | "PREVIEW_EXPIRED"
  | "PREVIEW_HASH_MISMATCH"
  | "PREVIEW_HEAD_MISMATCH"
  | "PREVIEW_OWNER_EPOCH_MISMATCH"
  | "PREVIEW_SUPERSEDED"
  | "PREVIEW_TRACK_MISMATCH";

export class IacProviderError extends Error {
  constructor(
    public readonly code: IacProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IacProviderError";
  }
}

export interface IacResourceSpec {
  readonly logicalId: string;
  readonly resourceId: string;
  readonly type: string;
  readonly location: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface PreviewRequest {
  readonly projectId: string;
  readonly runId: string;
  readonly environment: string;
  readonly target: string;
  readonly commit: string;
  readonly dependencyRevision: string;
  readonly ownerEpoch: number;
  readonly executionRecipientIdentity?: string;
  readonly inputHash: string;
  readonly iacHash: string;
  readonly policyHash: string;
  readonly resources: readonly IacResourceSpec[];
  readonly blockers?: readonly string[];
  readonly ttlMs: number;
}

export interface CurrentDeploymentAuthority {
  readonly head: string;
  readonly dependencyRevision: string;
  readonly ownerEpoch: number;
  readonly previousOwnerEpoch?: number;
  readonly writerTransferClaimHash?: string;
  readonly recipientIdentity: string;
}

export interface ProviderExecutionEvidence {
  readonly mode: "native";
  readonly operationId: string;
  readonly previewHash: string;
  readonly validatorIds: readonly string[];
}

export interface PreviewAuthorizationContext {
  readonly operation: Operation;
  readonly track: IacTool;
  readonly preview: DeploymentPreviewV1;
  readonly approval: ApprovalEvidenceV1;
  readonly authority: CurrentDeploymentAuthority;
  readonly now: Date;
  readonly latestPreviewHash?: string;
}

export function authorizeDeploymentPreview(context: PreviewAuthorizationContext): void {
  const { operation, track, preview, approval, authority, now, latestPreviewHash } = context;
  if (preview.track !== track) {
    throw new IacProviderError("PREVIEW_TRACK_MISMATCH", `Preview track '${preview.track}' is not '${track}'`);
  }
  if (preview.operation !== operation) {
    throw new IacProviderError("PREVIEW_HASH_MISMATCH", `Preview is for '${preview.operation}', not '${operation}'`);
  }
  const { previewHash, ...previewBody } = preview;
  if (sha256(previewBody) !== previewHash) {
    throw new IacProviderError("PREVIEW_HASH_MISMATCH", "Preview content does not match its hash");
  }
  if (latestPreviewHash !== undefined && latestPreviewHash !== preview.previewHash) {
    throw new IacProviderError("PREVIEW_SUPERSEDED", "A newer preview has superseded this preview");
  }
  if (preview.blockers.length > 0) {
    throw new IacProviderError("PREVIEW_BLOCKED", `Preview has blockers: ${preview.blockers.join(", ")}`);
  }
  if (new Date(preview.expiresAt).getTime() <= now.getTime()) {
    throw new IacProviderError("PREVIEW_EXPIRED", "Preview has expired");
  }
  if (preview.commit !== authority.head) {
    throw new IacProviderError("PREVIEW_HEAD_MISMATCH", "Preview commit is not the current head");
  }
  if (preview.dependencyRevision !== authority.dependencyRevision) {
    throw new IacProviderError("PREVIEW_HEAD_MISMATCH", "Preview dependency revision is not current");
  }
  const sameWriter = preview.ownerEpoch === authority.ownerEpoch && approval.writerTransferClaimHash === undefined;
  const transferredWriter =
    preview.ownerEpoch + 1 === authority.ownerEpoch &&
    authority.previousOwnerEpoch === preview.ownerEpoch &&
    authority.writerTransferClaimHash !== undefined &&
    approval.writerTransferClaimHash === authority.writerTransferClaimHash;
  if (!sameWriter && !transferredWriter) {
    throw new IacProviderError("PREVIEW_OWNER_EPOCH_MISMATCH", "Preview owner epoch is stale");
  }
  if (approval.decision !== "approved") {
    throw new IacProviderError("APPROVAL_REJECTED", "Deployment approval was not granted");
  }
  if (approval.previewHash !== preview.previewHash) {
    throw new IacProviderError("APPROVAL_HASH_MISMATCH", "Approval is not bound to this exact preview");
  }
  if (approval.dependencyHash !== preview.previewHash) {
    throw new IacProviderError(
      "APPROVAL_DEPENDENCY_HASH_MISMATCH",
      "Approval gate dependency hash is not bound to this preview",
    );
  }
  if (approval.writerEpoch !== authority.ownerEpoch) {
    throw new IacProviderError("APPROVAL_WRITER_EPOCH_MISMATCH", "Approval writer epoch is stale");
  }
  if (approval.recipientIdentity !== authority.recipientIdentity) {
    throw new IacProviderError("APPROVAL_RECIPIENT_MISMATCH", "Approval recipient does not match the current writer");
  }
  if (approval.expiresAt !== undefined && new Date(approval.expiresAt).getTime() <= now.getTime()) {
    throw new IacProviderError("APPROVAL_EXPIRED", "Approval has expired");
  }
}

export interface IacProvider {
  readonly track: IacTool;
  validate(request: PreviewRequest): Promise<readonly string[]>;
  previewApply(request: PreviewRequest): Promise<DeploymentPreviewV1>;
  previewDestroy(request: PreviewRequest): Promise<DeploymentPreviewV1>;
  apply(
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    authority: CurrentDeploymentAuthority,
  ): Promise<OperationRecordV1>;
  destroy(
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    authority: CurrentDeploymentAuthority,
  ): Promise<OperationRecordV1>;
  inventory(projectId: string, runId: string): Promise<ResourceInventoryV1>;
  reconcile(operationId: string): Promise<OperationRecordV1 | undefined>;
  executionEvidence?(operationId: string): ProviderExecutionEvidence | undefined;
}

export interface FakeIaCProviderOptions {
  readonly track: IacTool;
  readonly now?: () => Date;
  readonly nextId?: () => string;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export class FakeIaCProvider implements IacProvider {
  readonly track: IacTool;
  readonly #now: () => Date;
  readonly #nextId: () => string;
  readonly #latestPreviews = new Map<string, DeploymentPreviewV1>();
  readonly #previewResources = new Map<string, readonly IacResourceSpec[]>();
  readonly #resources = new Map<string, IacResourceSpec>();
  readonly #operations = new Map<string, OperationRecordV1>();

  constructor(options: FakeIaCProviderOptions) {
    this.track = options.track;
    this.#now = options.now ?? (() => new Date());
    this.#nextId = options.nextId ?? (() => crypto.randomUUID());
  }

  async validate(request: PreviewRequest): Promise<readonly string[]> {
    return request.blockers ?? [];
  }

  async previewApply(request: PreviewRequest): Promise<DeploymentPreviewV1> {
    return await this.#preview("apply", request);
  }

  async previewDestroy(request: PreviewRequest): Promise<DeploymentPreviewV1> {
    return await this.#preview("destroy", request);
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
    const resources = [...this.#resources.values()].map((resource) => ({
      logicalId: resource.logicalId,
      resourceId: resource.resourceId,
      type: resource.type,
      location: resource.location,
      properties: { ...resource.properties },
    }));
    return {
      schemaVersion: "1.0.0",
      projectId,
      runId,
      deploymentHash: sha256(resources),
      collectedAt: this.#now().toISOString(),
      resources,
    };
  }

  async reconcile(operationId: string): Promise<OperationRecordV1 | undefined> {
    return this.#operations.get(operationId);
  }

  async #preview(operation: Operation, request: PreviewRequest): Promise<DeploymentPreviewV1> {
    const blockers = [...(await this.validate(request))];
    const createdAt = this.#now();
    const existingIds = new Set(this.#resources.keys());
    const changes =
      operation === "destroy"
        ? [...this.#resources.values()].map((resource) => ({
            resourceId: resource.resourceId,
            action: "delete" as const,
            material: true,
          }))
        : request.resources.map((resource) => ({
            resourceId: resource.resourceId,
            action: existingIds.has(resource.resourceId) ? ("update" as const) : ("create" as const),
            material: true,
          }));
    const base = {
      schemaVersion: "1.0.0" as const,
      projectId: request.projectId,
      runId: request.runId,
      environment: request.environment,
      track: this.track,
      operation,
      target: request.target,
      commit: request.commit,
      dependencyRevision: request.dependencyRevision,
      ownerEpoch: request.ownerEpoch,
      inputHash: request.inputHash,
      iacHash: request.iacHash,
      policyHash: request.policyHash,
      changes,
      blockers,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + request.ttlMs).toISOString(),
    };
    const preview: DeploymentPreviewV1 = { ...base, previewHash: sha256(base) };
    const key = this.#previewKey(request.projectId, request.runId, operation);
    this.#latestPreviews.set(key, preview);
    this.#previewResources.set(preview.previewHash, [...request.resources]);
    return preview;
  }

  async #execute(
    operation: Operation,
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    authority: CurrentDeploymentAuthority,
  ): Promise<OperationRecordV1> {
    this.#authorize(operation, preview, approval, authority);
    const resources = this.#previewResources.get(preview.previewHash) ?? [];
    if (operation === "apply") {
      for (const resource of resources) {
        this.#resources.set(resource.resourceId, resource);
      }
    } else {
      this.#resources.clear();
    }
    const operationId = this.#nextId();
    const record: OperationRecordV1 = {
      schemaVersion: "1.0.0",
      operationId,
      projectId: preview.projectId,
      runId: preview.runId,
      providerOperationId: `fake-${operationId}`,
      operation,
      state: "succeeded",
      previewHash: preview.previewHash,
      approvalHash: sha256(approval),
      ownerEpoch: authority.ownerEpoch,
      updatedAt: this.#now().toISOString(),
    };
    this.#operations.set(operationId, record);
    return record;
  }

  #authorize(
    operation: Operation,
    preview: DeploymentPreviewV1,
    approval: ApprovalEvidenceV1,
    authority: CurrentDeploymentAuthority,
  ): void {
    const latest = this.#latestPreviews.get(this.#previewKey(preview.projectId, preview.runId, operation));
    authorizeDeploymentPreview({
      operation,
      track: this.track,
      preview,
      approval,
      authority,
      now: this.#now(),
      ...(latest === undefined ? {} : { latestPreviewHash: latest.previewHash }),
    });
  }

  #previewKey(projectId: string, runId: string, operation: Operation): string {
    return `${projectId}\u0000${runId}\u0000${operation}`;
  }
}
