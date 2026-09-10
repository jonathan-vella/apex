import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("../../scripts/validate-challenger-presence.mjs", import.meta.url));

test("Requirements fresh and resumed entry points preserve questions without forced restart", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const requirements = read(".github/agents/02-requirements.agent.md");
  const orchestrator = read(".github/agents/01-orchestrator.agent.md");
  assert.match(requirements, /For fresh capture/);
  assert.match(requirements, /### Resume and refinement/);
  assert.match(requirements, /A checkpoint\s+is not evidence that every required answer exists/);
  assert.match(requirements, /Preserve current manifest revisions and user pins/);
  assert.match(requirements, /Changed requirements\s+invalidate affected review evidence/);
  assert.match(orchestrator, /on resume or refinement, recover recorded answers/);
  assert.doesNotMatch(orchestrator, /Your FIRST action must be calling askQuestions/);
});

test("Architect gate reference cannot skip mandatory cost review or complete after pricing alone", () => {
  const read = (file) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const reference = read(".github/skills/azure-defaults/references/workflow-gates.md");
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
    ".github/skills/azure-defaults/references/workflow-gates.md",
  ]) {
    const body = read(file);
    assert.match(body, /one batched `vscode_askQuestions` panel with a separate question per/);
    assert.match(body, /canonical action options/);
    assert.match(body, /panel cap/);
    assert.doesNotMatch(body, /One `vscode_askQuestions` call per finding|5 findings → 5 sequential/);
  }
  const protocol = read(".github/skills/azure-defaults/references/adversarial-review-protocol.md");
  assert.match(protocol, /^## Per-Finding Decision Protocol$/m);
  assert.ok(
    read(".github/skills/azure-defaults/references/workflow-gates.md").includes(
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
  const graph = JSON.parse(read(".github/skills/workflow-engine/templates/workflow-graph.json"));
  const skill = read(".github/skills/workflow-engine/SKILL.md");
  const reference = read(".github/skills/workflow-engine/references/dag-concepts.md");
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
  const graph = JSON.parse(read(".github/skills/workflow-engine/templates/workflow-graph.json"));
  assert.deepEqual(graph.nodes["step-2"].challenger.default_lenses, ["comprehensive", "cost-feasibility"]);
  assert.equal(graph.nodes["step-2"].challenger.default_passes, 2);
  assert.match(JSON.stringify(graph.nodes["gate-2"].preconditions), /challenge-findings-cost-estimate.json/);
  const orchestrator = read(".github/agents/01-orchestrator.agent.md");
  assert.doesNotMatch(orchestrator, /Proceed directly to completion - Deploy agent will validate/);
  assert.match(orchestrator, /Complete CodeGen build, lint, security and handoff validation/);
  assert.match(orchestrator, /Complete CodeGen format, validate, security and handoff checks/);
  const e2e = read(".github/agents/e2e-orchestrator.agent.md");
  assert.match(e2e, /failed governance retries[\s\S]{0,160}`E2E_BLOCKED`/);
  assert.doesNotMatch(e2e, /continue\s+with a WARNING that governance may be incomplete/);
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
