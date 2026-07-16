import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProjectStore, RunRepository } from "../index.js";

test("run repository CAS permits one mutation and rejects a racing stale hash", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-run-repository-"));
  const store = new ProjectStore(
    root,
    () => new Date("2026-01-01T00:00:00.000Z"),
    () => "run-1",
  );
  await store.initializeProject({ projectId: "demo", displayName: "Demo", defaultIacTool: "bicep" });
  await store.createRun("demo", { environment: "dev", targetScope: "scope", runtimeLockHash: "a".repeat(64) });
  const repository = new RunRepository(store.runDirectory("demo", "run-1"));
  const expectedRunHash = await repository.hash();
  const mutation = (eventId: string) =>
    repository.mutate({
      expectedRunHash,
      event: {
        eventId,
        projectId: "demo",
        runId: "run-1",
        type: "owner-changed",
        timestamp: "2026-01-01T00:01:00.000Z",
        ownerEpoch: 2,
        payload: { eventId },
      },
      update: (run) => ({ ...run, ownerEpoch: 2 }),
    });
  const results = await Promise.allSettled([mutation("event-1"), mutation("event-2")]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal((await repository.read()).ownerEpoch, 2);
  assert.equal((await repository.journal.replay()).length, 1);
});

test("run repository rejects a mutation when the validated journal head changed", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-run-journal-cas-"));
  const store = new ProjectStore(
    root,
    () => new Date("2026-01-01T00:00:00.000Z"),
    () => "run-1",
  );
  await store.initializeProject({ projectId: "demo", displayName: "Demo", defaultIacTool: "bicep" });
  await store.createRun("demo", { environment: "dev", targetScope: "scope", runtimeLockHash: "a".repeat(64) });
  const repository = new RunRepository(store.runDirectory("demo", "run-1"));
  const validatedHead = await repository.journal.head();
  await repository.journal.append({
    eventId: "transfer-requested",
    projectId: "demo",
    runId: "run-1",
    type: "transfer-requested",
    timestamp: "2026-01-01T00:00:30.000Z",
    ownerEpoch: 1,
    expectedHead: validatedHead,
    payload: { claimHash: "b".repeat(64), recipient: "ci" },
  });
  await assert.rejects(
    repository.mutate({
      expectedRunHash: await repository.hash(),
      expectedJournalHead: validatedHead,
      event: {
        eventId: "gate-decided",
        projectId: "demo",
        runId: "run-1",
        type: "gate.decided",
        timestamp: "2026-01-01T00:01:00.000Z",
        ownerEpoch: 1,
        payload: { gate: 4 },
      },
      update: (run) => run,
    }),
    /Stale journal head/,
  );
  assert.equal((await repository.journal.replay()).length, 1);
});

for (const stage of ["intent", "journal", "run", "cleanup"] as const) {
  test(`run repository recovers a crash after ${stage}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "apex-run-recovery-"));
    const store = new ProjectStore(
      root,
      () => new Date("2026-01-01T00:00:00.000Z"),
      () => "run-1",
    );
    await store.initializeProject({ projectId: "demo", displayName: "Demo", defaultIacTool: "bicep" });
    await store.createRun("demo", { environment: "dev", targetScope: "scope", runtimeLockHash: "a".repeat(64) });
    const directory = store.runDirectory("demo", "run-1");
    const repository = new RunRepository(directory, {
      faultInjector: (current) => {
        if (current === stage) throw new Error(`crash:${stage}`);
      },
    });
    await assert.rejects(
      repository.mutate({
        expectedRunHash: await repository.hash(),
        event: {
          eventId: `event-${stage}`,
          projectId: "demo",
          runId: "run-1",
          type: "owner-changed",
          timestamp: "2026-01-01T00:01:00.000Z",
          ownerEpoch: 2,
          payload: { stage },
        },
        update: (run) => ({ ...run, ownerEpoch: 2 }),
      }),
      new RegExp(`crash:${stage}`),
    );
    const recovered = new RunRepository(directory);
    const run = await recovered.read();
    const events = await recovered.journal.replay();
    const committed = stage !== "intent";
    assert.equal(run.ownerEpoch, committed ? 2 : 1);
    assert.equal(events.length, committed ? 1 : 0);
  });
}
