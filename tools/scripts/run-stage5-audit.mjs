#!/usr/bin/env node
/**
 * Stage 5-Audit (Plan 2 / Sensei GEPA Pipeline) — resumable runner.
 *
 * For each requested skill:
 *   1. Capture pre-state (SHA, tokens) and copy SKILL.md to
 *      stage5-snapshots/{skill}.before.md if not already present.
 *   2. Run `auto_evaluator.py optimize` via litellm + GitHub Models.
 *   3. Extract the trailing `optimized` field from the JSON output and save it
 *      to stage5-snapshots/{skill}.candidate.md.
 *   4. Run `audit-gepa-candidate.mjs` to classify SAFE / REVIEW / REJECT.
 *   5. Append a single-row verdict to stage5-snapshots/audit-log.json
 *      (resume marker — skills already in this log are skipped on re-runs).
 *
 * **NEVER writes to `.github/skills/{skill}/SKILL.md`.** Audit mode only.
 *
 * Prerequisites (set up once per session):
 *   unset GH_TOKEN GITHUB_TOKEN
 *   gh auth login --hostname github.com --web --git-protocol https
 *   pip install --quiet gepa>=0.3.0 litellm
 *   export OPENAI_API_BASE=https://models.github.ai/inference
 *   export OPENAI_API_KEY=$(gh auth token)
 *
 * Usage:
 *   node tools/scripts/run-stage5-audit.mjs --batch 1
 *   node tools/scripts/run-stage5-audit.mjs --skills azure-prepare azure-defaults
 *   node tools/scripts/run-stage5-audit.mjs --all
 *   node tools/scripts/run-stage5-audit.mjs --resume   # re-runs only failed/missing
 *
 * Optional:
 *   --model openai/gpt-5            (default; per smoke-test calibration)
 *   --iterations 80                 (default; 40 to halve LLM cost)
 *   --force-rerun                   (re-optimize even if snapshot exists)
 */

import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  appendFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const SNAPSHOT_DIR = resolve(REPO_ROOT, ".github", "skills", "_audits", "stage5-snapshots");
const LOG_PATH = resolve(SNAPSHOT_DIR, "audit-log.json");

const BATCHES = {
  1: ["azure-adr", "azure-artifacts", "azure-bicep-patterns", "azure-cloud-migrate",
      "azure-compliance", "azure-compute", "azure-cost-optimization"],
  2: ["azure-defaults", "azure-deploy", "azure-diagnostics", "azure-governance-discovery",
      "azure-kusto", "azure-prepare", "azure-quotas"],
  3: ["azure-rbac", "azure-resources", "azure-storage", "azure-validate",
      "context-management", "docs-writer", "drawio"],
  4: ["entra-app-registration", "github-operations", "golden-principles",
      "iac-common", "mermaid", "microsoft-docs"],
  5: ["python-diagrams", "terraform-patterns", "terraform-search-import",
      "terraform-test", "vendor-prompting", "workflow-engine"],
};

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    skills: [],
    all: false,
    batch: null,
    resume: false,
    forceRerun: false,
    model: "openai/gpt-5",
    iterations: 80,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") opts.all = true;
    else if (arg === "--batch") opts.batch = Number(argv[++i]);
    else if (arg === "--resume") opts.resume = true;
    else if (arg === "--force-rerun") opts.forceRerun = true;
    else if (arg === "--model") opts.model = argv[++i];
    else if (arg === "--iterations") opts.iterations = Number(argv[++i]);
    else if (arg === "--skills") {
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        opts.skills.push(argv[++i]);
      }
    } else throw new Error(`Unknown arg: ${arg}`);
  }
  return opts;
}

function resolveTargets(opts) {
  let targets = opts.skills.slice();
  if (opts.batch != null) {
    const bs = BATCHES[opts.batch];
    if (!bs) throw new Error(`Unknown batch: ${opts.batch}`);
    targets = targets.concat(bs);
  }
  if (opts.all) {
    for (const bs of Object.values(BATCHES)) targets = targets.concat(bs);
  }
  if (opts.resume) {
    const prior = loadLog();
    const completed = new Set(prior.entries.map((e) => e.skill));
    for (const bs of Object.values(BATCHES)) {
      for (const sk of bs) {
        if (!completed.has(sk)) targets.push(sk);
      }
    }
  }
  return [...new Set(targets)];
}

// ── Auth + env preflight ─────────────────────────────────────────────────────

function preflight() {
  const issues = [];
  if (!process.env.OPENAI_API_KEY) {
    issues.push("OPENAI_API_KEY is not set. Run: export OPENAI_API_KEY=$(gh auth token)");
  }
  if (!process.env.OPENAI_API_BASE) {
    issues.push("OPENAI_API_BASE is not set. Run: export OPENAI_API_BASE=https://models.github.ai/inference");
  }
  // litellm + gepa import check
  const py = spawnSync("python3", [
    "-c",
    "import gepa, litellm; import gepa.optimize_anything as oa; print('OK')",
  ], { encoding: "utf8" });
  if (py.status !== 0) {
    issues.push("Python deps missing. Run: pip install --quiet gepa>=0.3.0 litellm");
    if (py.stderr) issues.push(`(detail: ${py.stderr.trim().split("\n").pop()})`);
  }
  if (issues.length > 0) {
    console.error("Stage 5-Audit preflight FAILED:");
    for (const i of issues) console.error(`  ✗ ${i}`);
    console.error("");
    console.error("See .github/skills/_audits/04-gepa-optimize.md → 'Stage 5 — auth path that worked'.");
    process.exit(2);
  }
}

// ── Audit log (resume marker) ────────────────────────────────────────────────

function loadLog() {
  if (!existsSync(LOG_PATH)) return { entries: [] };
  try {
    return JSON.parse(readFileSync(LOG_PATH, "utf8"));
  } catch {
    return { entries: [] };
  }
}

function appendLog(entry) {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const log = loadLog();
  // Replace any prior entry for the same skill (force-rerun case).
  log.entries = log.entries.filter((e) => e.skill !== entry.skill);
  log.entries.push(entry);
  log.lastUpdated = new Date().toISOString();
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + "\n");
}

// ── Per-skill audit ──────────────────────────────────────────────────────────

function gitHashObject(path) {
  const r = spawnSync("git", ["hash-object", path], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function captureBefore(skill) {
  const skillPath = resolve(REPO_ROOT, ".github", "skills", skill, "SKILL.md");
  if (!existsSync(skillPath)) throw new Error(`Skill not found: ${skillPath}`);
  const beforePath = resolve(SNAPSHOT_DIR, `${skill}.before.md`);
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  if (!existsSync(beforePath)) {
    copyFileSync(skillPath, beforePath);
  }
  return { skillPath, beforePath, sha: gitHashObject(skillPath) };
}

function runOptimize(skill, model, iterations) {
  const candidatePath = resolve(SNAPSHOT_DIR, `${skill}.candidate.md`);
  const stdoutPath = resolve(SNAPSHOT_DIR, `${skill}.optimize-stdout.txt`);

  console.log(`  optimize ▶ ${skill} (model=${model}, iterations=${iterations})`);

  // Note: auto_evaluator.py mixes log lines and JSON in stdout. We capture all
  // of stdout, then walk back from the end to extract the trailing `{ … }`
  // object — the same parsing strategy used by the smoke-test analysis.
  const r = spawnSync(
    "python3",
    [
      ".github/skills/sensei/scripts/src/gepa/auto_evaluator.py",
      "optimize",
      "--skill", skill,
      "--skills-dir", ".github/skills",
      "--tests-dir", "tests",
      "--iterations", String(iterations),
      "--model", model,
      "--json",
    ],
    { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );

  // Persist raw stdout for debugging / audit trail.
  writeFileSync(stdoutPath, r.stdout || "");

  if (r.status !== 0) {
    return {
      ok: false,
      reason: `optimize exited ${r.status}: ${(r.stderr || "").slice(-400)}`,
      candidatePath,
      stdoutPath,
    };
  }

  const text = (r.stdout || "").trimEnd();
  if (!text.endsWith("}")) {
    return { ok: false, reason: "optimize did not produce trailing JSON object", candidatePath, stdoutPath };
  }

  // Walk back from end to find the matching `{`.
  let depth = 0;
  let started = false;
  let pos = text.length;
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "}") { depth++; started = true; }
    else if (ch === "{") {
      depth--;
      if (started && depth === 0) { pos = i; break; }
    }
  }
  let parsed;
  try {
    parsed = JSON.parse(text.slice(pos));
  } catch (err) {
    return { ok: false, reason: `JSON parse failed: ${err.message}`, candidatePath, stdoutPath };
  }
  if (!parsed.optimized) {
    return { ok: false, reason: "JSON output missing 'optimized' field", candidatePath, stdoutPath };
  }

  writeFileSync(candidatePath, parsed.optimized);
  return {
    ok: true,
    candidatePath,
    stdoutPath,
    bestScore: parsed.best_score ?? null,
    candidateChars: parsed.optimized.length,
    originalChars: (parsed.original || "").length,
  };
}

function runDetector(skill, beforePath, candidatePath) {
  const r = spawnSync(
    "node",
    [
      "tools/scripts/audit-gepa-candidate.mjs",
      "--skill", skill,
      "--before", beforePath,
      "--candidate", candidatePath,
      "--json",
    ],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  // Detector exits 0 (SAFE) / 1 (REVIEW) / 2 (REJECT).
  if (![0, 1, 2].includes(r.status)) {
    return { ok: false, reason: `detector exited ${r.status}: ${r.stderr.slice(-200)}` };
  }
  try {
    const report = JSON.parse(r.stdout);
    return { ok: true, report };
  } catch (err) {
    return { ok: false, reason: `detector JSON parse failed: ${err.message}` };
  }
}

function summarize(report) {
  const findings = report.findings.map((f) => ({
    rule: f.rule,
    severity: f.severity,
    detail: f.detail,
  }));
  return {
    verdict: report.verdict,
    findings,
    h2_lost: (report.findings.find((f) => f.rule === "h2-preservation") || { items: [] }).items.length,
    refs_orphaned: (report.findings.find((f) => f.rule === "reference-orphans") || { items: [] }).items.length,
    cross_skill_lost: (report.findings.find((f) => f.rule === "cross-skill-mentions") || { items: [] }).items.length,
    tokens_delta_pct: report.metrics.tokens_delta_pct,
    version_change: report.metrics.version_before !== report.metrics.version_after
      ? `${report.metrics.version_before} → ${report.metrics.version_after}`
      : null,
  };
}

function badgeFor(verdict) {
  if (verdict === "REJECT") return "❌";
  if (verdict === "REVIEW") return "⚠️ ";
  return "✅";
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (err) { console.error(err.message); process.exit(2); }

  preflight();

  const targets = resolveTargets(opts);
  if (targets.length === 0) {
    console.error("No targets. Use --batch <N>, --skills <a> <b>, --all, or --resume.");
    process.exit(2);
  }

  console.log(`Stage 5-Audit — ${targets.length} skill(s) targeted (model=${opts.model}, iterations=${opts.iterations})`);

  const priorLog = loadLog();
  const completedBefore = new Set(priorLog.entries.map((e) => e.skill));
  const summary = [];

  for (const skill of targets) {
    if (!opts.forceRerun && completedBefore.has(skill)) {
      console.log(`  skip      ${skill} (already in audit-log; use --force-rerun to re-evaluate)`);
      const prior = priorLog.entries.find((e) => e.skill === skill);
      summary.push(prior);
      continue;
    }

    const start = Date.now();
    let entry = { skill, startedAt: new Date().toISOString() };

    try {
      const before = captureBefore(skill);
      entry.beforeSha = before.sha;
      entry.beforePath = before.beforePath.replace(REPO_ROOT + "/", "");

      const opt = runOptimize(skill, opts.model, opts.iterations);
      if (!opt.ok) {
        entry.status = "ERROR";
        entry.error = opt.reason;
        appendLog(entry);
        summary.push(entry);
        console.log(`  ❌ error  ${skill}: ${opt.reason}`);
        continue;
      }
      entry.candidatePath = opt.candidatePath.replace(REPO_ROOT + "/", "");
      entry.optimizeStdout = opt.stdoutPath.replace(REPO_ROOT + "/", "");
      entry.candidateChars = opt.candidateChars;
      entry.originalChars = opt.originalChars;

      const det = runDetector(skill, before.beforePath, opt.candidatePath);
      if (!det.ok) {
        entry.status = "ERROR";
        entry.error = det.reason;
        appendLog(entry);
        summary.push(entry);
        console.log(`  ❌ error  ${skill}: ${det.reason}`);
        continue;
      }

      const sum = summarize(det.report);
      entry.status = "DONE";
      entry.verdict = sum.verdict;
      entry.summary = sum;
      entry.elapsedMs = Date.now() - start;
      entry.completedAt = new Date().toISOString();
      appendLog(entry);
      summary.push(entry);

      console.log(
        `  ${badgeFor(sum.verdict)} ${sum.verdict.padEnd(7)} ${skill}  ` +
        `(H2 -${sum.h2_lost}, refs -${sum.refs_orphaned}, x-skill -${sum.cross_skill_lost}, ` +
        `tokens ${sum.tokens_delta_pct >= 0 ? "+" : ""}${sum.tokens_delta_pct}%, ` +
        `${(entry.elapsedMs / 1000).toFixed(1)}s)`
      );
    } catch (err) {
      entry.status = "ERROR";
      entry.error = err.message;
      appendLog(entry);
      summary.push(entry);
      console.log(`  ❌ error  ${skill}: ${err.message}`);
    }
  }

  // Final tally
  console.log("");
  const tally = { SAFE: 0, REVIEW: 0, REJECT: 0, ERROR: 0, SKIP: 0 };
  for (const e of summary) {
    if (e.status === "ERROR") tally.ERROR++;
    else if (!e.verdict) tally.SKIP++;
    else tally[e.verdict] = (tally[e.verdict] || 0) + 1;
  }
  console.log(`Tally: SAFE=${tally.SAFE} REVIEW=${tally.REVIEW} REJECT=${tally.REJECT} ERROR=${tally.ERROR}`);
  console.log(`Audit log: ${LOG_PATH.replace(REPO_ROOT + "/", "")}`);
  console.log("");
  console.log("Next step: review verdicts; append a verdict table to");
  console.log("  .github/skills/_audits/04-gepa-optimize.md");
  console.log("Stage 5-Apply remains paused. NO writes to .github/skills/{skill}/SKILL.md.");
}

main();
