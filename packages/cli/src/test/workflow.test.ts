import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { EventJournal } from "@apex/kernel";
import { ApexError } from "../errors.js";
import { ApexService } from "../service.js";
import { prepareValidatedRun, requirements, tempRoot } from "./helpers.js";

test("full requirements to fake deploy workflow survives restart", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  const preview = await service.preview({ operation: "apply", provider: "fake" });
  await service.decideGateNumber(4, "approved", "tester");
  const events = await new EventJournal(
    join(root, ".apex", "projects", "demo", "runs", initialized.runId, "journal"),
  ).replay();
  const gateValidators = new Map(
    events.flatMap((event) =>
      event.type === "gate.decided"
        ? [
            [
              (event.payload as { gate: number }).gate,
              (event.payload as { validatorIds?: unknown }).validatorIds,
            ] as const,
          ]
        : [],
    ),
  );
  assert.deepEqual(gateValidators.get(1), ["gate:requirements-ready"]);
  assert.deepEqual(gateValidators.get(2), ["gate:architecture-cost-governance-ready"]);
  assert.deepEqual(gateValidators.get(3), ["gate:implementation-plan-ready"]);
  assert.deepEqual(gateValidators.get(4), [
    "gate:preview-current",
    "gate:approval-binding-complete",
    "gate:no-hard-blockers",
  ]);
  const deployed = await service.deploy(preview.previewHash);
  assert.equal(deployed.inventory.resources.length, 1);
  const deploymentEvents = await new EventJournal(
    join(root, ".apex", "projects", "demo", "runs", initialized.runId, "journal"),
  ).replay();
  const completed = [...deploymentEvents].reverse().find((event) => event.type === "deployment.completed");
  assert.deepEqual((completed?.payload as { validatorIds?: unknown }).validatorIds, [
    "deploy:exact-approved-operation",
    "deploy:stale-writer-rejection",
  ]);
  assert.deepEqual((completed?.payload as { preValidatorIds?: unknown }).preValidatorIds, [
    "deploy:exact-approved-operation",
    "deploy:stale-writer-rejection",
  ]);
  assert.deepEqual((completed?.payload as { postValidatorIds?: unknown }).postValidatorIds, []);
  assert.deepEqual((completed?.payload as { omittedValidatorIds?: unknown }).omittedValidatorIds, [
    "deploy:bicep-stack-ownership",
  ]);
  assert.equal((completed?.payload as { evidenceMode?: unknown }).evidenceMode, "simulated");

  const restarted = new ApexService(root);
  assert.equal((await restarted.inventory()).deploymentHash, deployed.inventory.deploymentHash);
  assert.equal((await restarted.status()).run.gates[3]?.state, "approved");
});

test("stale task is rejected after journal advances", async () => {
  const service = new ApexService(await tempRoot());
  await service.init({ projectId: "demo" });
  await service.nextTask();
  const issued = await service.nextTask();
  assert.equal(issued.status, "task");
  if (issued.status !== "task") return;
  await service.recordRequirementsInput({ changed: true });
  await assert.rejects(
    service.completeTask(issued.task.taskId, { kind: "requirements", value: requirements() }),
    (error: unknown) => error instanceof Error && /stale/i.test(error.message),
  );
});

test("a task remains current across stage then complete", async () => {
  const service = new ApexService(await tempRoot());
  await service.init({ projectId: "demo" });
  await service.nextTask();
  const issued = await service.nextTask();
  assert.equal(issued.status, "task");
  if (issued.status !== "task") return;

  const value = requirements();
  const staged = await service.stageArtifact(issued.task.taskId, { kind: "requirements", value });
  assert.equal(staged.kind, "requirements");
  const completed = await service.completeTask(issued.task.taskId, { kind: "requirements", value });
  assert.match(completed.outputHash, /^[0-9a-f]{64}$/);
});

test("expired preview and wrong preview hash are rejected", async () => {
  let now = Date.parse("2026-01-01T00:00:00.000Z");
  const service = new ApexService(await tempRoot(), { clock: () => new Date(now) });
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  const preview = await service.preview({ operation: "apply", provider: "fake", expiresInMs: 1 });
  await service.decideGateNumber(4, "approved", "tester");
  await assert.rejects(
    service.deploy("f".repeat(64)),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_STALE",
  );
  now += 2;
  await assert.rejects(
    service.deploy(preview.previewHash),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_STALE",
  );
});

test("gate approval rejects stale dependencies while explicit rejection remains available", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const initialized = await service.init({ projectId: "demo" });
  await service.nextTask();
  const issued = await service.nextTask();
  assert.equal(issued.status, "task");
  if (issued.status !== "task") return;
  await service.completeTask(issued.task.taskId, { kind: "requirements", value: requirements() });

  const runPath = join(root, ".apex", "projects", "demo", "runs", initialized.runId, "run.json");
  const run = JSON.parse(await readFile(runPath, "utf8")) as { gates: Array<{ gate: number; dependencyHash: string }> };
  await writeFile(
    runPath,
    JSON.stringify({
      ...run,
      gates: run.gates.map((gate) => (gate.gate === 1 ? { ...gate, dependencyHash: "f".repeat(64) } : gate)),
    }),
  );
  await assert.rejects(service.decideGateNumber(1, "approved", "tester"), /gate:requirements-ready/);
  const rejection = await service.decideGateNumber(1, "rejected", "tester");
  assert.equal(rejection.decision, "rejected");

  const events = await new EventJournal(
    join(root, ".apex", "projects", "demo", "runs", initialized.runId, "journal"),
  ).replay();
  const decided = events.find((event) => event.type === "gate.decided");
  assert.equal((decided?.payload as { validatorIds?: unknown }).validatorIds, undefined);
});

test("Gate 4 approval rejects an expired preview before changing gate state", async () => {
  let now = Date.parse("2026-01-01T00:00:00.000Z");
  const service = new ApexService(await tempRoot(), { clock: () => new Date(now) });
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  await service.preview({ operation: "apply", provider: "fake", expiresInMs: 1 });
  now += 2;
  await assert.rejects(service.decideGateNumber(4, "approved", "tester"), /preview has expired/);
  assert.equal((await service.status()).run.gates[3]?.state, "open");
});

test("deploy rejects a preview and approval from an older owner epoch", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  const preview = await service.preview({ operation: "apply", provider: "fake" });
  await service.decideGateNumber(4, "approved", "tester");
  const runPath = join(root, ".apex", "projects", "demo", "runs", initialized.runId, "run.json");
  const run = JSON.parse(await readFile(runPath, "utf8")) as { ownerEpoch: number };
  await writeFile(runPath, JSON.stringify({ ...run, ownerEpoch: 2 }));
  await assert.rejects(
    service.deploy(preview.previewHash),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_STALE",
  );
});

test("Gate 4 approval binds the current transferred writer identity", async () => {
  const service = new ApexService(await tempRoot());
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  const transfer = (await service.createWriterTransfer({
    repository: "owner/repo",
    branch: "feat/run",
    commit: "abc",
    workflowId: "deploy",
    sender: "local",
    recipient: "ci",
    currentHead: "abc",
    ttlMs: 60_000,
  })) as { hash: string };
  await service.acceptWriterTransfer(transfer.hash, "ci", "abc");
  await service.preview({ operation: "apply", provider: "fake" });
  const approval = await service.decideGateNumber(4, "approved", "tester");
  assert.equal(approval.recipientIdentity, "ci");
});

test("Gate 4 approves and deploys an exact preview after one post-preview writer transfer", async () => {
  const service = new ApexService(await tempRoot());
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  const preview = await service.preview({ operation: "apply", provider: "fake" });
  const transfer = (await service.createWriterTransfer({
    repository: "owner/repo",
    branch: "main",
    commit: "abc",
    workflowId: "deploy",
    sender: "local",
    recipient: "ci",
    currentHead: "abc",
    ttlMs: 60_000,
  })) as { hash: string };
  await service.acceptWriterTransfer(transfer.hash, "ci", "abc");
  const approval = await service.decideGateNumber(4, "approved", "tester");
  assert.equal(approval.writerEpoch, 2);
  assert.equal(approval.writerTransferClaimHash, transfer.hash);
  assert.equal((await service.deploy(preview.previewHash)).operation !== undefined, true);
});

test("Gate 4 rejects authority relinquished by a pending transfer", async () => {
  const service = new ApexService(await tempRoot());
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  await service.preview({ operation: "apply", provider: "fake" });
  await service.createWriterTransfer({
    repository: "owner/repo",
    branch: "main",
    commit: "abc",
    workflowId: "deploy",
    sender: "local",
    recipient: "ci",
    currentHead: "abc",
    ttlMs: 60_000,
  });
  await assert.rejects(service.decideGateNumber(4, "approved", "tester"), /writer authority is missing or expired/);
  assert.equal((await service.status()).run.gates[3]?.state, "open");
});

test("Gate 4 rejects an accepted writer after its lease expires", async () => {
  let now = Date.parse("2026-01-01T00:00:00.000Z");
  const service = new ApexService(await tempRoot(), { clock: () => new Date(now) });
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  const transfer = (await service.createWriterTransfer({
    repository: "owner/repo",
    branch: "main",
    commit: "abc",
    workflowId: "deploy",
    sender: "local",
    recipient: "ci",
    currentHead: "abc",
    ttlMs: 1_000,
  })) as { hash: string };
  await service.acceptWriterTransfer(transfer.hash, "ci", "abc");
  await service.preview({ operation: "apply", provider: "fake", expiresInMs: 2_000 });
  now += 1_001;
  await assert.rejects(service.decideGateNumber(4, "approved", "tester"), /writer authority is missing or expired/);
  assert.equal((await service.status()).run.gates[3]?.state, "open");
});

test("Gate 4 approval cannot outlive the current writer lease", async () => {
  let now = Date.parse("2026-01-01T00:00:00.000Z");
  const service = new ApexService(await tempRoot(), { clock: () => new Date(now) });
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  const transfer = (await service.createWriterTransfer({
    repository: "owner/repo",
    branch: "main",
    commit: "abc",
    workflowId: "deploy",
    sender: "local",
    recipient: "ci",
    currentHead: "abc",
    ttlMs: 1_000,
  })) as { hash: string };
  await service.acceptWriterTransfer(transfer.hash, "ci", "abc");
  const preview = await service.preview({ operation: "apply", provider: "fake", expiresInMs: 2_000 });
  const approval = await service.decideGateNumber(4, "approved", "tester");
  assert.equal(approval.expiresAt, "2026-01-01T00:00:01.000Z");
  assert.ok(Date.parse(approval.expiresAt!) < Date.parse(preview.expiresAt));
});

test("Gate 4 rejects a second post-preview writer hop and remains open", async () => {
  const service = new ApexService(await tempRoot());
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  await service.preview({ operation: "apply", provider: "fake" });
  const first = (await service.createWriterTransfer({
    repository: "owner/repo",
    branch: "main",
    commit: "abc",
    workflowId: "deploy",
    sender: "local",
    recipient: "ci",
    currentHead: "abc",
    ttlMs: 60_000,
  })) as { hash: string };
  await service.acceptWriterTransfer(first.hash, "ci", "abc");
  const second = (await service.createWriterTransfer({
    repository: "owner/repo",
    branch: "main",
    commit: "abc",
    workflowId: "deploy",
    sender: "ci",
    recipient: "prod",
    currentHead: "abc",
    ttlMs: 60_000,
  })) as { hash: string };
  await service.acceptWriterTransfer(second.hash, "prod", "abc");
  await assert.rejects(service.decideGateNumber(4, "approved", "tester"), /lineage is invalid/);
  assert.equal((await service.status()).run.gates[3]?.state, "open");
});

test("Gate 4 reopens for an exact superseding destroy preview and requires new approval", async () => {
  const service = new ApexService(await tempRoot());
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  const applyPreview = await service.preview({ operation: "apply", provider: "fake" });
  await service.decideGateNumber(4, "approved", "tester");
  await service.deploy(applyPreview.previewHash);

  const destroyPreview = await service.preview({ operation: "destroy", provider: "fake" });
  assert.equal((await service.status()).run.gates[3]?.state, "open");
  await assert.rejects(service.deploy(destroyPreview.previewHash), /does not authorize the exact preview|approval/i);
  await assert.rejects(service.deploy(applyPreview.previewHash), /not current/);

  await service.decideGateNumber(4, "approved", "tester");
  const destroyed = await service.deploy(destroyPreview.previewHash);
  assert.equal((destroyed.operation as { operation?: unknown }).operation, "destroy");
  assert.equal(destroyed.inventory.resources.length, 0);

  const events = await service.history(100);
  assert.ok(events.some((event) => event.type === "gate.reopened"));
});

test("Gate 4 refreshes an expired open preview without promotion", async () => {
  let now = Date.parse("2026-01-01T00:00:00.000Z");
  const service = new ApexService(await tempRoot(), { clock: () => new Date(now) });
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  const expired = await service.preview({ operation: "apply", provider: "fake", expiresInMs: 1 });
  now += 2;
  const refreshed = await service.preview({ operation: "apply", provider: "fake", expiresInMs: 60_000 });
  assert.notEqual(refreshed.previewHash, expired.previewHash);
  await assert.rejects(service.deploy(expired.previewHash), /not current|approval/i);
  await service.decideGateNumber(4, "approved", "tester");
  assert.equal((await service.deploy(refreshed.previewHash)).operation !== undefined, true);
});
