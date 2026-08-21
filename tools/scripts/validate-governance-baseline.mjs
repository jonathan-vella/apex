#!/usr/bin/env node
/** Validate the tracked compressed governance baseline against its JSON schema. */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadValidator } from "./_lib/ajv-validator.mjs";
import { readGovernanceBaseline } from "./_lib/governance-baseline.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const BASELINE_PATH = path.join(ROOT, ".github/data/governance-policy-baseline.json.gz");
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/governance-baseline.schema.json");

export function runValidator({ baselinePath = BASELINE_PATH, schemaPath = SCHEMA_PATH } = {}) {
  const r = new Reporter("Governance Baseline Validator");
  r.header();
  try {
    const baseline = readGovernanceBaseline(baselinePath);
    const validate = loadValidator(schemaPath);
    r.tick();
    if (!validate(baseline)) {
      for (const error of validate.errors ?? []) {
        r.error(path.relative(ROOT, baselinePath), `${error.instancePath || "/"} ${error.message}`);
      }
    } else {
      r.ok(path.relative(ROOT, baselinePath), `${baseline.subscriptions_processed} subscription(s)`);
    }
  } catch (error) {
    r.error(path.relative(ROOT, baselinePath), error.message);
  }
  r.summary();
  if (r.errors === 0) console.log("\n✅ Compressed governance baseline is valid");
  return r.errors > 0 ? 1 : 0;
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) process.exit(runValidator());
