import assert from "node:assert/strict";
import test from "node:test";
import type { QualityScorecardV1 } from "@apex/contracts";
import { evaluateQualityScorecard, renderQualityScorecardEvaluation } from "../index.js";

const scorecard: QualityScorecardV1 = {
  schemaVersion: "1.0.0",
  frozenAt: "2026-07-01T00:00:00Z",
  rules: [
    {
      metric: "minimum",
      direction: "min",
      target: 90,
      tolerance: 2,
      scenario: "base",
      minimumSamples: 2,
      source: "kernel",
      owner: "quality",
      unavailable: "block",
    },
    {
      metric: "maximum",
      direction: "max",
      target: 10,
      tolerance: 1,
      scenario: "base",
      minimumSamples: 1,
      source: "kernel",
      owner: "quality",
      unavailable: "block",
    },
    {
      metric: "exact-pass",
      direction: "exact",
      target: 5,
      tolerance: 0.5,
      scenario: "base",
      minimumSamples: 1,
      source: "vscode",
      owner: "quality",
      unavailable: "block",
    },
    {
      metric: "exact-fail",
      direction: "exact",
      target: 5,
      tolerance: 0.5,
      scenario: "base",
      minimumSamples: 1,
      source: "vscode",
      owner: "quality",
      unavailable: "block",
    },
    {
      metric: "undersampled-block",
      direction: "min",
      target: 1,
      tolerance: 0,
      scenario: "base",
      minimumSamples: 3,
      source: "estimated",
      owner: "quality",
      unavailable: "block",
    },
    {
      metric: "undersampled-omit",
      direction: "min",
      target: 1,
      tolerance: 0,
      scenario: "base",
      minimumSamples: 3,
      source: "estimated",
      owner: "quality",
      unavailable: "omit-claim",
    },
    {
      metric: "missing-block",
      direction: "max",
      target: 1,
      tolerance: 0,
      scenario: "base",
      minimumSamples: 1,
      source: "kernel",
      owner: "quality",
      unavailable: "block",
    },
    {
      metric: "missing-omit",
      direction: "max",
      target: 1,
      tolerance: 0,
      scenario: "base",
      minimumSamples: 1,
      source: "kernel",
      owner: "quality",
      unavailable: "omit-claim",
    },
  ],
};

test("scorecard applies direction, tolerance, sample, and unavailable rules mechanically", () => {
  const measurements = [
    { metric: "minimum", scenario: "base", value: 88, samples: 2 },
    { metric: "maximum", scenario: "base", value: 11, samples: 1 },
    { metric: "exact-pass", scenario: "base", value: 5.5, samples: 1 },
    { metric: "exact-fail", scenario: "base", value: 5.51, samples: 1 },
    { metric: "undersampled-block", scenario: "base", value: 2, samples: 2 },
    { metric: "undersampled-omit", scenario: "base", value: 2, samples: 2 },
  ] as const;

  const byMetric = new Map(evaluateQualityScorecard(scorecard, measurements).map((item) => [item.metric, item]));
  assert.equal(byMetric.get("minimum")?.decision, "pass");
  assert.equal(byMetric.get("maximum")?.decision, "pass");
  assert.equal(byMetric.get("exact-pass")?.decision, "pass");
  assert.equal(byMetric.get("exact-fail")?.decision, "fail");
  assert.equal(byMetric.get("undersampled-block")?.decision, "fail");
  assert.equal(byMetric.get("undersampled-omit")?.decision, "omitted");
  assert.equal(byMetric.get("missing-block")?.decision, "fail");
  assert.equal(byMetric.get("missing-omit")?.decision, "omitted");
});

test("scorecard evaluation and Markdown ordering are deterministic", () => {
  const measurements = [
    { metric: "maximum", scenario: "base", value: 12, samples: 1 },
    { metric: "minimum", scenario: "base", value: 87.99, samples: 2 },
  ];
  const reversed: QualityScorecardV1 = { ...scorecard, rules: [...scorecard.rules].reverse() };

  assert.deepEqual(evaluateQualityScorecard(scorecard, measurements), evaluateQualityScorecard(reversed, measurements));
  const rendered = renderQualityScorecardEvaluation(scorecard, measurements);
  assert.equal(rendered, renderQualityScorecardEvaluation(reversed, [...measurements].reverse()));
  assert.match(rendered, /\| maximum \| base \| max \| 10 \| 1 \| 12 \| 1\/1 \| FAIL \|/);
  assert.match(rendered, /\| minimum \| base \| min \| 90 \| 2 \| 87.99 \| 2\/2 \| FAIL \|/);
});
