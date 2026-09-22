#!/usr/bin/env node
/**
 * Workflow Baseline Measurement
 *
 * Wave-0 prerequisite (per plan-workflow-simplification.md). Aggregates
 * per-step telemetry across agent-output/{project}/00-session-state.json
 * files (specifically the steps[].telemetry field added to the
 * apex-recall checkpoint schema). Emits two outputs:
 *
 *   1. tmp/workflow-baseline.json   — raw per-step + per-project records
 *   2. tmp/workflow-baseline.md     — markdown summary table grouped by
 *                                      complexity tier (simple/standard/
 *                                      complex) and iac_tool.
 *
 * Telemetry shape (when present):
 *   steps["<key>"].telemetry = {
 *     step_start_iso, step_end_iso, elapsed_ms,
 *     input_tokens, output_tokens, subagent_count,
 *     validation_attempts, cache_hits
 *   }
 *
 * Projects missing telemetry are skipped (not errors) — measurement is
 * additive while teams retrofit existing fixtures.
 *
 * Usage:
 *   node tools/scripts/measure-workflow-baseline.mjs
 *   node tools/scripts/measure-workflow-baseline.mjs --filter simple
 *   node tools/scripts/measure-workflow-baseline.mjs --json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";
import { readJson } from "./_lib/json.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_JSON = path.join(ROOT, "tmp/workflow-baseline.json");
const OUT_MD = path.join(ROOT, "tmp/workflow-baseline.md");

const METRICS = ["elapsed_ms", "input_tokens", "output_tokens", "subagent_count", "validation_attempts", "cache_hits"];

export function gather(filterTier, root = ROOT) {
  const records = [];
  const states = globSync("agent-output/*/00-session-state.json", { cwd: root });
  for (const relativePath of states) {
    const statePath = path.resolve(root, relativePath);
    const project = path.basename(path.dirname(statePath));
    let data;
    try {
      data = readJson(statePath);
    } catch (err) {
      records.push({ project, error: `cannot parse: ${err.message}` });
      continue;
    }
    const decisions = data.decisions ?? {};
    const tier = decisions.complexity ?? null;
    const iacTool = decisions.iac_tool ?? null;
    if (filterTier && tier !== filterTier) continue;
    const steps = data.steps ?? {};
    const stepKeys = new Set(Object.keys(steps).map((key) => key.replace(/^step-/, "")));
    for (const stepKey of stepKeys) {
      const step = steps[stepKey] ?? steps[`step-${stepKey}`];
      if (!step) continue;
      const telemetry = step.telemetry ?? {};
      const metrics = Object.fromEntries(
        METRICS.map((metric) => [metric, validMetric(telemetry[metric]) ? telemetry[metric] : null]),
      );
      records.push({
        project,
        tier,
        iac_tool: iacTool,
        step: stepKey,
        status: Object.values(metrics).some((value) => value !== null) ? "measured" : "no-telemetry",
        ...metrics,
      });
    }
  }
  return records;
}

function validMetric(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function aggregate(records) {
  const buckets = new Map();
  for (const r of records) {
    if (r.status !== "measured") continue;
    const key = `${r.tier ?? "unknown"}|${r.iac_tool ?? "unknown"}|${r.step}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        tier: r.tier,
        iac_tool: r.iac_tool,
        step: r.step,
        n: 0,
        totals: Object.fromEntries(METRICS.map((metric) => [metric, 0])),
        samples: Object.fromEntries(METRICS.map((metric) => [metric, 0])),
      };
      buckets.set(key, b);
    }
    b.n += 1;
    for (const metric of METRICS) {
      if (!validMetric(r[metric])) continue;
      b.totals[metric] += r[metric];
      b.samples[metric] += 1;
    }
  }
  const out = [];
  for (const b of buckets.values()) {
    const averages = Object.fromEntries(
      METRICS.map((metric) => {
        const average = b.samples[metric] ? b.totals[metric] / b.samples[metric] : null;
        const decimals = ["subagent_count", "validation_attempts", "cache_hits"].includes(metric) ? 2 : 0;
        return [`avg_${metric}`, average === null ? null : Number(average.toFixed(decimals))];
      }),
    );
    out.push({
      tier: b.tier,
      iac_tool: b.iac_tool,
      step: b.step,
      sample_size: b.n,
      metric_samples: b.samples,
      ...averages,
    });
  }
  out.sort((a, b) => {
    if (a.tier !== b.tier) return String(a.tier).localeCompare(String(b.tier));
    if (a.iac_tool !== b.iac_tool) return String(a.iac_tool).localeCompare(String(b.iac_tool));
    return String(a.step)
      .replace("_", ".")
      .localeCompare(String(b.step).replace("_", "."), undefined, { numeric: true });
  });
  return out;
}

export function renderMd(records, summary) {
  const lines = [];
  lines.push("# Workflow Baseline Measurement");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Source: `agent-output/*/00-session-state.json` (`steps.<key>.telemetry`).");
  lines.push("");
  lines.push("Wave 0 prerequisite — every subsequent wave's savings claim must be");
  lines.push("falsifiable against this baseline.");
  lines.push(
    "Unknown metrics are not zero. Each cell shows average (measured samples); absent steps are not inferred.",
  );
  lines.push(
    "Cache hits are event counts, not cached input tokens. This report does not establish complete trace coverage.",
  );
  lines.push("");
  lines.push("## Aggregated by tier × tool × step");
  lines.push("");
  if (summary.length === 0) {
    lines.push("_No measured records yet. Retrofit fixtures by running the full");
    lines.push("workflow with the apex-recall telemetry field populated._");
  } else {
    lines.push(
      "| Tier | Tool | Step | n | Avg elapsed (ms) | Avg input tok | Avg output tok | Avg subagents | Avg validate retries | Avg cache hits |",
    );
    lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const row of summary) {
      const cells = METRICS.map((metric) => `${row[`avg_${metric}`] ?? "unknown"} (${row.metric_samples[metric]})`);
      lines.push(
        `| ${row.tier ?? "—"} | ${row.iac_tool ?? "—"} | ${row.step} | ${row.sample_size} | ${cells.join(" | ")} |`,
      );
    }
  }
  lines.push("");
  lines.push("## Records lacking telemetry");
  lines.push("");
  const missing = records.filter((r) => r.status === "no-telemetry");
  if (missing.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Project | Tier | Tool | Step |");
    lines.push("| --- | --- | --- | --- |");
    for (const r of missing) {
      lines.push(`| ${r.project} | ${r.tier ?? "—"} | ${r.iac_tool ?? "—"} | ${r.step} |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const filterIdx = args.indexOf("--filter");
  const filterTier = filterIdx >= 0 ? args[filterIdx + 1] : null;
  const asJson = args.includes("--json");

  const records = gather(filterTier);
  const summary = aggregate(records);

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(
    OUT_JSON,
    `${JSON.stringify({ generated_at: new Date().toISOString(), records, summary }, null, 2)}\n`,
  );
  fs.writeFileSync(OUT_MD, renderMd(records, summary));

  if (asJson) {
    console.log(JSON.stringify({ records, summary }, null, 2));
  } else {
    console.log(`✅ Workflow baseline written:`);
    console.log(`   ${path.relative(ROOT, OUT_JSON)}`);
    console.log(`   ${path.relative(ROOT, OUT_MD)}`);
    console.log(`   records=${records.length} aggregated=${summary.length}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
