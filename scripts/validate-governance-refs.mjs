#!/usr/bin/env node
/**
 * Governance Reference Validator
 *
 * Validates that governance guardrails remain intact across agents,
 * instructions, and subagents. Fails CI if any guardrail is removed.
 *
 * Checks:
 * 1. Bicep Code Generator references 04-governance-constraints
 * 2. bicep-review-subagent has Governance Compliance checklist
 * 3. Bicep Planner references JSON output schema completeness
 * 4. bicep-policy-compliance.instructions.md exists with correct applyTo
 *
 * @example
 * node scripts/validate-governance-refs.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

let errors = 0;
let checks = 0;

function check(description, condition) {
  checks++;
  if (condition) {
    console.log(`  ✅ ${description}`);
  } else {
    console.error(`  ❌ ${description}`);
    errors++;
  }
}

function fileContains(filePath, pattern) {
  const absPath = path.resolve(ROOT, filePath);
  if (!fs.existsSync(absPath)) return false;
  const content = fs.readFileSync(absPath, "utf-8");
  if (pattern instanceof RegExp) return pattern.test(content);
  return content.includes(pattern);
}

function fileExists(filePath) {
  return fs.existsSync(path.resolve(ROOT, filePath));
}

console.log("\n🔍 Governance Reference Validation\n");

// 1. Bicep Code Generator references governance constraints
console.log("📄 06-bicep-code-generator.agent.md");
const codeGenPath = ".github/agents/06-bicep-code-generator.agent.md";
check(
  "References 04-governance-constraints",
  fileContains(codeGenPath, "04-governance-constraints"),
);
check(
  "Has Phase 1.5: Governance Compliance Mapping",
  fileContains(codeGenPath, "Phase 1.5"),
);
check(
  "References bicep-policy-compliance.instructions.md",
  fileContains(codeGenPath, "bicep-policy-compliance.instructions.md"),
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

// 2. bicep-review-subagent has Governance Compliance section
console.log("\n📄 bicep-review-subagent.agent.md");
const reviewPath = ".github/agents/_subagents/bicep-review-subagent.agent.md";
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

// 3. Bicep Planner references JSON schema completeness
console.log("\n📄 05-bicep-planner.agent.md");
const plannerPath = ".github/agents/05-bicep-planner.agent.md";
check(
  "Notes JSON consumption by Code Generator",
  fileContains(plannerPath, "consumed downstream"),
);
check(
  "Requires bicepPropertyPath in JSON",
  fileContains(plannerPath, "bicepPropertyPath"),
);
check(
  "Requires requiredValue in JSON",
  fileContains(plannerPath, "requiredValue"),
);
check(
  "Has Code Generator Action column in policy effect table",
  fileContains(plannerPath, "Code Generator Action"),
);

// 4. bicep-policy-compliance.instructions.md exists and is valid
console.log("\n📄 bicep-policy-compliance.instructions.md");
const policyInstrPath =
  ".github/instructions/bicep-policy-compliance.instructions.md";
check("File exists", fileExists(policyInstrPath));
check(
  "Has correct applyTo scope including *.bicep",
  fileContains(policyInstrPath, "**/*.bicep"),
);
check(
  "Has correct applyTo scope including *.agent.md",
  fileContains(policyInstrPath, "**/*.agent.md"),
);
check(
  'States "Azure Policy always wins"',
  fileContains(policyInstrPath, "Azure Policy always wins"),
);
check(
  "References 04-governance-constraints.json",
  fileContains(policyInstrPath, "04-governance-constraints.json"),
);

// 5. Governance discovery instructions include downstream enforcement
console.log("\n📄 governance-discovery.instructions.md");
const govDiscPath = ".github/instructions/governance-discovery.instructions.md";
check("applyTo includes *.bicep", fileContains(govDiscPath, "**/*.bicep"));
check(
  "Has Downstream Enforcement section",
  fileContains(govDiscPath, "## Downstream Enforcement"),
);

// Summary
console.log(`\n${"─".repeat(50)}`);
console.log(
  `Checks: ${checks} | Passed: ${checks - errors} | Failed: ${errors}`,
);
if (errors > 0) {
  console.error(
    `\n❌ ${errors} governance guardrail(s) missing — see failures above`,
  );
  process.exit(1);
} else {
  console.log("\n✅ All governance guardrails intact");
}
