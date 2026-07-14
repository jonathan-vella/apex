import { Type, type Static } from "@sinclair/typebox";
import {
  ContractVersionSchema,
  EnvironmentSchema,
  IacToolSchema,
  IsoDateTimeSchema,
  NonEmptyStringSchema,
  ProjectIdSchema,
  RunIdSchema,
  Sha256Schema,
  TaskIdSchema,
} from "./common.js";

export const RuntimeBundleLockV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    cliVersion: NonEmptyStringSchema,
    customizationVersion: NonEmptyStringSchema,
    workflowHash: Sha256Schema,
    defaultsHash: Sha256Schema,
    validatorHash: Sha256Schema,
    qualityScorecardHash: Sha256Schema,
    requiredCapabilityPacks: Type.Array(NonEmptyStringSchema, { uniqueItems: true }),
  },
  { $id: "https://schemas.apexops.dev/runtime-bundle-lock-v1.json", additionalProperties: false },
);

export const ProjectConfigV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    displayName: NonEmptyStringSchema,
    createdAt: IsoDateTimeSchema,
    defaultIacTool: IacToolSchema,
  },
  { $id: "https://schemas.apexops.dev/project-config-v1.json", additionalProperties: false },
);

export const GateStateSchema = Type.Union([
  Type.Literal("closed"),
  Type.Literal("open"),
  Type.Literal("approved"),
  Type.Literal("inherited"),
  Type.Literal("rejected"),
  Type.Literal("invalidated"),
]);

export const GateRecordV1Schema = Type.Object(
  {
    gate: Type.Integer({ minimum: 1, maximum: 4 }),
    state: GateStateSchema,
    dependencyHash: Sha256Schema,
    decidedAt: Type.Optional(IsoDateTimeSchema),
    inheritedFromRunId: Type.Optional(RunIdSchema),
    reason: Type.Optional(NonEmptyStringSchema),
  },
  { additionalProperties: false },
);

export const RunConfigV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    environment: EnvironmentSchema,
    targetScope: NonEmptyStringSchema,
    iacTool: IacToolSchema,
    createdAt: IsoDateTimeSchema,
    runtimeLockHash: Sha256Schema,
    parentRunId: Type.Optional(RunIdSchema),
    ownerEpoch: Type.Integer({ minimum: 1 }),
    gates: Type.Array(GateRecordV1Schema, { minItems: 4, maxItems: 4 }),
  },
  { $id: "https://schemas.apexops.dev/run-config-v1.json", additionalProperties: false },
);

export const CapabilityGrantV1Schema = Type.Object(
  {
    capability: NonEmptyStringSchema,
    sideEffect: Type.Union([Type.Literal("none"), Type.Literal("local"), Type.Literal("remote")]),
    expiresAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);

export const TaskEnvelopeV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    taskId: TaskIdSchema,
    role: NonEmptyStringSchema,
    taskType: NonEmptyStringSchema,
    expectedHead: Sha256Schema,
    ownerEpoch: Type.Integer({ minimum: 1 }),
    createdAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    inputRefs: Type.Array(Sha256Schema, { uniqueItems: true }),
    allowedOutputKinds: Type.Array(NonEmptyStringSchema, { uniqueItems: true }),
    capabilityGrants: Type.Array(CapabilityGrantV1Schema),
    maxOutputBytes: Type.Integer({ minimum: 1 }),
  },
  { $id: "https://schemas.apexops.dev/task-envelope-v1.json", additionalProperties: false },
);

export const QuestionV1Schema = Type.Object(
  {
    id: NonEmptyStringSchema,
    prompt: NonEmptyStringSchema,
    options: Type.Optional(Type.Array(NonEmptyStringSchema, { minItems: 1 })),
    multiSelect: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const TaskResultV1Schema = Type.Union([
  Type.Object(
    {
      schemaVersion: ContractVersionSchema,
      taskId: TaskIdSchema,
      status: Type.Literal("completed"),
      outputRefs: Type.Array(Sha256Schema),
      summary: NonEmptyStringSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      schemaVersion: ContractVersionSchema,
      taskId: TaskIdSchema,
      status: Type.Literal("needs_input"),
      questions: Type.Array(QuestionV1Schema, { minItems: 1 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      schemaVersion: ContractVersionSchema,
      taskId: TaskIdSchema,
      status: Type.Literal("failed"),
      errorCode: NonEmptyStringSchema,
      message: NonEmptyStringSchema,
      retryable: Type.Boolean(),
    },
    { additionalProperties: false },
  ),
]);

export const EventV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    eventId: NonEmptyStringSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    sequence: Type.Integer({ minimum: 1 }),
    type: NonEmptyStringSchema,
    timestamp: IsoDateTimeSchema,
    ownerEpoch: Type.Integer({ minimum: 1 }),
    previousHash: Type.Union([Sha256Schema, Type.Null()]),
    payloadHash: Sha256Schema,
    payload: Type.Unknown(),
    hash: Sha256Schema,
  },
  { $id: "https://schemas.apexops.dev/event-v1.json", additionalProperties: false },
);

export type RuntimeBundleLockV1 = Static<typeof RuntimeBundleLockV1Schema>;
export type ProjectConfigV1 = Static<typeof ProjectConfigV1Schema>;
export type GateRecordV1 = Static<typeof GateRecordV1Schema>;
export type RunConfigV1 = Static<typeof RunConfigV1Schema>;
export type TaskEnvelopeV1 = Static<typeof TaskEnvelopeV1Schema>;
export type TaskResultV1 = Static<typeof TaskResultV1Schema>;
export type EventV1 = Static<typeof EventV1Schema>;
