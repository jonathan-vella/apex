import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProjectStore, WriterTransferStore } from "../index.js";

async function fixture(repositoryOptions = {}) {
  const root = await mkdtemp(join(tmpdir(), "apex-transfer-"));
  let now = new Date("2026-01-01T00:00:00.000Z");
  const clock = () => now;
  const projects = new ProjectStore(root, clock, () => "run-1");
  await projects.initializeProject({ projectId: "demo", displayName: "Demo", defaultIacTool: "bicep" });
  await projects.createRun("demo", { environment: "dev", targetScope: "scope", runtimeLockHash: "a".repeat(64) });
  const transfers = new WriterTransferStore(projects.runDirectory("demo", "run-1"), clock, repositoryOptions);
  await transfers.leaseStore().acquire("alice", 10_000);
  return {
    transfers,
    setNow: (value: string) => {
      now = new Date(value);
    },
  };
}

const request = {
  projectId: "demo",
  runId: "run-1",
  repository: "org/repo",
  branch: "main",
  commit: "abc123",
  workflowId: "workflow-v1",
  approvalEnvironment: "vnext-qualification",
  sender: "alice",
  recipient: "bob",
  currentEpoch: 1,
  currentGitHead: "abc123",
  ttlMs: 5_000,
  eventId: "requested-1",
} as const;

test("writer transfer binds head and recipient, releases sender, and atomically records ownership", async () => {
  const { transfers } = await fixture();
  const created = await transfers.create(request);
  assert.equal(await transfers.leaseStore().current(), null);
  const ownership = await transfers.accept({
    claimHash: created.hash,
    recipient: "bob",
    currentGitHead: "abc123",
    eventId: "accepted-1",
  });
  assert.equal(ownership.ownerEpoch, 2);
  assert.equal(ownership.approvalEnvironment, "vnext-qualification");
  assert.equal((await transfers.currentOwnership())?.ownerId, "bob");
});

test("writer transfer rejects stale head, epoch, expiry, and wrong recipient", async () => {
  const staleHead = await fixture();
  await assert.rejects(staleHead.transfers.create({ ...request, currentGitHead: "other" }), /Git head/);
  const wrongRecipient = await fixture();
  const claim = await wrongRecipient.transfers.create(request);
  await assert.rejects(
    wrongRecipient.transfers.accept({
      claimHash: claim.hash,
      recipient: "eve",
      currentGitHead: "abc123",
      eventId: "accepted",
    }),
    /recipient/,
  );
  await assert.rejects(
    wrongRecipient.transfers.accept({
      claimHash: claim.hash,
      recipient: "bob",
      currentGitHead: "other",
      eventId: "accepted",
    }),
    /Git head/,
  );
  const expired = await fixture();
  const expiredClaim = await expired.transfers.create(request);
  expired.setNow("2026-01-01T00:00:06.000Z");
  await assert.rejects(
    expired.transfers.accept({
      claimHash: expiredClaim.hash,
      recipient: "bob",
      currentGitHead: "abc123",
      eventId: "accepted",
    }),
    /expired/,
  );
  const staleEpoch = await fixture();
  await assert.rejects(staleEpoch.transfers.create({ ...request, currentEpoch: 2 }), /Stale transfer epoch/);
});

test("writer transfer releases the recipient lease when run mutation fails", async () => {
  const { transfers } = await fixture({
    faultInjector: (stage: string) => {
      if (stage === "intent") throw new Error("injected-transfer-failure");
    },
  });
  const claim = await transfers.create(request);
  await assert.rejects(
    transfers.accept({
      claimHash: claim.hash,
      recipient: "bob",
      currentGitHead: "abc123",
      eventId: "accepted-failure",
    }),
    /injected-transfer-failure/,
  );
  assert.equal(await transfers.leaseStore().current(), null);
});
