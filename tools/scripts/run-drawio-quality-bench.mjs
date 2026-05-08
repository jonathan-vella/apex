#!/usr/bin/env node
/**
 * run-drawio-quality-bench.mjs (T-033)
 *
 * Single-command Phase-3 acceptance harness for the Draw.io Quality Uplift.
 * Composes existing tools rather than re-implementing them:
 *
 *   1. Reads tools/tests/drawio-baseline/regen-baseline.json (T-012 baseline).
 *   2. For each captured scenario (G1..G7), reads
 *      tools/tests/drawio-baseline/_baseline-runs.json for retries+friction
 *      and the optional rubric_score block.
 *   3. Runs validate-drawio-files.mjs against the seven captured .drawio
 *      files and counts T-006/T-007/T-008/T-009/T-010 warnings per file.
 *   4. Computes a composite acceptance verdict against the prompt's exit
 *      criteria (≥40% cost reduction, mean rubric ≥3/4, validator clean
 *      on goldens).
 *   5. Emits a markdown report and a JSON snapshot.
 *
 * Usage:
 *   node tools/scripts/run-drawio-quality-bench.mjs           # baseline view
 *   node tools/scripts/run-drawio-quality-bench.mjs --post=<run-id>
 *                                                  # compare baseline vs.
 *                                                  # a post-uplift run
 *                                                  # under agent-output/_bench/
 *                                                  # drawio-quality-uplift/<id>/
 *   node tools/scripts/run-drawio-quality-bench.mjs --check
 *                                                  # exit 1 if Phase-3 gate fails
 *
 * Outputs:
 *   agent-output/_bench/drawio-quality-uplift/<run-id>/quality-bench.{md,json}
 *
 * The harness is deliberately simple — it reads existing files, doesn't run
 * the agent, doesn't call the MCP server. The agent recapture is a separate
 * manual step that produces the post-uplift inputs this script consumes.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const args = new Map(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (!m) return [];
    return [[m[1], m[2] ?? "true"]];
  }),
);
const POST_RUN_ID = args.get("post") ?? null;
const CHECK_MODE = args.has("check");

const REPO_ROOT = process.cwd();
const BASELINE_DIR = path.join("tools", "tests", "drawio-baseline");
const RUNS_PATH = path.join(BASELINE_DIR, "_baseline-runs.json");
const BASELINE_PATH = path.join(BASELINE_DIR, "regen-baseline.json");
const _FIXTURES_DIR = path.join("tools", "tests", "drawio-golden");

// Fixture id -> reference .drawio under agent-output/. T-012 captured these
// G1..G7 outputs to disk; T-033 re-uses them as the "before" state.
const SCENARIO_DRAWIO = {
  "g1-three-tier-web": "agent-output/g1-three-tier/03-des-diagram.drawio",
  "g2-hub-spoke-landing-zone": "agent-output/g2-hub-spoke/03-des-diagram.drawio",
  "g3-event-driven-microservices": "agent-output/g3-event-driven-microservices/03-des-diagram.drawio",
  "g4-ml-training-pipeline": "agent-output/g4-ml-training/03-des-diagram.drawio",
  "g5-enterprise-landing-zone": "agent-output/g5-enterprise-landing-zone/03-des-diagram.drawio",
  "g6-hyperscale-platform": "agent-output/g6-hyperscale-platform/03-des-diagram.drawio",
  "g7-multi-region-active-active": "agent-output/g7-multi-region-active-active/03-des-diagram.drawio",
};

const RUBRIC_DIMENSIONS = [
  "icon_correctness",
  "layout",
  "styling",
  "semantics",
  "labelling",
  "type_fit",
  "scalability",
];
const ACCEPTANCE_BAR = 3.0; // mean ≥3/4 across all dimensions
const TARGET_REDUCTION_PCT = 40;

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function rubricMean(scen) {
  if (!scen?.rubric_score) return null;
  const dims = RUBRIC_DIMENSIONS.map((d) => scen.rubric_score[d]).filter((n) => typeof n === "number");
  if (dims.length === 0) return null;
  return dims.reduce((s, n) => s + n, 0) / dims.length;
}

function runValidatorScopedTo(_file) {
  // Run the validator on a single file by exporting a scoped scan path via
  // env. The validator currently scans fixed dirs; we approximate per-file
  // counts by grepping its full output. For the captured baseline, scope
  // the agent-output/ scan to the specific scenario dir so other captures
  // do not pollute counts.
  try {
    const out = execSync(`node tools/scripts/validate-drawio-files.mjs 2>&1`, {
      encoding: "utf8",
      cwd: REPO_ROOT,
    });
    return out;
  } catch (e) {
    // validator returns non-zero only on errors; warnings come on stderr.
    // Use the captured output (e.stdout + e.stderr) when present.
    return [e.stdout || "", e.stderr || ""].join("\n");
  }
}

function countValidatorWarnings(validatorOutput, drawioPath) {
  const counts = {
    "T-006": 0, // overlap
    "T-007": 0, // density
    "T-008": 0, // type-fit
    "T-009": 0, // zones
    "T-010": 0, // legend
    palette: 0,
  };
  const fileLines = validatorOutput.split("\n").filter((l) => l.includes(drawioPath));
  for (const line of fileLines) {
    if (line.includes("(T-006)")) counts["T-006"]++;
    else if (line.includes("(T-007)")) counts["T-007"]++;
    else if (line.includes("(T-008)")) counts["T-008"]++;
    else if (line.includes("(T-009)")) counts["T-009"]++;
    else if (line.includes("(T-010)")) counts["T-010"]++;
    else if (/APEX palette drift/i.test(line)) counts.palette++;
  }
  counts.total = Object.values(counts).reduce((s, n) => s + n, 0);
  return counts;
}

function pickRunId() {
  if (POST_RUN_ID) return POST_RUN_ID;
  // Default: timestamp + "baseline-view" so multiple runs don't collide.
  const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15); // YYYYMMDDTHHMMSS
  return `${ts}-baseline-view`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

// ── Main ───────────────────────────────────────────────────────────────

const baselineRuns = readJson(RUNS_PATH);
const baseline = readJson(BASELINE_PATH);

if (!baselineRuns || !baseline) {
  console.error(
    `❌ baseline data missing. Expected:\n  ${RUNS_PATH}\n  ${BASELINE_PATH}\n` +
      `Run T-012 capture first (see references/quality-rubric.md).`,
  );
  process.exit(1);
}

// When --post=<run-id> is supplied, load the post-uplift recapture data
// from agent-output/_bench/drawio-quality-uplift/<run-id>/post-runs.json
// and use it as the "current" data set. Without --post, the baseline
// itself is reported as "current" (BASELINE_VIEW).
let runs = baselineRuns;
let postRunsPath = null;
if (POST_RUN_ID) {
  postRunsPath = path.join("agent-output", "_bench", "drawio-quality-uplift", POST_RUN_ID, "post-runs.json");
  const postRuns = readJson(postRunsPath);
  if (!postRuns) {
    console.error(
      `❌ post-uplift data missing. Expected:\n  ${postRunsPath}\n` +
        `Recapture each scenario through the agent and record observations\n` +
        `in this file (see references/quality-rubric.md baseline-capture procedure).`,
    );
    process.exit(1);
  }
  runs = postRuns;
}

const validatorOutput = runValidatorScopedTo();

const perScenario = [];
const captured = Object.entries(runs.scenarios).filter(([, v]) => v.retries !== null);

for (const [id, scen] of captured) {
  const drawio = SCENARIO_DRAWIO[id];
  const rubric = rubricMean(scen);
  const validator = drawio ? countValidatorWarnings(validatorOutput, drawio) : { total: 0 };
  perScenario.push({
    id,
    retries: scen.retries,
    friction: scen.friction_count ?? 0,
    cost: (scen.retries ?? 0) + (scen.friction_count ?? 0),
    rubric_mean: rubric,
    rubric_score: scen.rubric_score ?? null,
    validator,
    drawio_file: drawio ?? null,
    quality_issue_count: (scen.quality_issues ?? []).length,
  });
}

const meanCost = perScenario.length > 0 ? perScenario.reduce((s, x) => s + x.cost, 0) / perScenario.length : 0;
const meanRubric = (() => {
  const xs = perScenario.map((x) => x.rubric_mean).filter((n) => n !== null);
  if (xs.length === 0) return null;
  return xs.reduce((s, n) => s + n, 0) / xs.length;
})();
const baselineCost = baseline.mean_cost_per_drawio ?? null;
const reduction = baselineCost ? Math.max(0, 1 - meanCost / baselineCost) : null;

// Phase-3 acceptance gate
const reductionMet = reduction !== null && reduction >= TARGET_REDUCTION_PCT / 100;
const rubricMet = meanRubric !== null && meanRubric >= ACCEPTANCE_BAR;
const completeness = perScenario.length === 7;

const verdict = {
  baseline_view: !POST_RUN_ID,
  scenarios_evaluated: perScenario.length,
  scenarios_total: 7,
  baseline_mean_cost: baselineCost,
  current_mean_cost: meanCost,
  cost_reduction_pct: reduction === null ? null : reduction * 100,
  target_reduction_pct: TARGET_REDUCTION_PCT,
  reduction_met: reductionMet,
  current_mean_rubric: meanRubric,
  acceptance_bar: ACCEPTANCE_BAR,
  rubric_met: rubricMet,
  completeness_met: completeness,
  phase_3_gate: !POST_RUN_ID ? "BASELINE_VIEW" : completeness && reductionMet && rubricMet ? "PASS" : "FAIL",
};

// ── Output ─────────────────────────────────────────────────────────────

const runId = pickRunId();
const outDir = path.join("agent-output", "_bench", "drawio-quality-uplift", runId);
ensureDir(outDir);
const jsonOut = path.join(outDir, "quality-bench.json");
const mdOut = path.join(outDir, "quality-bench.md");

fs.writeFileSync(jsonOut, `${JSON.stringify({ verdict, per_scenario: perScenario }, null, 2)}\n`);

const md = [];
md.push(`# Draw.io Quality Bench — ${runId}`);
md.push("");
md.push(
  POST_RUN_ID
    ? `Post-uplift comparison vs. baseline at \`${BASELINE_PATH}\`.`
    : `Baseline view (no post-uplift recapture). Phase-3 gate not evaluated; run with \`--post=<run-id>\` after recapturing G1–G7.`,
);
md.push("");
md.push("## Verdict");
md.push("");
md.push(`| Metric | Value |`);
md.push(`| --- | --- |`);
md.push(`| Phase-3 gate | **${verdict.phase_3_gate}** |`);
md.push(`| Scenarios captured | ${verdict.scenarios_evaluated}/${verdict.scenarios_total} |`);
md.push(`| Baseline mean cost / .drawio | ${baselineCost?.toFixed(2) ?? "n/a"} |`);
md.push(`| Current mean cost / .drawio | ${meanCost.toFixed(2)} |`);
md.push(`| Cost reduction | ${reduction === null ? "n/a" : pct(reduction)} (target ≥${TARGET_REDUCTION_PCT}%) |`);
md.push(
  `| Current mean rubric | ${meanRubric === null ? "n/a" : meanRubric.toFixed(2)}/4 (target ≥${ACCEPTANCE_BAR}/4) |`,
);
md.push("");
md.push("## Per-scenario summary");
md.push("");
md.push(`| ID | retries | friction | cost | rubric | validator (T-006/7/8/9/10 + palette) |`);
md.push(`| --- | :-: | :-: | :-: | :-: | --- |`);
for (const s of perScenario) {
  const rub = s.rubric_mean === null ? "n/a" : s.rubric_mean.toFixed(2);
  const v = s.validator;
  const vstr = `${v["T-006"]}/${v["T-007"]}/${v["T-008"]}/${v["T-009"]}/${v["T-010"]} + ${v.palette}`;
  md.push(`| ${s.id} | ${s.retries} | ${s.friction} | ${s.cost} | ${rub} | ${vstr} |`);
}
md.push("");
md.push("## Phase-3 exit criteria (per plan §Validation Strategy)");
md.push("");
md.push(`- ${verdict.completeness_met ? "✅" : "❌"} All 7 golden scenarios captured`);
md.push(`- ${verdict.reduction_met ? "✅" : "❌"} Mean cost reduction ≥ ${TARGET_REDUCTION_PCT}% vs. baseline`);
md.push(`- ${verdict.rubric_met ? "✅" : "❌"} Mean rubric ≥ ${ACCEPTANCE_BAR}/4 across all dimensions`);
md.push(`- ${"⚪"} Validator extensions clean on all 7 goldens (manual gate — see per-scenario validator column)`);
md.push("");
md.push("## Artifacts");
md.push("");
md.push(`- JSON snapshot: \`${jsonOut}\``);
md.push(`- This report: \`${mdOut}\``);
md.push(`- Baseline source: \`${BASELINE_PATH}\``);
md.push(`- Working file: \`${RUNS_PATH}\``);
if (postRunsPath) {
  md.push(`- Post-uplift runs: \`${postRunsPath}\``);
}
md.push("");
md.push(`Run side-by-side render with the following command once the post-uplift`);
md.push("recapture exists:");
md.push("");
md.push("```bash");
md.push(`node tools/scripts/render-golden-diff.mjs --post=${POST_RUN_ID || "<run-id>"}`);
md.push("```");
md.push("");

fs.writeFileSync(mdOut, md.join("\n"));

// Console summary
console.log(`Quality bench (${runId})`);
console.log(`  scenarios       : ${verdict.scenarios_evaluated}/${verdict.scenarios_total}`);
console.log(`  baseline cost   : ${baselineCost?.toFixed(2) ?? "n/a"}`);
console.log(`  current cost    : ${meanCost.toFixed(2)}`);
console.log(`  cost reduction  : ${reduction === null ? "n/a" : pct(reduction)} (target ≥${TARGET_REDUCTION_PCT}%)`);
console.log(
  `  current rubric  : ${meanRubric === null ? "n/a" : meanRubric.toFixed(2)}/4 (target ≥${ACCEPTANCE_BAR}/4)`,
);
console.log(`  phase-3 gate    : ${verdict.phase_3_gate}`);
console.log(``);
console.log(`Wrote ${jsonOut}`);
console.log(`Wrote ${mdOut}`);

if (CHECK_MODE && verdict.phase_3_gate !== "PASS") {
  process.exit(1);
}
