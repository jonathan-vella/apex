#!/usr/bin/env node
/**
 * Verify a ready-only Copilot SDK worker against its canonical frontmatter.
 * This is routing evidence only: it never authorizes workflow or Azure actions.
 */
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseFrontmatter } from "./_lib/parse-frontmatter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function verifyWorkerReady({ events, frontmatter, catalog, workerId, parentId }) {
  const reasons = [];
  const labels = Array.isArray(frontmatter?.model) ? frontmatter.model : [];
  const expectedModel = labels.length === 1 ? catalog.models?.[labels[0]]?.runtime_id : undefined;
  if (!expectedModel) reasons.push("The single frontmatter model needs an explicit catalog runtime_id.");
  const expectedEffort = frontmatter?.["reasoning-effort"];
  if (!expectedEffort) reasons.push("Frontmatter reasoning-effort is missing.");
  if (!workerId || !parentId) reasons.push("Explicit worker and parent identities are required.");

  const attributed = events.filter((event) => event.agentId === workerId);
  const starts = attributed.filter((event) => event.type === "subagent.started");
  const start = starts.length === 1 ? starts[0].data : undefined;
  if (!start) reasons.push("Exactly one attributed worker start is required.");
  if (typeof start?.toolCallId !== "string" || !start.toolCallId.trim()) {
    reasons.push("Worker start is missing its call identity.");
  }
  if (start?.agentName !== frontmatter?.name) reasons.push("Worker identity does not match the named definition.");
  if (start?.executionMode !== "background") reasons.push("Worker was not started in background mode.");
  if (!["unset", "custom_agent_definition"].includes(start?.taskModelSource)) {
    reasons.push("Caller model overrides or unknown model sources are not permitted.");
  }
  if ((start?.parentId ?? "root") !== parentId) reasons.push("Worker belongs to a different parent.");

  const configured = attributed.filter((event) => event.type === "subagent.configured").at(-1)?.data;
  if (configured?.multiTurn !== true) reasons.push("Multi-turn continuation is not configured.");
  if (configured?.model !== expectedModel) reasons.push("Configured model differs from the required runtime ID.");
  if (configured?.reasoningEffort !== expectedEffort) reasons.push("Configured effort differs from frontmatter.");

  const completed = attributed
    .filter((event) => event.type === "subagent.completed" && event.data?.toolCallId === start?.toolCallId)
    .at(-1)?.data;
  if (!completed) reasons.push("The ready-only turn has not completed.");
  if (completed?.firstDispatchedModel !== expectedModel) reasons.push("Actual dispatched model differs or is unknown.");
  const legacyAttribution =
    start?.taskModelSource === "unset" && completed?.modelSelectionSource === "agent_definition";
  const currentAttribution =
    start?.taskModelSource === "custom_agent_definition" &&
    completed?.modelSelectionSource === "agent_definition_default";
  if (!legacyAttribution && !currentAttribution) {
    reasons.push("Routing was not attributed to the agent definition.");
  }
  if (currentAttribution) {
    const dispatches = events.filter(
      (event) => event.type === "tool.execution_start" && event.data?.toolCallId === start?.toolCallId,
    );
    const dispatch = dispatches.length === 1 ? dispatches[0] : undefined;
    const args = dispatch?.data?.arguments;
    if (
      !dispatch ||
      dispatch.data?.toolName !== "task" ||
      (dispatch.agentId ?? "root") !== parentId ||
      !args ||
      typeof args !== "object" ||
      Array.isArray(args) ||
      args.agent_type !== frontmatter?.name ||
      args.mode !== "background" ||
      ["model", "reasoning_effort", "context_tier"].some((key) => Object.hasOwn(args, key))
    ) {
      reasons.push("Current SDK attribution requires one matching override-free parent task dispatch.");
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
    status: reasons.length ? "BLOCKED" : "MODEL_VERIFIED",
    worker_id: workerId,
    parent_id: parentId,
    agent: frontmatter?.name ?? null,
    expected_model: expectedModel ?? null,
    actual_model: completed?.firstDispatchedModel ?? null,
    expected_effort: expectedEffort ?? null,
    reasons,
    permission_granted_by_this_record: false,
  };
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
        help: { type: "boolean" },
      },
      strict: true,
    });
    if (values.help) {
      console.log(
        "Usage: node tools/scripts/verify-worker-ready.mjs --events /absolute/events.jsonl " +
          "--definition .github/agents/02-requirements.agent.md --worker-id ID --parent-id root|ID\n" +
          "Run only after a tool-free WORKER_READY turn. MODEL_VERIFIED is not gate or deployment approval.",
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
      catalog: JSON.parse(readFileSync(path.join(root, ".github/model-catalog.json"), "utf8")),
      workerId: values["worker-id"],
      parentId: values["parent-id"],
    });
    console.log(JSON.stringify(result, null, 2));
    return result.status === "MODEL_VERIFIED" ? 0 : 1;
  } catch (error) {
    console.error(`Worker readiness verification failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runValidator();
}
