import assert from "node:assert/strict";
import test from "node:test";
import type {
  ApprovalEvidenceV1,
  DeploymentPreviewV1,
  RequirementsV1,
  ResourceInventoryV1,
  RunConfigV1,
} from "@apex/contracts";
import {
  renderApprovalEvidence,
  renderDeploymentPreview,
  renderRequirements,
  renderResourceInventory,
  renderRunStatus,
} from "../index.js";

const hash = (character: string): string => character.repeat(64);

test("requirements rendering is deterministic, sorted, and escaped", () => {
  const input: RequirementsV1 = {
    schemaVersion: "1.0.0",
    projectId: "sample-project",
    workload: "API|worker\tpool\u0002",
    environment: "prod",
    requirements: [
      { id: "REQ-2", statement: "Second", priority: "should", status: "unknown", source: "user" },
      { id: "REQ-1", statement: "First|line\nnext", priority: "must", status: "confirmed", source: "brief" },
    ],
    assumptions: ["Zulu", "Alpha"],
    unknowns: ["Unknown B", "Unknown A"],
  };
  const reordered: RequirementsV1 = {
    ...input,
    requirements: [...input.requirements].reverse(),
    assumptions: [...input.assumptions].reverse(),
    unknowns: [...input.unknowns].reverse(),
  };

  const rendered = renderRequirements(input);
  assert.equal(rendered, renderRequirements(input));
  assert.equal(rendered, renderRequirements(reordered));
  assert.ok(rendered.indexOf("REQ-1") < rendered.indexOf("REQ-2"));
  assert.match(rendered, /First\\\|line<br>next/);
  assert.match(rendered, /API\\\|worker\\\\u0009pool\\\\u0002/);
  assert.doesNotMatch(rendered, /[\t\u0002]/);
});

test("run status displays sorted inherited gate provenance", () => {
  const gates: RunConfigV1["gates"] = [
    { gate: 4, state: "closed", dependencyHash: hash("d") },
    { gate: 2, state: "inherited", dependencyHash: hash("b"), inheritedFromRunId: "parent-run", reason: "promotion" },
    { gate: 1, state: "approved", dependencyHash: hash("a"), decidedAt: "2026-07-01T10:00:00Z" },
    { gate: 3, state: "open", dependencyHash: hash("c") },
  ];
  const run: RunConfigV1 = {
    schemaVersion: "1.0.0",
    projectId: "sample-project",
    runId: "prod-run",
    environment: "prod",
    targetScope: "/subscriptions/example",
    iacTool: "bicep",
    createdAt: "2026-07-01T09:00:00Z",
    runtimeLockHash: hash("e"),
    parentRunId: "parent-run",
    ownerEpoch: 3,
    gates,
  };

  const rendered = renderRunStatus(run);
  assert.equal(rendered, renderRunStatus({ ...run, gates: [...gates].reverse() }));
  assert.match(rendered, /\| 2 \| inherited \| parent-run \| - \| promotion \|/);
  assert.ok(rendered.indexOf("| 1 |") < rendered.indexOf("| 4 |"));
});

test("deployment preview emphasizes destructive changes and sorted blockers", () => {
  const preview: DeploymentPreviewV1 = {
    schemaVersion: "1.0.0",
    projectId: "sample-project",
    runId: "prod-run",
    environment: "prod",
    track: "terraform",
    operation: "apply",
    target: "production",
    commit: hash("a"),
    dependencyRevision: hash("a"),
    ownerEpoch: 2,
    inputHash: hash("b"),
    iacHash: hash("c"),
    policyHash: hash("d"),
    changes: [
      { resourceId: "z-resource", action: "delete", material: true, details: "data|loss" },
      { resourceId: "a-resource", action: "create", material: true },
    ],
    blockers: ["Zulu blocker", "Alpha|blocker"],
    createdAt: "2026-07-01T10:00:00Z",
    expiresAt: "2026-07-02T10:00:00Z",
    previewHash: hash("f"),
  };
  const reordered: DeploymentPreviewV1 = {
    ...preview,
    changes: [...preview.changes].reverse(),
    blockers: [...preview.blockers].reverse(),
  };

  const rendered = renderDeploymentPreview(preview);
  assert.equal(rendered, renderDeploymentPreview(reordered));
  assert.match(rendered, /\*\*DESTRUCTIVE CHANGES PRESENT\*\*/);
  assert.match(rendered, /\*\*DELETE\*\*/);
  assert.match(rendered, /\*\*BLOCKED:\*\* Alpha\\\|blocker/);
  assert.ok(rendered.indexOf("Alpha") < rendered.indexOf("Zulu"));
  assert.ok(rendered.indexOf("a-resource") < rendered.indexOf("z-resource"));
});

test("approval evidence renders supplied timestamps and optional binding fields", () => {
  const approval: ApprovalEvidenceV1 = {
    schemaVersion: "1.0.0",
    projectId: "sample-project",
    runId: "prod-run",
    gate: 4,
    decision: "approved",
    actor: "github:42:octocat",
    mechanism: "github-environment",
    dependencyHash: hash("a"),
    previewHash: hash("b"),
    writerEpoch: 4,
    recipientIdentity: "github-actions:owner/repo:123:2:deploy",
    githubContext: {
      repository: "owner/repo",
      ref: "refs/heads/main",
      sha: "a".repeat(40),
      workflowRef: "owner/repo/.github/workflows/deploy.yml@refs/heads/main",
      runId: "123",
      runAttempt: 2,
      job: "deploy",
      environment: "production",
      actor: "octocat",
      actorId: "42",
      recipientIdentity: "github-actions:owner/repo:123:2:deploy",
    },
    decidedAt: "2026-07-01T11:00:00Z",
    expiresAt: "2026-07-01T12:00:00Z",
  };

  const rendered = renderApprovalEvidence(approval);
  assert.equal(rendered, renderApprovalEvidence(approval));
  assert.match(rendered, /\*\*Decision:\*\* APPROVED/);
  assert.match(rendered, /2026-07-01T11:00:00Z/);
  assert.match(rendered, /GitHub Environment Context/);
  assert.match(rendered, /owner\/repo\/\.github\/workflows\/deploy\.yml@refs\/heads\/main/);
  assert.match(rendered, /github-actions:owner\/repo:123:2:deploy/);
});

test("resource inventory sorts resources and property keys", () => {
  const resources: ResourceInventoryV1["resources"] = [
    {
      logicalId: "storage",
      resourceId: "/storage/z",
      type: "Storage",
      location: "swedencentral",
      properties: { z: 2, a: "value|one" },
    },
    {
      logicalId: "api",
      resourceId: "/apps/a",
      type: "App",
      location: "swedencentral",
      properties: { enabled: true },
    },
  ];
  const inventory: ResourceInventoryV1 = {
    schemaVersion: "1.0.0",
    projectId: "sample-project",
    runId: "prod-run",
    deploymentHash: hash("a"),
    collectedAt: "2026-07-01T12:00:00Z",
    resources,
  };

  const rendered = renderResourceInventory(inventory);
  assert.equal(rendered, renderResourceInventory({ ...inventory, resources: [...resources].reverse() }));
  assert.ok(rendered.indexOf("| api |") < rendered.indexOf("| storage |"));
  assert.match(rendered, /\{"a":"value\\\|one","z":2\}/);
});
