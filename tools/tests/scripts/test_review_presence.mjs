import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("../../scripts/validate-challenger-presence.mjs", import.meta.url));

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
