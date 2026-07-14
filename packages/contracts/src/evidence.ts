import { Type, type Static } from "@sinclair/typebox";
import {
  ContractVersionSchema,
  IsoDateTimeSchema,
  NonEmptyStringSchema,
  ProjectIdSchema,
  RunIdSchema,
  Sha256Schema,
} from "./common.js";

export const EvidenceManifestV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    createdAt: IsoDateTimeSchema,
    entries: Type.Array(
      Type.Object(
        {
          kind: NonEmptyStringSchema,
          hash: Sha256Schema,
          bytes: Type.Integer({ minimum: 0 }),
          required: Type.Boolean(),
          retention: Type.Union([Type.Literal("immutable"), Type.Literal("project"), Type.Literal("optional")]),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { $id: "https://schemas.apexops.dev/evidence-manifest-v1.json", additionalProperties: false },
);

export const ScorecardRuleV1Schema = Type.Object(
  {
    metric: NonEmptyStringSchema,
    direction: Type.Union([Type.Literal("min"), Type.Literal("max"), Type.Literal("exact")]),
    target: Type.Number(),
    tolerance: Type.Number({ minimum: 0 }),
    scenario: NonEmptyStringSchema,
    minimumSamples: Type.Integer({ minimum: 1 }),
    source: Type.Union([Type.Literal("kernel"), Type.Literal("vscode"), Type.Literal("estimated")]),
    owner: NonEmptyStringSchema,
    unavailable: Type.Union([Type.Literal("block"), Type.Literal("omit-claim")]),
  },
  { additionalProperties: false },
);

export const QualityScorecardV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    frozenAt: IsoDateTimeSchema,
    rules: Type.Array(ScorecardRuleV1Schema, { minItems: 1 }),
  },
  { $id: "https://schemas.apexops.dev/quality-scorecard-v1.json", additionalProperties: false },
);

export const QualityMeasurementsV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    measurements: Type.Array(
      Type.Object(
        {
          metric: NonEmptyStringSchema,
          scenario: NonEmptyStringSchema,
          value: Type.Optional(Type.Number()),
          samples: Type.Integer({ minimum: 0 }),
          evidenceRefs: Type.Array(Sha256Schema, { uniqueItems: true }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { $id: "https://schemas.apexops.dev/quality-measurements-v1.json", additionalProperties: false },
);

export type EvidenceManifestV1 = Static<typeof EvidenceManifestV1Schema>;
export type QualityScorecardV1 = Static<typeof QualityScorecardV1Schema>;
export type QualityMeasurementsV1 = Static<typeof QualityMeasurementsV1Schema>;
