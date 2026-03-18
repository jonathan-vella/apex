#!/usr/bin/env node
/**
 * Combine E2E RALPH Loop Results
 *
 * Merges lessons-learned, benchmark scores, and benchmark reports from
 * multiple E2E runs into a single combined output directory for cross-run
 * analysis via e2e-analyze-lessons.prompt.md.
 *
 * Features:
 *   - Lessons: merged array with run-prefixed IDs and source_run field
 *   - Scores: per-run breakdown plus averaged/min/max per dimension
 *   - Report: comparative markdown with side-by-side dimension table
 *   - Frequency analysis: flags recurring lessons across runs
 *
 * Usage:
 *   node scripts/combine-e2e-runs.mjs <run1> <run2> [run3...] [--output <dir>]
 *
 * Example:
 *   node scripts/combine-e2e-runs.mjs \
 *     contoso-service-hub-run-1 contoso-service-hub-run-2 contoso-service-hub-run-3
 *
 * Output:
 *   agent-output/{output}/09-lessons-learned.json
 *   agent-output/{output}/08-benchmark-scores.json
 *   agent-output/{output}/08-benchmark-report.md
 */

import fs from "node:fs";
import path from "node:path";

const AGENT_OUTPUT = "agent-output";

// --- CLI parsing ---
const args = process.argv.slice(2);
let outputName = null;
const runs = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output" && args[i + 1]) {
    outputName = args[++i];
  } else if (!args[i].startsWith("-")) {
    runs.push(args[i]);
  }
}

if (runs.length < 2) {
  console.error(
    "Usage: combine-e2e-runs.mjs <run1> <run2> [run3...] [--output <dir>]",
  );
  console.error("  Provide at least 2 run directory names from agent-output/");
  process.exit(1);
}

// Derive output name from common prefix if not specified
if (!outputName) {
  const common = runs.reduce((a, b) => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return a.slice(0, i);
  });
  // Trim trailing run identifiers like -run-1, -run-, -1, trailing dash
  outputName = common
    .replace(/-?run-?\d*$/, "")
    .replace(/-\d+$/, "")
    .replace(/-$/, "");
  outputName = (outputName || "e2e") + "-combined";
}

const outDir = path.join(AGENT_OUTPUT, outputName);

// --- Helpers ---
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// Normalize a lesson title for dedup comparison
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Check if two normalized titles are similar enough to be the same lesson
// Uses longest-common-subsequence word overlap (>= 60% of shorter title's words)
function titlesSimilar(a, b) {
  if (a === b) return true;
  const wordsA = a.split(" ");
  const wordsB = b.split(" ");
  const setB = new Set(wordsB);
  const overlap = wordsA.filter((w) => setB.has(w)).length;
  const shorter = Math.min(wordsA.length, wordsB.length);
  return shorter > 0 && overlap / shorter >= 0.6;
}

// --- 1. Combine Lessons Learned ---
function combineLessons() {
  const allLessons = [];
  const allNorms = []; // {norm, run, id} for fuzzy clustering

  for (let ri = 0; ri < runs.length; ri++) {
    const run = runs[ri];
    const runNum = ri + 1;
    const prefix = `R${runNum}`;
    const filePath = path.join(AGENT_OUTPUT, run, "09-lessons-learned.json");
    const raw = readJson(filePath);

    // Support both old format (bare array) and new format (object with lessons array)
    const lessons = Array.isArray(raw) ? raw : (raw && raw.lessons) || null;
    if (!lessons || !Array.isArray(lessons)) {
      console.warn(`  ⚠ No lessons found in ${filePath}`);
      continue;
    }

    for (const lesson of lessons) {
      const combined = {
        ...lesson,
        id: `${prefix}-${lesson.id}`,
        original_id: lesson.id,
        source_run: run,
        run_number: runNum,
      };
      allLessons.push(combined);

      // Track by normalized title for frequency analysis
      const norm = normalizeTitle(lesson.title);
      allNorms.push({ norm, run, id: combined.id });
    }
  }

  // Group similar lessons using fuzzy title matching
  const clusters = []; // array of arrays of {norm, run, id}
  const assigned = new Set();
  for (let i = 0; i < allNorms.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = [allNorms[i]];
    assigned.add(i);
    for (let j = i + 1; j < allNorms.length; j++) {
      if (assigned.has(j)) continue;
      // Only cluster across different runs
      if (allNorms[j].run === allNorms[i].run) continue;
      if (titlesSimilar(allNorms[i].norm, allNorms[j].norm)) {
        cluster.push(allNorms[j]);
        assigned.add(j);
      }
    }
    if (cluster.length >= 2) clusters.push(cluster);
  }

  // Flag recurring lessons (appear in 2+ runs)
  const recurring = [];
  for (const cluster of clusters) {
    const uniqueRuns = [...new Set(cluster.map((c) => c.run))];
    if (uniqueRuns.length >= 2) {
      recurring.push({
        normalized_title: cluster[0].norm,
        occurrences: cluster.length,
        run_ids: cluster.map((c) => c.id),
        runs: uniqueRuns,
      });

      // Mark each lesson with cross_run_frequency
      for (const entry of cluster) {
        const lesson = allLessons.find((l) => l.id === entry.id);
        if (lesson) {
          lesson.cross_run_frequency = cluster.length;
          lesson.recurring = true;
        }
      }
    }
  }

  // Sort: recurring first (by frequency desc), then by severity, then step
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allLessons.sort((a, b) => {
    const freqA = a.cross_run_frequency || 1;
    const freqB = b.cross_run_frequency || 1;
    if (freqB !== freqA) return freqB - freqA;
    const sevA = severityOrder[a.severity] ?? 4;
    const sevB = severityOrder[b.severity] ?? 4;
    if (sevA !== sevB) return sevA - sevB;
    return (a.step || 0) - (b.step || 0);
  });

  return { lessons: allLessons, recurring };
}

// --- 2. Combine Benchmark Scores ---
function combineScores() {
  const perRun = [];

  for (const run of runs) {
    const filePath = path.join(AGENT_OUTPUT, run, "08-benchmark-scores.json");
    const scores = readJson(filePath);
    if (!scores) {
      console.warn(`  ⚠ No scores found in ${filePath}`);
      continue;
    }
    perRun.push({ run, data: scores });
  }

  if (perRun.length === 0) return null;

  // Collect all dimension keys
  const dims = new Set();
  for (const { data } of perRun) {
    if (data.scores) Object.keys(data.scores).forEach((k) => dims.add(k));
  }

  // Compute per-dimension stats
  const dimStats = {};
  for (const dim of dims) {
    const values = perRun
      .map((r) => r.data.scores?.[dim]?.score)
      .filter((v) => v != null);
    if (values.length === 0) continue;
    dimStats[dim] = {
      scores: perRun.map((r) => ({
        run: r.run,
        score: r.data.scores?.[dim]?.score ?? null,
        grade: r.data.scores?.[dim]?.grade ?? null,
      })),
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      min: Math.min(...values),
      max: Math.max(...values),
      range: Math.max(...values) - Math.min(...values),
    };
  }

  // Composite stats
  const composites = perRun
    .map((r) => r.data.composite?.score)
    .filter((v) => v != null);

  return {
    combined_from: runs,
    run_count: perRun.length,
    timestamps: perRun.map((r) => ({
      run: r.run,
      timestamp: r.data.timestamp,
    })),
    per_run: perRun.map((r) => ({ run: r.run, ...r.data })),
    dimension_stats: dimStats,
    composite_stats: {
      avg: Math.round(
        composites.reduce((a, b) => a + b, 0) / composites.length,
      ),
      min: Math.min(...composites),
      max: Math.max(...composites),
      range: Math.max(...composites) - Math.min(...composites),
      per_run: perRun.map((r) => ({
        run: r.run,
        score: r.data.composite?.score,
        grade: r.data.composite?.grade,
      })),
    },
  };
}

// --- 3. Generate Combined Report ---
function generateReport(combinedScores, combinedLessons) {
  const { dimension_stats: dims, composite_stats: comp } = combinedScores;

  const gradeFor = (score) => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  };

  const lines = [];
  lines.push("# E2E RALPH Loop — Combined Benchmark Report");
  lines.push("");
  lines.push(`> Combined from ${runs.length} runs: ${runs.join(", ")}`);
  lines.push(`> Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");

  // Executive summary
  lines.push("## Executive Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Runs Combined | ${runs.length} |`);
  lines.push(`| Avg Composite | ${comp.avg}/100 (${gradeFor(comp.avg)}) |`);
  lines.push(
    `| Score Range | ${comp.min}–${comp.max} (spread: ${comp.range}) |`,
  );
  lines.push("");

  // Per-run composite
  lines.push("## Per-Run Composite Scores");
  lines.push("");
  lines.push("| Run | Score | Grade |");
  lines.push("| --- | --- | --- |");
  for (const r of comp.per_run) {
    lines.push(`| ${r.run} | ${r.score}/100 | ${r.grade} |`);
  }
  lines.push("");

  // Dimension comparison table
  lines.push("## Per-Dimension Comparison");
  lines.push("");
  const dimHeader = [
    "Dimension",
    ...runs.map((r) => r.replace("contoso-service-hub-", "")),
    "Avg",
    "Δ",
  ];
  lines.push(`| ${dimHeader.join(" | ")} |`);
  lines.push(`| ${dimHeader.map(() => "---").join(" | ")} |`);

  for (const [dim, stats] of Object.entries(dims)) {
    const name = dim.replace(/_/g, " ");
    const perRun = stats.scores.map((s) =>
      s.score != null ? `${s.score}` : "—",
    );
    lines.push(
      `| ${name} | ${perRun.join(" | ")} | **${stats.avg}** | ${stats.range} |`,
    );
  }
  lines.push("");

  // Recurring lessons highlight
  const { recurring } = combinedLessons;
  if (recurring.length > 0) {
    lines.push("## Recurring Lessons (Systemic Issues)");
    lines.push("");
    lines.push(
      "These lessons appeared in multiple runs, signaling systemic patterns:",
    );
    lines.push("");
    lines.push("| Theme | Frequency | Runs |");
    lines.push("| --- | --- | --- |");
    for (const r of recurring.sort((a, b) => b.occurrences - a.occurrences)) {
      lines.push(
        `| ${r.normalized_title} | ${r.occurrences}/${runs.length} | ${r.runs.map((x) => x.replace("contoso-service-hub-", "")).join(", ")} |`,
      );
    }
    lines.push("");
  }

  // Severity distribution
  const { lessons } = combinedLessons;
  const bySeverity = {};
  for (const l of lessons) {
    bySeverity[l.severity] = (bySeverity[l.severity] || 0) + 1;
  }
  lines.push("## Lesson Severity Distribution");
  lines.push("");
  lines.push("| Severity | Count |");
  lines.push("| --- | --- |");
  for (const sev of ["critical", "high", "medium", "low"]) {
    if (bySeverity[sev]) lines.push(`| ${sev} | ${bySeverity[sev]} |`);
  }
  lines.push(`| **Total** | **${lessons.length}** |`);
  lines.push("");

  // Category distribution
  const byCategory = {};
  for (const l of lessons) {
    byCategory[l.category] = (byCategory[l.category] || 0) + 1;
  }
  lines.push("## Lesson Category Distribution");
  lines.push("");
  lines.push("| Category | Count |");
  lines.push("| --- | --- |");
  for (const [cat, count] of Object.entries(byCategory).sort(
    (a, b) => b[1] - a[1],
  )) {
    lines.push(`| ${cat} | ${count} |`);
  }
  lines.push("");

  // Weakest dimensions
  const weakest = Object.entries(dims)
    .sort((a, b) => a[1].avg - b[1].avg)
    .slice(0, 3);
  lines.push("## Top Improvement Areas");
  lines.push("");
  for (const [dim, stats] of weakest) {
    lines.push(
      `- **${dim.replace(/_/g, " ")}**: avg ${stats.avg}/100 (range ${stats.min}–${stats.max})`,
    );
  }
  lines.push("");

  // Grade scale reference
  lines.push("## Grade Scale");
  lines.push("");
  lines.push("| Grade | Range | Meaning |");
  lines.push("| --- | --- | --- |");
  lines.push("| A | 90-100 | Excellent — production ready |");
  lines.push("| B | 80-89 | Good — minor improvements |");
  lines.push("| C | 70-79 | Acceptable — needs work |");
  lines.push("| D | 60-69 | Below average — significant gaps |");
  lines.push("| F | <60 | Failing — major issues |");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("_Generated by combine-e2e-runs.mjs_");

  return lines.join("\n");
}

// --- Main ---
function main() {
  console.log(`Combining ${runs.length} E2E runs → ${outDir}/`);

  // Validate all runs exist
  for (const run of runs) {
    const dir = path.join(AGENT_OUTPUT, run);
    if (!fs.existsSync(dir)) {
      console.error(`  ✗ Run directory not found: ${dir}`);
      process.exit(1);
    }
  }

  // Create output directory
  fs.mkdirSync(outDir, { recursive: true });

  // Combine lessons
  console.log("  → Combining lessons learned...");
  const combinedLessons = combineLessons();
  const lessonsPath = path.join(outDir, "09-lessons-learned.json");
  fs.writeFileSync(
    lessonsPath,
    JSON.stringify(combinedLessons.lessons, null, 2),
  );
  console.log(
    `    ${combinedLessons.lessons.length} lessons (${combinedLessons.recurring.length} recurring themes)`,
  );

  // Combine scores
  console.log("  → Combining benchmark scores...");
  const combinedScores = combineScores();
  if (combinedScores) {
    const scoresPath = path.join(outDir, "08-benchmark-scores.json");
    fs.writeFileSync(scoresPath, JSON.stringify(combinedScores, null, 2));
    console.log(`    Avg composite: ${combinedScores.composite_stats.avg}/100`);
  }

  // Generate combined report
  console.log("  → Generating combined benchmark report...");
  if (combinedScores) {
    const report = generateReport(combinedScores, combinedLessons);
    const reportPath = path.join(outDir, "08-benchmark-report.md");
    fs.writeFileSync(reportPath, report);
  }

  // Write metadata
  const meta = {
    type: "combined-e2e-runs",
    source_runs: runs,
    created: new Date().toISOString(),
    output_dir: outDir,
    lesson_count: combinedLessons.lessons.length,
    recurring_themes: combinedLessons.recurring.length,
    composite_avg: combinedScores?.composite_stats?.avg ?? null,
  };
  fs.writeFileSync(
    path.join(outDir, "00-combine-meta.json"),
    JSON.stringify(meta, null, 2),
  );

  console.log(`\n✓ Combined output written to ${outDir}/`);
  console.log(
    "  Use e2e-analyze-lessons.prompt.md with project = " + outputName,
  );
}

main();
