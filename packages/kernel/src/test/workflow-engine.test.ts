import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { composeDependencyHash, WorkflowEngine } from "../index.js";

const manifest = JSON.parse(
  await readFile(new URL("../../../../config/workflow.v1.json", import.meta.url), "utf8"),
) as unknown;

test("workflow manifest validates and routes both tracks deterministically", () => {
  const engine = new WorkflowEngine(manifest);
  const initial = engine.route({ run: { iacTool: "bicep" }, artifacts: {} });
  assert.equal(initial.currentNode, "requirements");
  assert.equal(initial.ownerRole, "requirements");
  const bicep = engine.route({
    run: { iacTool: "bicep" },
    artifacts: {
      "implementation-intent-v1": {},
      "iac-binding-v1": {},
      "environment-inputs-v1": {},
      "policy-property-map-v1": {},
      "runtime-bundle": {},
      toolchain: {},
    },
    completedNodes: [
      "requirements",
      "gate-1",
      "architecture",
      "governance-discovery",
      "governance-reconciliation",
      "gate-2",
      "plan",
      "gate-3",
    ],
    gateStates: { "gate-1": "approved", "gate-2": "approved", "gate-3": "approved" },
  });
  assert.equal(bicep.nextTask, "codegen-bicep");
  assert.equal(bicep.ownerRole, "bicep-codegen");
  const discovery = engine.route({
    run: { iacTool: "bicep", targetScope: "scope" },
    artifacts: { "governance-capability-lock": {} },
    completedNodes: ["requirements", "gate-1", "architecture"],
    gateStates: { "gate-1": "approved" },
  });
  assert.equal(discovery.nextTask, "governance-discovery");
});

test("workflow rejects unknown operators, cycles, duplicate gates, and missing tracks", () => {
  const base = structuredClone(manifest) as any;
  base.nodes[0].condition = { script: "true" };
  assert.throws(() => new WorkflowEngine(base), /Unsupported/);
  const cyclic = structuredClone(manifest) as any;
  cyclic.edges.push({ from: "gate-1", to: "requirements" });
  assert.throws(() => new WorkflowEngine(cyclic), /cycle/);
  const duplicate = structuredClone(manifest) as any;
  duplicate.nodes.find((node: any) => node.id === "gate-2").gateNumber = 1;
  assert.throws(() => new WorkflowEngine(duplicate), /duplicate gate/);
  const badInvalidation = structuredClone(manifest) as any;
  badInvalidation.nodes[0].invalidates.push("missing-node");
  assert.throws(() => new WorkflowEngine(badInvalidation), /invalidates unknown node/);
  const oneTrack = structuredClone(manifest) as any;
  oneTrack.nodes = oneTrack.nodes.filter((node: any) => !JSON.stringify(node.condition ?? {}).includes("terraform"));
  const oneTrackIds = new Set(oneTrack.nodes.map((node: any) => node.id));
  oneTrack.nodes.forEach((node: any) => {
    node.invalidates = (node.invalidates ?? []).filter((target: string) => oneTrackIds.has(target));
  });
  oneTrack.edges = oneTrack.edges.filter(
    (edge: any) =>
      oneTrack.nodes.some((node: any) => node.id === edge.from) &&
      oneTrack.nodes.some((node: any) => node.id === edge.to),
  );
  oneTrack.returnRoutes = oneTrack.returnRoutes.filter(
    (edge: any) =>
      oneTrack.nodes.some((node: any) => node.id === edge.from) &&
      oneTrack.nodes.some((node: any) => node.id === edge.to),
  );
  assert.throws(() => new WorkflowEngine(oneTrack), /bicep and terraform/);
});

test("dependency hashes are canonical and invalidation cascades with semantic reasons", () => {
  assert.equal(composeDependencyHash({ b: 2, a: 1 }), composeDependencyHash({ a: 1, b: 2 }));
  const plan = new WorkflowEngine(manifest).invalidationPlan("requirements", "requirements changed");
  assert(plan.some((entry) => entry.nodeId === "deploy-bicep"));
  assert(plan.every((entry) => entry.reason === "requirements: requirements changed"));
  assert.equal(new Set(plan.map((entry) => entry.nodeId)).size, plan.length);
});

test("manifest order and dependencies are runtime routing authority", () => {
  const changed = structuredClone(manifest) as any;
  const architecture = changed.nodes.find((node: any) => node.id === "architecture");
  const governance = changed.nodes.find((node: any) => node.id === "governance-discovery");
  architecture.sourceDependencies.push("new-runtime-evidence");
  changed.nodes.splice(changed.nodes.indexOf(governance), 1);
  changed.nodes.splice(changed.nodes.indexOf(architecture), 0, governance);
  const route = new WorkflowEngine(changed).route({
    run: { iacTool: "bicep", targetScope: "scope" },
    artifacts: { "governance-capability-lock": {} },
    completedNodes: ["requirements", "gate-1"],
    gateStates: { "gate-1": "approved" },
  });
  assert.equal(route.nextTask, "governance-discovery");
  assert.notEqual(route.currentNode, "architecture");
});
