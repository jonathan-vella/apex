#!/usr/bin/env node
/**
 * Session State JSON Validator
 *
 * Validates all 00-session-state.json files in agent-output/{project}/
 * against the schema defined in the session-resume skill.
 * Also validates the template file itself.
 *
 * @example
 * node scripts/validate-session-state.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";
import { AGENT_OUTPUT_DIR } from "./_lib/paths.mjs";

const TEMPLATE_PATH =
  ".github/skills/azure-artifacts/templates/00-session-state.template.json";
const STATE_FILENAME = "00-session-state.json";

const VALID_STATUSES = ["pending", "in_progress", "complete", "skipped"];
const VALID_IAC_TOOLS = ["", "Bicep", "Terraform"];
const REQUIRED_TOP_LEVEL = [
  "schema_version",
  "project",
  "iac_tool",
  "region",
  "branch",
  "updated",
  "current_step",
  "decisions",
  "open_findings",
  "steps",
];
const REQUIRED_STEP_FIELDS = [
  "name",
  "agent",
  "status",
  "sub_step",
  "started",
  "completed",
  "artifacts",
  "context_files_used",
];
const EXPECTED_STEP_NAMES = {
  1: "Requirements",
  2: "Architecture",
  3: "Design",
  3.5: "Governance",
  4: "IaC Plan",
  5: "IaC Code",
  6: "Deploy",
  7: "As-Built",
};
const REQUIRED_DECISION_FIELDS = [
  "region",
  "compliance",
  "budget",
  "architecture_pattern",
  "deployment_strategy",
];

let fileCount = 0;
const r = new Reporter("Session State Validator");

function error(file, msg) {
  r.error(file, msg);
}
function warn(file, msg) {
  r.warn(file, msg);
}
function ok(file, msg) {
  r.ok(file, msg);
}

function validateStateFile(filePath, isTemplate) {
  const label = isTemplate ? "template" : path.relative(".", filePath);
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

  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in state)) {
      error(label, `Missing required top-level field: ${field}`);
    }
  }

  if (state.schema_version !== "1.0" && state.schema_version !== "2.0") {
    error(label, `Unsupported schema_version: ${state.schema_version}`);
  }

  if (!VALID_IAC_TOOLS.includes(state.iac_tool)) {
    error(
      label,
      `Invalid iac_tool: "${state.iac_tool}" (expected ${VALID_IAC_TOOLS.join(", ")})`,
    );
  }

  if (
    typeof state.current_step !== "number" ||
    state.current_step < 0 ||
    state.current_step > 7
  ) {
    error(label, `current_step must be 0-7, got: ${state.current_step}`);
  }

  if (!Array.isArray(state.open_findings)) {
    error(label, "open_findings must be an array");
  }

  // v2.0 lock field validation (optional, backwards-compatible)
  if (state.lock !== undefined) {
    if (typeof state.lock !== "object" || state.lock === null) {
      error(label, "lock must be an object");
    } else {
      if (state.lock.heartbeat !== undefined && state.lock.heartbeat !== null) {
        const d = new Date(state.lock.heartbeat);
        if (isNaN(d.getTime())) {
          error(
            label,
            `lock.heartbeat is not a valid ISO date: "${state.lock.heartbeat}"`,
          );
        }
      }
      if (
        state.lock.attempt_token !== undefined &&
        state.lock.attempt_token !== null
      ) {
        const uuidRe =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRe.test(state.lock.attempt_token)) {
          error(
            label,
            `lock.attempt_token is not a valid UUID: "${state.lock.attempt_token}"`,
          );
        }
      }
    }
  }

  if (state.stale_threshold_ms !== undefined) {
    if (
      typeof state.stale_threshold_ms !== "number" ||
      state.stale_threshold_ms <= 0
    ) {
      error(label, "stale_threshold_ms must be a positive number");
    }
  }

  if (state.decisions) {
    for (const field of REQUIRED_DECISION_FIELDS) {
      if (!(field in state.decisions)) {
        error(label, `Missing decisions field: ${field}`);
      }
    }

    // Validate optional complexity field
    if ("complexity" in state.decisions) {
      const validComplexity = ["simple", "standard", "complex", ""];
      if (!validComplexity.includes(state.decisions.complexity)) {
        error(
          label,
          `Invalid decisions.complexity: "${state.decisions.complexity}" (expected ${validComplexity.join(", ")})`,
        );
      }
    }
  }

  // Validate optional review_audit (don't break old sessions)
  if (state.review_audit !== undefined) {
    if (typeof state.review_audit !== "object" || state.review_audit === null) {
      error(label, "review_audit must be an object");
    } else {
      const validStepKeys = [
        "step_1",
        "step_2",
        "step_3.5",
        "step_4",
        "step_5",
        "step_6",
      ];
      for (const [key, audit] of Object.entries(state.review_audit)) {
        if (!validStepKeys.includes(key)) {
          warn(label, `review_audit has unexpected key: "${key}"`);
        }
        if (typeof audit === "object" && audit !== null) {
          if (
            audit.passes_planned !== undefined &&
            (typeof audit.passes_planned !== "number" ||
              audit.passes_planned < 0)
          ) {
            error(
              label,
              `review_audit.${key}.passes_planned must be a non-negative integer`,
            );
          }
          if (
            audit.passes_executed !== undefined &&
            (typeof audit.passes_executed !== "number" ||
              audit.passes_executed < 0)
          ) {
            error(
              label,
              `review_audit.${key}.passes_executed must be a non-negative integer`,
            );
          }
          if (audit.skipped !== undefined && !Array.isArray(audit.skipped)) {
            error(label, `review_audit.${key}.skipped must be an array`);
          }
          if (
            audit.skip_reasons !== undefined &&
            !Array.isArray(audit.skip_reasons)
          ) {
            error(label, `review_audit.${key}.skip_reasons must be an array`);
          }
          if (
            audit.models_used !== undefined &&
            !Array.isArray(audit.models_used)
          ) {
            error(label, `review_audit.${key}.models_used must be an array`);
          }
        }
      }
    }
  }

  if (!state.steps || typeof state.steps !== "object") {
    error(label, "Missing or invalid steps object");
    return;
  }

  for (let i = 1; i <= 7; i++) {
    const key = String(i);
    if (!(key in state.steps)) {
      error(label, `Missing step ${i}`);
      continue;
    }

    const step = state.steps[key];

    for (const field of REQUIRED_STEP_FIELDS) {
      if (!(field in step)) {
        error(label, `Step ${i}: missing field "${field}"`);
      }
    }

    if (step.name !== EXPECTED_STEP_NAMES[i]) {
      error(
        label,
        `Step ${i}: expected name "${EXPECTED_STEP_NAMES[i]}", got "${step.name}"`,
      );
    }

    if (!VALID_STATUSES.includes(step.status)) {
      error(label, `Step ${i}: invalid status "${step.status}"`);
    }

    if (!Array.isArray(step.artifacts)) {
      error(label, `Step ${i}: artifacts must be an array`);
    }

    if (!Array.isArray(step.context_files_used)) {
      error(label, `Step ${i}: context_files_used must be an array`);
    }

    if (step.status === "complete" && !step.completed) {
      warn(
        label,
        `Step ${i}: status is "complete" but completed timestamp is null`,
      );
    }

    if (step.status === "in_progress" && !step.started) {
      warn(
        label,
        `Step ${i}: status is "in_progress" but started timestamp is null`,
      );
    }
  }

  ok(label, "Valid");
}

console.log("\n🔍 Validating session state files...\n");

// Validate template
if (fs.existsSync(TEMPLATE_PATH)) {
  validateStateFile(TEMPLATE_PATH, true);
} else {
  error("template", `Template not found at ${TEMPLATE_PATH}`);
}

// Validate project state files
if (fs.existsSync(AGENT_OUTPUT_DIR)) {
  const projects = fs
    .readdirSync(AGENT_OUTPUT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const project of projects) {
    const stateFile = path.join(AGENT_OUTPUT_DIR, project, STATE_FILENAME);
    if (fs.existsSync(stateFile)) {
      validateStateFile(stateFile, false);
    }
  }
}

console.log(
  `\n📊 Checked ${fileCount} file(s): ${r.errors} error(s), ${r.warnings} warning(s)\n`,
);

if (r.errors > 0) {
  console.error("❌ Session state validation failed\n");
  process.exit(1);
}

console.log("✅ Session state validation passed\n");
