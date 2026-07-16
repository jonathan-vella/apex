import assert from "node:assert/strict";
import test from "node:test";
import { ApexService } from "../service.js";
import { tempRoot } from "./helpers.js";

test("writer transfer binds the current head and advances ownership", async () => {
  const service = new ApexService(await tempRoot());
  await service.init({ projectId: "demo" });
  await assert.rejects(
    service.createWriterTransfer({
      repository: "owner/repo",
      branch: "main",
      commit: "abc",
      workflowId: "wf",
      sender: "local",
      recipient: "ci",
      currentHead: "other",
      ttlMs: 60_000,
    }),
    /current Git head/i,
  );
  const created = (await service.createWriterTransfer({
    repository: "owner/repo",
    branch: "main",
    commit: "abc",
    workflowId: "wf",
    sender: "local",
    recipient: "ci",
    currentHead: "abc",
    ttlMs: 60_000,
  })) as { hash: string };
  const accepted = (await service.acceptWriterTransfer(created.hash, "ci", "abc")) as {
    ownerId: string;
    ownerEpoch: number;
  };
  assert.deepEqual({ ownerId: accepted.ownerId, ownerEpoch: accepted.ownerEpoch }, { ownerId: "ci", ownerEpoch: 2 });
  assert.deepEqual(await service.currentWriter(), accepted);
});

test("writer transfer rejects a spoofed sender and preserves local retry authority", async () => {
  const service = new ApexService(await tempRoot());
  await service.init({ projectId: "demo" });
  const input = {
    repository: "owner/repo",
    branch: "main",
    commit: "abc",
    workflowId: "wf",
    recipient: "ci",
    currentHead: "abc",
    ttlMs: 60_000,
  };
  await assert.rejects(service.createWriterTransfer({ ...input, sender: "mallory" }), /not the current writer/);
  await assert.rejects(
    service.createWriterTransfer({ ...input, sender: "local", approvalEnvironment: "" }),
    /environment must be nonempty/,
  );
  const retried = (await service.createWriterTransfer({ ...input, sender: "local" })) as { hash: string };
  assert.match(retried.hash, /^[0-9a-f]{64}$/);
});

test("evidence redacts secret keys, rejects required high-risk content, and telemetry is user-controlled", async () => {
  const service = new ApexService(await tempRoot());
  await service.init({ projectId: "demo" });
  const accepted = (await service.acceptEvidence({
    kind: "task-json",
    contentType: "application/json",
    value: { token: "hidden", result: "ok" },
    required: false,
  })) as { status: string; redacted: boolean };
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.redacted, true);
  await assert.rejects(
    service.acceptEvidence({
      kind: "operation-record-v1",
      contentType: "text/plain",
      value: "-----BEGIN PRIVATE KEY-----" as never,
      required: true,
    }),
    /high-risk/i,
  );
  await service.setTelemetryConsent(true);
  assert.deepEqual(await service.exportTelemetry(), { consent: true });
  await service.deleteTelemetry();
  assert.equal(await service.exportTelemetry(), null);
});

test("validation cache keys include journal head and cache clear is deterministic", async () => {
  const service = new ApexService(await tempRoot());
  await service.init({ projectId: "demo" });
  const first = await service.validate();
  assert.equal((await service.cacheStatus()).entries, 1);
  await service.recordRequirementsInput({ workload: "new" });
  const second = await service.validate();
  assert.ok(second.events > first.events);
  assert.equal((await service.cacheStatus()).entries, 2);
  assert.deepEqual(await service.clearCache(), { cleared: 2 });
  assert.deepEqual(await service.cacheStatus(), { entries: 0 });
});

test("project history and search include event payloads and artifact kinds", async () => {
  const service = new ApexService(await tempRoot());
  await service.init({ projectId: "demo" });
  await service.recordRequirementsInput({ marker: "needle-value" });
  const history = await service.history(10);
  assert.ok(history.some(({ type }) => type === "requirements.input-recorded"));
  const search = await service.search("needle-value");
  assert.equal(search[0]?.projectId, "demo");
  assert.ok(search[0]?.matches?.some(({ type }) => type === "requirements.input-recorded"));
});
