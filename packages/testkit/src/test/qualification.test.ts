import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  collectQualificationMeasurements,
  qualificationJson,
  qualificationStatus,
  repeatQualificationReports,
  runQualification,
  runQualificationBenchmark,
  tempWorkspace,
} from "../index.js";

async function customizationSource(root: string): Promise<string> {
  const source = join(root, "customizations-source");
  await mkdir(join(source, ".github"), { recursive: true });
  await writeFile(join(source, "managed.txt"), "base\n", "utf8");
  await writeFile(join(source, ".github", "qualification.md"), "qualification\n", "utf8");
  return source;
}

test("qualification runs complete bicep and terraform reports", async (context) => {
  const root = await tempWorkspace(context, "apex-qualification-");
  const report = await runQualification({
    workspaceRoot: join(root, "repositories"),
    customizationsSource: await customizationSource(root),
  });
  assert.equal(report.status, "pass", JSON.stringify(report, null, 2));
  assert.deepEqual(
    report.tracks.map(({ track }) => track),
    ["bicep", "terraform"],
  );
  assert.ok(report.tracks.every(({ eventCount, hashes }) => eventCount > 0 && hashes.eventHead?.length === 64));
  assert.equal(report.tracks[0]?.hashes.logicalInventory, report.tracks[1]?.hashes.logicalInventory);
  assert.ok(report.checks.some(({ id }) => id === "logical-parity"));
  assert.equal(qualificationJson(report), qualificationJson(report));
});

test("qualification status detects failed checks", () => {
  assert.equal(qualificationStatus([{ id: "ok", status: "pass", durationMs: 1 }]), "pass");
  assert.equal(qualificationStatus([{ id: "fault", status: "fail", durationMs: 1, detail: "detected" }]), "fail");
});

test("benchmark compares caller-supplied budgets at configurable event count", () => {
  const passing = runQualificationBenchmark(20, {
    appendP95Ms: Number.MAX_VALUE,
    replayP95Ms: Number.MAX_VALUE,
    statusP95Ms: Number.MAX_VALUE,
  });
  assert.equal(passing.status, "pass");
  assert.equal(passing.metrics.iterations, 20);
  const failing = runQualificationBenchmark(5, { appendP95Ms: -1, replayP95Ms: -1, statusP95Ms: -1 });
  assert.equal(failing.status, "fail");
  assert.equal(failing.checks.filter(({ status }) => status === "fail").length, 3);
});

test("qualification measurements preserve unavailable evidence and deterministic provenance", async () => {
  const report = {
    schemaVersion: "1.0.0" as const,
    status: "pass" as const,
    durationMs: 100,
    tracks: ["bicep", "terraform"].map((track) => ({
      track: track as "bicep" | "terraform",
      status: "pass" as const,
      checks: [
        "initialize-customizations",
        "creative-workflow-gates-1-3",
        "preview-gate-4-deploy-inventory",
        "event-replay-object-hashes",
      ].map((id) => ({ id, status: "pass" as const, durationMs: 1 })),
      eventCount: 1,
      hashes: {},
    })),
    checks: [],
    eventCount: 2,
    hashes: {},
  };
  const reports = await repeatQualificationReports(2, async () => report);
  const first = collectQualificationMeasurements({
    reports,
    mutationResults: [{ escaped: false }, { escaped: true }],
    eventsByRun: [[{ type: "gate.decided", payload: { decision: "rejected" } }]],
    taskContextBytes: [10, 20],
    clock: () => new Date("2026-07-13T12:00:00.000Z"),
    commandVersions: { apex: "0.1.0" },
    toolVersions: { node: "24.0.0" },
  });
  const second = collectQualificationMeasurements({
    reports,
    mutationResults: [{ escaped: false }, { escaped: true }],
    eventsByRun: [[{ type: "gate.decided", payload: { decision: "rejected" } }]],
    taskContextBytes: [10, 20],
    clock: () => new Date("2026-07-13T12:00:00.000Z"),
    commandVersions: { apex: "0.1.0" },
    toolVersions: { node: "24.0.0" },
  });
  assert.deepEqual(first, second);
  assert.equal(first.measurements.find(({ metric }) => metric === "setup-completion-rate")?.samples, 4);
  assert.equal(first.measurements.find(({ metric }) => metric === "deterministic-validation-escape-rate")?.value, 0.5);
  assert.equal(first.measurements.find(({ metric }) => metric === "gate-revision-loops-per-run-p95")?.value, 1);
  assert.equal(first.measurements.find(({ metric }) => metric === "capability-failure-rate")?.value, undefined);
  assert.equal(first.measurements[0]?.provenance.inputReportHashes.length, 2);
  assert.equal(
    first.measurements.find(({ metric }) => metric === "deterministic-validation-escape-rate")?.provenance
      .inputReportHashes.length,
    1,
  );
});

test("repeat qualification rejects invalid sample counts", async () => {
  await assert.rejects(() => repeatQualificationReports(0, async () => assert.fail()), /positive integer/);
});
