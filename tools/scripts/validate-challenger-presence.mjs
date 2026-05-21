#!/usr/bin/env node
/**
 * Challenger findings PRESENCE validator.
 *
 * Complements `validate-challenger-findings.mjs` (which checks schema
 * shape of sidecars that EXIST). This validator enforces that the
 * required sidecar EXISTS whenever a review-mandated gating artifact
 * exists in `agent-output/<project>/`.
 *
 * Rule source of truth: AGENTS.md "Agent Workflow" table. Steps 1, 2,
 * 3.5, 4 all have a mandatory single-pass comprehensive challenger
 * review (3.5 is conditional on governance constraints being produced).
 * Steps 3 / 5 / 6 / 7 are not enforced here.
 *
 * Primary enforcement is at agent runtime via `apex-recall complete-step`,
 * which refuses to advance a project past one of these steps without the
 * sidecar (exit code 2). This script is the CI/lefthook fallback so the
 * same drift is caught even if session state was edited by hand.
 *
 * Opt-out: `decisions.challenger_skip[]` in 00-session-state.json with a
 * matching `{ step, reason }` entry suppresses the failure. The reason
 * field must be non-empty. apex-recall complete-step writes that entry
 * when --allow-missing-challenger + --challenger-skip-reason are passed.
 *
 * Exit codes:
 *   0  all review-mandated artifacts have their sidecar (or audited skip)
 *   1  one or more missing sidecars detected
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = "agent-output";

// step key -> { gatingArtifact, requiredSidecar, label }
const GATES = {
  1: {
    gatingArtifact: "01-requirements.md",
    requiredSidecar: "challenge-findings-requirements.json",
    label: "Step 1 Requirements",
  },
  2: {
    gatingArtifact: "02-architecture-assessment.md",
    requiredSidecar: "challenge-findings-architecture.json",
    label: "Step 2 Architecture",
  },
  "3_5": {
    gatingArtifact: "04-governance-constraints.md",
    requiredSidecar: "challenge-findings-governance-constraints-pass1.json",
    label: "Step 3.5 Governance",
  },
  4: {
    gatingArtifact: "04-implementation-plan.md",
    requiredSidecar: "challenge-findings-plan.json",
    label: "Step 4 IaC Plan",
  },
};

const r = new Reporter("Challenger Presence Validator");
r.header();

function listProjects(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function skipReasonFor(sessionStatePath, stepKey) {
  if (!fs.existsSync(sessionStatePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(sessionStatePath, "utf-8"));
    const skips = data?.decisions?.challenger_skip;
    if (!Array.isArray(skips)) return null;
    const match = skips.find((s) => s && s.step === stepKey && typeof s.reason === "string" && s.reason.trim() !== "");
    return match ? match.reason.trim() : null;
  } catch {
    return null;
  }
}

function sidecarOk(sidecarPath) {
  if (!fs.existsSync(sidecarPath)) return false;
  try {
    const text = fs.readFileSync(sidecarPath, "utf-8").trim();
    if (!text) return false;
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

const projects = listProjects(ROOT);
if (projects.length === 0) {
  console.log("  ℹ️  No projects under agent-output/ — nothing to validate.\n");
}

for (const project of projects) {
  const projectDir = path.join(ROOT, project);
  const sessionState = path.join(projectDir, "00-session-state.json");
  for (const [stepKey, gate] of Object.entries(GATES)) {
    r.tick();
    const gatingPath = path.join(projectDir, gate.gatingArtifact);
    if (!fs.existsSync(gatingPath)) continue; // step not produced
    const sidecarPath = path.join(projectDir, gate.requiredSidecar);
    if (sidecarOk(sidecarPath)) continue;

    const skipReason = skipReasonFor(sessionState, stepKey);
    if (skipReason) {
      r.info(`${project}/${gate.label}`, `skipped via challenger_skip audit: ${skipReason}`);
      continue;
    }

    r.error(
      `${project}/${gate.label}`,
      `gating artifact ${gate.gatingArtifact} exists but required findings ` +
        `sidecar ${gate.requiredSidecar} is missing or unreadable. Run the ` +
        `challenger-review-subagent (or 10-Challenger agent) to produce it.`,
    );
  }
}

r.summary();
r.exitOnError(
  "All review-mandated artifacts have a present challenger findings sidecar (or audited skip)",
  "Missing challenger findings sidecar(s) detected — review is mandatory before handoff",
);
