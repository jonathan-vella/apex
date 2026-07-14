import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";
import type { IacBindingV1, ImplementationIntentV1 } from "@apex/contracts";
import {
  compareLogicalParity,
  generateBicepTree,
  generateTerraformTree,
  ProcessRunner,
  sha256,
  validateGeneratedTree,
  writeVirtualTree,
  type GeneratedVirtualTree,
} from "../index.js";

const HASH = "a".repeat(64);

function intent(
  resources: ImplementationIntentV1["resources"] = [
    {
      id: "storage",
      type: "Microsoft.Storage/storageAccounts",
      purpose: "Store artifacts",
      dependsOn: [],
      controls: ["secure-storage"],
    },
  ],
): ImplementationIntentV1 {
  return {
    schemaVersion: "1.0.0",
    projectId: "project",
    runId: "run-0001",
    sourceHashes: { requirements: HASH },
    resources,
    outputs: ["storage_id"],
  };
}

function binding(
  track: "bicep" | "terraform",
  implementation: string,
  version: string,
  parameters: Readonly<Record<string, unknown>>,
): IacBindingV1 {
  return {
    schemaVersion: "1.0.0",
    projectId: "project",
    runId: "run-0001",
    track,
    intentHash: HASH,
    resourceBindings: { storage: { implementation, version, parameters } },
  };
}

const nativeParameters = {
  name: "stexample",
  location: "swedencentral",
  parentId: "/subscriptions/sub/resourceGroups/rg",
  kind: "StorageV2",
  sku: { name: "Standard_LRS" },
  properties: { accessTier: "Hot" },
};

test("native generators are byte deterministic and enforce secure storage defaults", async () => {
  const sourceIntent = intent();
  const bicepBinding = binding(
    "bicep",
    "native:Microsoft.Storage/storageAccounts@2023-05-01",
    "2023-05-01",
    nativeParameters,
  );
  const terraformBinding = binding(
    "terraform",
    "native:Microsoft.Storage/storageAccounts@2023-05-01",
    "2023-05-01",
    nativeParameters,
  );
  const first = generateBicepTree(sourceIntent, bicepBinding);
  const second = generateBicepTree(sourceIntent, bicepBinding);
  assert.deepEqual(first, second);
  assert.equal(first.files[0]?.path, "main.bicep");
  assert.match(first.files[0]!.content, /minimumTlsVersion: 'TLS1_2'/);
  assert.match(first.files[0]!.content, /allowSharedKeyAccess: false/);
  assert.equal(first.treeHash, sha256(first.files));

  const terraform = generateTerraformTree(sourceIntent, terraformBinding, {
    azurermProviderConstraint: "4.31.0",
    azapiProviderConstraint: "2.4.0",
  });
  assert.deepEqual(
    terraform,
    generateTerraformTree(sourceIntent, terraformBinding, {
      azurermProviderConstraint: "4.31.0",
      azapiProviderConstraint: "2.4.0",
    }),
  );
  assert.match(terraform.files.find(({ path }) => path === "versions.tf")!.content, /version = "= 4\.31\.0"/);
  assert.doesNotMatch(terraform.files.find(({ path }) => path === "main.tf")!.content, /jsonencode\(/);
  assert.match(terraform.files.find(({ path }) => path === "main.tf")!.content, /allowSharedKeyAccess/);
  assert.equal(
    terraform.files.some(({ path }) => path === ".terraform.lock.hcl"),
    false,
  );
  assert.equal((await validateGeneratedTree(first)).valid, true);
  assert.equal((await validateGeneratedTree(terraform)).valid, true);
});

test("storage validation remains bounded for repeated near-miss properties", async () => {
  const sourceIntent = intent();
  const cases = [
    {
      generated: generateBicepTree(
        sourceIntent,
        binding("bicep", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", nativeParameters),
      ),
      declaration: "resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {",
      properties: ["minimumTlsVersion", "supportsHttpsTrafficOnly", "allowBlobPublicAccess", "allowSharedKeyAccess"],
      separator: ":",
    },
    {
      generated: generateTerraformTree(
        sourceIntent,
        binding("terraform", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", nativeParameters),
      ),
      declaration: 'resource "azurerm_storage_account" "storage" {',
      properties: [
        "min_tls_version",
        "https_traffic_only_enabled",
        "allow_nested_items_to_be_public",
        "shared_access_key_enabled",
      ],
      separator: "=",
    },
  ] as const;

  for (const { generated, declaration, properties, separator } of cases) {
    const repeatedAssignments = properties
      .map((property) => `${`${property} ${separator} invalid `.repeat(2_000)}\n`)
      .join("");
    const content = `${declaration}\n${repeatedAssignments}}\n`;
    const files = [{ path: generated.logicalManifest.resources[0]!.sourcePath, content }];
    const adversarialTree: GeneratedVirtualTree = { ...generated, files, treeHash: sha256(files) };

    const startedAt = performance.now();
    const result = await validateGeneratedTree(adversarialTree);
    const elapsedMs = performance.now() - startedAt;

    assert.equal(result.valid, false);
    assert.equal(result.issues.filter((issue) => issue.startsWith("Storage security invariant")).length, 4);
    assert.ok(elapsedMs < 500, `${generated.logicalManifest.track} validation took ${elapsedMs.toFixed(1)}ms`);
  }
});

test("AVM generators preserve exact pins, harden storage, and only include supplied lock data", () => {
  const sourceIntent = intent();
  const bicep = generateBicepTree(
    sourceIntent,
    binding("bicep", "avm:br/public:avm/res/storage/storage-account@0.31.0", "0.31.0", {
      name: "stexample",
      location: "swedencentral",
    }),
  );
  assert.match(bicep.files[0]!.content, /br\/public:avm\/res\/storage\/storage-account:0\.31\.0/);
  assert.match(bicep.files[0]!.content, /allowBlobPublicAccess: false/);

  const lock = "provider lock bytes\n";
  const terraform = generateTerraformTree(
    sourceIntent,
    binding("terraform", "avm:registry.terraform.io/Azure/avm-res-storage-storageaccount/azurerm@0.6.3", "0.6.3", {
      name: "stexample",
      location: "swedencentral",
    }),
    { lockFileContent: lock },
  );
  assert.match(terraform.files.find(({ path }) => path === "main.tf")!.content, /version = "0\.6\.3"/);
  assert.match(terraform.files.find(({ path }) => path === "main.tf")!.content, /shared_access_key_enabled = false/);
  assert.equal(terraform.files.find(({ path }) => path === ".terraform.lock.hcl")!.content, lock);
});

test("generation rejects traversal-like identifiers, incomplete native parameters, and non-exact pins", () => {
  const invalidIntent = intent([
    { id: "../storage", type: "Microsoft.Storage/storageAccounts", purpose: "x", dependsOn: [], controls: [] },
  ]);
  assert.throws(
    () =>
      generateBicepTree(invalidIntent, {
        ...binding("bicep", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", nativeParameters),
        resourceBindings: {
          "../storage": {
            implementation: "native:Microsoft.Storage/storageAccounts@2023-05-01",
            version: "2023-05-01",
            parameters: nativeParameters,
          },
        },
      }),
    /valid IaC identifier/,
  );
  assert.throws(
    () =>
      generateTerraformTree(
        intent(),
        binding("terraform", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", { name: "storage" }),
      ),
    /requires parameter 'location'/,
  );
  assert.throws(
    () =>
      generateBicepTree(
        intent(),
        binding("bicep", "avm:br/public:avm/res/storage/storage-account@~0.31.0", "~0.31.0", {}),
      ),
    /exact version/,
  );
  assert.throws(
    () =>
      generateTerraformTree(
        intent(),
        binding("terraform", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", nativeParameters),
        { azurermProviderConstraint: "~> 4.0" },
      ),
    /exact semantic version/,
  );
  assert.throws(
    () =>
      generateBicepTree(
        intent(),
        binding("bicep", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", nativeParameters),
        { existingResources: ["missing"] },
      ),
    /not present in the intent/,
  );
});

test("logical parity reports concrete resource differences", () => {
  const sourceIntent = intent();
  const bicep = generateBicepTree(
    sourceIntent,
    binding("bicep", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", nativeParameters),
  );
  const terraform = generateTerraformTree(
    sourceIntent,
    binding("terraform", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", nativeParameters),
  );
  assert.deepEqual(compareLogicalParity(bicep, terraform), { equal: true, differences: [] });
  const changed: GeneratedVirtualTree = {
    ...terraform,
    logicalManifest: {
      ...terraform.logicalManifest,
      resources: terraform.logicalManifest.resources.map((resource) => ({
        ...resource,
        type: "Microsoft.Storage/queues",
      })),
    },
  };
  const comparison = compareLogicalParity(bicep, changed);
  assert.equal(comparison.equal, false);
  assert.deepEqual(
    comparison.differences.map(({ field }) => field),
    ["type"],
  );
});

test("generators render dependencies and native existing-resource semantics", () => {
  const sourceIntent = intent([
    { id: "storage", type: "Microsoft.Storage/storageAccounts", purpose: "existing", dependsOn: [], controls: [] },
    { id: "consumer", type: "Microsoft.Example/consumers", purpose: "managed", dependsOn: ["storage"], controls: [] },
  ]);
  const resourceBindings = {
    storage: {
      implementation: "native:Microsoft.Storage/storageAccounts@2023-05-01",
      version: "2023-05-01",
      parameters: nativeParameters,
    },
    consumer: {
      implementation: "native:Microsoft.Example/consumers@2024-01-01",
      version: "2024-01-01",
      parameters: {
        name: "consumer",
        location: "swedencentral",
        parentId: "/subscriptions/sub/resourceGroups/rg",
        properties: {},
      },
    },
  };
  const bicep = generateBicepTree(
    sourceIntent,
    { ...binding("bicep", "native:x@y", "legacy", {}), resourceBindings },
    {
      existingResources: ["storage"],
    },
  );
  const terraform = generateTerraformTree(
    sourceIntent,
    { ...binding("terraform", "native:x@y", "legacy", {}), resourceBindings },
    { existingResources: ["storage"] },
  );
  assert.match(bicep.files[0]!.content, /resource storage .* existing/);
  assert.match(terraform.files.find(({ path }) => path === "main.tf")!.content, /data "azapi_resource" "storage"/);
  assert.match(
    terraform.files.find(({ path }) => path === "main.tf")!.content,
    /depends_on = \[data\.azapi_resource\.storage\]/,
  );
  assert.equal(
    terraform.logicalManifest.resources.find(({ logicalId }) => logicalId === "storage")?.ownership,
    "existing",
  );
  assert.equal(compareLogicalParity(bicep, terraform).equal, true);
});

test("validation returns deterministic command plans and only invokes an injected runner", async () => {
  const tree = generateTerraformTree(
    intent(),
    binding("terraform", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", nativeParameters),
  );
  const withoutRunner = await validateGeneratedTree(tree, { cwd: "/iac" });
  assert.deepEqual(
    withoutRunner.commandPlans.map(({ executable, args }) => [executable, args]),
    [
      ["terraform", ["fmt", "-check"]],
      ["terraform", ["init", "-backend=false", "-input=false"]],
      ["terraform", ["validate"]],
    ],
  );
  assert.deepEqual(withoutRunner.commandResults, []);
  const calls: string[] = [];
  const withRunner = await validateGeneratedTree(tree, {
    cwd: "/iac",
    runner: {
      async run(request) {
        calls.push(`${request.executable} ${request.args.join(" ")}`);
        return { exitCode: 0, signal: null, stdout: "", stderr: "", timedOut: false, outputTruncated: false };
      },
    },
  });
  assert.equal(withRunner.valid, true);
  assert.equal(calls.length, 3);
});

test("native generated trees compile with installed Bicep and Terraform tools", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "apex-generated-compile-"));
  context.after(async () => rm(root, { recursive: true, force: true }));
  const sourceIntent = intent();
  const bicep = generateBicepTree(
    sourceIntent,
    binding("bicep", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", nativeParameters),
  );
  const terraform = generateTerraformTree(
    sourceIntent,
    binding("terraform", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", nativeParameters),
    { azurermProviderConstraint: "4.31.0", azapiProviderConstraint: "2.4.0" },
  );
  const bicepRoot = join(root, "bicep");
  const terraformRoot = join(root, "terraform");
  await writeVirtualTree(bicepRoot, bicep);
  await writeVirtualTree(terraformRoot, terraform);
  const runner = new ProcessRunner();
  for (const [executable, cwd] of [
    ["bicep", bicepRoot],
    ["terraform", terraformRoot],
  ] as const) {
    try {
      const commands =
        executable === "bicep"
          ? [["build", "main.bicep"]]
          : [["fmt"], ["init", "-backend=false", "-input=false"], ["validate"]];
      for (const args of commands) {
        await runner.run({ executable, args, cwd, timeoutMs: 180_000, maxOutputBytes: 2_000_000 });
      }
    } catch (error) {
      if ((error as Error).message.includes("ENOENT")) {
        context.diagnostic(`${executable} unavailable; compiler-backed check skipped`);
        continue;
      }
      throw error;
    }
  }
});

test("writer creates files atomically and refuses overwrite, traversal, and symlink parents", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-capabilities-"));
  const outside = await mkdtemp(join(tmpdir(), "apex-outside-"));
  try {
    const tree = generateBicepTree(
      intent(),
      binding("bicep", "native:Microsoft.Storage/storageAccounts@2023-05-01", "2023-05-01", nativeParameters),
    );
    await writeVirtualTree(root, tree);
    assert.equal(await readFile(join(root, "main.bicep"), "utf8"), tree.files[0]!.content);
    await assert.rejects(writeVirtualTree(root, tree), /Refusing to overwrite/);
    await writeVirtualTree(root, tree, { overwrite: true });

    const unsafe = { ...tree, files: [{ path: "../escape.tf", content: "" }], treeHash: HASH };
    await assert.rejects(writeVirtualTree(root, unsafe), /invalid segment/);
    await mkdir(join(root, "nested"), { recursive: true });
    await symlink(outside, join(root, "nested", "link"));
    const symlinkTree = { ...tree, files: [{ path: "nested/link/main.tf", content: "" }], treeHash: HASH };
    await assert.rejects(writeVirtualTree(root, symlinkTree), /symlink parent/);
    await writeFile(join(root, "untouched"), "ok", "utf8");
    assert.equal(await readFile(join(root, "untouched"), "utf8"), "ok");
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
