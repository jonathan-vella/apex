// Subagent file-mode contract test (Phase 1 of context-window optimization).
//
// Asserts the contract that challenger-review-subagent and cost-estimate-subagent
// follow when writing structured output to disk and returning a compact summary
// to the parent. Driven by canned recordings under
// tools/tests/fixtures/subagent-file-contract/ — when real subagents are wired
// up, replace the fixtures with captured invocations.
//
// Contract assertions:
//   (a) summary message is <=2 KB and <=15 lines
//   (b) the declared file_path exists post-call
//   (c) summary numeric counts (must_fix_count, etc.) match the file content
//   (d) re-running without overwrite: true is rejected

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FIXTURE_DIR = new URL("./fixtures/subagent-file-contract/", import.meta.url).pathname;

const SUMMARY_BYTE_BUDGET = 2 * 1024;
const SUMMARY_LINE_BUDGET = 15;

function loadFixture(name) {
  const summaryPath = path.join(FIXTURE_DIR, `${name}.summary.txt`);
  const findingsPath = path.join(FIXTURE_DIR, `${name}.findings.json`);
  return {
    summary: fs.readFileSync(summaryPath, "utf8"),
    findings: JSON.parse(fs.readFileSync(findingsPath, "utf8")),
  };
}

function parseSummary(summary) {
  // The compact summary is a key: value block. Parse loose key=value lines.
  const out = {};
  for (const line of summary.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.+)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (/^-?\d+$/.test(val)) val = Number(val);
    out[m[1]] = val;
  }
  return out;
}

/**
 * Simulate a subagent's atomic write + refuse-on-exists semantics.
 * Returns { ok, error, file_path } so tests can assert behavior.
 */
function simulateSubagentWrite({ outputPath, payload, overwrite = false }) {
  if (!outputPath) {
    return { ok: false, error: "missing_output_path" };
  }
  if (fs.existsSync(outputPath) && !overwrite) {
    return { ok: false, error: "refuse_on_exists", file_path: outputPath };
  }
  const tmp = `${outputPath}.tmp`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
  fs.renameSync(tmp, outputPath);
  return { ok: true, file_path: outputPath };
}

describe("subagent file-mode contract", () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-contract-"));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("challenger-review-subagent fixture", () => {
    const fixture = loadFixture("challenger-review");

    it("(a) summary stays within byte and line budgets", () => {
      const bytes = Buffer.byteLength(fixture.summary, "utf8");
      const lines = fixture.summary.split(/\r?\n/).filter((l) => l.length).length;
      assert.ok(bytes <= SUMMARY_BYTE_BUDGET, `summary is ${bytes} bytes; budget is ${SUMMARY_BYTE_BUDGET}`);
      assert.ok(lines <= SUMMARY_LINE_BUDGET, `summary has ${lines} non-empty lines; budget is ${SUMMARY_LINE_BUDGET}`);
    });

    it("(b) the declared file_path exists post-call", () => {
      const outputPath = path.join(tmpDir, "challenge-findings-architecture-pass1.json");
      const result = simulateSubagentWrite({
        outputPath,
        payload: fixture.findings,
      });
      assert.equal(result.ok, true);
      assert.equal(result.file_path, outputPath);
      assert.ok(fs.existsSync(outputPath), "output file was not created");
    });

    it("(c) summary numeric counts match the file content", () => {
      const summary = parseSummary(fixture.summary);
      assert.equal(summary.must_fix_count, fixture.findings.must_fix_count, "must_fix_count mismatch");
      assert.equal(summary.should_fix_count, fixture.findings.should_fix_count, "should_fix_count mismatch");
      assert.equal(summary.suggestion_count, fixture.findings.suggestion_count, "suggestion_count mismatch");
      assert.equal(summary.risk_level, fixture.findings.risk_level, "risk_level mismatch");
    });

    it("(d) re-running without overwrite: true is rejected", () => {
      const outputPath = path.join(tmpDir, "challenge-findings-architecture-pass1-rerun.json");
      // Initial write succeeds.
      const first = simulateSubagentWrite({
        outputPath,
        payload: fixture.findings,
      });
      assert.equal(first.ok, true);
      // Second write without overwrite is refused.
      const second = simulateSubagentWrite({
        outputPath,
        payload: fixture.findings,
      });
      assert.equal(second.ok, false);
      assert.equal(second.error, "refuse_on_exists");
      // Third write with overwrite: true succeeds.
      const third = simulateSubagentWrite({
        outputPath,
        payload: fixture.findings,
        overwrite: true,
      });
      assert.equal(third.ok, true);
    });
  });

  describe("cost-estimate-subagent fixture", () => {
    const fixture = loadFixture("cost-estimate");

    it("(a) summary stays within byte and line budgets", () => {
      const bytes = Buffer.byteLength(fixture.summary, "utf8");
      const lines = fixture.summary.split(/\r?\n/).filter((l) => l.length).length;
      assert.ok(bytes <= SUMMARY_BYTE_BUDGET);
      assert.ok(lines <= SUMMARY_LINE_BUDGET);
    });

    it("(b) the declared file_path exists post-call", () => {
      const outputPath = path.join(tmpDir, "02-cost-estimate.json");
      const result = simulateSubagentWrite({
        outputPath,
        payload: fixture.findings,
      });
      assert.equal(result.ok, true);
      assert.ok(fs.existsSync(outputPath));
    });

    it("(c) summary totals match the file content", () => {
      const summary = parseSummary(fixture.summary);
      assert.equal(Number(summary.monthly_total.toString().replace(/[$,]/g, "")), fixture.findings.monthly_total);
      assert.equal(summary.region, fixture.findings.region);
      assert.equal(summary.status, fixture.findings.status);
    });

    it("(d) refuse-on-exists also applies to cost estimates", () => {
      const outputPath = path.join(tmpDir, "02-cost-estimate-rerun.json");
      const first = simulateSubagentWrite({
        outputPath,
        payload: fixture.findings,
      });
      assert.equal(first.ok, true);
      const second = simulateSubagentWrite({
        outputPath,
        payload: fixture.findings,
      });
      assert.equal(second.ok, false);
      assert.equal(second.error, "refuse_on_exists");
    });
  });
});
