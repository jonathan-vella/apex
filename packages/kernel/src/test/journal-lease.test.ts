import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EventJournal, LeaseStore } from "../index.js";

const projectId = "demo";
const runId = "run-1";

test("event journal enforces head CAS, epoch, and verifies replay", async () => {
  const directory = await mkdtemp(join(tmpdir(), "apex-journal-"));
  const journal = new EventJournal(directory);
  const first = await journal.append({
    eventId: "event-1",
    projectId,
    runId,
    type: "started",
    timestamp: "2026-01-01T00:00:00.000Z",
    ownerEpoch: 2,
    expectedHead: null,
    payload: { value: 1 },
  });
  await assert.rejects(
    journal.append({
      eventId: "event-2",
      projectId,
      runId,
      type: "changed",
      timestamp: "2026-01-01T00:01:00.000Z",
      ownerEpoch: 2,
      expectedHead: null,
      payload: {},
    }),
    /Stale journal head/,
  );
  await assert.rejects(
    journal.append({
      eventId: "event-2",
      projectId,
      runId,
      type: "changed",
      timestamp: "2026-01-01T00:01:00.000Z",
      ownerEpoch: 1,
      expectedHead: first.hash,
      payload: {},
    }),
    /Stale owner epoch/,
  );
  const second = await journal.append({
    eventId: "event-2",
    projectId,
    runId,
    type: "changed",
    timestamp: "2026-01-01T00:01:00.000Z",
    ownerEpoch: 2,
    expectedHead: first.hash,
    payload: { value: 2 },
  });
  assert.equal(second.sequence, 2);
  assert.equal((await journal.replay()).length, 2);
});

test("event journal detects corruption", async () => {
  const directory = await mkdtemp(join(tmpdir(), "apex-journal-"));
  const journal = new EventJournal(directory);
  await journal.append({
    eventId: "event-1",
    projectId,
    runId,
    type: "started",
    timestamp: "2026-01-01T00:00:00.000Z",
    ownerEpoch: 1,
    expectedHead: null,
    payload: { value: 1 },
  });
  const path = join(directory, "0000000000000001.json");
  const event = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  event.payload = { value: 99 };
  await writeFile(path, JSON.stringify(event));
  await assert.rejects(journal.replay(), /Corrupt journal payload/);
});

test("lease expiry permits reacquisition with a new epoch", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-lease-"));
  let now = new Date("2026-01-01T00:00:00.000Z");
  const leases = new LeaseStore(join(root, "lease.json"), () => now);
  const first = await leases.acquire("owner-a", 1_000);
  await assert.rejects(leases.acquire("owner-b", 1_000), /held by owner-a/);
  now = new Date("2026-01-01T00:00:02.000Z");
  await assert.rejects(leases.heartbeat("owner-a", first.ownerEpoch, 1_000), /expired/);
  const second = await leases.acquire("owner-b", 1_000);
  assert.equal(second.ownerEpoch, first.ownerEpoch + 1);
  await assert.rejects(leases.release("owner-a", first.ownerEpoch), /Stale lease/);
  await leases.release("owner-b", second.ownerEpoch);
  const third = await leases.acquire("owner-c", 1_000);
  assert.equal(third.ownerEpoch, second.ownerEpoch + 1);
});

test("lease acquisition can retry a run-authorized epoch without drifting", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-exact-lease-"));
  let now = new Date("2026-01-01T00:00:00.000Z");
  const leases = new LeaseStore(join(root, "lease.json"), () => now);
  const first = await leases.acquireAtEpoch("owner-a", 2, 1_000);
  assert.equal(first.ownerEpoch, 2);
  await leases.release("owner-a", 2);
  const retried = await leases.acquireAtEpoch("owner-a", 2, 1_000);
  assert.equal(retried.ownerEpoch, 2);
  now = new Date("2026-01-01T00:00:02.000Z");
  await assert.rejects(leases.acquireAtEpoch("owner-b", 1, 1_000), /cannot regress/);
});
