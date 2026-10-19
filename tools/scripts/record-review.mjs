#!/usr/bin/env node
/**
 * Persist independently returned one-shot review JSON from attributed SDK events.
 * Usage: record-review.mjs --events /absolute/events.jsonl --worker-id ID --parent-id root|ID --output PATH
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import {
  cacheInputs,
  findingId,
  isRecordedReviewer,
  STRUCTURED_REVIEWER,
  validateReview,
} from "./validate-challenger-findings.mjs";

const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const requireEvidence = (condition, message) => {
  if (!condition) throw new Error(message);
};

function exactly(events, type) {
  const matches = events.filter((event) => event.type === type);
  requireEvidence(matches.length === 1, `Exactly one ${type} is required`);
  return matches[0];
}

function parseReviewJson(content) {
  requireEvidence(nonempty(content), "Final JSON response is empty");
  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed);
    requireEvidence(object(parsed), "Final response must be a JSON object");
    return parsed;
  } catch {
    // Fall back to extracting a single unambiguous fenced or embedded JSON object.
  }
  const candidates = [];
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of trimmed.matchAll(fenceRegex)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (object(parsed)) candidates.push(parsed);
    } catch {
      // Ignore non-JSON fences.
    }
  }
  if (candidates.length === 0) {
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}" && depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            const parsed = JSON.parse(trimmed.slice(start, i + 1));
            if (object(parsed)) candidates.push(parsed);
          } catch {
            // Continue scanning.
          }
          start = -1;
        }
      }
    }
  }
  requireEvidence(
    candidates.length === 1,
    candidates.length > 1
      ? "Final response must contain one unambiguous JSON review object"
      : "Final response must be one raw JSON object without Markdown fences or prose",
  );
  return candidates[0];
}

function normalizeReviewDoc(doc, input, root) {
  const entries = Array.isArray(doc.batch_results) ? doc.batch_results : [doc];
  for (const entry of entries) {
    if (!object(entry)) continue;
    if (
      nonempty(entry.challenged_artifact) &&
      nonempty(input?.artifact_path) &&
      path.resolve(root, entry.challenged_artifact) === path.resolve(root, input.artifact_path)
    ) {
      entry.challenged_artifact = input.artifact_path;
    }
    if (!Array.isArray(entry.findings)) continue;
    for (const finding of entry.findings) {
      if (!object(finding)) continue;
      if (typeof finding.traces_to === "string") {
        finding.traces_to = finding.traces_to.trim() ? [finding.traces_to] : [];
      }
      if (
        object(finding.suggested_fix) &&
        nonempty(finding.suggested_fix.artifact_path) &&
        nonempty(input?.artifact_path) &&
        path.resolve(root, finding.suggested_fix.artifact_path) === path.resolve(root, input.artifact_path)
      ) {
        finding.suggested_fix.artifact_path = input.artifact_path;
      }
      if (nonempty(finding.category) && nonempty(finding.claim) && nonempty(finding.artifact_section)) {
        finding.id = findingId(finding);
      }
    }
    for (const [field, severity] of [
      ["must_fix_count", "must_fix"],
      ["should_fix_count", "should_fix"],
      ["suggestion_count", "suggestion"],
    ]) {
      entry[field] = entry.findings.filter((finding) => object(finding) && finding.severity === severity).length;
    }
  }
}
function resolveReviewer(events, requestId) {
  const dispatches = events.filter((event) => {
    if (event.type !== "tool.execution_start" || event.data?.toolName !== "task") return false;
    const args = event.data.arguments;
    if (!isRecordedReviewer(args?.agent_type) || !args.prompt?.startsWith("APEX_REVIEW\n")) return false;
    const input = JSON.parse(args.prompt.slice("APEX_REVIEW\n".length));
    return input.request_id === requestId;
  });
  requireEvidence(dispatches.length === 1, "Request ID must identify exactly one review dispatch in --events");
  const dispatch = dispatches[0];
  const starts = events.filter(
    (event) =>
      event.type === "subagent.started" &&
      event.data?.toolCallId === dispatch.data.toolCallId &&
      event.data?.agentName === dispatch.data.arguments.agent_type &&
      nonempty(event.agentId),
  );
  requireEvidence(starts.length === 1, "Review dispatch must identify exactly one worker");
  return { workerId: starts[0].agentId, parentId: dispatch.agentId ?? "root" };
}

function parseEvents(eventsPath) {
  requireEvidence(path.isAbsolute(eventsPath), "--events must be an absolute native events.jsonl path");
  return fs
    .readFileSync(eventsPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        const event = JSON.parse(line);
        requireEvidence(object(event), "not an event object");
        return event;
      } catch (error) {
        throw new Error(`Invalid event record ${index + 1}: ${error.message}`, { cause: error });
      }
    });
}

export function extractReview(events, workerId, parentId) {
  requireEvidence(
    nonempty(workerId) && nonempty(parentId) && workerId !== parentId && workerId !== "root",
    "Exact distinct worker and parent identities are required",
  );
  const worker = events.filter((event) => event.agentId === workerId);
  const start = exactly(worker, "subagent.started");
  const configured = exactly(worker, "subagent.configured");
  const completed = exactly(worker, "subagent.completed");
  const reviewer = start.data?.agentName;
  const call = start.data?.toolCallId;
  const effectiveParent =
    start.data?.parentId ?? (parentId === "root" && start.data?.resumable === false ? "root" : undefined);
  const oneShotConfig =
    object(configured.data) &&
    (configured.data.multiTurn !== true || (start.data?.executionMode === "sync" && start.data?.resumable === false));
  requireEvidence(
    nonempty(call) &&
      isRecordedReviewer(reviewer) &&
      start.data.executionMode === "sync" &&
      effectiveParent === parentId &&
      oneShotConfig &&
      completed.data?.toolCallId === call &&
      nonempty(completed.timestamp) &&
      Number.isFinite(Date.parse(completed.timestamp)),
    "Attributed one-shot configuration, identity, parent, or completion is invalid",
  );
  const linked = events.filter((event) => event.data?.toolCallId === call);
  requireEvidence(
    exactly(linked, "subagent.started") === start && exactly(linked, "subagent.completed") === completed,
    "Dispatch must identify exactly one worker and completion",
  );
  const dispatch = exactly(linked, "tool.execution_start");
  const finished = exactly(linked, "tool.execution_complete");
  const args = dispatch.data.arguments;
  requireEvidence(
    dispatch.data.toolName === "task" &&
      (dispatch.agentId ?? "root") === parentId &&
      object(args) &&
      args.agent_type === reviewer &&
      (!Object.hasOwn(args, "mode") || args.mode === "sync") &&
      !["model", "reasoning_effort", "context_tier"].some((key) => Object.hasOwn(args, key)) &&
      (finished.agentId ?? "root") === parentId &&
      finished.data.success === true,
    "Exactly one successful matching parent task dispatch without caller overrides is required",
  );
  requireEvidence(
    typeof args.prompt === "string" && args.prompt.startsWith("APEX_REVIEW\n"),
    "Task prompt must be APEX_REVIEW followed by one JSON object",
  );
  const input = JSON.parse(args.prompt.slice("APEX_REVIEW\n".length));
  requireEvidence(object(input), "Review input must be an object");
  requireEvidence(
    nonempty(input.request_id) && nonempty(input.step) && ["default", "deep"].includes(input.review_depth),
    "Review request_id, step and review_depth must be explicit",
  );
  const user = exactly(worker, "user.message");
  const turns = [];
  const turnIds = new Set();
  let active;
  for (const event of worker) {
    const data = event.data ?? {};
    if (event.type === "assistant.turn_start") {
      requireEvidence(
        !active &&
          nonempty(data.turnId) &&
          !turnIds.has(data.turnId) &&
          data.interactionId === user.data?.interactionId &&
          data.parentToolCallId === call,
        "Worker turns require unique linked identities without overlap",
      );
      turnIds.add(data.turnId);
      active = { start: event, responses: [] };
      turns.push(active);
    } else if (["assistant.message", "assistant.turn_end"].includes(event.type)) {
      requireEvidence(
        active &&
          data.turnId === active.start.data.turnId &&
          data.parentToolCallId === call &&
          (event.type === "assistant.message"
            ? data.interactionId === user.data?.interactionId
            : data.interactionId === undefined || data.interactionId === user.data?.interactionId),
        "Worker interaction lacks exact linked identity or final response",
      );
      if (event.type === "assistant.message") active.responses.push(event);
      else {
        requireEvidence(active.responses.length > 0, "Completed worker turn lacks an assistant response");
        active.end = event;
        active = undefined;
      }
    }
  }
  requireEvidence(turns.length > 0 && !active, "Worker interaction has missing or incomplete turns");
  const turnStart = turns[0].start;
  const responses = worker.filter((event) => event.type === "assistant.message");
  const rawFinals = responses.filter(
    (event) => !event.data?.toolRequests || (Array.isArray(event.data.toolRequests) && !event.data.toolRequests.length),
  );
  const finals = rawFinals.length > 1 ? rawFinals.filter((event) => nonempty(event.data?.content)) : rawFinals;
  requireEvidence(finals.length === 1, "Exactly one unambiguous final assistant response is required");
  const response = finals[0];
  requireEvidence(
    user.data?.content === args.prompt &&
      nonempty(user.data.source) &&
      nonempty(user.data.parentAgentTaskId) &&
      nonempty(user.data.interactionId) &&
      nonempty(user.data.turnId) &&
      turnStart.data.turnId === user.data.turnId &&
      responses.every(
        (event) =>
          event.data.toolRequests === undefined ||
          (Array.isArray(event.data.toolRequests) && event.data.toolRequests.every((request) => object(request))),
      ),
    "Worker interaction lacks exact linked identity or final response",
  );
  const ordered = [
    dispatch,
    start,
    configured,
    user,
    ...turns.flatMap((turn) => [turn.start, ...turn.responses, turn.end]),
    completed,
  ];
  requireEvidence(
    ordered.every((event, index) => index === 0 || events.indexOf(ordered[index - 1]) < events.indexOf(event)) &&
      events.indexOf(dispatch) < events.indexOf(finished) &&
      responses.at(-1) === response,
    "Dispatch, complete worker interaction, and completion must be ordered",
  );
  const delegate = (name) =>
    typeof name === "string" && /(?:^|[./_-])(task|write_agent|create_session|send_message)$/.test(name);
  requireEvidence(
    !events.some((event) => event.type === "subagent.started" && event.data?.parentId === workerId) &&
      !worker.some(
        (event) =>
          delegate(event.data?.toolName) ||
          event.data?.toolRequests?.some((request) =>
            delegate(request.name ?? request.toolName ?? request.function?.name),
          ),
      ),
    "Nested delegation is not allowed",
  );
  for (const event of [...worker, finished]) {
    if (event.type === "tool.execution_complete" && event !== finished) continue;
    requireEvidence(
      !/(?:^|[._])(?:error|failed|cancelled|aborted)$/.test(event.type) &&
        event.data?.success !== false &&
        !event.data?.error &&
        !event.data?.isError &&
        !event.data?.result?.isError &&
        !["failed", "cancelled", "aborted", "error"].includes(event.data?.status),
      "Review execution contains an error or failed operation",
    );
  }
  const toolEvents = worker.filter((event) =>
    ["tool.execution_start", "tool.execution_complete", "external_tool.requested", "external_tool.completed"].includes(
      event.type,
    ),
  );
  const recoveredReads = new Set();
  for (const event of toolEvents) {
    const turn = turns.find(
      (candidate) =>
        events.indexOf(candidate.start) < events.indexOf(event) &&
        events.indexOf(event) < events.indexOf(candidate.end),
    );
    requireEvidence(
      turn &&
        (event.data?.turnId === undefined || event.data.turnId === turn.start.data.turnId) &&
        (event.data?.interactionId === undefined || event.data.interactionId === user.data.interactionId) &&
        (event.data?.parentToolCallId === undefined || event.data.parentToolCallId === call),
      "Worker tool activity must be linked to its completed turn",
    );
    const external = event.type.startsWith("external_tool.");
    const linkedTool = worker.filter((candidate) => candidate.data?.toolCallId === event.data?.toolCallId);
    const toolStart = exactly(linkedTool, external ? "external_tool.requested" : "tool.execution_start");
    const toolFinish = exactly(linkedTool, external ? "external_tool.completed" : "tool.execution_complete");
    const successful = (finish) =>
      finish.data?.success === true && !finish.data.error && !finish.data.isError && !finish.data.result?.isError;
    let recovered = false;
    if (!external && !successful(toolFinish)) {
      const readPath = toolStart.data?.arguments?.path;
      const message = toolFinish.data?.error?.message ?? toolFinish.data?.result?.message;
      recovered =
        toolStart.data?.toolName === "view" &&
        nonempty(readPath) &&
        message === "view_range out of bounds" &&
        worker.some(
          (retry) =>
            retry.type === "tool.execution_start" &&
            retry.data?.toolName === "view" &&
            retry.data?.arguments?.path === readPath &&
            events.indexOf(retry) > events.indexOf(toolFinish) &&
            worker.some(
              (finish) =>
                finish.type === "tool.execution_complete" &&
                finish.data?.toolCallId === retry.data.toolCallId &&
                successful(finish) &&
                events.indexOf(finish) > events.indexOf(retry) &&
                events.indexOf(finish) < events.indexOf(response),
            ),
        );
      if (recovered) recoveredReads.add(toolFinish.data.toolCallId);
    }
    requireEvidence(
      nonempty(event.data?.toolCallId) &&
        events.indexOf(turn.start) < events.indexOf(toolStart) &&
        events.indexOf(toolStart) < events.indexOf(toolFinish) &&
        events.indexOf(toolFinish) < events.indexOf(turn.end) &&
        (successful(toolFinish) || recovered),
      "Worker tool calls must complete successfully",
    );
  }
  const doc = parseReviewJson(response.data?.content);
  if (reviewer === STRUCTURED_REVIEWER && doc?.status === "FAILED") {
    requireEvidence(nonempty(doc.stage) && nonempty(doc.error), "Reviewer execution failure requires stage and error");
    throw new Error(`Reviewer execution failed at ${doc.stage}: ${doc.error}`);
  }
  requireEvidence(
    object(doc) && !Object.hasOwn(doc, "review_execution"),
    "Expected raw review JSON without provenance",
  );
  return {
    input,
    doc,
    execution: {
      reviewer,
      worker_id: workerId,
      parent_id: parentId,
      tool_call_id: call,
      completed_at: completed.timestamp,
      request_id: input.request_id,
      step: input.step,
      review_depth: input.review_depth,
      project_name: input.project_name,
      ...(recoveredReads.size ? { recovered_read_calls: [...recoveredReads] } : {}),
    },
  };
}

function outputPath(root, project, output) {
  requireEvidence(nonempty(project) && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(project), "Invalid project_name");
  requireEvidence(nonempty(output), "Missing output path");
  requireEvidence(!output.split(/[\\/]/).includes(".."), "Output traversal is forbidden");
  const resolved = path.resolve(root, output);
  const projectRoot = path.join(root, "agent-output", project);
  requireEvidence(
    resolved.startsWith(`${projectRoot}${path.sep}`) && resolved.endsWith(".json"),
    "Output must be JSON within agent-output/<project_name>/",
  );
  const relative = path.relative(root, resolved);
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      requireEvidence(!fs.lstatSync(current).isSymbolicLink(), "Output symlink escape is forbidden");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  requireEvidence(fs.statSync(path.dirname(resolved)).isDirectory(), "Output directory must already exist");
  return resolved;
}

function checkReview(input, doc, root) {
  for (const key of ["artifact_path", "project_name", "artifact_type", "output_path"]) {
    requireEvidence(nonempty(input[key]), `Missing review input ${key}`);
  }
  requireEvidence(
    typeof input.overwrite === "boolean" &&
      (input.prior_findings === null || Array.isArray(input.prior_findings)) &&
      object(input.cache_inputs),
    "Review requires explicit overwrite, prior_findings and cache_inputs",
  );
  requireEvidence(
    !(Object.hasOwn(input, "batch_lenses") && Object.hasOwn(input, "lenses")),
    "Only one batch lens list is allowed",
  );
  const batch = Object.hasOwn(input, "batch_lenses") || Object.hasOwn(input, "lenses");
  const lenses = batch
    ? (input.lenses ?? input.batch_lenses)
    : [{ review_focus: input.review_focus, pass_number: input.pass_number }];
  requireEvidence(
    Array.isArray(lenses) &&
      lenses.length > 0 &&
      (!batch || (!Object.hasOwn(input, "review_focus") && !Object.hasOwn(input, "pass_number"))) &&
      lenses.every(
        (lens) => nonempty(lens.review_focus) && Number.isInteger(lens.pass_number) && lens.pass_number > 0,
      ) &&
      new Set(lenses.map((lens) => `${lens.review_focus}:${lens.pass_number}`)).size === lenses.length,
    "Review lenses and pass numbers must be explicit and unambiguous",
  );
  requireEvidence(
    isRecordedReviewer(input.cache_inputs.reviewer) &&
      input.cache_inputs.reviewer === doc.review_execution?.reviewer &&
      isDeepStrictEqual(input.cache_inputs, cacheInputs(input.artifact_path, root, input.cache_inputs.reviewer)),
    "Dispatched cache snapshot does not match current artifact or reviewer contract bytes",
  );
  const entries = batch ? doc.batch_results : [doc];
  requireEvidence(
    Array.isArray(entries) && entries.length === lenses.length && (batch || !Object.hasOwn(doc, "batch_results")),
    "Returned review does not match requested batch",
  );
  for (const [index, entry] of entries.entries()) {
    requireEvidence(
      object(entry) &&
        !Object.hasOwn(entry, "batch_results") &&
        (!batch || !Object.hasOwn(entry, "review_execution")) &&
        entry.challenged_artifact === input.artifact_path &&
        entry.artifact_type === input.artifact_type &&
        entry.review_focus === lenses[index].review_focus &&
        entry.pass_number === lenses[index].pass_number &&
        isDeepStrictEqual(entry.cache_inputs, input.cache_inputs) &&
        isDeepStrictEqual(entry.supporting_inputs, input.supporting_inputs),
      "Returned artifact, lens, pass, cache snapshot or supporting inputs differ from dispatch",
    );
    for (const key of ["request_id", "step", "review_depth", "project_name"]) {
      requireEvidence(!Object.hasOwn(entry, key) || entry[key] === input[key], `Returned ${key} differs from dispatch`);
    }
  }
  const errors = validateReview(doc, { root, verifyCurrent: true });
  requireEvidence(errors.length === 0, errors.join("\n"));
}

function loadEventsWithFlushWait(eventsPath, workerId) {
  let events = parseEvents(eventsPath);
  const hasLiveSyncStart = events.some(
    (event) =>
      event.agentId === workerId &&
      event.type === "subagent.started" &&
      event.data?.executionMode === "sync" &&
      event.data?.resumable === false,
  );
  if (!hasLiveSyncStart) return events;
  const sleepBuf = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 25_000;
  while (
    !events.some((event) => event.agentId === workerId && event.type === "subagent.completed") &&
    Date.now() < deadline
  ) {
    Atomics.wait(sleepBuf, 0, 0, 500);
    events = parseEvents(eventsPath);
  }
  return events;
}

/** Extract and atomically publish actual worker evidence; failures leave existing output untouched. */
export function recordReview({
  events: eventsPath,
  workerId,
  parentId,
  requestId,
  output,
  root = process.cwd(),
  refreshContractCache = false,
}) {
  requireEvidence(!refreshContractCache, "Review metadata cannot be refreshed after dispatch");
  requireEvidence(nonempty(eventsPath), "Explicit --events is required; newest-session discovery is not supported");
  root = fs.realpathSync(root);
  const events = parseEvents(eventsPath);
  if (requestId !== undefined) {
    requireEvidence(nonempty(requestId), "Request ID must be nonempty");
    const resolved = resolveReviewer(events, requestId);
    requireEvidence(workerId === undefined || workerId === resolved.workerId, "Worker differs from request ID");
    requireEvidence(parentId === undefined || parentId === resolved.parentId, "Parent differs from request ID");
    workerId = resolved.workerId;
    parentId = resolved.parentId;
  }
  requireEvidence(nonempty(workerId) && nonempty(parentId), "Supply --request-id or both --worker-id and --parent-id");
  const { input, doc, execution } = extractReview(loadEventsWithFlushWait(eventsPath, workerId), workerId, parentId);
  requireEvidence(
    execution.reviewer === STRUCTURED_REVIEWER,
    "New recordings require challenger-review-subagent; historical rubber-duck receipts are read-only compatibility",
  );
  normalizeReviewDoc(doc, input, root);
  const target = outputPath(root, input.project_name, output);
  requireEvidence(
    outputPath(root, input.project_name, input.output_path) === target,
    "--output must equal dispatched output_path",
  );
  const artifact = path.resolve(root, input.artifact_path);
  requireEvidence(
    target !== artifact && !target.startsWith(`${artifact}${path.sep}`),
    "Output cannot be a reviewed input",
  );
  const before = fs.existsSync(target) ? fs.readFileSync(target) : null;
  requireEvidence(before === null || input.overwrite === true, "Output exists without explicit overwrite:true");
  doc.review_execution = execution;
  checkReview(input, doc, root);
  const scratch = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.scratch`);
  try {
    fs.writeFileSync(scratch, `${JSON.stringify(doc, null, 2)}\n`, { flag: "wx" });
    checkReview(input, JSON.parse(fs.readFileSync(scratch, "utf8")), root);
    outputPath(root, input.project_name, output);
    const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
    requireEvidence(isDeepStrictEqual(current, before), "Output changed while recording review");
    if (input.overwrite) fs.renameSync(scratch, target);
    else {
      // Hard-link publication is atomic and unlike rename cannot clobber a racing writer.
      fs.linkSync(scratch, target);
      fs.unlinkSync(scratch);
    }
  } finally {
    if (fs.existsSync(scratch)) fs.unlinkSync(scratch);
  }
  return { output: target, review_execution: execution };
}

export function runRecorder(argv = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        events: { type: "string" },
        "worker-id": { type: "string" },
        "parent-id": { type: "string" },
        "request-id": { type: "string" },
        output: { type: "string" },
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      console.log(
        "Usage: record-review.mjs --events /absolute/events.jsonl --output PATH " +
          "(--request-id ID | --worker-id ID --parent-id root|ID)",
      );
      return 0;
    }
    for (const key of ["events", "output"]) requireEvidence(nonempty(values[key]), `Missing --${key}`);
    console.log(
      JSON.stringify(
        recordReview({
          events: values.events,
          workerId: values["worker-id"],
          parentId: values["parent-id"],
          requestId: values["request-id"],
          output: values.output,
        }),
        null,
        2,
      ),
    );
    return 0;
  } catch (error) {
    console.error(`Review recording failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runRecorder();
}
