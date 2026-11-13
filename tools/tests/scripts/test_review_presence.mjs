import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { loadValidator } from "../../scripts/_lib/ajv-validator.mjs";
import { sha256File } from "../../scripts/_lib/json.mjs";

const script = fileURLToPath(new URL("../../scripts/validate-challenger-presence.mjs", import.meta.url));

function governanceCheckpoint(context) {
  const root = mkdtempSync(path.join(tmpdir(), "apex-governance-checkpoint-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, "agent-output/demo");
  mkdirSync(path.join(project, "_meta"), { recursive: true });
  const statePath = path.join(project, "_meta/00-session-state.json");
  const artifact = path.join(project, "04-governance-constraints.md");
  const state = {
    schema_version: "session-state-v3",
    layout_version: 2,
    project: "demo",
    steps: { 2: { status: "complete" }, 3: { status: "complete" }, "3_5": { status: "pending" } },
    decisions: {},
  };
  const badge = "![Status](https://img.shields.io/badge/Status-Owner_prepared_not_approved-orange?style=for-the-badge)";
  const save = () => writeFileSync(statePath, JSON.stringify(state));
  save();
  writeFileSync(artifact, `# Governance owner draft\n\n${badge}\n\n## Discovery Source\n\nUnapproved draft.\n`);
  return {
    project,
    statePath,
    artifact,
    state,
    badge,
    save,
    run: (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" }),
  };
}

test("pending unapproved Governance draft is publishable only in checkpoint mode without mutation", (context) => {
  const f = governanceCheckpoint(context);
  const before = readFileSync(f.statePath);
  const artifact = readFileSync(f.artifact);
  assert.equal(f.run().status, 1);
  const checkpoint = f.run("--publication-checkpoint");
  assert.equal(checkpoint.status, 0, checkpoint.stdout + checkpoint.stderr);
  assert.match(checkpoint.stdout, /checkpoint publication only/);
  assert.match(checkpoint.stdout, /review remains required/);
  assert.deepEqual(readFileSync(f.statePath), before);
  assert.deepEqual(readFileSync(f.artifact), artifact);
  assert.equal(f.run().status, 1);
});

for (const [label, mutate] of [
  ["completed Governance", (f) => (f.state.steps["3_5"].status = "complete")],
  ["stale Governance", (f) => (f.state.steps["3_5"].status = "stale")],
  ["completion timestamp", (f) => (f.state.steps["3_5"].completed = "historical-completion")],
  ["downstream plan started", (f) => (f.state.steps["4"] = { status: "in_progress" })],
  ["downstream code completed", (f) => (f.state.steps["5"] = { status: "complete" })],
  ["downstream deployment stale", (f) => (f.state.steps["6"] = { status: "stale" })],
  ["prior Governance attempt", (f) => (f.state.review_attempts = [{ step: "3_5", outcome: "failed" }])],
  ["legacy Governance review", (f) => (f.state.review_audit = { step_3_5: { passes_executed: 1 } })],
  ["consumed Governance cycle", (f) => (f.state.decisions.review_cycles = { cycle: { step: "3_5", calls: 1 } })],
  ["selected Governance review", (f) => (f.state.review_selections = { "3_5": { path: "review.json" } })],
  [
    "unreadable present review",
    (f) => writeFileSync(path.join(f.project, "challenge-findings-governance-constraints-pass1.json"), "invalid"),
  ],
  ["missing unapproved status", (f) => writeFileSync(f.artifact, "# Governance\n\nDraft text.\n")],
  ["fenced unapproved status", (f) => writeFileSync(f.artifact, `# Governance\n\n\`\`\`md\n${f.badge}\n\`\`\`\n`)],
  ["commented unapproved status", (f) => writeFileSync(f.artifact, `# Governance\n\n<!--\n${f.badge}\n-->\n`)],
  ["unclosed commented status", (f) => writeFileSync(f.artifact, `# Governance\n\n<!--\n${f.badge}\n`)],
]) {
  test(`checkpoint mode cannot excuse ${label}`, (context) => {
    const f = governanceCheckpoint(context);
    mutate(f);
    f.save();
    assert.equal(f.run("--publication-checkpoint").status, 1);
  });
}

test("zero legacy review count does not invent an executed Governance review", (context) => {
  const f = governanceCheckpoint(context);
  f.state.review_audit = { step_3_5: { passes_executed: 0 } };
  f.save();
  assert.equal(f.run("--publication-checkpoint").status, 0);
});

for (const directory of ["", "reviews"]) {
  for (const [filename, body] of [
    ["challenge-findings-governance-constraints-pass3.json", "invalid"],
    ["challenge-findings-governance-constraints-closure1.json", "invalid"],
    ["challenge-findings-governance-constraints.json", '{"findings":[]}'],
  ]) {
    test(`live Governance evidence blocks the draft exception: ${directory || "legacy root"}/${filename}`, (context) => {
      const f = governanceCheckpoint(context);
      if (!directory) delete f.state.layout_version;
      f.save();
      const location = path.join(f.project, directory);
      mkdirSync(location, { recursive: true });
      writeFileSync(path.join(location, filename), body);
      assert.equal(f.run("--publication-checkpoint").status, 1);
    });
  }
}

test("HTML comments cannot hide header boundaries before a visible draft badge", (context) => {
  const f = governanceCheckpoint(context);
  writeFileSync(f.artifact, `# Governance\n\n<!--\n## Not a rendered heading\n-->\n\n${f.badge}\n`);
  assert.equal(f.run("--publication-checkpoint").status, 0);
});

test("non-live archived sidecars are not promoted into current review evidence", (context) => {
  const f = governanceCheckpoint(context);
  writeFileSync(path.join(f.project, "_meta/challenge-findings-governance-constraints-pass3.json"), "archived draft");
  assert.equal(f.run("--publication-checkpoint").status, 0);
});

test("checkpoint mode does not waive other missing reviews", (context) => {
  const f = governanceCheckpoint(context);
  writeFileSync(path.join(f.project, "01-requirements.md"), "# Requirements\n");
  const result = f.run("--publication-checkpoint");
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /Step 1 Requirements/);
});

function assessmentDraft(context) {
  const f = governanceCheckpoint(context);
  rmSync(f.artifact);
  f.state.steps = { 1: { status: "pending" }, 2: { status: "pending" } };
  f.state.decisions.workflow_mode = "assessment";
  f.state.assessment_run = {
    schema_version: "assessment-run-v1",
    scenario: "requirements_led",
    source: "iac",
    scope: { categories: ["configuration"], iac_paths: ["infra/example"], azure_scopes: [] },
    reporting: {
      as_of: "2026-11-11T00:00:00Z",
      currency: null,
      periods: [{ id: "previous_month", from: "2026-10-01", to: "2026-10-31" }],
    },
    receipt: { owner: "Fixture", request_id: "scope-fixture", approved: true },
    phase: "review",
    status: "in_progress",
    completed_phases: ["scope", "requirements", "evidence", "analysis", "diagram"],
    scope_digest: "a".repeat(64),
    frozen_inputs: { "02-architecture-assessment.md": "b".repeat(64) },
    review_links: {},
    coverage: "partial",
    started_at: "2026-11-11T00:00:00Z",
  };
  writeFileSync(path.join(f.project, "01-requirements.md"), "# Assessment requirements\n");
  writeFileSync(path.join(f.project, "02-architecture-assessment.md"), "# WAF draft\n");
  f.save();
  return f;
}

test("standalone review drafts publish without inventing delivery reviews or mutating state", (context) => {
  const f = assessmentDraft(context);
  const before = readFileSync(f.statePath);
  for (const args of [[], ["--publication-checkpoint"]]) {
    const result = f.run(...args);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /independent WAF and cost reviews remain required/);
  }
  assert.deepEqual(readFileSync(f.statePath), before);
});

for (const [label, mutate] of [
  ["missing run", (f) => delete f.state.assessment_run],
  ["missing explicit route", (f) => delete f.state.decisions.workflow_mode],
  ["invalid receipt", (f) => (f.state.assessment_run.receipt.approved = false)],
  ["invalid phase", (f) => (f.state.assessment_run.phase = "unknown")],
  ["downstream delivery history", (f) => (f.state.steps[4] = { status: "complete" })],
  ["delivery artifact", (f) => writeFileSync(path.join(f.project, "04-implementation-plan.md"), "# Plan\n")],
  ["acceptance without reviews", (f) => (f.state.assessment_run.phase = "acceptance")],
  ["terminal without acceptance", (f) => (f.state.assessment_run.phase = "terminal")],
]) {
  test(`standalone draft routing rejects ${label}`, (context) => {
    const f = assessmentDraft(context);
    mutate(f);
    f.save();
    assert.equal(f.run("--publication-checkpoint").status, 1);
  });
}

test("accepted assessments require both recorded review files and unchanged hashes", (context) => {
  const f = assessmentDraft(context);
  const run = f.state.assessment_run;
  f.state.steps[1].status = "complete";
  f.state.steps[2].status = "complete";
  f.state.steps[3] = { status: "complete" };
  run.status = "accepted";
  run.phase = "terminal";
  run.acceptance = { owner: "Fixture", request_id: "accept-fixture", approved: true };
  run.accepted_at = "2026-11-12T00:00:00Z";
  run.completed_phases.push("review", "acceptance");
  mkdirSync(path.join(f.project, "reviews"));
  run.reviews = ["comprehensive", "cost-feasibility"].map((lens) => {
    const relative = `reviews/challenge-findings-${lens}.json`;
    const target = path.join(f.project, relative);
    writeFileSync(target, JSON.stringify({ review_focus: lens }));
    return { lens, cycle_id: "c".repeat(64), path: relative, sha256: sha256File(target) };
  });
  f.save();
  assert.equal(f.run().status, 0);
  const review = path.join(f.project, run.reviews[1].path);
  writeFileSync(review, "{}");
  assert.equal(f.run("--publication-checkpoint").status, 1);
  rmSync(review);
  assert.equal(f.run().status, 1);

  // Path-traversal recorded.path and missing run.reviews on terminal/accepted runs must also fail.
  const outside = path.join(f.project, "../outside-review.json");
  writeFileSync(outside, JSON.stringify({ review_focus: "cost-feasibility" }));
  run.reviews[1] = {
    lens: "cost-feasibility",
    cycle_id: "c".repeat(64),
    path: "../outside-review.json",
    sha256: sha256File(outside),
  };
  f.save();
  assert.equal(f.run().status, 1);
  delete run.reviews;
  f.save();
  assert.equal(f.run().status, 1);

  // Symlinked intermediate directory (`reviews/` -> outside dir) must be rejected.
  const externalDir = path.join(f.project, "../external-reviews");
  mkdirSync(externalDir, { recursive: true });
  const externalWaf = path.join(externalDir, "challenge-findings-comprehensive.json");
  const externalCost = path.join(externalDir, "challenge-findings-cost-feasibility.json");
  writeFileSync(externalWaf, JSON.stringify({ review_focus: "comprehensive" }));
  writeFileSync(externalCost, JSON.stringify({ review_focus: "cost-feasibility" }));
  rmSync(path.join(f.project, "reviews"), { recursive: true, force: true });
  symlinkSync(externalDir, path.join(f.project, "reviews"), "dir");
  run.reviews = [
    {
      lens: "comprehensive",
      cycle_id: "c".repeat(64),
      path: "reviews/challenge-findings-comprehensive.json",
      sha256: sha256File(externalWaf),
    },
    {
      lens: "cost-feasibility",
      cycle_id: "d".repeat(64),
      path: "reviews/challenge-findings-cost-feasibility.json",
      sha256: sha256File(externalCost),
    },
  ];
  f.save();
  assert.equal(f.run().status, 1);
});

test("acceptance phase accepts explicitly linked canonical_path fallback and rejects unlinked missing current_path", (context) => {
  const f = assessmentDraft(context);
  const run = f.state.assessment_run;
  run.phase = "acceptance";
  run.completed_phases.push("review");
  mkdirSync(path.join(f.project, "reviews"), { recursive: true });
  writeFileSync(
    path.join(f.project, "reviews/challenge-findings-architecture.json"),
    JSON.stringify({ review_focus: "comprehensive" }),
  );
  writeFileSync(
    path.join(f.project, "reviews/challenge-findings-cost-estimate.json"),
    JSON.stringify({ review_focus: "cost-feasibility" }),
  );
  const wafId = "a".repeat(64);
  const costId = "b".repeat(64);
  f.state.decisions.review_cycles = {
    [wafId]: {
      step: "2",
      artifact: "agent-output/demo/02-architecture-assessment.md",
      lens: "comprehensive",
      pass_number: 1,
      canonical_path: "agent-output/demo/reviews/challenge-findings-architecture.json",
      initial_id: "init-waf",
      projection: "1".repeat(64),
      calls: 1,
      max_calls: 2,
    },
    [costId]: {
      step: "2",
      artifact: "agent-output/demo/03-cost-management-report.md",
      lens: "cost-feasibility",
      pass_number: 1,
      canonical_path: "agent-output/demo/reviews/challenge-findings-cost-estimate.json",
      initial_id: "init-cost",
      projection: "1".repeat(64),
      calls: 1,
      max_calls: 2,
    },
  };
  // Without explicit review_links, missing current_path is rejected.
  f.save();
  assert.equal(f.run().status, 1);

  // With explicit review_links (adopted cycle), canonical_path basename fallback succeeds.
  run.review_links = {
    comprehensive: {
      cycle_id: wafId,
      artifact: "02-architecture-assessment.md",
      original_artifact: "agent-output/demo/02-architecture-assessment.md",
      original_projection: "1".repeat(64),
      linked_at: "2026-11-11T00:00:00Z",
    },
    "cost-feasibility": {
      cycle_id: costId,
      artifact: "03-cost-management-report.md",
      original_artifact: "agent-output/demo/03-cost-management-report.md",
      original_projection: "1".repeat(64),
      linked_at: "2026-11-11T00:00:00Z",
    },
  };
  f.save();
  assert.equal(f.run().status, 0);
});

test("unknown publication arguments fail explicitly", (context) => {
  const f = governanceCheckpoint(context);
  const result = f.run("--publication-checkpoint", "--allow-missing");
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /Unsupported argument: --allow-missing/);
});

test("native resume delegates recovery and routing without extra mode questions", () => {
  const native = readFileSync(new URL("../../../.github/skills/apex-workflow-start/SKILL.md", import.meta.url), "utf8");
  assert.match(native, /apex-workflow-engine\/references\/workflow-entry.md/);
  assert.doesNotMatch(native, /next-step-mode|current_step.status|\|\| cat|Graph Node →/);
  const entry = readFileSync(
    new URL("../../../.github/skills/apex-workflow-engine/references/workflow-entry.md", import.meta.url),
    "utf8",
  );
  assert.match(entry, /01-orchestrator.agent.md#/);
  assert.ok(entry.includes("approval"));
  const paths = readFileSync(new URL("../../scripts/_lib/paths.mjs", import.meta.url), "utf8");
  assert.match(paths, /PROMPT_SOURCE_DIRS = \["\.github\/prompts"\]/);
  const agent = readFileSync(new URL("../../../.github/agents/01-orchestrator.agent.md", import.meta.url), "utf8");
  assert.match(agent, /supplied project name without redundant confirmation/);
  assert.match(agent, /If recall is empty[\s\S]{0,120}existing artifacts/);
  assert.ok(agent.includes("human approval"));
});

test("decision presentation maps canonical fields and persists schema-valid Edit and empty notes", () => {
  const protocol = readFileSync(
    new URL("../../../.github/skills/apex-azure-defaults/references/adversarial-review-protocol.md", import.meta.url),
    "utf8",
  );
  assert.match(protocol, /title = claim/);
  assert.match(protocol, /description = evidence/);
  assert.match(protocol, /persist it as `accept` with the `Edit:` note prefix followed by a space/);
  const validate = loadValidator(
    fileURLToPath(new URL("../../schemas/challenge-findings-decisions.schema.json", import.meta.url)),
  );
  const record = (action, note) => ({
    challenged_artifact: "agent-output/demo/04-implementation-plan.md",
    artifact_type: "implementation-plan",
    decisions: [{ issue_id: "abc12345", severity: "should_fix", title: "Example", action, note }],
  });
  assert.equal(validate(record("accept", "Edit: use approved custom value")), true, JSON.stringify(validate.errors));
  assert.equal(validate(record("defer", "")), true, JSON.stringify(validate.errors));
  assert.equal(validate(record("edit", null)), false);
});

test("review forms preflight redundant notes without removing conditional Edit guidance", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const protocol = read(".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md");
  const orchestrator = read(".github/agents/01-orchestrator.agent.md");
  const requirements = read(".github/agents/02-requirements.agent.md");
  const shared = read(".github/copilot-instructions.md");
  for (const body of [protocol, orchestrator]) {
    assert.ok(body.includes("copilot-instructions.md#user-question-forms"));
  }
  assert.ok(shared.includes("validate_question_batching.py --form <scoped-form.json>"));
  assert.match(shared, /only the validated payload to `ask_user`/);
  for (const body of [orchestrator, requirements]) {
    assert.match(body, /unconditional (?:review )?companion note fields/);
    assert.match(body, /literal Edit without guidance or genuine ambiguity/);
    assert.match(body, /finding-specific follow-up/);
  }
  assert.match(requirements, /Preflight the pending review form/);
  assert.match(protocol, /Decision notes are persisted data, not additional questions/);
  assert.match(protocol, /Do not ask a follow-up when custom guidance is already present/);
  assert.match(protocol, /Batch all dependent Edit follow-ups into one form/);
  assert.match(protocol, /the same check from 2g/);
  assert.match(orchestrator, /another malformed response blocks/);
});

test("architecture repairs check the complete capability before pricing and another review", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const checklist = read(".github/skills/apex-azure-defaults/references/architect-validation-checklist.md");
  const closure = checklist.split("## Dependency-path closure before pricing or re-review\n")[1]?.split("\n## ")[0];
  assert.ok(closure);
  for (const dimension of [
    "Consumer and owner",
    "Identity",
    "Network and DNS",
    "Outbound dependencies",
    "Observability",
    "Recovery",
    "Cost and handoff",
  ]) {
    assert.ok(closure.includes(dimension), dimension);
  }
  for (const regression of [
    "no outbound path",
    "NAT alone",
    "TCP 1433",
    "explicit deny-all",
    "runtime status Unverified",
  ]) {
    assert.ok(closure.includes(regression), regression);
  }
  assert.match(closure, /freeze\s+the revised inputs/);
  assert.match(closure, /only affected cost lines/);
  assert.match(closure, /re-review only affected artifacts/);
  assert.match(closure, /outside the accepted repair returns to its owner/);
  for (const file of [
    ".github/agents/03-architect.agent.md",
    ".github/skills/apex-azure-defaults/references/pricing-guidance.md",
  ]) {
    assert.ok(
      read(file).includes("architect-validation-checklist.md#dependency-path-closure-before-pricing-or-re-review"),
    );
  }
});

test("policy precheck fails closed without fresh or explicitly stale envelope evidence", (context) => {
  const contract = readFileSync(
    new URL("../../../.github/skills/apex-iac-common/references/policy-precheck-contract.md", import.meta.url),
    "utf8",
  );
  assert.match(contract, /if render_failed or rest_failed or envelope_status not in \["FRESH", "STALE"\]:/);
  const root = mkdtempSync(path.join(tmpdir(), "apex-precheck-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const scripts = path.join(root, "tools/scripts");
  mkdirSync(path.join(scripts, "_lib"), { recursive: true });
  for (const file of ["validate-policy-precheck.mjs", "summarize-deployment-preview.mjs", "_lib/reporter.mjs"]) {
    copyFileSync(new URL(`../../scripts/${file}`, import.meta.url), path.join(scripts, file));
  }
  const project = path.join(root, "agent-output/demo");
  mkdirSync(project, { recursive: true });
  const run = (envelopeStatus, status, deployGate, severity = "NONE") => {
    writeFileSync(
      path.join(project, "06-policy-precheck.json"),
      JSON.stringify({
        schema_version: "policy-precheck-v2",
        status,
        deploy_gate: deployGate,
        policies_that_will_block_deploy: [],
        live_policies_missing_from_constraints: [],
        live_policies_newer_than_envelope: [],
        what_if_summary: { policy_violations_in_what_if: 0 },
        attestation: { envelope_status: envelopeStatus },
        drift_signal: {
          severity,
          accepted_by_residual_drift_policy: false,
          missing_from_constraints_count: 0,
          newer_than_envelope_count: 0,
        },
      }),
    );
    return spawnSync(process.execPath, [path.join(scripts, "validate-policy-precheck.mjs")], { encoding: "utf8" });
  };
  for (const envelope of [undefined, "MISSING", "UNKNOWN", "", null]) {
    const invalid = run(envelope, "CLEAN", "PROCEED");
    assert.equal(invalid.status, 1, String(envelope));
    assert.match(invalid.stdout + invalid.stderr, /Missing or invalid envelope evidence/);
    assert.equal(run(envelope, "FAILED", "BLOCK").status, 0);
  }
  assert.equal(run("FRESH", "CLEAN", "PROCEED").status, 0);
  assert.equal(run("FRESH", "INFORMATIONAL", "PROCEED", "INFORMATIONAL").status, 0);
  assert.equal(run("STALE", "INFORMATIONAL", "BLOCK").status, 0);
  assert.equal(run("STALE", "CLEAN", "PROCEED").status, 1);
  const legacy = (body) => {
    writeFileSync(path.join(project, "06-policy-precheck.json"), JSON.stringify(body));
    return spawnSync(process.execPath, [path.join(scripts, "validate-policy-precheck.mjs")], { encoding: "utf8" });
  };
  const withBlockers = legacy({
    status: "CLEAN",
    deploy_gate: "PROCEED",
    policies_that_will_block_deploy: ["policy-1"],
    what_if_summary: { policy_violations_in_what_if: 5 },
  });
  assert.equal(withBlockers.status, 1, "legacy CLEAN/PROCEED cannot list blocking policies");
  assert.equal(legacy({ status: "CLEAN", policies_that_will_block_deploy: [] }).status, 0);
});

test("unattended production reviews fail closed on unresolved blockers", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const protocol = read(".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md");
  const unattended = protocol.split("### 2d. Unattended mode")[1].split("### 2e.")[0];
  assert.match(unattended, /unresolved `must_fix` remains, \*\*STOP\*\*/);
  assert.match(unattended, /every production run/);
  assert.match(unattended, /current review evidence confirming resolution/);
  assert.match(unattended, /Never infer production approval/);
  assert.doesNotMatch(unattended, /Final aggregated gate auto-proceeds/);
  const challenger = read(".github/agents/10-challenger.agent.md");
  assert.doesNotMatch(challenger, /auto-proceed/);
  assert.match(challenger, /unresolved blockers prevent completion\/advancement/);
  assert.doesNotMatch(unattended, /E2E_BLOCKED|E2E harness|benchmark runs/);
  assert.match(
    read(".github/skills/apex-iac-common/references/iac-planner-approval-gate.md"),
    /No unattended setting waives this gate/,
  );
});

test("unavailable reviewers return to the parent without nested wrapper or retry reset", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const protocol = read(".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md");
  assert.match(
    protocol,
    /Automatic callers and optional `10-Challenger` use the same read-only\s+`challenger-review-subagent`/,
  );
  assert.match(protocol, /return the actual error to the interactive parent/);
  assert.match(protocol, /`10-Challenger` is optional manual recovery/);
  assert.match(protocol, /Do not invoke it as a fallback subagent/);
  assert.match(protocol, /retry exactly once with identical inputs/);
  assert.match(protocol, /Do not reset this budget by changing wrappers or models/);
  assert.match(protocol, /already the active owner, request human intervention instead\s+of a self-handoff/);
  assert.match(protocol, /Preserve exhausted retry status across handoffs and resumed sessions/);
  assert.match(protocol, /does not itself satisfy the review gate or renew the retry allowance/);
  const challenger = read(".github/agents/10-challenger.agent.md");
  assert.match(challenger, /No nested main wrappers/);
  assert.match(challenger, /Preserve invocation ceilings/);
  assert.match(challenger, /exhausted allowance/);
  assert.match(challenger, /execution failures block with actual error/);
  assert.doesNotMatch(protocol, /Retry once via the `10-Challenger`|#runSubagent|doubles input-token cost/);
  const gates = read(".github/skills/apex-azure-defaults/references/workflow-gates.md");
  assert.match(gates, /Before any retry/);
  assert.match(gates, /Retry exactly once\*\* with identical inputs/);
  assert.match(gates, /After the second failure\*\*: STOP/);
  assert.match(gates, /require a human recovery decision/);
  assert.match(gates, /Do NOT call\s+the subagent a third time/);
  assert.match(gates, /already active, request human intervention instead of a\s+self-handoff/);
  assert.match(gates, /neither human selection nor a new wrapper renews the retry allowance/);
  const guardrails = read(".github/skills/apex-agent-authoring/references/runtime-guardrails.md");
  assert.match(guardrails, /already active, stop and request human intervention/);
  assert.match(guardrails, /human selection does not renew the retry allowance/);
});

test("Planner finding choices agree with its canonical approval reference", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const planner = read(".github/agents/05-iac-planner.agent.md");
  const gate = read(".github/skills/apex-iac-common/references/iac-planner-approval-gate.md");
  assert.ok(planner.includes("iac-planner-approval-gate.md"));
  assert.match(planner, /per-finding panel/);
  assert.doesNotMatch(planner, /carries Accept \/ Skip options|WAF-pillar default matrix/);
  assert.match(gate, /four-option payload per protocol section 2g/);
  assert.match(gate, /recommended = `Defer` for `should_fix`/);
});

test("Requirements fresh and resumed entry points preserve questions without forced restart", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const requirements = read(".github/agents/02-requirements.agent.md");
  const orchestrator = read(".github/agents/01-orchestrator.agent.md");
  for (const field of ["ask_user", "USER_INPUT_REQUIRED", "request_id", "requestedSchema.properties", "On resume"])
    assert.ok(requirements.includes(field), field);
  assert.match(requirements, /checkpoint alone proves neither captured answers nor approval/);
  assert.match(requirements, /must not rewrite unaffected SKU rows or reset the manifest revision/);
  assert.match(requirements, /Changed inputs invalidate affected reviews and approvals/);
  assert.match(orchestrator, /Start recovery with `apex-recall show/);
  assert.doesNotMatch(orchestrator, /Your FIRST action must be calling askQuestions/);
});

test("Architect gate reference cannot skip mandatory cost review or complete after pricing alone", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const reference = read(".github/skills/apex-azure-defaults/references/workflow-gates.md");
  const gate = reference.split("## Architect (Step 2) — Cost-feasibility review gate")[1].split("\n## ")[0];
  assert.match(gate, /mandatory in default and deep modes/);
  assert.match(gate, /challenge-findings-cost-estimate.json/);
  assert.match(gate, /old `cost_feasibility_review: skip` decision is not an exemption/);
  assert.doesNotMatch(gate, /monthly_total >|Run iff|<run\|skip>/);
  const architect = read(".github/agents/03-architect.agent.md");
  for (const field of ["phase_5_artifact", "phase_6_challenger_pass{N}", "cost-feasibility"])
    assert.ok(architect.includes(field), field);
  assert.match(architect, /SKU or budget consent alone is insufficient/);
});

test("Architect batches independent finding questions without combining decisions", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const architect = read(".github/agents/03-architect.agent.md");
  for (const field of ["ask_user", "requestedSchema.properties", "Per-Finding Decision Protocol"])
    assert.ok(architect.includes(field), field);
  const gates = read(".github/skills/apex-azure-defaults/references/workflow-gates.md");
  assert.match(gates, /one batched `ask_user` panel with a separate question per/);
  assert.match(gates, /canonical action options/);
  for (const body of [architect, gates])
    assert.doesNotMatch(body, /One `ask_user` call per finding|5 findings → 5 sequential/);
  const protocol = read(".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md");
  assert.match(protocol, /^## Per-Finding Decision Protocol$/m);
  assert.ok(
    read(".github/skills/apex-azure-defaults/references/workflow-gates.md").includes(
      "adversarial-review-protocol.md#per-finding-decision-protocol",
    ),
  );
  assert.match(protocol, /build one batched panel/);
  for (const option of [
    "Accept (apply mitigation)",
    "Reject (do not apply)",
    "Defer (carry to handoff)",
    "Edit (custom guidance)",
  ]) {
    assert.ok(protocol.includes(option));
  }
});

test("routing guidance matches shared planning, refinement and resume contracts", () => {
  const read = (relativePath) => readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");
  const graph = JSON.parse(read(".github/skills/apex-workflow-engine/templates/workflow-graph.json"));
  const skill = read(".github/skills/apex-workflow-engine/SKILL.md");
  const reference = read(".github/skills/apex-workflow-engine/references/dag-concepts.md");
  for (const body of [skill, reference]) {
    assert.doesNotMatch(body, /step-4[bt]|no back-edges|use exactly one of/);
    assert.match(body, /return_edges/);
    assert.match(body, /session\.steps/);
    for (const [, node] of body.matchAll(/`(step-[\w]+)`/g)) assert.ok(graph.nodes[node], `unknown node ${node}`);
  }
  assert.equal((skill.match(/\*\*Load\*\* `templates\/workflow-graph.json`/g) ?? []).length, 1);
  assert.doesNotMatch(skill, /```text\s*1\. Load workflow-graph/);
  assert.match(skill, /preconditions/);
  assert.ok(graph.return_edges.some((edge) => edge.condition === "on_refine"));
});

test("orchestrator reuses valid reviews without bypassing plan or resume gates", () => {
  const body = readFileSync(new URL("../../../.github/agents/01-orchestrator.agent.md", import.meta.url), "utf8");
  assert.doesNotMatch(
    body,
    /All steps default to|Steps 4 and 5 \(Plan and Code\) \*\*skip|unless context is below 40%/,
  );
  assert.doesNotMatch(body, /Execute the current node's agent|infer the last completed step from artifact numbering/);
  assert.match(body, /Requirements\/Plan comprehensive/);
  assert.match(body, /retry a valid completed review/);
  assert.ok(body.includes("decisions.review_depth=deep"));
  assert.ok(body.includes("cost-feasibility"));
  assert.match(body, /session\.steps/);
  assert.ok(body.includes("human approval"));
  assert.doesNotMatch(body, /APEX_WORKER_HANDSHAKE|WORKER_READY|WORKER_EXECUTE|verify-worker-ready\.mjs/);
  assert.match(body, /apex-recall checkpoint/);
  assert.doesNotMatch(body, /Run `\/clear`, then switch the chat agent picker/);
});

test("workflow graph and native role ownership preserve review and validation floors without UI handoffs", () => {
  const read = (relativePath) => readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");
  const graph = JSON.parse(read(".github/skills/apex-workflow-engine/templates/workflow-graph.json"));
  assert.deepEqual(graph.nodes["step-2"].challenger.default_lenses, ["comprehensive", "cost-feasibility"]);
  assert.equal(graph.nodes["step-2"].challenger.default_passes, 2);
  assert.match(JSON.stringify(graph.nodes["gate-2"].preconditions), /challenge-findings-cost-estimate.json/);
  const orchestrator = read(".github/agents/01-orchestrator.agent.md");
  assert.doesNotMatch(orchestrator, /Proceed directly to completion - Deploy agent will validate/);
  for (const [step, owner] of [
    ["step-5b", "06b-Bicep CodeGen"],
    ["step-5t", "06t-Terraform CodeGen"],
  ]) {
    assert.equal(graph.nodes[step].agent, owner);
  }
});

for (const artifact of ["02-architecture-assessment.md", "03-des-cost-estimate.md"]) {
  test(`CI requires both reviews when ${artifact} exists`, (context) => {
    const root = mkdtempSync(path.join(tmpdir(), "apex-reviews-"));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    const project = path.join(root, "agent-output/demo");
    mkdirSync(project, { recursive: true });
    writeFileSync(path.join(project, artifact), "# Artifact\n");
    writeFileSync(path.join(project, "challenge-findings-architecture.json"), '{"findings": []}');
    const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
    const missing = run();
    assert.equal(missing.status, 1);
    assert.match(missing.stdout + missing.stderr, /challenge-findings-cost-estimate.json/);
    writeFileSync(path.join(project, "challenge-findings-cost-estimate.json"), "invalid");
    assert.equal(run().status, 1);
    writeFileSync(path.join(project, "challenge-findings-cost-estimate.json"), '{"findings": []}');
    assert.equal(run().status, 0);
    rmSync(path.join(project, "challenge-findings-architecture.json"));
    assert.equal(run().status, 1);
    writeFileSync(
      path.join(project, "00-session-state.json"),
      JSON.stringify({
        decisions: { challenger_skip: [{ step: "2", reason: "explicit legacy audit" }] },
      }),
    );
    assert.equal(run().status, 0);
  });
}

test("deep review requires architecture pass one and the independent cost review", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "apex-deep-review-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, "agent-output/demo");
  mkdirSync(project, { recursive: true });
  writeFileSync(path.join(project, "02-architecture-assessment.md"), "# Architecture\n");
  writeFileSync(path.join(project, "00-session-state.json"), JSON.stringify({ decisions: { review_depth: "deep" } }));
  writeFileSync(path.join(project, "challenge-findings-architecture.json"), '{"findings": []}');
  const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  const missing = run();
  assert.equal(missing.status, 1);
  assert.match(missing.stdout + missing.stderr, /challenge-findings-architecture-pass1.json/);
  writeFileSync(path.join(project, "challenge-findings-architecture-pass1.json"), '{"findings": []}');
  assert.equal(run().status, 1);
  writeFileSync(path.join(project, "challenge-findings-cost-estimate.json"), '{"findings": []}');
  assert.equal(run().status, 0);
});

for (const depth of ["default", "deep"]) {
  test(`CI Plan review presence matches ${depth} runtime mode`, (context) => {
    const root = mkdtempSync(path.join(tmpdir(), "apex-plan-mode-"));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    const project = path.join(root, "agent-output/demo");
    mkdirSync(project, { recursive: true });
    writeFileSync(path.join(project, "04-implementation-plan.md"), "# Plan\n");
    writeFileSync(path.join(project, "00-session-state.json"), JSON.stringify({ decisions: { review_depth: depth } }));
    const required = depth === "deep" ? "challenge-findings-plan-pass1.json" : "challenge-findings-plan.json";
    const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
    const missing = run();
    assert.equal(missing.status, 1);
    assert.match(missing.stdout + missing.stderr, new RegExp(required.replaceAll(".", "\\.")));
    writeFileSync(path.join(project, required), '{"findings": []}');
    assert.equal(run().status, 0);
  });
}
