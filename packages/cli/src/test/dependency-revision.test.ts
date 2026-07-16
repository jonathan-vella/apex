import assert from "node:assert/strict";
import test from "node:test";
import type { EventV1, RunConfigV1 } from "@apex/contracts";
import { dependencyRevision } from "../dependency-revision.js";

const run = {
  projectId: "demo",
  runId: "run-1",
  targetScope: "scope-a",
  iacTool: "bicep",
  runtimeLockHash: "a".repeat(64),
  ownerEpoch: 1,
} as RunConfigV1;

const artifactEvent = {
  type: "task.completed",
  payload: { artifactHashes: { requirements: "b".repeat(64) } },
} as EventV1;

test("dependency revision ignores ownership but binds target, runtime, and artifacts", () => {
  const original = dependencyRevision(run, [artifactEvent]);
  const transferredRun: RunConfigV1 = { ...run, ownerEpoch: 2 };
  assert.equal(dependencyRevision(transferredRun, [artifactEvent]), original);
  assert.notEqual(dependencyRevision({ ...run, targetScope: "scope-b" }, [artifactEvent]), original);
  assert.notEqual(dependencyRevision({ ...run, runtimeLockHash: "c".repeat(64) }, [artifactEvent]), original);
  assert.notEqual(
    dependencyRevision(run, [{ ...artifactEvent, payload: { artifactHashes: { requirements: "d".repeat(64) } } }]),
    original,
  );
});
