import assert from "node:assert/strict";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { EncryptedEnvelopeTransport, type EncryptedEnvelope } from "@apex/capabilities";
import { ObjectStore, canonicalJsonBytes } from "@apex/kernel";
import { execute } from "../cli.js";
import { ApexService } from "../service.js";
import {
  STATE_TRANSFER_KIND,
  createStateTransferBundle,
  exportStateTransfer,
  importStateTransfer,
  type StateTransferBundle,
} from "../state-transfer.js";
import { prepareValidatedRun, tempRoot, writeJson } from "./helpers.js";

const instant = new Date("2026-07-15T10:00:00.000Z");
const key = Buffer.alloc(32, 9);
const nonce = () => Buffer.alloc(12, 4);

interface SourceState {
  root: string;
  service: ApexService;
  projectId: string;
  runId: string;
  claimHash: string;
  envelopePath: string;
}

async function sourceState(clock = instant): Promise<SourceState> {
  const root = await tempRoot();
  let nextId = 0;
  const service = new ApexService(root, {
    clock: () => clock,
    idSource: () => (nextId++ === 0 ? "run-1" : `event-${nextId}`),
  });
  const selected = await service.init({ projectId: "demo" });
  await rm(join(root, ".apex", "runtime"), { recursive: true, force: true });
  await mkdir(join(root, ".apex", "runtime"), { recursive: true });
  const transfer = (await service.createWriterTransfer({
    repository: "owner/repository",
    branch: "qualification",
    commit: "candidate-commit",
    workflowId: "qualification.yml",
    approvalEnvironment: "vnext-qualification",
    sender: "local",
    recipient: "ci",
    currentHead: "candidate-commit",
    ttlMs: 60 * 60 * 1_000,
  })) as { hash: string };
  return {
    root,
    service,
    projectId: selected.projectId,
    runId: selected.runId,
    claimHash: transfer.hash,
    envelopePath: join(root, "transfer.json"),
  };
}

async function exportEnvelope(source: SourceState): Promise<EncryptedEnvelope> {
  await exportStateTransfer(
    source.root,
    source.envelopePath,
    { claimHash: source.claimHash, recipient: "ci", ttlMs: 30 * 60 * 1_000 },
    { key, now: () => instant, nonce },
  );
  return JSON.parse(await readFile(source.envelopePath, "utf8")) as EncryptedEnvelope;
}

function seal(bundle: StateTransferBundle): EncryptedEnvelope {
  return new EncryptedEnvelopeTransport(() => instant, nonce).encrypt(canonicalJsonBytes(bundle), key, {
    kind: STATE_TRANSFER_KIND,
    recipient: "ci",
    ttlMs: 30 * 60 * 1_000,
    bindings: bundle.bindings,
  });
}

test("state export is deterministic and includes only selected state plus recursive object closure", async () => {
  const source = await sourceState();
  const objects = new ObjectStore(source.root);
  const leafHash = await objects.putJson({ value: "leaf" });
  const parentHash = await objects.putJson({ child: leafHash });
  const unrelatedHash = await objects.putJson({ value: "unreferenced" });
  const runRoot = join(source.root, ".apex", "projects", source.projectId, "runs", source.runId);
  await writeJson(join(runRoot, "refs.json"), { objectHash: parentHash });
  await writeJson(join(source.root, ".apex", "runtime", "qualification.json"), { enabled: true });
  await writeJson(join(source.root, ".apex", "runtime", "capability-packs", "excluded", "pack.json"), {
    excluded: true,
  });
  await writeJson(join(source.root, ".apex", "projects", "other", "project.json"), { projectId: "other" });
  await writeJson(join(source.root, ".apex", "projects", source.projectId, "runs", "other-run", "run.json"), {
    runId: "other-run",
  });

  const bundle = await createStateTransferBundle(
    source.root,
    { claimHash: source.claimHash, recipient: "ci", ttlMs: 1 },
    instant,
  );
  const paths = bundle.files.map(({ path }) => path);
  assert.equal(bundle.bindings.approvalEnvironment, "vnext-qualification");
  assert.deepEqual(paths, [...paths].sort());
  assert(paths.includes(`objects/sha256/${parentHash.slice(0, 2)}/${parentHash.slice(2)}`));
  assert(paths.includes(`objects/sha256/${leafHash.slice(0, 2)}/${leafHash.slice(2)}`));
  assert(!paths.includes(`objects/sha256/${unrelatedHash.slice(0, 2)}/${unrelatedHash.slice(2)}`));
  assert(paths.includes("runtime/qualification.json"));
  assert(!paths.some((path) => path.startsWith("runtime/capability-packs/")));
  assert(!paths.some((path) => path.includes("projects/other/")));
  assert(!paths.some((path) => path.includes("runs/other-run/")));
  assert(!paths.some((path) => /^(?:local|work|cache)\//.test(path)));

  const first = await exportEnvelope(source);
  const second = await exportEnvelope(source);
  assert.deepEqual(first, second);
});

test("state export rejects secrets and individual or aggregate size overflow", async () => {
  const secretSource = await sourceState();
  const runRoot = join(secretSource.root, ".apex", "projects", secretSource.projectId, "runs", secretSource.runId);
  await writeJson(join(runRoot, "secret.json"), { clientSecret: "must-not-appear" });
  await assert.rejects(
    createStateTransferBundle(
      secretSource.root,
      { claimHash: secretSource.claimHash, recipient: "ci", ttlMs: 1 },
      instant,
    ),
    (error: Error) => error.message.includes("secret.json/clientSecret") && !error.message.includes("must-not-appear"),
  );

  const prohibitedSource = await sourceState();
  const prohibitedRun = join(
    prohibitedSource.root,
    ".apex",
    "projects",
    prohibitedSource.projectId,
    "runs",
    prohibitedSource.runId,
  );
  await writeJson(join(prohibitedRun, "terraform.tfstate"), { version: 4 });
  await assert.rejects(
    createStateTransferBundle(
      prohibitedSource.root,
      { claimHash: prohibitedSource.claimHash, recipient: "ci", ttlMs: 1 },
      instant,
    ),
    /path is prohibited/,
  );

  const largeSource = await sourceState();
  const largeRun = join(largeSource.root, ".apex", "projects", largeSource.projectId, "runs", largeSource.runId);
  await writeFile(join(largeRun, "large.json"), JSON.stringify({ value: "x".repeat(4 * 1024 * 1024) }));
  await assert.rejects(
    createStateTransferBundle(
      largeSource.root,
      { claimHash: largeSource.claimHash, recipient: "ci", ttlMs: 1 },
      instant,
    ),
    /4 MiB file limit/,
  );

  const aggregateSource = await sourceState();
  const aggregateRun = join(
    aggregateSource.root,
    ".apex",
    "projects",
    aggregateSource.projectId,
    "runs",
    aggregateSource.runId,
  );
  for (let index = 0; index < 4; index += 1) {
    await writeFile(
      join(aggregateRun, `aggregate-${index}.json`),
      JSON.stringify({ value: "x".repeat(3 * 1024 * 1024) }),
    );
  }
  await assert.rejects(
    createStateTransferBundle(
      aggregateSource.root,
      { claimHash: aggregateSource.claimHash, recipient: "ci", ttlMs: 1 },
      instant,
    ),
    /16 MiB limit/,
  );
});

test("state export permits only exact secure policy assertions", async () => {
  const source = await sourceState();
  const defaultsPath = join(source.root, ".apex", "runtime", "defaults.v1.json");
  await writeJson(defaultsPath, {
    securityInvariants: {
      hardcodedSecretsAllowed: false,
      secretValuesInGitAllowed: false,
    },
    evidence: { genericSecretScanRequired: true },
    telemetry: { authorizationEvidenceSeparable: true },
  });
  await assert.doesNotReject(
    createStateTransferBundle(source.root, { claimHash: source.claimHash, recipient: "ci", ttlMs: 1 }, instant),
  );

  await writeJson(defaultsPath, {
    securityInvariants: {
      hardcodedSecretsAllowed: true,
      secretValuesInGitAllowed: false,
    },
    evidence: { genericSecretScanRequired: true },
    telemetry: { authorizationEvidenceSeparable: true },
  });
  await assert.rejects(
    createStateTransferBundle(source.root, { claimHash: source.claimHash, recipient: "ci", ttlMs: 1 }, instant),
    /runtime\/defaults\.v1\.json\/securityInvariants\/hardcodedSecretsAllowed/,
  );

  await writeJson(defaultsPath, {
    securityInvariants: {
      hardcodedSecretsAllowed: false,
      secretValuesInGitAllowed: false,
    },
    evidence: { genericSecretScanRequired: false },
    telemetry: { authorizationEvidenceSeparable: true },
  });
  await assert.rejects(
    createStateTransferBundle(source.root, { claimHash: source.claimHash, recipient: "ci", ttlMs: 1 }, instant),
    /runtime\/defaults\.v1\.json\/evidence\/genericSecretScanRequired/,
  );

  await writeJson(defaultsPath, {
    securityInvariants: {
      hardcodedSecretsAllowed: false,
      secretValuesInGitAllowed: false,
    },
    evidence: { genericSecretScanRequired: true },
    telemetry: { authorizationEvidenceSeparable: true },
  });
  await writeJson(join(source.root, ".apex", "runtime", "other.json"), { hardcodedSecretsAllowed: false });
  await assert.rejects(
    createStateTransferBundle(source.root, { claimHash: source.claimHash, recipient: "ci", ttlMs: 1 }, instant),
    /runtime\/other\.json\/hardcodedSecretsAllowed/,
  );
});

test("state import rejects wrong recipient, expiry, and tampered envelopes", async () => {
  const source = await sourceState();
  const envelope = await exportEnvelope(source);
  await assert.rejects(
    importStateTransfer(await tempRoot(), envelope, "other", key, () => instant),
    /recipient/,
  );
  await assert.rejects(
    importStateTransfer(await tempRoot(), envelope, "ci", key, () => new Date("2026-07-15T10:31:00.000Z")),
    /expired/,
  );
  const tampered = { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -2)}AA` };
  await assert.rejects(importStateTransfer(await tempRoot(), tampered, "ci", key, () => instant));
});

test("state envelope cannot outlive its writer-transfer claim", async () => {
  const source = await sourceState();
  await assert.rejects(
    exportStateTransfer(
      source.root,
      source.envelopePath,
      { claimHash: source.claimHash, recipient: "ci", ttlMs: 2 * 60 * 60 * 1_000 },
      { key, now: () => instant, nonce },
    ),
    /cannot outlive/,
  );
});

test("state import rejects traversal and symlink ancestors", async () => {
  const source = await sourceState();
  const bundle = await createStateTransferBundle(
    source.root,
    { claimHash: source.claimHash, recipient: "ci", ttlMs: 1 },
    instant,
  );
  const traversed: StateTransferBundle = {
    ...bundle,
    files: bundle.files.map((entry, index) => (index === 0 ? { ...entry, path: "../escape.json" } : entry)),
  };
  await assert.rejects(
    importStateTransfer(await tempRoot(), seal(traversed), "ci", key, () => instant),
    /allowlist/,
  );

  const destination = await tempRoot();
  const outside = await tempRoot();
  await mkdir(join(destination, ".apex"));
  await symlink(outside, join(destination, ".apex", "projects"), "dir");
  await assert.rejects(
    importStateTransfer(destination, seal(bundle), "ci", key, () => instant),
    /ancestor is unsafe/,
  );

  const linkedRoot = await tempRoot();
  await symlink(await tempRoot(), join(linkedRoot, ".apex"), "dir");
  await assert.rejects(
    importStateTransfer(linkedRoot, seal(bundle), "ci", key, () => instant),
    /APEX root is unsafe/,
  );
});

test("state import preflights conflicts, permits idempotence, and preserves writer acceptance", async () => {
  const source = await sourceState();
  const envelope = await exportEnvelope(source);
  const destination = await tempRoot();
  const imported = await importStateTransfer(destination, envelope, "ci", key, () => instant);
  assert.equal(imported.claimHash, source.claimHash);
  assert.deepEqual(await importStateTransfer(destination, envelope, "ci", key, () => instant), imported);

  const destinationService = new ApexService(destination, {
    clock: () => instant,
    idSource: () => "accept-event",
  });
  assert.equal(await destinationService.currentWriter(), null);
  const accepted = (await destinationService.acceptWriterTransfer(source.claimHash, "ci", "candidate-commit")) as {
    ownerId: string;
    ownerEpoch: number;
    approvalEnvironment?: string;
  };
  assert.deepEqual({ ownerId: accepted.ownerId, ownerEpoch: accepted.ownerEpoch }, { ownerId: "ci", ownerEpoch: 2 });
  assert.equal(accepted.approvalEnvironment, "vnext-qualification");

  const conflictDestination = await tempRoot();
  await mkdir(join(conflictDestination, ".apex"), { recursive: true });
  await writeJson(join(conflictDestination, ".apex", "config.json"), { projectId: "different", runId: "run-x" });
  await assert.rejects(
    importStateTransfer(conflictDestination, envelope, "ci", key, () => instant),
    /destination differs: config.json/,
  );
  await assert.rejects(readFile(join(conflictDestination, ".apex", "apex.lock.json")), /ENOENT/);
});

test("post-preview state transfer resumes in a fresh workspace and deploys the exact preview", async () => {
  const sourceRoot = await tempRoot();
  const source = new ApexService(sourceRoot, { clock: () => instant });
  const initialized = await source.init({ projectId: "demo" });
  await prepareValidatedRun(source, initialized.runId, "bicep");
  const preview = await source.preview({ operation: "apply", provider: "fake" });
  const transfer = (await source.createWriterTransfer({
    repository: "owner/repository",
    branch: "qualification",
    commit: "candidate-commit",
    workflowId: "qualification.yml",
    sender: "local",
    recipient: "ci",
    currentHead: "candidate-commit",
    ttlMs: 60 * 60 * 1_000,
  })) as { hash: string };
  const envelopePath = join(sourceRoot, "post-preview-state.json");
  await exportStateTransfer(
    sourceRoot,
    envelopePath,
    { claimHash: transfer.hash, recipient: "ci", ttlMs: 30 * 60 * 1_000 },
    { key, now: () => instant, nonce },
  );

  const destination = await tempRoot();
  await importStateTransfer(
    destination,
    JSON.parse(await readFile(envelopePath, "utf8")) as EncryptedEnvelope,
    "ci",
    key,
    () => instant,
  );
  const resumed = new ApexService(destination, { clock: () => instant });
  await resumed.acceptWriterTransfer(transfer.hash, "ci", "candidate-commit");
  const approval = await resumed.decideGateNumber(4, "approved", "tester");
  assert.equal(approval.writerTransferClaimHash, transfer.hash);
  const deployed = await resumed.deploy(preview.previewHash);
  assert.equal((deployed.operation as { previewHash?: unknown }).previewHash, preview.previewHash);
});

test("state transfer CLI adapters require confirmation and use the provider runtime key", async () => {
  const source = await sourceState(new Date());
  const destination = await tempRoot();
  const previousKey = process.env.APEX_PLAN_TRANSPORT_KEY;
  process.env.APEX_PLAN_TRANSPORT_KEY = key.toString("base64");
  try {
    await assert.rejects(
      execute(
        [
          "state",
          "transfer-export",
          "--claim",
          source.claimHash,
          "--file",
          source.envelopePath,
          "--recipient",
          "ci",
          "--ttl-seconds",
          "1800",
        ],
        source.root,
      ),
      /requires --yes/,
    );
    const exported = (await execute(
      [
        "state",
        "transfer-export",
        "--claim",
        source.claimHash,
        "--file",
        source.envelopePath,
        "--recipient",
        "ci",
        "--ttl-seconds",
        "1800",
        "--yes",
      ],
      source.root,
    )) as { files: number };
    assert(exported.files > 0);
    await assert.rejects(
      execute(["state", "transfer-import", "--file", source.envelopePath, "--recipient", "ci"], destination),
      /requires --yes/,
    );
    const imported = (await execute(
      ["state", "transfer-import", "--file", source.envelopePath, "--recipient", "ci", "--yes"],
      destination,
    )) as { claimHash: string };
    assert.equal(imported.claimHash, source.claimHash);
    await assert.rejects(
      readFile(join(destination, ".apex", "local", "provider-runtime", "plan-transport.key")),
      /ENOENT/,
    );
  } finally {
    if (previousKey === undefined) delete process.env.APEX_PLAN_TRANSPORT_KEY;
    else process.env.APEX_PLAN_TRANSPORT_KEY = previousKey;
  }
});
