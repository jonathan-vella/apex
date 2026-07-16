import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EventJournal, ProjectStore, WriterTransferStore } from "../index.js";

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
    runDirectory: projects.runDirectory("demo", "run-1"),
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
  assert.equal(ownership.claimHash, created.hash);
  assert.equal(ownership.previousOwnerId, "alice");
  assert.equal(ownership.previousOwnerEpoch, 1);
  assert.equal(ownership.approvalEnvironment, "vnext-qualification");
  assert.equal((await transfers.currentOwnership())?.ownerId, "bob");
});

test("writer transfer lease mismatch creates no claim or journal event", async () => {
  const { transfers, runDirectory } = await fixture();
  const journalBefore = await readdir(join(runDirectory, "journal"));
  await assert.rejects(transfers.create({ ...request, sender: "mallory" }), /current lease/);
  await assert.rejects(readdir(join(runDirectory, "transfers")), /ENOENT/);
  assert.deepEqual(await readdir(join(runDirectory, "journal")), journalBefore);
});

test("writer transfer proves exact one-hop post-preview lineage", async () => {
  const { transfers, runDirectory } = await fixture();
  const journal = new EventJournal(join(runDirectory, "journal"));
  const previewHash = "b".repeat(64);
  await journal.append({
    eventId: "preview-1",
    projectId: "demo",
    runId: "run-1",
    type: "preview.created",
    timestamp: "2026-01-01T00:00:00.000Z",
    ownerEpoch: 1,
    expectedHead: await journal.head(),
    payload: { previewHash },
  });
  const created = await transfers.create(request);
  await transfers.accept({
    claimHash: created.hash,
    recipient: "bob",
    currentGitHead: "abc123",
    eventId: "accepted-lineage",
  });
  assert.equal(await transfers.proveOneHopPostPreviewLineage(previewHash, 1), created.hash);
  assert.equal(await transfers.proveOneHopPostPreviewLineage("c".repeat(64), 1), null);
  assert.equal(await transfers.proveOneHopPostPreviewLineage(previewHash, 2), null);
});

test("writer transfer lineage expires and is superseded by a later request", async () => {
  const expiring = await fixture();
  const previewHash = "b".repeat(64);
  const journal = new EventJournal(join(expiring.runDirectory, "journal"));
  await journal.append({
    eventId: "preview-expiry",
    projectId: "demo",
    runId: "run-1",
    type: "preview.created",
    timestamp: "2026-01-01T00:00:00.000Z",
    ownerEpoch: 1,
    expectedHead: await journal.head(),
    payload: { previewHash },
  });
  const first = await expiring.transfers.create(request);
  await expiring.transfers.accept({
    claimHash: first.hash,
    recipient: "bob",
    currentGitHead: "abc123",
    eventId: "accepted-expiry",
  });
  expiring.setNow("2026-01-01T00:00:06.000Z");
  assert.equal(await expiring.transfers.proveOneHopPostPreviewLineage(previewHash, 1), null);

  const superseded = await fixture();
  const supersededJournal = new EventJournal(join(superseded.runDirectory, "journal"));
  await supersededJournal.append({
    eventId: "preview-superseded",
    projectId: "demo",
    runId: "run-1",
    type: "preview.created",
    timestamp: "2026-01-01T00:00:00.000Z",
    ownerEpoch: 1,
    expectedHead: await supersededJournal.head(),
    payload: { previewHash },
  });
  const accepted = await superseded.transfers.create(request);
  await superseded.transfers.accept({
    claimHash: accepted.hash,
    recipient: "bob",
    currentGitHead: "abc123",
    eventId: "accepted-superseded",
  });
  await superseded.transfers.create({
    ...request,
    sender: "bob",
    recipient: "carol",
    currentEpoch: 2,
    eventId: "requested-next",
  });
  assert.equal(await superseded.transfers.proveOneHopPostPreviewLineage(previewHash, 1), null);
});

test("writer transfer rejects a claim requested before the preview", async () => {
  const { transfers, runDirectory } = await fixture();
  const created = await transfers.create(request);
  const journal = new EventJournal(join(runDirectory, "journal"));
  const previewHash = "b".repeat(64);
  await journal.append({
    eventId: "preview-after-transfer",
    projectId: "demo",
    runId: "run-1",
    type: "preview.created",
    timestamp: "2026-01-01T00:00:00.000Z",
    ownerEpoch: 1,
    expectedHead: await journal.head(),
    payload: { previewHash },
  });
  await transfers.accept({
    claimHash: created.hash,
    recipient: "bob",
    currentGitHead: "abc123",
    eventId: "accepted-after-preview",
  });
  assert.equal(await transfers.proveOneHopPostPreviewLineage(previewHash, 1), null);
});

test("writer transfer lineage fails closed on ownership or claim tampering", async () => {
  const { transfers, runDirectory } = await fixture();
  const journal = new EventJournal(join(runDirectory, "journal"));
  const previewHash = "b".repeat(64);
  await journal.append({
    eventId: "preview-tamper",
    projectId: "demo",
    runId: "run-1",
    type: "preview.created",
    timestamp: "2026-01-01T00:00:00.000Z",
    ownerEpoch: 1,
    expectedHead: await journal.head(),
    payload: { previewHash },
  });
  const created = await transfers.create(request);
  await transfers.accept({
    claimHash: created.hash,
    recipient: "bob",
    currentGitHead: "abc123",
    eventId: "accepted-tamper",
  });
  const ownershipPath = join(runDirectory, "ownership.json");
  const ownership = await readFile(ownershipPath, "utf8");
  await writeFile(ownershipPath, ownership.replace('"ownerId":"bob"', '"ownerId":"eve"'));
  assert.equal(await transfers.proveOneHopPostPreviewLineage(previewHash, 1), null);
  await writeFile(ownershipPath, ownership);

  const claimPath = join(runDirectory, "transfers", `${created.hash}.json`);
  const claim = await readFile(claimPath, "utf8");
  await writeFile(claimPath, claim.replace('"recipient":"bob"', '"recipient":"eve"'));
  assert.equal(await transfers.proveOneHopPostPreviewLineage(previewHash, 1), null);
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
  let failMutation = true;
  const { transfers } = await fixture({
    faultInjector: (stage: string) => {
      if (stage === "intent" && failMutation) {
        failMutation = false;
        throw new Error("injected-transfer-failure");
      }
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
  const retried = await transfers.accept({
    claimHash: claim.hash,
    recipient: "bob",
    currentGitHead: "abc123",
    eventId: "accepted-retry",
  });
  assert.equal(retried.ownerEpoch, 2);
});
