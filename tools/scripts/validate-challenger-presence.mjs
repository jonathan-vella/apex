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
 *
 * --publication-checkpoint is reserved for the Git publication snapshot:
 * an explicitly unapproved, never-started Governance draft can be saved
 * without granting handoff/completion approval. Default checks stay strict.
 * Standalone assessments use their own phase gates, not delivery numbering;
 * publishing an in-progress draft never accepts its unfinished review bundle.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAjv } from "./_lib/ajv-validator.mjs";
import { readJson, sha256File } from "./_lib/json.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { LAYOUT_SUBDIRS, resolveReviewPath, resolveSessionStatePath } from "./_lib/project-paths.mjs";
import { validateProject } from "./validate-risk-authorizations.mjs";

const ROOT = "agent-output";
const cliArgs = process.argv.slice(2);
const publicationCheckpoint = cliArgs.includes("--publication-checkpoint");

// step key -> { gatingArtifact, requiredSidecar, label }
const GATES = {
  1: {
    gatingArtifact: "01-requirements.md",
    requiredSidecar: "challenge-findings-requirements.json",
    label: "Step 1 Requirements",
  },
  2: {
    gatingArtifact: "02-architecture-assessment.md",
    alternativeArtifact: "03-des-cost-estimate.md",
    requiredSidecar: "challenge-findings-architecture.json",
    additionalSidecar: "challenge-findings-cost-estimate.json",
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
for (const argument of cliArgs.filter((argument) => argument !== "--publication-checkpoint")) {
  r.error("CLI", `Unsupported argument: ${argument}; optional flag: --publication-checkpoint`);
}

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

function reviewSidecar(sessionStatePath, defaultSidecar) {
  try {
    const state = JSON.parse(fs.readFileSync(sessionStatePath, "utf8"));
    if (state?.decisions?.review_depth === "deep") return defaultSidecar.replace(/\.json$/, "-pass1.json");
  } catch {
    return defaultSidecar;
  }
  return defaultSidecar;
}

const COST_FILES = /^(02-cost-estimate|02-cost-candidates|03-des-cost-estimate).*\.json$/;

// Same rule as apex-recall's Step 2 completion check; top level only, `_meta/` is the archive.
function step2Residue(projectDir) {
  const found = [];
  for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".tmp.md")) found.push(`${entry.name}: scratch file`);
    else if (COST_FILES.test(entry.name)) {
      try {
        const doc = JSON.parse(fs.readFileSync(path.join(projectDir, entry.name), "utf-8"));
        if (doc?.status === "FAILED") found.push(`${entry.name}: cost estimate with status FAILED`);
      } catch {
        // unreadable files are not this check's concern
      }
    }
  }
  return found;
}

const STEP_ORDER = ["1", "2", "3", "3_5", "4", "5", "6", "7"];

let validateAssessmentSchema = null;
function getAssessmentSchemaValidator() {
  if (!validateAssessmentSchema) {
    const schema = readJson(fileURLToPath(new URL("../schemas/session-state.schema.json", import.meta.url)));
    validateAssessmentSchema = createAjv().compile({ ...schema.$defs.assessmentRun, $defs: schema.$defs });
  }
  return validateAssessmentSchema;
}

function resolveContainedProjectFile(projectDir, relPath) {
  if (
    typeof relPath !== "string" ||
    !relPath.trim() ||
    relPath.includes("\\") ||
    relPath.includes("\0") ||
    /[*?[\]]/.test(relPath) ||
    relPath.split("/")[0].includes(":") ||
    path.isAbsolute(relPath) ||
    relPath
      .split("/")
      .some((part) => part === "" || part === "." || part === ".." || part.startsWith("assessment-step-")) ||
    relPath === "00-session-state.json" ||
    relPath === "_meta/00-session-state.json"
  ) {
    return null;
  }
  const rootAbs = path.resolve(projectDir);
  try {
    if (fs.lstatSync(rootAbs).isSymbolicLink()) return null;
    let cursor = rootAbs;
    for (const part of relPath.split("/")) {
      cursor = path.join(cursor, part);
      if (fs.lstatSync(cursor).isSymbolicLink()) return null;
    }
    const realRoot = fs.realpathSync(rootAbs);
    const realTarget = fs.realpathSync(cursor);
    const rel = path.relative(realRoot, realTarget);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return cursor;
  } catch {
    return null;
  }
}

function validateAssessmentPresence(project, projectDir, state) {
  const label = `${project}/Standalone assessment`;
  if (state.decisions?.workflow_mode !== "assessment") {
    r.error(label, "assessment_run requires explicit workflow_mode=assessment");
    return;
  }
  const validate = getAssessmentSchemaValidator();
  const run = state.assessment_run;
  if (!validate(run)) {
    r.error(label, `Invalid assessment_run: ${JSON.stringify(validate.errors)}`);
    return;
  }
  if (
    STEP_ORDER.slice(STEP_ORDER.indexOf("3_5")).some(
      (key) => state.steps?.[key] && !["pending", "not_started"].includes(state.steps[key].status),
    ) ||
    ["04-governance-constraints.md", "04-implementation-plan.md", "06-deployment-summary.md"].some((name) =>
      fs.existsSync(path.join(projectDir, name)),
    )
  ) {
    r.error(label, "Standalone assessment cannot waive downstream delivery history or delivery artifacts");
    return;
  }
  r.tick();
  if (run.status === "in_progress" && !["acceptance", "terminal"].includes(run.phase)) {
    r.info(label, `${run.phase} draft; independent WAF and cost reviews remain required before final acceptance`);
    return;
  }
  const requiresRecordedReceipt = run.phase === "terminal" || run.status === "accepted";
  for (const lens of ["comprehensive", "cost-feasibility"]) {
    const recorded = run.reviews?.find((review) => review.lens === lens);
    if (requiresRecordedReceipt && !recorded) {
      r.error(label, `Missing recorded ${lens} review receipt at ${run.phase}`);
      continue;
    }
    const cycleId = run.review_links?.[lens]?.cycle_id;
    const artifact = lens === "comprehensive" ? "02-architecture-assessment.md" : "03-cost-management-report.md";
    const cycles = Object.entries(state.decisions.review_cycles ?? {}).filter(([id, cycle]) =>
      cycleId
        ? id === cycleId
        : cycle.step === "2" && cycle.lens === lens && cycle.artifact === `agent-output/${project}/${artifact}`,
    );
    const matchedCycle = cycles.length === 1 ? cycles[0][1] : null;
    const selected =
      matchedCycle?.current_path ||
      (cycleId && typeof matchedCycle?.canonical_path === "string"
        ? path.posix.basename(matchedCycle.canonical_path)
        : null);
    let sidecar = null;
    if (recorded) {
      sidecar = resolveContainedProjectFile(projectDir, recorded.path);
    } else if (selected) {
      const candidate = resolveReviewPath(projectDir, selected);
      const rel = path.relative(path.resolve(projectDir), path.resolve(candidate)).split(path.sep).join("/");
      sidecar = resolveContainedProjectFile(projectDir, rel);
    }
    if (!sidecar || !sidecarOk(sidecar) || (recorded && sha256File(sidecar) !== recorded.sha256)) {
      r.error(label, `Missing, unreadable or changed ${lens} review at ${run.phase}`);
    }
  }
}

function isStepInProgressBeforeHandoff(sessionStatePath, stepKey) {
  if (!fs.existsSync(sessionStatePath)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(sessionStatePath, "utf8"));
    const steps = state?.steps;
    if (!steps || typeof steps !== "object") return false;
    if (steps[stepKey]?.status !== "in_progress") return false;
    const idx = STEP_ORDER.indexOf(stepKey);
    if (idx === -1) return false;
    const laterSteps = STEP_ORDER.slice(idx + 1);
    return !laterSteps.some((k) => steps[k]?.status === "in_progress" || steps[k]?.status === "complete");
  } catch {
    return false;
  }
}

function isPendingGovernanceCheckpoint(state, projectDir, stepKey, artifact) {
  if (!publicationCheckpoint || stepKey !== "3_5" || state?.steps?.[stepKey]?.status !== "pending") return false;
  const legacyPasses = state.review_audit?.step_3_5?.passes_executed;
  if (
    (legacyPasses !== undefined && legacyPasses !== 0) ||
    state.steps[stepKey].completed ||
    state.review_selections?.[stepKey] ||
    !Array.isArray(state.review_attempts ?? []) ||
    (state.review_attempts ?? []).some((attempt) => String(attempt?.step).replace(".", "_") === stepKey) ||
    Object.values(state.decisions?.review_cycles ?? {}).some(
      (cycle) => String(cycle?.step).replace(".", "_") === stepKey,
    ) ||
    STEP_ORDER.slice(STEP_ORDER.indexOf(stepKey) + 1).some(
      (key) => ![undefined, "pending", "not_started"].includes(state.steps[key]?.status),
    ) ||
    [projectDir, path.join(projectDir, "reviews")].some(
      (directory) =>
        fs.existsSync(directory) &&
        fs
          .readdirSync(directory)
          .some((name) => /^challenge-findings-governance-constraints(?:-.*)?\.json$/.test(name)),
    )
  ) {
    return false;
  }
  const header = fs
    .readFileSync(path.join(projectDir, artifact), "utf8")
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .split(/^## /m)[0];
  return (
    !/^\s*(?:```|~~~)/m.test(header) &&
    /^!\[Status\]\(https:\/\/img\.shields\.io\/badge\/Status-Owner_prepared_not_approved-[^\s)]+\)\s*$/m.test(header)
  );
}

function step2Complete(sessionStatePath) {
  try {
    return JSON.parse(fs.readFileSync(sessionStatePath, "utf-8"))?.steps?.["2"]?.status === "complete";
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
  const sessionState = resolveSessionStatePath(projectDir);
  let stateObj = null;
  if (fs.existsSync(sessionState)) {
    try {
      stateObj = JSON.parse(fs.readFileSync(sessionState, "utf-8"));
    } catch {
      stateObj = null;
    }
    try {
      for (const error of validateProject(path.resolve("."), project)) r.warn(project, `${error} (warning only)`);
    } catch (error) {
      r.warn(project, `Risk authorization check unavailable (warning only): ${error.message}`);
    }
  }
  if (stateObj?.layout_version === 2) {
    const allowedDirs = new Set(LAYOUT_SUBDIRS);
    for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory() && !allowedDirs.has(entry.name)) {
        r.error(
          `${project}/Layout v2`,
          `Unexpected root directory "${entry.name}" in ${projectDir} (allowed: ${LAYOUT_SUBDIRS.join(", ")})`,
        );
      } else if (entry.isFile() && !entry.name.endsWith(".md")) {
        r.error(
          `${project}/Layout v2`,
          `Non-Markdown file "${entry.name}" at ${projectDir} root — move to contracts/, reviews/, assets/, or _meta/`,
        );
      }
    }
  }
  if (stateObj?.decisions?.workflow_mode === "assessment" || stateObj?.assessment_run) {
    validateAssessmentPresence(project, projectDir, stateObj);
    continue;
  }
  for (const [stepKey, gate] of Object.entries(GATES)) {
    r.tick();
    const gatingArtifact = [gate.gatingArtifact, gate.alternativeArtifact].find(
      (artifact) => artifact && fs.existsSync(path.join(projectDir, artifact)),
    );
    if (!gatingArtifact) continue;
    const requiredSidecar = ["2", "4"].includes(stepKey)
      ? reviewSidecar(sessionState, gate.requiredSidecar)
      : gate.requiredSidecar;
    const missingSidecars = [requiredSidecar, gate.additionalSidecar].filter(
      (sidecar) => sidecar && !sidecarOk(resolveReviewPath(projectDir, sidecar)),
    );
    if (missingSidecars.length === 0) continue;

    const skipReason = skipReasonFor(sessionState, stepKey);
    if (skipReason) {
      r.info(`${project}/${gate.label}`, `skipped via challenger_skip audit: ${skipReason}`);
      continue;
    }

    if (isStepInProgressBeforeHandoff(sessionState, stepKey)) {
      r.info(`${project}/${gate.label}`, `step ${stepKey} is in_progress (pre-review draft before handoff)`);
      continue;
    }

    if (isPendingGovernanceCheckpoint(stateObj, projectDir, stepKey, gatingArtifact)) {
      r.info(
        `${project}/${gate.label}`,
        "unapproved pending owner draft: checkpoint publication only; independent review remains required for handoff/completion",
      );
      continue;
    }

    r.error(
      `${project}/${gate.label}`,
      `gating artifact ${gatingArtifact} exists but required findings ` +
        `sidecar(s) ${missingSidecars.join(", ")} are missing or unreadable. Run the ` +
        `challenger-review-subagent (or 10-Challenger agent) to produce it.`,
    );
  }
  if (step2Complete(sessionState)) {
    for (const item of step2Residue(projectDir)) {
      r.error(
        `${project}/Step 2 Architecture`,
        `${item}. Move superseded or failed cost files to ${projectDir}/_meta/ and delete scratch *.tmp.md files.`,
      );
    }
  }
}

r.summary();
r.exitOnError(
  publicationCheckpoint
    ? "Checkpoint publication validated; unapproved pending drafts grant no workflow approval"
    : "Review presence validated; in-progress assessment drafts grant no final acceptance",
  "Missing challenger findings sidecar(s) detected — review is mandatory before handoff",
);
