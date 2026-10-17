#!/usr/bin/env node
/**
 * Verify a tool-free Copilot SDK worker's identity and same-worker continuation.
 * Model telemetry is diagnostic only; readiness never authorizes workflow or Azure actions.
 */
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseFrontmatter } from "./_lib/parse-frontmatter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function verifyWorkerReady({ events, frontmatter, workerId, parentId, phase = "complete" }) {
  const reasons = [];
  if (!["initial", "complete", "execute"].includes(phase))
    reasons.push("Verification phase must be initial, complete, or execute.");
  if (!workerId || !parentId) reasons.push("Explicit worker and parent identities are required.");
  if (!frontmatter?.name) reasons.push("The exact named worker definition is required.");

  const attributed = events.filter((event) => event.agentId === workerId);
  const starts = attributed.filter((event) => event.type === "subagent.started");
  const startEvent = starts.length === 1 ? starts[0] : undefined;
  const start = startEvent?.data;
  if (!startEvent) reasons.push("Exactly one attributed worker start is required.");
  if (typeof start?.toolCallId !== "string" || !start.toolCallId.trim()) {
    reasons.push("Worker start is missing its call identity.");
  }
  if (start?.agentName !== frontmatter?.name) reasons.push("Worker identity does not match the named definition.");
  if (phase !== "execute" && start?.executionMode !== "background")
    reasons.push("Worker was not started in background mode.");
  if (phase === "execute" && !["background", "sync"].includes(start?.executionMode)) {
    reasons.push("Worker start is missing a valid execution mode.");
  }
  if ((start?.parentId ?? (parentId === "root" ? "root" : undefined)) !== parentId) {
    reasons.push("Worker parent identity is missing or does not match the requested parent.");
  }

  const configurations = attributed.filter((event) => event.type === "subagent.configured");
  const configured = configurations.length === 1 ? configurations[0].data : undefined;
  if (configurations.length !== 1) reasons.push("Exactly one attributed worker configuration is required.");
  if (phase !== "execute" && configured?.multiTurn !== true) reasons.push("Multi-turn continuation is not configured.");

  const completions = attributed.filter((event) => event.type === "subagent.completed");
  const completionEvent =
    completions.length === 1 && completions[0].data?.toolCallId === start?.toolCallId ? completions[0] : undefined;
  const completed = completionEvent?.data;
  if (!completionEvent) reasons.push("Exactly one linked attributed worker completion is required.");

  const dispatches = events.filter(
    (event) => event.type === "tool.execution_start" && event.data?.toolCallId === start?.toolCallId,
  );
  const dispatch = dispatches.length === 1 ? dispatches[0] : undefined;
  const args = dispatch?.data?.arguments;
  const validDispatchMode =
    phase === "execute"
      ? !Object.hasOwn(args ?? {}, "mode") || ["background", "sync"].includes(args?.mode)
      : args?.mode === "background";
  if (
    !dispatch ||
    dispatch.data?.toolName !== "task" ||
    (dispatch.agentId ?? (parentId === "root" ? "root" : undefined)) !== parentId ||
    !args ||
    typeof args !== "object" ||
    Array.isArray(args) ||
    args.agent_type !== frontmatter?.name ||
    !validDispatchMode ||
    ["model", "reasoning_effort", "context_tier"].some((key) => Object.hasOwn(args, key))
  ) {
    reasons.push(
      "Exactly one matching parent task dispatch without caller model, effort, or context overrides is required.",
    );
  }

  const userMessages = attributed.filter((event) => event.type === "user.message");
  const assistantMessages = attributed.filter((event) => event.type === "assistant.message");

  if (phase === "execute") {
    const executeEnvelope = parseExecuteInput(args?.prompt);
    if (!executeEnvelope) {
      reasons.push("Direct execute phase requires a valid WORKER_EXECUTE JSON envelope.");
    } else if ((executeEnvelope.parent_id ?? parentId) !== parentId) {
      reasons.push("WORKER_EXECUTE parent_id does not match the requested parent.");
    }
    const received = userMessages[0];
    if (!received || received.data?.content !== args?.prompt) {
      reasons.push("Received WORKER_EXECUTE must exactly match the parent dispatch.");
    }
    const interaction = received?.data?.interactionId;
    const turns = attributed.filter(
      (event) => event.type === "assistant.turn_start" && event.data?.interactionId === interaction,
    );
    if (!interaction || !turns.length) reasons.push("Direct execution lacks attributed worker turns.");
    for (const turn of turns) {
      const messages = assistantMessages.filter(
        (event) => event.data?.interactionId === interaction && event.data?.turnId === turn.data.turnId,
      );
      const ends = attributed.filter(
        (event) =>
          event.type === "assistant.turn_end" &&
          event.data?.turnId === turn.data.turnId &&
          events.indexOf(event) > events.indexOf(turn) &&
          events.indexOf(event) < events.indexOf(completionEvent),
      );
      if (
        turn.data?.parentToolCallId !== start?.toolCallId ||
        !messages.length ||
        ends.length !== 1 ||
        messages.some(
          (event) =>
            event.data?.parentToolCallId !== start?.toolCallId ||
            events.indexOf(event) <= events.indexOf(turn) ||
            events.indexOf(event) >= events.indexOf(ends[0]),
        ) ||
        ends[0]?.data?.parentToolCallId !== start?.toolCallId
      )
        reasons.push("Direct execution turn lacks matching response, linkage or completion.");
    }
    const taskEnds = events.filter(
      (event) => event.type === "tool.execution_complete" && event.data?.toolCallId === start?.toolCallId,
    );
    if (
      taskEnds.length !== 1 ||
      taskEnds[0].data?.success !== true ||
      (taskEnds[0].agentId ?? "root") !== parentId ||
      completed?.error ||
      completed?.success === false ||
      (args?.mode !== undefined && args.mode !== start?.executionMode) ||
      (args?.mode === undefined && start?.executionMode !== "sync") ||
      !dispatch ||
      !startEvent ||
      !configurations[0] ||
      !received ||
      !completionEvent ||
      !(
        events.indexOf(dispatch) < events.indexOf(startEvent) &&
        events.indexOf(startEvent) < events.indexOf(configurations[0]) &&
        events.indexOf(configurations[0]) < events.indexOf(received) &&
        events.indexOf(received) < events.indexOf(turns[0]) &&
        events.indexOf(dispatch) < events.indexOf(taskEnds[0])
      )
    ) {
      reasons.push("Direct execution requires a successful linked dispatch and ordered worker completion.");
    }
    return {
      status: reasons.length ? "BLOCKED" : "EXECUTE_VERIFIED",
      phase,
      continuation_verified: false,
      worker_id: workerId,
      parent_id: parentId,
      agent: frontmatter?.name ?? null,
      model_attestation_required: false,
      model_observations: {
        start_model: start?.model ?? null,
        configured_model: configured?.model ?? null,
        first_dispatched_model: completed?.firstDispatchedModel ?? null,
        response_models: assistantMessages.map((event) => event.data?.model ?? null),
        configured_effort: configured?.reasoningEffort ?? null,
        task_model_source: start?.taskModelSource ?? null,
        start_selection_source: start?.modelSelectionSource ?? null,
        completion_selection_source: completed?.modelSelectionSource ?? null,
      },
      reasons,
      permission_granted_by_this_record: false,
    };
  }

  const expectedTurns = phase === "initial" ? 1 : 2;
  const initialInput = parseHandshakeInput(userMessages[0]?.data?.content);
  if (userMessages.length !== expectedTurns || !initialInput) {
    reasons.push(
      `The ${phase} phase requires exactly ${expectedTurns} user message(s), starting with a complete handshake.`,
    );
  }
  if (initialInput) {
    if (initialInput.definition !== frontmatter?.name)
      reasons.push("Handshake definition does not match the named worker.");
    if (initialInput.parentId !== parentId) reasons.push("Handshake parent does not match the requested parent.");
    if (phase === "complete" && userMessages[1]?.data?.content !== initialInput.nonce) {
      reasons.push("Continuation input does not echo the original nonce exactly.");
    }
  }
  if (assistantMessages.length !== expectedTurns) {
    reasons.push(`The ${phase} phase requires exactly ${expectedTurns} assistant response(s).`);
  }
  const initialResponse = parseReadyResponse(assistantMessages[0]?.data?.content);
  if (
    !initialResponse ||
    initialResponse.definition !== frontmatter?.name ||
    !initialInput ||
    initialResponse.nonce !== initialInput.nonce
  ) {
    reasons.push("Initial WORKER_READY response must include the exact definition name and handshake nonce.");
  }
  if (args?.prompt !== userMessages[0]?.data?.content) {
    reasons.push("Initial handshake is not linked to the parent task prompt.");
  }

  const turnStarts = attributed.filter((event) => event.type === "assistant.turn_start");
  const turnEnds = attributed.filter((event) => event.type === "assistant.turn_end");
  if (turnStarts.length !== expectedTurns || turnEnds.length !== expectedTurns) {
    reasons.push(`The ${phase} phase requires ${expectedTurns} attributed completed tool-free turn(s).`);
  }
  for (let index = 0; index < expectedTurns; index++) {
    const user = userMessages[index];
    const response = assistantMessages[index];
    const turnStart = turnStarts[index];
    const turnEnd = turnEnds[index];
    const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
    const linked =
      user &&
      response &&
      turnStart &&
      turnEnd &&
      nonempty(user.data?.source) &&
      user.data.source === userMessages[0]?.data?.source &&
      nonempty(user.data?.parentAgentTaskId) &&
      nonempty(user.data?.interactionId) &&
      user.data.interactionId === turnStart.data?.interactionId &&
      user.data.interactionId === response.data?.interactionId &&
      nonempty(user.data?.turnId) &&
      [turnStart, response, turnEnd].every(
        (event) => event.data?.turnId === user.data.turnId && event.data?.parentToolCallId === start?.toolCallId,
      ) &&
      (!response.data?.toolRequests ||
        (Array.isArray(response.data.toolRequests) && response.data.toolRequests.length === 0)) &&
      events.indexOf(user) < events.indexOf(turnStart) &&
      events.indexOf(turnStart) < events.indexOf(response) &&
      events.indexOf(response) < events.indexOf(turnEnd);
    if (!linked) reasons.push(`Turn ${index + 1} lacks linked identity, response, or completion evidence.`);
  }
  if (
    !completionEvent ||
    events.indexOf(dispatch) >= events.indexOf(startEvent) ||
    events.indexOf(startEvent) >= events.indexOf(configurations[0]) ||
    events.indexOf(configurations[0]) >= events.indexOf(userMessages[0]) ||
    events.indexOf(turnEnds[0]) >= events.indexOf(completionEvent)
  ) {
    reasons.push("Initial dispatch, configuration, handshake and completion are not in the required order.");
  }

  if (phase === "complete") {
    if (
      !initialInput ||
      assistantMessages[1]?.data?.content !== `WORKER_READY_ACK ${frontmatter?.name} ${initialInput.nonce}`
    ) {
      reasons.push("Continuation ACK must echo the exact definition name and original nonce.");
    }
    const sends = events.filter(
      (event) =>
        event.type === "tool.execution_start" &&
        event.data?.toolName === "write_agent" &&
        (event.data?.arguments?.agent_id === workerId ||
          (Array.isArray(event.data?.arguments?.agent_ids) && event.data.arguments.agent_ids.includes(workerId))),
    );
    const send = sends.length === 1 ? sends[0] : undefined;
    const sendArgs = send?.data?.arguments;
    const sendCall = send?.data?.toolCallId;
    const sendCompletions = events.filter(
      (event) => event.type === "tool.execution_complete" && event.data?.toolCallId === sendCall,
    );
    const sendComplete = sendCompletions.length === 1 ? sendCompletions[0] : undefined;
    if (
      !send ||
      typeof sendCall !== "string" ||
      !sendCall.trim() ||
      sendCall === start?.toolCallId ||
      events.filter((event) => event.type === "tool.execution_start" && event.data?.toolCallId === sendCall).length !==
        1 ||
      (send.agentId ?? (parentId === "root" ? "root" : undefined)) !== parentId ||
      sendArgs?.agent_id !== workerId ||
      Object.hasOwn(sendArgs, "agent_ids") ||
      Object.hasOwn(sendArgs, "scope") ||
      !initialInput ||
      sendArgs.message !== initialInput.nonce ||
      ["model", "reasoning_effort", "context_tier"].some((key) => Object.hasOwn(sendArgs, key)) ||
      !sendComplete ||
      sendComplete.data?.success !== true ||
      (sendComplete.agentId ?? (parentId === "root" ? "root" : undefined)) !== parentId ||
      events.indexOf(completionEvent) >= events.indexOf(send) ||
      events.indexOf(send) >= events.indexOf(sendComplete) ||
      events.indexOf(sendComplete) >= events.indexOf(userMessages[1]) ||
      events.indexOf(turnEnds[0]) >= events.indexOf(userMessages[1])
    ) {
      reasons.push(
        "Continuation requires one linked successful parent write_agent send to the same worker after initial completion.",
      );
    }
  }

  if (completed?.totalToolCalls !== 0)
    reasons.push("The ready-only turn performed tools or lacks tool-count evidence.");
  if (
    attributed.some((event) =>
      [
        "tool.execution_start",
        "tool.execution_complete",
        "external_tool.requested",
        "external_tool.completed",
      ].includes(event.type),
    ) ||
    events.some((event) => event.type === "subagent.started" && event.data?.parentId === workerId)
  ) {
    reasons.push("Observed tool or child-worker activity contradicts tool-free readiness.");
  }

  return {
    status: reasons.length ? "BLOCKED" : phase === "initial" ? "HANDSHAKE_VERIFIED" : "READY_VERIFIED",
    phase,
    continuation_verified: phase === "complete" && reasons.length === 0,
    worker_id: workerId,
    parent_id: parentId,
    agent: frontmatter?.name ?? null,
    model_attestation_required: false,
    model_observations: {
      start_model: start?.model ?? null,
      configured_model: configured?.model ?? null,
      first_dispatched_model: completed?.firstDispatchedModel ?? null,
      response_models: assistantMessages.map((event) => event.data?.model ?? null),
      configured_effort: configured?.reasoningEffort ?? null,
      task_model_source: start?.taskModelSource ?? null,
      start_selection_source: start?.modelSelectionSource ?? null,
      completion_selection_source: completed?.modelSelectionSource ?? null,
    },
    reasons,
    permission_granted_by_this_record: false,
  };
}

function parseHandshakeInput(content) {
  if (typeof content !== "string") return null;
  const lines = content.trim().split(/\r?\n/);
  if (lines.length !== 4 || lines[0] !== "APEX_WORKER_HANDSHAKE") return null;
  const definition = lines[1].match(/^definition: ([^\s]+)$/)?.[1];
  const nonce = lines[2].match(/^nonce: ([^\s]+)$/)?.[1];
  const parentId = lines[3].match(/^parent_id: ([^\s]+)$/)?.[1];
  return definition && nonce && parentId ? { definition, nonce, parentId } : null;
}

function parseReadyResponse(content) {
  if (typeof content !== "string") return null;
  const match = content.trim().match(/^WORKER_READY ([^\s]+) ([^\s]+)$/);
  return match ? { definition: match[1], nonce: match[2] } : null;
}

function parseExecuteInput(content) {
  if (typeof content !== "string" || !content.startsWith("WORKER_EXECUTE\n")) return null;
  try {
    const parsed = JSON.parse(content.slice("WORKER_EXECUTE\n".length));
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      ["request_id", "project", "step", "phase"].every(
        (key) => typeof parsed[key] === "string" && parsed[key].trim(),
      ) &&
      typeof parsed.resume === "boolean" &&
      ["default", "deep"].includes(parsed.review_depth)
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function runValidator(argv = process.argv.slice(2), root = ROOT) {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        events: { type: "string" },
        definition: { type: "string" },
        "worker-id": { type: "string" },
        "parent-id": { type: "string" },
        phase: { type: "string", default: "complete" },
        help: { type: "boolean" },
      },
      strict: true,
    });
    if (values.help) {
      console.log(
        "Usage: node tools/scripts/verify-worker-ready.mjs --events /absolute/events.jsonl " +
          "--definition .github/agents/02-requirements.agent.md --worker-id ID --parent-id root|ID --phase initial|complete\n" +
          "Initial: HANDSHAKE_VERIFIED, continuation not verified. Complete (default): READY_VERIFIED after the ACK turn.\n" +
          "Models, effort and picker selection are diagnostic only. Neither phase grants approval.",
      );
      return 0;
    }
    for (const key of ["events", "definition", "worker-id", "parent-id"]) {
      if (!values[key]) throw new Error(`Missing --${key}`);
    }
    if (!path.isAbsolute(values.events)) throw new Error("--events must identify an absolute session log path");
    const definition = realpathSync(path.resolve(root, values.definition));
    const agentRoot = realpathSync(path.join(root, ".github/agents"));
    if (!definition.startsWith(`${agentRoot}${path.sep}`) || !definition.endsWith(".agent.md")) {
      throw new Error("--definition must be an active repository agent file");
    }
    const events = readFileSync(values.events, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line, index) => {
        try {
          const event = JSON.parse(line);
          if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("not an event object");
          return event;
        } catch (error) {
          throw new Error(`Invalid event record ${index + 1}: ${error.message}`, { cause: error });
        }
      });
    const result = verifyWorkerReady({
      events,
      frontmatter: parseFrontmatter(readFileSync(definition, "utf8")),
      workerId: values["worker-id"],
      parentId: values["parent-id"],
      phase: values.phase,
    });
    console.log(JSON.stringify(result, null, 2));
    return result.status === "BLOCKED" ? 1 : 0;
  } catch (error) {
    console.error(`Worker readiness verification failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runValidator();
}
