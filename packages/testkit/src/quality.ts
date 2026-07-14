import type { ScorecardMeasurement } from "@apex/renderers";
import { sha256Json } from "@apex/kernel";
import type { QualificationBenchmarkReport, QualificationReport, QualificationTrackReport } from "./qualification.js";

export interface QualificationMutationResult {
  readonly escaped: boolean;
}

export interface QualificationEvent {
  readonly type: string;
  readonly payload?: unknown;
}

export interface QualificationOutcome {
  readonly success: boolean;
}

export interface MeasurementProvenance {
  readonly source: string;
  readonly scenario: string;
  readonly inputReportHashes: readonly string[];
  readonly sampleCount: number;
  readonly collectedAt: string;
  readonly commandVersions: Readonly<Record<string, string>>;
  readonly toolVersions: Readonly<Record<string, string>>;
}

export interface QualificationMeasurement extends ScorecardMeasurement {
  readonly evidenceRefs: readonly string[];
  readonly provenance: MeasurementProvenance;
}

export interface ScorecardMeasurementSet {
  readonly schemaVersion: "1.0.0";
  readonly measurements: readonly QualificationMeasurement[];
}

export interface CollectQualificationMeasurementsOptions {
  readonly reports?: readonly QualificationReport[];
  readonly benchmarks?: readonly QualificationBenchmarkReport[];
  readonly mutationResults?: readonly QualificationMutationResult[];
  readonly eventsByRun?: readonly (readonly QualificationEvent[])[];
  readonly capabilityResults?: readonly QualificationOutcome[];
  readonly taskContextBytes?: readonly number[];
  readonly cacheResults?: readonly QualificationOutcome[];
  readonly clock: () => Date;
  readonly commandVersions: Readonly<Record<string, string>>;
  readonly toolVersions: Readonly<Record<string, string>>;
}

const SCENARIOS = {
  setup: "clean-install-supported-host",
  firstTask: "walking-skeleton-first-requirements-task",
  elapsed: "fake-provider-secure-storage-apply",
  resume: "restart-after-each-gate-and-resume",
  mutation: "contract-security-and-state-mutation-suite",
  gateLoops: "representative-bicep-and-terraform-fixtures",
  capability: "fake-provider-fault-injection-and-release-sandbox",
  context: "largest-bounded-task-projection",
  cache: "mutate-every-cache-key-dependency",
} as const;

export async function repeatQualificationReports(
  repetitions: number,
  harness: (iteration: number) => Promise<QualificationReport>,
): Promise<readonly QualificationReport[]> {
  if (!Number.isInteger(repetitions) || repetitions < 1) throw new RangeError("repetitions must be a positive integer");
  const reports: QualificationReport[] = [];
  for (let iteration = 0; iteration < repetitions; iteration += 1) reports.push(await harness(iteration));
  return reports;
}

export function collectQualificationMeasurements(
  options: CollectQualificationMeasurementsOptions,
): ScorecardMeasurementSet {
  const reports = options.reports ?? [];
  const reportHashes = reports.map((report) => sha256Json(report));
  const measurements: QualificationMeasurement[] = [];
  addRate(
    measurements,
    "setup-completion-rate",
    SCENARIOS.setup,
    setupOutcomes(reports),
    "qualification-report",
    options,
    reportHashes,
  );
  addRate(
    measurements,
    "first-task-success-rate",
    SCENARIOS.firstTask,
    firstTaskOutcomes(reports),
    "qualification-report",
    options,
    reportHashes,
  );
  addValues(
    measurements,
    "workflow-elapsed-time-p95-milliseconds",
    SCENARIOS.elapsed,
    reports.map(({ durationMs }) => durationMs),
    "qualification-report",
    options,
    reportHashes,
    percentile95,
  );
  addRate(
    measurements,
    "restart-resume-success-rate",
    SCENARIOS.resume,
    resumeOutcomes(reports),
    "qualification-report",
    options,
    reportHashes,
  );
  addRate(
    measurements,
    "deterministic-validation-escape-rate",
    SCENARIOS.mutation,
    options.mutationResults?.map(({ escaped }) => escaped) ?? [],
    "mutation-results",
    options,
    evidenceHashes(options.mutationResults),
    (values) => values.filter(Boolean).length / values.length,
  );
  addValues(
    measurements,
    "gate-revision-loops-per-run-p95",
    SCENARIOS.gateLoops,
    options.eventsByRun?.map(countGateLoops) ?? [],
    "event-journal",
    options,
    evidenceHashes(options.eventsByRun),
    percentile95,
  );
  addRate(
    measurements,
    "capability-failure-rate",
    SCENARIOS.capability,
    options.capabilityResults?.map(({ success }) => success) ?? [],
    "capability-results",
    options,
    evidenceHashes(options.capabilityResults),
    (values) => values.filter((success) => !success).length / values.length,
  );
  addValues(
    measurements,
    "task-context-bytes-p95",
    SCENARIOS.context,
    options.taskContextBytes ?? [],
    "task-context",
    options,
    evidenceHashes(options.taskContextBytes),
    percentile95,
  );
  addRate(
    measurements,
    "cache-correctness-rate",
    SCENARIOS.cache,
    options.cacheResults?.map(({ success }) => success) ?? [],
    "cache-results",
    options,
    evidenceHashes(options.cacheResults),
  );
  return { schemaVersion: "1.0.0", measurements };
}

function evidenceHashes(value: unknown): readonly string[] {
  return value === undefined ? [] : [sha256Json(value)];
}

function setupOutcomes(reports: readonly QualificationReport[]): boolean[] {
  return reports.flatMap(({ tracks }) =>
    tracks.flatMap(({ checks }) => observedCheck(checks, "initialize-customizations")),
  );
}

function firstTaskOutcomes(reports: readonly QualificationReport[]): boolean[] {
  return reports.flatMap(({ tracks }) =>
    tracks.flatMap(({ checks }) => observedCheck(checks, "creative-workflow-gates-1-3")),
  );
}

function resumeOutcomes(reports: readonly QualificationReport[]): boolean[] {
  return reports.flatMap(({ tracks }) =>
    tracks.flatMap(({ checks }) => {
      const resumeChecks = [
        "creative-workflow-gates-1-3",
        "preview-gate-4-deploy-inventory",
        "event-replay-object-hashes",
      ];
      const observed = resumeChecks.map((id) => checks.find((check) => check.id === id));
      return observed.some((check) => check === undefined) ? [] : [observed.every((check) => check?.status === "pass")];
    }),
  );
}

function observedCheck(checks: QualificationTrackReport["checks"], id: string): boolean[] {
  const check = checks.find((candidate) => candidate.id === id);
  return check === undefined ? [] : [check.status === "pass"];
}

function countGateLoops(events: readonly QualificationEvent[]): number {
  return events.filter(({ type, payload }) => {
    if (type === "gate.revision-requested") return true;
    if (type !== "gate.decided" || payload === null || typeof payload !== "object") return false;
    return (payload as { decision?: unknown }).decision === "rejected";
  }).length;
}

function addRate(
  target: QualificationMeasurement[],
  metric: string,
  scenario: string,
  outcomes: readonly boolean[],
  source: string,
  options: CollectQualificationMeasurementsOptions,
  hashes: readonly string[],
  aggregate = (values: readonly boolean[]) => values.filter(Boolean).length / values.length,
): void {
  addMeasurement(
    target,
    metric,
    scenario,
    outcomes.length === 0 ? undefined : aggregate(outcomes),
    outcomes.length,
    source,
    options,
    hashes,
  );
}

function addValues(
  target: QualificationMeasurement[],
  metric: string,
  scenario: string,
  values: readonly number[],
  source: string,
  options: CollectQualificationMeasurementsOptions,
  hashes: readonly string[],
  aggregate: (samples: readonly number[]) => number,
): void {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  addMeasurement(
    target,
    metric,
    scenario,
    valid.length === 0 ? undefined : aggregate(valid),
    valid.length,
    source,
    options,
    hashes,
  );
}

function addMeasurement(
  target: QualificationMeasurement[],
  metric: string,
  scenario: string,
  value: number | undefined,
  samples: number,
  source: string,
  options: CollectQualificationMeasurementsOptions,
  hashes: readonly string[],
): void {
  target.push({
    metric,
    scenario,
    ...(value === undefined ? {} : { value }),
    samples,
    evidenceRefs: [...hashes].sort(),
    provenance: {
      source,
      scenario,
      inputReportHashes: [...hashes].sort(),
      sampleCount: samples,
      collectedAt: options.clock().toISOString(),
      commandVersions: options.commandVersions,
      toolVersions: options.toolVersions,
    },
  });
}

function percentile95(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!;
}
