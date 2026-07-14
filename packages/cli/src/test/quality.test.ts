import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { execute } from "../index.js";
import { tempRoot, writeJson } from "./helpers.js";

const scorecard = {
  schemaVersion: "1.0.0",
  frozenAt: "2026-07-13T00:00:00.000Z",
  rules: [
    {
      metric: "automated",
      direction: "min",
      target: 1,
      tolerance: 0,
      scenario: "ci",
      minimumSamples: 2,
      source: "kernel",
      owner: "test",
      unavailable: "block",
    },
    {
      metric: "manual",
      direction: "min",
      target: 1,
      tolerance: 0,
      scenario: "vscode",
      minimumSamples: 1,
      source: "vscode",
      owner: "test",
      unavailable: "omit-claim",
    },
  ],
};

test("quality evaluate writes deterministic artifacts and quality status reads them", async () => {
  const root = await tempRoot();
  const scorecardPath = join(root, "scorecard.json");
  const measurementsPath = join(root, "measurements.json");
  await writeJson(scorecardPath, scorecard);
  await writeJson(measurementsPath, {
    measurements: [{ metric: "automated", scenario: "ci", value: 1, samples: 2 }],
  });
  const result = (await execute(
    ["quality", "evaluate", "--measurements", measurementsPath, "--scorecard", scorecardPath],
    root,
  )) as { status: string };
  assert.equal(result.status, "pass");
  const first = await readFile(join(root, ".apex", "quality", "evaluation.json"));
  await execute(["quality", "evaluate", "--measurements", measurementsPath, "--scorecard", scorecardPath], root);
  assert.deepEqual(await readFile(join(root, ".apex", "quality", "evaluation.json")), first);
  const persistedMeasurements = JSON.parse(
    await readFile(join(root, ".apex", "quality", "measurements.json"), "utf8"),
  ) as { schemaVersion: string; measurements: Array<{ evidenceRefs: string[] }> };
  assert.equal(persistedMeasurements.schemaVersion, "1.0.0");
  assert.deepEqual(persistedMeasurements.measurements[0]?.evidenceRefs, []);
  assert.deepEqual(await execute(["quality", "status"], root), result);
  assert.match(
    await readFile(join(root, ".apex", "quality", "evaluation.md"), "utf8"),
    /OMITTED.*measurement unavailable/,
  );
});

test("quality evaluate persists and blocks unavailable required measurements", async () => {
  const root = await tempRoot();
  const scorecardPath = join(root, "scorecard.json");
  const measurementsPath = join(root, "measurements.json");
  await writeJson(scorecardPath, scorecard);
  await writeJson(measurementsPath, { measurements: [] });
  await assert.rejects(
    execute(["quality", "evaluate", "--measurements", measurementsPath, "--scorecard", scorecardPath], root),
    /scorecard evaluation failed/i,
  );
  const status = (await execute(["quality", "status"], root)) as { status: string };
  assert.equal(status.status, "fail");
});

test("quality evaluate does not pass when every claim is omitted", async () => {
  const root = await tempRoot();
  const scorecardPath = join(root, "scorecard.json");
  const measurementsPath = join(root, "measurements.json");
  await writeJson(scorecardPath, { ...scorecard, rules: [scorecard.rules[1]] });
  await writeJson(measurementsPath, { measurements: [] });
  await assert.rejects(
    execute(["quality", "evaluate", "--measurements", measurementsPath, "--scorecard", scorecardPath], root),
    /scorecard evaluation failed/i,
  );
  assert.equal(((await execute(["quality", "status"], root)) as { status: string }).status, "fail");
});
