import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { atomicWriteJson, ObjectStore, sha256Text } from "../index.js";

test("atomic JSON writes canonical data and can refuse overwrite", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-kernel-"));
  const path = join(root, "value.json");
  await atomicWriteJson(path, { z: 1, a: true });
  assert.equal(await readFile(path, "utf8"), '{"a":true,"z":1}');
  await assert.rejects(atomicWriteJson(path, { changed: true }, { refuseOverwrite: true }), { code: "EEXIST" });
});

test("object store deduplicates immutable content and rejects traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-kernel-"));
  const store = new ObjectStore(root);
  const hash = await store.putBytes(Buffer.from("immutable"));
  assert.equal(await store.putBytes(Buffer.from("immutable")), hash);
  assert.equal((await store.getBytes(hash)).toString(), "immutable");
  await assert.rejects(store.getBytes("../outside"), /Invalid SHA-256/);

  const objectPath = join(root, ".apex", "objects", "sha256", hash.slice(0, 2), hash.slice(2));
  await writeFile(objectPath, "mutated");
  await assert.rejects(store.getBytes(hash), /verification failed/);
});

test("object store rejects a symlinked hash bucket", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-kernel-"));
  const outside = await mkdtemp(join(tmpdir(), "apex-outside-"));
  const hash = sha256Text("escape");
  const storeRoot = join(root, ".apex", "objects", "sha256");
  await mkdir(storeRoot, { recursive: true });
  await symlink(outside, join(storeRoot, hash.slice(0, 2)));
  await assert.rejects(new ObjectStore(root).putBytes(Buffer.from("escape")), /escapes the store/);
});

test("object store rejects a symlinked store root", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-kernel-"));
  const outside = await mkdtemp(join(tmpdir(), "apex-outside-"));
  await mkdir(join(root, ".apex", "objects"), { recursive: true });
  await symlink(outside, join(root, ".apex", "objects", "sha256"));
  await assert.rejects(new ObjectStore(root).putBytes(Buffer.from("escape")), /root must not be a symlink/);
});
