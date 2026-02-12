#!/usr/bin/env node
/**
 * H2 Heading Sync Validator
 *
 * Ensures the three sources of truth for artifact H2 headings stay in sync:
 *   1. SKILL.md fenced code blocks (what agents read)
 *   2. artifact-h2-reference.instructions.md fenced code blocks (auto-applied instructions)
 *   3. ARTIFACT_HEADINGS in validate-artifact-templates.mjs (what the validator enforces)
 *
 * @example
 * node scripts/validate-h2-sync.mjs
 */

import fs from "node:fs";

const SKILL_PATH = ".github/skills/azure-artifacts/SKILL.md";
const H2_REF_PATH =
  ".github/instructions/artifact-h2-reference.instructions.md";
const VALIDATOR_PATH = "scripts/validate-artifact-templates.mjs";

// Artifact types that have H2 definitions in all three sources
// PROJECT-README uses different naming across sources, handled separately
const ARTIFACT_NAMES = [
  "01-requirements.md",
  "02-architecture-assessment.md",
  "03-des-cost-estimate.md",
  "04-governance-constraints.md",
  "04-implementation-plan.md",
  "04-preflight-check.md",
  "05-implementation-reference.md",
  "06-deployment-summary.md",
  "07-ab-cost-estimate.md",
  "07-backup-dr-plan.md",
  "07-compliance-matrix.md",
  "07-design-document.md",
  "07-documentation-index.md",
  "07-operations-runbook.md",
  "07-resource-inventory.md",
];

let errors = 0;

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

/**
 * Extracts H2 headings from fenced code blocks in a markdown file.
 * Looks for sections like `### 01-requirements.md` (optionally with suffix)
 * followed by a fenced code block containing `## Heading` lines.
 * Handles both ``` and ```markdown fence styles.
 *
 * Returns a Map: artifactName -> [headings]
 */
function parseMarkdownH2Blocks(text) {
  const result = new Map();
  // Match ### headings (with optional suffix like "(Agent Name)")
  // followed by a fenced code block (``` or ```markdown)
  const sectionRegex =
    /###\s+([\w.-]+\.md)(?:\s+[^\n]*)?\n+```(?:markdown)?\n([\s\S]*?)```/g;
  let match;

  while ((match = sectionRegex.exec(text)) !== null) {
    const artifactName = match[1];
    const blockContent = match[2];

    const headings = blockContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("## "))
      // Strip optional trailing HTML comments like <!-- Optional, add at end -->
      .map((h) => h.replace(/\s*<!--.*?-->\s*$/, "").trim());

    if (headings.length > 0) {
      result.set(artifactName, headings);
    }
  }

  return result;
}

/**
 * Extracts ARTIFACT_HEADINGS from the validator source code.
 * Parses the JavaScript object literal, handling both single-line
 * and multi-line array formats.
 *
 * Returns a Map: artifactName -> [headings]
 */
function parseValidatorHeadings(text) {
  const result = new Map();

  const blockMatch = text.match(
    /const ARTIFACT_HEADINGS\s*=\s*\{([\s\S]*?)\n\};/,
  );
  if (!blockMatch) return result;

  const block = blockMatch[1];

  const entryRegex = /"([^"]+\.md)":\s*\[([\s\S]*?)\]/g;
  let match;

  while ((match = entryRegex.exec(block)) !== null) {
    const artifactName = match[1];
    const arrayContent = match[2];

    // Use global regex to find all "## ..." strings (handles single + multi-line)
    const headingRegex = /"(## [^"]+)"/g;
    const headings = [];
    let hMatch;

    while ((hMatch = headingRegex.exec(arrayContent)) !== null) {
      headings.push(hMatch[1]);
    }

    if (headings.length > 0) {
      result.set(artifactName, headings);
    }
  }

  return result;
}

/**
 * Filters out ## References from heading lists for comparison.
 * The validator ARTIFACT_HEADINGS intentionally excludes ## References
 * (it's always optional/allowed). Most SKILL.md and H2-reference
 * blocks include it for documentation completeness, but some artifacts
 * (e.g. 04-preflight-check, 05-implementation-reference) omit it.
 */
function stripReferences(headings) {
  return headings.filter((h) => h !== "## References");
}

function compareHeadings(artifactName, sourceA, sourceB, nameA, nameB) {
  const a = stripReferences(sourceA);
  const b = stripReferences(sourceB);

  if (a.length !== b.length) {
    console.log(
      `::error::${artifactName}: ${nameA} has ${a.length} headings, ${nameB} has ${b.length}`,
    );
    const inANotB = a.filter((h) => !b.includes(h));
    const inBNotA = b.filter((h) => !a.includes(h));
    if (inANotB.length > 0) {
      console.log(`  In ${nameA} but not ${nameB}: ${inANotB.join(", ")}`);
    }
    if (inBNotA.length > 0) {
      console.log(`  In ${nameB} but not ${nameA}: ${inBNotA.join(", ")}`);
    }
    errors++;
    return;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      console.log(
        `::error::${artifactName}: heading mismatch at position ${i + 1} — ${nameA}="${a[i]}" vs ${nameB}="${b[i]}"`,
      );
      errors++;
      return;
    }
  }
}

function main() {
  console.log("🔍 H2 Heading Sync Validator\n");

  if (
    !fs.existsSync(SKILL_PATH) ||
    !fs.existsSync(H2_REF_PATH) ||
    !fs.existsSync(VALIDATOR_PATH)
  ) {
    console.log("::error::One or more source files not found");
    process.exit(1);
  }

  const skillHeadings = parseMarkdownH2Blocks(readText(SKILL_PATH));
  const h2RefHeadings = parseMarkdownH2Blocks(readText(H2_REF_PATH));
  const validatorHeadings = parseValidatorHeadings(readText(VALIDATOR_PATH));

  console.log(
    `Sources: SKILL.md (${skillHeadings.size}), H2-reference (${h2RefHeadings.size}), Validator (${validatorHeadings.size})\n`,
  );

  for (const artifactName of ARTIFACT_NAMES) {
    const skill = skillHeadings.get(artifactName);
    const h2Ref = h2RefHeadings.get(artifactName);
    const validator = validatorHeadings.get(artifactName);

    if (!skill) {
      console.log(`::error::${artifactName}: missing from SKILL.md`);
      errors++;
      continue;
    }
    if (!h2Ref) {
      console.log(
        `::error::${artifactName}: missing from artifact-h2-reference`,
      );
      errors++;
      continue;
    }
    if (!validator) {
      console.log(
        `::error::${artifactName}: missing from validator ARTIFACT_HEADINGS`,
      );
      errors++;
      continue;
    }

    compareHeadings(artifactName, skill, h2Ref, "SKILL.md", "H2-reference");
    compareHeadings(artifactName, skill, validator, "SKILL.md", "Validator");
  }

  console.log(`\n${"=".repeat(50)}`);
  if (errors > 0) {
    console.log(`❌ ${errors} sync error(s) found`);
    process.exit(1);
  } else {
    console.log(
      `✅ All ${ARTIFACT_NAMES.length} artifact types in sync across 3 sources`,
    );
  }
}

main();
