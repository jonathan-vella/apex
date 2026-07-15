import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../mcp.js";
import { execute } from "../cli.js";
import { ApexService } from "../service.js";
import { requirements, skuManifest, tempRoot, writeJson } from "./helpers.js";
import { sha256Json } from "@apex/kernel";

test("CLI emits a stable JSON envelope", async () => {
  const child = spawn(process.execPath, [join(import.meta.dirname, "..", "cli.js"), "version", "--json"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout += chunk;
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout), {
    ok: true,
    result: { version: "0.1.0", bundleVersion: "0.1.0", configVersion: "1.0.0" },
  });
});

test("MCP registers only narrow tools and calls the service", async () => {
  const service = new ApexService(await tempRoot());
  await service.init({ projectId: "demo" });
  const server = createMcpServer(service);
  const client = new Client({ name: "test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map(({ name }) => name).sort(), [
    "capabilityList",
    "capabilityStatus",
    "completeTask",
    "diagnose",
    "doctor",
    "generateIac",
    "inventory",
    "nextTask",
    "preview",
    "promote",
    "reconcile",
    "recordRequirementsInput",
    "render",
    "stageArtifact",
    "stageFile",
    "status",
    "submitEvidence",
    "taskContext",
    "validateTask",
  ]);
  const response = await client.callTool({ name: "status", arguments: {} });
  assert.equal(response.isError, undefined);
  assert.equal((response.structuredContent as { run: { projectId: string } }).run.projectId, "demo");
  const recorded = await client.callTool({
    name: "recordRequirementsInput",
    arguments: { value: { workload: "test" } },
  });
  assert.equal(recorded.isError, undefined);
  assert.deepEqual(recorded.structuredContent, { recorded: true });
  assert.equal((await service.nextTask()).status, "task");
  await client.close();
  await server.close();
});

test("CLI completes an artifact bundle from JSON", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  await service.init({ projectId: "demo" });
  await service.nextTask();
  const issued = await service.nextTask();
  assert.equal(issued.status, "task");
  if (issued.status !== "task") return;
  const path = join(root, "bundle.json");
  await writeJson(path, {
    taskId: issued.task.taskId,
    outputs: [
      { kind: "requirements", value: requirements() },
      { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
    ],
  });
  const completed = (await execute(["task", "complete-bundle", "--file", path], root)) as {
    outputHashes: Record<string, string>;
  };
  assert.match(completed.outputHashes.requirements!, /^[0-9a-f]{64}$/);
});

test("CLI task complete accepts repeated self-describing files", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  await service.init({ projectId: "demo" });
  await service.nextTask();
  const issued = await service.nextTask();
  assert.equal(issued.status, "task");
  if (issued.status !== "task") return;
  const requirementsPath = join(root, "requirements-output.json");
  const skuPath = join(root, "sku-output.json");
  await writeJson(requirementsPath, { kind: "requirements", value: requirements() });
  await writeJson(skuPath, { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) });
  const completed = (await execute(
    ["task", "complete", "--task", issued.task.taskId, "--file", requirementsPath, "--file", skuPath],
    root,
  )) as { outputHashes: Record<string, string> };
  assert.match(completed.outputHashes["sku-manifest"]!, /^[0-9a-f]{64}$/);
});

test("CLI rejects incomplete native provider config before execution", async () => {
  const root = await tempRoot();
  const path = join(root, "providers.json");
  await writeJson(path, { bicep: { resourceGroup: "rg" } });
  await assert.rejects(execute(["version", "--provider-config", path], root), /requires deploymentName/i);
});

test("CLI requires explicit Bicep stack cleanup ownership", async () => {
  const root = await tempRoot();
  const path = join(root, "providers.json");
  const bicep = {
    resourceGroup: "rg",
    deploymentName: "deployment",
    stackName: "stack",
    templateFile: "main.bicep",
    actionOnUnmanage: "deleteResources",
    denySettingsMode: "none",
  };
  await writeJson(path, { bicep });
  await assert.rejects(execute(["version", "--provider-config", path], root), /explicit ownership authorization/i);

  await writeJson(path, { bicep: { ...bicep, ownershipAuthorizesDeleteResources: true } });
  assert.deepEqual(await execute(["version", "--provider-config", path], root), {
    version: "0.1.0",
    bundleVersion: "0.1.0",
    configVersion: "1.0.0",
  });
});

test("CLI defaults Bicep stack cleanup to detachAll", async () => {
  const root = await tempRoot();
  const path = join(root, "providers.json");
  await writeJson(path, {
    bicep: {
      resourceGroup: "rg",
      deploymentName: "deployment",
      stackName: "stack",
      templateFile: "main.bicep",
    },
  });
  assert.deepEqual(await execute(["version", "--provider-config", path], root), {
    version: "0.1.0",
    bundleVersion: "0.1.0",
    configVersion: "1.0.0",
  });
});

test("CLI rejects secret-bearing provider config", async () => {
  const root = await tempRoot();
  const path = join(root, "providers.json");
  await writeJson(path, {
    terraform: { cwd: ".", target: "local", planDirectory: ".plans", lockfileHash: "a".repeat(64), clientSecret: "no" },
  });
  await assert.rejects(execute(["version", "--provider-config", path], root), /must not contain secret key/i);
});

test("CLI rejects a stale Terraform lock hash", async () => {
  const root = await tempRoot();
  const terraformRoot = join(root, "terraform");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(terraformRoot));
  await import("node:fs/promises").then(({ writeFile }) =>
    Promise.all([
      writeFile(join(terraformRoot, "main.tf"), "terraform {}\n"),
      writeFile(join(terraformRoot, ".terraform.lock.hcl"), "provider-lock\n"),
    ]),
  );
  const lockfileHash = createHash("sha256").update("provider-lock\n").digest("hex");
  const path = join(root, "providers.json");
  const terraform = {
    cwd: "terraform",
    target: "qualification",
    planDirectory: ".apex/local/plans",
    lockfileHash,
  };
  await writeJson(path, { terraform: { ...terraform, lockfileHash: "a".repeat(64) } });
  await assert.rejects(execute(["version", "--provider-config", path], root), /lockfileHash is stale/);

  await writeJson(path, { terraform });
  const configured = await execute(["version", "--provider-config", path], root);
  assert.deepEqual(configured, { version: "0.1.0", bundleVersion: "0.1.0", configVersion: "1.0.0" });
});

test("CLI capability commands report retained packs and require confirmation for mutation", async () => {
  const root = await tempRoot();
  await new ApexService(root).init({ projectId: "demo" });
  const listed = (await execute(["capability", "list"], root)) as Array<{ id: string; state: string; reason?: string }>;
  assert.equal(listed.find(({ id }) => id === "azure-pricing")?.state, "not-installed");
  assert.equal(listed.find(({ id }) => id === "azure-pricing")?.reason, undefined);
  await assert.rejects(execute(["capability", "install", "--pack", "azure-pricing"], root), /requires --yes/);
  await assert.rejects(execute(["capability", "uninstall", "--pack", "azure-pricing"], root), /requires --yes/);
});
