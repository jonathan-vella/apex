import { Type, type Static } from "@sinclair/typebox";
import {
  ContractVersionSchema,
  EnvironmentSchema,
  NonEmptyStringSchema,
  ProjectIdSchema,
  RunIdSchema,
  Sha256Schema,
} from "./common.js";

export const RequirementV1Schema = Type.Object(
  {
    id: NonEmptyStringSchema,
    statement: NonEmptyStringSchema,
    priority: Type.Union([Type.Literal("must"), Type.Literal("should"), Type.Literal("could")]),
    status: Type.Union([Type.Literal("confirmed"), Type.Literal("unknown"), Type.Literal("deferred")]),
    source: NonEmptyStringSchema,
  },
  { additionalProperties: false },
);

export const RequirementsV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    workload: NonEmptyStringSchema,
    environment: EnvironmentSchema,
    requirements: Type.Array(RequirementV1Schema, { minItems: 1 }),
    assumptions: Type.Array(NonEmptyStringSchema),
    unknowns: Type.Array(NonEmptyStringSchema),
  },
  { $id: "https://schemas.apexops.dev/requirements-v1.json", additionalProperties: false },
);

export const LogicalResourceV1Schema = Type.Object(
  {
    id: NonEmptyStringSchema,
    type: NonEmptyStringSchema,
    purpose: NonEmptyStringSchema,
    dependsOn: Type.Array(NonEmptyStringSchema, { uniqueItems: true }),
    controls: Type.Array(NonEmptyStringSchema, { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const ImplementationIntentV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    sourceHashes: Type.Record(NonEmptyStringSchema, Sha256Schema),
    resources: Type.Array(LogicalResourceV1Schema, { minItems: 1 }),
    outputs: Type.Array(NonEmptyStringSchema),
  },
  { $id: "https://schemas.apexops.dev/implementation-intent-v1.json", additionalProperties: false },
);

export const IacBindingV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    track: Type.Union([Type.Literal("bicep"), Type.Literal("terraform")]),
    intentHash: Sha256Schema,
    resourceBindings: Type.Record(
      NonEmptyStringSchema,
      Type.Object(
        {
          implementation: NonEmptyStringSchema,
          version: NonEmptyStringSchema,
          parameters: Type.Record(NonEmptyStringSchema, Type.Unknown()),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { $id: "https://schemas.apexops.dev/iac-binding-v1.json", additionalProperties: false },
);

export type RequirementsV1 = Static<typeof RequirementsV1Schema>;
export type ImplementationIntentV1 = Static<typeof ImplementationIntentV1Schema>;
export type IacBindingV1 = Static<typeof IacBindingV1Schema>;
