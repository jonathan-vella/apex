import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { loadValidator } from "../../scripts/_lib/ajv-validator.mjs";

const script = fileURLToPath(new URL("../../scripts/validate-challenger-presence.mjs", import.meta.url));

test("native resume delegates recovery and routing without extra mode questions", () => {
  const native = readFileSync(
    new URL("../../../.github/prompts/apex-resume-workflow.prompt.md", import.meta.url),
    "utf8",
  );
  assert.match(native, /01-orchestrator.agent.md#resuming-a-project/);
  assert.doesNotMatch(native, /next-step-mode|current_step.status|\|\| cat|Graph Node →/);
  const attached = readFileSync(
    new URL("../../apex-prompts/workflow-prompts/00-resume-workflow.prompt.md", import.meta.url),
    "utf8",
  );
  assert.equal(native.split("[resume]:")[0].trim(), attached.split("[resume]:")[0].trim());
  assert.match(attached, /\.\.\/\.\.\/\.\.\/\.github\/agents\/01-orchestrator.agent.md#resuming-a-project/);
  const paths = readFileSync(new URL("../../scripts/_lib/paths.mjs", import.meta.url), "utf8");
  assert.match(paths, /PROMPT_SOURCE_DIRS = \["\.github\/prompts"/);
  const agent = readFileSync(new URL("../../../.github/agents/01-orchestrator.agent.md", import.meta.url), "utf8");
  assert.match(agent, /use an explicitly supplied project without reconfirming it/);
  assert.match(agent, /Do not require a session-state file before attempting recovery/);
  assert.match(agent, /applicable approval gate or exact handoff/);
});

test("decision presentation maps canonical fields and persists schema-valid Edit and empty notes", () => {
  const protocol = readFileSync(
    new URL("../../../.github/skills/apex-azure-defaults/references/adversarial-review-protocol.md", import.meta.url),
    "utf8",
  );
  assert.match(protocol, /title = claim/);
  assert.match(protocol, /description = evidence/);
  assert.match(protocol, /persist it as `accept` with the `Edit: ` note prefix/);
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
  for (const file of ["validate-policy-precheck.mjs", "_lib/reporter.mjs"]) {
    copyFileSync(new URL(`../../scripts/${file}`, import.meta.url), path.join(scripts, file));
  }
  const project = path.join(root, "agent-output/demo");
  mkdirSync(project, { recursive: true });
  const run = (envelopeStatus, status, deployGate) => {
    writeFileSync(
      path.join(project, "06-policy-precheck.json"),
      JSON.stringify({
        schema_version: "policy-precheck-v2",
        status,
        deploy_gate: deployGate,
        policies_that_will_block_deploy: [],
        what_if_summary: { policy_violations_in_what_if: 0 },
        attestation: { envelope_status: envelopeStatus },
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
  assert.equal(run("FRESH", "INFORMATIONAL", "PROCEED").status, 0);
  assert.equal(run("STALE", "INFORMATIONAL", "BLOCK").status, 0);
  assert.equal(run("STALE", "CLEAN", "PROCEED").status, 1);
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
  assert.match(challenger, /stop on unresolved `must_fix`/);
  assert.doesNotMatch(unattended, /E2E_BLOCKED|E2E harness|benchmark runs/);
  assert.match(
    read(".github/skills/apex-iac-common/references/iac-planner-approval-gate.md"),
    /No unattended setting waives this gate/,
  );
});

test("unavailable reviewers require human handoff without nested wrapper or retry reset", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const protocol = read(".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md");
  assert.match(protocol, /STOP\*\* and request a human handoff to `10-Challenger`/);
  assert.match(protocol, /disable-model-invocation: true/);
  assert.match(protocol, /Do not invoke it as a subagent/);
  assert.match(protocol, /retry exactly once with identical inputs/);
  assert.match(protocol, /Do not reset this budget by changing wrappers or models/);
  assert.doesNotMatch(protocol, /Retry once via the `10-Challenger`|#runSubagent|doubles input-token cost/);
  const gates = read(".github/skills/apex-azure-defaults/references/workflow-gates.md");
  assert.match(gates, /Before any retry/);
  assert.match(gates, /Retry exactly once\*\* with identical inputs/);
  assert.match(gates, /After the second failure\*\*: STOP/);
  assert.match(gates, /request a human handoff to `10-Challenger`/);
  assert.match(gates, /Do NOT call\s+the subagent a third time/);
});

test("Planner finding choices agree with its canonical approval reference", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const planner = read(".github/agents/05-iac-planner.agent.md");
  const gate = read(".github/skills/apex-iac-common/references/iac-planner-approval-gate.md");
  assert.match(planner, /canonical four-option payload \(Accept \/ Reject \/ Defer \/ Edit\)/);
  assert.doesNotMatch(planner, /carries Accept \/ Skip options|WAF-pillar default matrix/);
  assert.match(gate, /four-option payload per protocol section 2g/);
  assert.match(gate, /recommended = `Defer` for `should_fix`/);
});

test("Requirements fresh and resumed entry points preserve questions without forced restart", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const requirements = read(".github/agents/02-requirements.agent.md");
  const orchestrator = read(".github/agents/01-orchestrator.agent.md");
  assert.match(requirements, /For fresh capture/);
  assert.match(requirements, /### Resume and refinement/);
  assert.match(requirements, /A checkpoint\s+is not evidence that every required answer exists/);
  assert.match(requirements, /Preserve current manifest revisions and user pins/);
  assert.match(requirements, /do not invent manifest fields or rewrite unaffected SKU rows/);
  assert.match(requirements, /Changed requirements\s+invalidate affected review evidence/);
  assert.match(orchestrator, /on resume or refinement, recover recorded answers/);
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
  assert.match(architect, /Budget or SKU approval alone does not complete Step 2/);
  assert.match(architect, /phase_5_artifact` → `phase_6_challenger_pass\{N\}`/);
  assert.match(architect, /Legacy `phase_4_challenger` checkpoints/);
});

test("Architect batches independent finding questions without combining decisions", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  for (const file of [
    ".github/agents/03-architect.agent.md",
    ".github/skills/apex-azure-defaults/references/workflow-gates.md",
  ]) {
    const body = read(file);
    assert.match(body, /one batched `vscode_askQuestions` panel with a separate question per/);
    assert.match(body, /canonical action options/);
    assert.match(body, /panel cap/);
    assert.doesNotMatch(body, /One `vscode_askQuestions` call per finding|5 findings → 5 sequential/);
  }
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
    "Reject (accept risk)",
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
  assert.match(body, /Step 4 Plan review remains mandatory/);
  assert.match(body, /Do not rerun a valid completed review/);
  assert.match(body, /review_depth == "deep"/);
  assert.match(body, /cost-feasibility review at Step 2/);
  assert.match(body, /session\.steps/);
  assert.match(body, /Only after the\s+human gate is approved/);
  assert.ok(
    body.includes(
      "Run `/clear`, then switch the chat agent picker to `01-Orchestrator` and send `resume <project>` to continue Step N+1.",
    ),
  );
});

test("workflow graph and agent handoffs preserve review and validation floors", () => {
  const read = (relativePath) => readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");
  const graph = JSON.parse(read(".github/skills/apex-workflow-engine/templates/workflow-graph.json"));
  assert.deepEqual(graph.nodes["step-2"].challenger.default_lenses, ["comprehensive", "cost-feasibility"]);
  assert.equal(graph.nodes["step-2"].challenger.default_passes, 2);
  assert.match(JSON.stringify(graph.nodes["gate-2"].preconditions), /challenge-findings-cost-estimate.json/);
  const orchestrator = read(".github/agents/01-orchestrator.agent.md");
  assert.doesNotMatch(orchestrator, /Proceed directly to completion - Deploy agent will validate/);
  assert.match(orchestrator, /Complete CodeGen build, lint, security and handoff validation/);
  assert.match(orchestrator, /Complete CodeGen format, validate, security and handoff checks/);
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
