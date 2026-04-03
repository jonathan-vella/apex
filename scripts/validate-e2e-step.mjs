#!/usr/bin/env node
/**
 * E2E Per-Step Validation Orchestrator
 *
 * Thin orchestrator that composes existing validators per workflow step.
 * Does NOT reimplement validation logic — runs the relevant subset of
 * npm run lint:* and npm run validate:* commands and collects results.
 *
 * Usage:
 *   node scripts/validate-e2e-step.mjs <step>        # validate one step
 *   node scripts/validate-e2e-step.mjs all            # validate all steps
 *   node scripts/validate-e2e-step.mjs pre <step>     # pre-validation only
 *
 * Output: JSON to stdout with validation results
 *
 * @example
 *   node scripts/validate-e2e-step.mjs 1
 *   node scripts/validate-e2e-step.mjs pre 5
 *   node scripts/validate-e2e-step.mjs all
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// Support --project=name or positional project name before step arg
const rawArgs = process.argv.slice(2);
const projectFlag = rawArgs.find((a) => a.startsWith("--project="));
const PROJECT = projectFlag
  ? projectFlag.split("=")[1]
  : "contoso-service-hub-run-1";
const OUTPUT_DIR = path.join("agent-output", PROJECT);
const BICEP_DIR = path.join("infra", "bicep", PROJECT);
const TF_DIR = path.join("infra", "terraform", PROJECT);

// Detect IaC tool from session state
function detectIacTool() {
  try {
    const state = JSON.parse(
      fs.readFileSync(path.join(OUTPUT_DIR, "00-session-state.json"), "utf-8"),
    );
    return (
      state.iac_tool ||
      state.decisions?.iac_tool ||
      "Bicep"
    ).toLowerCase();
  } catch {
    return "bicep";
  }
}

const IAC_TOOL = detectIacTool();

// Expected H2 headings per artifact (first 3 for pre-validation)
const EXPECTED_H2S = {
  1: {
    file: "01-requirements.md",
    headings: [
      "## 🎯 Project Overview",
      "## 🚀 Functional Requirements",
      "## ⚡ Non-Functional Requirements (NFRs)",
    ],
  },
  2: {
    file: "02-architecture-assessment.md",
    headings: [],
  },
  3: {
    files: ["03-des-*.md"],
    headings: [],
  },
  3.5: {
    files: ["04-governance-constraints.md", "04-governance-constraints.json"],
    headings: [],
  },
  4: {
    file: "04-implementation-plan.md",
    headings: ["## 📋 Overview", "## 📦 Resource Inventory"],
  },
  5: {
    bicepFile: "main.bicep",
    terraformFile: "main.tf",
    modulesDir: "modules",
    headings: [],
  },
  6: {
    file: "06-deployment-summary.md",
    headings: [],
  },
  7: {
    pattern: "07-*.md",
    minFiles: 5,
    headings: [],
  },
};

// Per-step validator commands (compose existing validators)
const STEP_VALIDATORS = {
  all: ["npm run validate:session-state --silent 2>&1"],
  1: [
    "npm run lint:artifact-templates --silent 2>&1",
    "npm run lint:h2-sync --silent 2>&1",
  ],
  2: ["npm run lint:artifact-templates --silent 2>&1"],
  3: [],
  3.5: ["npm run lint:governance-refs --silent 2>&1"],
  4: [
    "npm run lint:artifact-templates --silent 2>&1",
    "npm run lint:h2-sync --silent 2>&1",
  ],
  5: [],
  6: [],
  7: [],
};

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

function globFiles(dir, pattern) {
  try {
    const files = fs.readdirSync(dir);
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    );
    return files.filter((f) => regex.test(f));
  } catch {
    return [];
  }
}

function checkH2Headings(filePath, expectedH2s) {
  if (!expectedH2s || expectedH2s.length === 0)
    return { pass: true, missing: [] };
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const missing = expectedH2s.filter((h2) => !content.includes(h2));
    return { pass: missing.length === 0, missing };
  } catch {
    return { pass: false, missing: expectedH2s };
  }
}

function runCommand(cmd) {
  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output: output.trim() };
  } catch (err) {
    return {
      success: false,
      output: (err.stdout || "").trim() + "\n" + (err.stderr || "").trim(),
    };
  }
}

function preValidateStep(step) {
  const findings = [];
  const spec = EXPECTED_H2S[step];
  if (!spec) return { pass: false, findings: [`Unknown step: ${step}`] };

  if (step === 5) {
    // IaC-specific pre-validation
    if (IAC_TOOL === "terraform") {
      const mainTf = path.join(TF_DIR, spec.terraformFile);
      if (!fileExists(mainTf)) {
        findings.push(`Missing: ${mainTf}`);
      }
      const modulesPath = path.join(TF_DIR, spec.modulesDir);
      try {
        if (!fs.statSync(modulesPath).isDirectory()) {
          findings.push(`Not a directory: ${modulesPath}`);
        }
      } catch {
        findings.push(`Missing directory: ${modulesPath}`);
      }
    } else {
      const mainBicep = path.join(BICEP_DIR, spec.bicepFile);
      if (!fileExists(mainBicep)) {
        findings.push(`Missing: ${mainBicep}`);
      }
      const modulesPath = path.join(BICEP_DIR, spec.modulesDir);
      try {
        if (!fs.statSync(modulesPath).isDirectory()) {
          findings.push(`Not a directory: ${modulesPath}`);
        }
      } catch {
        findings.push(`Missing directory: ${modulesPath}`);
      }
    }
  } else if (step === 7) {
    // Step 7: check multiple 07-*.md files
    const matches = globFiles(OUTPUT_DIR, spec.pattern);
    if (matches.length < spec.minFiles) {
      findings.push(
        `Expected ≥${spec.minFiles} files matching ${spec.pattern}, found ${matches.length}`,
      );
    }
  } else if (step === 3) {
    const adrMatches = globFiles(OUTPUT_DIR, "03-des-*.md");
    const hasDrawio = fileExists(
      path.join(OUTPUT_DIR, "03-des-diagram.drawio"),
    );
    const hasLegacyPython = globFiles(OUTPUT_DIR, "03-des-*.py").length > 0;

    if (adrMatches.length === 0) {
      findings.push(`No files matching 03-des-*.md in ${OUTPUT_DIR}`);
    }
    if (!hasDrawio && !hasLegacyPython) {
      findings.push(
        `Missing design diagram artifact: expected 03-des-diagram.drawio or legacy 03-des-*.py in ${OUTPUT_DIR}`,
      );
    }
  } else if (step === 4) {
    const planPath = path.join(OUTPUT_DIR, spec.file);
    if (!fileExists(planPath)) {
      findings.push(`Missing or empty: ${planPath}`);
    } else {
      const h2Check = checkH2Headings(planPath, spec.headings);
      if (!h2Check.pass) {
        findings.push(
          `Missing H2 headings in ${spec.file}: ${h2Check.missing.join(", ")}`,
        );
      }
    }

    const hasDrawio =
      fileExists(path.join(OUTPUT_DIR, "04-dependency-diagram.drawio")) &&
      fileExists(path.join(OUTPUT_DIR, "04-runtime-diagram.drawio"));
    const hasLegacyPython =
      fileExists(path.join(OUTPUT_DIR, "04-dependency-diagram.py")) &&
      fileExists(path.join(OUTPUT_DIR, "04-runtime-diagram.py"));

    if (!hasDrawio && !hasLegacyPython) {
      findings.push(
        "Missing Step 4 diagrams: expected Draw.io or legacy Python diagram source files",
      );
    }
  } else if (spec.files) {
    // Multiple specific files (e.g., Step 3, 3.5)
    for (const pattern of spec.files) {
      if (pattern.includes("*")) {
        const matches = globFiles(OUTPUT_DIR, pattern);
        if (matches.length === 0) {
          findings.push(`No files matching ${pattern} in ${OUTPUT_DIR}`);
        }
      } else {
        const filePath = path.join(OUTPUT_DIR, pattern);
        if (!fileExists(filePath)) {
          findings.push(`Missing or empty: ${filePath}`);
        }
      }
    }
  } else if (spec.file) {
    // Single file
    const filePath = path.join(OUTPUT_DIR, spec.file);
    if (!fileExists(filePath)) {
      findings.push(`Missing or empty: ${filePath}`);
    } else {
      const h2Check = checkH2Headings(filePath, spec.headings);
      if (!h2Check.pass) {
        findings.push(
          `Missing H2 headings in ${spec.file}: ${h2Check.missing.join(", ")}`,
        );
      }
    }
  }

  // Session state check
  const statePath = path.join(OUTPUT_DIR, "00-session-state.json");
  try {
    JSON.parse(fs.readFileSync(statePath, "utf-8"));
  } catch {
    findings.push("00-session-state.json is missing or invalid JSON");
  }

  return { pass: findings.length === 0, findings };
}

function validateStep(step) {
  const startTime = Date.now();

  // Pre-validation first
  const preResult = preValidateStep(step);
  if (!preResult.pass) {
    return {
      step,
      pass: false,
      pre_validation_failed: true,
      findings: preResult.findings,
      artifact_count: 0,
      validation_time_ms: Date.now() - startTime,
    };
  }

  // Run step-specific validators
  const findings = [];
  const commands = [
    ...(STEP_VALIDATORS.all || []),
    ...(STEP_VALIDATORS[step] || []),
  ];

  // Step 5: IaC build/validate
  if (step === 5) {
    if (IAC_TOOL === "terraform") {
      const initResult = runCommand(
        `terraform -chdir=${TF_DIR} init -backend=false -input=false`,
      );
      if (!initResult.success) {
        findings.push(`terraform init failed: ${initResult.output}`);
      }
      const validateResult = runCommand(`terraform -chdir=${TF_DIR} validate`);
      if (!validateResult.success) {
        findings.push(`terraform validate failed: ${validateResult.output}`);
      }
      const fmtResult = runCommand(`terraform fmt -check -recursive ${TF_DIR}`);
      if (!fmtResult.success) {
        findings.push(`terraform fmt check failed: ${fmtResult.output}`);
      }
    } else {
      const mainBicep = path.join(BICEP_DIR, "main.bicep");
      const buildResult = runCommand(`bicep build ${mainBicep}`);
      if (!buildResult.success) {
        findings.push(`bicep build failed: ${buildResult.output}`);
      }
      const lintResult = runCommand(`bicep lint ${mainBicep}`);
      if (!lintResult.success) {
        findings.push(`bicep lint failed: ${lintResult.output}`);
      }
    }
  }

  for (const cmd of commands) {
    const result = runCommand(cmd);
    if (!result.success) {
      findings.push(
        `Validator failed (${cmd.split(" ")[2] || cmd}): ${result.output.slice(0, 500)}`,
      );
    }
  }

  // Count artifacts for this step
  let artifactCount = 0;
  try {
    const files = fs.readdirSync(OUTPUT_DIR);
    const stepPrefix =
      step === 7
        ? "07-"
        : step === 3.5
          ? "04-governance"
          : `0${Math.floor(step)}-`;
    artifactCount = files.filter((f) => f.startsWith(stepPrefix)).length;
  } catch {
    /* empty */
  }

  return {
    step,
    pass: findings.length === 0,
    pre_validation_failed: false,
    findings,
    artifact_count: artifactCount,
    validation_time_ms: Date.now() - startTime,
  };
}

// Main
const args = process.argv.slice(2).filter((a) => !a.startsWith("--project="));
const isPre = args[0] === "pre";
const stepArg = isPre ? args[1] : args[0];

if (!stepArg) {
  console.error(
    "Usage: node scripts/validate-e2e-step.mjs [--project=name] [pre] <step|all>",
  );
  process.exit(1);
}

if (stepArg === "all") {
  const results = [];
  for (const step of [1, 2, 3, 3.5, 4, 5, 6, 7]) {
    results.push(
      isPre ? { step, ...preValidateStep(step) } : validateStep(step),
    );
  }
  const allPass = results.every((r) => r.pass);
  console.log(JSON.stringify({ all_pass: allPass, steps: results }, null, 2));
  process.exit(allPass ? 0 : 1);
} else {
  const step = parseFloat(stepArg);
  if (isNaN(step)) {
    console.error(`Invalid step: ${stepArg}`);
    process.exit(1);
  }
  const result = isPre
    ? { step, ...preValidateStep(step) }
    : validateStep(step);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}
