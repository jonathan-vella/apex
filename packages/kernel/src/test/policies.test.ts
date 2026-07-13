import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  benchmarkKernel,
  ContentCache,
  contentCacheKey,
  EvidencePolicy,
  EvidenceStore,
  ObjectStore,
} from "../index.js";

test("evidence redacts structural secrets, deduplicates, enforces budgets, and quarantines uncertain content", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-evidence-"));
  const policy = new EvidencePolicy({
    kinds: {
      report: { contentTypes: ["application/json"], maxBytes: 200, retention: "immutable" },
      log: { contentTypes: ["text/plain"], maxBytes: 200, retention: "optional" },
      blob: { contentTypes: ["application/octet-stream"], maxBytes: 200, retention: "optional" },
    },
  });
  const store = new EvidenceStore(root, policy);
  const accepted = await store.accept({
    kind: "report",
    contentType: "application/json",
    value: { nested: { apiKey: "secret-value" }, value: 1 },
    required: true,
  });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.redacted, true);
  assert.equal(accepted.retention, "immutable");
  const object = await new ObjectStore(root).getJson<any>(accepted.hash!);
  assert.equal(object.nested.apiKey, "[REDACTED]");
  const duplicate = await store.accept({
    kind: "report",
    contentType: "application/json",
    value: { nested: { apiKey: "different" }, value: 1 },
    required: true,
  });
  assert.equal(duplicate.hash, accepted.hash);
  const jsonFile = await store.accept({
    kind: "report",
    contentType: "application/json",
    value: Buffer.from(JSON.stringify({ clientSecret: "file-secret", value: 1 })),
    required: true,
  });
  assert.equal(jsonFile.status, "accepted");
  assert.equal(jsonFile.redacted, true);
  assert.equal((await new ObjectStore(root).getJson<any>(jsonFile.hash!)).clientSecret, "[REDACTED]");
  const quarantined = await store.accept({
    kind: "log",
    contentType: "text/plain",
    value: Buffer.from("github_pat_abcdefghijklmnopqrstuvwxyz123456"),
    required: false,
  });
  assert.equal(quarantined.status, "quarantined");
  assert.match(quarantined.quarantinePath!, /\.apex\/local\/quarantine/);
  const malformed = await store.accept({
    kind: "log",
    contentType: "text/plain",
    value: Buffer.from("Authorization: Bearer abcdefghijklmnopqrstuvwxyz"),
    required: false,
  });
  assert.equal(malformed.status, "quarantined");
  const binary = await store.accept({
    kind: "blob",
    contentType: "application/octet-stream",
    value: Buffer.from([0, 1, 2, 3]),
    required: false,
  });
  assert.deepEqual(binary.reasons, ["unknown-binary"]);
  await assert.rejects(
    store.accept({
      kind: "report",
      contentType: "application/json",
      value: Buffer.from("{not-json"),
      required: true,
    }),
    /high-risk content/,
  );
  await assert.rejects(
    store.accept({
      kind: "report",
      contentType: "application/json",
      value: { value: "x".repeat(300) },
      required: true,
    }),
    /byte budget/,
  );
  await assert.rejects(
    store.accept({ kind: "report", contentType: "text/plain", value: Buffer.from("x"), required: true }),
    /not allowed/,
  );
});

test("telemetry consent is separate, exportable, and deletable", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-telemetry-"));
  const store = new EvidenceStore(root, new EvidencePolicy({ kinds: {} }));
  await store.setTelemetryConsent(true);
  assert.deepEqual(await store.exportTelemetry(), { consent: true });
  await store.deleteTelemetry();
  assert.equal(await store.exportTelemetry(), null);
});

test("content cache keys canonical inputs, invalidates dependencies, and rejects symlink roots", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-cache-"));
  const cache = new ContentCache(root);
  const first = { dependencies: { source: "a" }, config: { z: 1, a: 2 }, toolchain: { version: "1" } } as const;
  const reordered = { dependencies: { source: "a" }, config: { a: 2, z: 1 }, toolchain: { version: "1" } } as const;
  assert.equal(contentCacheKey(first), contentCacheKey(reordered));
  await cache.set(first, { result: 1 });
  assert.deepEqual(await cache.get(first), { result: 1 });
  assert.equal(await cache.invalidate("other"), 0);
  assert.equal(await cache.invalidate("source"), 1);
  assert.equal(await cache.get(first), null);
  const linkedRoot = await mkdtemp(join(tmpdir(), "apex-cache-link-"));
  const outside = await mkdtemp(join(tmpdir(), "apex-cache-outside-"));
  await mkdir(join(linkedRoot, ".apex", "cache"), { recursive: true });
  await symlink(outside, join(linkedRoot, ".apex", "cache", "content"));
  await assert.rejects(new ContentCache(linkedRoot).set(first, { result: 1 }), /root must not be a symlink/);
});

test("benchmark report has deterministic shape and percentile samples", () => {
  const report = benchmarkKernel(20);
  assert.deepEqual(Object.keys(report), ["schemaVersion", "iterations", "append", "replay", "status"]);
  assert.equal(report.iterations, 20);
  for (const metric of [report.append, report.replay, report.status]) {
    assert.equal(metric.samples, 20);
    assert(metric.p50Ms >= 0);
    assert(metric.p95Ms >= metric.p50Ms);
  }
});
