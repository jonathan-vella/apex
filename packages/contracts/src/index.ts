export * from "./artifacts.js";
export * from "./common.js";
export * from "./deployment.js";
export * from "./evidence.js";
export * from "./runtime.js";
export * from "./targets.js";

import { IacBindingV1Schema, ImplementationIntentV1Schema, RequirementsV1Schema } from "./artifacts.js";
import {
  ApprovalEvidenceV1Schema,
  DeploymentPreviewV1Schema,
  OperationRecordV1Schema,
  ResourceInventoryV1Schema,
} from "./deployment.js";
import {
  ArchitectureAvailabilityV1Schema,
  EvidenceManifestV1Schema,
  LiveQualificationV1Schema,
  QualityMeasurementsV1Schema,
  QualityScorecardV1Schema,
} from "./evidence.js";
import {
  EventV1Schema,
  ProjectConfigV1Schema,
  RunConfigV1Schema,
  RuntimeBundleLockV1Schema,
  TaskEnvelopeV1Schema,
} from "./runtime.js";
import {
  ArchitectureV1Schema,
  CapabilityPackManifestV1Schema,
  CostEstimateV1Schema,
  CustomizationLockV1Schema,
  DiagnosisV1Schema,
  EnvironmentInputsV1Schema,
  ExecutionPlanAttestationV1Schema,
  GovernanceConstraintsV1Schema,
  IacHandoffV1Schema,
  LogicalResourceManifestV1Schema,
  PolicyPropertyMapV1Schema,
  QualityReportV1Schema,
  ReviewFindingsV1Schema,
  ScenarioV1Schema,
  SkuManifestV1Schema,
  TelemetryV1Schema,
} from "./targets.js";

export const contractSchemas = [
  RuntimeBundleLockV1Schema,
  ProjectConfigV1Schema,
  RunConfigV1Schema,
  TaskEnvelopeV1Schema,
  EventV1Schema,
  RequirementsV1Schema,
  ImplementationIntentV1Schema,
  IacBindingV1Schema,
  ApprovalEvidenceV1Schema,
  DeploymentPreviewV1Schema,
  OperationRecordV1Schema,
  ResourceInventoryV1Schema,
  EvidenceManifestV1Schema,
  LiveQualificationV1Schema,
  QualityScorecardV1Schema,
  QualityMeasurementsV1Schema,
  ArchitectureAvailabilityV1Schema,
  SkuManifestV1Schema,
  ArchitectureV1Schema,
  CostEstimateV1Schema,
  ReviewFindingsV1Schema,
  GovernanceConstraintsV1Schema,
  PolicyPropertyMapV1Schema,
  EnvironmentInputsV1Schema,
  LogicalResourceManifestV1Schema,
  IacHandoffV1Schema,
  ExecutionPlanAttestationV1Schema,
  ScenarioV1Schema,
  QualityReportV1Schema,
  TelemetryV1Schema,
  DiagnosisV1Schema,
  CapabilityPackManifestV1Schema,
  CustomizationLockV1Schema,
] as const;

export type ContractSensitivity = "public" | "internal" | "confidential" | "restricted";
export type ContractCompatibility = "strict-v1";

export interface ContractMetadata {
  maxBytes: number;
  sensitivity: ContractSensitivity;
  compatibility: ContractCompatibility;
}

const metadata = (maxBytes: number, sensitivity: ContractSensitivity = "internal"): ContractMetadata => ({
  maxBytes,
  sensitivity,
  compatibility: "strict-v1",
});

export const contractMetadata: Readonly<Record<string, ContractMetadata>> = {
  "https://schemas.apexops.dev/runtime-bundle-lock-v1.json": metadata(32_768),
  "https://schemas.apexops.dev/project-config-v1.json": metadata(16_384),
  "https://schemas.apexops.dev/run-config-v1.json": metadata(65_536, "confidential"),
  "https://schemas.apexops.dev/task-envelope-v1.json": metadata(131_072, "confidential"),
  "https://schemas.apexops.dev/event-v1.json": metadata(262_144, "confidential"),
  "https://schemas.apexops.dev/requirements-v1.json": metadata(524_288, "confidential"),
  "https://schemas.apexops.dev/implementation-intent-v1.json": metadata(524_288),
  "https://schemas.apexops.dev/iac-binding-v1.json": metadata(524_288, "confidential"),
  "https://schemas.apexops.dev/approval-evidence-v1.json": metadata(32_768, "confidential"),
  "https://schemas.apexops.dev/deployment-preview-v1.json": metadata(2_097_152, "confidential"),
  "https://schemas.apexops.dev/operation-record-v1.json": metadata(65_536, "confidential"),
  "https://schemas.apexops.dev/resource-inventory-v1.json": metadata(4_194_304, "confidential"),
  "https://schemas.apexops.dev/evidence-manifest-v1.json": metadata(524_288, "confidential"),
  "https://schemas.apexops.dev/live-qualification-v1.json": metadata(1_048_576, "confidential"),
  "https://schemas.apexops.dev/quality-scorecard-v1.json": metadata(262_144, "public"),
  "https://schemas.apexops.dev/quality-measurements-v1.json": metadata(1_048_576, "confidential"),
  "https://schemas.apexops.dev/architecture-availability-v1.json": metadata(131_072, "confidential"),
  "https://schemas.apexops.dev/sku-manifest-v1.json": metadata(524_288),
  "https://schemas.apexops.dev/architecture-v1.json": metadata(1_048_576),
  "https://schemas.apexops.dev/cost-estimate-v1.json": metadata(1_048_576, "confidential"),
  "https://schemas.apexops.dev/review-findings-v1.json": metadata(1_048_576, "confidential"),
  "https://schemas.apexops.dev/governance-constraints-v1.json": metadata(131_072, "confidential"),
  "https://schemas.apexops.dev/policy-property-map-v1.json": metadata(2_097_152, "confidential"),
  "https://schemas.apexops.dev/environment-inputs-v1.json": metadata(524_288, "restricted"),
  "https://schemas.apexops.dev/logical-resource-manifest-v1.json": metadata(2_097_152),
  "https://schemas.apexops.dev/iac-handoff-v1.json": metadata(131_072, "confidential"),
  "https://schemas.apexops.dev/execution-plan-attestation-v1.json": metadata(131_072, "restricted"),
  "https://schemas.apexops.dev/scenario-v1.json": metadata(524_288, "public"),
  "https://schemas.apexops.dev/quality-report-v1.json": metadata(1_048_576, "confidential"),
  "https://schemas.apexops.dev/telemetry-v1.json": metadata(65_536, "confidential"),
  "https://schemas.apexops.dev/diagnosis-v1.json": metadata(1_048_576, "confidential"),
  "https://schemas.apexops.dev/capability-pack-manifest-v1.json": metadata(262_144, "public"),
  "https://schemas.apexops.dev/customization-lock-v1.json": metadata(262_144, "public"),
};

export const schemaById: Readonly<Record<string, (typeof contractSchemas)[number]>> = Object.fromEntries(
  contractSchemas.map((schema) => [schema.$id, schema]),
);

export function hasCompleteContractMetadata(): boolean {
  const schemaIds = contractSchemas.map((schema) => schema.$id);
  const metadataIds = Object.keys(contractMetadata);
  return (
    schemaIds.every((id) => id !== undefined && (contractMetadata[id]?.maxBytes ?? 0) > 0) &&
    new Set(schemaIds).size === schemaIds.length &&
    metadataIds.length === schemaIds.length &&
    metadataIds.every((id) => schemaById[id] !== undefined)
  );
}
