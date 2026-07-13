import type { QualityScorecardV1 } from "@apex/contracts";
import { markdownTable, optional } from "./markdown.js";

export interface ScorecardMeasurement {
  readonly metric: string;
  readonly scenario: string;
  readonly value?: number;
  readonly samples: number;
}

export type ScorecardDecision = "pass" | "fail" | "omitted";

export interface ScorecardEvaluation {
  readonly metric: string;
  readonly scenario: string;
  readonly decision: ScorecardDecision;
  readonly value?: number;
  readonly samples: number;
  readonly reason: string;
}

function unavailableDecision(unavailable: "block" | "omit-claim"): ScorecardDecision {
  return unavailable === "block" ? "fail" : "omitted";
}

export function evaluateQualityScorecard(
  scorecard: QualityScorecardV1,
  measurements: readonly ScorecardMeasurement[],
): readonly ScorecardEvaluation[] {
  const indexed = new Map(measurements.map((item) => [`${item.metric}\u0000${item.scenario}`, item]));
  return [...scorecard.rules]
    .sort((left, right) =>
      `${left.metric}\u0000${left.scenario}`.localeCompare(`${right.metric}\u0000${right.scenario}`),
    )
    .map((rule): ScorecardEvaluation => {
      const measurement = indexed.get(`${rule.metric}\u0000${rule.scenario}`);
      if (measurement === undefined || measurement.value === undefined || !Number.isFinite(measurement.value)) {
        return {
          metric: rule.metric,
          scenario: rule.scenario,
          decision: unavailableDecision(rule.unavailable),
          samples: measurement?.samples ?? 0,
          reason: "measurement unavailable",
        };
      }
      if (measurement.samples < rule.minimumSamples) {
        return {
          metric: rule.metric,
          scenario: rule.scenario,
          decision: unavailableDecision(rule.unavailable),
          value: measurement.value,
          samples: measurement.samples,
          reason: `requires at least ${rule.minimumSamples} samples`,
        };
      }
      const passed =
        rule.direction === "min"
          ? measurement.value >= rule.target - rule.tolerance
          : rule.direction === "max"
            ? measurement.value <= rule.target + rule.tolerance
            : Math.abs(measurement.value - rule.target) <= rule.tolerance;
      return {
        metric: rule.metric,
        scenario: rule.scenario,
        decision: passed ? "pass" : "fail",
        value: measurement.value,
        samples: measurement.samples,
        reason: passed ? "target satisfied" : "target not satisfied",
      };
    });
}

export function renderQualityScorecardEvaluation(
  scorecard: QualityScorecardV1,
  measurements: readonly ScorecardMeasurement[],
): string {
  const evaluations = evaluateQualityScorecard(scorecard, measurements);
  const rules = new Map(scorecard.rules.map((rule) => [`${rule.metric}\u0000${rule.scenario}`, rule]));
  const rows = evaluations.map((evaluation) => {
    const rule = rules.get(`${evaluation.metric}\u0000${evaluation.scenario}`)!;
    return [
      evaluation.metric,
      evaluation.scenario,
      rule.direction,
      rule.target,
      rule.tolerance,
      optional(evaluation.value),
      `${evaluation.samples}/${rule.minimumSamples}`,
      evaluation.decision.toUpperCase(),
      evaluation.reason,
    ];
  });
  return [
    "# Quality Scorecard Evaluation",
    "",
    `- **Frozen at:** ${scorecard.frozenAt}`,
    "",
    markdownTable(
      ["Metric", "Scenario", "Direction", "Target", "Tolerance", "Value", "Samples", "Decision", "Reason"],
      rows,
    ),
  ].join("\n");
}
