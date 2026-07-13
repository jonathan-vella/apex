import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { sha256Json } from "@apex/kernel";
import { ApexError } from "../errors.js";
import { createMcpServer } from "../mcp.js";
import { ApexService, type TaskOutput } from "../service.js";
import {
  architecture,
  codegenBundle,
  costEstimate,
  governance,
  planBundle,
  policyMap,
  requirements,
  review,
  skuManifest,
  tempRoot,
  validationEvidence,
} from "./helpers.js";

async function task(service: ApexService, expected: string): Promise<string> {
  const next = await service.nextTask();
  assert.equal(next.status, "task");
  if (next.status !== "task") throw new Error("Expected task");
  assert.equal(next.task.taskType, expected);
  return next.task.taskId;
}

async function complete(
  service: ApexService,
  expected: string,
  outputs: TaskOutput[],
): Promise<Record<string, string>> {
  const result = await service.completeTaskOutputs(await task(service, expected), outputs);
  return result.outputHashes as Record<string, string>;
}

async function reachCodegen(
  service: ApexService,
  runId: string,
  track: "bicep" | "terraform",
): Promise<{ taskId: string; plan: ReturnType<typeof planBundle> }> {
  await service.nextTask();
  const requirementValues: TaskOutput[] = [
    { kind: "requirements", value: requirements() },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
  ];
  const requirementHashes = await complete(service, "requirements", requirementValues);
  await complete(service, "requirements-review", [
    { kind: "review-findings", value: review(runId, "requirements", requirementHashes.requirements!) },
  ]);
  await service.decideGateNumber(1, "approved", "tester");

  const architectureValues: TaskOutput[] = [
    { kind: "architecture", value: architecture(runId) },
    { kind: "cost-estimate", value: costEstimate(runId) },
  ];
  const architectureHashes = await complete(service, "architecture", architectureValues);
  await complete(service, "architecture-review", [
    { kind: "review-findings", value: review(runId, "architecture", architectureHashes.architecture!) },
  ]);
  const governanceValue = governance(runId);
  const governanceHashes = await complete(service, "governance-discovery", [
    { kind: "governance-constraints", value: governanceValue },
  ]);
  const policyHashes = await complete(service, "governance-reconciliation", [
    { kind: "policy-property-map", value: policyMap(runId, governanceHashes["governance-constraints"]!) },
  ]);
  await complete(service, "governance-review", [
    { kind: "review-findings", value: review(runId, "policy-property-map", policyHashes["policy-property-map"]!) },
  ]);
  await service.decideGateNumber(2, "approved", "tester");

  const plan = planBundle(runId, track);
  const planHashes = await complete(service, "plan", plan);
  await complete(service, "plan-review", [
    { kind: "review-findings", value: review(runId, "plan", planHashes["implementation-intent"]!) },
  ]);
  await service.decideGateNumber(3, "approved", "tester");
  return { taskId: await task(service, `codegen-${track}`), plan };
}

async function reachValidation(service: ApexService, runId: string, track: "bicep" | "terraform"): Promise<void> {
  const codegen = await reachCodegen(service, runId, track);
  await service.completeTaskOutputs(codegen.taskId, codegenBundle(runId, track, codegen.plan));
  await complete(service, `validation-${track}`, [{ kind: "validation-evidence", value: validationEvidence(runId) }]);
}

for (const track of ["bicep", "terraform"] as const) {
  test(`full logical ${track} workflow reaches fake deploy and quality`, async () => {
    const service = new ApexService(await tempRoot());
    const { runId } = await service.init({ projectId: "demo", iacTool: track });
    await reachValidation(service, runId, track);
    const preview = await service.preview({ operation: "apply", provider: "fake" });
    await service.decideGateNumber(4, "approved", "tester");
    const deployed = await service.deploy(preview.previewHash);
    assert.equal(deployed.inventory.resources.length, 1);
    await complete(service, "diagnosis", [
      {
        kind: "diagnosis",
        value: {
          schemaVersion: "1.0.0",
          projectId: "demo",
          runId,
          diagnosedAt: "2026-01-01T00:00:00.000Z",
          status: "healthy",
          observations: ["deployed"],
          causes: [],
        },
      },
    ]);
    await complete(service, "quality", [
      {
        kind: "quality-report",
        value: {
          schemaVersion: "1.0.0",
          projectId: "demo",
          runId,
          evaluatedAt: "2026-01-01T00:00:00.000Z",
          status: "pass",
          checks: [{ id: "deploy", status: "pass", evidenceRefs: [] }],
        },
      },
    ]);
    assert.equal((await service.status()).task, null);
  });
}

test("review blockers persist, resolve, and permit gate approval", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const { runId } = await service.init({ projectId: "demo" });
  await service.nextTask();
  const hashes = await complete(service, "requirements", [
    { kind: "requirements", value: requirements() },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
  ]);
  const reviewHashes = await complete(service, "requirements-review", [
    {
      kind: "review-findings",
      value: review(runId, "requirements", hashes.requirements!, [
        { id: "F-1", severity: "high", disposition: "open", title: "Block", detail: "Resolve", evidenceRefs: [] },
      ]),
    },
  ]);
  await assert.rejects(service.nextTask(), (error: unknown) => error instanceof ApexError && /F-1/.test(error.message));
  const restarted = new ApexService(root);
  const reviewHash = reviewHashes["review-findings"]!;
  const dependencyHash = sha256Json({ "review-findings": reviewHash });
  await assert.rejects(
    restarted.resolveReview({
      findingId: "F-1",
      reviewHash,
      subjectHash: hashes.requirements!,
      disposition: "accepted-risk",
      actor: "tester",
      rationale: "not permitted",
      evidenceRefs: [],
      expiresAt: "2027-01-01T00:00:00.000Z",
      dependencyHash,
    }),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_AUTHORIZATION",
  );
  await restarted.resolveReview({
    findingId: "F-1",
    reviewHash,
    subjectHash: hashes.requirements!,
    disposition: "fixed",
    actor: "tester",
    rationale: "corrected requirement",
    evidenceRefs: [hashes.requirements!],
    dependencyHash,
  });
  assert.equal((await restarted.status()).run.gates[0]?.state, "open");
  await restarted.decideGateNumber(1, "approved", "tester");
  assert.equal((await restarted.nextTask()).status, "task");
});

test("promotion inherits neutral progression and restarts at the first environment-specific dependency", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const { runId } = await service.init({ projectId: "demo" });
  const codegen = await reachCodegen(service, runId, "bicep");
  await service.cancelTask(codegen.taskId);
  const sameScope = await service.promote("stage", "local");
  assert.deepEqual(
    sameScope.gates.map(({ state }) => state),
    ["inherited", "inherited", "inherited", "closed"],
  );
  assert.equal((await service.nextTask()).status, "task");
  assert.equal((await service.status()).task, "codegen-bicep");

  await service.use("demo", runId);
  const changedScope = await service.promote("prod", "subscription/prod");
  assert.deepEqual(
    changedScope.gates.map(({ state }) => state),
    ["inherited", "closed", "closed", "closed"],
  );
  const next = await service.nextTask();
  assert.equal(next.status, "task");
  if (next.status === "task") assert.equal(next.task.taskType, "governance-discovery");
});

test("approval bookkeeping preserves authority while runtime dependency mutation blocks deploy", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  const { runId } = await service.init({ projectId: "demo" });
  await reachValidation(service, runId, "bicep");
  const preview = await service.preview({ operation: "apply", provider: "fake" });
  await service.decideGateNumber(4, "approved", "tester");
  const deployed = await service.deploy(preview.previewHash);
  assert.equal(deployed.inventory.resources.length, 1);

  const secondRoot = await tempRoot();
  const second = new ApexService(secondRoot);
  const initialized = await second.init({ projectId: "demo" });
  await reachValidation(second, initialized.runId, "bicep");
  const stalePreview = await second.preview({ operation: "apply", provider: "fake" });
  await second.decideGateNumber(4, "approved", "tester");
  await import("node:fs/promises").then(({ appendFile }) =>
    appendFile(join(secondRoot, ".apex", "runtime", "workflow.v1.json"), "\n"),
  );
  await assert.rejects(
    second.deploy(stalePreview.previewHash),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_STALE",
  );
});

test("invalid bundles are rejected before completion state changes", async () => {
  const service = new ApexService(await tempRoot());
  const { runId } = await service.init({ projectId: "demo" });
  await service.nextTask();
  const requirementTask = await task(service, "requirements");
  const before = await service.status();
  await assert.rejects(
    service.completeTaskOutputs(requirementTask, [{ kind: "requirements", value: requirements() }]),
    /missing/i,
  );
  assert.equal((await service.status()).events, before.events);

  const accepted = await service.completeTaskOutputs(requirementTask, [
    { kind: "requirements", value: requirements() },
    { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
  ]);
  const hashes = await complete(service, "requirements-review", [
    { kind: "review-findings", value: review(runId, "requirements", accepted.outputHashes.requirements!) },
  ]);
  assert.ok(hashes["review-findings"]);
  await service.decideGateNumber(1, "approved", "tester");
  const architectureTask = await task(service, "architecture");
  await assert.rejects(
    service.completeTaskOutputs(architectureTask, [
      { kind: "architecture", value: architecture(runId) },
      { kind: "cost-estimate", value: costEstimate(runId, 2) },
    ]),
    /arithmetic/i,
  );
});

test("plan rejects wrong track and secret literals", async () => {
  const service = new ApexService(await tempRoot());
  const { runId } = await service.init({ projectId: "demo", iacTool: "bicep" });
  await reachValidation(service, runId, "bicep");
  const promoted = await service.promote("dev", "local-next");
  assert.equal(promoted.parentRunId, runId);

  const isolated = new ApexService(await tempRoot());
  const initialized = await isolated.init({ projectId: "demo", iacTool: "bicep" });
  await isolated.nextTask();
  await isolated.completeTask(await task(isolated, "requirements"), { kind: "requirements", value: requirements() });
  await isolated.decideGateNumber(1, "approved", "tester");
  const planTask = await task(isolated, "plan");
  await assert.rejects(isolated.completeTaskOutputs(planTask, planBundle(initialized.runId, "terraform")), /track/i);
  await assert.rejects(
    isolated.completeTaskOutputs(
      planTask,
      planBundle(initialized.runId, "bicep", { password: { kind: "value", value: "literal" } }),
    ),
    /secret-reference/i,
  );
});

test("MCP completeTask accepts an output bundle", async () => {
  const service = new ApexService(await tempRoot());
  await service.init({ projectId: "demo" });
  await service.nextTask();
  const issued = await service.nextTask();
  assert.equal(issued.status, "task");
  if (issued.status !== "task") return;
  const server = createMcpServer(service);
  const client = new Client({ name: "test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const response = await client.callTool({
    name: "completeTask",
    arguments: {
      taskId: issued.task.taskId,
      outputs: [
        { kind: "requirements", value: requirements() },
        { kind: "sku-manifest", value: skuManifest(sha256Json(requirements())) },
      ],
    },
  });
  assert.equal(response.isError, undefined);
  await client.close();
  await server.close();
});

test("restricted staging and generateIac produce a real accepted tree", async () => {
  const service = new ApexService(await tempRoot());
  const { runId } = await service.init({ projectId: "demo", iacTool: "bicep" });
  const { taskId } = await reachCodegen(service, runId, "bicep");
  const first = await service.stageFile(taskId, "notes.md", "bounded\n");
  const second = await service.stageFile(taskId, "notes.md", "bounded\n");
  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  await assert.rejects(service.stageFile(taskId, "../escape.tf", "bad"), /unsafe/i);
  await assert.rejects(service.stageFile(taskId, "notes.md", "changed\n"), /overwrite/i);
  const generated = await service.generateIac(taskId, { requiredToolVersions: { bicep: "test" } });
  assert.match(generated.treeHash, /^[0-9a-f]{64}$/);
  assert.ok(generated.files.some(({ path }) => path.endsWith("main.bicep")));
  assert.match(generated.outputHashes["iac-handoff"]!, /^[0-9a-f]{64}$/);
});
