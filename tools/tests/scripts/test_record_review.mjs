import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { extractReview, recordReview } from "../../scripts/record-review.mjs";
import {
  cacheInputs,
  findingId,
  ONE_SHOT_REVIEW_CONTRACT,
  STRUCTURED_REVIEWER,
  STRUCTURED_REVIEWER_DEFINITION,
  validateReview,
} from "../../scripts/validate-challenger-findings.mjs";

const validator = fileURLToPath(new URL("../../scripts/validate-challenger-findings.mjs", import.meta.url));
const recorder = fileURLToPath(new URL("../../scripts/record-review.mjs", import.meta.url));
const artifact = "agent-output/example/01-requirements.md";
const output = "agent-output/example/challenge-findings-requirements.json";
const hash = (value) => createHash("sha256").update(value).digest("hex");

function fixture(t, { batch = false, supporting = false, parent = "root", reviewer = STRUCTURED_REVIEWER } = {}) {
  const root = path.resolve(`.record-review-test-${randomUUID()}`);
  fs.mkdirSync(root);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, contents) => {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  };
  write(artifact, "# Requirements\nIndependent fixture bytes\n");
  write(ONE_SHOT_REVIEW_CONTRACT, "# One-shot contract\n");
  write(".github/skills/apex-azure-defaults/references/adversarial-checklists.md", "Checklists\n");
  write(".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md", "Protocol\n");
  write(".github/agents/_subagents/challenger-review-subagent.agent.md", "---\nname: legacy\n---\nLegacy\n");
  const input = {
    request_id: "request-1",
    step: "2",
    review_depth: "default",
    artifact_path: artifact,
    project_name: "example",
    artifact_type: "requirements",
    ...(batch
      ? {
          lenses: [
            { review_focus: "comprehensive", pass_number: 1 },
            { review_focus: "cost-feasibility", pass_number: 2 },
          ],
        }
      : { review_focus: "comprehensive", pass_number: 1 }),
    output_path: output,
    overwrite: false,
    prior_findings: null,
    cache_inputs: cacheInputs(artifact, root, reviewer),
    instructions: "## Inputs\nRead fixture\n## Activities\nReview independently\n## Outputs\nReturn JSON",
  };
  if (supporting) {
    const support = "agent-output/example/approved-context.md";
    write(support, "Immutable context\n");
    input.supporting_inputs = [{ path: support, sha256: hash("Immutable context\n") }];
  }
  const entry = (lens) => ({
    schema_version: "1.0",
    challenged_artifact: artifact,
    artifact_type: input.artifact_type,
    review_focus: lens.review_focus,
    pass_number: lens.pass_number,
    overall_assessment: "APPROVED",
    risk_level: "low",
    must_fix_count: 0,
    should_fix_count: 0,
    suggestion_count: 0,
    findings: [],
    cache_inputs: structuredClone(input.cache_inputs),
    ...(supporting ? { supporting_inputs: structuredClone(input.supporting_inputs) } : {}),
  });
  const doc = batch ? { batch_results: input.lenses.map(entry) } : entry(input);
  const attribution = { turnId: "0", interactionId: "review-interaction", parentToolCallId: "call-1" };
  const events = [
    {
      type: "tool.execution_start",
      agentId: parent,
      data: {
        toolCallId: "call-1",
        toolName: "task",
        arguments: { agent_type: reviewer, mode: "sync", prompt: "" },
      },
    },
    {
      type: "subagent.started",
      agentId: "worker-1",
      data: { toolCallId: "call-1", agentName: reviewer, parentId: parent, executionMode: "sync" },
    },
    { type: "subagent.configured", agentId: "worker-1", data: { multiTurn: false } },
    {
      type: "user.message",
      agentId: "worker-1",
      data: { ...attribution, source: "session", parentAgentTaskId: "task-session", content: "" },
    },
    { type: "assistant.turn_start", agentId: "worker-1", data: { ...attribution } },
    { type: "assistant.message", agentId: "worker-1", data: { ...attribution, content: "", toolRequests: [] } },
    { type: "assistant.turn_end", agentId: "worker-1", data: { ...attribution } },
    {
      type: "subagent.completed",
      agentId: "worker-1",
      timestamp: "2026-10-17T15:00:00.000Z",
      data: { toolCallId: "call-1", totalToolCalls: 0 },
    },
    {
      type: "tool.execution_complete",
      agentId: parent,
      data: { toolCallId: "call-1", success: true },
    },
  ];
  const state = {
    root,
    input,
    doc,
    events,
    response: events[5],
    write,
    entry: batch ? doc.batch_results[0] : doc,
    options: { root, events: path.join(root, "events.jsonl"), workerId: "worker-1", parentId: parent, output },
    flush() {
      events[0].data.arguments.prompt = `APEX_REVIEW\n${JSON.stringify(input)}`;
      events.find((event) => event.type === "user.message").data.content = events[0].data.arguments.prompt;
      this.response.data.content = JSON.stringify(doc);
      write("events.jsonl", events.map((event) => JSON.stringify(event)).join("\n"));
    },
    record() {
      this.flush();
      return recordReview(this.options);
    },
    persisted() {
      return JSON.parse(fs.readFileSync(path.join(root, this.options.output), "utf8"));
    },
  };
  return state;
}

function addReadTurns(f, count = 7) {
  const response = f.events.find((event) => event.type === "assistant.message");
  const attribution = response.data;
  const reads = [];
  for (let index = 0; index < count; index++) {
    const data = { ...attribution, turnId: String(index) };
    delete data.content;
    delete data.toolRequests;
    const call = `read-${index}`;
    const tool = { turnId: data.turnId, parentToolCallId: data.parentToolCallId, toolCallId: call };
    reads.push(
      { type: "assistant.turn_start", agentId: "worker-1", data: { ...data } },
      {
        type: "assistant.message",
        agentId: "worker-1",
        data: { ...data, content: "Reading review inputs", toolRequests: [{ name: "view", toolCallId: call }] },
      },
      { type: "tool.execution_start", agentId: "worker-1", data: { ...tool, toolName: "view" } },
      {
        type: "tool.execution_complete",
        agentId: "worker-1",
        data: { ...tool, interactionId: data.interactionId, success: true },
      },
      {
        type: "assistant.turn_end",
        agentId: "worker-1",
        data: { turnId: data.turnId, parentToolCallId: data.parentToolCallId },
      },
    );
  }
  for (const event of f.events.filter((event) => event.type.startsWith("assistant."))) {
    event.data.turnId = String(count);
  }
  f.events.splice(4, 0, ...reads);
}

test("omitted task mode is accepted only with attributed synchronous runtime execution", (t) => {
  const f = fixture(t);
  delete f.events[0].data.arguments.mode;
  f.record();
  assert.equal(f.persisted().review_execution.worker_id, "worker-1");
});

test("one synchronous review may contain eight linked internal tool turns", (t) => {
  const f = fixture(t, { parent: "requirements-worker" });
  delete f.events[0].data.arguments.mode;
  addReadTurns(f);
  f.record();
  assert.equal(f.events.filter((event) => event.type === "assistant.turn_start").length, 8);
  assert.deepEqual(f.persisted().findings, []);
});

test("parallel reads may finish out of order inside one attributed internal turn", (t) => {
  const f = fixture(t);
  addReadTurns(f);
  const request = f.events[5];
  request.data.toolRequests.push({ name: "view", toolCallId: "parallel-read" });
  f.events.splice(7, 0, {
    ...structuredClone(f.events[6]),
    data: { ...f.events[6].data, toolCallId: "parallel-read" },
  });
  f.events.splice(8, 0, {
    ...structuredClone(f.events[8]),
    data: { ...f.events[8].data, toolCallId: "parallel-read" },
  });
  f.record();
  assert.deepEqual(f.persisted().findings, []);
});

test("prose-wrapped or fenced final output is extracted when it contains one unambiguous review JSON object", (t) => {
  const f = fixture(t);
  delete f.events[0].data.arguments.mode;
  addReadTurns(f);
  f.flush();
  f.response.data.content = `Review complete.\n\`\`\`json\n${JSON.stringify(f.doc)}\n\`\`\`\nDone.`;
  f.write("events.jsonl", f.events.map((event) => JSON.stringify(event)).join("\n"));
  recordReview(f.options);
  assert.deepEqual(f.persisted().findings, []);
});

for (const [label, mutate] of [
  ["overlapping turns", (events) => events.splice(8, 1)],
  ["duplicate turn identity", (events) => (events[9].data.turnId = "0")],
  ["wrong intermediate interaction", (events) => (events[5].data.interactionId = "other")],
  ["wrong intermediate dispatch linkage", (events) => (events[8].data.parentToolCallId = "other")],
  ["tool crosses turn boundary", (events) => ([events[7], events[8]] = [events[8], events[7]])],
  ["wrong tool turn identity", (events) => (events[6].data.turnId = "7")],
  ["wrong tool dispatch linkage", (events) => (events[6].data.parentToolCallId = "other")],
  ["wrong tool completion interaction", (events) => (events[7].data.interactionId = "other")],
  ["extra user continuation", (events) => events.splice(9, 0, structuredClone(events[3]))],
  ["missing final turn end", (events) => events.splice(-3, 1)],
]) {
  test(`multi-turn review fails closed: ${label}`, (t) => {
    const f = fixture(t);
    addReadTurns(f);
    f.input.overwrite = true;
    f.write(output, "Original bytes\n");
    mutate(f.events);
    assert.throws(() => f.record());
    assert.equal(fs.readFileSync(path.join(f.root, output), "utf8"), "Original bytes\n");
  });
}

test("one-shot records actual raw findings and execution with absent model metadata", (t) => {
  const f = fixture(t, { supporting: true });
  const finding = {
    category: "evidence",
    claim: "Keep an operational note",
    artifact_section: "Requirements",
    severity: "suggestion",
    evidence: "Fixture",
    impact: "Clarity",
    traces_to: [],
  };
  finding.id = findingId(finding);
  f.doc.findings.push(finding);
  f.doc.suggestion_count = 1;
  const result = f.record();
  const saved = f.persisted();
  assert.deepEqual(saved, { ...f.doc, review_execution: result.review_execution });
  assert.deepEqual(saved.review_execution, {
    reviewer: STRUCTURED_REVIEWER,
    worker_id: "worker-1",
    parent_id: "root",
    tool_call_id: "call-1",
    completed_at: "2026-10-17T15:00:00.000Z",
    request_id: "request-1",
    step: "2",
    review_depth: "default",
    project_name: "example",
  });
  assert.deepEqual(validateReview(saved, { root: f.root, verifyCurrent: true }), []);
  const checked = spawnSync(process.execPath, [validator, "--path", output, "--verify-cache"], {
    cwd: f.root,
    encoding: "utf8",
  });
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
});

test("direct reviewer JSON needs no executable draft and retains literal text during normalization", (t) => {
  const f = fixture(t);
  const finding = {
    severity: "must_fix",
    category: "requirements",
    claim: "An acceptance criterion is missing",
    evidence: "Literal request text contains \"$(not-a-command)\", `labels`, and 'quotes'",
    impact: "Acceptance cannot be measured",
    artifact_section: "Requirements",
    traces_to: ["Requirements checklist"],
    suggested_fix: { artifact_path: artifact, proposed_edit: "Define the acceptance criterion" },
  };
  f.doc.findings = [finding];
  f.doc.overall_assessment = "NEEDS_REVISION";
  for (const key of ["must_fix_count", "should_fix_count", "suggestion_count"]) delete f.doc[key];
  const result = f.record();
  assert.deepEqual(f.persisted(), {
    ...f.doc,
    must_fix_count: 1,
    should_fix_count: 0,
    suggestion_count: 0,
    findings: [{ ...finding, id: findingId(finding) }],
    review_execution: result.review_execution,
  });
  assert.equal(Object.hasOwn(f.doc.findings[0], "id"), false);
  assert.equal(
    f.events.some((event) => event.agentId === "worker-1" && event.type === "tool.execution_start"),
    false,
  );
});

test("direct reviewer JSON with malformed substantive fields still fails recording", (t) => {
  const f = fixture(t);
  f.doc.findings = [
    {
      severity: "suggestion",
      category: "requirements",
      claim: "An acceptance criterion is missing",
      evidence: "Fixture artifact",
      impact: "Acceptance cannot be measured",
      artifact_section: "Requirements",
      traces_to: { unexpected: "Requirements checklist" },
    },
  ];
  assert.throws(() => f.record(), /traces_to must be an array/);
  assert.equal(fs.existsSync(path.join(f.root, output)), false);
});

test("automatic review guidance requests direct JSON rather than shell serialization", () => {
  const contract = fs.readFileSync(ONE_SHOT_REVIEW_CONTRACT, "utf8");
  const example = JSON.parse(contract.match(/```json\n([\s\S]+?)\n\s*```/)[1]);
  assert.match(example.instructions, /No shell commands, code execution/);
  assert.match(example.instructions, /Omit finding IDs and severity counts/);
  assert.doesNotMatch(contract, /node --input-type=module -e|```javascript|successful stdout/);
  for (const agent of ["02-requirements", "03-architect", "04-design", "04g-governance", "05-iac-planner"]) {
    const body = fs.readFileSync(`.github/agents/${agent}.agent.md`, "utf8");
    assert.match(body, /without shell\/code execution/, agent);
    assert.doesNotMatch(body, /in-memory.*finalization|schema\/finalization/, agent);
  }
  const checklist = fs.readFileSync(".github/skills/apex-azure-defaults/references/adversarial-checklists.md", "utf8");
  assert.match(checklist, /actual workflow stage/);
  assert.match(checklist, /Azure Budget is notification-based, not a hard spending cap/);
});

test("a blocked reviewer command stays invalid even after a successful command and valid JSON", (t) => {
  const f = fixture(t);
  addReadTurns(f, 2);
  for (const event of f.events.filter(
    (event) => event.type === "tool.execution_start" && event.agentId === "worker-1",
  )) {
    event.data.toolName = "bash";
  }
  const blocked = f.events.find((event) => event.type === "tool.execution_complete" && event.agentId === "worker-1");
  blocked.data.success = false;
  blocked.data.error = { message: "Command blocked by execution safety check", code: "failure" };
  assert.throws(() => f.record(), /Worker tool calls must complete successfully/);
  assert.equal(fs.existsSync(path.join(f.root, output)), false);
});

test("IaC code directories publish canonical pass evidence and invalidate on changed nested bytes", (t) => {
  for (const [track, extension] of [
    ["bicep", "bicep"],
    ["terraform", "tf"],
  ]) {
    const f = fixture(t);
    const directory = `infra/${track}/example`;
    const nested = `${directory}/modules/fixture.${extension}`;
    f.write(`${directory}/main.${extension}`, "// Fixture entry bytes\n");
    f.write(nested, "// Fixture module bytes\n");
    f.input.step = "5";
    f.input.artifact_path = f.doc.challenged_artifact = directory;
    f.input.artifact_type = f.doc.artifact_type = "iac-code";
    f.input.output_path = f.options.output = "agent-output/example/challenge-findings-iac-code-pass1.json";
    f.input.cache_inputs = cacheInputs(directory, f.root, STRUCTURED_REVIEWER);
    f.doc.cache_inputs = structuredClone(f.input.cache_inputs);
    f.record();
    const saved = f.persisted();
    const originalBytes = fs.readFileSync(path.join(f.root, f.options.output));
    assert.equal(saved.challenged_artifact, directory);
    assert.equal(saved.pass_number, 1);
    assert.equal(saved.review_execution.step, "5");
    assert.deepEqual(validateReview(saved, { root: f.root, verifyCurrent: true }), []);
    f.write(nested, "// Changed fixture module bytes\n");
    assert.match(
      validateReview(saved, { root: f.root, verifyCurrent: true }).join("\n"),
      /stale cache_inputs.artifact_sha/,
    );
    f.input.overwrite = true;
    assert.throws(() => f.record(), /current artifact/);
    assert.deepEqual(fs.readFileSync(path.join(f.root, f.options.output)), originalBytes);
  }
});

test("differing model telemetry and a non-root exact parent are accepted", (t) => {
  const f = fixture(t, { parent: "requirements-worker" });
  f.events[1].data.model = "auto";
  f.events[2].data.model = "different-model";
  f.events[5].data.model = "hydrafusion";
  f.events[7].data.firstDispatchedModel = "another-model";
  f.record();
  assert.equal(f.persisted().review_execution.parent_id, "requirements-worker");
});

test("one-shot does not require multi-turn metadata and permits completed independent read tools", (t) => {
  const f = fixture(t);
  delete f.events[2].data.multiTurn;
  const response = f.events[5];
  const readRequest = {
    ...structuredClone(response),
    data: { ...response.data, content: "", toolRequests: [{ name: "view", toolCallId: "read-call" }] },
  };
  f.events.splice(
    5,
    0,
    readRequest,
    { type: "tool.execution_start", agentId: "worker-1", data: { toolCallId: "read-call", toolName: "view" } },
    { type: "tool.execution_complete", agentId: "worker-1", data: { toolCallId: "read-call", success: true } },
  );
  f.flush();
  readRequest.data.content = "";
  response.data.content = JSON.stringify(f.doc);
  f.write("events.jsonl", f.events.map((event) => JSON.stringify(event)).join("\n"));
  recordReview(f.options);
  assert.deepEqual(f.persisted().findings, []);
});

test("batch lenses and independent calls retain their own identity and pass metadata", (t) => {
  const f = fixture(t, { batch: true });
  f.record();
  assert.deepEqual(f.persisted().batch_results, f.doc.batch_results);
  const other = fixture(t);
  other.input.request_id = "request-2";
  other.input.review_focus = other.doc.review_focus = "cost-feasibility";
  other.input.pass_number = other.doc.pass_number = 3;
  other.input.review_depth = "deep";
  other.record();
  assert.equal(other.persisted().review_execution.request_id, "request-2");
  assert.equal(other.persisted().review_focus, "cost-feasibility");
  assert.equal(other.persisted().pass_number, 3);
});

test("independent calls in one log cannot borrow each other's response or dispatch", (t) => {
  const first = fixture(t);
  const second = fixture(t);
  second.input.request_id = "cost-review";
  second.input.output_path = "agent-output/example/challenge-findings-cost.json";
  second.input.review_focus = second.doc.review_focus = "cost-feasibility";
  second.flush();
  for (const event of second.events) {
    if (event.agentId === "worker-1") event.agentId = "worker-2";
    if (event.data.toolCallId === "call-1") event.data.toolCallId = "call-2";
    if (event.data.parentToolCallId === "call-1") event.data.parentToolCallId = "call-2";
  }
  first.events.push(...second.events);
  first.record();
  recordReview({ ...first.options, workerId: "worker-2", output: second.input.output_path });
  const cost = JSON.parse(fs.readFileSync(path.join(first.root, second.input.output_path), "utf8"));
  assert.equal(cost.review_execution.worker_id, "worker-2");
  assert.equal(cost.review_execution.tool_call_id, "call-2");
  assert.equal(cost.review_focus, "cost-feasibility");
  assert.equal(first.persisted().review_focus, "comprehensive");
});

test("legacy metadata is unchanged and new metadata hashes the actual reviewer contract", (t) => {
  const f = fixture(t);
  const old = cacheInputs(artifact, f.root);
  const expected = {
    artifact_sha: hash(fs.readFileSync(path.join(f.root, artifact))),
    checklists_sha: hash("Checklists\n"),
    protocol_sha: hash("Protocol\n"),
    subagent_sha: hash("---\nname: legacy\n---\nLegacy\n"),
    model_policy: "runtime-managed",
  };
  assert.deepEqual(old, { ...expected, artifact_hash: hash(Object.values(expected).join("\n---\n")) });
  const oldDoc = { ...f.doc, cache_inputs: old };
  assert.deepEqual(validateReview(oldDoc, { root: f.root, verifyCurrent: true }), []);
  assert.equal(Object.hasOwn(oldDoc, "review_execution"), false);
  assert.equal(f.input.cache_inputs.reviewer_contract, ONE_SHOT_REVIEW_CONTRACT);
  assert.equal(f.input.cache_inputs.reviewer_contract_sha, hash("# One-shot contract\n"));
  assert.equal(f.input.cache_inputs.reviewer_definition, STRUCTURED_REVIEWER_DEFINITION);
  assert.equal(f.input.cache_inputs.reviewer_definition_sha, hash("---\nname: legacy\n---\nLegacy\n"));
  assert.equal(Object.hasOwn(f.input.cache_inputs, "subagent_sha"), false);
  assert.throws(() => cacheInputs(artifact, f.root, "unknown"), /Unknown reviewer/);
  const checked = spawnSync(process.execPath, [validator, "--metadata", artifact, "--reviewer", STRUCTURED_REVIEWER], {
    cwd: f.root,
    encoding: "utf8",
  });
  assert.equal(checked.status, 0, checked.stderr);
  assert.deepEqual(JSON.parse(checked.stdout).cache_inputs, f.input.cache_inputs);
  assert.equal(
    spawnSync(process.execPath, [validator, "--metadata", artifact, "--reviewer", "unknown"], {
      cwd: f.root,
      encoding: "utf8",
    }).status,
    1,
  );
  f.write(".github/agents/_subagents/challenger-review-subagent.agent.md", "---\nmodel:\n  - legacy-model\n---\n");
  const pinned = cacheInputs(artifact, f.root);
  assert.equal(pinned.model, "legacy-model");
  assert.equal(pinned.model_policy, "legacy-pinned");
});

test("historical native rubber-duck receipts keep their actual identity and reader", (t) => {
  const f = fixture(t, { reviewer: "rubber-duck" });
  f.flush();
  const extracted = extractReview(f.events, "worker-1", "root");
  const saved = { ...f.doc, review_execution: extracted.execution };
  assert.equal(saved.review_execution.reviewer, "rubber-duck");
  assert.equal(saved.cache_inputs.reviewer, "rubber-duck");
  assert.equal(Object.hasOwn(saved.cache_inputs, "reviewer_definition_sha"), false);
  assert.deepEqual(validateReview(saved, { root: f.root, verifyCurrent: true }), []);
  assert.throws(() => f.record(), /historical rubber-duck receipts are read-only compatibility/);
  assert.equal(fs.existsSync(path.join(f.root, output)), false);
});

for (const failure of [
  { status: "FAILED", stage: "inputs", error: "Required artifact is unavailable" },
  { status: "FAILED", error: "Missing failure stage" },
]) {
  test(`structured execution failure stays explicit and unpublished: ${failure.error}`, (t) => {
    const f = fixture(t);
    f.flush();
    f.response.data.content = JSON.stringify(failure);
    f.write("events.jsonl", f.events.map((event) => JSON.stringify(event)).join("\n"));
    assert.throws(
      () => recordReview(f.options),
      failure.stage
        ? /Reviewer execution failed at inputs: Required artifact is unavailable/
        : /requires stage and error/,
    );
    assert.equal(fs.existsSync(path.join(f.root, output)), false);
  });
}

for (const [label, mutate] of [
  ["actual reviewer identity", (f) => (f.events[1].data.agentName = "rubber-duck")],
  [
    "metadata reviewer identity",
    (f) => {
      f.input.cache_inputs = cacheInputs(artifact, f.root, "rubber-duck");
      f.doc.cache_inputs = structuredClone(f.input.cache_inputs);
    },
  ],
  [
    "legacy metadata downgrade",
    (f) => {
      f.input.cache_inputs = cacheInputs(artifact, f.root);
      f.doc.cache_inputs = structuredClone(f.input.cache_inputs);
    },
  ],
]) {
  test(`structured recording rejects ${label} drift without publishing`, (t) => {
    const f = fixture(t);
    mutate(f);
    assert.throws(() => f.record());
    assert.equal(fs.existsSync(path.join(f.root, output)), false);
  });
}

for (const [source, field] of [
  [STRUCTURED_REVIEWER_DEFINITION, "reviewer_definition_sha"],
  [ONE_SHOT_REVIEW_CONTRACT, "reviewer_contract_sha"],
]) {
  test(`structured freshness independently binds ${field}`, (t) => {
    const f = fixture(t);
    f.record();
    const saved = f.persisted();
    const before = fs.readFileSync(path.join(f.root, output), "utf8");
    fs.appendFileSync(path.join(f.root, source), "\nChanged contract bytes\n");
    assert.match(validateReview(saved, { root: f.root, verifyCurrent: true }).join("\n"), new RegExp(field));
    assert.equal(fs.readFileSync(path.join(f.root, output), "utf8"), before);
  });
}

const invalidCases = [
  ["wrong worker identity", (f) => (f.options.workerId = "other")],
  ["wrong parent identity", (f) => (f.options.parentId = "other")],
  ["missing explicit parent", (f) => delete f.events[1].data.parentId],
  ["wrong start agent", (f) => (f.events[1].data.agentName = "general-purpose")],
  ["background call", (f) => (f.events[0].data.arguments.mode = "background")],
  ["null task mode", (f) => (f.events[0].data.arguments.mode = null)],
  ["background runtime", (f) => (f.events[1].data.executionMode = "background")],
  ["unknown runtime mode", (f) => delete f.events[1].data.executionMode],
  ["wrong dispatched agent", (f) => (f.events[0].data.arguments.agent_type = "task")],
  ["wrong dispatch parent", (f) => (f.events[0].agentId = "other")],
  ["wrong tool", (f) => (f.events[0].data.toolName = "other")],
  ["wrong completion call", (f) => (f.events[7].data.toolCallId = "other")],
  ["unattributed completion", (f) => delete f.events[7].agentId],
  ["unattributed configuration", (f) => (f.events[2].agentId = "other")],
  ["multiturn configuration", (f) => (f.events[2].data.multiTurn = true)],
  ["missing completion timestamp", (f) => delete f.events[7].timestamp],
  ["failed task", (f) => (f.events[8].data.success = false)],
  ["failed worker", (f) => (f.events[7].data.error = "failed")],
  ["wrong interaction", (f) => (f.events[5].data.interactionId = "other")],
  ["wrong response linkage", (f) => (f.events[5].data.parentToolCallId = "other")],
  ["wrong turn-end interaction", (f) => (f.events[6].data.interactionId = "other")],
  ["incomplete interaction", (f) => f.events.splice(6, 1)],
  ["incomplete dispatch", (f) => f.events.pop()],
  ["misordered interaction", (f) => ([f.events[4], f.events[5]] = [f.events[5], f.events[4]])],
  ["duplicate completion", (f) => f.events.push(structuredClone(f.events[7]))],
  ["duplicate dispatch", (f) => f.events.push(structuredClone(f.events[0]))],
  ["ambiguous worker for dispatch", (f) => f.events.push({ ...structuredClone(f.events[1]), agentId: "other-worker" })],
  ["wrong artifact", (f) => (f.entry.challenged_artifact = "other.md")],
  ["wrong artifact type", (f) => (f.entry.artifact_type = "architecture")],
  ["wrong lens", (f) => (f.entry.review_focus = "cost-feasibility")],
  ["wrong pass", (f) => (f.entry.pass_number = 2)],
  ["wrong cache", (f) => (f.entry.cache_inputs.artifact_hash = "other")],
  ["missing request identity", (f) => delete f.input.request_id],
  ["missing step", (f) => delete f.input.step],
  ["unknown depth", (f) => (f.input.review_depth = "automatic")],
  ["missing overwrite authorization", (f) => delete f.input.overwrite],
  ["missing prior findings", (f) => delete f.input.prior_findings],
  ["missing verdict", (f) => delete f.entry.overall_assessment],
  ["malformed verdict", (f) => (f.entry.overall_assessment = "passed")],
  ["empty risk", (f) => (f.entry.risk_level = "")],
  ["wrong schema", (f) => (f.entry.schema_version = "2.0")],
  ["fabricated provenance", (f) => (f.doc.review_execution = { reviewer: "rubber-duck" })],
  ["changed artifact", (f) => f.write(artifact, "Changed during review\n")],
  ["changed contract", (f) => f.write(ONE_SHOT_REVIEW_CONTRACT, "Changed during review\n")],
  ["unknown cached reviewer", (f) => (f.entry.cache_inputs.reviewer = "other")],
  ["wrong supporting data", (f) => (f.entry.supporting_inputs = [{ path: "other.md", sha256: "0".repeat(64) }])],
  ["output mismatch", (f) => (f.options.output = "agent-output/example/other.json")],
  ["output traversal", (f) => (f.options.output = "../outside.json")],
  ["output in a different project", (f) => (f.options.output = "agent-output/other/review.json")],
  ["internal output traversal", (f) => (f.options.output = "agent-output/example/nested/../review.json")],
  ["project traversal", (f) => (f.input.project_name = "../example")],
  [
    "child worker",
    (f) => f.events.push({ type: "subagent.started", agentId: "child", data: { parentId: "worker-1" } }),
  ],
  [
    "nested task",
    (f) => f.events.splice(6, 0, { type: "tool.execution_start", agentId: "worker-1", data: { toolName: "task" } }),
  ],
  ["nested tool request", (f) => (f.events[5].data.toolRequests = [{ name: "write_agent" }])],
  [
    "incomplete worker read",
    (f) =>
      f.events.splice(6, 0, {
        type: "tool.execution_start",
        agentId: "worker-1",
        data: { toolName: "view", toolCallId: "read-call" },
      }),
  ],
  [
    "worker execution error",
    (f) => f.events.splice(6, 0, { type: "session.error", agentId: "worker-1", data: { message: "Failed" } }),
  ],
];
for (const key of ["model", "reasoning_effort", "context_tier"])
  invalidCases.push([`caller ${key} override`, (f) => (f.events[0].data.arguments[key] = null)]);
for (const [label, mutate] of invalidCases) {
  test(`fails closed: ${label}`, (t) => {
    const f = fixture(t);
    f.input.overwrite = true;
    f.write(output, "Original bytes\n");
    mutate(f);
    assert.throws(() => f.record());
    assert.equal(fs.readFileSync(path.join(f.root, output), "utf8"), "Original bytes\n");
    assert.equal(
      fs.readdirSync(path.join(f.root, "agent-output/example")).some((name) => name.endsWith(".scratch")),
      false,
    );
  });
}

test("malformed, empty, fenced and ambiguous final outputs are rejected", (t) => {
  const f = fixture(t);
  for (const content of ["", "not JSON", "{}", "null", "[]", "```json\n{}\n```", "{}\n{}"]) {
    f.flush();
    f.events[5].data.content = content;
    f.write("events.jsonl", f.events.map((event) => JSON.stringify(event)).join("\n"));
    assert.throws(() => recordReview(f.options), content);
  }
  f.flush();
  f.events.splice(6, 0, structuredClone(f.events[5]));
  f.write("events.jsonl", f.events.map((event) => JSON.stringify(event)).join("\n"));
  assert.throws(() => recordReview(f.options), /unambiguous/);
  assert.equal(fs.existsSync(path.join(f.root, output)), false);
});

test("batch omissions, reordering and duplicate requests cannot collapse independent lenses", (t) => {
  const f = fixture(t, { batch: true });
  f.doc.batch_results.reverse();
  assert.throws(() => f.record(), /differ from dispatch/);
  f.doc.batch_results.reverse();
  f.doc.batch_results.pop();
  assert.throws(() => f.record(), /requested batch/);
  f.input.lenses[1] = { ...f.input.lenses[0] };
  assert.throws(() => f.record(), /unambiguous/);
});

test("supporting bytes, mutable supporting inputs and missing execution fail strict freshness", (t) => {
  const f = fixture(t, { supporting: true });
  f.write(f.input.supporting_inputs[0].path, "Altered\n");
  assert.throws(() => f.record(), /supporting bytes changed/);
  f.write("agent-output/example/sku-manifest.json", "{}");
  f.input.supporting_inputs = [{ path: "agent-output/example/sku-manifest.json", sha256: hash("{}") }];
  f.doc.supporting_inputs = structuredClone(f.input.supporting_inputs);
  assert.throws(() => f.record(), /mutable parent-owned/);
  assert.match(validateReview(f.doc, { root: f.root, verifyCurrent: true }).join("\n"), /review_execution/);
});

test("strict new records cannot claim legacy reviewer hashes or incomplete execution provenance", (t) => {
  const f = fixture(t);
  f.record();
  const doc = f.persisted();
  doc.cache_inputs.subagent_sha = "0".repeat(64);
  assert.match(validateReview(doc, { root: f.root, verifyCurrent: true }).join("\n"), /legacy subagent_sha/);
  delete doc.cache_inputs.subagent_sha;
  for (const key of ["worker_id", "parent_id", "tool_call_id", "completed_at", "request_id", "step", "review_depth"]) {
    const invalid = structuredClone(doc);
    delete invalid.review_execution[key];
    assert.match(validateReview(invalid, { root: f.root, verifyCurrent: true }).join("\n"), /provenance/);
  }
  doc.cache_inputs.reviewer = "other";
  assert.match(validateReview(doc, { root: f.root, verifyCurrent: true }).join("\n"), /Unknown reviewer/);
});

test("recorder normalizes finding IDs, counts, string traces_to and recovered read errors without changing review claims", (t) => {
  const f = fixture(t);
  addReadTurns(f, 2);
  const failedRead = f.events.find((event) => event.type === "tool.execution_complete" && event.agentId === "worker-1");
  failedRead.data.success = false;
  failedRead.data.error = { message: "view_range out of bounds", code: "failure" };
  for (const event of f.events.filter(
    (event) => event.type === "tool.execution_start" && event.data.toolName === "view",
  ))
    event.data.arguments = { path: artifact };
  f.doc.findings = [
    {
      id: "00000000",
      severity: "should_fix",
      category: "test",
      claim: "A claim",
      evidence: "Actual evidence",
      impact: "Impact",
      artifact_section: "Section",
      traces_to: "Section 1",
    },
  ];
  f.doc.should_fix_count = 0;
  f.record();
  const saved = f.persisted();
  assert.equal(saved.should_fix_count, 1);
  assert.deepEqual(saved.findings[0].traces_to, ["Section 1"]);
  assert.equal(saved.findings[0].id, findingId(saved.findings[0]));
  assert.deepEqual(saved.review_execution.recovered_read_calls, ["read-0"]);
});

for (const [label, mutate] of [
  ["unrecovered read", (f) => addReadTurns(f, 1)],
  [
    "failed command",
    (f) => {
      addReadTurns(f, 2);
      f.events.find((e) => e.data?.toolName === "view").data.toolName = "bash";
    },
  ],
  [
    "different retry path",
    (f) => {
      addReadTurns(f, 2);
      const reads = f.events.filter((e) => e.data?.toolName === "view");
      reads[0].data.arguments = { path: artifact };
      reads[1].data.arguments = { path: "other.md" };
    },
  ],
]) {
  test(`failed operations remain blocking: ${label}`, (t) => {
    const f = fixture(t);
    mutate(f);
    const failed = f.events.find((e) => e.type === "tool.execution_complete" && e.agentId === "worker-1");
    failed.data.success = false;
    failed.data.error = { message: "view_range out of bounds" };
    assert.throws(() => f.record(), /must complete successfully/);
  });
}

test("request ID resolves an exact worker in an explicit session without UUID scraping", (t) => {
  const f = fixture(t);
  f.flush();
  recordReview({ ...f.options, workerId: undefined, parentId: undefined, requestId: f.input.request_id });
  assert.equal(f.persisted().review_execution.worker_id, "worker-1");
});

test("request lookup rejects ambiguity, wrong identity and missing session instead of choosing newest", (t) => {
  const f = fixture(t);
  f.flush();
  assert.throws(() => recordReview({ ...f.options, events: undefined }), /Explicit --events/);
  assert.throws(() => recordReview({ ...f.options, requestId: "unknown" }), /exactly one review dispatch/);
  assert.throws(() => recordReview({ ...f.options, requestId: "request-1", workerId: "other" }), /Worker differs/);
  assert.throws(() => recordReview({ ...f.options, requestId: "request-1", parentId: "other" }), /Parent differs/);
  f.events.push(structuredClone(f.events[0]));
  f.flush();
  assert.throws(() => recordReview({ ...f.options, requestId: "request-1" }), /exactly one review dispatch/);
});

test("recording never fills or refreshes missing, stale or conflicting review metadata", (t) => {
  const f = fixture(t);
  f.flush();
  assert.throws(() => recordReview({ ...f.options, refreshContractCache: true }), /cannot be refreshed/);
  f.input.cache_inputs = {};
  f.doc.cache_inputs = {};
  assert.throws(() => f.record(), /Dispatched cache snapshot/);
  f.input.cache_inputs = cacheInputs(artifact, f.root, STRUCTURED_REVIEWER);
  f.doc.cache_inputs = { ...f.input.cache_inputs, protocol_sha: "incorrect" };
  assert.throws(() => f.record(), /cache snapshot/);
  assert.equal(fs.existsSync(path.join(f.root, output)), false);
});

test("existing outputs require dispatch overwrite:true and successful replacement preserves raw findings", (t) => {
  const f = fixture(t);
  f.write(output, "Old bytes\n");
  assert.throws(() => f.record(), /explicit overwrite/);
  assert.equal(fs.readFileSync(path.join(f.root, output), "utf8"), "Old bytes\n");
  f.input.overwrite = true;
  f.record();
  assert.deepEqual(f.persisted().findings, []);
});

test("symlinked output files, parent directories and dangling links cannot escape", (t) => {
  for (const kind of ["file", "parent", "dangling"]) {
    const f = fixture(t);
    f.input.overwrite = true;
    f.write("outside/old.json", "Outside bytes\n");
    const target = path.join(f.root, output);
    if (kind === "parent") {
      fs.symlinkSync(path.join(f.root, "outside"), path.join(f.root, "agent-output/example/link"));
      f.options.output = f.input.output_path = "agent-output/example/link/old.json";
    } else fs.symlinkSync(path.join(f.root, kind === "file" ? "outside/old.json" : "missing"), target);
    assert.throws(() => f.record(), /symlink/);
    assert.equal(fs.readFileSync(path.join(f.root, "outside/old.json"), "utf8"), "Outside bytes\n");
  }
});

test("failed scratch validation and atomic rename preserve original bytes and clean scratch", (t) => {
  const f = fixture(t);
  f.input.overwrite = true;
  f.write(output, "Old bytes\n");
  const originalWrite = fs.writeFileSync;
  const writeMock = t.mock.method(fs, "writeFileSync", (target, ...args) => {
    originalWrite(target, ...args);
    if (String(target).endsWith(".scratch")) f.write(artifact, "Changed before publication\n");
  });
  assert.throws(() => f.record(), /current artifact/);
  assert.equal(fs.readFileSync(path.join(f.root, output), "utf8"), "Old bytes\n");
  writeMock.mock.restore();
  f.write(artifact, "# Requirements\nIndependent fixture bytes\n");
  const renameMock = t.mock.method(fs, "renameSync", () => {
    throw new Error("Injected rename failure");
  });
  assert.throws(() => f.record(), /Injected rename failure/);
  renameMock.mock.restore();
  assert.equal(fs.readFileSync(path.join(f.root, output), "utf8"), "Old bytes\n");
  assert.equal(
    fs.readdirSync(path.join(f.root, "agent-output/example")).some((name) => name.endsWith(".scratch")),
    false,
  );
});

test("no-overwrite publication cannot clobber a racing writer or leave failed scratch files", (t) => {
  const f = fixture(t);
  const linkMock = t.mock.method(fs, "linkSync", () => {
    f.write(output, "Concurrent writer bytes\n");
    const error = new Error("Output already exists");
    error.code = "EEXIST";
    throw error;
  });
  assert.throws(() => f.record(), /already exists/);
  linkMock.mock.restore();
  assert.equal(fs.readFileSync(path.join(f.root, output), "utf8"), "Concurrent writer bytes\n");
  assert.equal(
    fs.readdirSync(path.join(f.root, "agent-output/example")).some((name) => name.endsWith(".scratch")),
    false,
  );
});

test("CLI requires absolute, parseable native events and refuses unknown overrides", (t) => {
  const f = fixture(t);
  f.flush();
  const run = (...extra) =>
    spawnSync(
      process.execPath,
      [
        recorder,
        "--events",
        f.options.events,
        "--worker-id",
        "worker-1",
        "--parent-id",
        "root",
        "--output",
        output,
        ...extra,
      ],
      { cwd: f.root, encoding: "utf8" },
    );
  assert.equal(run("--model", "override").status, 1);
  assert.throws(() => recordReview({ ...f.options, events: "events.jsonl" }), /absolute/);
  f.write("events.jsonl", "{malformed\n");
  assert.match(run().stderr, /Invalid event record/);
  f.flush();
  const result = run();
  assert.equal(result.status, 0, result.stderr);
});
