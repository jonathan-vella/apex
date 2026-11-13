import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { extractReview, recordReview, preflightReviewRequest } from "../../scripts/record-review.mjs";
import {
  cacheInputs,
  findingId,
  ONE_SHOT_REVIEW_CONTRACT,
  STRUCTURED_REVIEWER,
  STRUCTURED_REVIEWER_DEFINITION,
  validateReview,
} from "../../scripts/validate-challenger-findings.mjs";
import { requiredPrivateReviewInputs } from "../../scripts/_lib/project-paths.mjs";
import { supportingInputCompatible } from "../../scripts/_lib/review-compatibility.mjs";
import { canonicalJson } from "../../scripts/_lib/json.mjs";

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

function privatePolicyFixture(t) {
  const f = fixture(t);
  const repo = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
  const stateHome = fs.mkdtempSync(path.join(os.tmpdir(), "private-review-test-"));
  t.after(() => fs.rmSync(stateHome, { recursive: true, force: true }));
  const previousHome = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = stateHome;
  t.after(() => {
    if (previousHome === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = previousHome;
  });
  fs.symlinkSync(path.join(repo, "tools"), path.join(f.root, "tools"));
  const recall = (...args) => {
    const result = spawnSync("python3", ["-m", "apex_recall", ...args], {
      cwd: f.root,
      encoding: "utf8",
      env: { ...process.env, APEX_ROOT: f.root, PYTHONPATH: path.join(repo, "tools/apex-recall/src") },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return JSON.parse(result.stdout);
  };
  recall("init", "example", "--json");
  const scope = recall(
    "policy-source",
    "example",
    "--tenant",
    "11111111-1111-1111-1111-111111111111",
    "--subscription",
    "22222222-2222-2222-2222-222222222222",
    "--authorize-policy-read",
    "--owner",
    "synthetic-owner",
    "--request-id",
    "private-scope-request",
    "--environment",
    "dev",
    "--json",
  );
  const scripts = ".github/skills/apex-azure-governance-discovery/scripts";
  for (const filename of ["discover.py", "render_governance.py"]) {
    f.write(`${scripts}/${filename}`, fs.readFileSync(path.join(repo, scripts, filename)));
  }
  const snapshot = path.join(scope.directory, "subscription-1.json");
  const policy = {
    schema_version: "governance-constraints-v1",
    project: "example",
    subscription_id: "22222222-2222-2222-2222-222222222222",
    discovery_status: "COMPLETE",
    source: "live",
    findings: [],
    discovery_options: { include_defender_auto: true },
    discovery_metadata: {
      discovery_status: "COMPLETE",
      discovered_at: new Date().toISOString(),
      ttl_days: 7,
      scope: { subscription_id: "22222222-2222-2222-2222-222222222222" },
      completeness_signature: `sha256:${hash("")}`,
    },
  };
  policy.discovered_at = policy.discovery_metadata.discovered_at;
  policy.discovery_metadata.page_counts = {
    policyAssignments: 0,
    policyDefinitions: 0,
    policySetDefinitions: 0,
    policyExemptions: 0,
  };
  policy.discovery_summary = { assignment_total: 0, assignment_kept: 0, audit_count: 0, disabled_count: 0 };
  policy.rule_evidence = {
    schema_version: "policy-rule-evidence-v1",
    project: policy.project,
    subscription_id: policy.subscription_id,
    discovered_at: policy.discovered_at,
    assignments: [],
    definitions: [],
    initiatives: [],
    exemptions: [],
    effective_records: [],
    coverage: { assignment_count: 0, effective_record_count: 0, effects: {} },
  };
  policy.discovery_metadata.rule_evidence_sha256 = hash(canonicalJson(policy.rule_evidence));
  fs.writeFileSync(snapshot, JSON.stringify(policy), { mode: 0o600 });
  const canonical = path.join(scope.directory, "04-governance-constraints.json");
  fs.writeFileSync(canonical, JSON.stringify(policy), { mode: 0o600 });
  recall("checkpoint", "example", "1", "policy-evidence", "--policy-feasibility", scope.evidence_path, "--json");
  const primary = "agent-output/example/04-governance-constraints.md";
  f.write(primary, "# Governance\nAnonymized policy summary\n");
  f.write(
    "phase.json",
    JSON.stringify({
      input_ids: ["policy_source", "azure_read_scope"],
      environments: ["dev"],
      request_id: "governance-phase",
    }),
  );
  recall("decide", "example", "--phase-scope", path.join(f.root, "phase.json"), "--step", "3_5", "--json");
  recall("checkpoint", "example", "3_5", "review-ready", "--sync-assessment", "--json");
  const projection = "agent-output/example/_meta/assessment-step-3_5.json";
  const findings = "agent-output/example/reviews/challenge-findings-governance-constraints.json";
  Object.assign(f.input, {
    step: "3_5",
    artifact_path: primary,
    artifact_type: "governance-constraints",
    review_focus: "governance-reconciliation",
    output_path: findings,
    cache_inputs: cacheInputs(primary, f.root, STRUCTURED_REVIEWER),
    supporting_inputs: [
      { path: projection, sha256: hash(fs.readFileSync(path.join(f.root, projection))) },
      ...requiredPrivateReviewInputs(f.root, "example", "governance-constraints"),
    ],
  });
  Object.assign(f.doc, {
    challenged_artifact: primary,
    artifact_type: f.input.artifact_type,
    review_focus: f.input.review_focus,
    cache_inputs: structuredClone(f.input.cache_inputs),
    supporting_inputs: structuredClone(f.input.supporting_inputs),
  });
  f.options.output = findings;
  f.write("request.json", JSON.stringify(f.input));
  return { ...f, recall, snapshot, canonical, findings };
}

test("private rule-body evidence is included in existing Node review hashes", (t) => {
  const f = privatePolicyFixture(t);
  assert.ok(preflightReviewRequest(f.input, f.root).private_inputs.length);
  const policy = JSON.parse(fs.readFileSync(f.canonical, "utf8"));
  policy.rule_evidence.exemptions.push({ id: "synthetic-changed-rule-evidence" });
  fs.writeFileSync(f.canonical, JSON.stringify(policy), { mode: 0o600 });
  assert.throws(() => preflightReviewRequest(f.input, f.root), /changed|supporting/i);
});

test("private Governance review rejects a summary-only canonical snapshot", (t) => {
  const f = privatePolicyFixture(t);
  const policy = JSON.parse(fs.readFileSync(f.canonical, "utf8"));
  delete policy.rule_evidence;
  delete policy.discovery_metadata.rule_evidence_sha256;
  fs.writeFileSync(f.canonical, JSON.stringify(policy), { mode: 0o600 });
  assert.throws(
    () => requiredPrivateReviewInputs(f.root, "example", "governance-constraints"),
    /Private governance rule evidence/,
  );
});

test("private policy evidence is required, attributed, hash-bound and invalidated after drift", (t) => {
  const f = privatePolicyFixture(t);
  const preflight = preflightReviewRequest(f.input, f.root);
  assert.equal(preflight.private_inputs.length, 3);
  assert.equal(
    preflight.private_inputs.some((input) => input.read_path === f.canonical),
    true,
  );
  const request = path.join(f.root, "request.json");
  f.recall(
    "review-audit",
    "example",
    "3_5",
    "--attempt-kind",
    "invocation",
    "--review-request",
    request,
    "--attempt-outcome",
    "started",
    "--json",
  );
  f.record();
  f.recall(
    "review-audit",
    "example",
    "3_5",
    "--attempt-kind",
    "invocation",
    "--review-request",
    request,
    "--attempt-outcome",
    "completed",
    "--review-output",
    "nonempty",
    "--review-result",
    path.join(f.root, f.findings),
    "--json",
  );
  const document = f.persisted();
  assert.deepEqual(validateReview(document, { root: f.root, verifyCurrent: true }), []);
  const original = fs.readFileSync(path.join(f.root, f.findings), "utf8");
  assert.equal(original.includes("22222222-2222-2222-2222-222222222222"), false);
  fs.appendFileSync(f.snapshot, "\n");
  assert.match(validateReview(document, { root: f.root, verifyCurrent: true }).join("\n"), /evidence changed/);
  f.recall(
    "checkpoint",
    "example",
    "3_5",
    "refresh",
    "--policy-feasibility",
    path.join(path.dirname(f.snapshot), "04-policy-feasibility.json"),
    "--json",
  );
  const changed = document.supporting_inputs.find((support) => support.path.endsWith("/subscription-1.json"));
  const registryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "private-compatibility-test-"));
  t.after(() => fs.rmSync(registryRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(registryRoot, "tools/registry"), { recursive: true });
  fs.writeFileSync(
    path.join(registryRoot, "tools/registry/review-contract.json"),
    JSON.stringify({
      contract: "review-v1",
      editorial_compatibility: [],
      supporting_input_compatibility: [
        {
          path: changed.path,
          from_sha256: changed.sha256,
          to_sha256: hash(fs.readFileSync(f.snapshot)),
          rationale: "A registry mapping cannot waive private policy drift",
        },
      ],
    }),
  );
  assert.equal(
    supportingInputCompatible(changed.path, changed.sha256, hash(fs.readFileSync(f.snapshot)), registryRoot),
    false,
  );
  assert.match(validateReview(document, { root: f.root, verifyCurrent: true }).join("\n"), /supporting bytes changed/);
  const wrongProject = structuredClone(document);
  wrongProject.review_execution.project_name = "other";
  delete wrongProject.supporting_inputs;
  assert.match(
    validateReview(wrongProject, { root: f.root, verifyCurrent: true }).join("\n"),
    /primary artifact scope/,
  );
  assert.equal(fs.readFileSync(path.join(f.root, f.findings), "utf8"), original);
});

test("private review references cannot omit evidence, escape scope or use public copies", (t) => {
  const f = privatePolicyFixture(t);
  const withoutPrivate = structuredClone(f.input);
  withoutPrivate.supporting_inputs = withoutPrivate.supporting_inputs.filter(
    (support) => !support.path.startsWith("apex-private-policy:"),
  );
  assert.throws(() => preflightReviewRequest(withoutPrivate, f.root), /Required private policy evidence/);
  const outside = structuredClone(f.input);
  outside.supporting_inputs[1].path = f.snapshot;
  assert.throws(() => preflightReviewRequest(outside, f.root), /within the workspace/);
  const wrongScope = structuredClone(f.input);
  wrongScope.supporting_inputs[1].path = wrongScope.supporting_inputs[1].path.replace("/example/", "/other/");
  assert.throws(() => preflightReviewRequest(wrongScope, f.root), /differently scoped/);
  const privatePrimary = structuredClone(f.input);
  privatePrimary.artifact_path = privatePrimary.supporting_inputs[1].path;
  assert.throws(() => preflightReviewRequest(privatePrimary, f.root), /primary remains the public summary/);
});

test("request preflight rejects malformed revisions before any worker or publication", (t) => {
  const f = fixture(t, { supporting: true });
  const before = fs.readdirSync(path.join(f.root, "agent-output/example")).sort();
  const valid = preflightReviewRequest(f.input, f.root);
  assert.deepEqual(valid.attempt_inputs, [artifact, f.input.supporting_inputs[0].path]);
  assert.deepEqual(fs.readdirSync(path.join(f.root, "agent-output/example")).sort(), before);
  assert.equal(fs.existsSync(path.join(f.root, output)), false);
  f.input.prior_findings = { findings: [] };
  assert.throws(() => preflightReviewRequest(f.input, f.root), /prior_findings/);
  f.input.prior_findings = [];
  const focus = f.input.review_focus;
  f.input.review_focus = "invented-lens";
  assert.throws(() => preflightReviewRequest(f.input, f.root), /lenses/);
  f.input.review_focus = focus;
  f.write(output, "preserved previous result");
  assert.throws(() => preflightReviewRequest(f.input, f.root), /overwrite/);
  f.input.overwrite = true;
  assert.doesNotThrow(() => preflightReviewRequest(f.input, f.root));
  f.write(f.input.supporting_inputs[0].path, "changed");
  assert.throws(() => preflightReviewRequest(f.input, f.root), /supporting bytes changed/);
  assert.equal(fs.readFileSync(path.join(f.root, output), "utf8"), "preserved previous result");
});

test("request-only CLI cannot silently invoke the recorder or accept stale inputs", (t) => {
  const f = fixture(t);
  f.write("request.json", JSON.stringify(f.input));
  const run = () =>
    spawnSync(process.execPath, [recorder, "--preflight", "--request", "request.json"], {
      cwd: f.root,
      encoding: "utf8",
    });
  const passing = run();
  assert.equal(passing.status, 0, passing.stderr);
  assert.equal(JSON.parse(passing.stdout).permission_granted, false);
  assert.equal(fs.existsSync(path.join(f.root, output)), false);
  f.write(artifact, "drift");
  assert.equal(run().status, 1);
});

test("manual Step 6 deployment-preview requests pass preflight and final recording", (t) => {
  const f = fixture(t);
  const preview = "agent-output/example/06-deploy-approval.json";
  const findings = "agent-output/example/challenge-findings-deployment-preview.json";
  f.write(preview, JSON.stringify({ preview: "Synthetic preview; no apply authorized" }));
  Object.assign(f.input, {
    step: "6",
    artifact_path: preview,
    artifact_type: "deployment-preview",
    output_path: findings,
    cache_inputs: cacheInputs(preview, f.root, STRUCTURED_REVIEWER),
  });
  Object.assign(f.doc, {
    challenged_artifact: preview,
    artifact_type: "deployment-preview",
    cache_inputs: structuredClone(f.input.cache_inputs),
  });
  f.options.output = findings;
  assert.doesNotThrow(() => preflightReviewRequest(f.input, f.root));
  f.record();
  assert.equal(f.persisted().review_execution.step, "6");
  assert.equal(f.persisted().artifact_type, "deployment-preview");
});

test("editorial compatibility preserves provenance but never accepts changed material inputs", (t) => {
  const f = fixture(t);
  f.record();
  const original = f.persisted();
  const guidance = ".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md";
  f.write(guidance, "Protocol\nEditorial clarification\n");
  assert.match(validateReview(original, { root: f.root, verifyCurrent: true }).join("\n"), /protocol_sha/);
  const next = cacheInputs(artifact, f.root, STRUCTURED_REVIEWER);
  const fields = ["checklists_sha", "protocol_sha", "reviewer_contract_sha", "reviewer_definition_sha"];
  const snapshot = (cache) => Object.fromEntries(fields.map((key) => [key, cache[key] ?? null]));
  f.write(
    "tools/registry/review-contract.json",
    JSON.stringify({
      contract: "review-v1",
      editorial_compatibility: [
        {
          classification: "editorial",
          rationale: "Synthetic repository-reviewed editorial mapping",
          from: snapshot(original.cache_inputs),
          to: snapshot(next),
        },
      ],
    }),
  );
  const bytes = fs.readFileSync(path.join(f.root, output), "utf8");
  assert.deepEqual(validateReview(original, { root: f.root, verifyCurrent: true }), []);
  assert.equal(fs.readFileSync(path.join(f.root, output), "utf8"), bytes);
  f.write(artifact, "Materially changed requirement");
  assert.match(validateReview(original, { root: f.root, verifyCurrent: true }).join("\n"), /artifact_sha/);
});

function supportingAssetFixture(t, extension) {
  const f = fixture(t, { supporting: true });
  const inputPath = `agent-output/example/03-des-diagram.${extension}`;
  const recorded = "Original diagram bytes\n";
  const current = "Editorial diagram layout correction\n";
  f.write(inputPath, recorded);
  f.input.supporting_inputs = [{ path: inputPath, sha256: hash(recorded) }];
  f.doc.supporting_inputs = structuredClone(f.input.supporting_inputs);
  f.record();
  const original = f.persisted();
  const reviewBytes = fs.readFileSync(path.join(f.root, output), "utf8");
  f.write(inputPath, current);
  const mapping = {
    path: inputPath,
    from_sha256: hash(recorded),
    to_sha256: hash(current),
    rationale: "Synthetic reviewed layout correction; architecture and review findings are unchanged",
  };
  return {
    ...f,
    mapping,
    validate: () => validateReview(original, { root: f.root, verifyCurrent: true }),
    register(entries) {
      f.write(
        "tools/registry/review-contract.json",
        JSON.stringify({
          contract: "review-v1",
          editorial_compatibility: [],
          supporting_input_compatibility: entries,
        }),
      );
    },
    assertHistoryUnchanged() {
      assert.equal(fs.readFileSync(path.join(f.root, output), "utf8"), reviewBytes);
    },
  };
}

for (const extension of ["py", "png", "svg"]) {
  test(`supporting .${extension} freshness accepts only the exact registry mapping without rewriting history`, (t) => {
    const f = supportingAssetFixture(t, extension);
    assert.match(f.validate().join("\n"), /supporting bytes changed/);
    f.register([f.mapping]);
    assert.deepEqual(f.validate(), []);
    f.assertHistoryUnchanged();
  });

  for (const [label, mutate] of [
    ["unmapped asset", () => []],
    ["wrong path", (entry) => [{ ...entry, path: `agent-output/other/03-des-diagram.${extension}` }]],
    ["wrong recorded hash", (entry) => [{ ...entry, from_sha256: hash("Unrelated original bytes") }]],
    ["wrong current hash", (entry) => [{ ...entry, to_sha256: hash("Unrelated current bytes") }]],
    ["reversed hashes", (entry) => [{ ...entry, from_sha256: entry.to_sha256, to_sha256: entry.from_sha256 }]],
    ["missing rationale", ({ rationale: _rationale, ...entry }) => [entry]],
    ["empty rationale", (entry) => [{ ...entry, rationale: "" }]],
    ["whitespace rationale", (entry) => [{ ...entry, rationale: " \n\t " }]],
  ]) {
    test(`supporting .${extension} freshness rejects ${label}`, (t) => {
      const f = supportingAssetFixture(t, extension);
      f.register(mutate(f.mapping));
      assert.match(f.validate().join("\n"), /supporting bytes changed/);
      f.assertHistoryUnchanged();
    });
  }
}

for (const extension of ["md", "json"]) {
  test(`supporting .${extension} material input stays stale even with an exact registry mapping`, (t) => {
    const f = supportingAssetFixture(t, extension);
    f.register([f.mapping]);
    assert.match(f.validate().join("\n"), /supporting bytes changed/);
    f.assertHistoryUnchanged();
  });
}

test("practical initial and closure evidence complete a scoped stage without a third review", (t) => {
  const f = fixture(t);
  const repo = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
  fs.symlinkSync(path.join(repo, "tools"), path.join(f.root, "tools"));
  const recall = (...args) => {
    const result = spawnSync("python3", ["-m", "apex_recall", ...args], {
      cwd: f.root,
      encoding: "utf8",
      env: { ...process.env, APEX_ROOT: f.root, PYTHONPATH: path.join(repo, "tools/apex-recall/src") },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return JSON.parse(result.stdout);
  };
  recall("init", "example", "--json");
  recall("decide", "example", "--adopt-workflow", "practical-v1", "--rationale", "Synthetic owner opt-in", "--json");
  f.write(
    "input.json",
    JSON.stringify({
      input_id: "scope",
      value: "Synthetic DEV scope; production not authorized",
      environments: ["dev"],
      owner: "synthetic-owner",
      request_id: "synthetic-owner-input",
    }),
  );
  recall("decide", "example", "--input-record", path.join(f.root, "input.json"), "--json");
  f.write(
    "scope.json",
    JSON.stringify({
      input_ids: ["scope"],
      environments: ["dev"],
      request_id: "synthetic-phase-approval",
    }),
  );
  recall("decide", "example", "--phase-scope", path.join(f.root, "scope.json"), "--step", "1", "--json");
  recall("checkpoint", "example", "1", "finalize", "--sync-assessment", "--json");
  f.input.step = "1";
  f.input.supporting_inputs = [
    {
      path: "agent-output/example/_meta/assessment-step-1.json",
      sha256: hash(fs.readFileSync(path.join(f.root, "agent-output/example/_meta/assessment-step-1.json"))),
    },
  ];
  f.doc.supporting_inputs = structuredClone(f.input.supporting_inputs);
  const requestFile = path.join(f.root, "request.json");
  const audit = (outcome, ...extra) => {
    f.write("request.json", JSON.stringify(f.input));
    return recall(
      "review-audit",
      "example",
      "1",
      "--attempt-kind",
      "invocation",
      "--review-request",
      requestFile,
      "--attempt-outcome",
      outcome,
      ...extra,
      "--json",
    );
  };
  audit("started");
  audit("completed", "--review-output", "nonempty");
  f.flush();
  const parentRecords = [f.events[0], f.events.at(-1)];
  fs.writeFileSync(
    f.options.events,
    [...f.events.slice(1, -1), ...parentRecords].map((event) => JSON.stringify(event)).join("\n"),
  );
  recordReview(f.options);
  audit("completed", "--review-output", "nonempty", "--review-result", path.join(f.root, output));
  const recovered = recall("show", "example", "--json");
  assert.equal(Object.values(recovered.session.decisions.review_cycles)[0].calls, 1);
  assert.equal(recovered.session.review_attempts.length, 2);
  const original = fs.readFileSync(path.join(f.root, output), "utf8");
  f.write(artifact, "# Requirements\nSynthetic routine correction, unchanged material scope\n");
  const closure = "agent-output/example/challenge-findings-requirements-closure.json";
  f.input.request_id = "request-2";
  f.input.output_path = closure;
  f.input.prior_findings = [];
  f.input.cache_inputs = cacheInputs(artifact, f.root, STRUCTURED_REVIEWER);
  f.doc.cache_inputs = structuredClone(f.input.cache_inputs);
  f.options.output = closure;
  audit("started", "--closure-of", "request-1");
  f.record();
  audit("completed", "--closure-of", "request-1", "--review-result", path.join(f.root, closure));
  const completed = recall("complete-step", "example", "1", "--json");
  assert.equal(completed.status, "complete");
  const shown = recall("show", "example", "--json");
  assert.deepEqual(shown.session.steps["1"].completed_environments, ["dev"]);
  assert.equal(shown.session.effective_reviews["1"].status, "current");
  assert.equal(fs.readFileSync(path.join(f.root, output), "utf8"), original);
  const cycles = Object.values(shown.session.decisions.review_cycles);
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0].calls, 2);
  assert.equal(cycles[0].current_path, path.basename(closure));

  recall("start-step", "example", "2", "--json");
  f.write(
    "architecture-scope.json",
    JSON.stringify({
      input_ids: ["scope"],
      environments: ["dev"],
      request_id: "synthetic-architecture-scope-approval",
    }),
  );
  recall("decide", "example", "--phase-scope", path.join(f.root, "architecture-scope.json"), "--step", "2", "--json");
  recall("checkpoint", "example", "2", "draft", "--sync-assessment", "--json");
  f.write("agent-output/example/02-architecture-assessment.md", "# Architecture\nUnreviewed draft\n");
  f.write("agent-output/example/03-des-cost-estimate.md", "# Cost\nUnpriced draft; no verified estimate\n");
  f.write("agent-output/example/sku-manifest.json", JSON.stringify({ services: [] }));
  const statePath = path.join(f.root, "agent-output/example/_meta/00-session-state.json");
  const completeDraft = () =>
    spawnSync("python3", ["-m", "apex_recall", "complete-step", "example", "2", "--json"], {
      cwd: f.root,
      encoding: "utf8",
      env: { ...process.env, APEX_ROOT: f.root, PYTHONPATH: path.join(repo, "tools/apex-recall/src") },
    });
  const beforeSourceSelection = fs.readFileSync(statePath, "utf8");
  const missingSource = completeDraft();
  assert.equal(missingSource.status, 2, missingSource.stdout + missingSource.stderr);
  assert.match(JSON.parse(missingSource.stdout).reason, /explicitly accept Corp assumptions before Architecture/);
  assert.equal(fs.readFileSync(statePath, "utf8"), beforeSourceSelection);

  const baseline = ".github/data/alz-corp-policy-baseline.json.gz";
  f.write(baseline, fs.readFileSync(path.join(repo, baseline)));
  recall(
    "policy-source",
    "example",
    "--assumed-corp",
    "--owner",
    "synthetic-owner",
    "--request-id",
    "synthetic-policy-source-acceptance",
    "--environment",
    "dev",
    "--json",
  );
  f.write(
    "architecture-scope.json",
    JSON.stringify({
      input_ids: ["scope", "policy_source"],
      environments: ["dev"],
      request_id: "synthetic-architecture-policy-scope-approval",
    }),
  );
  recall("decide", "example", "--phase-scope", path.join(f.root, "architecture-scope.json"), "--step", "2", "--json");
  recall("checkpoint", "example", "2", "draft", "--sync-assessment", "--json");
  assert.equal(
    recall("show", "example", "--json").session.policy_feasibility.status,
    "assumed_corp_not_tenant_verified",
  );
  const beforeDraftCompletion = fs.readFileSync(statePath, "utf8");
  const blocked = completeDraft();
  assert.equal(blocked.status, 2, blocked.stdout + blocked.stderr);
  assert.equal(JSON.parse(blocked.stdout).error, "challenger_findings_missing", blocked.stdout + blocked.stderr);
  assert.equal(fs.readFileSync(statePath, "utf8"), beforeDraftCompletion);
  assert.equal(fs.existsSync(path.join(f.root, "agent-output/example/02-cost-estimate.json")), false);
  assert.equal(recall("show", "example", "--json").session.steps["2"].status, "in_progress");
});

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

test("closure review with zero must_fix preserves native NEEDS_REVISION and should_fix severity verbatim (LL-009)", (t) => {
  const f = fixture(t);
  f.input.prior_findings = [{ id: "prior001", disposition: "fixed", summary: "Fixed prior must_fix" }];
  const finding = {
    severity: "should_fix",
    category: "operations",
    claim: "Log Analytics workspace omits self-diagnostics",
    evidence: "workspace diagnosticSettings omitted",
    impact: "Platform audit gap",
    artifact_section: "Module Configuration",
    traces_to: ["Logging checklist"],
  };
  f.doc.findings = [finding];
  f.doc.overall_assessment = "NEEDS_REVISION";
  for (const key of ["must_fix_count", "should_fix_count", "suggestion_count"]) delete f.doc[key];
  f.record();
  const saved = f.persisted();
  assert.equal(saved.overall_assessment, "NEEDS_REVISION");
  assert.equal(saved.must_fix_count, 0);
  assert.equal(saved.should_fix_count, 1);
  assert.equal(saved.suggestion_count, 0);
  assert.equal(saved.findings[0].severity, "should_fix");
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

function privateReadRecoveryFixture(t, count = 2) {
  const f = privatePolicyFixture(t);
  f.input.private_inputs = preflightReviewRequest(f.input, f.root).private_inputs;
  addReadTurns(f, count);
  const reads = f.events.filter((event) => event.type === "tool.execution_start" && event.data.toolName === "view");
  const shortened = path.join(path.dirname(path.dirname(f.canonical)), path.basename(f.canonical));
  reads[0].data.arguments = { path: shortened };
  reads[1].data.arguments = { path: f.canonical };
  const failed = f.events.find(
    (event) => event.type === "tool.execution_complete" && event.data.toolCallId === "read-0",
  );
  failed.data.success = false;
  failed.data.error = {
    code: "failure",
    message: `Path ${shortened} does not exist. Please provide a valid path.`,
  };
  return { ...f, reads, failed, shortened };
}

for (const format of ["native-path", "file-not-found", "enoent"]) {
  test(`one literal private-path correction is recorded in the same invocation: ${format}`, (t) => {
    const f = privateReadRecoveryFixture(t);
    if (format === "file-not-found") f.failed.data.error.message = `File not found: ${f.shortened}`;
    if (format === "enoent") {
      f.failed.data.error = {
        code: "ENOENT",
        message: `ENOENT: no such file or directory, open '${f.shortened}'`,
      };
    }
    f.record();
    const saved = f.persisted();
    assert.deepEqual(saved.review_execution.recovered_read_calls, ["read-0"]);
    assert.equal(saved.review_execution.worker_id, "worker-1");
    assert.equal(saved.overall_assessment, "APPROVED");
    assert.equal(f.failed.data.success, false);
    assert.deepEqual(saved.supporting_inputs, f.input.supporting_inputs);
    assert.equal(JSON.stringify(saved).includes(f.canonical), false);
    assert.equal(JSON.stringify(saved).includes(f.shortened), false);
  });
}

for (const [label, mutate] of [
  ["no supplied mapping", (f) => delete f.input.private_inputs],
  ["different corrected file", (f) => (f.reads[1].data.arguments.path = f.snapshot)],
  ["unrelated missing path", (f) => (f.reads[0].data.arguments.path = "/unrelated/missing.json")],
  ["access denied", (f) => (f.failed.data.error = { code: "EACCES", message: "Permission denied" })],
  [
    "content exclusion",
    (f) => (f.failed.data.error = { code: "CONTENT_EXCLUDED", message: "Blocked by content exclusion policy" }),
  ],
  ["unknown error code", (f) => (f.failed.data.error.code = "unknown")],
  [
    "failed corrected read",
    (f) =>
      (f.events.find(
        (event) => event.type === "tool.execution_complete" && event.data.toolCallId === "read-1",
      ).data.success = false),
  ],
]) {
  test(`private-path correction remains blocked: ${label}`, (t) => {
    const f = privateReadRecoveryFixture(t);
    mutate(f);
    assert.throws(() => f.record(), /Worker tool calls must complete successfully/);
    assert.equal(fs.existsSync(path.join(f.root, f.findings)), false);
  });
}

test("a second private-path correction in one invocation remains blocked", (t) => {
  const f = privateReadRecoveryFixture(t, 4);
  const shortened = path.join(path.dirname(path.dirname(f.snapshot)), path.basename(f.snapshot));
  f.reads[2].data.arguments = { path: shortened };
  f.reads[3].data.arguments = { path: f.snapshot };
  const failed = f.events.find(
    (event) => event.type === "tool.execution_complete" && event.data.toolCallId === "read-2",
  );
  failed.data.success = false;
  failed.data.error = { code: "failure", message: `File not found: ${shortened}` };
  assert.throws(() => f.record(), /Worker tool calls must complete successfully/);
});

test("supplied private mappings cannot substitute an unauthorized target", (t) => {
  const f = privateReadRecoveryFixture(t);
  const entry = f.input.private_inputs.find((item) => item.read_path === f.canonical);
  entry.read_path = path.join(f.root, "other-scope", path.basename(f.canonical));
  f.reads[0].data.arguments.path = path.join(f.root, path.basename(f.canonical));
  f.reads[1].data.arguments.path = entry.read_path;
  f.failed.data.error.message = `File not found: ${f.reads[0].data.arguments.path}`;
  assert.throws(() => preflightReviewRequest(f.input, f.root), /mapping must exactly match canonical/);
  assert.throws(() => f.record(), /mapping must exactly match canonical/);
  assert.equal(fs.existsSync(path.join(f.root, f.findings)), false);
});

test("a corrected read cannot turn a returned execution failure into findings", (t) => {
  const f = privateReadRecoveryFixture(t);
  for (const key of Object.keys(f.doc)) delete f.doc[key];
  Object.assign(f.doc, {
    status: "FAILED",
    stage: "private-evidence-read",
    error: "No substantive verdict was produced",
  });
  assert.throws(() => f.record(), /Reviewer execution failed at private-evidence-read/);
  assert.equal(fs.existsSync(path.join(f.root, f.findings)), false);
});

test("request ID resolves an exact worker in an explicit session without UUID scraping", (t) => {
  const f = fixture(t);
  f.flush();
  recordReview({ ...f.options, workerId: undefined, parentId: undefined, requestId: f.input.request_id });
  assert.equal(f.persisted().review_execution.worker_id, "worker-1");
});

test("late parent task records preserve the completed review and its original metadata", (t) => {
  const f = fixture(t);
  f.events[1].data.resumable = false;
  f.events[0].timestamp = "2026-10-17T15:04:00.000Z";
  f.events.at(-1).timestamp = "2026-10-17T15:04:00.001Z";
  f.flush();
  const parent = [f.events[0], f.events.at(-1)];
  fs.writeFileSync(f.options.events, [...f.events.slice(1, -1), ...parent].map(JSON.stringify).join("\n"));
  const result = recordReview({
    ...f.options,
    workerId: undefined,
    parentId: undefined,
    requestId: f.input.request_id,
  });
  assert.equal(result.review_execution.worker_id, "worker-1");
  assert.equal(result.review_execution.completed_at, "2026-10-17T15:00:00.000Z");
  assert.deepEqual(f.persisted().cache_inputs, f.input.cache_inputs);
  assert.equal(f.persisted().overall_assessment, "APPROVED");
  assert.deepEqual(f.persisted().findings, []);
  assert.deepEqual(validateReview(f.persisted(), { root: f.root, verifyCurrent: true }), []);
});

for (const ambiguous of [false, true]) {
  test(`request lookup ${ambiguous ? "rejects ambiguous" : "waits for late"} parent records after worker completion`, async (t) => {
    const f = fixture(t);
    f.events[1].data.resumable = false;
    f.flush();
    const parent = [f.events[0], f.events.at(-1)];
    if (ambiguous) {
      const duplicate = structuredClone(parent[0]);
      duplicate.data.toolCallId = "another-call";
      parent.push(duplicate);
    }
    fs.writeFileSync(f.options.events, `${f.events.slice(1, -1).map(JSON.stringify).join("\n")}\n`);
    const child = spawn(process.execPath, [
      "-e",
      "const fs=require('node:fs');setTimeout(()=>fs.appendFileSync(process.argv[1],process.argv[2]),100);",
      f.options.events,
      `${parent.map(JSON.stringify).join("\n")}\n`,
    ]);
    const exited = once(child, "exit");
    const record = () =>
      recordReview({
        ...f.options,
        workerId: undefined,
        parentId: undefined,
        requestId: f.input.request_id,
      });
    let result;
    try {
      if (ambiguous) assert.throws(record, /Request ID must identify exactly one review dispatch/);
      else result = record();
    } catch (error) {
      child.kill();
      throw error;
    } finally {
      await exited;
    }
    assert.equal(child.exitCode, 0);
    if (ambiguous) assert.equal(fs.existsSync(path.join(f.root, output)), false);
    else {
      assert.equal(result.review_execution.request_id, f.input.request_id);
      assert.equal(f.persisted().overall_assessment, "APPROVED");
    }
  });
}

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

test("recorder stamps omitted cache_inputs and supporting_inputs across single and batch results while rejecting null or conflicts", (t) => {
  const single = fixture(t, { supporting: true });
  delete single.doc.cache_inputs;
  delete single.doc.supporting_inputs;
  single.record();
  assert.deepEqual(single.persisted().cache_inputs, single.input.cache_inputs);
  assert.deepEqual(single.persisted().supporting_inputs, single.input.supporting_inputs);

  const withoutSupport = fixture(t, { supporting: false });
  delete withoutSupport.doc.cache_inputs;
  withoutSupport.record();
  assert.deepEqual(withoutSupport.persisted().cache_inputs, withoutSupport.input.cache_inputs);
  assert.equal(Object.hasOwn(withoutSupport.persisted(), "supporting_inputs"), false);

  const batch = fixture(t, { batch: true, supporting: true });
  for (const item of batch.doc.batch_results) {
    delete item.cache_inputs;
    delete item.supporting_inputs;
  }
  batch.record();
  for (const item of batch.persisted().batch_results) {
    assert.deepEqual(item.cache_inputs, batch.input.cache_inputs);
    assert.deepEqual(item.supporting_inputs, batch.input.supporting_inputs);
  }

  for (const bad of [(f) => (f.entry.cache_inputs = null), (f) => (f.entry.supporting_inputs = null)]) {
    const invalid = fixture(t, { supporting: true });
    bad(invalid);
    assert.throws(() => invalid.record(), /differ from dispatch/);
  }
});

test("--events-dir resolves unique session log by request_id, tolerates worker-first flush, and rejects symlinks/duplicates", async (t) => {
  const f = fixture(t, { supporting: true });
  delete f.doc.cache_inputs;
  delete f.doc.supporting_inputs;
  f.flush();
  const sessions = path.join(f.root, "session-state");
  const s1 = path.join(sessions, "session-a");
  const s2 = path.join(sessions, "session-b");
  fs.mkdirSync(s1, { recursive: true });
  fs.mkdirSync(s2, { recursive: true });
  fs.writeFileSync(path.join(s1, "events.jsonl"), `${JSON.stringify({ type: "session.start", data: {} })}\n`);
  const raw = fs.readFileSync(f.options.events, "utf8");
  fs.writeFileSync(path.join(s2, "events.jsonl"), raw);
  const res = recordReview({
    root: f.root,
    eventsDir: sessions,
    requestId: "request-1",
    output,
  });
  assert.equal(res.review_execution.request_id, "request-1");

  // Duplicate request_id across two session logs fails closed.
  fs.writeFileSync(path.join(s1, "events.jsonl"), raw);
  f.input.overwrite = true;
  assert.throws(
    () => recordReview({ root: f.root, eventsDir: sessions, requestId: "request-1", output }),
    /Ambiguous request ID/,
  );

  // Symlinked events.jsonl in --events-dir is rejected.
  fs.unlinkSync(path.join(s1, "events.jsonl"));
  fs.symlinkSync(path.join(s2, "events.jsonl"), path.join(s1, "events.jsonl"));
  assert.throws(
    () => recordReview({ root: f.root, eventsDir: sessions, requestId: "request-1", output }),
    /Symlinked nested events\.jsonl/,
  );

  // Trailing partial JSON line during --events-dir flush wait is tolerated until flushed.
  fs.unlinkSync(path.join(s1, "events.jsonl"));
  f.input.overwrite = true;
  f.flush();
  const rawOverwrite = fs.readFileSync(f.options.events, "utf8");
  const logPath = path.join(s2, "events.jsonl");
  fs.writeFileSync(logPath, `${rawOverwrite}\n{"type":"partial_flush`);
  const child = spawn(
    process.execPath,
    [recorder, "--events-dir", sessions, "--request-id", "request-1", "--output", output],
    { cwd: f.root, stdio: ["ignore", "pipe", "pipe"] },
  );
  setTimeout(() => {
    fs.writeFileSync(logPath, `${rawOverwrite}\n`);
  }, 150);
  const [exitCode] = await once(child, "exit");
  assert.equal(exitCode, 0);
});

test("root-session mid-turn buffered dispatch records via preToolUse/postToolUse hooks and rejects overrides", (t) => {
  const f = fixture(t, { supporting: true });
  delete f.doc.cache_inputs;
  delete f.doc.supporting_inputs;
  f.flush();

  const dispatchEvent = f.events.find(
    (event) => event.type === "tool.execution_start" && event.data?.toolName === "task",
  );
  const args = structuredClone(dispatchEvent.data.arguments);
  const startEvent = f.events.find((event) => event.type === "subagent.started");
  delete startEvent.data.parentId;
  startEvent.data.resumable = false;
  startEvent.data.taskModelSource = "unset";

  // Remove root tool.execution_start / tool.execution_complete to simulate mid-turn SDK RAM buffering.
  const workerStream = f.events.filter(
    (event) =>
      !(
        (event.type === "tool.execution_start" || event.type === "tool.execution_complete") &&
        event.data?.toolCallId === "call-1"
      ),
  );
  const preHookStart = {
    type: "hook.start",
    data: {
      hookInvocationId: "hook-pre-1",
      hookType: "preToolUse",
      input: {
        sessionId: "session-root",
        cwd: f.root,
        toolCalls: [{ id: "call-1", name: "task", args }],
      },
    },
  };
  const preHookEnd = {
    type: "hook.end",
    data: { hookInvocationId: "hook-pre-1", hookType: "preToolUse", success: true },
  };
  const postHookStart = {
    type: "hook.start",
    data: {
      hookInvocationId: "hook-post-1",
      hookType: "postToolUse",
      input: {
        sessionId: "session-root",
        cwd: f.root,
        toolCallId: "call-1",
        toolName: "task",
        toolArgs: structuredClone(args),
        toolResult: { resultType: "success" },
      },
    },
  };
  const postHookEnd = {
    type: "hook.end",
    data: { hookInvocationId: "hook-post-1", hookType: "postToolUse", success: true },
  };

  const bufferedEvents = [preHookStart, preHookEnd, ...workerStream, postHookStart, postHookEnd];
  const sessions = path.join(f.root, "buffered-sessions");
  const sessionDir = path.join(sessions, "root-session");
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, "events.jsonl"), bufferedEvents.map((e) => JSON.stringify(e)).join("\n"));

  const t0 = Date.now();
  const recorded = recordReview({
    root: f.root,
    eventsDir: sessions,
    requestId: "request-1",
    output,
  });
  assert.ok(Date.now() - t0 < 5_000, "Root hook completion must not block on 25s flush timeout");
  assert.equal(recorded.review_execution.parent_id, "root");
  assert.equal(recorded.review_execution.request_id, "request-1");

  // Missing or runtime-managed taskModelSource labels must remain nonblocking when task args have no overrides.
  for (const labelVal of [undefined, "runtime_default", "session_inheritance"]) {
    const variant = structuredClone(bufferedEvents);
    const sEv = variant.find((e) => e.type === "subagent.started");
    if (labelVal === undefined) delete sEv.data.taskModelSource;
    else sEv.data.taskModelSource = labelVal;
    assert.equal(extractReview(variant, "worker-1", "root").execution.request_id, "request-1");
  }

  // Caller model override inside preToolUse args must still fail closed.
  const badOverride = structuredClone(bufferedEvents);
  badOverride[0].data.input.toolCalls[0].args.model = "gpt-override";
  badOverride.at(-2).data.input.toolArgs.model = "gpt-override";
  assert.throws(() => extractReview(badOverride, "worker-1", "root"), /without caller overrides/);

  // Failed postToolUse resultType must fail closed.
  const badResult = structuredClone(bufferedEvents);
  badResult.at(-2).data.input.toolResult.resultType = "failure";
  assert.throws(() => extractReview(badResult, "worker-1", "root"), /successful task invocation/);

  // Non-root parentId cannot use the root hook fallback.
  assert.throws(() => extractReview(bufferedEvents, "worker-1", "subagent-parent"), /Attributed one-shot/);
});

test("APEX_REVIEW_FILE hash-bound request pointer records cleanly and rejects tampered, symlinked, or non-_meta paths", (t) => {
  const f = fixture(t, { supporting: true });
  delete f.doc.cache_inputs;
  delete f.doc.supporting_inputs;
  const reqRel = "agent-output/example/_meta/review-request.json";
  const reqRaw = `${JSON.stringify(f.input, null, 2)}\n`;
  f.write(reqRel, reqRaw);

  const preflight = spawnSync(process.execPath, [recorder, "--preflight", "--request", reqRel], {
    cwd: f.root,
    encoding: "utf8",
  });
  assert.equal(preflight.status, 0, preflight.stderr);
  const preflightOut = JSON.parse(preflight.stdout);
  assert.equal(preflightOut.review_file_envelope.request_path, reqRel);
  assert.equal(preflightOut.review_file_envelope.request_sha256, hash(reqRaw));

  const filePrompt = `APEX_REVIEW_FILE\n${JSON.stringify(preflightOut.review_file_envelope)}`;
  f.flush();
  f.events[0].data.arguments.prompt = filePrompt;
  f.events.find((e) => e.type === "user.message").data.content = filePrompt;
  f.write("events.jsonl", f.events.map((e) => JSON.stringify(e)).join("\n"));

  const sessions = path.join(f.root, "file-envelope-sessions");
  const sessionDir = path.join(sessions, "s1");
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, "events.jsonl"), fs.readFileSync(f.options.events, "utf8"));

  const recorded = recordReview({
    root: f.root,
    eventsDir: sessions,
    requestId: "request-1",
    output,
  });
  assert.equal(recorded.review_execution.request_id, "request-1");
  assert.deepEqual(f.persisted().supporting_inputs, f.input.supporting_inputs);

  // Tampering with saved request file bytes after dispatch fails closed on request_sha256 mismatch.
  f.write(reqRel, `${reqRaw} `);
  assert.throws(() => extractReview(f.events, "worker-1", "root", { root: f.root }), /request_sha256 does not match/);
  f.write(reqRel, reqRaw);

  // Path outside agent-output/<project>/_meta/ omits review_file_envelope on --preflight and fails closed on extractReview.
  const outsideRel = "agent-output/example/review-request.json";
  const overwriteRaw = `${JSON.stringify({ ...f.input, overwrite: true }, null, 2)}\n`;
  f.write(outsideRel, overwriteRaw);
  const outsidePreflight = spawnSync(process.execPath, [recorder, "--preflight", "--request", outsideRel], {
    cwd: f.root,
    encoding: "utf8",
  });
  assert.equal(outsidePreflight.status, 0, outsidePreflight.stderr);
  assert.equal(Object.hasOwn(JSON.parse(outsidePreflight.stdout), "review_file_envelope"), false);

  const badOutside = structuredClone(f.events);
  const outsidePrompt = `APEX_REVIEW_FILE\n${JSON.stringify({
    ...preflightOut.review_file_envelope,
    request_path: outsideRel,
    request_sha256: hash(overwriteRaw),
  })}`;
  badOutside[0].data.arguments.prompt = outsidePrompt;
  badOutside.find((e) => e.type === "user.message").data.content = outsidePrompt;
  assert.throws(
    () => extractReview(badOutside, "worker-1", "root", { root: f.root }),
    /must reside under agent-output/,
  );

  // Omitting project_name / step / review_depth on APEX_REVIEW_FILE fails closed.
  const missingHeader = structuredClone(f.events);
  const incompleteEnv = { ...preflightOut.review_file_envelope };
  delete incompleteEnv.project_name;
  const incompletePrompt = `APEX_REVIEW_FILE\n${JSON.stringify(incompleteEnv)}`;
  missingHeader[0].data.arguments.prompt = incompletePrompt;
  missingHeader.find((e) => e.type === "user.message").data.content = incompletePrompt;
  assert.throws(
    () => extractReview(missingHeader, "worker-1", "root", { root: f.root }),
    /requires request_id, project_name, step, review_depth/,
  );

  // Symlinked request_path fails closed.
  const linkRel = "agent-output/example/_meta/linked-request.json";
  fs.symlinkSync(path.join(f.root, reqRel), path.join(f.root, linkRel));
  const badLink = structuredClone(f.events);
  const linkPrompt = `APEX_REVIEW_FILE\n${JSON.stringify({
    ...preflightOut.review_file_envelope,
    request_path: linkRel,
  })}`;
  badLink[0].data.arguments.prompt = linkPrompt;
  badLink.find((e) => e.type === "user.message").data.content = linkPrompt;
  assert.throws(() => extractReview(badLink, "worker-1", "root", { root: f.root }), /must not traverse symlinks/);

  // Persisted private_inputs inside saved request JSON is rejected even when envelope omits private_inputs.
  const privRel = "agent-output/example/_meta/persisted-private.request.json";
  const privRaw = `${JSON.stringify({ ...f.input, private_inputs: [{ reference: "ref", read_path: "/tmp/p" }] }, null, 2)}\n`;
  f.write(privRel, privRaw);
  const badPriv = structuredClone(f.events);
  const privPrompt = `APEX_REVIEW_FILE\n${JSON.stringify({
    ...preflightOut.review_file_envelope,
    request_path: privRel,
    request_sha256: hash(privRaw),
  })}`;
  badPriv[0].data.arguments.prompt = privPrompt;
  badPriv.find((e) => e.type === "user.message").data.content = privPrompt;
  assert.throws(
    () => extractReview(badPriv, "worker-1", "root", { root: f.root }),
    /must not persist literal private_inputs/,
  );
});

test("rg/grep regex parse error is recovered when retried on exact same paths, but unrecovered or different-path retries fail closed", (t) => {
  const f = fixture(t);
  addReadTurns(f, 2);
  const targetPaths = [path.join(f.root, artifact), path.join(f.root, "other.md")];
  const toolStarts = f.events.filter((e) => e.type === "tool.execution_start" && e.agentId === "worker-1");
  const toolCompletes = f.events.filter((e) => e.type === "tool.execution_complete" && e.agentId === "worker-1");

  toolStarts[0].data.toolName = "rg";
  toolStarts[0].data.arguments = { pattern: '"sheet_state": "(?!visible)', paths: targetPaths };
  toolCompletes[0].data.success = false;
  toolCompletes[0].data.error = {
    message: 'rg: regex parse error:\n    "sheet_state": "(?!visible)\nerror: look-around is not supported',
  };

  toolStarts[1].data.toolName = "rg";
  toolStarts[1].data.arguments = { pattern: '"sheet_state":', paths: structuredClone(targetPaths) };

  f.record();
  const saved = f.persisted();
  assert.deepEqual(saved.review_execution.recovered_read_calls, ["read-0"]);

  // Retrying on different paths must still fail closed.
  toolStarts[1].data.arguments = { pattern: '"sheet_state":', paths: [targetPaths[0]] };
  f.flush();
  assert.throws(() => extractReview(f.events, "worker-1", "root", { root: f.root }), /must complete successfully/);

  // Non-regex-parse errors on rg/grep (e.g. permission denied / execution failure) must still fail closed.
  toolStarts[1].data.arguments = { pattern: '"sheet_state":', paths: structuredClone(targetPaths) };
  toolCompletes[0].data.error = { message: "Permission denied" };
  f.flush();
  assert.throws(() => extractReview(f.events, "worker-1", "root", { root: f.root }), /must complete successfully/);
});
