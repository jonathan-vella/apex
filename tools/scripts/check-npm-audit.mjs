#!/usr/bin/env node
/**
 * npm Audit Gate
 *
 * Runs `npm audit --json` and fails on every high or critical advisory that
 * is not an accepted, unexpired exception in tools/registry/npm-audit-exceptions.json.
 * An exception covers only its exact advisory, package and installed versions,
 * plus findings that npm reports for parents solely because of that advisory.
 * Exceptions whose advisory no longer appears are reported for removal.
 *
 * Usage:
 *   node tools/scripts/check-npm-audit.mjs [--report <npm-audit.json>] [--today YYYY-MM-DD]
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadValidator } from "./_lib/ajv-validator.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXCEPTIONS_PATH = path.join(ROOT, "tools/registry/npm-audit-exceptions.json");
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/npm-audit-exceptions.schema.json");
const LOCK_PATH = path.join(ROOT, "package-lock.json");
const BLOCKING = new Set(["high", "critical"]);

const advisoryId = (url = "") => url.match(/GHSA(-[a-z0-9]{4}){3}/i)?.[0];

/**
 * Pure evaluation of an npm audit report against accepted exceptions.
 * @returns {{ errors: string[], warnings: string[], covered: string[] }}
 */
export function evaluateAudit({ report, exceptions, lockPackages, today }) {
  const errors = [];
  const warnings = [];
  const covered = [];
  const vulnerabilities = report?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== "object") {
    errors.push(`npm audit report has no vulnerabilities map${report?.error ? `: ${report.error.summary}` : ""}`);
    return { errors, warnings, covered };
  }

  for (const exception of exceptions) {
    if (exception.review_by < today) {
      errors.push(
        `exception ${exception.advisory} (${exception.package}) expired on ${exception.review_by}; re-review it`,
      );
    }
  }

  const matched = new Set();
  const memo = new Map();
  // Returns the exceptions that fully explain a vulnerable package, or null if any cause is unaccepted.
  const explain = (name, stack = new Set()) => {
    if (memo.has(name)) return memo.get(name);
    const entry = vulnerabilities[name];
    if (!entry || stack.has(name)) return null;
    stack.add(name);
    const causes = new Set();
    let ok = true;
    for (const via of entry.via ?? []) {
      if (typeof via === "string") {
        const inner = explain(via, stack);
        if (inner) inner.forEach((e) => causes.add(e));
        else ok = false;
        continue;
      }
      const id = advisoryId(via.url);
      const exception = exceptions.find((e) => e.advisory === id && e.package === via.name);
      const versions = (entry.nodes ?? []).map((node) => lockPackages[node]?.version);
      // Fail closed: a severity change or an unresolvable installed version needs a fresh review.
      if (
        !exception ||
        via.severity !== exception.severity ||
        versions.length === 0 ||
        versions.some((v) => !exception.installed.includes(v))
      ) {
        ok = false;
        continue;
      }
      matched.add(exception);
      causes.add(exception);
    }
    stack.delete(name);
    const result = ok && causes.size ? [...causes] : null;
    memo.set(name, result);
    return result;
  };

  for (const [name, entry] of Object.entries(vulnerabilities)) {
    const blocking = BLOCKING.has(entry.severity);
    const causes = explain(name);
    if (!causes) {
      const ids = (entry.via ?? []).map((via) => (typeof via === "string" ? via : (advisoryId(via.url) ?? via.title)));
      const message = `${name} (${entry.severity}) via ${ids.join(", ")} is not an accepted exception`;
      (blocking ? errors : warnings).push(message);
      continue;
    }
    if (entry.isDirect && !causes.some((e) => e.via.includes(name))) {
      errors.push(
        `${name} now carries ${causes.map((e) => e.advisory).join(", ")}; add it to the exception "via" list after review`,
      );
      continue;
    }
    covered.push(`${name} (${entry.severity}) — ${causes.map((e) => e.advisory).join(", ")}`);
  }

  for (const exception of exceptions) {
    if (!matched.has(exception)) {
      warnings.push(`exception ${exception.advisory} (${exception.package}) no longer matches npm audit; remove it`);
    }
  }
  return { errors, warnings, covered };
}

function runNpmAudit() {
  try {
    return execFileSync("npm", ["audit", "--json"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1e8 });
  } catch (error) {
    // npm audit exits non-zero whenever vulnerabilities exist; its JSON is still on stdout.
    if (error.stdout) return error.stdout;
    throw error;
  }
}

export function main(argv = process.argv.slice(2)) {
  const option = (name) => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
  };
  const r = new Reporter("npm Audit Gate");
  r.header();

  const exceptionsDoc = JSON.parse(readFileSync(EXCEPTIONS_PATH, "utf8"));
  const validate = loadValidator(SCHEMA_PATH);
  if (!validate(exceptionsDoc)) {
    for (const issue of validate.errors)
      r.error("tools/registry/npm-audit-exceptions.json", `${issue.instancePath} ${issue.message}`);
    r.summary();
    return 1;
  }

  const reportPath = option("--report");
  let report;
  try {
    report = JSON.parse(reportPath ? readFileSync(reportPath, "utf8") : runNpmAudit());
  } catch (error) {
    r.error("npm audit", `could not read audit JSON: ${error.message}`);
    r.summary();
    return 1;
  }

  const today = option("--today") ?? new Date().toISOString().slice(0, 10);
  const lockPackages = JSON.parse(readFileSync(LOCK_PATH, "utf8")).packages ?? {};
  const result = evaluateAudit({ report, exceptions: exceptionsDoc.exceptions, lockPackages, today });
  result.covered.forEach((line) => r.info("accepted", line));
  result.warnings.forEach((line) => r.warn("npm audit", line));
  result.errors.forEach((line) => r.error("npm audit", line));
  r.summary();
  return r.errors > 0 ? 1 : 0;
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) process.exit(main());
