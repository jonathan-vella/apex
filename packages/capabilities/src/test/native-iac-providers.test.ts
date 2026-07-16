import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Value } from "@sinclair/typebox/value";
import { FormatRegistry } from "@sinclair/typebox";
import { ExecutionPlanAttestationV1Schema, type ApprovalEvidenceV1, type DeploymentPreviewV1 } from "@apex/contracts";
import {
  IacOutputParseError,
  IacProviderError,
  LocalEncryptedPlanTransport,
  NativeBicepProvider,
  NativeTerraformProvider,
  normalizeAzureWhatIf,
  normalizeTerraformPlan,
  selectAzureDeploymentStack,
  type CurrentDeploymentAuthority,
  type PreviewRequest,
  type ProcessRequest,
  type ProcessResult,
  type ProcessRunnerLike,
  type LocalEncryptedPlan,
  type PersistedPreviewBinding,
  type TerraformNativeTarget,
} from "../index.js";

const hashes = {
  head: "a".repeat(64),
  input: "b".repeat(64),
  iac: "c".repeat(64),
  policy: "d".repeat(64),
  lock: "e".repeat(64),
};
if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set("date-time", (value) => !Number.isNaN(Date.parse(value)));
}
const clock = { value: new Date("2026-07-13T01:00:00.000Z") };
const authority: CurrentDeploymentAuthority = {
  head: hashes.head,
  dependencyRevision: hashes.head,
  ownerEpoch: 3,
  recipientIdentity: "writer@example.com",
};

function request(overrides: Partial<PreviewRequest> = {}): PreviewRequest {
  return {
    projectId: "project",
    runId: "run",
    environment: "dev",
    target: "/subscriptions/sub/resourceGroups/rg",
    commit: hashes.head,
    dependencyRevision: hashes.head,
    ownerEpoch: 3,
    inputHash: hashes.input,
    iacHash: hashes.iac,
    policyHash: hashes.policy,
    resources: [],
    ttlMs: 60_000,
    ...overrides,
  };
}

function approval(preview: DeploymentPreviewV1): ApprovalEvidenceV1 {
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
    writerEpoch: authority.ownerEpoch,
    recipientIdentity: authority.recipientIdentity,
    decidedAt: clock.value.toISOString(),
    expiresAt: "2026-07-13T02:00:00.000Z",
  };
}

class FakeRunner implements ProcessRunnerLike {
  readonly requests: ProcessRequest[] = [];
  constructor(private readonly respond: (request: ProcessRequest) => Promise<string> | string) {}

  async run(request: ProcessRequest): Promise<ProcessResult> {
    this.requests.push(request);
    return {
      exitCode: 0,
      signal: null,
      stdout: await this.respond(request),
      stderr: "",
      timedOut: false,
      outputTruncated: false,
    };
  }
}

class MemoryBindingStore {
  readonly values = new Map<string, PersistedPreviewBinding>();
  readonly latest = new Map<string, PersistedPreviewBinding>();
  async save(previewHash: string, binding: PersistedPreviewBinding): Promise<void> {
    this.values.set(previewHash, binding);
    this.latest.set(
      `${binding.preview.projectId}\u0000${binding.preview.runId}\u0000${binding.preview.operation}`,
      binding,
    );
  }
  async load(previewHash: string): Promise<PersistedPreviewBinding | undefined> {
    return this.values.get(previewHash);
  }
  async loadLatest(
    projectId: string,
    runId: string,
    operation: "apply" | "destroy",
  ): Promise<PersistedPreviewBinding | undefined> {
    return this.latest.get(`${projectId}\u0000${runId}\u0000${operation}`);
  }
}

class MemoryArtifactStore {
  readonly values = new Map<string, LocalEncryptedPlan>();
  async put(reference: string, artifact: LocalEncryptedPlan): Promise<void> {
    this.values.set(reference, artifact);
  }
  async get(reference: string): Promise<LocalEncryptedPlan | undefined> {
    return this.values.get(reference);
  }
}

test("Azure and Terraform normalizers block unknown or unevaluated changes", () => {
  const azure = normalizeAzureWhatIf({
    properties: {
      changes: [
        { resourceId: "/created", changeType: "Create" },
        { resourceId: "/ignored", changeType: "Ignore" },
        { resourceId: "/unknown", changeType: "Unsupported" },
      ],
    },
  });
  assert.deepEqual(
    azure.changes.map((change) => change.action),
    ["create", "no-op", "unknown"],
  );
  assert.equal(azure.blockers.length, 1);

  const terraform = normalizeTerraformPlan({
    resource_changes: [
      { address: "azurerm_resource_group.main", change: { actions: ["no-op"] } },
      { address: "azurerm_storage_account.main", change: { actions: ["delete", "create"] } },
      { address: "unknown.main", change: { actions: ["forget"] } },
    ],
    deferred_changes: [{}],
  });
  assert.deepEqual(
    terraform.changes.map((change) => change.action),
    ["no-op", "replace", "unknown"],
  );
  assert.equal(terraform.blockers.length, 2);
  assert.throws(() => normalizeAzureWhatIf({}), IacOutputParseError);
});

test("normalizers block missing, duplicate, and malformed material change identities", () => {
  const azure = normalizeAzureWhatIf({
    changes: [
      { changeType: "Create" },
      { resourceId: "/duplicate", changeType: "Delete" },
      { resourceId: "/duplicate", changeType: "Modify" },
      null,
    ],
  });
  assert.match(azure.blockers.join("\n"), /no stable resource ID|duplicate material|not a JSON object/);

  const terraform = normalizeTerraformPlan({
    resource_changes: [
      { change: { actions: ["create"] } },
      { address: "duplicate.main", change: { actions: ["update"] } },
      { address: "duplicate.main", change: { actions: ["delete"] } },
      { address: "broken.main", change: {} },
    ],
  });
  assert.match(terraform.blockers.join("\n"), /no stable resource address|duplicate material|malformed/);
});

function stack(name: string, resourceGroup = "rg", resources: unknown[] = []) {
  return {
    id: `/subscriptions/sub/resourceGroups/${resourceGroup}/providers/Microsoft.Resources/deploymentStacks/${name}`,
    name,
    properties: { resources },
  };
}

test("Azure stack selection distinguishes absent, exact, malformed, duplicate, and wrong-scope results", () => {
  const exact = stack("workload");
  assert.equal(selectAzureDeploymentStack([stack("other")], "rg", "workload"), null);
  assert.equal(selectAzureDeploymentStack([stack("other"), exact], "rg", "Workload"), exact);
  assert.throws(() => selectAzureDeploymentStack({}, "rg", "workload"), /must be a JSON array/);
  assert.throws(() => selectAzureDeploymentStack([{}], "rg", "workload"), /entry 0 is malformed/);
  assert.throws(() => selectAzureDeploymentStack([exact, stack("WORKLOAD")], "rg", "workload"), /duplicate name/);
  assert.throws(() => selectAzureDeploymentStack([stack("workload", "other")], "rg", "workload"), /outside/);
  assert.throws(
    () => selectAzureDeploymentStack([{ ...exact, properties: {} }], "rg", "workload"),
    /malformed managed resources/,
  );
});

test("native Bicep first preview binds empty stack state and creates only after approval", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "apex-native-bicep-first-"));
  context.after(async () => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "main.bicep"), "targetScope = 'resourceGroup'\n");
  let created = false;
  const runner = new FakeRunner((process) => {
    if (process.args.includes("what-if")) {
      return JSON.stringify({ properties: { changes: [{ resourceId: "/resource", changeType: "Create" }] } });
    }
    if (process.args[2] === "list") {
      return JSON.stringify(
        created ? [stack("workload", "rg", [{ id: "/resource", name: "resource", type: "Example/type" }])] : [],
      );
    }
    if (process.args[2] === "create") {
      created = true;
      return JSON.stringify({ id: "/stack/workload" });
    }
    return "";
  });
  const provider = new NativeBicepProvider({
    runner,
    currentAuthority: async () => authority,
    now: () => clock.value,
    nextId: () => "operation",
    bindingStore: new MemoryBindingStore(),
    target: {
      cwd: root,
      resourceGroup: "rg",
      deploymentName: "preview",
      stackName: "workload",
      templateFile: "main.bicep",
      denySettingsMode: "denyDelete",
    },
  });
  const preview = await provider.previewApply(request());
  assert.equal(created, false);
  assert.equal((await provider.apply(preview, approval(preview), authority)).state, "succeeded");
  assert.equal(created, true);
  assert.equal((await provider.inventory("project", "run")).resources.length, 1);
  const listCommands = runner.requests.filter((entry) => entry.args[2] === "list");
  assert.ok(listCommands.length >= 3);
  assert.equal(
    listCommands.some((entry) => entry.args.includes("--name")),
    false,
  );
});

test("native Bicep lifecycle binds fallback preview inputs/state and exact stack commands", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "apex-native-bicep-"));
  context.after(async () => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "main.bicep"), "targetScope = 'resourceGroup'\n");
  await writeFile(join(root, "main.bicepparam"), "using './main.bicep'\n");
  const runner = new FakeRunner((process) => {
    if (process.args.includes("what-if")) {
      return JSON.stringify({ properties: { changes: [{ resourceId: "/resource", changeType: "Create" }] } });
    }
    if (process.args[2] === "list") {
      return JSON.stringify([stack("workload", "rg", [{ id: "/resource", name: "resource", type: "Example/type" }])]);
    }
    return JSON.stringify({ id: "/stack/workload" });
  });
  let current = authority;
  const bindings = new MemoryBindingStore();
  const options = {
    runner,
    currentAuthority: async () => current,
    now: () => clock.value,
    nextId: () => "operation",
    bindingStore: bindings,
    target: {
      cwd: root,
      resourceGroup: "rg",
      deploymentName: "preview",
      stackName: "workload",
      templateFile: "main.bicep",
      parametersFile: "main.bicepparam",
      actionOnUnmanage: "deleteResources",
      ownershipAuthorizesDeleteResources: true,
      denySettingsMode: "denyWriteAndDelete",
    },
  } as const;
  const provider = new NativeBicepProvider(options);
  const applyPreview = await provider.previewApply(request());
  const restarted = new NativeBicepProvider(options);
  const applyOperation = await restarted.apply(applyPreview, approval(applyPreview), authority);
  assert.deepEqual(restarted.executionEvidence(applyOperation.operationId), {
    mode: "native",
    operationId: applyOperation.operationId,
    previewHash: applyPreview.previewHash,
    validatorIds: ["deploy:bicep-stack-ownership"],
  });
  assert.equal(
    runner.requests.some((entry) => entry.args[2] === "create"),
    true,
  );
  assert.equal(runner.requests.flatMap((entry) => entry.args).includes("--bypass-stack-out-of-sync-error"), false);
  const previewCommand = runner.requests.find((entry) => entry.args.includes("what-if"))!;
  const applyCommand = runner.requests.find((entry) => entry.args[2] === "create")!;
  for (const flag of ["--resource-group", "--template-file", "--parameters"]) {
    assert.equal(
      applyCommand.args[applyCommand.args.indexOf(flag) + 1],
      previewCommand.args[previewCommand.args.indexOf(flag) + 1],
    );
  }
  assert.equal(applyCommand.args[applyCommand.args.indexOf("--name") + 1], "workload");
  assert.equal(applyCommand.args[applyCommand.args.indexOf("--action-on-unmanage") + 1], "deleteResources");
  assert.equal(applyCommand.args[applyCommand.args.indexOf("--deny-settings-mode") + 1], "denyWriteAndDelete");
  assert.equal((await provider.inventory("project", "run")).resources.length, 1);

  const destroyPreview = await provider.previewDestroy(request());
  await provider.destroy(destroyPreview, approval(destroyPreview), authority);
  const deleteRequest = runner.requests.find((entry) => entry.args[2] === "delete");
  assert.deepEqual(deleteRequest?.args.slice(0, 7), [
    "stack",
    "group",
    "delete",
    "--resource-group",
    "rg",
    "--name",
    "workload",
  ]);

  const stalePreview = await provider.previewApply(request());
  current = { ...authority, ownerEpoch: 4 };
  await assert.rejects(
    provider.apply(stalePreview, approval(stalePreview), authority),
    (error) => error instanceof IacProviderError && error.code === "PREVIEW_OWNER_EPOCH_MISMATCH",
  );

  current = authority;

  const superseded = await provider.previewApply(request({ runId: "superseded" }));
  await provider.previewApply(
    request({ runId: "superseded", commit: "e".repeat(64), dependencyRevision: "e".repeat(64) }),
  );
  const supersededRestart = new NativeBicepProvider(options);
  await assert.rejects(
    supersededRestart.apply(superseded, approval(superseded), authority),
    (error) => error instanceof IacProviderError && error.code === "PREVIEW_SUPERSEDED",
  );
  const mutationPreview = await provider.previewApply(request({ runId: "mutated" }));
  await writeFile(join(root, "main.bicep"), "targetScope = 'subscription'\n");
  await assert.rejects(
    restarted.apply(mutationPreview, approval(mutationPreview), authority),
    (error) => error instanceof IacProviderError && error.code === "PREVIEW_HASH_MISMATCH",
  );
});

test("Bicep fallback blocks unrepresented managed resources and enforces safe action defaults", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "apex-native-bicep-safety-"));
  context.after(async () => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "main.bicep"), "targetScope = 'resourceGroup'\n");
  const runner = new FakeRunner((process) =>
    process.args.includes("what-if")
      ? JSON.stringify({ changes: [{ resourceId: "/represented", changeType: "Modify" }] })
      : JSON.stringify([stack("workload", "rg", [{ id: "/removed", name: "removed", type: "Example/type" }])]),
  );
  const base = {
    runner,
    currentAuthority: async () => authority,
    now: () => clock.value,
    target: {
      cwd: root,
      resourceGroup: "rg",
      deploymentName: "preview",
      stackName: "workload",
      templateFile: "main.bicep",
      denySettingsMode: "none" as const,
    },
  };
  const provider = new NativeBicepProvider(base);
  const preview = await provider.previewApply(request());
  assert.match(preview.blockers.join("\n"), /cannot prove action-on-unmanage.*\/removed/);
  assert.throws(
    () => new NativeBicepProvider({ ...base, target: { ...base.target, actionOnUnmanage: "deleteResources" } }),
    /ownership authorization/,
  );
  assert.throws(
    () => new NativeBicepProvider({ ...base, target: { ...base.target, actionOnUnmanage: "deleteAll" } }),
    /dedicated sandbox/,
  );
});

test("native Terraform encrypts immediately and restores exact-plan binding after restart", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "apex-native-terraform-"));
  context.after(async () => rm(root, { recursive: true, force: true }));
  const applyPath = join(root, "apply.tfplan");
  const destroyPath = join(root, "destroy.tfplan");
  const runner = new FakeRunner(async (process) => {
    const outputArg = process.args.find((argument) => argument.startsWith("-out="));
    if (outputArg !== undefined) {
      await writeFile(outputArg.slice(5), process.args.includes("-destroy") ? "destroy-plan" : "apply-plan", {
        mode: 0o600,
      });
      return "";
    }
    if (process.args[0] === "show" && process.args[1] === "-json") {
      return JSON.stringify({
        resource_changes: [{ address: "azurerm_resource_group.main", change: { actions: ["create"] } }],
        prior_state: { lineage: "lineage-1", serial: 7 },
      });
    }
    return "";
  });
  const bindings = new MemoryBindingStore();
  const artifacts = new MemoryArtifactStore();
  const key = Buffer.alloc(32, 9);
  let configHash = hashes.iac;
  let lockfileHash = hashes.lock;
  const target: TerraformNativeTarget = {
    cwd: root,
    target: "dev",
    planPath: (_request, operation) => (operation === "apply" ? applyPath : destroyPath),
    get lockfileHash() {
      return lockfileHash;
    },
    configHash: async () => configHash,
  };
  const options = {
    runner,
    currentAuthority: async () => authority,
    now: () => clock.value,
    nextId: () => "terraform-operation",
    target,
    bindingStore: bindings,
    artifactStore: artifacts,
    keyProvider: async () => key,
  };
  const provider = new NativeTerraformProvider(options);

  const applyPreview = await provider.previewApply(request());
  await assert.rejects(stat(applyPath), /ENOENT/);
  assert.equal(artifacts.values.size, 1);
  assert.equal(provider.attestation(applyPreview.previewHash)?.lockfileHash, hashes.lock);
  const attestation = provider.attestation(applyPreview.previewHash);
  assert.equal(
    Value.Check(ExecutionPlanAttestationV1Schema, attestation),
    true,
    JSON.stringify([...Value.Errors(ExecutionPlanAttestationV1Schema, attestation)]),
  );
  assert.equal("savedPlanPath" in (provider.attestation(applyPreview.previewHash) ?? {}), false);

  const restarted = new NativeTerraformProvider(options);
  const applyOperation = await restarted.apply(applyPreview, approval(applyPreview), authority);
  assert.deepEqual(restarted.executionEvidence(applyOperation.operationId), {
    mode: "native",
    operationId: applyOperation.operationId,
    previewHash: applyPreview.previewHash,
    validatorIds: ["deploy:exact-saved-plan", "deploy:state-lineage-and-serial"],
  });
  const exactApply = runner.requests.at(-1);
  assert.equal(exactApply?.args[0], "apply");
  assert.match(exactApply?.args[2] ?? "", /apex-local-plan-/);
  await assert.rejects(stat(exactApply?.args[2] ?? ""), /ENOENT/);

  const mutationPreview = await provider.previewApply(request({ runId: "mutation" }));
  configHash = "f".repeat(64);
  await assert.rejects(
    restarted.apply(mutationPreview, approval(mutationPreview), authority),
    (error) => error instanceof IacProviderError && error.code === "PREVIEW_HASH_MISMATCH",
  );
  configHash = hashes.iac;
  lockfileHash = "1".repeat(64);
  await assert.rejects(
    restarted.apply(mutationPreview, approval(mutationPreview), authority),
    (error) => error instanceof IacProviderError && error.code === "PREVIEW_HASH_MISMATCH",
  );
  lockfileHash = hashes.lock;

  const wrongKey = new NativeTerraformProvider({ ...options, keyProvider: async () => Buffer.alloc(32, 8) });
  await assert.rejects(wrongKey.apply(mutationPreview, approval(mutationPreview), authority));

  const binding = bindings.values.get(mutationPreview.previewHash);
  assert.equal(binding?.kind, "terraform");
  if (binding?.kind === "terraform") {
    const encrypted = artifacts.values.get(binding.attestation.artifactRef)!;
    const first = encrypted.ciphertext[0] === "A" ? "B" : "A";
    artifacts.values.set(binding.attestation.artifactRef, {
      ...encrypted,
      ciphertext: `${first}${encrypted.ciphertext.slice(1)}`,
    });
    await assert.rejects(restarted.apply(mutationPreview, approval(mutationPreview), authority));
  }
});

test("native Terraform encrypts for the planned post-preview recipient", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "apex-native-terraform-recipient-"));
  context.after(async () => rm(root, { recursive: true, force: true }));
  const planPath = join(root, "apply.tfplan");
  const runner = new FakeRunner(async (process) => {
    const outputArg = process.args.find((argument) => argument.startsWith("-out="));
    if (outputArg !== undefined) {
      await writeFile(outputArg.slice(5), "recipient-plan", { mode: 0o600 });
      return "";
    }
    if (process.args[0] === "show") return JSON.stringify({ resource_changes: [] });
    return "";
  });
  const claimHash = "9".repeat(64);
  let currentAuthority: CurrentDeploymentAuthority = authority;
  const provider = new NativeTerraformProvider({
    runner,
    currentAuthority: async () => currentAuthority,
    now: () => clock.value,
    target: {
      cwd: root,
      target: "dev",
      planPath: () => planPath,
      lockfileHash: hashes.lock,
      configHash: async () => hashes.iac,
    },
    bindingStore: new MemoryBindingStore(),
    artifactStore: new MemoryArtifactStore(),
    keyProvider: async () => Buffer.alloc(32, 7),
  });
  const preview = await provider.previewApply(request({ executionRecipientIdentity: "apply@example.com" }));
  assert.equal(provider.attestation(preview.previewHash)?.recipient, "apply@example.com");
  currentAuthority = {
    ...authority,
    ownerEpoch: 4,
    previousOwnerEpoch: 3,
    writerTransferClaimHash: claimHash,
    recipientIdentity: "apply@example.com",
  };
  const transferredApproval: ApprovalEvidenceV1 = {
    ...approval(preview),
    writerEpoch: 4,
    writerTransferClaimHash: claimHash,
    recipientIdentity: "apply@example.com",
  };
  assert.equal((await provider.apply(preview, transferredApproval, currentAuthority)).state, "succeeded");

  const missingClaim = { ...transferredApproval };
  delete missingClaim.writerTransferClaimHash;
  await assert.rejects(
    provider.apply(preview, missingClaim, currentAuthority),
    (error) => error instanceof IacProviderError && error.code === "PREVIEW_OWNER_EPOCH_MISMATCH",
  );
  await assert.rejects(
    provider.apply(preview, transferredApproval, { ...currentAuthority, recipientIdentity: "wrong@example.com" }),
    (error) => error instanceof IacProviderError && error.code === "PREVIEW_OWNER_EPOCH_MISMATCH",
  );
});

test("native Terraform cleans decrypted temp plans when apply fails", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "apex-native-terraform-failure-"));
  context.after(async () => rm(root, { recursive: true, force: true }));
  const planPath = join(root, "apply.tfplan");
  let appliedPath = "";
  const runner: ProcessRunnerLike = {
    async run(process) {
      const outputArg = process.args.find((argument) => argument.startsWith("-out="));
      if (outputArg !== undefined) await writeFile(outputArg.slice(5), "apply-plan", { mode: 0o600 });
      if (process.args[0] === "show") {
        return result(JSON.stringify({ resource_changes: [], prior_state: { lineage: "lineage", serial: 1 } }));
      }
      if (process.args[0] === "apply") {
        appliedPath = process.args[2] ?? "";
        throw new Error("apply failed");
      }
      return result("");
    },
  };
  const bindings = new MemoryBindingStore();
  const provider = new NativeTerraformProvider({
    runner,
    currentAuthority: async () => authority,
    now: () => clock.value,
    target: {
      cwd: root,
      target: "dev",
      planPath: () => planPath,
      lockfileHash: hashes.lock,
      configHash: async () => hashes.iac,
    },
    bindingStore: bindings,
    artifactStore: new MemoryArtifactStore(),
    keyProvider: async () => Buffer.alloc(32, 9),
  });
  const preview = await provider.previewApply(request());
  await assert.rejects(provider.apply(preview, approval(preview), authority), /apply failed/);
  await assert.rejects(stat(appliedPath), /ENOENT/);
});

test("Terraform inventory recursively removes sensitive and secret-denylisted state properties", async () => {
  const runner = new FakeRunner(() =>
    JSON.stringify({
      values: {
        outputs: { password: { value: "output-secret", sensitive: true } },
        root_module: {
          resources: [
            {
              address: "azurerm_example.main",
              provider_name: "registry.terraform.io/hashicorp/azurerm",
              type: "azurerm_example",
              values: {
                name: "safe",
                nested: { visible: "yes", hidden: "nested-secret" },
                clientSecret: "denylisted-secret",
              },
              sensitive_values: { nested: { hidden: true } },
            },
          ],
          child_modules: [
            {
              resources: [
                {
                  address: "module.child.azurerm_example.child",
                  type: "azurerm_example",
                  values: { name: "child", token: "denylisted-token" },
                  sensitive_values: {},
                },
              ],
            },
          ],
        },
      },
    }),
  );
  const provider = new NativeTerraformProvider({
    runner,
    currentAuthority: async () => authority,
    now: () => clock.value,
    target: {
      cwd: "/tmp",
      target: "dev",
      planPath: () => "/tmp/unused.tfplan",
      lockfileHash: hashes.lock,
      configHash: async () => hashes.iac,
    },
  });

  const inventory = await provider.inventory("project", "run");
  assert.equal(inventory.resources.length, 2);
  assert.deepEqual(inventory.resources[0]?.properties, { name: "safe", nested: { visible: "yes" } });
  assert.deepEqual(inventory.resources[1]?.properties, { name: "child" });
  assert.doesNotMatch(JSON.stringify(inventory), /output-secret|nested-secret|denylisted/);
});

function result(stdout: string): ProcessResult {
  return { exitCode: 0, signal: null, stdout, stderr: "", timedOut: false, outputTruncated: false };
}

test("local reference plan transport authenticates metadata, recipient, expiry, and temp mode", async (context) => {
  const key = Buffer.alloc(32, 7);
  const transport = new LocalEncryptedPlanTransport(() => clock.value);
  const encrypted = transport.encrypt(Buffer.from("saved-plan"), key, {
    recipient: authority.recipientIdentity,
    ttlMs: 60_000,
  });
  assert.equal(encrypted.metadata.implementation, "local-reference");
  assert.equal(transport.decrypt(encrypted, key, authority.recipientIdentity).toString(), "saved-plan");
  assert.throws(() => transport.decrypt(encrypted, key, "other@example.com"), /recipient/);
  assert.throws(() =>
    transport.decrypt(
      { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA` },
      key,
      authority.recipientIdentity,
    ),
  );

  const handle = await transport.decryptToRestrictiveTemp(encrypted, key, authority.recipientIdentity);
  context.after(async () => handle.dispose());
  assert.equal((await stat(handle.path)).mode & 0o777, 0o600);
  assert.equal((await readFile(handle.path)).toString(), "saved-plan");
  await handle.dispose();

  clock.value = new Date("2026-07-13T01:02:00.000Z");
  assert.throws(() => transport.decrypt(encrypted, key, authority.recipientIdentity), /expired/);
  clock.value = new Date("2026-07-13T01:00:00.000Z");
});
