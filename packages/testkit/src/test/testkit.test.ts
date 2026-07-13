import assert from "node:assert/strict";
import { access, lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ApprovalEvidenceV1Schema,
  DeploymentPreviewV1Schema,
  IacBindingV1Schema,
  ImplementationIntentV1Schema,
  OperationRecordV1Schema,
  ProjectConfigV1Schema,
  RequirementsV1Schema,
  ResourceInventoryV1Schema,
  RunConfigV1Schema,
  RuntimeBundleLockV1Schema,
  TaskEnvelopeV1Schema,
} from "@apex/contracts";
import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  FakeClock,
  InjectedFault,
  SequenceIds,
  approvalFixture,
  assertLogicalInventoryParity,
  bindingFixture,
  crashAfter,
  crashBefore,
  createScenario,
  fixtureHash,
  intentFixture,
  inventoryFixture,
  maliciousPaths,
  operationFixture,
  oversizedFixture,
  previewFixture,
  projectFixture,
  requirementsFixture,
  runFixture,
  runtimeLockFixture,
  secretFixtures,
  staleEpoch,
  staleHead,
  symlinkFixture,
  taskFixture,
  tempWorkspace,
} from "../index.js";

FormatRegistry.Set("date-time", (value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
});

test("FakeClock and SequenceIds are deterministic", () => {
  const clock = new FakeClock("2026-06-01T12:00:00.000Z");
  assert.equal(clock.now().toISOString(), "2026-06-01T12:00:00.000Z");
  assert.equal(clock.advance(1_500).toISOString(), "2026-06-01T12:00:01.500Z");
  assert.equal(clock.set("2026-06-02T00:00:00.000Z").toISOString(), "2026-06-02T00:00:00.000Z");

  const ids = new SequenceIds("run", 7);
  assert.deepEqual([ids.next(), ids.next(), ids.next()], ["run-0007", "run-0008", "run-0009"]);
});

test("tempWorkspace registers automatic recursive cleanup", async () => {
  let cleanup: (() => Promise<void>) | undefined;
  const root = await tempWorkspace({
    after(callback) {
      cleanup = callback as () => Promise<void>;
    },
  });
  await access(root);
  assert.ok(cleanup);
  await cleanup();
  await assert.rejects(access(root), { code: "ENOENT" });
});

test("fixture builders produce valid schema-shaped contracts and hashes", () => {
  const fixtures = [
    [RuntimeBundleLockV1Schema, runtimeLockFixture()],
    [ProjectConfigV1Schema, projectFixture()],
    [RunConfigV1Schema, runFixture()],
    [TaskEnvelopeV1Schema, taskFixture()],
    [RequirementsV1Schema, requirementsFixture()],
    [ImplementationIntentV1Schema, intentFixture()],
    [IacBindingV1Schema, bindingFixture()],
    [DeploymentPreviewV1Schema, previewFixture()],
    [ApprovalEvidenceV1Schema, approvalFixture()],
    [OperationRecordV1Schema, operationFixture()],
    [ResourceInventoryV1Schema, inventoryFixture()],
  ] as const;

  for (const [schema, fixture] of fixtures) {
    assert.equal(Value.Check(schema, fixture), true, schema.$id ?? "anonymous schema");
  }
  assert.match(fixtureHash("valid"), /^[0-9a-f]{64}$/);
});

test("scenario initializes stores, journal, object store, and both providers", async (context) => {
  const root = await tempWorkspace(context);
  const scenario = await createScenario(root);
  assert.equal((await scenario.projectStore.getProject(scenario.project.projectId)).projectId, "test-project");
  assert.equal(
    (await scenario.projectStore.getRun(scenario.project.projectId, scenario.run.runId)).runId,
    scenario.run.runId,
  );
  assert.equal(await scenario.eventJournal.head(), null);
  const objectHash = await scenario.objectStore.putJson({ scenario: true });
  assert.deepEqual(await scenario.objectStore.getJson(objectHash), { scenario: true });
  assert.equal(scenario.bicep.track, "bicep");
  assert.equal(scenario.terraform.track, "terraform");
});

test("fault helpers inject crashes and stale journal authority", async (context) => {
  let calls = 0;
  await assert.rejects(
    crashBefore(() => {
      calls += 1;
    }),
    InjectedFault,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    crashAfter(() => {
      calls += 1;
    }),
    InjectedFault,
  );
  assert.equal(calls, 1);
  assert.equal(staleEpoch(4), 3);
  assert.notEqual(staleHead(fixtureHash("head")), fixtureHash("head"));

  const scenario = await createScenario(await tempWorkspace(context));
  const first = await scenario.eventJournal.append({
    eventId: "event-0001",
    projectId: scenario.project.projectId,
    runId: scenario.run.runId,
    type: "test.started",
    timestamp: scenario.clock.now().toISOString(),
    ownerEpoch: 2,
    expectedHead: null,
    payload: { ready: true },
  });
  await assert.rejects(
    scenario.eventJournal.append({
      eventId: "event-0002",
      projectId: scenario.project.projectId,
      runId: scenario.run.runId,
      type: "test.failed",
      timestamp: scenario.clock.now().toISOString(),
      ownerEpoch: 2,
      expectedHead: staleHead(first.hash),
      payload: {},
    }),
    /Stale journal head/,
  );
  await assert.rejects(
    scenario.eventJournal.append({
      eventId: "event-0003",
      projectId: scenario.project.projectId,
      runId: scenario.run.runId,
      type: "test.failed",
      timestamp: scenario.clock.now().toISOString(),
      ownerEpoch: staleEpoch(2),
      expectedHead: first.hash,
      payload: {},
    }),
    /Stale owner epoch/,
  );
});

test("Bicep and Terraform fake providers produce logically equivalent inventories", async (context) => {
  const scenario = await createScenario(await tempWorkspace(context));
  const resources = [
    {
      logicalId: "storage",
      resourceId: "/subscriptions/test/resourceGroups/test/providers/Microsoft.Storage/storageAccounts/test",
      type: "Microsoft.Storage/storageAccounts",
      location: "swedencentral",
      properties: { httpsOnly: true },
    },
  ];
  const authority = {
    head: fixtureHash("commit"),
    dependencyRevision: fixtureHash("commit"),
    ownerEpoch: 1,
    recipientIdentity: "test-writer",
  };

  for (const provider of [scenario.bicep, scenario.terraform]) {
    const preview = await provider.previewApply({
      projectId: scenario.project.projectId,
      runId: scenario.run.runId,
      environment: "test",
      target: scenario.run.targetScope,
      commit: authority.head,
      dependencyRevision: authority.dependencyRevision,
      ownerEpoch: authority.ownerEpoch,
      inputHash: fixtureHash("input"),
      iacHash: fixtureHash(provider.track),
      policyHash: fixtureHash("policy"),
      resources,
      ttlMs: 60_000,
    });
    await provider.apply(
      preview,
      approvalFixture({
        projectId: scenario.project.projectId,
        runId: scenario.run.runId,
        previewHash: preview.previewHash,
        dependencyHash: preview.previewHash,
        decidedAt: scenario.clock.now().toISOString(),
        expiresAt: new Date(scenario.clock.now().getTime() + 60_000).toISOString(),
      }),
      authority,
    );
  }

  assertLogicalInventoryParity(
    await scenario.bicep.inventory(scenario.project.projectId, scenario.run.runId),
    await scenario.terraform.inventory(scenario.project.projectId, scenario.run.runId),
  );
  assert.throws(() =>
    assertLogicalInventoryParity(
      inventoryFixture(),
      inventoryFixture({
        resources: [
          {
            logicalId: "network",
            resourceId: "network-id",
            type: "network",
            location: "swedencentral",
            properties: {},
          },
        ],
      }),
    ),
  );
});

test("malicious fixtures cover traversal, symlinks, oversized data, and secrets", async () => {
  assert.ok(maliciousPaths.some((path) => path.includes("..")));
  assert.equal(oversizedFixture(32).byteLength, 33);
  assert.match(secretFixtures.githubToken, /^ghp_/);
  assert.match(secretFixtures.privateKey, /BEGIN PRIVATE KEY/);

  const root = await mkdtemp(join(tmpdir(), "apex-testkit-symlink-"));
  try {
    const target = join(root, "target");
    const link = await symlinkFixture(join(root, "nested", "link"), target);
    assert.equal((await lstat(link)).isSymbolicLink(), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
