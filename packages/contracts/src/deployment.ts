import { Type, type Static } from "@sinclair/typebox";
import {
  ContractVersionSchema,
  EnvironmentSchema,
  IacToolSchema,
  IsoDateTimeSchema,
  NonEmptyStringSchema,
  OperationSchema,
  ProjectIdSchema,
  RunIdSchema,
  Sha256Schema,
} from "./common.js";

export const PreviewChangeV1Schema = Type.Object(
  {
    resourceId: NonEmptyStringSchema,
    action: Type.Union([
      Type.Literal("create"),
      Type.Literal("update"),
      Type.Literal("delete"),
      Type.Literal("replace"),
      Type.Literal("no-op"),
      Type.Literal("unknown"),
    ]),
    material: Type.Boolean(),
    details: Type.Optional(NonEmptyStringSchema),
  },
  { additionalProperties: false },
);

export const DeploymentPreviewV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    environment: EnvironmentSchema,
    track: IacToolSchema,
    operation: OperationSchema,
    target: NonEmptyStringSchema,
    commit: Sha256Schema,
    dependencyRevision: Sha256Schema,
    ownerEpoch: Type.Integer({ minimum: 1 }),
    inputHash: Sha256Schema,
    iacHash: Sha256Schema,
    policyHash: Sha256Schema,
    artifactHash: Type.Optional(Sha256Schema),
    stateLineage: Type.Optional(NonEmptyStringSchema),
    stateSerial: Type.Optional(Type.Integer({ minimum: 0 })),
    changes: Type.Array(PreviewChangeV1Schema),
    blockers: Type.Array(NonEmptyStringSchema),
    createdAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    previewHash: Sha256Schema,
  },
  { $id: "https://schemas.apexops.dev/deployment-preview-v1.json", additionalProperties: false },
);

export const GitHubApprovalContextSchema = Type.Object(
  {
    repository: Type.String({ pattern: "^[^/\\s]+/[^/\\s]+$" }),
    ref: Type.String({ pattern: "^refs/heads/[^\\s]+$" }),
    sha: Type.String({ pattern: "^[0-9a-f]{40}$" }),
    workflowRef: NonEmptyStringSchema,
    runId: Type.String({ pattern: "^[0-9]+$" }),
    runAttempt: Type.Integer({ minimum: 1 }),
    job: NonEmptyStringSchema,
    environment: NonEmptyStringSchema,
    actor: NonEmptyStringSchema,
    actorId: Type.String({ pattern: "^[0-9]+$" }),
    recipientIdentity: NonEmptyStringSchema,
  },
  { additionalProperties: false },
);

const approvalEvidenceProperties = {
  schemaVersion: ContractVersionSchema,
  projectId: ProjectIdSchema,
  runId: RunIdSchema,
  gate: Type.Integer({ minimum: 1, maximum: 4 }),
  decision: Type.Union([Type.Literal("approved"), Type.Literal("rejected")]),
  actor: NonEmptyStringSchema,
  dependencyHash: Sha256Schema,
  previewHash: Type.Optional(Sha256Schema),
  writerTransferClaimHash: Type.Optional(Sha256Schema),
  writerEpoch: Type.Integer({ minimum: 1 }),
  decidedAt: Type.String({
    pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
  }),
  expiresAt: Type.Optional(
    Type.String({
      pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
    }),
  ),
};

export const ApprovalEvidenceV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...approvalEvidenceProperties,
        mechanism: Type.Literal("tty"),
        recipientIdentity: Type.Optional(NonEmptyStringSchema),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...approvalEvidenceProperties,
        mechanism: Type.Literal("inherited"),
        recipientIdentity: Type.Optional(NonEmptyStringSchema),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...approvalEvidenceProperties,
        mechanism: Type.Literal("github-environment"),
        recipientIdentity: NonEmptyStringSchema,
        githubContext: GitHubApprovalContextSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "https://schemas.apexops.dev/approval-evidence-v1.json" },
);

export const OperationStateSchema = Type.Union([
  Type.Literal("requested"),
  Type.Literal("authorized"),
  Type.Literal("started"),
  Type.Literal("observed"),
  Type.Literal("succeeded"),
  Type.Literal("failed"),
  Type.Literal("indeterminate"),
  Type.Literal("reconciled"),
  Type.Literal("compensated"),
]);

export const OperationRecordV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    operationId: NonEmptyStringSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    providerOperationId: Type.Optional(NonEmptyStringSchema),
    operation: OperationSchema,
    state: OperationStateSchema,
    previewHash: Sha256Schema,
    approvalHash: Sha256Schema,
    ownerEpoch: Type.Integer({ minimum: 1 }),
    updatedAt: IsoDateTimeSchema,
    errorCode: Type.Optional(NonEmptyStringSchema),
  },
  { $id: "https://schemas.apexops.dev/operation-record-v1.json", additionalProperties: false },
);

export const ResourceInventoryV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    deploymentHash: Sha256Schema,
    collectedAt: IsoDateTimeSchema,
    resources: Type.Array(
      Type.Object(
        {
          logicalId: NonEmptyStringSchema,
          resourceId: NonEmptyStringSchema,
          type: NonEmptyStringSchema,
          location: NonEmptyStringSchema,
          properties: Type.Record(NonEmptyStringSchema, Type.Unknown()),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { $id: "https://schemas.apexops.dev/resource-inventory-v1.json", additionalProperties: false },
);

export type DeploymentPreviewV1 = Static<typeof DeploymentPreviewV1Schema>;
export type GitHubApprovalContext = Static<typeof GitHubApprovalContextSchema>;
export type ApprovalEvidenceV1 = Static<typeof ApprovalEvidenceV1Schema>;
export type OperationRecordV1 = Static<typeof OperationRecordV1Schema>;
export type ResourceInventoryV1 = Static<typeof ResourceInventoryV1Schema>;
