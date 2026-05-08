#!/usr/bin/env node
/**
 * capture-drawio-baseline.mjs
 *
 * T-012 helper. Reads tools/tests/drawio-baseline/_baseline-runs.json
 * (user-edited working file), validates required fields, computes the
 * mean retry count across captured scenarios, and writes
 * tools/tests/drawio-baseline/regen-baseline.json.
 *
 * Consumed by:
 *   - tools/scripts/benchmark-e2e.mjs scoreRegenerationRate()
 *
 * Usage:
 *   node tools/scripts/capture-drawio-baseline.mjs           # write baseline
 *   node tools/scripts/capture-drawio-baseline.mjs --status  # show capture progress
 *   node tools/scripts/capture-drawio-baseline.mjs --check   # exit 1 if incomplete
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const RUNS_PATH = path.join("tools", "tests", "drawio-baseline", "_baseline-runs.json");
const OUT_PATH = path.join("tools", "tests", "drawio-baseline", "regen-baseline.json");
const TOTAL_SCENARIOS = 7;
const TARGET_REDUCTION_PCT = 40;

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, v) {
  fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
}

function gitInfo() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
    const commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    return { branch, commit };
  } catch {
    return { branch: null, commit: null };
  }
}

function status(runs) {
  const entries = Object.entries(runs.scenarios);
  const captured = entries.filter(([, v]) => v.retries !== null);
  const pending = entries.filter(([, v]) => v.retries === null);
  console.log("Draw.io baseline capture status");
  console.log("================================");
  console.log(`Captured: ${captured.length}/${entries.length}`);
  for (const [id, v] of captured) {
    const fric = v.friction_count ?? "?";
    const rs = v.rubric_score;
    let rubMean = "";
    if (rs && typeof rs === "object") {
      const dims = Object.values(rs).filter((n) => typeof n === "number");
      if (dims.length) {
        const m = dims.reduce((s, n) => s + n, 0) / dims.length;
        rubMean = ` rubric=${m.toFixed(2)}/4`;
      }
    }
    console.log(`  [x] ${id.padEnd(34)} retries=${v.retries} friction=${fric}${rubMean}`);
  }
  for (const [id] of pending) {
    console.log(`  [ ] ${id.padEnd(34)} retries=? friction=?`);
  }
  console.log("");
  if (captured.length > 0) {
    const meanR = captured.reduce((s, [, v]) => s + v.retries, 0) / captured.length;
    const withFric = captured.filter(([, v]) => typeof v.friction_count === "number");
    const meanF = withFric.length ? withFric.reduce((s, [, v]) => s + v.friction_count, 0) / withFric.length : null;
    const meanCost = meanF === null ? meanR : meanR + meanF;
    console.log(`Mean (captured so far):`);
    console.log(`  retries / .drawio:  ${meanR.toFixed(2)}`);
    console.log(`  friction / .drawio: ${meanF === null ? "n/a" : meanF.toFixed(2)}`);
    console.log(`  cost / .drawio:     ${meanCost.toFixed(2)} (retries + friction)`);
  }
  return captured.length === entries.length;
}

function compose(runs) {
  const entries = Object.entries(runs.scenarios);
  const captured = entries.filter(([, v]) => v.retries !== null);
  if (captured.length === 0) {
    console.error("ERROR: no scenarios captured yet. Edit _baseline-runs.json first.");
    process.exit(1);
  }
  const meanRetries = captured.reduce((s, [, v]) => s + v.retries, 0) / captured.length;
  const withFric = captured.filter(([, v]) => typeof v.friction_count === "number");
  const meanFric = withFric.length ? withFric.reduce((s, [, v]) => s + v.friction_count, 0) / withFric.length : 0;
  const meanCost = meanRetries + meanFric;
  const perScenario = Object.fromEntries(
    captured.map(([id, v]) => {
      const entry = {
        retries: v.retries,
        friction_count: typeof v.friction_count === "number" ? v.friction_count : 0,
        observations: v.observations || "",
      };
      if (v.rubric_score && typeof v.rubric_score === "object") {
        const dims = Object.values(v.rubric_score).filter((n) => typeof n === "number");
        if (dims.length) {
          entry.rubric_mean = Number((dims.reduce((s, n) => s + n, 0) / dims.length).toFixed(3));
        }
      }
      return [id, entry];
    }),
  );
  const git = gitInfo();
  const baseline = {
    $schema: "../../schemas/drawio-regen-baseline.schema.json",
    schema_version: "drawio-regen-baseline-v1",
    captured_at: new Date().toISOString(),
    captured_on_branch: runs.captured_on_branch || git.branch,
    captured_on_commit: runs.captured_on_commit || git.commit,
    captured_by: runs.captured_by || null,
    scenarios_captured: captured.length,
    scenarios_total: TOTAL_SCENARIOS,
    mean_retries_per_drawio: Number(meanRetries.toFixed(3)),
    mean_friction_per_drawio: Number(meanFric.toFixed(3)),
    mean_cost_per_drawio: Number(meanCost.toFixed(3)),
    per_scenario: perScenario,
    target_reduction_pct: TARGET_REDUCTION_PCT,
    notes:
      captured.length === TOTAL_SCENARIOS
        ? "Complete capture across all 7 golden scenarios."
        : `PARTIAL: ${captured.length}/${TOTAL_SCENARIOS} scenarios captured. Re-run after capturing remaining scenarios. mean_cost_per_drawio is the divisor used by scoreRegenerationRate() in benchmark-e2e.mjs.`,
  };
  return baseline;
}

const args = new Set(process.argv.slice(2));
const runs = readJson(RUNS_PATH);

if (args.has("--status")) {
  status(runs);
  process.exit(0);
}

if (args.has("--check")) {
  const complete = status(runs);
  process.exit(complete ? 0 : 1);
}

const baseline = compose(runs);
writeJson(OUT_PATH, baseline);
console.log(`✅ wrote ${OUT_PATH}`);
console.log(`   captured: ${baseline.scenarios_captured}/${baseline.scenarios_total}`);
console.log(`   mean retries / .drawio:  ${baseline.mean_retries_per_drawio}`);
console.log(`   mean friction / .drawio: ${baseline.mean_friction_per_drawio}`);
console.log(`   mean cost / .drawio:     ${baseline.mean_cost_per_drawio} (retries + friction)`);
console.log(`   target reduction: >=${baseline.target_reduction_pct}%`);
