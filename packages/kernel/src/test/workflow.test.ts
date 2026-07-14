import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Type } from "@sinclair/typebox";
import {
  assertTaskCurrent,
  createTaskEnvelope,
  inheritGate,
  needsInput,
  ProjectStore,
  ValidatorRegistry,
} from "../index.js";

const hash = "a".repeat(64);

test("project store creates deterministic project and run layouts with four closed gates", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-project-"));
  const clock = () => new Date("2026-01-01T00:00:00.000Z");
  const store = new ProjectStore(root, clock, () => "run-fixed");
  await store.initializeProject({ projectId: "demo", displayName: "Demo", defaultIacTool: "bicep" });
  const run = await store.createRun("demo", {
    environment: "dev",
    targetScope: "/subscriptions/test",
    runtimeLockHash: hash,
  });
  assert.equal(run.runId, "run-fixed");
  assert.deepEqual(
    run.gates.map(({ gate, state }) => ({ gate, state })),
    [
      { gate: 1, state: "closed" },
      { gate: 2, state: "closed" },
      { gate: 3, state: "closed" },
      { gate: 4, state: "closed" },
    ],
  );
  assert.deepEqual(await store.getRun("demo", "run-fixed"), run);
});

test("Gate 4 inheritance is always denied", () => {
  assert.throws(
    () => inheritGate({ gate: 4, state: "approved", dependencyHash: hash }, "parent", hash, "2026-01-01T00:00:00.000Z"),
    /cannot be inherited/,
  );
});

test("task guards reject expiry, stale head, and stale epoch and provide typed needs_input", () => {
  let now = new Date("2026-01-01T00:00:00.000Z");
  const clock = () => now;
  const task = createTaskEnvelope(
    {
      projectId: "demo",
      runId: "run-1",
      role: "planner",
      taskType: "plan",
      expectedHead: hash,
      ownerEpoch: 2,
      inputRefs: [],
      allowedOutputKinds: ["plan"],
      capabilityGrants: [],
      maxOutputBytes: 1000,
      ttlMs: 1000,
    },
    clock,
    () => "task-1",
  );
  assertTaskCurrent(task, hash, 2, clock);
  assert.throws(() => assertTaskCurrent(task, "b".repeat(64), 2, clock), /head is stale/);
  assert.throws(() => assertTaskCurrent(task, hash, 1, clock), /epoch is stale/);
  now = new Date("2026-01-01T00:00:02.000Z");
  assert.throws(() => assertTaskCurrent(task, hash, 2, clock), /expired/);
  assert.equal(needsInput(task.taskId, [{ id: "region", prompt: "Which region?" }]).status, "needs_input");
});

test("validator registry caches pure results by content and never caches freshness or authorization", () => {
  const schema = Type.Object({ value: Type.Integer() }, { additionalProperties: false });
  const registry = new ValidatorRegistry();
  registry.register("pure", schema);
  registry.register("fresh", schema, "freshness");
  registry.register("auth", schema, "authorization");
  registry.registerHandler("business", (value) =>
    (value as { value?: unknown }).value === 1 ? [] : [{ path: "/value", message: "Expected one" }],
  );
  assert.equal(registry.has("business"), true);
  assert.equal(registry.has("missing"), false);
  assert.equal(registry.validate("pure", { value: 1 }).cached, false);
  assert.equal(registry.validate("pure", { value: 1 }).cached, true);
  assert.equal(registry.validate("pure", { value: 2 }).cached, false);
  assert.equal(registry.validate("pure", { value: "invalid" }).valid, false);
  assert.equal(registry.validate("fresh", { value: 1 }).cached, false);
  assert.equal(registry.validate("fresh", { value: 1 }).cached, false);
  assert.equal(registry.validate("auth", { value: 1 }).cached, false);
  assert.equal(registry.validate("auth", { value: 1 }).cached, false);
  assert.equal(registry.validate("business", { value: 1 }).valid, true);
  assert.equal(registry.validate("business", { value: 1 }).cached, true);
  const failed = registry.validate("business", { value: 2 });
  assert.deepEqual(failed.issues, [{ path: "/value", message: "Expected one" }]);
  failed.issues.length = 0;
  assert.deepEqual(registry.validate("business", { value: 2 }).issues, [{ path: "/value", message: "Expected one" }]);
});
