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

const TARGET_STEPS = ["4", "5", "6"];

function gather(filterTier) {
  const records = [];
  const states = globSync("agent-output/*/00-session-state.json", { cwd: ROOT, absolute: true });
  for (const statePath of states) {
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
    for (const stepKey of TARGET_STEPS) {
      const step = steps[stepKey] ?? steps[`step-${stepKey}`];
      if (!step) continue;
      const t = step.telemetry;
      if (!t) {
        records.push({ project, tier, iac_tool: iacTool, step: stepKey, status: "no-telemetry" });
        continue;
      }
      records.push({
        project,
        tier,
        iac_tool: iacTool,
        step: stepKey,
        status: "measured",
        elapsed_ms: t.elapsed_ms ?? null,
        input_tokens: t.input_tokens ?? null,
        output_tokens: t.output_tokens ?? null,
        subagent_count: t.subagent_count ?? null,
        validation_attempts: t.validation_attempts ?? null,
        cache_hits: t.cache_hits ?? null,
      });
    }
  }
  return records;
}

function aggregate(records) {
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
        elapsed_ms_total: 0,
        input_tokens_total: 0,
        output_tokens_total: 0,
        subagent_count_total: 0,
        validation_attempts_total: 0,
      };
      buckets.set(key, b);
    }
    b.n += 1;
    b.elapsed_ms_total += r.elapsed_ms ?? 0;
    b.input_tokens_total += r.input_tokens ?? 0;
    b.output_tokens_total += r.output_tokens ?? 0;
    b.subagent_count_total += r.subagent_count ?? 0;
    b.validation_attempts_total += r.validation_attempts ?? 0;
  }
  const out = [];
  for (const b of buckets.values()) {
    out.push({
      tier: b.tier,
      iac_tool: b.iac_tool,
      step: b.step,
      sample_size: b.n,
      avg_elapsed_ms: Math.round(b.elapsed_ms_total / b.n),
      avg_input_tokens: Math.round(b.input_tokens_total / b.n),
      avg_output_tokens: Math.round(b.output_tokens_total / b.n),
      avg_subagent_count: +(b.subagent_count_total / b.n).toFixed(2),
      avg_validation_attempts: +(b.validation_attempts_total / b.n).toFixed(2),
    });
  }
  out.sort((a, b) => {
    if (a.tier !== b.tier) return String(a.tier).localeCompare(String(b.tier));
    if (a.iac_tool !== b.iac_tool) return String(a.iac_tool).localeCompare(String(b.iac_tool));
    return Number(a.step) - Number(b.step);
  });
  return out;
}

function renderMd(records, summary) {
  const lines = [];
  lines.push("# Workflow Baseline Measurement");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Source: `agent-output/*/00-session-state.json` (`steps.<key>.telemetry`).");
  lines.push("");
  lines.push("Wave 0 prerequisite — every subsequent wave's savings claim must be");
  lines.push("falsifiable against this baseline.");
  lines.push("");
  lines.push("## Aggregated by tier × tool × step");
  lines.push("");
  if (summary.length === 0) {
    lines.push("_No measured records yet. Retrofit fixtures by running the full");
    lines.push("workflow with the apex-recall telemetry field populated._");
  } else {
    lines.push(
      "| Tier | Tool | Step | n | Avg elapsed (ms) | Avg input tok | Avg output tok | Avg subagents | Avg validate retries |",
    );
    lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const row of summary) {
      lines.push(
        `| ${row.tier ?? "—"} | ${row.iac_tool ?? "—"} | ${row.step} | ${row.sample_size} | ${row.avg_elapsed_ms} | ${row.avg_input_tokens} | ${row.avg_output_tokens} | ${row.avg_subagent_count} | ${row.avg_validation_attempts} |`,
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

main();
