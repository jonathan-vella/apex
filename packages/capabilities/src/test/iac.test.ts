import assert from "node:assert/strict";
import test from "node:test";
import type { ApprovalEvidenceV1, DeploymentPreviewV1, IacTool } from "@apex/contracts";
import {
  FakeIaCProvider,
  IacProviderError,
  sha256,
  type CurrentDeploymentAuthority,
  type PreviewRequest,
} from "../iac.js";

const hashes = {
  head: "a".repeat(64),
  input: "b".repeat(64),
  iac: "c".repeat(64),
  policy: "d".repeat(64),
};

function request(overrides: Partial<PreviewRequest> = {}): PreviewRequest {
  return {
    projectId: "project",
    runId: "run",
    environment: "dev",
    target: "subscription/sub/resourceGroups/rg",
    commit: hashes.head,
    dependencyRevision: hashes.head,
    ownerEpoch: 3,
    inputHash: hashes.input,
    iacHash: hashes.iac,
    policyHash: hashes.policy,
    resources: [
      {
        logicalId: "storage",
        resourceId: "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/account",
        type: "Microsoft.Storage/storageAccounts",
        location: "swedencentral",
        properties: { httpsOnly: true },
      },
    ],
    ttlMs: 60_000,
    ...overrides,
  };
}

function authority(overrides: Partial<CurrentDeploymentAuthority> = {}): CurrentDeploymentAuthority {
  return {
    head: hashes.head,
    dependencyRevision: hashes.head,
    ownerEpoch: 3,
    recipientIdentity: "writer@example.com",
    ...overrides,
  };
}

function approval(
  preview: DeploymentPreviewV1,
  overrides: Partial<Extract<ApprovalEvidenceV1, { mechanism: "tty" }>> = {},
): ApprovalEvidenceV1 {
  return {
    schemaVersion: "1.0.0",
    projectId: preview.projectId,
    runId: preview.runId,
    gate: 4,
    decision: "approved",
    actor: "approver@example.com",
    mechanism: "tty",
    dependencyHash: preview.previewHash,
    previewHash: preview.previewHash,
    writerEpoch: 3,
    recipientIdentity: "writer@example.com",
    decidedAt: "2026-07-13T01:00:00.000Z",
    expiresAt: "2026-07-13T02:00:00.000Z",
    ...overrides,
  };
}

function provider(track: IacTool, clock: { value: Date } = { value: new Date("2026-07-13T01:00:00.000Z") }) {
  let id = 0;
  return {
    clock,
    instance: new FakeIaCProvider({ track, now: () => clock.value, nextId: () => `operation-${++id}` }),
  };
}

test("fake Bicep and Terraform tracks have logical apply/destroy parity", async () => {
  for (const track of ["bicep", "terraform"] as const) {
    const { instance } = provider(track);
    const applyPreview = await instance.previewApply(request());
    assert.equal(applyPreview.track, track);
    assert.equal(applyPreview.changes[0]?.action, "create");
    const applied = await instance.apply(applyPreview, approval(applyPreview), authority());
    assert.equal(applied.state, "succeeded");
    assert.equal((await instance.inventory("project", "run")).resources.length, 1);
    assert.deepEqual(await instance.reconcile(applied.operationId), applied);

    const destroyPreview = await instance.previewDestroy(request({ resources: [] }));
    assert.equal(destroyPreview.changes[0]?.action, "delete");
    const destroyed = await instance.destroy(destroyPreview, approval(destroyPreview), authority());
    assert.equal(destroyed.operation, "destroy");
    assert.equal((await instance.inventory("project", "run")).resources.length, 0);
  }
});

test("exact preview and approval binding rejects blockers, tampering, and regeneration", async () => {
  const { instance } = provider("bicep");
  const blocked = await instance.previewApply(request({ blockers: ["policy deny"] }));
  await assert.rejects(instance.apply(blocked, approval(blocked), authority()), iacError("PREVIEW_BLOCKED"));

  const original = await instance.previewApply(request());
  const tampered = { ...original, target: "other-target" };
  await assert.rejects(instance.apply(tampered, approval(original), authority()), iacError("PREVIEW_HASH_MISMATCH"));
  await assert.rejects(
    instance.apply(original, approval(original, { previewHash: hashes.input }), authority()),
    iacError("APPROVAL_HASH_MISMATCH"),
  );

  await instance.previewApply(request({ iacHash: "e".repeat(64) }));
  await assert.rejects(instance.apply(original, approval(original), authority()), iacError("PREVIEW_SUPERSEDED"));
});

test("stale preview, owner epoch, head, recipient, and approval epoch are rejected", async () => {
  const { instance, clock } = provider("terraform");
  const preview = await instance.previewApply(request());
  await assert.rejects(
    instance.apply(preview, approval(preview), authority({ ownerEpoch: 4 })),
    iacError("PREVIEW_OWNER_EPOCH_MISMATCH"),
  );
  await assert.rejects(
    instance.apply(preview, approval(preview), authority({ head: "f".repeat(64) })),
    iacError("PREVIEW_HEAD_MISMATCH"),
  );
  await assert.rejects(
    instance.apply(preview, approval(preview), authority({ dependencyRevision: "e".repeat(64) })),
    iacError("PREVIEW_HEAD_MISMATCH"),
  );
  await assert.rejects(
    instance.apply(preview, approval(preview), authority({ recipientIdentity: "other@example.com" })),
    iacError("APPROVAL_RECIPIENT_MISMATCH"),
  );
  await assert.rejects(
    instance.apply(preview, approval(preview, { writerEpoch: 2 }), authority()),
    iacError("APPROVAL_WRITER_EPOCH_MISMATCH"),
  );
  clock.value = new Date("2026-07-13T01:02:00.000Z");
  await assert.rejects(instance.apply(preview, approval(preview), authority()), iacError("PREVIEW_EXPIRED"));
});

test("one-hop writer authority accepts only the exact approval claim", async () => {
  const { instance } = provider("bicep");
  const preview = await instance.previewApply(request());
  const claimHash = "9".repeat(64);
  const transferredAuthority = authority({
    ownerEpoch: 4,
    previousOwnerEpoch: 3,
    writerTransferClaimHash: claimHash,
  });
  const transferredApproval = approval(preview, { writerEpoch: 4, writerTransferClaimHash: claimHash });
  assert.equal((await instance.apply(preview, transferredApproval, transferredAuthority)).state, "succeeded");

  const nextPreview = await instance.previewApply(request({ iacHash: "e".repeat(64) }));
  await assert.rejects(
    instance.apply(nextPreview, approval(nextPreview, { writerEpoch: 4 }), transferredAuthority),
    iacError("PREVIEW_OWNER_EPOCH_MISMATCH"),
  );
  await assert.rejects(
    instance.apply(
      nextPreview,
      approval(nextPreview, { writerEpoch: 4, writerTransferClaimHash: "8".repeat(64) }),
      transferredAuthority,
    ),
    iacError("PREVIEW_OWNER_EPOCH_MISMATCH"),
  );
  await assert.rejects(
    instance.apply(
      nextPreview,
      approval(nextPreview, { writerEpoch: 5, writerTransferClaimHash: claimHash }),
      authority({ ownerEpoch: 5, previousOwnerEpoch: 4, writerTransferClaimHash: claimHash }),
    ),
    iacError("PREVIEW_OWNER_EPOCH_MISMATCH"),
  );
});

test("destroy requires a separately approved destructive preview", async () => {
  const { instance } = provider("bicep");
  const applyPreview = await instance.previewApply(request());
  await instance.apply(applyPreview, approval(applyPreview), authority());
  const destroyPreview = await instance.previewDestroy(request({ resources: [] }));

  await assert.rejects(
    instance.destroy(destroyPreview, approval(applyPreview), authority()),
    iacError("APPROVAL_HASH_MISMATCH"),
  );
  await instance.destroy(destroyPreview, approval(destroyPreview), authority());
});

test("preview hashes are deterministic across equivalent fake tracks", async () => {
  const bicep = provider("bicep").instance;
  const terraform = provider("terraform").instance;
  const left = await bicep.previewApply(request());
  const right = await terraform.previewApply(request());
  assert.equal(left.changes[0]?.action, right.changes[0]?.action);
  assert.notEqual(left.previewHash, right.previewHash);
  assert.equal(sha256({ value: 1, other: 2 }), sha256({ other: 2, value: 1 }));
});

function iacError(code: string): (error: unknown) => boolean {
  return (error) => error instanceof IacProviderError && error.code === code;
}
