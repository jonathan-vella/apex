import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));

function scratch(context) {
  const directory = mkdtempSync(path.join(tmpdir(), "apex-parent-validators-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function policyRunner(context) {
  const directory = scratch(context);
  const scripts = path.join(directory, "tools/scripts");
  mkdirSync(path.join(scripts, "_lib"), { recursive: true });
  for (const file of ["validate-policy-precheck.mjs", "_lib/reporter.mjs"]) {
    copyFileSync(path.join(root, "tools/scripts", file), path.join(scripts, file));
  }
  const output = path.join(directory, "agent-output/demo/06-policy-precheck.json");
  mkdirSync(path.dirname(output), { recursive: true });
  return (payload, args = []) => {
    writeFileSync(output, JSON.stringify(payload));
    return spawnSync(process.execPath, [path.join(scripts, "validate-policy-precheck.mjs"), ...args], {
      cwd: directory,
      encoding: "utf8",
    });
  };
}

const policy = () => ({
  schema_version: "policy-precheck-v2",
  status: "CLEAN",
  deploy_gate: "PROCEED",
  policies_that_will_block_deploy: [],
  what_if_summary: { policy_violations_in_what_if: 0 },
  attestation: { envelope_status: "FRESH" },
  drift_signal: { severity: "NONE", accepted_by_residual_drift_policy: false },
});

function expectStatus(result, expected, label = "") {
  assert.equal(result.status, expected, `${label}\n${result.stdout}${result.stderr}`);
}

test("AB-16 parent policy validator enforces the body's first-match gate and status table", (context) => {
  const run = policyRunner(context);
  const rows = [
    ["FRESH", "NONE", false, false, 0, "PROCEED", "CLEAN"],
    ["FRESH", "INFORMATIONAL", false, false, 0, "PROCEED", "INFORMATIONAL"],
    ["FRESH", "INFORMATIONAL", true, false, 0, "PROCEED", "CLEAN"],
    ["STALE", "INFORMATIONAL", true, false, 0, "BLOCK", "INFORMATIONAL"],
    ["FRESH", "BLOCKING", false, false, 0, "BLOCK", "BLOCKED"],
    ["STALE", "BLOCKING", true, false, 0, "BLOCK", "BLOCKED"],
    ["FRESH", "NONE", true, true, 0, "BLOCK", "BLOCKED"],
    ["STALE", "NONE", true, false, 1, "BLOCK", "BLOCKED"],
    ["MISSING", "BLOCKING", true, true, 1, "BLOCK", "FAILED"],
  ];
  for (const [envelope, severity, accepted, listed, violations, gate, status] of rows) {
    const payload = policy();
    payload.attestation.envelope_status = envelope;
    payload.drift_signal = { severity, accepted_by_residual_drift_policy: accepted };
    payload.policies_that_will_block_deploy = listed ? [{ effect: "deny" }] : [];
    payload.what_if_summary.policy_violations_in_what_if = violations;
    for (const candidateGate of ["PROCEED", "BLOCK"]) {
      for (const candidateStatus of ["CLEAN", "INFORMATIONAL", "BLOCKED", "FAILED"]) {
        payload.deploy_gate = candidateGate;
        payload.status = candidateStatus;
        const valid =
          (candidateGate === gate && candidateStatus === status) ||
          (candidateGate === "BLOCK" && candidateStatus === "FAILED");
        expectStatus(run(payload, ["--strict"]), valid ? 0 : 1, JSON.stringify(payload));
      }
    }
  }
});

test("AB-16 parent policy validator fails closed on unknown or malformed evidence", (context) => {
  const run = policyRunner(context);
  const mutations = [
    ...[undefined, null, "UNKNOWN", "", 0].map((severity) => (payload) => {
      payload.drift_signal.severity = severity;
    }),
    ...[undefined, null, [], "NONE"].map((signal) => (payload) => {
      payload.drift_signal = signal;
    }),
    ...[undefined, null, {}, "", false].map((blockers) => (payload) => {
      payload.policies_that_will_block_deploy = blockers;
    }),
    ...[undefined, null, "0", -1, 0.5, {}, false].map((count) => (payload) => {
      payload.what_if_summary.policy_violations_in_what_if = count;
    }),
    ...[undefined, null, "UNKNOWN", "", false].map((envelope) => (payload) => {
      payload.attestation.envelope_status = envelope;
    }),
    ...[null, "true", "false", 0, {}].map((accepted) => (payload) => {
      payload.drift_signal.accepted_by_residual_drift_policy = accepted;
    }),
  ];
  for (const mutate of mutations) {
    const payload = policy();
    mutate(payload);
    expectStatus(run(payload), 1, JSON.stringify(payload));
    payload.status = "FAILED";
    payload.deploy_gate = "BLOCK";
    expectStatus(run(payload), 0, JSON.stringify(payload));
  }
  for (const invalid of [null, [], "CLEAN", 1, true]) expectStatus(run(invalid), 1);
  for (const schema of [null, "", "policy-precheck-v3", {}, false]) {
    expectStatus(run({ ...policy(), schema_version: schema }), 1);
  }
  expectStatus(run({ ...policy(), status: "UNKNOWN" }), 1);
  expectStatus(run({ ...policy(), deploy_gate: "UNKNOWN" }), 1);
  const withoutAcceptance = policy();
  delete withoutAcceptance.drift_signal.accepted_by_residual_drift_policy;
  expectStatus(run(withoutAcceptance), 0);
  expectStatus(run({ status: "CLEAN" }), 0);
  expectStatus(run({ schema_version: "policy-precheck-v1", status: "DRIFT" }), 0);
  expectStatus(run({ schema_version: "policy-precheck-v1", status: "DRIFT" }, ["--strict"]), 1);
});

test("AB-21 parent challenger CLI validates explicit files and preserves scan selection", (context) => {
  const directory = scratch(context);
  const validator = path.join(root, "tools/scripts/validate-challenger-findings.mjs");
  const run = (...args) => spawnSync(process.execPath, [validator, ...args], { cwd: directory, encoding: "utf8" });
  const body = readFileSync(path.join(root, ".github/agents/_subagents/challenger-review-subagent.agent.md"), "utf8");
  const payload = JSON.parse(body.match(/```json\n(\{[\s\S]*?)\n```/)[1]);
  payload.artifact_type = "requirements";
  payload.review_focus = "comprehensive";
  payload.risk_level = "high";
  payload.must_fix_count = 1;
  payload.findings[0].severity = "must_fix";
  const temporary = path.join(directory, "findings with spaces.json.tmp");
  const output = path.join(directory, "agent-output/demo");
  const canonical = path.join(output, "challenge-findings-demo.json");

  expectStatus(run(), 0);
  mkdirSync(output, { recursive: true });
  expectStatus(run(), 0);
  expectStatus(run("--root", "agent-output"), 0);
  expectStatus(run("--path", "agent-output/demo"), 0);
  writeFileSync(temporary, JSON.stringify(payload));
  for (const args of [[temporary], ["--path", temporary], ["--", temporary], [path.basename(temporary)]]) {
    const result = run(...args);
    expectStatus(result, 0);
    assert.match(result.stdout, /Scanned 1 findings sidecar/);
  }
  writeFileSync(temporary, JSON.stringify({ batch_results: [payload, { ...payload, pass_number: 2 }] }));
  expectStatus(run(temporary), 0);
  for (const invalid of ["invalid JSON", '{"partial":', "{}", "null", JSON.stringify({ findings: [] })]) {
    writeFileSync(temporary, invalid);
    expectStatus(run(temporary), 1, invalid);
  }
  writeFileSync(temporary, JSON.stringify(payload));
  writeFileSync(canonical, "invalid JSON");
  for (const args of [[], ["--root", "agent-output"], ["agent-output/demo"], ["--path", canonical]]) {
    expectStatus(run(...args), 1);
  }
  expectStatus(run(temporary), 0);
  for (const args of [
    ["missing.json.tmp"],
    ["--path", "missing.json.tmp"],
    ["--root", "missing-directory"],
    [temporary, "missing.json.tmp"],
    ["--root", temporary],
    ["--path"],
    ["--root"],
    ["--unknown"],
    [""],
  ]) {
    const result = run(...args);
    expectStatus(result, 1, JSON.stringify(args));
    assert.doesNotMatch(result.stdout, /All challenger findings sidecars conform/);
  }
  writeFileSync(canonical, JSON.stringify(payload));
  writeFileSync(path.join(output, "challenge-findings-demo-decisions.json"), "excluded decisions");
  mkdirSync(path.join(output, "_meta"));
  writeFileSync(path.join(output, "_meta/challenge-findings-meta.json"), "excluded meta");
  writeFileSync(path.join(output, "challenge-findings-partial.json.tmp"), "excluded temp");
  for (const args of [[], ["--root", "agent-output"], ["--path", "agent-output/demo"]]) {
    const result = run(...args);
    expectStatus(result, 0);
    assert.match(result.stdout, /Scanned 1 findings sidecar/);
  }
  const deduplicated = run(canonical, canonical);
  expectStatus(deduplicated, 0);
  assert.match(deduplicated.stdout, /Scanned 1 findings sidecar/);
});
