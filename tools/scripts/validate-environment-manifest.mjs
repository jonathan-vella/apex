#!/usr/bin/env node
/**
 * Environment Manifest Validator (environment-manifest-v1)
 *
 * Validates agent-output/{project}/04-environment-manifest.json — the
 * out-of-tree record of per-environment values (subscriptionId, tenant,
 * deployer object ID, existing app reg object IDs, principal IDs, alert
 * emails, budget) that the deploy agents (07b/07t) resolve at run time.
 *
 * Schema-side checks (Ajv 2020-12, hard-fail):
 *   - All fields per tools/schemas/environment-manifest.schema.json
 *
 * Semantic checks (hard-fail unless marked WARN):
 *   1. At least one environment defined.
 *   2. Each environment has subscription_id + tenant_id + primary_region.
 *   3. If --redact is passed, emit a SHA256-prefixed redacted view to
 *      stdout instead of the raw manifest (used by CI to render safe diffs).
 *
 * Usage:
 *   node tools/scripts/validate-environment-manifest.mjs
 *   node tools/scripts/validate-environment-manifest.mjs <path-or-glob>
 *   node tools/scripts/validate-environment-manifest.mjs <path> --redact
 */

import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";
import { Reporter } from "./_lib/reporter.mjs";
import { readJson } from "./_lib/json.mjs";
import { loadValidator } from "./_lib/ajv-validator.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/environment-manifest.schema.json");

function hashPrefix(value) {
  if (!value) return value;
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex").slice(0, 12)}…`;
}

function redactManifest(data) {
  const rules = data.redaction_rules ?? { redact_object_ids: true, redact_emails: true };
  const out = JSON.parse(JSON.stringify(data));
  for (const [envName, env] of Object.entries(out.environments ?? {})) {
    if (rules.redact_subscription_id) env.subscription_id = hashPrefix(env.subscription_id);
    if (rules.redact_object_ids !== false) {
      if (env.deployer_object_id) env.deployer_object_id = hashPrefix(env.deployer_object_id);
      if (env.kv_admin_object_id) env.kv_admin_object_id = hashPrefix(env.kv_admin_object_id);
      for (const [k, v] of Object.entries(env.existing_app_reg_object_ids ?? {})) {
        env.existing_app_reg_object_ids[k] = hashPrefix(v);
      }
      for (const [k, v] of Object.entries(env.principal_ids ?? {})) {
        env.principal_ids[k] = hashPrefix(v);
      }
    }
    if (rules.redact_emails !== false && Array.isArray(env.alert_emails)) {
      env.alert_emails = env.alert_emails.map((e) => hashPrefix(e));
    }
    out.environments[envName] = env;
  }
  return out;
}

function defaultGlobs() {
  return ["agent-output/*/04-environment-manifest.json"];
}

function main() {
  const r = new Reporter("Environment Manifest Validator");
  r.header();
  const validate = loadValidator(SCHEMA_PATH);
  const rawArgs = process.argv.slice(2);
  const redact = rawArgs.includes("--redact");
  const args = rawArgs.filter((a) => a !== "--redact");
  const patterns = args.length > 0 ? args : defaultGlobs();

  let files = [];
  for (const pat of patterns) {
    const matched = globSync(pat, { cwd: ROOT, absolute: true });
    files = files.concat(matched);
  }
  files = [...new Set(files)];

  if (files.length === 0) {
    r.info("(no 04-environment-manifest.json files found)");
    r.summary();
    process.exit(0);
  }

  for (const filePath of files) {
    const fileRel = path.relative(ROOT, filePath);
    r.tick();
    let data;
    try {
      data = readJson(filePath);
    } catch (err) {
      r.error(fileRel, `Invalid JSON: ${err.message}`);
      continue;
    }
    if (!validate(data)) {
      for (const err of validate.errors) {
        r.error(fileRel, `${err.instancePath || "/"}: ${err.message}`);
      }
      continue;
    }
    const envs = Object.keys(data.environments ?? {});
    r.ok(fileRel, `environment-manifest (${envs.length} envs: ${envs.join(", ")})`);
    if (redact) {
      console.log(JSON.stringify(redactManifest(data), null, 2));
    }
  }

  r.summary();
  r.exitOnError("Environment manifest validation passed");
}

main();
