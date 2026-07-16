import assert from "node:assert/strict";
import test from "node:test";
import { EncryptedEnvelopeTransport, type EncryptedEnvelope } from "../index.js";

const key = Buffer.alloc(32, 7);
const now = new Date("2026-07-15T10:00:00.000Z");
const transport = () =>
  new EncryptedEnvelopeTransport(
    () => now,
    () => Buffer.alloc(12, 3),
  );

function encrypted(): EncryptedEnvelope {
  return transport().encrypt(Buffer.from("repository state"), key, {
    kind: "apex-repository-state",
    recipient: "ci-workflow",
    ttlMs: 60_000,
    bindings: { runId: "run-1", ownerEpoch: 1, projectId: "demo" },
  });
}

test("encrypted envelopes are deterministic with fixed time and nonce and canonicalize bindings", () => {
  const first = encrypted();
  const second = transport().encrypt(Buffer.from("repository state"), key, {
    kind: "apex-repository-state",
    recipient: "ci-workflow",
    ttlMs: 60_000,
    bindings: { projectId: "demo", ownerEpoch: 1, runId: "run-1" },
  });
  assert.deepEqual(first, second);
  assert.deepEqual(first.metadata.bindings, { ownerEpoch: 1, projectId: "demo", runId: "run-1" });
  assert.equal(transport().decrypt(first, key, "ci-workflow").toString(), "repository state");
});

test("encrypted envelopes enforce key, kind, recipient, and positive TTL", () => {
  assert.throws(() => transport().decrypt(encrypted(), Buffer.alloc(31), "ci-workflow"), /32-byte key/);
  assert.throws(() => transport().decrypt(encrypted(), key, "other"), /recipient/);
  assert.throws(
    () =>
      transport().encrypt(Buffer.from("state"), key, {
        kind: "",
        recipient: "ci",
        ttlMs: 1,
        bindings: {},
      }),
    /kind, recipient, and positive TTL/,
  );
  assert.throws(
    () =>
      transport().encrypt(Buffer.from("state"), key, {
        kind: "state",
        recipient: "ci",
        ttlMs: 0,
        bindings: {},
      }),
    /positive TTL/,
  );
  assert.throws(
    () =>
      transport().encrypt(Buffer.from("state"), key, {
        kind: "state",
        recipient: "ci",
        ttlMs: 1,
        bindings: { ["bad-key"]: "invalid" },
      }),
    /identifier-shaped/,
  );
});

test("encrypted envelopes reject expiry and authenticated tampering", () => {
  const envelope = encrypted();
  const expired = new EncryptedEnvelopeTransport(() => new Date("2026-07-15T10:01:00.000Z"));
  assert.throws(() => expired.decrypt(envelope, key, "ci-workflow"), /expired/);

  for (const tampered of [
    { ...envelope, metadata: { ...envelope.metadata, kind: "other" } },
    { ...envelope, metadata: { ...envelope.metadata, unexpected: "value" } },
    { ...envelope, authTag: `${envelope.authTag.slice(0, -2)}AA` },
    { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -2)}AA` },
  ]) {
    assert.throws(() => transport().decrypt(tampered, key, "ci-workflow"));
  }
});

test("encrypted envelopes detect plaintext digest mismatch", () => {
  const envelope = encrypted();
  const digest = "0".repeat(64);
  const forged = transport().encrypt(Buffer.from("repository state"), key, {
    kind: "apex-repository-state",
    recipient: "ci-workflow",
    ttlMs: 60_000,
    bindings: {},
  });
  assert.throws(() => transport().decrypt({ ...forged, metadata: { ...forged.metadata, digest } }, key, "ci-workflow"));
  assert.notEqual(envelope.metadata.digest, digest);
});
