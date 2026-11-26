#!/usr/bin/env node
/**
 * Deterministic WAF workload-control check -> bounded pillar score calculator & verifier.
 *
 * Computes or verifies `_meta/waf-scores.json` (`assessment-waf-scores-v1`) from
 * `_meta/waf-checks.json` (`assessment-waf-checks-v1`), keeping `evidence_availability`
 * and human `attested_practices` strictly excluded from numerical `0-10` pillar scores.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadValidator } from "./_lib/ajv-validator.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHECKS_SCHEMA = path.join(ROOT, "tools/schemas/assessment-waf-checks.schema.json");
const SCORES_SCHEMA = path.join(ROOT, "tools/schemas/assessment-waf-scores.schema.json");

export const PILLAR_ORDER = Object.freeze([
  "Security",
  "Reliability",
  "Performance Efficiency",
  "Cost Optimization",
  "Operational Excellence",
]);

function formatErrors(errors = []) {
  return errors.map((err) => `${err.instancePath || "/"} ${err.message}`).join("; ");
}

export function validateWafChecks(checksDoc) {
  if (!checksDoc || typeof checksDoc !== "object" || Array.isArray(checksDoc)) {
    throw new Error("WAF checks document must be a JSON object");
  }
  for (const item of checksDoc.checks ?? []) {
    if (item && (item.provenance === "attested" || item.state === "attested")) {
      throw new Error(
        `Check ${item.id ?? "<unnamed>"} uses uncorroborated human attestation; move it to attested_practices[] so 0-10 scores reflect observed controls only`,
      );
    }
  }
  const validate = loadValidator(CHECKS_SCHEMA);
  if (!validate(checksDoc)) {
    throw new Error(`Invalid waf-checks.json: ${formatErrors(validate.errors)}`);
  }
  const seenIds = new Set();
  for (const list of [checksDoc.checks ?? [], checksDoc.evidence_availability ?? []]) {
    for (const entry of list) {
      if (seenIds.has(entry.id)) {
        throw new Error(`Duplicate WAF check ID: ${entry.id}`);
      }
      seenIds.add(entry.id);
    }
  }
}

function computeConfidence(observed, applicable) {
  if (applicable <= 0) return "Low";
  const ratio = observed / applicable;
  if (ratio >= 0.7) return "High";
  if (ratio >= 0.35) return "Medium";
  return "Low";
}

function roundOneDecimal(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function computeWafScores(checksDoc, options = {}) {
  validateWafChecks(checksDoc);
  const project = options.project ?? checksDoc.project;
  const asOf = options.asOf ?? checksDoc.as_of ?? checksDoc.generated_at;
  if (typeof project !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(project)) {
    throw new Error("Project slug is required (--project or checks.project matching ^[a-z0-9][a-z0-9-]{0,62}$)");
  }
  if (typeof asOf !== "string" || !asOf.trim()) {
    throw new Error("ISO-8601 timestamp is required (--as-of, checks.as_of, or checks.generated_at)");
  }

  const buckets = new Map(
    PILLAR_ORDER.map((pillar) => [
      pillar,
      { passed_checks: 0, risk_checks: 0, intentional_tradeoff_checks: 0, unknown_checks: 0 },
    ]),
  );

  for (const item of checksDoc.checks) {
    const bucket = buckets.get(item.pillar);
    if (item.state === "passed") bucket.passed_checks += 1;
    else if (item.state === "risk") bucket.risk_checks += 1;
    else if (item.state === "intentional_tradeoff") bucket.intentional_tradeoff_checks += 1;
    else if (item.state === "unknown") bucket.unknown_checks += 1;
  }

  const pillars = PILLAR_ORDER.map((pillar) => {
    const counts = buckets.get(pillar);
    const observed = counts.passed_checks + counts.risk_checks + counts.intentional_tradeoff_checks;
    const applicable = observed + counts.unknown_checks;
    const confidence = computeConfidence(observed, applicable);
    const pct = applicable > 0 ? ((observed / applicable) * 100).toFixed(1) : "0.0";
    if (observed < 2) {
      return {
        pillar,
        status: "not_assessed",
        score: null,
        confidence,
        ...counts,
        notes: `Observed ${observed}/${applicable} applicable workload-control checks (${pct}% coverage); fewer than two observed controls, so no numerical score.`,
      };
    }
    const weightedPoints = counts.passed_checks + 0.5 * counts.intentional_tradeoff_checks;
    const score = roundOneDecimal((10 * weightedPoints) / observed);
    return {
      pillar,
      status: "scored",
      score,
      confidence,
      ...counts,
      notes: `Observed ${observed}/${applicable} checks (${pct}%); unknowns excluded from score.`,
    };
  });

  const output = {
    schema_version: "assessment-waf-scores-v1",
    project,
    as_of: asOf,
    pillars,
  };
  const validateScores = loadValidator(SCORES_SCHEMA);
  if (!validateScores(output)) {
    throw new Error(`Generated waf-scores.json failed schema validation: ${formatErrors(validateScores.errors)}`);
  }
  return output;
}

export function verifyWafScores(checksDoc, scoresDoc, options = {}) {
  const validateScores = loadValidator(SCORES_SCHEMA);
  if (!scoresDoc || typeof scoresDoc !== "object" || !validateScores(scoresDoc)) {
    throw new Error(`Invalid waf-scores.json: ${formatErrors(validateScores.errors)}`);
  }
  if (checksDoc?.project !== undefined && checksDoc.project !== scoresDoc.project) {
    throw new Error(
      `WAF project mismatch: waf-checks.json has ${JSON.stringify(checksDoc.project)}, waf-scores.json has ${JSON.stringify(scoresDoc.project)}`,
    );
  }
  if (checksDoc?.as_of !== undefined && checksDoc.as_of !== scoresDoc.as_of) {
    throw new Error(
      `WAF as_of mismatch: waf-checks.json has ${JSON.stringify(checksDoc.as_of)}, waf-scores.json has ${JSON.stringify(scoresDoc.as_of)}`,
    );
  }
  const expected = computeWafScores(checksDoc, {
    project: options.project ?? scoresDoc.project,
    asOf: options.asOf ?? scoresDoc.as_of,
  });
  const byPillar = new Map(scoresDoc.pillars.map((entry) => [entry.pillar, entry]));
  if (byPillar.size !== PILLAR_ORDER.length) {
    throw new Error("waf-scores.json must include each of the 5 WAF pillars exactly once");
  }
  const mismatches = [];
  for (const exp of expected.pillars) {
    const actual = byPillar.get(exp.pillar);
    if (!actual) {
      mismatches.push(`${exp.pillar}: missing pillar entry`);
      continue;
    }
    for (const key of [
      "status",
      "score",
      "confidence",
      "passed_checks",
      "risk_checks",
      "intentional_tradeoff_checks",
      "unknown_checks",
    ]) {
      if (actual[key] !== exp[key]) {
        mismatches.push(
          `${exp.pillar}.${key}: expected ${JSON.stringify(exp[key])}, got ${JSON.stringify(actual[key])}`,
        );
      }
    }
  }
  if (mismatches.length > 0) {
    throw new Error(`WAF scores drift from waf-checks.json: ${mismatches.join("; ")}`);
  }
  return expected;
}

function assertNoSymlinkChain(targetPath, label) {
  const resolved = path.resolve(targetPath);
  const stopRoots = new Set(
    [ROOT, process.cwd(), os.tmpdir()].map((dir) => {
      try {
        return path.resolve(dir);
      } catch {
        return dir;
      }
    }),
  );
  let cur = resolved;
  while (true) {
    if (fs.existsSync(cur) && fs.lstatSync(cur).isSymbolicLink()) {
      throw new Error(`Symlink forbidden for ${label}: ${cur}`);
    }
    if (stopRoots.has(cur)) break;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return resolved;
}

function parseJsonFile(filePath, label) {
  const safePath = assertNoSymlinkChain(filePath, label);
  const raw = fs.readFileSync(safePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Malformed JSON in ${safePath}: ${err.message}`, { cause: err });
  }
}

function resolveScopeAsOf(checksPath) {
  const metaDir = path.dirname(checksPath);
  if (path.basename(metaDir) !== "_meta") return undefined;
  const scopePath = path.join(metaDir, "assessment-scope.json");
  if (!fs.existsSync(scopePath) || fs.lstatSync(scopePath).isSymbolicLink()) return undefined;
  try {
    const scopeDoc = JSON.parse(fs.readFileSync(scopePath, "utf8"));
    const asOf = scopeDoc?.reporting?.as_of;
    return typeof asOf === "string" && asOf.trim() ? asOf.trim() : undefined;
  } catch {
    return undefined;
  }
}

function writeJsonAtomic(filePath, data) {
  const resolved = assertNoSymlinkChain(filePath, "--out");
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  assertNoSymlinkChain(path.dirname(resolved), "--out directory");
  const tmpPath = path.join(path.dirname(resolved), `.${path.basename(resolved)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    fs.renameSync(tmpPath, resolved);
  } catch (err) {
    if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true });
    throw err;
  }
}

export function runCli(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv.includes("--help")) {
    console.log(
      "Usage:\n  assessment-waf-scores.mjs compute --checks <_meta/waf-checks.json> [--project <slug>] [--as-of <iso>] [--out <_meta/waf-scores.json>]\n  assessment-waf-scores.mjs verify --checks <_meta/waf-checks.json> --scores <_meta/waf-scores.json>",
    );
    return 0;
  }
  const command = argv[0];
  const opts = {};
  for (let i = 1; i < argv.length; i += 2) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (!val || val.startsWith("-")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--checks") opts.checks = val;
    else if (flag === "--scores") opts.scores = val;
    else if (flag === "--project") opts.project = val;
    else if (flag === "--as-of") opts.asOf = val;
    else if (flag === "--out") opts.out = val;
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (!opts.checks) throw new Error("--checks is required");
  const checksPath = assertNoSymlinkChain(opts.checks, "--checks");
  const checksDoc = parseJsonFile(checksPath, "--checks");

  if (command === "compute") {
    const inferredProject =
      opts.project ??
      checksDoc.project ??
      (path.basename(path.dirname(checksPath)) === "_meta"
        ? path.basename(path.dirname(path.dirname(checksPath)))
        : undefined);
    const inferredAsOf = opts.asOf ?? checksDoc.as_of ?? resolveScopeAsOf(checksPath) ?? checksDoc.generated_at;
    const result = computeWafScores(checksDoc, { project: inferredProject, asOf: inferredAsOf });
    if (opts.out) {
      writeJsonAtomic(opts.out, result);
    }
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  if (command === "verify") {
    if (!opts.scores) throw new Error("--scores is required for verify");
    const scoresDoc = parseJsonFile(opts.scores, "--scores");
    verifyWafScores(checksDoc, scoresDoc, { project: opts.project, asOf: opts.asOf });
    console.log(JSON.stringify({ valid: true, project: scoresDoc.project, as_of: scoresDoc.as_of }));
    return 0;
  }
  throw new Error(`Unknown command: ${command} (expected compute or verify)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    console.error(`WAF scores error: ${error.message}`);
    process.exitCode = 1;
  }
}
