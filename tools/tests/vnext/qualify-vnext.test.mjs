import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseQualificationArguments, runVnextQualification } from "../../scripts/qualify-vnext.mjs";

const report = {
  schemaVersion: "1.0.0",
  status: "pass",
  durationMs: 10,
  tracks: [],
  checks: [],
  eventCount: 0,
  hashes: {},
};

test("qualifier applies practical CI and required release repetitions", () => {
  assert.equal(parseQualificationArguments([]).repetitions, 10);
  assert.equal(parseQualificationArguments(["--release"]).repetitions, 30);
  assert.throws(() => parseQualificationArguments(["--release", "--repetitions", "29"]), /at least 30/);
});

test("qualifier writes deterministic artifacts and blocks unavailable measurements", async () => {
  const root = await mkdtemp(join(tmpdir(), "apex-qualifier-test-"));
  const dependencies = {
    customizationsSource: root,
    budgets: { appendP95Ms: 1, replayP95Ms: 1, statusP95Ms: 1 },
    commandVersions: { cli: "test" },
    toolVersions: { node: "test" },
    scorecard: {
      schemaVersion: "1.0.0",
      frozenAt: "2026-07-13T00:00:00.000Z",
      rules: [
        {
          metric: "manual-required",
          direction: "min",
          target: 1,
          tolerance: 0,
          scenario: "vscode",
          minimumSamples: 1,
          source: "vscode",
          owner: "test",
          unavailable: "block",
        },
      ],
    },
    repeatQualificationReports: async (count, harness) =>
      Promise.all(Array.from({ length: count }, (_, index) => harness(index))),
    runQualification: async () => report,
    runQualificationBenchmark: () => ({ schemaVersion: "1.0.0", status: "pass", eventCount: 1 }),
    collectQualificationMeasurements: ({ clock, commandVersions, toolVersions }) => ({
      schemaVersion: "1.0.0",
      measurements: [
        {
          metric: "manual-required",
          scenario: "vscode",
          samples: 0,
          provenance: {
            source: "manual",
            scenario: "vscode",
            inputReportHashes: [],
            sampleCount: 0,
            collectedAt: clock().toISOString(),
            commandVersions,
            toolVersions,
          },
        },
      ],
    }),
    evaluateQualityScorecard: (_scorecard, measurements) => [
      {
        metric: measurements[0].metric,
        scenario: measurements[0].scenario,
        decision: "fail",
        samples: 0,
        reason: "measurement unavailable",
      },
    ],
    renderQualityScorecardEvaluation: () => "# Quality Scorecard Evaluation\n",
  };
  const options = {
    ...parseQualificationArguments(["--repetitions", "1", "--collected-at", "2026-07-13T12:00:00.000Z"]),
    output: join(root, "first"),
  };
  const first = await runVnextQualification(options, dependencies);
  assert.equal(first.status, "fail");
  const firstBytes = await Promise.all(
    ["qualification.json", "measurements.json", "evaluation.json", "evaluation.md"].map((file) =>
      readFile(join(options.output, file)),
    ),
  );
  const secondOutput = join(root, "second");
  await runVnextQualification({ ...options, output: secondOutput }, dependencies);
  const secondBytes = await Promise.all(
    ["qualification.json", "measurements.json", "evaluation.json", "evaluation.md"].map((file) =>
      readFile(join(secondOutput, file)),
    ),
  );
  assert.deepEqual(secondBytes, firstBytes);
});
