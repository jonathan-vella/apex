import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import type { LocalEncryptedPlan, PersistedPreviewBinding } from "@apex/capabilities";
import { createFileProviderRuntime, hashTerraformConfiguration, hashTerraformLockFile } from "../provider-runtime.js";
import { tempRoot } from "./helpers.js";

const previewHash = "a".repeat(64);
const binding = {
  kind: "bicep",
  preview: {
    projectId: "demo",
    runId: "run-1",
    operation: "apply",
    previewHash,
  },
  providerBindingHash: "b".repeat(64),
  templateHash: "c".repeat(64),
  parametersHash: "d".repeat(64),
  stackStateHash: "e".repeat(64),
} as PersistedPreviewBinding;
const artifact: LocalEncryptedPlan = {
  metadata: {
    implementation: "local-reference",
    algorithm: "aes-256-gcm",
    digest: "f".repeat(64),
    recipient: "local",
    createdAt: "2026-07-15T00:00:00.000Z",
    expiresAt: "2026-07-15T01:00:00.000Z",
  },
  iv: "aXY=",
  authTag: "dGFn",
  ciphertext: "Y2lwaGVydGV4dA==",
};

test("file provider runtime persists bindings, encrypted artifacts, and restrictive keys", async () => {
  const root = await tempRoot();
  const first = await createFileProviderRuntime(root, {});
  await first.bindingStores.bicep.save(previewHash, binding);
  await first.artifactStore.put("demo/run-1/apply/plan.tfplan.enc", artifact);
  const firstKey = Buffer.from(await first.keyProvider());

  const restarted = await createFileProviderRuntime(root, {});
  assert.deepEqual(await restarted.bindingStores.bicep.load(previewHash), binding);
  assert.deepEqual(await restarted.bindingStores.bicep.loadLatest("demo", "run-1", "apply"), binding);
  assert.equal(await restarted.bindingStores.terraform.loadLatest("demo", "run-1", "apply"), undefined);
  assert.deepEqual(await restarted.artifactStore.get("demo/run-1/apply/plan.tfplan.enc"), artifact);
  assert.deepEqual(Buffer.from(await restarted.keyProvider()), firstKey);
  assert.equal(firstKey.byteLength, 32);

  const keyInfo = await lstat(join(root, ".apex", "local", "provider-runtime", "plan-transport.key"));
  if (process.platform !== "win32") assert.equal(keyInfo.mode & 0o777, 0o600);
});

test("file provider runtime accepts an injected key without persisting it", async () => {
  const root = await tempRoot();
  const expected = Buffer.alloc(32, 7);
  const runtime = await createFileProviderRuntime(root, { APEX_PLAN_TRANSPORT_KEY: expected.toString("base64") });
  assert.deepEqual(Buffer.from(await runtime.keyProvider()), expected);
  await assert.rejects(lstat(join(root, ".apex", "local", "provider-runtime", "plan-transport.key")), {
    code: "ENOENT",
  });
});

test("file provider runtime rejects permissive keys and symlinked local state", async () => {
  const root = await tempRoot();
  const runtime = await createFileProviderRuntime(root, {});
  await runtime.keyProvider();
  const keyPath = join(root, ".apex", "local", "provider-runtime", "plan-transport.key");
  if (process.platform !== "win32") {
    await chmod(keyPath, 0o644);
    await assert.rejects(runtime.keyProvider(), /permissions must be 0600/);
  }

  const symlinkRoot = await tempRoot();
  const target = await tempRoot();
  await mkdir(join(symlinkRoot, ".apex"));
  await symlink(target, join(symlinkRoot, ".apex", "local"));
  await assert.rejects(createFileProviderRuntime(symlinkRoot, {}), /not a regular directory/);
});

test("file provider runtime rejects mismatched binding and artifact references", async () => {
  const runtime = await createFileProviderRuntime(await tempRoot(), {});
  await assert.rejects(runtime.bindingStores.bicep.save("b".repeat(64), binding), /does not match its hash/);
  await assert.rejects(runtime.bindingStores.terraform.save(previewHash, binding), /Expected a terraform/);
  await runtime.artifactStore.put("expected", artifact);
  assert.equal(await runtime.artifactStore.get("other"), undefined);
});

test("Terraform hashes bind source, variables, and lock files while ignoring derived state", async () => {
  const root = await tempRoot();
  await writeFile(join(root, "main.tf"), "terraform {}\n");
  await writeFile(join(root, "qualification.auto.tfvars"), 'environment = "qualification"\n');
  await writeFile(join(root, ".terraform.lock.hcl"), "provider-lock\n");
  await mkdir(join(root, ".terraform"));
  await writeFile(join(root, ".terraform", "derived.tf"), "ignored\n");

  const first = await hashTerraformConfiguration(root);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(await hashTerraformLockFile(root), createHash("sha256").update("provider-lock\n").digest("hex"));

  await writeFile(join(root, "main.tf"), 'terraform { required_version = ">= 1.10.0" }\n');
  assert.notEqual(await hashTerraformConfiguration(root), first);
  await writeFile(join(root, "main.tf"), "terraform {}\n");
  assert.equal(await hashTerraformConfiguration(root), first);

  await writeFile(join(root, ".terraform", "derived.tf"), "changed but ignored\n");
  assert.equal(await hashTerraformConfiguration(root), first);
  await symlink(join(root, "main.tf"), join(root, "linked.tf"));
  await assert.rejects(hashTerraformConfiguration(root), /contains a symlink/);
});
