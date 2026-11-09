#!/usr/bin/env node
/** Validate the shared ALZ baseline and any locally present private tenant baseline. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadValidator } from "./_lib/ajv-validator.mjs";
import { readGovernanceBaseline, resetGovernanceBaselineCache } from "./_lib/governance-baseline.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SHARED_BASELINE = ".github/data/alz-corp-policy-baseline.json.gz";
const PRIVATE_BASELINE = ".github/data/governance-policy-baseline.json.gz";
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/governance-baseline.schema.json");

function validateSharedBaseline(baseline, file, reporter) {
  if (baseline.baseline_kind !== "alz-corp-default") {
    reporter.error(file, "shared baseline must declare baseline_kind alz-corp-default");
  }
  if (
    baseline.coverage_status !== "COMPLETE" ||
    baseline.subscriptions_discovered !== 1 ||
    baseline.subscriptions_processed !== 1 ||
    baseline.subscriptions_skipped.length !== 0 ||
    baseline.subscriptions_excluded.length !== 0
  ) {
    reporter.error(file, "shared baseline requires COMPLETE coverage");
  }
  const entries = Object.entries(baseline.subscriptions);
  const syntheticSubscription = "00000000-0000-0000-0000-00000000a1c0";
  if (entries.length !== 1 || entries[0][0] !== syntheticSubscription) {
    reporter.error(file, "shared baseline must contain only its synthetic subscription");
  }
  for (const [subscriptionId, entry] of entries) {
    if (
      entry.subscription_id !== subscriptionId ||
      entry.source !== "alz-corp-default" ||
      entry.provenance?.kind !== "alz-corp-default" ||
      entry.provenance?.verified_against_tenant !== false ||
      entry.provenance?.alz_library_ref !== baseline.alz_library_ref ||
      entry.provenance?.azure_policy_ref !== baseline.azure_policy_ref
    ) {
      reporter.error(file, "shared baseline requires matching offline ALZ provenance, never tenant verification");
    }
    if (
      entry.discovery_status !== "COMPLETE" ||
      entry.discovery_options?.include_defender_auto !== true ||
      entry.discovery_summary?.defender_auto_filtered !== 0
    ) {
      reporter.error(file, "shared baseline requires complete discovery including Defender auto-assignments");
    }
  }
}

export function runValidator({ baselinePath, schemaPath = SCHEMA_PATH, root = ROOT } = {}) {
  const sharedPath = path.join(root, SHARED_BASELINE);
  const privatePath = path.join(root, PRIVATE_BASELINE);
  const baselinePaths = baselinePath === undefined ? [sharedPath] : [baselinePath];
  if (baselinePath === undefined && fs.existsSync(privatePath)) baselinePaths.push(privatePath);
  const r = new Reporter("Governance Baseline Validator");
  r.header();
  for (const effectivePath of baselinePaths) {
    const file = path.relative(root, effectivePath);
    const errorsBefore = r.errors;
    r.tick();
    try {
      resetGovernanceBaselineCache(effectivePath);
      const baseline = readGovernanceBaseline(effectivePath);
      const validate = loadValidator(schemaPath);
      if (!validate(baseline)) {
        for (const error of validate.errors ?? []) {
          r.error(file, `${error.instancePath || "/"} ${error.message}`);
        }
        continue;
      }
      if (effectivePath === sharedPath) validateSharedBaseline(baseline, file, r);
      if (
        effectivePath === privatePath &&
        (baseline.baseline_kind ||
          Object.values(baseline.subscriptions).some((entry) => entry.source === "alz-corp-default"))
      ) {
        r.error(file, "private tenant baseline path must not contain generic ALZ assumptions");
      }
      if (r.errors === errorsBefore) r.ok(file, `${baseline.subscriptions_processed} subscription(s)`);
    } catch (error) {
      r.error(file, error.message);
    }
  }
  r.summary();
  if (r.errors === 0) console.log("\n✅ Governance baseline validation passed");
  return r.errors > 0 ? 1 : 0;
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) process.exit(runValidator());
