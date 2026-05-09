/**
 * Workflow-handoff fixture driver.
 *
 * Two parts:
 *   1. Agent fixtures (B1a/B1b/B2/B3/B5 + B4 pair) — staged into
 *      `.github/agents/`, validator runs with `--only=workflow-handoffs`,
 *      findings are filtered per fixture file basename.
 *   2. Companion-file fixtures (3 synthetic 00-handoff.md) — staged into
 *      a synthetic agent-output project, `validate-artifacts.mjs` runs,
 *      we assert which findings appear (or not).
 *
 * Run: node --test tools/tests/workflow-handoffs/run.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const AGENT_FIXTURES = path.join(__dirname, "..", "fixtures", "workflow-handoffs", "agents");
const HANDOFF_FIXTURES = path.join(__dirname, "..", "fixtures", "workflow-handoffs", "handoffs");

/** Per-fixture rule expectations. Each fixture trips exactly one rule. */
const AGENT_EXPECTATIONS = {
  "fixture-bad-target.agent.md": {
    mustHave: ["workflow-handoff-target-001"],
    mustNotHave: ["workflow-handoff-self-loop-bound-001"],
  },
  "fixture-bad-artifact-sync.agent.md": {
    mustHave: ["workflow-handoff-artifact-sync-001"],
    mustNotHave: ["workflow-handoff-target-001"],
  },
  "fixture-bad-self-loop.agent.md": {
    mustHave: ["workflow-handoff-self-loop-bound-001"],
    mustNotHave: ["workflow-handoff-track-parity-001"],
  },
  "fixture-bad-subagent-dispatch.agent.md": {
    mustHave: ["workflow-handoff-subagent-dispatch-001"],
    mustNotHave: ["workflow-handoff-target-001"],
  },
};

/**
 * Run the validator with one or more fixtures staged into `.github/agents/`.
 * Cleanup is guaranteed via try/finally.
 */
function withStagedFixtures(fixturePaths, env, fn) {
  const staged = [];
  try {
    for (const fp of fixturePaths) {
      const dst = path.join(REPO_ROOT, ".github/agents", path.basename(fp));
      fs.copyFileSync(fp, dst);
      staged.push(dst);
    }
    return fn();
  } finally {
    for (const dst of staged) {
      try {
        fs.unlinkSync(dst);
      } catch {
        /* already gone */
      }
    }
  }
}

function runValidator(env = {}) {
  const result = spawnSync("node", ["tools/scripts/validate-agents.mjs", "--only=workflow-handoffs", "--format=json"], {
    encoding: "utf-8",
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
  });
  if (!result.stdout) {
    throw new Error(`validator produced no stdout (exit ${result.status}, stderr: ${result.stderr})`);
  }
  return JSON.parse(result.stdout);
}

for (const [fixture, exp] of Object.entries(AGENT_EXPECTATIONS)) {
  test(`agent fixture ${fixture}`, () => {
    const fixturePath = path.join(AGENT_FIXTURES, fixture);
    assert.ok(fs.existsSync(fixturePath), `Missing fixture: ${fixturePath}`);

    const findings = withStagedFixtures([fixturePath], {}, () => {
      const out = runValidator();
      return out.findings.filter((f) => f.file.endsWith(fixture));
    });

    const ruleIds = new Set(findings.map((f) => f.ruleId));
    for (const must of exp.mustHave) {
      assert.ok(ruleIds.has(must), `${fixture}: expected rule "${must}" to fire. Got: [${[...ruleIds].join(", ")}]`);
    }
    for (const mustNot of exp.mustNotHave) {
      assert.ok(
        !ruleIds.has(mustNot),
        `${fixture}: expected rule "${mustNot}" NOT to fire. Got: [${[...ruleIds].join(", ")}]`,
      );
    }
  });
}

test("agent fixture B4 track parity (pair)", () => {
  const a = path.join(AGENT_FIXTURES, "fixture-bad-track-parity-A.agent.md");
  const b = path.join(AGENT_FIXTURES, "fixture-bad-track-parity-B.agent.md");
  assert.ok(fs.existsSync(a) && fs.existsSync(b), "missing track-parity fixtures");

  // Stage both fixtures and inject the pair via env override so B4 picks them up.
  const findings = withStagedFixtures(
    [a, b],
    { WORKFLOW_HANDOFFS_TEST_TRACK_PAIRS: '[["fixture-track-parity-A","fixture-track-parity-B"]]' },
    () => {
      const out = runValidator({
        WORKFLOW_HANDOFFS_TEST_TRACK_PAIRS: '[["fixture-track-parity-A","fixture-track-parity-B"]]',
      });
      return out.findings.filter(
        (f) => f.ruleId === "workflow-handoff-track-parity-001" && /track-parity/.test(f.file),
      );
    },
  );

  assert.ok(findings.length >= 1, `expected B4 finding for fixture pair. Got: ${JSON.stringify(findings)}`);
});

// ─── Companion-file artifact rule (Phase C2) ─────────────────────────────────

/** Run validate-artifacts.mjs after staging a 00-handoff.md fixture. */
function runArtifactValidator(stagingProject, fixtureName) {
  const stageDir = path.join(REPO_ROOT, "agent-output", stagingProject);
  fs.mkdirSync(stageDir, { recursive: true });
  const stagedPath = path.join(stageDir, "00-handoff.md");
  fs.copyFileSync(path.join(HANDOFF_FIXTURES, fixtureName), stagedPath);
  try {
    const result = spawnSync("node", ["tools/scripts/validate-artifacts.mjs"], {
      encoding: "utf-8",
      cwd: REPO_ROOT,
    });
    return result.stdout + (result.stderr || "");
  } finally {
    try {
      fs.unlinkSync(stagedPath);
      // Remove the staging dir if empty.
      const remaining = fs.readdirSync(stageDir);
      if (remaining.length === 0) fs.rmdirSync(stageDir);
    } catch {
      /* ignore */
    }
  }
}

test("companion fixture g1-good-handoff.md passes", () => {
  const stagingProject = "_test-handoff-g1";
  const out = runArtifactValidator(stagingProject, "g1-good-handoff.md");
  // Must NOT report missing required H2s for our fixture; relaxed strictness
  // means warns are acceptable but the validator should not reject the file.
  assert.ok(
    !/00-handoff\.md is missing required H2 headings/.test(out),
    `g1-good-handoff.md should not report missing required H2s. Output:\n${out}`,
  );
});

test("companion fixture g2_5-good-handoff.md passes", () => {
  const out = runArtifactValidator("_test-handoff-g2_5", "g2_5-good-handoff.md");
  assert.ok(
    !/00-handoff\.md is missing required H2 headings/.test(out),
    `g2_5-good-handoff.md should not report missing required H2s. Output:\n${out}`,
  );
});

test("companion fixture g5-bad-handoff.md flags missing required H2s", () => {
  const out = runArtifactValidator("_test-handoff-g5", "g5-bad-handoff.md");
  // Relaxed strictness ⇒ warning, not error. Assert the warning fires.
  assert.match(
    out,
    /00-handoff\.md is missing required H2 headings/,
    `g5-bad-handoff.md should report missing required H2s. Output:\n${out}`,
  );
});
