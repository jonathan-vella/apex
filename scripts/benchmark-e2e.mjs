#!/usr/bin/env node
/**
 * E2E Benchmark Scoring Engine
 *
 * Benchmarks E2E RALPH loop results against a per-complexity expected set.
 * Simple projects: ~25 artifacts (vs Nordic standard ~49).
 * Nordic is a structural quality reference (H2 compliance, JSON schema).
 *
 * Dimensions scored 0-100:
 *   - Artifact completeness
 *   - Structural compliance
 *   - Code quality (Bicep)
 *   - Review thoroughness
 *   - WAF coverage
 *   - Cost accuracy
 *   - Session state integrity
 *   - Timing performance
 *
 * Usage:
 *   node scripts/benchmark-e2e.mjs
 *
 * Output:
 *   agent-output/e2e-ralph-loop/08-benchmark-report.md
 *   agent-output/e2e-ralph-loop/08-benchmark-scores.json
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const PROJECT = "e2e-ralph-loop";
const OUTPUT_DIR = path.join("agent-output", PROJECT);
const BICEP_DIR = path.join("infra", "bicep", PROJECT);

// Simple-complexity expected artifact set (~25 artifacts)
const EXPECTED_ARTIFACTS = {
  "00-session-state.json": { required: true, step: 0 },
  "00-handoff.md": { required: true, step: 0 },
  "01-requirements.md": { required: true, step: 1 },
  "02-architecture-assessment.md": { required: true, step: 2 },
  "03-des-cost-estimate.md": { required: false, step: 2 },
  "03-des-diagram.py": { required: false, step: 3 },
  "03-des-diagram.png": { required: false, step: 3 },
  "03-des-adr-*.md": { required: false, step: 3, glob: true },
  "04-governance-constraints.md": { required: true, step: 3.5 },
  "04-governance-constraints.json": { required: true, step: 3.5 },
  "04-implementation-plan.md": { required: true, step: 4 },
  "04-dependency-diagram.py": { required: true, step: 4 },
  "04-runtime-diagram.py": { required: true, step: 4 },
  "06-deployment-summary.md": { required: true, step: 6 },
  "07-documentation-index.md": { required: true, step: 7 },
  "07-design-document.md": { required: true, step: 7 },
  "07-operations-runbook.md": { required: true, step: 7 },
  "07-resource-inventory.md": { required: true, step: 7 },
  "07-backup-dr-plan.md": { required: true, step: 7 },
  "07-compliance-matrix.md": { required: false, step: 7 },
  "07-ab-cost-estimate.md": { required: false, step: 7 },
};

// Weight each dimension for composite score
const WEIGHTS = {
  artifact_completeness: 0.2,
  structural_compliance: 0.15,
  code_quality: 0.2,
  review_thoroughness: 0.1,
  waf_coverage: 0.1,
  cost_accuracy: 0.05,
  session_state_integrity: 0.1,
  timing_performance: 0.1,
};

function fileExists(fp) {
  try {
    return fs.statSync(fp).size > 0;
  } catch {
    return false;
  }
}

function globMatch(dir, pattern) {
  try {
    const files = fs.readdirSync(dir);
    const re = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return files.filter((f) => re.test(f));
  } catch {
    return [];
  }
}

function runCmd(cmd) {
  try {
    execSync(cmd, {
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch {
    return null;
  }
}

function gradeScore(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

// --- Dimension Scorers ---

function scoreArtifactCompleteness() {
  let found = 0;
  let total = 0;
  const missing = [];

  for (const [name, spec] of Object.entries(EXPECTED_ARTIFACTS)) {
    total++;
    if (spec.glob) {
      const matches = globMatch(OUTPUT_DIR, name);
      if (matches.length > 0) {
        found++;
      } else if (spec.required) {
        missing.push(name);
      }
    } else {
      if (fileExists(path.join(OUTPUT_DIR, name))) {
        found++;
      } else if (spec.required) {
        missing.push(name);
      }
    }
  }

  const score = Math.round((found / total) * 100);
  return { score, found, total, missing, grade: gradeScore(score) };
}

function scoreStructuralCompliance() {
  // Run artifact template validator + H2 sync
  const templatePass = runCmd("npm run lint:artifact-templates --silent 2>&1");
  const h2Pass = runCmd("npm run lint:h2-sync --silent 2>&1");
  const sessionPass = runCmd("npm run validate:session-state --silent 2>&1");

  let score = 0;
  const checks = [];
  if (templatePass) {
    score += 40;
    checks.push("artifact-templates: PASS");
  } else {
    checks.push("artifact-templates: FAIL");
  }
  if (h2Pass) {
    score += 30;
    checks.push("h2-sync: PASS");
  } else {
    checks.push("h2-sync: FAIL");
  }
  if (sessionPass) {
    score += 30;
    checks.push("session-state: PASS");
  } else {
    checks.push("session-state: FAIL");
  }

  return { score, checks, grade: gradeScore(score) };
}

function scoreCodeQuality() {
  const mainBicep = path.join(BICEP_DIR, "main.bicep");
  if (!fileExists(mainBicep)) {
    return { score: 0, details: "main.bicep not found", grade: "F" };
  }

  const buildPass = runCmd(`bicep build ${mainBicep}`);
  const lintPass = runCmd(`bicep lint ${mainBicep}`);

  // Check for AVM module usage
  let avmCount = 0;
  try {
    const content = fs.readFileSync(mainBicep, "utf-8");
    avmCount = (content.match(/br\/public:avm/g) || []).length;
  } catch {
    /* empty */
  }

  let score = 0;
  if (buildPass) score += 50;
  if (lintPass) score += 30;
  if (avmCount > 0) score += 20;

  return {
    score,
    build_pass: buildPass,
    lint_pass: lintPass,
    avm_module_count: avmCount,
    grade: gradeScore(score),
  };
}

function scoreReviewThoroughness() {
  const state = readJson(path.join(OUTPUT_DIR, "00-session-state.json"));
  if (!state || !state.review_audit)
    return { score: 0, details: "No review audit data", grade: "F" };

  let stepsWithReview = 0;
  let totalSteps = 0;
  const details = [];

  for (const [key, audit] of Object.entries(state.review_audit)) {
    totalSteps++;
    if (audit.passes_executed > 0) {
      stepsWithReview++;
      details.push(`${key}: ${audit.passes_executed} passes`);
    } else {
      details.push(`${key}: no review`);
    }
  }

  const score =
    totalSteps > 0 ? Math.round((stepsWithReview / totalSteps) * 100) : 0;
  return { score, details, grade: gradeScore(score) };
}

function scoreWafCoverage() {
  const archFile = path.join(OUTPUT_DIR, "02-architecture-assessment.md");
  if (!fileExists(archFile))
    return { score: 0, details: "No architecture assessment", grade: "F" };

  try {
    const content = fs.readFileSync(archFile, "utf-8");
    const pillars = [
      "Security",
      "Reliability",
      "Performance",
      "Cost",
      "Operations",
    ];
    const found = pillars.filter((p) =>
      content.toLowerCase().includes(p.toLowerCase()),
    );
    const score = Math.round((found.length / pillars.length) * 100);
    return { score, pillars_found: found, grade: gradeScore(score) };
  } catch {
    return {
      score: 0,
      details: "Error reading architecture assessment",
      grade: "F",
    };
  }
}

function scoreCostAccuracy() {
  const state = readJson(path.join(OUTPUT_DIR, "00-session-state.json"));
  const budget = state?.decisions?.budget || "";
  const budgetMatch = budget.match(/(\d+)/);
  if (!budgetMatch)
    return { score: 50, details: "No budget in decisions", grade: "D" };

  // Check if cost estimate exists
  const costFile = path.join(OUTPUT_DIR, "03-des-cost-estimate.md");
  const abCostFile = path.join(OUTPUT_DIR, "07-ab-cost-estimate.md");
  const hasCost = fileExists(costFile) || fileExists(abCostFile);

  return {
    score: hasCost ? 80 : 40,
    budget_stated: budget,
    cost_estimate_exists: hasCost,
    grade: gradeScore(hasCost ? 80 : 40),
  };
}

function scoreSessionStateIntegrity() {
  const state = readJson(path.join(OUTPUT_DIR, "00-session-state.json"));
  if (!state)
    return {
      score: 0,
      details: "Invalid or missing session state",
      grade: "F",
    };

  let score = 0;
  const checks = [];

  if (state.schema_version) {
    score += 15;
    checks.push("schema_version: present");
  }
  if (state.project === PROJECT) {
    score += 15;
    checks.push("project: correct");
  }
  if (state.iac_tool) {
    score += 10;
    checks.push("iac_tool: set");
  }
  if (state.decisions && Object.keys(state.decisions).length >= 5) {
    score += 20;
    checks.push("decisions: populated");
  }
  if (state.steps) {
    const completedSteps = Object.values(state.steps).filter(
      (s) => s.status === "complete",
    ).length;
    const stepScore = Math.min(40, Math.round((completedSteps / 8) * 40));
    score += stepScore;
    checks.push(`steps completed: ${completedSteps}/8`);
  }

  return { score, checks, grade: gradeScore(score) };
}

function scoreTimingPerformance() {
  const iterLog = readJson(path.join(OUTPUT_DIR, "08-iteration-log.json"));
  if (!iterLog || !iterLog.entries || iterLog.entries.length === 0) {
    return { score: 50, details: "No iteration log data", grade: "D" };
  }

  let withinThreshold = 0;
  let total = 0;
  for (const entry of iterLog.entries) {
    if (entry.duration_ms) {
      total++;
      const isCodegen = entry.step === 5;
      const threshold = isCodegen ? 600000 : 180000; // 10min or 3min
      if (entry.duration_ms <= threshold) withinThreshold++;
    }
  }

  const score = total > 0 ? Math.round((withinThreshold / total) * 100) : 50;
  return {
    score,
    within_threshold: withinThreshold,
    total,
    grade: gradeScore(score),
  };
}

// --- Report Generation ---

function generateBenchmarkReport(scores, composite) {
  const lessons = readJson(path.join(OUTPUT_DIR, "09-lessons-learned.json"));
  const state = readJson(path.join(OUTPUT_DIR, "00-session-state.json"));
  const iterLog = readJson(path.join(OUTPUT_DIR, "08-iteration-log.json"));

  const completedSteps = state?.steps
    ? Object.entries(state.steps)
        .filter(([, s]) => s.status === "complete")
        .map(([k]) => k)
    : [];

  const totalIterations = iterLog?.entries?.length || 0;

  let report = `# E2E RALPH Loop — Benchmark Report

> Run: e2e-ralph-001 | Date: ${new Date().toISOString().split("T")[0]}
> Project: ${PROJECT} | Complexity: simple | IaC: Bicep

## Execution Summary

| Metric             | Value                          |
| ------------------ | ------------------------------ |
| Steps Completed    | ${completedSteps.length}/8     |
| Total Iterations   | ${totalIterations}             |
| Session Splits     | 0                              |
| Composite Score    | ${composite.score}/100 (${composite.grade}) |

## Per-Dimension Scorecard

| Dimension              | Score  | Grade | Weight | Weighted |
| ---------------------- | ------ | ----- | ------ | -------- |
`;

  for (const [dim, weight] of Object.entries(WEIGHTS)) {
    const s = scores[dim];
    const weighted = Math.round(s.score * weight);
    report += `| ${dim.replace(/_/g, " ")} | ${s.score}/100 | ${s.grade} | ${(weight * 100).toFixed(0)}% | ${weighted} |\n`;
  }

  report += `| **Composite** | **${composite.score}/100** | **${composite.grade}** | 100% | ${composite.score} |\n`;

  // Per-step results
  report += `\n## Per-Step Results\n\n`;
  report += `| Step | Name | Status | Iterations | Findings |\n`;
  report += `| ---- | ---- | ------ | ---------- | -------- |\n`;

  if (state?.steps) {
    for (const [num, step] of Object.entries(state.steps)) {
      const stepIters =
        iterLog?.entries?.filter((e) => String(e.step) === num).length || 0;
      report += `| ${num} | ${step.name} | ${step.status} | ${stepIters} | ${step.artifacts?.length || 0} artifacts |\n`;
    }
  }

  // Quality grade explanation
  report += `\n## Quality Grade\n\n`;
  report += `Composite score: **${composite.score}/100** → Grade: **${composite.grade}**\n\n`;
  report += `| Grade | Range    | Meaning                    |\n`;
  report += `| ----- | -------- | -------------------------- |\n`;
  report += `| A     | 90-100   | Excellent — production ready |\n`;
  report += `| B     | 80-89    | Good — minor improvements   |\n`;
  report += `| C     | 70-79    | Acceptable — needs work     |\n`;
  report += `| D     | 60-69    | Below average — significant gaps |\n`;
  report += `| F     | <60      | Failing — major issues       |\n`;

  // Improvement backlog from lessons
  if (lessons?.lessons?.length > 0) {
    report += `\n## Improvement Backlog\n\n`;
    report += `_Auto-generated from ${lessons.lessons.length} lessons learned._\n\n`;

    const sorted = [...lessons.lessons].sort((a, b) => {
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
    });

    report += `| # | Severity | Category | Title | Applies To |\n`;
    report += `| - | -------- | -------- | ----- | ---------- |\n`;

    for (const lesson of sorted) {
      const appliesTo = (
        lesson.applies_to_paths ||
        lesson.applies_to ||
        []
      ).join(", ");
      report += `| ${lesson.id} | ${lesson.severity} | ${lesson.category} | ${lesson.title} | ${appliesTo} |\n`;
    }
  }

  report += `\n---\n\n_Generated by benchmark-e2e.mjs_\n`;

  return report;
}

// --- Main ---

console.log("🏁 E2E Benchmark Scoring Engine\n");

const scores = {
  artifact_completeness: scoreArtifactCompleteness(),
  structural_compliance: scoreStructuralCompliance(),
  code_quality: scoreCodeQuality(),
  review_thoroughness: scoreReviewThoroughness(),
  waf_coverage: scoreWafCoverage(),
  cost_accuracy: scoreCostAccuracy(),
  session_state_integrity: scoreSessionStateIntegrity(),
  timing_performance: scoreTimingPerformance(),
};

// Compute weighted composite
let compositeScore = 0;
for (const [dim, weight] of Object.entries(WEIGHTS)) {
  compositeScore += scores[dim].score * weight;
}
compositeScore = Math.round(compositeScore);
const composite = { score: compositeScore, grade: gradeScore(compositeScore) };

// Print summary
for (const [dim, result] of Object.entries(scores)) {
  console.log(
    `  ${result.grade} ${dim.replace(/_/g, " ")}: ${result.score}/100`,
  );
}
console.log(`\n  🏆 Composite: ${composite.score}/100 (${composite.grade})`);

// Write JSON scores
const scoresJson = {
  run_id: "e2e-ralph-001",
  timestamp: new Date().toISOString(),
  scores,
  composite,
};
fs.writeFileSync(
  path.join(OUTPUT_DIR, "08-benchmark-scores.json"),
  JSON.stringify(scoresJson, null, 2),
);

// Write markdown report
const report = generateBenchmarkReport(scores, composite);
fs.writeFileSync(path.join(OUTPUT_DIR, "08-benchmark-report.md"), report);

console.log(`\n  📄 Report: ${OUTPUT_DIR}/08-benchmark-report.md`);
console.log(`  📊 Scores: ${OUTPUT_DIR}/08-benchmark-scores.json`);

// Exit with appropriate code
const passThreshold = 60;
if (composite.score >= passThreshold) {
  console.log(`\n  ✅ PASS (${composite.score} >= ${passThreshold})`);
  process.exit(0);
} else {
  console.log(`\n  ❌ FAIL (${composite.score} < ${passThreshold})`);
  process.exit(1);
}
