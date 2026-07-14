import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  ApprovalEvidenceV1Schema,
  ArchitectureV1Schema,
  CapabilityPackManifestV1Schema,
  CONTRACT_VERSION,
  CostEstimateV1Schema,
  CustomizationLockV1Schema,
  DeploymentPreviewV1Schema,
  DiagnosisV1Schema,
  EnvironmentInputsV1Schema,
  ExecutionPlanAttestationV1Schema,
  GovernanceConstraintsV1Schema,
  IacHandoffV1Schema,
  LogicalResourceManifestV1Schema,
  PolicyPropertyMapV1Schema,
  QualityReportV1Schema,
  QualityMeasurementsV1Schema,
  ArchitectureAvailabilityV1Schema,
  RequirementsV1Schema,
  ReviewFindingsV1Schema,
  RuntimeBundleLockV1Schema,
  ScenarioV1Schema,
  SkuManifestV1Schema,
  TelemetryV1Schema,
  contractMetadata,
  contractSchemas,
  hasCompleteContractMetadata,
  hasOnlyTypedSecretReferences,
  hasValidCostArithmetic,
  hasValidLogicalResourceReferences,
  hasValidPreviewApprovalBinding,
  schemaById,
  type ApprovalEvidenceV1,
  type CostEstimateV1,
  type DeploymentPreviewV1,
  type EnvironmentInputsV1,
  type ExecutionPlanAttestationV1,
  type LogicalResourceManifestV1,
  type RequirementsV1,
  type RuntimeBundleLockV1,
} from "../index.js";
import {
  CONTRACT_METADATA_FILENAME,
  JSON_SCHEMA_DIALECT,
  createContractMetadataFile,
  createContractSchemaFiles,
} from "../schema-export.js";

const hash = "a".repeat(64);
const otherHash = "b".repeat(64);
const timestamp = "2026-07-13T12:00:00.000Z";
const expiry = "2026-07-13T13:00:00.000Z";

FormatRegistry.Set("date-time", (value) => Number.isFinite(Date.parse(value)));
FormatRegistry.Set(
  "date",
  (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)),
);

describe("Wave 1 contracts", () => {
  it("uses one explicit persisted contract version", () => {
    const lock: RuntimeBundleLockV1 = {
      schemaVersion: CONTRACT_VERSION,
      cliVersion: "0.1.0",
      customizationVersion: "0.1.0",
      workflowHash: "a".repeat(64),
      defaultsHash: "b".repeat(64),
      validatorHash: "c".repeat(64),
      qualityScorecardHash: "d".repeat(64),
      requiredCapabilityPacks: [],
    };

    assert.equal(lock.schemaVersion, "1.0.0");
    assert.equal(Value.Check(RuntimeBundleLockV1Schema, lock), true);
  });

  it("validates requirements from the walking skeleton", () => {
    const requirements: RequirementsV1 = {
      schemaVersion: CONTRACT_VERSION,
      projectId: "example-project",
      workload: "Secure web API",
      environment: "dev",
      requirements: [
        {
          id: "REQ-001",
          statement: "Use managed identity",
          priority: "must",
          status: "confirmed",
          source: "user",
        },
      ],
      assumptions: [],
      unknowns: [],
    };

    assert.equal(Value.Check(RequirementsV1Schema, requirements), true);
  });

  it("publishes an id for every registered schema", () => {
    assert.ok(contractSchemas.length > 0);
    for (const schema of contractSchemas) {
      assert.match(schema.$id ?? "", /^https:\/\/schemas\.apexops\.dev\//);
    }
  });
});

describe("persisted contract schemas", () => {
  const schemasDirectory = fileURLToPath(new URL("../../schemas/", import.meta.url));
  const generatedSchemas = createContractSchemaFiles();

  it("matches the registry inventory and committed bytes deterministically", async () => {
    const expectedFilenames = generatedSchemas.map(({ filename }) => filename);
    const actualFilenames = (await readdir(schemasDirectory))
      .filter((filename) => filename.endsWith(".schema.json"))
      .sort();

    assert.deepEqual(actualFilenames, expectedFilenames);
    assert.equal(new Set(expectedFilenames).size, contractSchemas.length);
    for (const generated of generatedSchemas) {
      const committed = await readFile(new URL(`../../schemas/${generated.filename}`, import.meta.url), "utf8");
      assert.equal(committed, generated.contents);
      assert.equal(
        generated.contents,
        createContractSchemaFiles().find(({ filename }) => filename === generated.filename)?.contents,
      );
    }
  });

  it("includes identifiers, dialect, strict objects, and TypeBox-compatible schemas", () => {
    for (const generated of generatedSchemas) {
      const sourceSchema = contractSchemas.find((schema) => schema.$id === generated.schema.$id);
      assert.ok(sourceSchema);
      assert.equal(generated.schema.$schema, JSON_SCHEMA_DIALECT);
      assert.equal(generated.schema.additionalProperties, false);
      assert.equal(Value.Check(generated.schema, {}), Value.Check(sourceSchema, {}));
    }
  });

  it("matches the metadata registry inventory and committed bytes", async () => {
    const contents = createContractMetadataFile();
    const committed = await readFile(new URL(`../../schemas/${CONTRACT_METADATA_FILENAME}`, import.meta.url), "utf8");
    const persistedMetadata = JSON.parse(contents) as Record<string, unknown>;

    assert.equal(committed, contents);
    assert.deepEqual(Object.keys(persistedMetadata).sort(), contractSchemas.map((schema) => schema.$id).sort());
  });
});

describe("target family contracts", () => {
  const fixtures = [
    [
      SkuManifestV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        environments: ["dev", "prod"],
        services: [
          {
            logicalId: "api",
            service: "Azure App Service",
            environment: "prod",
            sku: "P1v3",
            userPinned: true,
            rationale: "User capacity requirement",
          },
        ],
        revisions: [{ number: 1, createdAt: timestamp, sourceHash: hash, reason: "Initial user pins" }],
      },
    ],
    [
      ArchitectureV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        title: "Web API",
        summary: "Managed web API architecture",
        sourceHashes: { requirements: hash },
        components: [
          {
            id: "api",
            service: "Azure App Service",
            purpose: "Host API",
            requirementIds: ["REQ-001"],
            dependsOn: [],
          },
        ],
        decisions: ["Use managed identity"],
        risks: [],
      },
    ],
    [
      CostEstimateV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        currency: "USD",
        pricingDate: "2026-07-13",
        lineItems: [
          {
            id: "api-compute",
            service: "Azure App Service",
            sku: "P1v3",
            quantity: 2,
            unitPrice: 0.1,
            unitsPerMonth: 730,
            monthlyCost: 146,
            source: { provider: "Azure Retail Prices", uri: "https://prices.azure.com", retrievedAt: timestamp },
            uncertainty: { lowerMonthlyCost: 140, upperMonthlyCost: 155, confidence: "high", basis: "Usage range" },
          },
        ],
        totalMonthlyCost: 146,
        assumptions: ["Two continuously running instances"],
      },
    ],
    [
      ReviewFindingsV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        subjectKind: "architecture-v1",
        subjectHash: hash,
        reviewedAt: timestamp,
        findings: [
          {
            id: "finding-1",
            severity: "medium",
            disposition: "remediated",
            title: "Missing zone detail",
            detail: "Availability zones were not explicit",
            evidenceRefs: [otherHash],
            resolution: "Added zone-redundant deployment",
          },
        ],
      },
    ],
    [
      GovernanceConstraintsV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        targetScope: "/subscriptions/example",
        discoveredAt: timestamp,
        expiresAt: expiry,
        summary: { assignmentCount: 3, denyCount: 1, modifyCount: 1, auditCount: 1, exemptionCount: 0 },
        constraintsRef: { mediaType: "application/json", uri: "artifact://governance/full", digest: hash, bytes: 4096 },
      },
    ],
    [
      PolicyPropertyMapV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        governanceHash: hash,
        mappings: [
          {
            policyAssignmentId: "/providers/Microsoft.Authorization/policyAssignments/tls",
            effect: "deny",
            logicalResourceId: "api",
            propertyPath: "siteConfig.minTlsVersion",
            expectedValue: "1.2",
            disposition: "satisfied",
          },
        ],
      },
    ],
    [
      EnvironmentInputsV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        environment: "prod",
        inputs: {
          location: { kind: "value", value: "swedencentral" },
          deploymentToken: { kind: "secret-reference", provider: "environment", reference: "DEPLOYMENT_TOKEN" },
        },
      },
    ],
    [
      LogicalResourceManifestV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        track: "bicep",
        resources: [
          {
            logicalId: "plan",
            type: "Microsoft.Web/serverfarms",
            implementationAddress: "plan",
            implementationKind: "resource",
            ownership: "managed",
            dependsOn: [],
            generatedDependencies: [],
            sourcePath: "main.bicep",
          },
          {
            logicalId: "api",
            type: "Microsoft.Web/sites",
            implementationAddress: "api",
            implementationKind: "resource",
            ownership: "managed",
            dependsOn: ["plan"],
            generatedDependencies: ["plan"],
            sourcePath: "main.bicep",
          },
        ],
      },
    ],
    [
      IacHandoffV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        track: "bicep",
        rootPath: "infra/bicep/example-project",
        treeHash: hash,
        intentHash: hash,
        bindingHash: hash,
        environmentInputsHash: hash,
        logicalResourceManifestHash: hash,
        requiredToolVersions: { bicep: "0.38.3" },
        generatedAt: timestamp,
      },
    ],
    [
      ExecutionPlanAttestationV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        track: "terraform",
        previewHash: hash,
        inputHash: hash,
        iacHash: hash,
        policyHash: hash,
        configHash: hash,
        lockfileHash: hash,
        recipient: "deploy-prod",
        planDigest: otherHash,
        artifactRef: "plans/run-1/apply.enc",
        stateLineage: "lineage-1",
        stateSerial: 7,
        transport: {
          encrypted: true,
          implementation: "local-reference",
          algorithm: "aes-256-gcm",
          recipient: "deploy-prod",
          mediaType: "application/octet-stream",
          iv: "base64-iv",
          authTag: "base64-auth-tag",
        },
        createdAt: timestamp,
        expiresAt: expiry,
      },
    ],
    [
      ScenarioV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        id: "managed-web-api",
        title: "Managed web API",
        description: "Validates a managed identity deployment",
        inputs: { environment: "dev" },
        expectedOutcomes: ["Deployment succeeds"],
        tags: ["web", "identity"],
      },
    ],
    [
      QualityReportV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        evaluatedAt: timestamp,
        scorecardHash: hash,
        measurementsHash: hash,
        status: "pass",
        checks: [
          {
            id: "schema",
            scenario: "contracts",
            status: "pass",
            value: 1,
            samples: 1,
            evidenceRefs: [hash],
            detail: "target satisfied",
          },
        ],
      },
    ],
    [
      QualityMeasurementsV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        measurements: [
          {
            metric: "schema",
            scenario: "contracts",
            value: 1,
            samples: 1,
            evidenceRefs: [hash],
          },
        ],
      },
    ],
    [
      ArchitectureAvailabilityV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        targetScope: "local",
        mode: "simulated",
        collectedAt: timestamp,
        expiresAt: expiry,
        checks: {
          pricing: { status: "current", evidenceRef: hash },
          quota: { status: "current", evidenceRef: hash },
          regionalAvailability: { status: "current", evidenceRef: hash },
        },
      },
    ],
    [
      TelemetryV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        eventId: "event-1",
        timestamp,
        metric: "run.duration",
        value: 42,
        unit: "seconds",
        consent: { status: "granted", scope: "product-improvement" },
        source: "kernel",
        confidence: "high",
        dimensions: { workflow: "apex-workflow-v1" },
      },
    ],
    [
      DiagnosisV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        projectId: "example-project",
        runId: "run-1",
        diagnosedAt: timestamp,
        status: "degraded",
        observations: ["Health probe failed"],
        causes: [
          {
            id: "cause-1",
            summary: "Probe path mismatch",
            confidence: "high",
            evidenceRefs: [hash],
            remediation: "Align the probe path",
          },
        ],
      },
    ],
    [
      CapabilityPackManifestV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        id: "azure-core",
        version: "1.2.0",
        digest: hash,
        capabilities: ["azure.preview", "azure.deploy"],
        entrypoints: { preview: "./preview.js" },
        requires: ["azure-cli>=2.75"],
      },
    ],
    [
      CustomizationLockV1Schema,
      {
        schemaVersion: CONTRACT_VERSION,
        customizationId: "apex-default",
        version: "1.0.0",
        manifestHash: hash,
        capabilityPacks: [{ id: "azure-core", version: "1.2.0", digest: otherHash }],
        lockedAt: timestamp,
      },
    ],
  ] as const;

  it("validates a representative fixture for every target family", () => {
    for (const [schema, fixture] of fixtures) {
      assert.equal(Value.Check(schema, fixture), true, schema.$id ?? "unidentified schema");
    }
  });

  it("validates reproducible cost arithmetic and uncertainty bounds", () => {
    const estimate = fixtures[2][1] as unknown as CostEstimateV1;
    assert.equal(hasValidCostArithmetic(estimate), true);
    assert.equal(hasValidCostArithmetic({ ...estimate, totalMonthlyCost: 145 }), false);
  });

  it("permits secret references but rejects secret literal fields", () => {
    const inputs = fixtures[6][1] as EnvironmentInputsV1;
    assert.equal(hasOnlyTypedSecretReferences(inputs), true);
    assert.equal(
      Value.Check(EnvironmentInputsV1Schema, {
        ...inputs,
        inputs: {
          deploymentToken: { kind: "secret-reference", provider: "environment", reference: "TOKEN", value: "secret" },
        },
      }),
      false,
    );
  });

  it("requires unique logical IDs and resolvable dependency references", () => {
    const manifest = fixtures[7][1] as unknown as LogicalResourceManifestV1;
    assert.equal(hasValidLogicalResourceReferences(manifest), true);
    assert.equal(
      hasValidLogicalResourceReferences({
        ...manifest,
        resources: [
          ...manifest.resources,
          {
            logicalId: "duplicate-plan",
            type: "Microsoft.Web/serverfarms",
            implementationAddress: "duplicatePlan",
            implementationKind: "resource",
            ownership: "managed",
            dependsOn: ["missing"],
            generatedDependencies: ["missing"],
            sourcePath: "main.bicep",
          },
        ],
      }),
      false,
    );
  });

  it("binds encrypted plan attestations to the preview and approval recipient", () => {
    const attestation = fixtures[9][1] as ExecutionPlanAttestationV1;
    const preview: DeploymentPreviewV1 = {
      schemaVersion: CONTRACT_VERSION,
      projectId: "example-project",
      runId: "run-1",
      environment: "prod",
      track: "terraform",
      operation: "apply",
      target: "/subscriptions/example",
      commit: hash,
      dependencyRevision: hash,
      ownerEpoch: 1,
      inputHash: hash,
      iacHash: hash,
      policyHash: hash,
      stateLineage: "lineage-1",
      stateSerial: 7,
      changes: [],
      blockers: [],
      createdAt: timestamp,
      expiresAt: expiry,
      previewHash: hash,
    };
    const approval: ApprovalEvidenceV1 = {
      schemaVersion: CONTRACT_VERSION,
      projectId: "example-project",
      runId: "run-1",
      gate: 4,
      decision: "approved",
      actor: "release-manager",
      mechanism: "github-environment",
      dependencyHash: hash,
      previewHash: hash,
      writerEpoch: 1,
      recipientIdentity: "deploy-prod",
      decidedAt: timestamp,
      expiresAt: expiry,
    };

    assert.equal(Value.Check(ExecutionPlanAttestationV1Schema, attestation), true);
    assert.equal(Value.Check(DeploymentPreviewV1Schema, preview), true);
    assert.equal(Value.Check(ApprovalEvidenceV1Schema, approval), true);
    assert.equal(hasValidPreviewApprovalBinding(attestation, preview, approval), true);
    assert.equal(hasValidPreviewApprovalBinding(attestation, preview, { ...approval, previewHash: otherHash }), false);
  });

  it("provides complete metadata and lookup coverage for every schema", () => {
    assert.equal(hasCompleteContractMetadata(), true);
    assert.equal(Object.keys(schemaById).length, contractSchemas.length);
    assert.equal(Object.keys(contractMetadata).length, contractSchemas.length);
    for (const schema of contractSchemas) {
      assert.equal(schemaById[schema.$id ?? ""], schema);
      assert.ok((contractMetadata[schema.$id ?? ""]?.maxBytes ?? 0) > 0);
    }
  });
});
