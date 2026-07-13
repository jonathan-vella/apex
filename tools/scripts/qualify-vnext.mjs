#!/usr/bin/env node
/**
 * Run deterministic vNext qualification and evaluate the bundled quality scorecard.
 *
 * @example
 * node tools/scripts/qualify-vnext.mjs --repetitions 10
 */

import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const DEFAULT_REPETITIONS = 10;
const RELEASE_REPETITIONS = 30;

export function parseQualificationArguments(argv) {
  const options = {
    release: false,
    repetitions: undefined,
    collectedAt: undefined,
    indicators: undefined,
    output: join(ROOT, "dist", "vnext-qualification"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--release") options.release = true;
    else if (argument === "--repetitions") options.repetitions = Number(argv[++index]);
    else if (argument === "--collected-at") options.collectedAt = argv[++index];
    else if (argument === "--indicators") options.indicators = resolve(argv[++index]);
    else if (argument === "--output") options.output = resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  const minimum = options.release ? RELEASE_REPETITIONS : 1;
  options.repetitions ??= options.release ? RELEASE_REPETITIONS : DEFAULT_REPETITIONS;
  if (!Number.isInteger(options.repetitions) || options.repetitions < minimum)
    throw new Error(
      `Repetitions must be an integer of at least ${minimum}${options.release ? " in release mode" : ""}`,
    );
  if (options.collectedAt !== undefined && Number.isNaN(Date.parse(options.collectedAt)))
    throw new Error("--collected-at must be an ISO date-time");
  return options;
}

export function qualityArtifact(scorecard, measurements, evaluations) {
  return {
    schemaVersion: "1.0.0",
    status: evaluations.some(({ decision }) => decision === "fail") ? "fail" : "pass",
    scorecardFrozenAt: scorecard.frozenAt,
    measurements: measurements.length,
    evaluations,
  };
}

export async function runVnextQualification(options, dependencies) {
  const output = options.output;
  const workspace = join(output, "workspace");
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const reports = await dependencies.repeatQualificationReports(options.repetitions, async (iteration) =>
    dependencies.runQualification({
      workspaceRoot: join(workspace, `run-${String(iteration).padStart(3, "0")}`),
      customizationsSource: dependencies.customizationsSource,
    }),
  );
  const benchmark = dependencies.runQualificationBenchmark(100, dependencies.budgets);
  const indicators = options.indicators === undefined ? {} : JSON.parse(await readFile(options.indicators, "utf8"));
  const collectedAt = options.collectedAt ?? new Date().toISOString();
  const measurementSet = dependencies.collectQualificationMeasurements({
    reports,
    benchmarks: [benchmark],
    mutationResults: indicators.mutationResults,
    eventsByRun: indicators.eventsByRun,
    capabilityResults: indicators.capabilityResults,
    taskContextBytes: indicators.taskContextBytes,
    cacheResults: indicators.cacheResults,
    clock: () => new Date(collectedAt),
    commandVersions: dependencies.commandVersions,
    toolVersions: dependencies.toolVersions,
  });
  const evaluations = dependencies.evaluateQualityScorecard(dependencies.scorecard, measurementSet.measurements);
  const evaluation = qualityArtifact(dependencies.scorecard, measurementSet.measurements, evaluations);
  await writeJson(join(output, "qualification.json"), { schemaVersion: "1.0.0", reports, benchmark });
  await writeJson(join(output, "measurements.json"), measurementSet);
  await writeJson(join(output, "evaluation.json"), evaluation);
  await writeFile(
    join(output, "evaluation.md"),
    `${dependencies.renderQualityScorecardEvaluation(dependencies.scorecard, measurementSet.measurements)}\n`,
    "utf8",
  );
  return evaluation;
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseQualificationArguments(process.argv.slice(2));
  const testkit = await import("../../packages/testkit/dist/index.js");
  const renderers = await import("../../packages/renderers/dist/index.js");
  const scorecard = JSON.parse(
    await readFile(join(ROOT, "packages", "cli", "assets", "config", "quality-scorecard.v1.json"), "utf8"),
  );
  const runtime = JSON.parse(
    await readFile(join(ROOT, "packages", "cli", "assets", "config", "runtime-bundle.v1.json"), "utf8"),
  );
  const defaults = JSON.parse(
    await readFile(join(ROOT, "packages", "cli", "assets", "config", "defaults.v1.json"), "utf8"),
  );
  const evaluation = await runVnextQualification(options, {
    ...testkit,
    ...renderers,
    scorecard,
    customizationsSource: join(ROOT, "packages", "cli", "assets", "customizations"),
    budgets: {
      appendP95Ms: defaults.journalBenchmarks.budgetsMilliseconds.appendP95,
      replayP95Ms: defaults.journalBenchmarks.budgetsMilliseconds.replayP95,
      statusP95Ms: defaults.journalBenchmarks.budgetsMilliseconds.statusP95,
    },
    commandVersions: {
      cli: runtime.components.cli.version,
      kernel: runtime.components.kernel.version,
      testkit: "0.1.0",
    },
    toolVersions: { node: process.version },
  });
  process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`);
  process.exitCode = evaluation.status === "pass" ? 0 : 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
