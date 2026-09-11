/**
 * Shared E2E benchmark/validation helpers.
 *
 * Small filesystem utilities duplicated across the end-to-end harness
 * scripts (benchmark-e2e, validate-e2e-step). Behavior is identical to
 * the inline versions they replace.
 *
 * The JSON readers those scripts also duplicated map onto the shared
 * `_lib/json.mjs` helpers instead (`readJson` strict, `readJsonSafe`
 * null-on-error) — they are not re-exported here.
 *
 * @example
 *   import { detectIacTool, fileExists } from "./_lib/e2e-helpers.mjs";
 *   const tool = detectIacTool(OUTPUT_DIR); // "bicep" | "terraform"
 */

import fs from "node:fs";
import path from "node:path";

export const ARTIFACT_VALIDATION_COMMAND = "npm run lint:artifact-templates --silent 2>&1";

export function scoreStructuralChecks(runCommand) {
  const artifactPass = runCommand(ARTIFACT_VALIDATION_COMMAND);
  const sessionPass = runCommand("npm run validate:session-state --silent 2>&1");
  return {
    score: (artifactPass ? 70 : 0) + (sessionPass ? 30 : 0),
    checks: [
      `artifact-templates: ${artifactPass ? "PASS" : "FAIL"}`,
      `h2-sync: ${artifactPass ? "PASS" : "FAIL"}`,
      `session-state: ${sessionPass ? "PASS" : "FAIL"}`,
    ],
  };
}

/**
 * Detect the IaC tool for a run from its `00-session-state.json`.
 * Falls back to `"bicep"` when the file is missing or unreadable.
 * @param {string} outputDir - The run's agent-output directory.
 * @returns {string} Lowercased tool name (e.g. "bicep", "terraform").
 */
export function detectIacTool(outputDir) {
  try {
    const state = JSON.parse(fs.readFileSync(path.join(outputDir, "00-session-state.json"), "utf-8"));
    return (state.iac_tool || state.decisions?.iac_tool || "Bicep").toLowerCase();
  } catch {
    return "bicep";
  }
}

/**
 * True if `filePath` exists and is a non-empty file.
 * @param {string} filePath
 * @returns {boolean}
 */
export function fileExists(filePath) {
  try {
    const st = fs.statSync(filePath);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}
