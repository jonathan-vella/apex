#!/usr/bin/env node
/**
 * Challenger telemetry rollup.
 *
 * Walks every `challenge-findings-*.json` sidecar under
 * `agent-output/{project}/` (skipping `*-decisions.json` and `agent-output/_meta/`)
 * and produces:
 *
 * - `tools/registry/challenger-telemetry.json` — machine-readable rollup
 * - `docs/CHANGELOG.md` and `docs/GLOSSARY.md` stay under docs/. The
 *   challenger artifacts emitted by this script (telemetry rollup +
 *   periodic markdown report) live under `tools/registry/` because
 *   they are machine-generated registry artifacts, not user-facing
 *   documentation.
 *
 * - `tools/registry/challenger-effectiveness.md` — periodic markdown report
 *
 * Rollup metrics:
 *
 * - `total_passes`: count of pass-1 sidecars (one per artifact reviewed)
 * - `total_findings`: sum of `must_fix_count + should_fix_count + suggestion_count`
 * - `must_fix_rate_per_pass`: avg must_fix_count per pass (overall and per
 *   artifact_type)
 * - `pass2_finds_vs_pass1`: average must_fix_count of pass2 vs pass1 for
 *   the same artifact (deep-review projects only) — informs whether
 *   pass 2 is finding net-new issues
 * - `pass3_finds_vs_pass1`: same idea, pass 3
 * - `artifact_type_breakdown`: per artifact_type counts
 * - `wrapper_invocations`: count of `10-Challenger` wrapper invocations
 *   (proxy: number of sidecars where the parent agent is `10-Challenger`;
 *   currently approximated by the absence of `-pass{N}.json` suffix AND
 *   absence of `-decisions.json` suffix in artifacts of the same type).
 *   This metric drives the retirement-review trigger in Phase 12.
 *
 * Informs future decisions on retiring lenses, passes, or the
 * `10-Challenger` wrapper.
 *
 * Usage:
 *   npm run challenger-telemetry
 */

import fs from "node:fs";
import path from "node:path";

const AGENT_OUTPUT = "agent-output";
const TELEMETRY_OUT = "tools/registry/challenger-telemetry.json";
const MD_OUT = "tools/registry/challenger-effectiveness.md";

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_meta") continue;
      walk(full, acc);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("challenge-findings-") &&
      entry.name.endsWith(".json") &&
      !entry.name.endsWith("-decisions.json")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

function passNumberFromName(filename) {
  const m = filename.match(/-pass(\d+)\.json$/);
  return m ? Number(m[1]) : 1;
}

const files = walk(AGENT_OUTPUT);

const rollup = {
  generated_at: new Date().toISOString(),
  sidecars_scanned: files.length,
  total_findings: 0,
  must_fix_rate_per_pass: { overall: 0, by_artifact_type: {} },
  pass_count_distribution: {},
  pass2_vs_pass1_must_fix: { samples: 0, pass1_total: 0, pass2_total: 0 },
  pass3_vs_pass1_must_fix: { samples: 0, pass1_total: 0, pass3_total: 0 },
  artifact_type_breakdown: {},
  wrapper_invocations: 0,
};

const perArtifact = new Map();
let mustFixSum = 0;
let passSum = 0;

for (const file of files) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    continue;
  }
  // Batch mode unrolls to multiple entries
  const entries = Array.isArray(doc.batch_results) ? doc.batch_results : [doc];
  for (const e of entries) {
    const passN = e.pass_number ?? passNumberFromName(path.basename(file));
    const at = e.artifact_type ?? "(unknown)";
    const must = Number(e.must_fix_count ?? 0);
    const should = Number(e.should_fix_count ?? 0);
    const sug = Number(e.suggestion_count ?? 0);
    rollup.total_findings += must + should + sug;
    mustFixSum += must;
    passSum += 1;
    rollup.pass_count_distribution[passN] = (rollup.pass_count_distribution[passN] ?? 0) + 1;
    const bucket = rollup.artifact_type_breakdown[at] ?? {
      total_passes: 0,
      must_fix: 0,
      should_fix: 0,
      suggestion: 0,
    };
    bucket.total_passes += 1;
    bucket.must_fix += must;
    bucket.should_fix += should;
    bucket.suggestion += sug;
    rollup.artifact_type_breakdown[at] = bucket;

    const artifactKey = `${file.split("/")[1] ?? "?"}|${at}`;
    const acc = perArtifact.get(artifactKey) ?? {};
    acc[`pass${passN}`] = must;
    perArtifact.set(artifactKey, acc);
  }
}

for (const acc of perArtifact.values()) {
  if (acc.pass1 !== undefined && acc.pass2 !== undefined) {
    rollup.pass2_vs_pass1_must_fix.samples += 1;
    rollup.pass2_vs_pass1_must_fix.pass1_total += acc.pass1;
    rollup.pass2_vs_pass1_must_fix.pass2_total += acc.pass2;
  }
  if (acc.pass1 !== undefined && acc.pass3 !== undefined) {
    rollup.pass3_vs_pass1_must_fix.samples += 1;
    rollup.pass3_vs_pass1_must_fix.pass1_total += acc.pass1;
    rollup.pass3_vs_pass1_must_fix.pass3_total += acc.pass3;
  }
}

rollup.must_fix_rate_per_pass.overall = passSum > 0 ? +(mustFixSum / passSum).toFixed(3) : 0;
for (const [at, bucket] of Object.entries(rollup.artifact_type_breakdown)) {
  rollup.must_fix_rate_per_pass.by_artifact_type[at] = +(bucket.must_fix / bucket.total_passes).toFixed(3);
}

// Wrapper invocations proxy: single-pass sidecars without a `-pass{N}` suffix
// AND a parent path that is NOT a known step-N agent output. Without
// instrumentation in 10-Challenger itself, we can only approximate; the
// current count is best-effort.
rollup.wrapper_invocations = files.filter((f) => !/-pass\d+\.json$/.test(f) && !/_meta/.test(f)).length;

fs.mkdirSync(path.dirname(TELEMETRY_OUT), { recursive: true });
fs.writeFileSync(TELEMETRY_OUT, `${JSON.stringify(rollup, null, 2)}\n`);

const md = [];
md.push("# Challenger Effectiveness Report");
md.push("");
md.push("Periodic rollup of `challenge-findings-*.json` sidecars under `agent-output/`.");
md.push("Drives decisions on retiring lenses, passes, or the `10-Challenger` wrapper.");
md.push("");
md.push(`Generated: ${rollup.generated_at}`);
md.push(`Sidecars scanned: ${rollup.sidecars_scanned}`);
md.push(`Total findings: ${rollup.total_findings}`);
md.push(`Must-fix rate per pass (overall): ${rollup.must_fix_rate_per_pass.overall}`);
md.push(`Wrapper (10-Challenger) invocations (proxy): ${rollup.wrapper_invocations}`);
md.push("");
md.push("## Per-artifact-type breakdown");
md.push("");
md.push("| artifact_type | passes | must_fix | should_fix | suggestion | must_fix/pass |");
md.push("| ------------- | ------ | -------- | ---------- | ---------- | ------------- |");
for (const [at, b] of Object.entries(rollup.artifact_type_breakdown)) {
  md.push(
    `| ${at} | ${b.total_passes} | ${b.must_fix} | ${b.should_fix} | ${b.suggestion} | ${rollup.must_fix_rate_per_pass.by_artifact_type[at]} |`,
  );
}
md.push("");
md.push("## Pass-cascade efficacy (deep-review projects only)");
md.push("");
md.push("Pass 2 finds vs pass 1 finds (same artifact):");
md.push("");
md.push(`- samples: ${rollup.pass2_vs_pass1_must_fix.samples}`);
md.push(`- pass1 must_fix total: ${rollup.pass2_vs_pass1_must_fix.pass1_total}`);
md.push(`- pass2 must_fix total: ${rollup.pass2_vs_pass1_must_fix.pass2_total}`);
md.push("");
md.push("Pass 3 finds vs pass 1 finds (same artifact):");
md.push("");
md.push(`- samples: ${rollup.pass3_vs_pass1_must_fix.samples}`);
md.push(`- pass1 must_fix total: ${rollup.pass3_vs_pass1_must_fix.pass1_total}`);
md.push(`- pass3 must_fix total: ${rollup.pass3_vs_pass1_must_fix.pass3_total}`);
md.push("");
md.push("Machine-readable rollup: `tools/registry/challenger-telemetry.json`.");
md.push("");

fs.mkdirSync(path.dirname(MD_OUT), { recursive: true });
fs.writeFileSync(MD_OUT, `${md.join("\n")}`);

console.log(`✅ Wrote ${TELEMETRY_OUT} and ${MD_OUT}`);
