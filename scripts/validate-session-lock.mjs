#!/usr/bin/env node
/**
 * Session Lock Validator (v3.0 — Simplified)
 *
 * In schema v3.0, the lock/claim protocol was removed (VS Code Copilot
 * executes agents serially). This validator now only checks for leftover
 * lock/claim fields that should be cleaned up during migration.
 *
 * @example
 * node scripts/validate-session-lock.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";
import { AGENT_OUTPUT_DIR } from "./_lib/paths.mjs";

const STATE_FILENAME = "00-session-state.json";

let fileCount = 0;
const r = new Reporter("Session Lock Validator");

function warn(file, msg) {
  r.warn(file, msg);
}
function ok(file, msg) {
  r.ok(file, msg);
}

function validateLockFile(filePath) {
  const label = path.relative(".", filePath);
  fileCount++;

  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    r.error(label, "Cannot read file");
    return;
  }

  let state;
  try {
    state = JSON.parse(raw);
  } catch (e) {
    r.error(label, `Invalid JSON: ${e.message}`);
    return;
  }

  // Warn about deprecated lock/claim fields
  if (state.lock !== undefined) {
    warn(
      label,
      "Deprecated: lock object found — remove it (lock/claim protocol removed in v3.0)",
    );
  }

  if (state.stale_threshold_ms !== undefined) {
    warn(
      label,
      "Deprecated: stale_threshold_ms found — remove it (lock/claim protocol removed in v3.0)",
    );
  }

  if (state.steps) {
    for (const [stepNum, step] of Object.entries(state.steps)) {
      if (step.claim !== undefined) {
        warn(
          label,
          `Deprecated: Step ${stepNum} has claim object — remove it (lock/claim protocol removed in v3.0)`,
        );
      }
    }
  }

  ok(label, "Lock validation passed");
}

// --- Main execution ---

console.log("\n🔒 Validating session lock fields...\n");

if (fs.existsSync(AGENT_OUTPUT_DIR)) {
  const projects = fs
    .readdirSync(AGENT_OUTPUT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const project of projects) {
    const stateFile = path.join(AGENT_OUTPUT_DIR, project, STATE_FILENAME);
    if (fs.existsSync(stateFile)) {
      validateLockFile(stateFile);
    }
  }
}

if (fileCount === 0) {
  console.log("  ℹ️  No session state files found to validate locks\n");
  console.log("✅ Session lock validation passed (no files)\n");
  process.exit(0);
}

console.log(
  `\n📊 Checked ${fileCount} file(s): ${r.errors} error(s), ${r.warnings} warning(s)\n`,
);

if (r.errors > 0) {
  console.error("❌ Session lock validation failed\n");
  process.exit(1);
}

console.log("✅ Session lock validation passed\n");
