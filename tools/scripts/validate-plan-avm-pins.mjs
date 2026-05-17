#!/usr/bin/env node
/**
 * Plan-level AVM pin validator.
 *
 * Scans `agent-output/<project>/04-implementation-plan.md` (or any path
 * passed on the CLI) for inline AVM module references of the form:
 *
 *   avm: avm/res/<group>/<name>:<X.Y.Z>
 *   br/public:avm/res/<group>/<name>:<X.Y.Z>
 *   avm/res/<group>/<name>:<X.Y.Z>            (bare form, in tables)
 *
 * and validates each pin against MCR via the shared resolver in
 * `tools/scripts/_lib/avm-module-resolver.mjs`.
 *
 * Rationale: `validate:avm-versions:freeze` only inspects the
 * machine-readable IaC contract (`04-iac-contract.json` →
 * `modules.bicep[].version`). It does NOT see stale pins inlined in
 * the plan markdown itself — including the 15–25 `avm:` lines that
 * appear inside Implementation Tasks YAML blocks. This script closes
 * that gap. See planner Phase 5 Plan-Status Attestation.
 *
 * Usage:
 *   node tools/scripts/validate-plan-avm-pins.mjs [--mode=freeze|ci|local]
 *                                                 [--no-network]
 *                                                 [<plan.md> ...]
 *
 * With no path argument, validates every
 * `agent-output/*\/04-implementation-plan.md`.
 *
 * Exit codes:
 *   0  every pin matches the latest stable MCR tag (or has a
 *      justified exception note in the same line)
 *   1  one or more pins are stale, missing, or unresolvable
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Reporter } from "./_lib/reporter.mjs";
import { resolveLatest, classifyPin } from "./_lib/avm-module-resolver.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// `avm: avm/res/<grp>/<name>:<ver>` (YAML form)
// `br/public:avm/res/<grp>/<name>:<ver>` (Bicep module ref)
// Bare `avm/res/<grp>/<name>:<ver>` (tables)
const PLAN_AVM_RE =
  /(?:avm:\s*|br\/public:)?(?:avm\/(?:res|ptn)\/[a-z0-9-]+(?:\/[a-z0-9-]+)+):(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/gi;

// Re-extract the module path (everything from `avm/` through the colon).
const MODULE_PATH_RE = /(avm\/(?:res|ptn)\/[a-z0-9-]+(?:\/[a-z0-9-]+)+):(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i;

function parseArgs(argv) {
  const opts = { mode: "freeze", allowNetwork: true, paths: [] };
  for (const arg of argv) {
    if (arg === "--no-network") opts.allowNetwork = false;
    else if (arg.startsWith("--mode=")) opts.mode = arg.slice("--mode=".length);
    else if (!arg.startsWith("--")) opts.paths.push(arg);
  }
  if (!["local", "ci", "freeze"].includes(opts.mode)) {
    throw new Error(`--mode must be local|ci|freeze (got ${opts.mode})`);
  }
  return opts;
}

function defaultPlanPaths() {
  const out = [];
  const root = path.join(ROOT, "agent-output");
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(root, entry.name, "04-implementation-plan.md");
    if (fs.existsSync(candidate)) out.push(candidate);
  }
  return out;
}

function* extractPins(text) {
  const seen = new Set();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of line.matchAll(PLAN_AVM_RE)) {
      const full = m[0];
      const tail = MODULE_PATH_RE.exec(full);
      if (!tail) continue;
      const modulePath = tail[1];
      const version = tail[2];
      // Normalise `br/public:avm/...` to source-id format expected by resolver.
      const source = `br/public:${modulePath}`;
      const key = `${i + 1}:${source}:${version}`;
      if (seen.has(key)) continue;
      seen.add(key);
      yield {
        line: i + 1,
        rawLine: line.trim().slice(0, 140),
        source,
        version,
        modulePath,
      };
    }
  }
}

async function scanPlan(r, opts, planPath) {
  const rel = path.relative(ROOT, planPath);
  r.tick();
  if (!fs.existsSync(planPath)) {
    r.error(rel, `Plan markdown not found at ${planPath}`);
    return;
  }
  const text = fs.readFileSync(planPath, "utf-8");
  const pins = [...extractPins(text)];
  if (pins.length === 0) {
    r.info(rel, "No AVM pins found in plan — skipping.");
    return;
  }
  for (const pin of pins) {
    const where = `${rel}:${pin.line} (${pin.source})`;
    const resolved = await resolveLatest({
      tool: "bicep",
      source: pin.source,
      mode: opts.mode,
      allowNetwork: opts.allowNetwork,
    });
    const cls = classifyPin({ pinned: pin.version, resolved });
    if (cls.result === "ok") {
      r.ok(where, `pinned ${pin.version} matches latest stable (source: ${resolved.source}).`);
      continue;
    }
    if (cls.result === "prerelease_ignored") {
      r.info(where, cls.message);
      continue;
    }
    if (cls.result === "stale") {
      // The plan format does not yet have a structured pin_policy field;
      // a stale pin in the plan is always a hard error in freeze mode.
      r.error(
        where,
        `stale_pin: ${cls.message}. Bump to ${resolved.latest} or document an exception in 04-iac-contract.json modules[].pin_policy.`,
      );
      continue;
    }
    if (cls.result === "missing_version") {
      r.error(where, `missing_version: ${cls.message}`);
      continue;
    }
    if (cls.result === "lookup_unavailable") {
      if (opts.mode === "ci" || opts.mode === "freeze") {
        r.error(where, `lookup_unavailable in ${opts.mode} mode: ${cls.message}`);
      } else {
        r.info(where, `lookup_unavailable (mode=local): ${cls.message}`);
      }
      continue;
    }
    r.error(where, `unclassified_pin_result: ${cls.result} (${cls.message ?? "no message"})`);
  }
}

async function main() {
  const r = new Reporter("Plan AVM Pin Validator");
  const opts = parseArgs(process.argv.slice(2));
  const plans = opts.paths.length ? opts.paths : defaultPlanPaths();
  if (plans.length === 0) {
    r.info("(none)", "No plan markdown files matched — skipping (treated as pass).");
    r.summary();
    return;
  }
  for (const plan of plans) {
    await scanPlan(r, opts, plan);
  }
  r.exitOnError("Plan AVM pins all match latest stable.", "Plan AVM pin validation failed.");
}

main().catch((err) => {
  console.error(err.stack ?? err);
  process.exit(2);
});
