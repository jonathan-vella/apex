#!/usr/bin/env node
/**
 * Governance Reference Validator
 *
 * Validates that governance guardrails remain intact across agents,
 * instructions, and subagents. Fails CI if any guardrail is removed.
 *
 * Checks:
 * 1. Bicep Code Generator references 04-governance-constraints
 * 2. bicep-validate-subagent has Governance Compliance checklist
 * 3. IaC Planner references JSON output schema completeness
 * 4. iac-bicep-best-practices.instructions.md exists with correct applyTo
 *
 * @example
 * node scripts/validate-governance-refs.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = process.cwd();
const r = new Reporter("Governance Reference Validation");

const _fileCache = new Map();

function fileContains(filePath, pattern) {
  const absPath = path.resolve(ROOT, filePath);
  if (!fs.existsSync(absPath)) return false;
  if (!_fileCache.has(absPath)) {
    _fileCache.set(absPath, fs.readFileSync(absPath, "utf-8"));
  }
  const content = _fileCache.get(absPath);
  if (pattern instanceof RegExp) return pattern.test(content);
  return content.includes(pattern);
}

function fileExists(filePath) {
  return fs.existsSync(path.resolve(ROOT, filePath));
}

console.log("\n🔍 Governance Reference Validation\n");

function check(description, condition) {
  r.check(description, condition);
}

// 1. Bicep Code Generator references governance constraints
console.log("📄 06b-bicep-codegen.agent.md");
const codeGenPath = ".github/agents/06b-bicep-codegen.agent.md";
check(
  "References 04-governance-constraints",
  fileContains(codeGenPath, "04-governance-constraints"),
);
check(
  "Has Phase 1.5: Governance Compliance Mapping",
  fileContains(codeGenPath, "Phase 1.5"),
);
check(
  "References iac-bicep-best-practices.instructions.md",
  fileContains(codeGenPath, "iac-bicep-best-practices.instructions.md"),
);
check(
  "DO list includes governance constraint parsing",
  fileContains(codeGenPath, "Parse") &&
    fileContains(codeGenPath, "04-governance-constraints.json") &&
    fileContains(codeGenPath, "Deny policy"),
);
check(
  "DON'T list warns against hardcoded tag lists",
  fileContains(codeGenPath, "hardcoded tag lists"),
);
check(
  "DON'T list warns against skipping governance mapping",
  fileContains(codeGenPath, "Skip governance compliance mapping"),
);

// 2. bicep-validate-subagent has Governance Compliance section
console.log("\n📄 bicep-validate-subagent.agent.md");
const reviewPath = ".github/agents/_subagents/bicep-validate-subagent.agent.md";
check(
  "Has Governance Compliance section",
  fileContains(reviewPath, "### 7. Governance Compliance"),
);
check(
  "Checks tag count against governance constraints",
  fileContains(reviewPath, "Tag count matches governance"),
);
check(
  "Checks Deny policies are satisfied",
  fileContains(reviewPath, "Deny polic"),
);
check(
  "Checks publicNetworkAccess",
  fileContains(reviewPath, "publicNetworkAccess"),
);
check("Checks SKU restrictions", fileContains(reviewPath, "SKU restriction"));

// 3. IaC Planner consumes governance JSON as prerequisite
console.log("\n📄 05-iac-planner.agent.md");
const plannerPath = ".github/agents/05-iac-planner.agent.md";
check(
  "References governance constraints as prerequisite",
  fileContains(plannerPath, "04-governance-constraints"),
);
check(
  "Has policy effect decision tree (inline or reference)",
  fileContains(plannerPath, "Code Generator Action") ||
    fileContains(plannerPath, "policy-effect-decision-tree"),
);

// 4. iac-bicep-best-practices.instructions.md exists and is valid
console.log("\n📄 iac-bicep-best-practices.instructions.md");
const bicepInstrPath =
  ".github/instructions/iac-bicep-best-practices.instructions.md";
check("File exists", fileExists(bicepInstrPath));
check(
  "Has correct applyTo scope including *.bicep",
  fileContains(bicepInstrPath, "**/*.bicep"),
);
check(
  'States "Azure Policy always wins"',
  fileContains(bicepInstrPath, "Azure Policy always wins"),
);
check(
  "References iac-policy-compliance",
  fileContains(bicepInstrPath, "iac-policy-compliance"),
);

// 5. Governance discovery instructions include downstream enforcement
console.log("\n📄 governance-discovery.instructions.md");
const govDiscPath = ".github/instructions/governance-discovery.instructions.md";
check(
  "applyTo covers governance artifacts",
  (() => {
    const content = fs.readFileSync(
      path.resolve(process.cwd(), govDiscPath),
      "utf-8",
    );
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return false;
    const fm = fmMatch[1];
    return (
      fm.includes("04-governance-constraints.md") ||
      fm.includes("04-governance-constraints")
    );
  })(),
);
check(
  "Has Downstream Enforcement section",
  fileContains(govDiscPath, "## Downstream Enforcement"),
);

// 6. IaC Planner uses azurePropertyPath (not bicepPropertyPath) for Terraform
console.log("\n📄 05-iac-planner.agent.md (Terraform property mapping)");
const iacPlannerPath = ".github/agents/05-iac-planner.agent.md";
check(
  "Uses azurePropertyPath (not bicepPropertyPath) for property mapping",
  fileContains(iacPlannerPath, "azurePropertyPath") &&
    fileContains(iacPlannerPath, "always use `azurePropertyPath`"),
);
check(
  "Governance constraints are a prerequisite",
  fileContains(iacPlannerPath, "REQUIRED") &&
    fileContains(iacPlannerPath, "04-governance-constraints"),
);
check(
  "References 04-governance-constraints.json",
  fileContains(iacPlannerPath, "04-governance-constraints.json"),
);

// 7. Terraform Code Generator governance compliance
console.log("\n📄 06t-terraform-codegen.agent.md");
const tfCodeGenPath = ".github/agents/06t-terraform-codegen.agent.md";
check(
  "Has Phase 1.5: Governance Compliance Mapping",
  fileContains(tfCodeGenPath, "Phase 1.5"),
);
check("Phase 1.5 is a HARD GATE", fileContains(tfCodeGenPath, "HARD GATE"));
check(
  "References 04-governance-constraints.json",
  fileContains(tfCodeGenPath, "04-governance-constraints.json"),
);
check(
  "Uses azurePropertyPath for policy translation",
  fileContains(tfCodeGenPath, "azurePropertyPath"),
);

// 8. Terraform review subagent has governance compliance section
console.log("\n📄 terraform-validate-subagent.agent.md");
const tfReviewPath =
  ".github/agents/_subagents/terraform-validate-subagent.agent.md";
check(
  "Has Governance Compliance section",
  fileContains(tfReviewPath, "### 7. Governance Compliance"),
);
check(
  "References azurePropertyPath for Terraform attribute translation",
  fileContains(tfReviewPath, "azurePropertyPath"),
);

// 9. iac-terraform-best-practices.instructions.md covers Terraform
console.log("\n📄 iac-terraform-best-practices.instructions.md");
const tfPolicyInstrPath =
  ".github/instructions/iac-terraform-best-practices.instructions.md";
check("File exists", fileExists(tfPolicyInstrPath));
check(
  "Has correct applyTo scope including *.tf",
  fileContains(tfPolicyInstrPath, "**/*.tf"),
);
check(
  'States "Azure Policy always wins"',
  fileContains(tfPolicyInstrPath, "Azure Policy always wins"),
);
check(
  "References iac-policy-compliance",
  fileContains(tfPolicyInstrPath, "iac-policy-compliance"),
);

// 10. Governance discovery subagent produces BOTH bicepPropertyPath AND azurePropertyPath
console.log("\n📄 governance-discovery-subagent.agent.md (dual-field)");
const govDiscSubPath =
  ".github/agents/_subagents/governance-discovery-subagent.agent.md";
check(
  "Produces bicepPropertyPath field in JSON output",
  fileContains(govDiscSubPath, "bicepPropertyPath"),
);
check(
  "Produces azurePropertyPath field in JSON output",
  fileContains(govDiscSubPath, "azurePropertyPath"),
);

// Summary
r.summary("Governance guardrails");
r.exitOnError(
  "All governance guardrails intact",
  `${r.errors} governance guardrail(s) missing — see failures above`,
);
