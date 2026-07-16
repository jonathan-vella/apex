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
} from "./common.js";
import type { ApprovalEvidenceV1, DeploymentPreviewV1 } from "./deployment.js";

export const SeveritySchema = Type.Union([
  Type.Literal("critical"),
  Type.Literal("high"),
  Type.Literal("medium"),
  Type.Literal("low"),
  Type.Literal("info"),
]);
export const DispositionSchema = Type.Union([
  Type.Literal("open"),
  Type.Literal("accepted"),
  Type.Literal("remediated"),
  Type.Literal("dismissed"),
]);
export const ConfidenceSchema = Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]);
export const CurrencySchema = Type.String({ pattern: "^[A-Z]{3}$" });

const RevisionV1Schema = Type.Object(
  {
    number: Type.Integer({ minimum: 1 }),
    createdAt: IsoDateTimeSchema,
    sourceHash: Sha256Schema,
    reason: NonEmptyStringSchema,
  },
  { additionalProperties: false },
);

export const SkuManifestV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    environments: Type.Array(EnvironmentSchema, { minItems: 1, uniqueItems: true }),
    services: Type.Array(
      Type.Object(
        {
          logicalId: NonEmptyStringSchema,
          service: NonEmptyStringSchema,
          environment: EnvironmentSchema,
          sku: Type.Optional(NonEmptyStringSchema),
          userPinned: Type.Boolean(),
          rationale: Type.Optional(NonEmptyStringSchema),
        },
        { additionalProperties: false },
      ),
    ),
    revisions: Type.Array(RevisionV1Schema, { minItems: 1 }),
  },
  { $id: "https://schemas.apexops.dev/sku-manifest-v1.json", additionalProperties: false },
);

export const ArchitectureV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    title: NonEmptyStringSchema,
    summary: NonEmptyStringSchema,
    sourceHashes: Type.Record(NonEmptyStringSchema, Sha256Schema),
    components: Type.Array(
      Type.Object(
        {
          id: NonEmptyStringSchema,
          service: NonEmptyStringSchema,
          purpose: NonEmptyStringSchema,
          requirementIds: Type.Array(NonEmptyStringSchema, { uniqueItems: true }),
          dependsOn: Type.Array(NonEmptyStringSchema, { uniqueItems: true }),
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
    decisions: Type.Array(NonEmptyStringSchema),
    risks: Type.Array(NonEmptyStringSchema),
  },
  { $id: "https://schemas.apexops.dev/architecture-v1.json", additionalProperties: false },
);

export const CostLineItemV1Schema = Type.Object(
  {
    id: NonEmptyStringSchema,
    service: NonEmptyStringSchema,
    sku: NonEmptyStringSchema,
    quantity: Type.Number({ minimum: 0 }),
    unitPrice: Type.Number({ minimum: 0 }),
    unitsPerMonth: Type.Number({ minimum: 0 }),
    monthlyCost: Type.Number({ minimum: 0 }),
    source: Type.Object(
      {
        provider: NonEmptyStringSchema,
        uri: NonEmptyStringSchema,
        retrievedAt: IsoDateTimeSchema,
        priceId: Type.Optional(NonEmptyStringSchema),
      },
      { additionalProperties: false },
    ),
    uncertainty: Type.Object(
      {
        lowerMonthlyCost: Type.Number({ minimum: 0 }),
        upperMonthlyCost: Type.Number({ minimum: 0 }),
        confidence: ConfidenceSchema,
        basis: NonEmptyStringSchema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const CostEstimateV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    currency: CurrencySchema,
    pricingDate: Type.String({ format: "date" }),
    lineItems: Type.Array(CostLineItemV1Schema, { minItems: 1 }),
    totalMonthlyCost: Type.Number({ minimum: 0 }),
    assumptions: Type.Array(NonEmptyStringSchema),
  },
  { $id: "https://schemas.apexops.dev/cost-estimate-v1.json", additionalProperties: false },
);

export const ReviewFindingsV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    subjectKind: NonEmptyStringSchema,
    subjectHash: Sha256Schema,
    reviewedAt: IsoDateTimeSchema,
    findings: Type.Array(
      Type.Object(
        {
          id: NonEmptyStringSchema,
          severity: SeveritySchema,
          disposition: DispositionSchema,
          title: NonEmptyStringSchema,
          detail: NonEmptyStringSchema,
          evidenceRefs: Type.Array(Sha256Schema, { uniqueItems: true }),
          resolution: Type.Optional(NonEmptyStringSchema),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { $id: "https://schemas.apexops.dev/review-findings-v1.json", additionalProperties: false },
);

export const GovernanceConstraintsV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    targetScope: NonEmptyStringSchema,
    discoveredAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    summary: Type.Object(
      {
        assignmentCount: Type.Integer({ minimum: 0 }),
        denyCount: Type.Integer({ minimum: 0 }),
        modifyCount: Type.Integer({ minimum: 0 }),
        auditCount: Type.Integer({ minimum: 0 }),
        exemptionCount: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
    constraintsRef: Type.Object(
      {
        mediaType: Type.Literal("application/json"),
        uri: NonEmptyStringSchema,
        digest: Sha256Schema,
        bytes: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
  },
  { $id: "https://schemas.apexops.dev/governance-constraints-v1.json", additionalProperties: false },
);

export const PolicyPropertyMapV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    governanceHash: Sha256Schema,
    mappings: Type.Array(
      Type.Object(
        {
          policyAssignmentId: NonEmptyStringSchema,
          effect: Type.Union([
            Type.Literal("deny"),
            Type.Literal("modify"),
            Type.Literal("append"),
            Type.Literal("audit"),
            Type.Literal("deployIfNotExists"),
            Type.Literal("disabled"),
          ]),
          logicalResourceId: NonEmptyStringSchema,
          propertyPath: NonEmptyStringSchema,
          expectedValue: Type.Optional(Type.Unknown()),
          disposition: Type.Union([
            Type.Literal("satisfied"),
            Type.Literal("planned"),
            Type.Literal("exempt"),
            Type.Literal("blocked"),
          ]),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { $id: "https://schemas.apexops.dev/policy-property-map-v1.json", additionalProperties: false },
);

export const SecretReferenceV1Schema = Type.Object(
  {
    kind: Type.Literal("secret-reference"),
    provider: Type.Union([
      Type.Literal("environment"),
      Type.Literal("azure-key-vault"),
      Type.Literal("github-actions"),
    ]),
    reference: NonEmptyStringSchema,
    version: Type.Optional(NonEmptyStringSchema),
  },
  { additionalProperties: false },
);

export const EnvironmentInputsV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    environment: EnvironmentSchema,
    inputs: Type.Record(
      NonEmptyStringSchema,
      Type.Union([
        Type.Object(
          {
            kind: Type.Literal("value"),
            value: Type.Union([Type.String(), Type.Number(), Type.Boolean()]),
          },
          { additionalProperties: false },
        ),
        SecretReferenceV1Schema,
      ]),
    ),
  },
  { $id: "https://schemas.apexops.dev/environment-inputs-v1.json", additionalProperties: false },
);

export const LogicalResourceManifestV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    track: IacToolSchema,
    resources: Type.Array(
      Type.Object(
        {
          logicalId: NonEmptyStringSchema,
          type: NonEmptyStringSchema,
          implementationAddress: NonEmptyStringSchema,
          implementationKind: Type.Union([
            Type.Literal("resource"),
            Type.Literal("module"),
            Type.Literal("data"),
            Type.Literal("existing"),
          ]),
          ownership: Type.Union([Type.Literal("existing"), Type.Literal("managed")]),
          dependsOn: Type.Array(NonEmptyStringSchema, { uniqueItems: true }),
          generatedDependencies: Type.Array(NonEmptyStringSchema, { uniqueItems: true }),
          sourcePath: NonEmptyStringSchema,
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
  },
  { $id: "https://schemas.apexops.dev/logical-resource-manifest-v1.json", additionalProperties: false },
);

export const IacHandoffV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    track: IacToolSchema,
    rootPath: NonEmptyStringSchema,
    treeHash: Sha256Schema,
    intentHash: Sha256Schema,
    bindingHash: Sha256Schema,
    environmentInputsHash: Sha256Schema,
    logicalResourceManifestHash: Sha256Schema,
    requiredToolVersions: Type.Record(NonEmptyStringSchema, NonEmptyStringSchema),
    generatedAt: IsoDateTimeSchema,
  },
  { $id: "https://schemas.apexops.dev/iac-handoff-v1.json", additionalProperties: false },
);

export const ExecutionPlanAttestationV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    track: IacToolSchema,
    previewHash: Sha256Schema,
    inputHash: Sha256Schema,
    iacHash: Sha256Schema,
    policyHash: Sha256Schema,
    configHash: Sha256Schema,
    lockfileHash: Sha256Schema,
    recipient: NonEmptyStringSchema,
    planDigest: Sha256Schema,
    artifactRef: NonEmptyStringSchema,
    stateLineage: Type.Optional(NonEmptyStringSchema),
    stateSerial: Type.Optional(Type.Integer({ minimum: 0 })),
    transport: Type.Object(
      {
        encrypted: Type.Literal(true),
        implementation: Type.Literal("local-reference"),
        algorithm: Type.Literal("aes-256-gcm"),
        recipient: NonEmptyStringSchema,
        mediaType: NonEmptyStringSchema,
        iv: NonEmptyStringSchema,
        authTag: NonEmptyStringSchema,
      },
      { additionalProperties: false },
    ),
    createdAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
  },
  { $id: "https://schemas.apexops.dev/execution-plan-attestation-v1.json", additionalProperties: false },
);

export const ScenarioV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    id: NonEmptyStringSchema,
    title: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
    inputs: Type.Record(NonEmptyStringSchema, Type.Unknown()),
    expectedOutcomes: Type.Array(NonEmptyStringSchema, { minItems: 1 }),
    tags: Type.Array(NonEmptyStringSchema, { uniqueItems: true }),
  },
  { $id: "https://schemas.apexops.dev/scenario-v1.json", additionalProperties: false },
);

export const QualityReportV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    evaluatedAt: IsoDateTimeSchema,
    scorecardHash: Sha256Schema,
    measurementsHash: Sha256Schema,
    status: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
    checks: Type.Array(
      Type.Object(
        {
          id: NonEmptyStringSchema,
          scenario: NonEmptyStringSchema,
          status: Type.Union([Type.Literal("pass"), Type.Literal("fail"), Type.Literal("omitted")]),
          value: Type.Optional(Type.Number()),
          samples: Type.Integer({ minimum: 0 }),
          evidenceRefs: Type.Array(Sha256Schema, { uniqueItems: true }),
          detail: NonEmptyStringSchema,
        },
        { additionalProperties: false },
      ),
    ),
  },
  { $id: "https://schemas.apexops.dev/quality-report-v1.json", additionalProperties: false },
);

export const TelemetryV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    eventId: NonEmptyStringSchema,
    timestamp: IsoDateTimeSchema,
    metric: NonEmptyStringSchema,
    value: Type.Number(),
    unit: NonEmptyStringSchema,
    consent: Type.Object(
      {
        status: Type.Union([Type.Literal("granted"), Type.Literal("denied"), Type.Literal("not-required")]),
        scope: NonEmptyStringSchema,
      },
      { additionalProperties: false },
    ),
    source: Type.Union([
      Type.Literal("kernel"),
      Type.Literal("cli"),
      Type.Literal("vscode"),
      Type.Literal("estimated"),
    ]),
    confidence: ConfidenceSchema,
    dimensions: Type.Record(NonEmptyStringSchema, Type.String()),
  },
  { $id: "https://schemas.apexops.dev/telemetry-v1.json", additionalProperties: false },
);

export const DiagnosisV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    diagnosedAt: IsoDateTimeSchema,
    status: Type.Union([
      Type.Literal("healthy"),
      Type.Literal("degraded"),
      Type.Literal("failed"),
      Type.Literal("unknown"),
    ]),
    observations: Type.Array(NonEmptyStringSchema),
    causes: Type.Array(
      Type.Object(
        {
          id: NonEmptyStringSchema,
          summary: NonEmptyStringSchema,
          confidence: ConfidenceSchema,
          evidenceRefs: Type.Array(Sha256Schema, { uniqueItems: true }),
          remediation: Type.Optional(NonEmptyStringSchema),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { $id: "https://schemas.apexops.dev/diagnosis-v1.json", additionalProperties: false },
);

export const CapabilityPackManifestV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    id: NonEmptyStringSchema,
    version: NonEmptyStringSchema,
    digest: Sha256Schema,
    capabilities: Type.Array(NonEmptyStringSchema, { minItems: 1, uniqueItems: true }),
    entrypoints: Type.Record(NonEmptyStringSchema, NonEmptyStringSchema),
    requires: Type.Array(NonEmptyStringSchema, { uniqueItems: true }),
  },
  { $id: "https://schemas.apexops.dev/capability-pack-manifest-v1.json", additionalProperties: false },
);

export const CustomizationLockV1Schema = Type.Object(
  {
    schemaVersion: ContractVersionSchema,
    customizationId: NonEmptyStringSchema,
    version: NonEmptyStringSchema,
    manifestHash: Sha256Schema,
    capabilityPacks: Type.Array(
      Type.Object(
        {
          id: NonEmptyStringSchema,
          version: NonEmptyStringSchema,
          digest: Sha256Schema,
        },
        { additionalProperties: false },
      ),
      { uniqueItems: true },
    ),
    lockedAt: IsoDateTimeSchema,
  },
  { $id: "https://schemas.apexops.dev/customization-lock-v1.json", additionalProperties: false },
);

export type SkuManifestV1 = Static<typeof SkuManifestV1Schema>;
export type ArchitectureV1 = Static<typeof ArchitectureV1Schema>;
export type CostEstimateV1 = Static<typeof CostEstimateV1Schema>;
export type ReviewFindingsV1 = Static<typeof ReviewFindingsV1Schema>;
export type GovernanceConstraintsV1 = Static<typeof GovernanceConstraintsV1Schema>;
export type PolicyPropertyMapV1 = Static<typeof PolicyPropertyMapV1Schema>;
export type EnvironmentInputsV1 = Static<typeof EnvironmentInputsV1Schema>;
export type LogicalResourceManifestV1 = Static<typeof LogicalResourceManifestV1Schema>;
export type IacHandoffV1 = Static<typeof IacHandoffV1Schema>;
export type ExecutionPlanAttestationV1 = Static<typeof ExecutionPlanAttestationV1Schema>;
export type ScenarioV1 = Static<typeof ScenarioV1Schema>;
export type QualityReportV1 = Static<typeof QualityReportV1Schema>;
export type TelemetryV1 = Static<typeof TelemetryV1Schema>;
export type DiagnosisV1 = Static<typeof DiagnosisV1Schema>;
export type CapabilityPackManifestV1 = Static<typeof CapabilityPackManifestV1Schema>;
export type CustomizationLockV1 = Static<typeof CustomizationLockV1Schema>;

const arithmeticEqual = (left: number, right: number): boolean => Math.abs(left - right) <= 0.000001;

export function hasValidCostArithmetic(estimate: CostEstimateV1): boolean {
  const linesAreValid = estimate.lineItems.every(
    (line) =>
      arithmeticEqual(line.monthlyCost, line.quantity * line.unitPrice * line.unitsPerMonth) &&
      line.uncertainty.lowerMonthlyCost <= line.monthlyCost &&
      line.monthlyCost <= line.uncertainty.upperMonthlyCost,
  );
  const lineTotal = estimate.lineItems.reduce((total, line) => total + line.monthlyCost, 0);
  return linesAreValid && arithmeticEqual(estimate.totalMonthlyCost, lineTotal);
}

export function hasOnlyTypedSecretReferences(inputs: EnvironmentInputsV1): boolean {
  return Object.values(inputs.inputs).every(
    (input) => input.kind === "value" || (input.kind === "secret-reference" && input.reference.length > 0),
  );
}

export function hasValidLogicalResourceReferences(manifest: LogicalResourceManifestV1): boolean {
  const ids = manifest.resources.map((resource) => resource.logicalId);
  const knownIds = new Set(ids);
  return (
    new Set(ids).size === ids.length &&
    manifest.resources.every((resource) => resource.dependsOn.every((id) => knownIds.has(id)))
  );
}

export function hasValidPreviewApprovalBinding(
  attestation: ExecutionPlanAttestationV1,
  preview: DeploymentPreviewV1,
  approval: ApprovalEvidenceV1,
): boolean {
  const writerAuthorityMatches =
    (approval.writerEpoch === preview.ownerEpoch && approval.writerTransferClaimHash === undefined) ||
    (approval.writerEpoch === preview.ownerEpoch + 1 && approval.writerTransferClaimHash !== undefined);
  return (
    attestation.projectId === preview.projectId &&
    attestation.projectId === approval.projectId &&
    attestation.runId === preview.runId &&
    attestation.runId === approval.runId &&
    attestation.track === preview.track &&
    attestation.previewHash === preview.previewHash &&
    approval.previewHash === preview.previewHash &&
    attestation.inputHash === preview.inputHash &&
    attestation.iacHash === preview.iacHash &&
    attestation.policyHash === preview.policyHash &&
    attestation.recipient === attestation.transport.recipient &&
    attestation.stateLineage === preview.stateLineage &&
    attestation.stateSerial === preview.stateSerial &&
    approval.recipientIdentity === attestation.transport.recipient &&
    writerAuthorityMatches
  );
}
