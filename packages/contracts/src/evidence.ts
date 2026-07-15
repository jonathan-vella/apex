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

export const LIVE_QUALIFICATION_SCENARIO_IDS = [
  "vscode-experience",
  "restart-cross-device",
  "github-oidc-writer-transfer",
  "bicep-lifecycle",
  "terraform-lifecycle",
  "promotion",
] as const;

const LiveQualificationScenarioIdSchema = Type.Union([
  Type.Literal(LIVE_QUALIFICATION_SCENARIO_IDS[0]),
  Type.Literal(LIVE_QUALIFICATION_SCENARIO_IDS[1]),
  Type.Literal(LIVE_QUALIFICATION_SCENARIO_IDS[2]),
  Type.Literal(LIVE_QUALIFICATION_SCENARIO_IDS[3]),
  Type.Literal(LIVE_QUALIFICATION_SCENARIO_IDS[4]),
  Type.Literal(LIVE_QUALIFICATION_SCENARIO_IDS[5]),
]);

const LiveQualificationScenarioBase = {
  id: LiveQualificationScenarioIdSchema,
  environment: NonEmptyStringSchema,
  targetScope: NonEmptyStringSchema,
  actor: NonEmptyStringSchema,
  startedAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema,
  toolVersions: Type.Record(Type.String({ pattern: "^[a-z][a-z0-9.-]*$" }), NonEmptyStringSchema, {
    minProperties: 1,
  }),
};

const LiveQualificationScenarioV1Schema = Type.Union([
  Type.Object(
    {
      ...LiveQualificationScenarioBase,
      outcome: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
      evidenceRefs: Type.Array(Sha256Schema, { minItems: 1, uniqueItems: true }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...LiveQualificationScenarioBase,
      outcome: Type.Literal("unavailable"),
      evidenceRefs: Type.Array(Sha256Schema, { uniqueItems: true }),
      disposition: Type.Object(
        {
          reason: NonEmptyStringSchema,
          owner: NonEmptyStringSchema,
          nextAction: NonEmptyStringSchema,
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

export const LiveQualificationV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    candidate: Type.Object(
      {
        repository: NonEmptyStringSchema,
        branch: NonEmptyStringSchema,
        commit: Type.String({ pattern: "^[0-9a-f]{40}$" }),
        packageLockHash: Sha256Schema,
        releaseManifestHash: Sha256Schema,
        runtimeBundleHash: Sha256Schema,
      },
      { additionalProperties: false },
    ),
    createdAt: IsoDateTimeSchema,
    evidenceManifestHash: Sha256Schema,
    scenarios: Type.Array(LiveQualificationScenarioV1Schema, { minItems: 1 }),
  },
  { $id: "https://schemas.apexops.dev/live-qualification-v1.json", additionalProperties: false },
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

const AvailabilityCheckV1Schema = Type.Object(
  {
    status: Type.Union([Type.Literal("current"), Type.Literal("unavailable"), Type.Literal("blocked")]),
    evidenceRef: Sha256Schema,
  },
  { additionalProperties: false },
);

export const ArchitectureAvailabilityV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    targetScope: NonEmptyStringSchema,
    mode: Type.Union([Type.Literal("native"), Type.Literal("simulated")]),
    collectedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    checks: Type.Object(
      {
        pricing: AvailabilityCheckV1Schema,
        quota: AvailabilityCheckV1Schema,
        regionalAvailability: AvailabilityCheckV1Schema,
      },
      { additionalProperties: false },
    ),
  },
  { $id: "https://schemas.apexops.dev/architecture-availability-v1.json", additionalProperties: false },
);

export type EvidenceManifestV1 = Static<typeof EvidenceManifestV1Schema>;
export type LiveQualificationV1 = Static<typeof LiveQualificationV1Schema>;
export type QualityScorecardV1 = Static<typeof QualityScorecardV1Schema>;
export type QualityMeasurementsV1 = Static<typeof QualityMeasurementsV1Schema>;
export type ArchitectureAvailabilityV1 = Static<typeof ArchitectureAvailabilityV1Schema>;

export function hasValidLiveQualification(qualification: LiveQualificationV1): boolean {
  const scenarioIds = qualification.scenarios.map(({ id }) => id);
  const uniqueScenarioIds = new Set(scenarioIds);
  const createdAt = Date.parse(qualification.createdAt);
  return (
    scenarioIds.length === LIVE_QUALIFICATION_SCENARIO_IDS.length &&
    uniqueScenarioIds.size === LIVE_QUALIFICATION_SCENARIO_IDS.length &&
    LIVE_QUALIFICATION_SCENARIO_IDS.every((id) => uniqueScenarioIds.has(id)) &&
    Number.isFinite(createdAt) &&
    qualification.scenarios.every(({ startedAt, completedAt }) => {
      const started = Date.parse(startedAt);
      const completed = Date.parse(completedAt);
      return Number.isFinite(started) && Number.isFinite(completed) && createdAt <= started && started <= completed;
    })
  );
}
