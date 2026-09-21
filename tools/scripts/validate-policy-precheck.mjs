#!/usr/bin/env node
/**
 * Policy Precheck Output Validator
 *
 * Scans `agent-output/<project>/06-policy-precheck.json` files and
 * enforces the contract in
 * `.github/skills/apex-iac-common/references/policy-precheck-contract.md`.
 *
 * Errors are emitted when the file contains a contract contradiction
 * that would mislead a deploy agent. Warnings are emitted when the
 * file is in the legacy `policy-precheck-v1` shape — the file is still
 * usable but should be regenerated against the new contract so the
 * deterministic `deploy_gate` derivation runs.
 *
 * Specifically, this validator catches the exact ambiguity that
 * stalled the nordic-foods deploy on 2026-05-13:
 *
 *   status: "BLOCKED"
 *   policies_that_will_block_deploy: []
 *   what_if_summary.policy_violations_in_what_if: 0
 *   residual_drift_accepted_route.present: false
 *
 * Under the current body contract, BLOCKING drift independently requires
 * BLOCK+BLOCKED, even without listed violations. Unknown or malformed
 * evidence requires BLOCK+FAILED; otherwise the ordered drift/envelope
 * rules determine both the gate and status.
 *
 * Usage:
 *   node tools/scripts/validate-policy-precheck.mjs [--strict]
 *
 * Exit codes:
 *   0 — all checks pass (warnings allowed unless --strict)
 *   1 — one or more contract violations detected
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Reporter } from "./_lib/reporter.mjs";
import { parseArgs } from "node:util";
import { summarizePreview } from "./summarize-deployment-preview.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    strict: { type: "boolean" },
    preview: { type: "string" },
    "expected-ids": { type: "string" },
    tool: { type: "string", default: "bicep" },
    help: { type: "boolean" },
  },
});
const strict = values.strict;
if (values.help) {
  console.log(
    "Usage: validate-policy-precheck.mjs [path-or-glob] [--strict] [--preview raw.json --expected-ids ids.json --tool bicep|terraform]",
  );
  process.exit(0);
}
let preview;
if (values.preview) {
  try {
    if (!values["expected-ids"]) throw new Error("--preview requires --expected-ids from approved expanded bindings");
    preview = summarizePreview(
      JSON.parse(fs.readFileSync(values.preview, "utf8")),
      values.tool,
      JSON.parse(fs.readFileSync(values["expected-ids"], "utf8")),
    );
  } catch (error) {
    console.error(`Invalid preview evidence: ${error.message}`);
    process.exit(1);
  }
}

const r = new Reporter("Policy Precheck Output Validator");
r.header();

const agentOutputDir = path.join(REPO_ROOT, "agent-output");
if (!positionals.length && !fs.existsSync(agentOutputDir)) {
  console.log("  ℹ️  No agent-output/ directory — nothing to validate.\n");
  process.exit(0);
}

const projectDirs = positionals.length
  ? []
  : fs
      .readdirSync(agentOutputDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

const precheckFiles = positionals.length
  ? [...new Set(positionals.flatMap((pattern) => fs.globSync(pattern, { cwd: REPO_ROOT, absolute: true })))]
  : projectDirs
      .map((name) => path.join(agentOutputDir, name, "06-policy-precheck.json"))
      .filter((file) => fs.existsSync(file));

if (precheckFiles.length === 0) {
  if (positionals.length) {
    console.error("Explicit target matched no files");
    process.exit(1);
  }
  console.log("  ℹ️  No 06-policy-precheck.json files found.\n");
  process.exit(0);
}

for (const file of precheckFiles) {
  const relPath = path.relative(REPO_ROOT, file);
  r.tick();

  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    r.error(relPath, `Invalid JSON: ${e.message}`);
    continue;
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    r.error(relPath, "Policy precheck must be a JSON object");
    continue;
  }

  const status = data.status;
  const deployGate = data.deploy_gate;
  const schemaVersion = data.schema_version === undefined ? "policy-precheck-v1" : data.schema_version;
  if (!["policy-precheck-v1", "policy-precheck-v2"].includes(schemaVersion)) {
    r.error(relPath, `Unsupported schema_version: ${JSON.stringify(schemaVersion)}`);
    continue;
  }
  const blockers = Array.isArray(data.policies_that_will_block_deploy) ? data.policies_that_will_block_deploy : [];
  const reportedViolations = data.what_if_summary?.policy_violations_in_what_if;
  const whatIfViolations = schemaVersion === "policy-precheck-v2" ? reportedViolations : (reportedViolations ?? 0);
  const envelopeStatus = data.attestation?.envelope_status;
  const driftSeverity = data.drift_signal?.severity;
  const hasBlocker =
    blockers.length > 0 ||
    whatIfViolations > 0 ||
    (schemaVersion === "policy-precheck-v2" && driftSeverity === "BLOCKING");
  const driftAccepted = data.drift_signal?.accepted_by_residual_drift_policy === true;

  // ── Mandatory fields ──────────────────────────────────────────
  if (!status) {
    r.error(relPath, "Missing required field: status");
    continue;
  }

  // ── v2 schema enforcement ─────────────────────────────────────
  if (schemaVersion === "policy-precheck-v2") {
    let inconsistent = false;
    for (const [countKey, listKey] of [
      ["missing_from_constraints_count", "live_policies_missing_from_constraints"],
      ["newer_than_envelope_count", "live_policies_newer_than_envelope"],
    ]) {
      const count = data.drift_signal?.[countKey];
      if (
        !(status === "FAILED" && deployGate === "BLOCK") &&
        (!Number.isSafeInteger(count) || count < 0 || !Array.isArray(data[listKey]) || data[listKey].length !== count)
      ) {
        r.error(relPath, `${countKey} must match the retained ${listKey} records`);
        inconsistent = true;
      }
    }
    if (preview) {
      if (!preview.coverage.verified && deployGate === "PROCEED") {
        r.error(relPath, "Preview resource identities do not match approved expanded bindings");
        inconsistent = true;
      }
      if (preview.counts.destroys || preview.counts.replaces || preview.diagnostics.length) {
        r.warn(
          relPath,
          "Preview requires separate review; policy clearance does not approve changes or dismiss diagnostics",
        );
      }
      for (const key of ["creates", "updates", "destroys", "replaces"]) {
        if (data.what_if_summary?.[key] !== preview.counts[key]) {
          r.error(relPath, `${key} does not match structured preview evidence`);
          inconsistent = true;
        }
      }
      if (preview.verdict === "BLOCKED" && deployGate !== "BLOCK") {
        r.error(relPath, "Structured preview contains blocking diagnostics");
        inconsistent = true;
      }
      if ((preview.counts.unknown || preview.potentialChanges.length) && deployGate === "PROCEED") {
        r.error(relPath, "Unknown or incomplete preview expansion cannot establish a PROCEED gate");
        inconsistent = true;
      }
      if (reportedViolations !== preview.policy_violations) {
        r.error(relPath, "Policy violation count does not match structured preview diagnostics");
        inconsistent = true;
      }
    }
    if (inconsistent) continue;
    if (!deployGate) {
      r.error(relPath, "schema v2 requires deploy_gate (PROCEED|BLOCK)");
      continue;
    }
    if (!["PROCEED", "BLOCK"].includes(deployGate)) {
      r.error(relPath, `deploy_gate must be PROCEED or BLOCK, got: ${deployGate}`);
      continue;
    }
    if (!["CLEAN", "INFORMATIONAL", "BLOCKED", "FAILED"].includes(status)) {
      r.error(relPath, `status must be CLEAN|INFORMATIONAL|BLOCKED|FAILED, got: ${status}`);
      continue;
    }

    const isStale = envelopeStatus === "STALE";
    const invalidEnvelope = !["FRESH", "STALE"].includes(envelopeStatus);
    const invalidEvidence =
      invalidEnvelope ||
      !["NONE", "INFORMATIONAL", "BLOCKING"].includes(driftSeverity) ||
      !Array.isArray(data.policies_that_will_block_deploy) ||
      !Number.isSafeInteger(whatIfViolations) ||
      whatIfViolations < 0 ||
      (data.drift_signal?.accepted_by_residual_drift_policy !== undefined &&
        typeof data.drift_signal.accepted_by_residual_drift_policy !== "boolean");
    if (invalidEnvelope && (status !== "FAILED" || deployGate !== "BLOCK")) {
      r.error(relPath, "Missing or invalid envelope evidence requires status=FAILED and deploy_gate=BLOCK");
      continue;
    }
    const expectedStatus =
      status === "FAILED" || invalidEvidence
        ? "FAILED"
        : hasBlocker
          ? "BLOCKED"
          : isStale || (driftSeverity === "INFORMATIONAL" && !driftAccepted)
            ? "INFORMATIONAL"
            : "CLEAN";
    const expectedGate = ["FAILED", "BLOCKED"].includes(expectedStatus) || isStale ? "BLOCK" : "PROCEED";
    if (deployGate !== expectedGate || status !== expectedStatus) {
      r.error(
        relPath,
        `deploy_gate=${deployGate}, status=${status} contradicts derivation rules ` +
          `(invalidEvidence=${invalidEvidence}, driftSeverity=${driftSeverity}, ` +
          `blockers=${blockers.length}, whatIfViolations=${whatIfViolations}, envelopeStatus=${envelopeStatus}); ` +
          `expected deploy_gate=${expectedGate}, status=${expectedStatus}`,
      );
      continue;
    }

    r.ok(relPath, `v2 OK (deploy_gate=${deployGate}, status=${status})`);
    continue;
  }

  // ── Legacy v1 (status=DRIFT) ──────────────────────────────────
  // The exact contradiction that stalled nordic-foods on 2026-05-13.
  if (status === "BLOCKED" && !hasBlocker) {
    r.error(relPath, "status=BLOCKED but no blocking policies and no what-if violations (the contract contradiction)");
    continue;
  }
  if (status === "DRIFT") {
    r.warn(
      relPath,
      "legacy status=DRIFT (schema v1). Regenerate against policy-precheck-v2 so deploy_gate is set deterministically.",
    );
    continue;
  }
  if (!["CLEAN", "DRIFT", "BLOCKED", "FAILED"].includes(status)) {
    r.error(relPath, `legacy status must be CLEAN|DRIFT|BLOCKED|FAILED, got: ${status}`);
    continue;
  }

  r.ok(relPath, `legacy v1 OK (status=${status})`);
}

console.log(
  `\n──────────────────────────────────────────────────\n` +
    `Checked: ${r.checked} | Errors: ${r.errors} | Warnings: ${r.warnings}\n`,
);

if (r.errors > 0) {
  console.error("❌ Policy precheck contract violations detected.");
  process.exit(1);
}

if (strict && r.warnings > 0) {
  console.error("❌ --strict: warnings present.");
  process.exit(1);
}

console.log("✅ Policy precheck outputs satisfy the contract.\n");
process.exit(0);
