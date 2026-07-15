import assert from "node:assert/strict";
import { lstat, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { EncryptedEnvelopeTransport, type EncryptedEnvelope } from "@apex/capabilities";
import { canonicalJsonBytes, sha256Bytes } from "@apex/kernel";
import { execute } from "../cli.js";
import {
  PROVIDER_TRANSFER_KIND,
  createProviderTransferBundle,
  exportProviderTransfer,
  importProviderTransfer,
  type ProviderTransferBundle,
  type ProviderTransferProvider,
} from "../provider-transfer.js";
import { tempRoot, writeJson } from "./helpers.js";

const instant = new Date("2026-07-15T10:00:00.000Z");
const key = Buffer.alloc(32, 9);
const nonce = () => Buffer.alloc(12, 4);
const hashes = {
  preview: "1".repeat(64),
  input: "2".repeat(64),
  iac: "3".repeat(64),
  policy: "4".repeat(64),
  commit: "5".repeat(64),
  dependency: "6".repeat(64),
  artifact: "7".repeat(64),
  config: "8".repeat(64),
  lock: "9".repeat(64),
  plan: "a".repeat(64),
  template: "b".repeat(64),
  parameters: "c".repeat(64),
  stack: "d".repeat(64),
  provider: "e".repeat(64),
};

function preview(provider: ProviderTransferProvider) {
  return {
    schemaVersion: "1.0.0",
    projectId: "demo",
    runId: "run-1",
    environment: "dev",
    track: provider,
    operation: "apply",
    target: "qualification",
    commit: hashes.commit,
    dependencyRevision: hashes.dependency,
    ownerEpoch: 3,
    inputHash: hashes.input,
    iacHash: hashes.iac,
    policyHash: hashes.policy,
    ...(provider === "terraform" ? { artifactHash: hashes.artifact } : {}),
    changes: [{ resourceId: "resource", action: "create", material: true }],
    blockers: [],
    createdAt: instant.toISOString(),
    expiresAt: "2026-07-15T11:00:00.000Z",
    previewHash: hashes.preview,
  };
}

function bicepBinding() {
  return {
    kind: "bicep",
    preview: preview("bicep"),
    providerBindingHash: hashes.provider,
    templateHash: hashes.template,
    parametersHash: hashes.parameters,
    stackStateHash: hashes.stack,
  };
}

function terraformBinding() {
  return {
    kind: "terraform",
    preview: preview("terraform"),
    attestation: {
      schemaVersion: "1.0.0",
      projectId: "demo",
      runId: "run-1",
      track: "terraform",
      previewHash: hashes.preview,
      inputHash: hashes.input,
      iacHash: hashes.iac,
      policyHash: hashes.policy,
      configHash: hashes.config,
      lockfileHash: hashes.lock,
      recipient: "ci-apply",
      planDigest: hashes.plan,
      artifactRef: `demo/run-1/apply/${hashes.plan}.tfplan.enc`,
      transport: {
        encrypted: true,
        implementation: "local-reference",
        algorithm: "aes-256-gcm",
        recipient: "ci-apply",
        mediaType: "application/vnd.apex.terraform-plan",
        iv: Buffer.alloc(12, 2).toString("base64"),
        authTag: Buffer.alloc(16, 3).toString("base64"),
      },
      createdAt: instant.toISOString(),
      expiresAt: "2026-07-15T11:00:00.000Z",
    },
  };
}

function terraformArtifact(binding = terraformBinding()) {
  return {
    reference: binding.attestation.artifactRef,
    artifact: {
      metadata: {
        implementation: "local-reference",
        algorithm: "aes-256-gcm",
        digest: binding.attestation.planDigest,
        recipient: binding.attestation.recipient,
        createdAt: instant.toISOString(),
        expiresAt: "2026-07-15T11:00:00.000Z",
      },
      iv: binding.attestation.transport.iv,
      authTag: binding.attestation.transport.authTag,
      ciphertext: Buffer.from("encrypted saved plan", "utf8").toString("base64"),
    },
  };
}

async function source(
  provider: ProviderTransferProvider,
): Promise<{ root: string; output: string; artifactPath?: string }> {
  const root = await tempRoot();
  const runtime = join(root, ".apex", "local", "provider-runtime");
  await writeJson(
    join(runtime, "bindings", `${hashes.preview}.json`),
    provider === "bicep" ? bicepBinding() : terraformBinding(),
  );
  await writeJson(join(runtime, "bindings", `${"f".repeat(64)}.json`), { unrelated: true });
  await writeJson(join(runtime, "latest", `${"0".repeat(64)}.json`), { previewHash: hashes.preview });
  await writeFile(join(runtime, "plan-transport.key"), Buffer.alloc(32, 6), { mode: 0o600 });
  let artifactPath: string | undefined;
  if (provider === "terraform") {
    const artifact = terraformArtifact();
    artifactPath = join(runtime, "artifacts", `${sha256Bytes(Buffer.from(artifact.reference, "utf8"))}.json`);
    await writeJson(artifactPath, artifact);
    await writeJson(join(runtime, "artifacts", `${"f".repeat(64)}.json`), { unrelated: true });
  }
  return {
    root,
    output: join(root, "provider-transfer.json"),
    ...(artifactPath === undefined ? {} : { artifactPath }),
  };
}

async function exported(
  provider: ProviderTransferProvider,
): Promise<{ root: string; output: string; envelope: EncryptedEnvelope }> {
  const fixture = await source(provider);
  await exportProviderTransfer(
    fixture.root,
    fixture.output,
    { previewHash: hashes.preview, provider, recipient: "ci-apply", ttlMs: 30 * 60 * 1_000 },
    { key, now: () => instant, nonce },
  );
  return { ...fixture, envelope: JSON.parse(await readFile(fixture.output, "utf8")) as EncryptedEnvelope };
}

function seal(bundle: ProviderTransferBundle): EncryptedEnvelope {
  return new EncryptedEnvelopeTransport(() => instant, nonce).encrypt(canonicalJsonBytes(bundle), key, {
    kind: PROVIDER_TRANSFER_KIND,
    recipient: "ci-apply",
    ttlMs: 30 * 60 * 1_000,
    bindings: bundle.bindings,
  });
}

test("provider export is deterministic and selects only exact Bicep authority", async () => {
  const fixture = await source("bicep");
  const options = { previewHash: hashes.preview, provider: "bicep" as const, recipient: "ci-apply", ttlMs: 1_000 };
  const bundle = await createProviderTransferBundle(fixture.root, options, instant);
  assert.deepEqual(
    bundle.files.map(({ path }) => path),
    [`bindings/${hashes.preview}.json`],
  );
  assert.deepEqual(bundle.bindings, {
    provider: "bicep",
    operation: "apply",
    projectId: "demo",
    runId: "run-1",
    ownerEpoch: 3,
    previewHash: hashes.preview,
    recipient: "ci-apply",
    authorityExpiresAt: "2026-07-15T11:00:00.000Z",
  });
  await exportProviderTransfer(fixture.root, fixture.output, options, { key, now: () => instant, nonce });
  const first = await readFile(fixture.output);
  await exportProviderTransfer(fixture.root, fixture.output, options, { key, now: () => instant, nonce });
  assert.deepEqual(await readFile(fixture.output), first);
  assert(!first.includes(Buffer.alloc(32, 6)));
});

test("provider export selects the exact Terraform binding and encrypted artifact only", async () => {
  const fixture = await source("terraform");
  const bundle = await createProviderTransferBundle(
    fixture.root,
    {
      previewHash: hashes.preview,
      provider: "terraform",
      recipient: "ci-apply",
      ttlMs: 1_000,
    },
    instant,
  );
  assert.deepEqual(
    bundle.files.map(({ path }) => path),
    [
      `artifacts/${sha256Bytes(Buffer.from(terraformBinding().attestation.artifactRef, "utf8"))}.json`,
      `bindings/${hashes.preview}.json`,
    ],
  );
  assert.equal(bundle.bindings.artifactRef, terraformBinding().attestation.artifactRef);
  assert.equal(bundle.bindings.planDigest, hashes.plan);
  assert(
    !bundle.files.some(
      ({ path }) => path.includes("latest") || path.includes("plan-transport.key") || path.includes("f".repeat(64)),
    ),
  );
});

test("provider export rejects provider, recipient, binding, artifact, and TTL mismatches", async () => {
  const bicep = await source("bicep");
  await assert.rejects(
    createProviderTransferBundle(
      bicep.root,
      {
        previewHash: hashes.preview,
        provider: "terraform",
        recipient: "ci-apply",
        ttlMs: 1,
      },
      instant,
    ),
    /requested provider/,
  );
  for (const ttlMs of [0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
    await assert.rejects(
      createProviderTransferBundle(
        bicep.root,
        {
          previewHash: hashes.preview,
          provider: "bicep",
          recipient: "ci-apply",
          ttlMs,
        },
        instant,
      ),
      /TTL/,
    );
  }
  const malformed = await source("bicep");
  await writeJson(join(malformed.root, ".apex", "local", "provider-runtime", "bindings", `${hashes.preview}.json`), {
    ...bicepBinding(),
    unexpected: true,
  });
  await assert.rejects(
    createProviderTransferBundle(
      malformed.root,
      {
        previewHash: hashes.preview,
        provider: "bicep",
        recipient: "ci-apply",
        ttlMs: 1,
      },
      instant,
    ),
    /shape/,
  );

  const cases: Array<
    [
      string,
      (binding: ReturnType<typeof terraformBinding>, artifact: ReturnType<typeof terraformArtifact>) => void,
      RegExp,
    ]
  > = [
    [
      "recipient",
      (binding) => {
        binding.attestation.recipient = "other";
      },
      /recipient/,
    ],
    [
      "digest",
      (_binding, artifact) => {
        artifact.artifact.metadata.digest = "b".repeat(64);
      },
      /metadata mismatch/,
    ],
    [
      "artifact recipient",
      (_binding, artifact) => {
        artifact.artifact.metadata.recipient = "other";
      },
      /metadata mismatch/,
    ],
    [
      "IV",
      (_binding, artifact) => {
        artifact.artifact.iv = Buffer.alloc(12, 8).toString("base64");
      },
      /IV\/authTag/,
    ],
    [
      "authTag",
      (_binding, artifact) => {
        artifact.artifact.authTag = Buffer.alloc(16, 8).toString("base64");
      },
      /IV\/authTag/,
    ],
  ];
  for (const [, mutate, expected] of cases) {
    const fixture = await source("terraform");
    const binding = terraformBinding();
    const artifact = terraformArtifact(binding);
    mutate(binding, artifact);
    await writeJson(
      join(fixture.root, ".apex", "local", "provider-runtime", "bindings", `${hashes.preview}.json`),
      binding,
    );
    if (fixture.artifactPath !== undefined) await writeJson(fixture.artifactPath, artifact);
    await assert.rejects(
      createProviderTransferBundle(
        fixture.root,
        {
          previewHash: hashes.preview,
          provider: "terraform",
          recipient: "ci-apply",
          ttlMs: 1,
        },
        instant,
      ),
      expected,
    );
  }
  const missing = await source("terraform");
  await writeJson(join(missing.root, ".apex", "local", "provider-runtime", "bindings", `${hashes.preview}.json`), {
    ...terraformBinding(),
    attestation: { ...terraformBinding().attestation, artifactRef: "missing" },
  });
  await assert.rejects(
    createProviderTransferBundle(
      missing.root,
      {
        previewHash: hashes.preview,
        provider: "terraform",
        recipient: "ci-apply",
        ttlMs: 1,
      },
      instant,
    ),
    /ENOENT/,
  );

  await assert.rejects(
    exportProviderTransfer(
      bicep.root,
      bicep.output,
      { previewHash: hashes.preview, provider: "bicep", recipient: "ci-apply", ttlMs: 2 * 60 * 60 * 1_000 },
      { key, now: () => instant, nonce },
    ),
    /cannot outlive/,
  );
});

test("provider import rejects wrong recipient, expiry, tampering, and malformed exact contents", async () => {
  const fixture = await exported("terraform");
  await assert.rejects(
    importProviderTransfer(await tempRoot(), fixture.envelope, "other", key, () => instant),
    /recipient/,
  );
  await assert.rejects(
    importProviderTransfer(
      await tempRoot(),
      fixture.envelope,
      "ci-apply",
      key,
      () => new Date("2026-07-15T10:31:00.000Z"),
    ),
    /expired/,
  );
  await assert.rejects(
    importProviderTransfer(
      await tempRoot(),
      { ...fixture.envelope, ciphertext: `${fixture.envelope.ciphertext.slice(0, -2)}AA` },
      "ci-apply",
      key,
      () => instant,
    ),
  );

  const sourceRoot = await source("bicep");
  const bundle = await createProviderTransferBundle(
    sourceRoot.root,
    {
      previewHash: hashes.preview,
      provider: "bicep",
      recipient: "ci-apply",
      ttlMs: 1,
    },
    instant,
  );
  const traversed = { ...bundle, files: bundle.files.map((entry) => ({ ...entry, path: "../escape.json" })) };
  await assert.rejects(
    importProviderTransfer(await tempRoot(), seal(traversed), "ci-apply", key, () => instant),
    /path/,
  );
  const wrongHash = { ...bundle, files: bundle.files.map((entry) => ({ ...entry, sha256: "0".repeat(64) })) };
  await assert.rejects(
    importProviderTransfer(await tempRoot(), seal(wrongHash), "ci-apply", key, () => instant),
    /integrity/,
  );
  const duplicate = { ...bundle, files: [bundle.files[0]!, bundle.files[0]!] };
  await assert.rejects(
    importProviderTransfer(await tempRoot(), seal(duplicate), "ci-apply", key, () => instant),
    /duplicate/,
  );
  const oversized = { ...fixture.envelope, ciphertext: "A".repeat(Math.ceil((8 * 1024 * 1024) / 3) * 4 + 1) };
  await assert.rejects(
    importProviderTransfer(await tempRoot(), oversized, "ci-apply", key, () => instant),
    /8 MiB/,
  );
});

test("provider import rejects symlinks and conflicts, and permits byte-identical retries", async () => {
  const fixture = await exported("terraform");
  const destination = await tempRoot();
  const imported = await importProviderTransfer(destination, fixture.envelope, "ci-apply", key, () => instant);
  assert.deepEqual(
    await importProviderTransfer(destination, fixture.envelope, "ci-apply", key, () => instant),
    imported,
  );
  const runtime = join(destination, ".apex", "local", "provider-runtime");
  assert.equal((await lstat(join(runtime, "bindings", `${hashes.preview}.json`))).mode & 0o777, 0o600);
  assert.equal((await lstat(join(runtime, "bindings"))).mode & 0o777, 0o700);
  await assert.rejects(readFile(join(runtime, "plan-transport.key")), /ENOENT/);

  const conflict = await tempRoot();
  await writeJson(join(conflict, ".apex", "local", "provider-runtime", "bindings", `${hashes.preview}.json`), {
    different: true,
  });
  await assert.rejects(
    importProviderTransfer(conflict, fixture.envelope, "ci-apply", key, () => instant),
    /destination differs/,
  );
  await assert.rejects(
    readFile(join(conflict, ".apex", "local", "provider-runtime", "artifacts", `${"0".repeat(64)}.json`)),
    /ENOENT/,
  );

  for (const segment of [".apex", "local", "provider-runtime", "bindings"] as const) {
    const linked = await tempRoot();
    const outside = await tempRoot();
    if (segment === ".apex") {
      await symlink(outside, join(linked, ".apex"), "dir");
    } else {
      const parent =
        segment === "local"
          ? join(linked, ".apex")
          : segment === "provider-runtime"
            ? join(linked, ".apex", "local")
            : join(linked, ".apex", "local", "provider-runtime");
      await mkdir(parent, { recursive: true });
      await symlink(outside, join(parent, segment), "dir");
    }
    await assert.rejects(
      importProviderTransfer(linked, fixture.envelope, "ci-apply", key, () => instant),
      /unsafe/,
    );
  }
});

test("provider export rejects oversized source files", async () => {
  const fixture = await source("bicep");
  await writeFile(
    join(fixture.root, ".apex", "local", "provider-runtime", "bindings", `${hashes.preview}.json`),
    Buffer.alloc(4 * 1024 * 1024 + 1, 1),
  );
  await assert.rejects(
    createProviderTransferBundle(
      fixture.root,
      {
        previewHash: hashes.preview,
        provider: "bicep",
        recipient: "ci-apply",
        ttlMs: 1,
      },
      instant,
    ),
    /4 MiB/,
  );
});

test("provider transfer CLI requires confirmation and uses only the external runtime key", async () => {
  const fixture = await source("bicep");
  const runtimeBindingPath = join(
    fixture.root,
    ".apex",
    "local",
    "provider-runtime",
    "bindings",
    `${hashes.preview}.json`,
  );
  const current = new Date();
  await writeJson(runtimeBindingPath, {
    ...bicepBinding(),
    preview: {
      ...bicepBinding().preview,
      createdAt: current.toISOString(),
      expiresAt: new Date(current.getTime() + 60 * 60 * 1_000).toISOString(),
    },
  });
  const destination = await tempRoot();
  const previousKey = process.env.APEX_PLAN_TRANSPORT_KEY;
  process.env.APEX_PLAN_TRANSPORT_KEY = key.toString("base64");
  try {
    const exportArgs = [
      "provider",
      "transfer-export",
      "--preview",
      hashes.preview,
      "--provider",
      "bicep",
      "--file",
      fixture.output,
      "--recipient",
      "ci-apply",
      "--ttl-seconds",
      "1800",
    ];
    await assert.rejects(execute(exportArgs, fixture.root), /requires --yes/);
    const result = (await execute([...exportArgs, "--yes"], fixture.root)) as { files: number };
    assert.equal(result.files, 1);
    const importArgs = ["provider", "transfer-import", "--file", fixture.output, "--recipient", "ci-apply"];
    await assert.rejects(execute(importArgs, destination), /requires --yes/);
    const imported = (await execute([...importArgs, "--yes"], destination)) as { previewHash: string };
    assert.equal(imported.previewHash, hashes.preview);
    await assert.rejects(
      readFile(join(destination, ".apex", "local", "provider-runtime", "plan-transport.key")),
      /ENOENT/,
    );
  } finally {
    if (previousKey === undefined) delete process.env.APEX_PLAN_TRANSPORT_KEY;
    else process.env.APEX_PLAN_TRANSPORT_KEY = previousKey;
  }
});
