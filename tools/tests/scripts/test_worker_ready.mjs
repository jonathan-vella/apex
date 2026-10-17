import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runValidator, verifyWorkerReady } from "../../scripts/verify-worker-ready.mjs";

const DEFINITION = "02-Requirements";
const NONCE = "ready-nonce-123";
const CALL = "parent-call";
const MODEL = "claude-sonnet-5.5";

function sample({ pinned = false } = {}) {
  const frontmatter = { name: DEFINITION };
  if (pinned) {
    frontmatter.model = ["Claude Sonnet 5.5 (copilot)"];
    frontmatter["reasoning-effort"] = "high";
  }
  return {
    workerId: "worker",
    parentId: "root",
    frontmatter,
    events: [
      {
        type: "tool.execution_start",
        agentId: "root",
        data: {
          toolCallId: CALL,
          toolName: "task",
          arguments: {
            agent_type: DEFINITION,
            mode: "background",
            prompt: `APEX_WORKER_HANDSHAKE\ndefinition: ${DEFINITION}\nnonce: ${NONCE}\nparent_id: root`,
          },
        },
      },
      {
        type: "subagent.started",
        agentId: "worker",
        data: {
          toolCallId: CALL,
          agentName: DEFINITION,
          executionMode: "background",
          parentId: "root",
          taskModelSource: "custom_agent_definition",
          modelSelectionSource: "agent_definition_default",
        },
      },
      {
        type: "subagent.configured",
        agentId: "worker",
        data: { model: MODEL, reasoningEffort: "high", multiTurn: true },
      },
      {
        type: "user.message",
        agentId: "worker",
        data: {
          content: `APEX_WORKER_HANDSHAKE\ndefinition: ${DEFINITION}\nnonce: ${NONCE}\nparent_id: root`,
          parentAgentTaskId: "parent-session",
          source: "parent-session",
          turnId: "0",
          interactionId: "initial-interaction",
        },
      },
      {
        type: "assistant.turn_start",
        agentId: "worker",
        data: { turnId: "0", interactionId: "initial-interaction", parentToolCallId: CALL },
      },
      {
        type: "assistant.message",
        agentId: "worker",
        data: {
          content: `WORKER_READY ${DEFINITION} ${NONCE}`,
          parentToolCallId: CALL,
          turnId: "0",
          interactionId: "initial-interaction",
          model: MODEL,
          toolRequests: [],
        },
      },
      { type: "assistant.turn_end", agentId: "worker", data: { turnId: "0", parentToolCallId: CALL } },
      {
        type: "subagent.completed",
        agentId: "worker",
        data: {
          toolCallId: CALL,
          firstDispatchedModel: MODEL,
          modelSelectionSource: "agent_definition_default",
          totalToolCalls: 0,
        },
      },
      {
        type: "tool.execution_start",
        agentId: "root",
        data: {
          toolCallId: "continuation-call",
          toolName: "write_agent",
          arguments: { agent_id: "worker", message: NONCE },
        },
      },
      { type: "tool.execution_complete", agentId: "root", data: { toolCallId: "continuation-call", success: true } },
      {
        type: "user.message",
        agentId: "worker",
        data: {
          content: NONCE,
          parentAgentTaskId: "different-task-for-continuation",
          source: "parent-session",
          turnId: "0",
          interactionId: "continuation-interaction",
        },
      },
      {
        type: "assistant.turn_start",
        agentId: "worker",
        data: { turnId: "0", interactionId: "continuation-interaction", parentToolCallId: CALL },
      },
      {
        type: "assistant.message",
        agentId: "worker",
        data: {
          content: `WORKER_READY_ACK ${DEFINITION} ${NONCE}`,
          parentToolCallId: CALL,
          turnId: "0",
          interactionId: "continuation-interaction",
          model: MODEL,
          toolRequests: [],
        },
      },
      { type: "assistant.turn_end", agentId: "worker", data: { turnId: "0", parentToolCallId: CALL } },
    ],
  };
}

function dispatch(input) {
  return input.events.find((event) => event.type === "tool.execution_start");
}

function start(input) {
  return input.events.find((event) => event.type === "subagent.started");
}

function configured(input) {
  return input.events.find((event) => event.type === "subagent.configured");
}

function completed(input) {
  return input.events.find((event) => event.type === "subagent.completed");
}

function userMessages(input) {
  return input.events.filter((event) => event.type === "user.message");
}

function assistantMessages(input) {
  return input.events.filter((event) => event.type === "assistant.message");
}

function currentSdkSample(options) {
  return sample(options);
}

function runtimeManagedSample({ phase = "initial" } = {}) {
  const input = phase === "initial" ? initialSample() : sample();
  input.events.unshift(
    { type: "session.start", data: { selectedModel: "auto" } },
    { type: "session.auto_mode_resolved", data: { chosenModel: "gpt-6.1-sol" } },
  );
  start(input).data.taskModelSource = "unset";
  start(input).data.modelSelectionSource = "session_inheritance";
  start(input).data.model = "gpt-6.1-sol";
  configured(input).data.model = "gpt-6.1-sol";
  delete configured(input).data.reasoningEffort;
  assistantMessages(input)[0].data.model = "gpt-6-luna";
  completed(input).data.firstDispatchedModel = "gpt-6-luna";
  completed(input).data.modelSelectionSource = "session_inheritance";
  return { ...input, phase };
}

test("captured Auto pilot verifies the initial handshake despite configured/dispatched model differences", () => {
  const result = verifyWorkerReady(runtimeManagedSample());
  assert.equal(result.status, "HANDSHAKE_VERIFIED", result.reasons.join("\n"));
  assert.equal(result.phase, "initial");
  assert.equal(result.model_attestation_required, false);
  assert.equal(result.model_observations.configured_model, "gpt-6.1-sol");
  assert.equal(result.model_observations.first_dispatched_model, "gpt-6-luna");
  assert.deepEqual(result.model_observations.response_models, ["gpt-6-luna"]);
  assert.equal(result.continuation_verified, false);
  assert.equal(result.permission_granted_by_this_record, false);
});

test("same-worker ACK verifies complete readiness even when models change between turns", () => {
  const result = verifyWorkerReady(runtimeManagedSample({ phase: "complete" }));
  assert.equal(result.status, "READY_VERIFIED", result.reasons.join("\n"));
  assert.equal(result.continuation_verified, true);
  assert.deepEqual(result.model_observations.response_models, ["gpt-6-luna", MODEL]);
  assert.equal(result.permission_granted_by_this_record, false);
});

for (const phase of ["initial", "complete"]) {
  for (const [label, mutate] of [
    ["HydraFusion selection", (s) => (s.events[0].data.selectedModel = "hydrafusion-max")],
    ["fixed runtime selection", (s) => (s.events[0].data.selectedModel = "operator-chosen-model")],
    ["missing picker evidence", (s) => s.events.splice(0, 2)],
    ["unknown task model source", (s) => (start(s).data.taskModelSource = "future_source")],
    ["unknown selection sources", (s) => (completed(s).data.modelSelectionSource = "future_source")],
    ["missing start model", (s) => delete start(s).data.model],
    ["missing configured model", (s) => delete configured(s).data.model],
    ["empty configured model", (s) => (configured(s).data.model = "")],
    ["missing dispatched model", (s) => delete completed(s).data.firstDispatchedModel],
    ["empty dispatched model", (s) => (completed(s).data.firstDispatchedModel = "")],
    ["response model differs from completion", (s) => (assistantMessages(s)[0].data.model = "another-model")],
    [
      "missing all model metadata",
      (s) => {
        for (const event of s.events) {
          for (const key of [
            "model",
            "selectedModel",
            "chosenModel",
            "firstDispatchedModel",
            "reasoningEffort",
            "taskModelSource",
            "modelSelectionSource",
          ])
            delete event.data[key];
        }
      },
    ],
    [
      "legacy pins without runtime catalog attestation",
      (s) => {
        s.frontmatter.model = ["unrelated legacy label"];
        s.frontmatter["reasoning-effort"] = "medium";
        configured(s).data.reasoningEffort = "high";
      },
    ],
  ]) {
    test(`${phase}: ${label} is diagnostic only`, () => {
      const input = runtimeManagedSample({ phase });
      mutate(input);
      const result = verifyWorkerReady(input);
      assert.equal(
        result.status,
        phase === "initial" ? "HANDSHAKE_VERIFIED" : "READY_VERIFIED",
        result.reasons.join("\n"),
      );
      assert.equal(result.model_attestation_required, false);
      assert.equal(result.continuation_verified, phase === "complete");
      assert.equal(result.permission_granted_by_this_record, false);
    });
  }
}

for (const [label, mutate] of [
  ["missing linked dispatch", (s) => s.events.splice(0, 1)],
  ["duplicate dispatch", (s) => s.events.push(dispatch(s))],
  ["wrong dispatch call", (s) => (dispatch(s).data.toolCallId = "other")],
  ["wrong dispatch tool", (s) => (dispatch(s).data.toolName = "other")],
  ["wrong dispatch parent", (s) => (dispatch(s).agentId = "other")],
  ["wrong dispatch definition", (s) => (dispatch(s).data.arguments.agent_type = "general-purpose")],
  ["synchronous dispatch", (s) => (dispatch(s).data.arguments.mode = "sync")],
  ["missing dispatch arguments", (s) => delete dispatch(s).data.arguments],
  ["model override", (s) => (dispatch(s).data.arguments.model = MODEL)],
  ["effort override", (s) => (dispatch(s).data.arguments.reasoning_effort = "high")],
  ["context override", (s) => (dispatch(s).data.arguments.context_tier = "default")],
  ["null override key", (s) => (dispatch(s).data.arguments.model = null)],
  ["wrong parent identity", (s) => (start(s).data.parentId = "other")],
  ["wrong worker definition", (s) => (start(s).data.agentName = "general-purpose")],
  ["synchronous worker", (s) => (start(s).data.executionMode = "sync")],
  ["missing configuration", (s) => s.events.splice(s.events.indexOf(configured(s)), 1)],
  ["duplicate configuration", (s) => s.events.push(configured(s))],
  ["non-multi-turn worker", (s) => (configured(s).data.multiTurn = false)],
  ["missing completion", (s) => s.events.splice(s.events.indexOf(completed(s)), 1)],
  ["wrong completion call", (s) => (completed(s).data.toolCallId = "other")],
  ["nonzero reported tool count", (s) => (completed(s).data.totalToolCalls = 1)],
  ["unknown reported tool count", (s) => delete completed(s).data.totalToolCalls],
  [
    "worker tool activity",
    (s) => s.events.push({ type: "tool.execution_start", agentId: "worker", data: { toolCallId: "tool" } }),
  ],
  ...["tool.execution_complete", "external_tool.requested", "external_tool.completed"].map((type) => [
    `worker ${type} activity`,
    (s) => s.events.push({ type, agentId: "worker", data: { toolCallId: "tool" } }),
  ]),
  [
    "nested worker activity",
    (s) => s.events.push({ type: "subagent.started", agentId: "child", data: { parentId: "worker" } }),
  ],
  ["missing worker identity", (s) => (s.workerId = "")],
  ["missing parent identity", (s) => (s.parentId = "")],
  ["duplicate start", (s) => s.events.push(start(s))],
]) {
  for (const phase of ["initial", "complete"]) {
    test(`${phase}: ${label} blocks readiness`, () => {
      const input = phase === "initial" ? initialSample() : currentSdkSample();
      mutate(input);
      assert.equal(verifyWorkerReady({ ...input, phase }).status, "BLOCKED");
    });
  }
}

for (const [label, mutate] of [
  ["incomplete handshake input", (s) => (userMessages(s)[0].data.content = "APEX_WORKER_HANDSHAKE")],
  [
    "wrong handshake definition",
    (s) =>
      (userMessages(s)[0].data.content = `APEX_WORKER_HANDSHAKE\ndefinition: wrong\nnonce: ${NONCE}\nparent_id: root`),
  ],
  [
    "wrong handshake parent",
    (s) =>
      (userMessages(s)[0].data.content =
        `APEX_WORKER_HANDSHAKE\ndefinition: ${DEFINITION}\nnonce: ${NONCE}\nparent_id: other`),
  ],
  ["missing continuation input", (s) => s.events.splice(s.events.indexOf(userMessages(s)[1]), 1)],
  ["wrong continuation nonce", (s) => (userMessages(s)[1].data.content = "another-nonce")],
  ["initial readiness missing name and nonce", (s) => (assistantMessages(s)[0].data.content = "WORKER_READY")],
  ["initial readiness wrong name", (s) => (assistantMessages(s)[0].data.content = `WORKER_READY other ${NONCE}`)],
  ["initial readiness wrong nonce", (s) => (assistantMessages(s)[0].data.content = `WORKER_READY ${DEFINITION} other`)],
  ["bare ACK", (s) => (assistantMessages(s)[1].data.content = "WORKER_READY_ACK")],
  ["ACK wrong name", (s) => (assistantMessages(s)[1].data.content = `WORKER_READY_ACK other ${NONCE}`)],
  ["ACK wrong nonce", (s) => (assistantMessages(s)[1].data.content = `WORKER_READY_ACK ${DEFINITION} other`)],
  ["unattributed assistant response", (s) => (assistantMessages(s)[1].agentId = "other")],
  ["unlinked assistant response", (s) => (assistantMessages(s)[1].data.parentToolCallId = "other")],
  ["extra assistant message", (s) => s.events.push(assistantMessages(s)[1])],
  ["user continuation from another session", (s) => (userMessages(s)[1].data.source = "other-session")],
]) {
  test(`${label} blocks readiness`, () => {
    const input = currentSdkSample();
    mutate(input);
    assert.equal(verifyWorkerReady(input).status, "BLOCKED");
  });
}

test("non-root parent must be explicitly attributed through dispatch and handshake", () => {
  const input = currentSdkSample();
  input.parentId = "step-worker";
  start(input).data.parentId = "step-worker";
  dispatch(input).agentId = "step-worker";
  userMessages(input)[0].data.content =
    `APEX_WORKER_HANDSHAKE\ndefinition: ${DEFINITION}\nnonce: ${NONCE}\nparent_id: step-worker`;
  dispatch(input).data.arguments.prompt = userMessages(input)[0].data.content;
  for (const event of input.events.filter((event) => event.type.startsWith("tool.") && event.agentId === "root"))
    event.agentId = "step-worker";
  assert.equal(verifyWorkerReady(input).status, "READY_VERIFIED");

  delete start(input).data.parentId;
  assert.equal(verifyWorkerReady(input).status, "BLOCKED");
});

test("another worker cannot supply missing completion or response evidence", () => {
  const input = currentSdkSample();
  input.frontmatter = { name: DEFINITION, model: ["Claude Sonnet 5.5 (copilot)"], "reasoning-effort": "high" };
  completed(input).agentId = "other";
  assert.equal(verifyWorkerReady(input).status, "BLOCKED");
});

test("CLI fails closed on malformed, absent, relative or out-of-scope inputs", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "apex-worker-ready-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, ".github/agents"), { recursive: true });
  mkdirSync(path.join(root, ".github"), { recursive: true });
  const input = currentSdkSample();
  const definition = ".github/agents/02-requirements.agent.md";
  writeFileSync(path.join(root, definition), "---\nname: 02-Requirements\n---\n# 02-Requirements\n");
  const log = path.join(root, "events.jsonl");
  const args = ["--events", log, "--definition", definition, "--worker-id", "worker", "--parent-id", "root"];
  writeFileSync(log, input.events.map((event) => JSON.stringify(event)).join("\n"));
  assert.equal(runValidator(args, root), 0);
  assert.equal(runValidator([...args, "--phase", "invalid"], root), 1);
  const initial = initialSample();
  writeFileSync(log, initial.events.map((event) => JSON.stringify(event)).join("\n"));
  assert.equal(runValidator([...args, "--phase", "initial"], root), 0);
  assert.equal(runValidator([...args, "--phase", "complete"], root), 1);
  writeFileSync(log, "{incomplete");
  assert.equal(runValidator(args, root), 1);
  assert.equal(runValidator([], root), 1);
  assert.equal(runValidator(["--events", "relative.jsonl", ...args.slice(2)], root), 1);
  assert.equal(runValidator(["--events", log, "--definition", "package.json", ...args.slice(4)], root), 1);
});

function initialSample() {
  const input = sample();
  input.events = input.events.slice(0, input.events.indexOf(completed(input)) + 1);
  input.phase = "initial";
  return input;
}

test("initial handshake passes before continuation, but never establishes complete readiness", () => {
  const input = initialSample();
  const result = verifyWorkerReady(input);
  assert.equal(result.status, "HANDSHAKE_VERIFIED", result.reasons.join("\n"));
  assert.equal(result.phase, "initial");
  assert.equal(result.continuation_verified, false);
  assert.equal(result.model_attestation_required, false);
  assert.equal(result.permission_granted_by_this_record, false);
  assert.equal(verifyWorkerReady({ ...input, phase: "complete" }).status, "BLOCKED");
  delete input.phase;
  assert.equal(verifyWorkerReady(input).status, "BLOCKED");
});

function directSample() {
  const input = initialSample();
  const envelope = {
    request_id: "exec-1",
    project: "demo",
    step: "1",
    phase: "phase_1_discovery",
    resume: false,
    review_depth: "default",
    parent_id: "root",
  };
  const prompt = `WORKER_EXECUTE\n${JSON.stringify(envelope)}`;
  dispatch(input).data.arguments.prompt = prompt;
  userMessages(input)[0].data.content = prompt;
  input.events.push({
    type: "tool.execution_complete",
    agentId: "root",
    data: { toolCallId: CALL, success: true },
  });
  return input;
}

test("direct WORKER_EXECUTE dispatch passes without claiming continuation was tested", () => {
  const input = directSample();
  const result = verifyWorkerReady({ ...input, phase: "execute" });
  assert.equal(result.status, "EXECUTE_VERIFIED", result.reasons.join("\n"));
  assert.equal(result.phase, "execute");
  assert.equal(result.continuation_verified, false);
});

for (const [label, mutate] of [
  ["mismatched receipt", (s) => (userMessages(s)[0].data.content = "unrelated input")],
  [
    "missing turn end",
    (s) =>
      s.events.splice(
        s.events.findIndex((e) => e.type === "assistant.turn_end"),
        1,
      ),
  ],
  ["unlinked response", (s) => (assistantMessages(s)[0].data.parentToolCallId = "other")],
  ["failed parent task", (s) => (s.events.at(-1).data.success = false)],
  ["missing parent completion", (s) => s.events.pop()],
  ["mismatched mode", (s) => (dispatch(s).data.arguments.mode = "sync")],
  [
    "misordered completion",
    (s) => {
      const completion = s.events.splice(s.events.indexOf(completed(s)), 1)[0];
      s.events.splice(4, 0, completion);
    },
  ],
]) {
  test(`direct dispatch blocks ${label}`, () => {
    const input = directSample();
    mutate(input);
    assert.equal(verifyWorkerReady({ ...input, phase: "execute" }).status, "BLOCKED");
  });
}

test("observed SDK continuation uses a new parentAgentTaskId and reuses the original dispatch call and turn ID", () => {
  const input = sample();
  assert.notEqual(userMessages(input)[0].data.parentAgentTaskId, userMessages(input)[1].data.parentAgentTaskId);
  const result = verifyWorkerReady(input);
  assert.equal(result.status, "READY_VERIFIED", result.reasons.join("\n"));
  assert.equal(result.continuation_verified, true);
});

for (const phase of ["initial", "complete"]) {
  for (const [label, mutate] of [
    [
      "missing initial turn completion",
      (s) =>
        s.events.splice(
          s.events.findIndex((e) => e.type === "assistant.turn_end"),
          1,
        ),
    ],
    ["unlinked initial response call", (s) => (assistantMessages(s)[0].data.parentToolCallId = "wrong")],
    ["unlinked initial prompt", (s) => (dispatch(s).data.arguments.prompt = "other")],
    ["initial response with tool request", (s) => (assistantMessages(s)[0].data.toolRequests = [{ name: "view" }])],
    ["initial source unknown", (s) => delete userMessages(s)[0].data.source],
  ]) {
    test(`${phase}: ${label} blocks verification`, () => {
      const input = phase === "initial" ? initialSample() : sample();
      mutate(input);
      assert.equal(verifyWorkerReady({ ...input, phase }).status, "BLOCKED");
    });
  }
}

for (const [label, mutate] of [
  ["missing continuation completion", (s) => s.events.pop()],
  ["continuation completed by another worker", (s) => (s.events.at(-1).agentId = "other")],
  ["wrong continuation turn call", (s) => (s.events.at(-1).data.parentToolCallId = "continuation-call")],
  [
    "missing parent send",
    (s) =>
      s.events.splice(
        s.events.findIndex((e) => e.data?.toolName === "write_agent"),
        1,
      ),
  ],
  [
    "wrong send worker",
    (s) => (s.events.find((e) => e.data?.toolName === "write_agent").data.arguments.agent_id = "other"),
  ],
  [
    "wrong send nonce",
    (s) => (s.events.find((e) => e.data?.toolName === "write_agent").data.arguments.message = "other"),
  ],
  ["wrong send parent", (s) => (s.events.find((e) => e.data?.toolName === "write_agent").agentId = "other")],
  ["wrong send call", (s) => (s.events.find((e) => e.data?.toolName === "write_agent").data.toolCallId = "wrong")],
  ["duplicate send call", (s) => s.events.push(s.events.find((e) => e.data?.toolName === "write_agent"))],
  ["failed parent send", (s) => (s.events.find((e) => e.type === "tool.execution_complete").data.success = false)],
  [
    "missing parent send completion",
    (s) =>
      s.events.splice(
        s.events.findIndex((e) => e.type === "tool.execution_complete"),
        1,
      ),
  ],
  ["ACK without a completed second turn", (s) => s.events.pop()],
  [
    "continuation tools",
    (s) => s.events.push({ type: "tool.execution_start", agentId: "worker", data: { toolCallId: "bad" } }),
  ],
  ["continuation tool requests", (s) => (assistantMessages(s)[1].data.toolRequests = [{ name: "view" }])],
  ["continuation interaction mismatch", (s) => (assistantMessages(s)[1].data.interactionId = "other")],
]) {
  test(`${label} blocks complete readiness`, () => {
    const input = sample();
    mutate(input);
    const result = verifyWorkerReady(input);
    assert.equal(result.status, "BLOCKED");
    assert.equal(result.continuation_verified, false);
  });
}
