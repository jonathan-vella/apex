import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runValidator, verifyWorkerReady } from "../../scripts/verify-worker-ready.mjs";

function sample() {
  return {
    workerId: "worker",
    parentId: "root",
    frontmatter: { name: "02-Requirements", model: ["Claude Sonnet 5.5 (copilot)"], "reasoning-effort": "high" },
    catalog: { models: { "Claude Sonnet 5.5 (copilot)": { runtime_id: "claude-sonnet-5.5" } } },
    events: [
      {
        type: "subagent.started",
        agentId: "worker",
        data: {
          toolCallId: "call",
          agentName: "02-Requirements",
          executionMode: "background",
          taskModelSource: "unset",
          resumable: false,
        },
      },
      {
        type: "subagent.configured",
        agentId: "worker",
        data: { model: "claude-sonnet-5.5", reasoningEffort: "high", multiTurn: true },
      },
      {
        type: "subagent.completed",
        agentId: "worker",
        data: {
          toolCallId: "call",
          firstDispatchedModel: "claude-sonnet-5.5",
          modelSelectionSource: "agent_definition",
          totalToolCalls: 0,
        },
      },
    ],
  };
}

test("tool-free background readiness verifies routing but grants no action permission", () => {
  const result = verifyWorkerReady(sample());
  assert.equal(result.status, "MODEL_VERIFIED");
  assert.equal(result.permission_granted_by_this_record, false);
});

for (const [label, mutate] of [
  ["actual model fallback", (s) => (s.events[2].data.firstDispatchedModel = "parent-model")],
  ["missing actual model", (s) => delete s.events[2].data.firstDispatchedModel],
  ["inherited routing", (s) => (s.events[2].data.modelSelectionSource = "session_inheritance")],
  ["caller override", (s) => (s.events[0].data.taskModelSource = "explicit")],
  ["wrong effort", (s) => (s.events[1].data.reasoningEffort = "medium")],
  ["sync worker", (s) => (s.events[0].data.executionMode = "sync")],
  ["one-shot worker", (s) => (s.events[1].data.multiTurn = false)],
  ["tools before verification", (s) => (s.events[2].data.totalToolCalls = 1)],
  ["unknown tool count", (s) => delete s.events[2].data.totalToolCalls],
  ["unknown runtime ID", (s) => delete s.catalog.models["Claude Sonnet 5.5 (copilot)"].runtime_id],
  ["missing completion", (s) => s.events.pop()],
  ["different parent", (s) => (s.events[0].data.parentId = "other")],
  ["different agent", (s) => (s.events[0].data.agentName = "general-purpose")],
  ["different call", (s) => (s.events[2].data.toolCallId = "other")],
  [
    "missing call linkage",
    (s) => {
      delete s.events[0].data.toolCallId;
      delete s.events[2].data.toolCallId;
    },
  ],
  [
    "contradictory tool telemetry",
    (s) =>
      s.events.push({
        type: "tool.execution_start",
        agentId: "worker",
        data: { toolCallId: "tool", toolName: "view" },
      }),
  ],
  [
    "unreported nested delegation",
    (s) =>
      s.events.push({
        type: "subagent.started",
        agentId: "child",
        data: { parentId: "worker" },
      }),
  ],
  ["missing identity", (s) => (s.workerId = "")],
  ["duplicate start", (s) => s.events.push(s.events[0])],
]) {
  test(`${label} blocks readiness`, () => {
    const input = sample();
    mutate(input);
    assert.equal(verifyWorkerReady(input).status, "BLOCKED");
  });
}

test("nested worker evidence must belong to its immediate parent", () => {
  const input = sample();
  input.parentId = "step-worker";
  input.events[0].data.parentId = "step-worker";
  assert.equal(verifyWorkerReady(input).status, "MODEL_VERIFIED");
});

test("another worker cannot supply missing completion or model evidence", () => {
  const input = sample();
  input.events[2].agentId = "other";
  assert.equal(verifyWorkerReady(input).status, "BLOCKED");
});

test("CLI fails closed on malformed, absent, relative or out-of-scope inputs", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "apex-worker-ready-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, ".github/agents"), { recursive: true });
  mkdirSync(path.join(root, ".github"), { recursive: true });
  const input = sample();
  const definition = ".github/agents/02-requirements.agent.md";
  writeFileSync(
    path.join(root, definition),
    '---\nname: 02-Requirements\nmodel: ["Claude Sonnet 5.5 (copilot)"]\nreasoning-effort: high\n---\n',
  );
  writeFileSync(path.join(root, ".github/model-catalog.json"), JSON.stringify(input.catalog));
  const log = path.join(root, "events.jsonl");
  const args = ["--events", log, "--definition", definition, "--worker-id", "worker", "--parent-id", "root"];
  writeFileSync(log, input.events.map((event) => JSON.stringify(event)).join("\n"));
  assert.equal(runValidator(args, root), 0);
  writeFileSync(log, "{incomplete");
  assert.equal(runValidator(args, root), 1);
  assert.equal(runValidator([], root), 1);
  assert.equal(runValidator(["--events", "relative.jsonl", ...args.slice(2)], root), 1);
  assert.equal(runValidator(["--events", log, "--definition", "package.json", ...args.slice(4)], root), 1);
});
