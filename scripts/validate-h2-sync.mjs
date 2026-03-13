#!/usr/bin/env node
/**
 * H2 Heading Sync Validator
 *
 * Ensures the sources of truth for artifact H2 headings stay in sync:
 *   1. SKILL.md + references/ fenced code blocks (what agents read)
 *   2. azure-artifacts.instructions.md fenced code blocks (optional — checked when present)
 *   3. ARTIFACT_HEADINGS in validate-artifact-templates.mjs (what the validator enforces)
 *
 * @example
 * node scripts/validate-h2-sync.mjs
 */

import fs from "node:fs";
import path from "node:path";

const SKILL_PATH = ".github/skills/azure-artifacts/SKILL.md";
const SKILL_REFS_DIR = ".github/skills/azure-artifacts/references";
const H2_REF_PATH = ".github/instructions/azure-artifacts.instructions.md";
const VALIDATOR_PATH = "scripts/_lib/artifact-headings.mjs";

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
  // followed by a fenced code block (```, ```markdown, or ```text)
  const sectionRegex =
    /###\s+([\w.-]+\.md)(?:\s+[^\n]*)?\n+```(?:markdown|text)?\n([\s\S]*?)```/g;
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
    /(?:const|export const) ARTIFACT_HEADINGS\s*=\s*\{([\s\S]*?)\n\};/,
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
    console.log(
      `  Fix: Align headings across sources. SKILL.md templates are the source of truth.`,
    );
    errors++;
    return;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      console.log(
        `::error::${artifactName}: heading mismatch at position ${i + 1} — ${nameA}="${a[i]}" vs ${nameB}="${b[i]}"`,
      );
      console.log(
        `  Fix: Update the divergent heading to match. SKILL.md templates are the source of truth.`,
      );
      errors++;
      return;
    }
  }
}

function main() {
  console.log("🔍 H2 Heading Sync Validator\n");

  const missing = [];
  if (!fs.existsSync(SKILL_PATH)) missing.push(SKILL_PATH);
  if (!fs.existsSync(VALIDATOR_PATH)) missing.push(VALIDATOR_PATH);
  if (missing.length > 0) {
    for (const f of missing) {
      console.log(`::error::Missing source file: ${f}`);
    }
    console.log(
      "  Fix: Ensure all H2 source files exist. Run 'git status' to check for missing files.",
    );
    process.exit(1);
  }

  // H2_REF_PATH is optional — only compared when present
  const h2RefExists = fs.existsSync(H2_REF_PATH);
  if (!h2RefExists) {
    console.log(
      `  ⚠️  ${H2_REF_PATH} not found — skipping instruction-file comparison`,
    );
  }

  const skillHeadings = parseMarkdownH2Blocks(readText(SKILL_PATH));

  // Also parse reference files under the skill's references/ directory
  if (fs.existsSync(SKILL_REFS_DIR)) {
    const refFiles = fs
      .readdirSync(SKILL_REFS_DIR)
      .filter((f) => f.endsWith(".md"));
    for (const refFile of refFiles) {
      const refPath = path.join(SKILL_REFS_DIR, refFile);
      const refHeadings = parseMarkdownH2Blocks(readText(refPath));
      for (const [key, value] of refHeadings) {
        if (!skillHeadings.has(key)) {
          skillHeadings.set(key, value);
        }
      }
    }
  }

  const h2RefHeadings = h2RefExists
    ? parseMarkdownH2Blocks(readText(H2_REF_PATH))
    : new Map();
  const validatorHeadings = parseValidatorHeadings(readText(VALIDATOR_PATH));

  console.log(
    `Sources: SKILL.md + references/ (${skillHeadings.size}), H2-reference (${h2RefHeadings.size}${h2RefExists ? "" : " — skipped"}), Validator (${validatorHeadings.size})\n`,
  );

  for (const artifactName of ARTIFACT_NAMES) {
    const skill = skillHeadings.get(artifactName);
    const h2Ref = h2RefHeadings.get(artifactName);
    const validator = validatorHeadings.get(artifactName);

    if (!skill) {
      console.log(
        `::error file=${SKILL_PATH}::${artifactName}: missing from SKILL.md + references/`,
      );
      console.log(
        `  Fix: Add a '### ${artifactName}' section with H2 headings in a fenced code block to ${SKILL_PATH} or a file in ${SKILL_REFS_DIR}/`,
      );
      errors++;
      continue;
    }
    if (!validator) {
      console.log(
        `::error file=${VALIDATOR_PATH}::${artifactName}: missing from ARTIFACT_HEADINGS`,
      );
      console.log(
        `  Fix: Add a "${artifactName}": ["## ...", ...] entry to the ARTIFACT_HEADINGS object in ${VALIDATOR_PATH}`,
      );
      errors++;
      continue;
    }

    // H2-reference (instructions file) is optional — headings may live in
    // SKILL.md references instead. Only compare when present.
    if (h2Ref) {
      compareHeadings(artifactName, skill, h2Ref, "SKILL.md", "H2-reference");
    }
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
