#!/usr/bin/env node
/**
 * Session Lock Validator
 *
 * Validates the distributed lock and claim model in 00-session-state.json files.
 * Supports schema v2.0 lock fields: lock.owner_id, lock.heartbeat,
 * lock.attempt_token, lock.acquired, and per-step claim objects.
 *
 * Exposes claim protocol functions for use by other scripts:
 * - claimStep(stepN, ownerId)
 * - renewHeartbeat(ownerId, token)
 * - releaseStep(stepN, token, outcome)
 * - sweepStale(thresholdMs)
 *
 * @example
 * node scripts/validate-session-lock.mjs
 */

import fs from "node:fs";
import path from "node:path";

const AGENT_OUTPUT_DIR = "agent-output";
const STATE_FILENAME = "00-session-state.json";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_STALE_THRESHOLD_MS = 300000;

let errors = 0;
let warnings = 0;
let fileCount = 0;

function error(file, msg) {
  console.error(`  ❌ ${file}: ${msg}`);
  errors++;
}

function warn(file, msg) {
  console.warn(`  ⚠️  ${file}: ${msg}`);
  warnings++;
}

function ok(file, msg) {
  console.log(`  ✅ ${file}: ${msg}`);
}

function isValidISO(str) {
  if (typeof str !== "string") return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function isValidUUID(str) {
  return typeof str === "string" && UUID_RE.test(str);
}

/**
 * Validate the top-level lock object in a v2.0 session state file.
 */
function validateLock(filePath, state) {
  const label = path.relative(".", filePath);

  if (!state.lock) {
    // v1.0 files without lock are valid (backwards-compatible)
    if (state.schema_version === "1.0") {
      return;
    }
    // v2.0 files should have lock
    if (state.schema_version === "2.0") {
      warn(label, "schema_version is 2.0 but no lock object present");
    }
    return;
  }

  const lock = state.lock;

  if (lock.owner_id !== undefined && typeof lock.owner_id !== "string") {
    error(label, "lock.owner_id must be a string");
  }

  if (lock.heartbeat !== undefined) {
    if (!isValidISO(lock.heartbeat)) {
      error(
        label,
        `lock.heartbeat is not a valid ISO date: "${lock.heartbeat}"`,
      );
    } else {
      const heartbeatAge = Date.now() - new Date(lock.heartbeat).getTime();
      const threshold = state.stale_threshold_ms || DEFAULT_STALE_THRESHOLD_MS;
      if (heartbeatAge > threshold) {
        warn(
          label,
          `lock.heartbeat is stale (${Math.round(heartbeatAge / 1000)}s old, threshold: ${threshold / 1000}s)`,
        );
      }
    }
  }

  if (lock.attempt_token !== undefined) {
    if (!isValidUUID(lock.attempt_token)) {
      error(
        label,
        `lock.attempt_token is not a valid UUID: "${lock.attempt_token}"`,
      );
    }
  }

  if (lock.acquired !== undefined && !isValidISO(lock.acquired)) {
    error(label, `lock.acquired is not a valid ISO date: "${lock.acquired}"`);
  }
}

/**
 * Validate per-step claim objects in a v2.0 session state file.
 */
function validateStepClaims(filePath, state) {
  const label = path.relative(".", filePath);

  if (!state.steps) return;

  for (const [stepNum, step] of Object.entries(state.steps)) {
    if (!step.claim) continue;

    const claim = step.claim;
    const prefix = `Step ${stepNum} claim`;

    if (claim.owner_id !== undefined && typeof claim.owner_id !== "string") {
      error(label, `${prefix}.owner_id must be a string`);
    }

    if (claim.heartbeat !== undefined && !isValidISO(claim.heartbeat)) {
      error(label, `${prefix}.heartbeat is not a valid ISO date`);
    }

    if (
      claim.attempt_token !== undefined &&
      !isValidUUID(claim.attempt_token)
    ) {
      error(label, `${prefix}.attempt_token is not a valid UUID`);
    }

    if (claim.retry_count !== undefined) {
      if (typeof claim.retry_count !== "number" || claim.retry_count < 0) {
        error(label, `${prefix}.retry_count must be a non-negative number`);
      }
    }

    if (claim.event_log !== undefined) {
      if (!Array.isArray(claim.event_log)) {
        error(label, `${prefix}.event_log must be an array`);
      }
    }
  }
}

/**
 * Validate stale_threshold_ms top-level config.
 */
function validateThreshold(filePath, state) {
  const label = path.relative(".", filePath);

  if (state.stale_threshold_ms !== undefined) {
    if (
      typeof state.stale_threshold_ms !== "number" ||
      state.stale_threshold_ms <= 0
    ) {
      error(label, "stale_threshold_ms must be a positive number");
    }
  }
}

function validateLockFile(filePath) {
  const label = path.relative(".", filePath);
  fileCount++;

  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    error(label, "Cannot read file");
    return;
  }

  let state;
  try {
    state = JSON.parse(raw);
  } catch (e) {
    error(label, `Invalid JSON: ${e.message}`);
    return;
  }

  validateLock(filePath, state);
  validateStepClaims(filePath, state);
  validateThreshold(filePath, state);

  ok(label, "Lock validation passed");
}

// --- Claim Protocol Functions (exported for programmatic use) ---

/**
 * Claim a step for an owner. Returns updated state or throws on conflict.
 */
export function claimStep(state, stepN, ownerId) {
  const step = state.steps?.[String(stepN)];
  if (!step) throw new Error(`Step ${stepN} not found`);

  if (step.claim?.owner_id && step.claim.owner_id !== ownerId) {
    const threshold = state.stale_threshold_ms || DEFAULT_STALE_THRESHOLD_MS;
    const heartbeatAge = step.claim.heartbeat
      ? Date.now() - new Date(step.claim.heartbeat).getTime()
      : Infinity;

    if (heartbeatAge < threshold) {
      throw new Error(
        `Step ${stepN} is claimed by ${step.claim.owner_id} (heartbeat ${Math.round(heartbeatAge / 1000)}s ago)`,
      );
    }
    // Stale claim — recover
    const recoveryEvent = {
      type: "stale_recovery",
      previous_owner: step.claim.owner_id,
      new_owner: ownerId,
      timestamp: new Date().toISOString(),
    };
    step.claim.event_log = step.claim.event_log || [];
    step.claim.event_log.push(recoveryEvent);
  }

  const token = crypto.randomUUID();
  step.claim = {
    owner_id: ownerId,
    heartbeat: new Date().toISOString(),
    attempt_token: token,
    retry_count: step.claim?.retry_count || 0,
    event_log: step.claim?.event_log || [],
  };

  state.updated = new Date().toISOString();
  return { state, token };
}

/**
 * Renew heartbeat for a claimed step.
 */
export function renewHeartbeat(state, ownerId, token) {
  for (const step of Object.values(state.steps || {})) {
    if (
      step.claim?.owner_id === ownerId &&
      step.claim?.attempt_token === token
    ) {
      step.claim.heartbeat = new Date().toISOString();
      state.updated = new Date().toISOString();
      return state;
    }
  }
  throw new Error(
    `No active claim found for owner ${ownerId} with token ${token}`,
  );
}

/**
 * Release a step claim after completion or failure.
 */
export function releaseStep(state, stepN, token, outcome) {
  const step = state.steps?.[String(stepN)];
  if (!step?.claim) throw new Error(`Step ${stepN} has no active claim`);

  if (step.claim.attempt_token !== token) {
    throw new Error(
      `Token mismatch for step ${stepN}: expected ${step.claim.attempt_token}, got ${token}`,
    );
  }

  step.claim.event_log = step.claim.event_log || [];
  step.claim.event_log.push({
    type: "release",
    outcome,
    timestamp: new Date().toISOString(),
  });

  step.claim.owner_id = null;
  step.claim.attempt_token = null;
  step.claim.heartbeat = null;
  state.updated = new Date().toISOString();
  return state;
}

/**
 * Sweep stale locks across all steps.
 */
export function sweepStale(state, thresholdMs) {
  const threshold =
    thresholdMs || state.stale_threshold_ms || DEFAULT_STALE_THRESHOLD_MS;
  const swept = [];

  for (const [stepNum, step] of Object.entries(state.steps || {})) {
    if (!step.claim?.owner_id || !step.claim?.heartbeat) continue;

    const age = Date.now() - new Date(step.claim.heartbeat).getTime();
    if (age > threshold) {
      step.claim.event_log = step.claim.event_log || [];
      step.claim.event_log.push({
        type: "stale_sweep",
        owner_id: step.claim.owner_id,
        age_ms: age,
        timestamp: new Date().toISOString(),
      });
      step.claim.owner_id = null;
      step.claim.attempt_token = null;
      step.claim.heartbeat = null;
      swept.push(stepNum);
    }
  }

  if (swept.length > 0) {
    state.updated = new Date().toISOString();
  }
  return { state, swept };
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
  `\n📊 Checked ${fileCount} file(s): ${errors} error(s), ${warnings} warning(s)\n`,
);

if (errors > 0) {
  console.error("❌ Session lock validation failed\n");
  process.exit(1);
}

console.log("✅ Session lock validation passed\n");
