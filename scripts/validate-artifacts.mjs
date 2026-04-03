#!/usr/bin/env node
/**
 * Artifact Validators (consolidated)
 *
 * Combines three artifact validation checks into one script:
 * 1. H2 heading sync across sources (was validate-h2-sync.mjs)
 * 2. Artifact template compliance (was validate-artifact-templates.mjs)
 * 3. Artifact H2 auto-fix (was fix-artifact-h2.mjs, activated with --fix)
 *
 * @example
 * node scripts/validate-artifacts.mjs          # Run all validations
 * node scripts/validate-artifacts.mjs --fix <file>  # Auto-fix artifact H2 headings
 */

import fs from "node:fs";
import path from "node:path";
import { ARTIFACT_HEADINGS } from "./_lib/artifact-headings.mjs";

// ============================================================================
// Shared utilities
// ============================================================================

function readText(relPath) {
  const absPath = path.resolve(process.cwd(), relPath);
  return fs.readFileSync(absPath, "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.resolve(process.cwd(), relPath));
}

function extractH2Headings(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("## "));
}

// ============================================================================
// Part 1: H2 Heading Sync Validator (was validate-h2-sync.mjs)
// ============================================================================

const SKILL_PATH = ".github/skills/azure-artifacts/SKILL.md";
const SKILL_REFS_DIR = ".github/skills/azure-artifacts/references";
const H2_REF_PATH = ".github/instructions/azure-artifacts.instructions.md";
const VALIDATOR_PATH = "scripts/_lib/artifact-headings.mjs";

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

function parseMarkdownH2Blocks(text) {
  const result = new Map();
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
      .map((h) => h.replace(/\s*<!--.*?-->\s*$/, "").trim());

    if (headings.length > 0) {
      result.set(artifactName, headings);
    }
  }

  return result;
}

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

function stripReferences(headings) {
  return headings.filter((h) => h !== "## References");
}

function runH2Sync() {
  console.log("═══ Part 1: H2 Heading Sync ═══\n");

  let syncErrors = 0;

  const missing = [];
  if (!exists(SKILL_PATH)) missing.push(SKILL_PATH);
  if (!exists(VALIDATOR_PATH)) missing.push(VALIDATOR_PATH);
  if (missing.length > 0) {
    for (const f of missing) {
      console.log(`::error::Missing source file: ${f}`);
    }
    return 1;
  }

  const h2RefExists = exists(H2_REF_PATH);
  if (!h2RefExists) {
    console.log(
      `  ⚠️  ${H2_REF_PATH} not found — skipping instruction-file comparison`,
    );
  }

  const skillHeadings = parseMarkdownH2Blocks(readText(SKILL_PATH));

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
      syncErrors++;
      return;
    }

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        console.log(
          `::error::${artifactName}: heading mismatch at position ${i + 1} — ${nameA}="${a[i]}" vs ${nameB}="${b[i]}"`,
        );
        syncErrors++;
        return;
      }
    }
  }

  for (const artifactName of ARTIFACT_NAMES) {
    const skill = skillHeadings.get(artifactName);
    const h2Ref = h2RefHeadings.get(artifactName);
    const validator = validatorHeadings.get(artifactName);

    if (!skill) {
      console.log(
        `::error file=${SKILL_PATH}::${artifactName}: missing from SKILL.md + references/`,
      );
      syncErrors++;
      continue;
    }
    if (!validator) {
      console.log(
        `::error file=${VALIDATOR_PATH}::${artifactName}: missing from ARTIFACT_HEADINGS`,
      );
      syncErrors++;
      continue;
    }

    if (h2Ref) {
      compareHeadings(artifactName, skill, h2Ref, "SKILL.md", "H2-reference");
    }
    compareHeadings(artifactName, skill, validator, "SKILL.md", "Validator");
  }

  if (syncErrors > 0) {
    console.log(`\n❌ ${syncErrors} sync error(s) found`);
    return 1;
  }
  console.log(
    `✅ All ${ARTIFACT_NAMES.length} artifact types in sync across sources\n`,
  );
  return 0;
}

// ============================================================================
// Part 2: Artifact Template Compliance (was validate-artifact-templates.mjs)
// ============================================================================

const ARTIFACT_STRICTNESS = {
  "01-requirements.md": "standard",
  "02-architecture-assessment.md": "standard",
  "04-implementation-plan.md": "standard",
  "04-governance-constraints.md": "standard",
  "04-preflight-check.md": "standard",
  "05-implementation-reference.md": "standard",
  "06-deployment-summary.md": "standard",
  "07-design-document.md": "standard",
  "07-operations-runbook.md": "standard",
  "07-resource-inventory.md": "standard",
  "07-backup-dr-plan.md": "standard",
  "07-compliance-matrix.md": "standard",
  "07-documentation-index.md": "standard",
  "03-des-cost-estimate.md": "standard",
  "07-ab-cost-estimate.md": "standard",
  "README.md": "relaxed",
  "09-lessons-learned.md": "relaxed",
};

const OPTIONAL_ALLOWED = {
  "01-requirements.md": ["## References"],
  "02-architecture-assessment.md": ["## References"],
  "04-implementation-plan.md": ["## References"],
  "04-governance-constraints.md": ["## References"],
  "04-preflight-check.md": ["## References"],
  "05-implementation-reference.md": ["## Next Steps", "## References"],
  "06-deployment-summary.md": ["## References"],
  "07-design-document.md": ["## References"],
  "07-operations-runbook.md": ["## References"],
  "07-resource-inventory.md": [
    "## Resource Configuration Details",
    "## Tags Applied",
    "## Resource Dependencies",
    "## Cost Summary by Resource",
    "## Cost by Resource",
    "## Private DNS Zones",
    "## IP Address Allocation",
    "## Module Summary",
    "## Validation Commands",
    "## References",
  ],
  "07-backup-dr-plan.md": [
    "## 3. Disaster Recovery Architecture",
    "## References",
  ],
  "07-compliance-matrix.md": ["## Security Controls Summary", "## References"],
  "07-documentation-index.md": ["## Architecture Overview", "## References"],
  "03-des-cost-estimate.md": ["## References"],
  "07-ab-cost-estimate.md": ["## References"],
  "README.md": [],
  "09-lessons-learned.md": ["## References"],
};

const TITLE_DRIFT = "Artifact Template Drift";
const TITLE_MISSING = "Missing Template or Agent";

const GLOBAL_STRICTNESS = process.env.STRICTNESS;

const CONSOLIDATED_SKILL = ".github/skills/azure-artifacts/SKILL.md";

const AGENTS = {
  "01-requirements.md": ".github/agents/02-requirements.agent.md",
  "02-architecture-assessment.md": ".github/agents/03-architect.agent.md",
  "04-implementation-plan.md": ".github/agents/05-iac-planner.agent.md",
  "04-governance-constraints.md": ".github/agents/05-iac-planner.agent.md",
  "04-preflight-check.md": ".github/agents/06b-bicep-codegen.agent.md",
  "06-deployment-summary.md": ".github/agents/07b-bicep-deploy.agent.md",
  "05-implementation-reference.md": ".github/agents/06b-bicep-codegen.agent.md",
  "07-design-document.md": ".github/skills/azure-artifacts/SKILL.md",
  "07-operations-runbook.md": ".github/skills/azure-artifacts/SKILL.md",
  "07-resource-inventory.md": ".github/skills/azure-artifacts/SKILL.md",
  "07-backup-dr-plan.md": ".github/skills/azure-artifacts/SKILL.md",
  "07-compliance-matrix.md": ".github/skills/azure-artifacts/SKILL.md",
  "07-documentation-index.md": ".github/skills/azure-artifacts/SKILL.md",
  "03-des-cost-estimate.md": ".github/agents/03-architect.agent.md",
  "07-ab-cost-estimate.md": ".github/skills/azure-artifacts/SKILL.md",
  "README.md": null,
  "09-lessons-learned.md": null,
};

const TEMPLATE_DIR = ".github/skills/azure-artifacts/templates";

const TEMPLATES = {
  "01-requirements.md": `${TEMPLATE_DIR}/01-requirements.template.md`,
  "02-architecture-assessment.md": `${TEMPLATE_DIR}/02-architecture-assessment.template.md`,
  "04-implementation-plan.md": `${TEMPLATE_DIR}/04-implementation-plan.template.md`,
  "04-governance-constraints.md": `${TEMPLATE_DIR}/04-governance-constraints.template.md`,
  "04-preflight-check.md": `${TEMPLATE_DIR}/04-preflight-check.template.md`,
  "06-deployment-summary.md": `${TEMPLATE_DIR}/06-deployment-summary.template.md`,
  "05-implementation-reference.md": `${TEMPLATE_DIR}/05-implementation-reference.template.md`,
  "07-design-document.md": `${TEMPLATE_DIR}/07-design-document.template.md`,
  "07-operations-runbook.md": `${TEMPLATE_DIR}/07-operations-runbook.template.md`,
  "07-resource-inventory.md": `${TEMPLATE_DIR}/07-resource-inventory.template.md`,
  "07-backup-dr-plan.md": `${TEMPLATE_DIR}/07-backup-dr-plan.template.md`,
  "07-compliance-matrix.md": `${TEMPLATE_DIR}/07-compliance-matrix.template.md`,
  "07-documentation-index.md": `${TEMPLATE_DIR}/07-documentation-index.template.md`,
  "03-des-cost-estimate.md": `${TEMPLATE_DIR}/03-des-cost-estimate.template.md`,
  "07-ab-cost-estimate.md": `${TEMPLATE_DIR}/07-ab-cost-estimate.template.md`,
  "README.md": `${TEMPLATE_DIR}/PROJECT-README.template.md`,
  "09-lessons-learned.md": `${TEMPLATE_DIR}/09-lessons-learned.template.md`,
};

const STANDARD_DOC = ".github/instructions/markdown.instructions.md";

const COST_ESTIMATE_ARTIFACTS = [
  "03-des-cost-estimate.md",
  "07-ab-cost-estimate.md",
];

const DIAGRAM_ARTIFACT_EXPECTATIONS = {
  "04-implementation-plan.md": [
    {
      image: "./04-dependency-diagram.png",
      source: "./04-dependency-diagram.py",
    },
    {
      image: "./04-runtime-diagram.png",
      source: "./04-runtime-diagram.py",
    },
  ],
  "07-design-document.md": [
    {
      image: "./03-des-diagram.drawio.svg",
      source: "./03-des-diagram.drawio",
    },
    {
      image: "./03-des-network-diagram.png",
      source: "./03-des-network-diagram.py",
    },
  ],
};

let hasHardFailure = false;
let hasWarning = false;

function escapeGitHubCommandValue(value) {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

function annotate(level, { title, filePath, line, message }) {
  const parts = [];
  if (filePath) parts.push(`file=${filePath}`);
  if (line) parts.push(`line=${line}`);
  if (title) parts.push(`title=${escapeGitHubCommandValue(title)}`);

  const props = parts.length > 0 ? ` ${parts.join(",")}` : "";
  const body = escapeGitHubCommandValue(message);
  process.stdout.write(`::${level}${props}::${body}\n`);
}

function warn(message, { title = TITLE_DRIFT, filePath, line } = {}) {
  annotate("warning", { title, filePath, line, message });
  hasWarning = true;
}

function error(message, { title = TITLE_DRIFT, filePath, line } = {}) {
  annotate("error", { title, filePath, line, message });
  hasHardFailure = true;
}

function extractFencedBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];

  let inFence = false;
  let fence = "";
  let current = [];

  for (const line of lines) {
    if (!inFence) {
      const openMatch = line.match(/^(`{3,})[^`]*$/);
      if (openMatch) {
        inFence = true;
        fence = openMatch[1];
        current = [];
      }
      continue;
    }

    if (line.startsWith(fence)) {
      blocks.push(current.join("\n"));
      inFence = false;
      fence = "";
      current = [];
      continue;
    }

    current.push(line);
  }

  return blocks;
}

function validateCostDistribution(filePath, text, reportFn = error) {
  const costDistributionSection = text.match(
    /### Cost Distribution[\s\S]*?(?=\n### |\n## |$)/,
  );

  const sectionText = costDistributionSection?.[0] ?? text;
  const hasMarkdownTable = /\|[^\n]+\|\n\|[\s:-]+\|/.test(sectionText);
  const hasChartImage = /!\[[^\]]*\]\((?:\.\/)?[^)]+\.(png|svg)\)/i.test(
    sectionText,
  );

  if (!hasMarkdownTable && !hasChartImage) {
    reportFn(
      `${filePath} must include a cost distribution markdown table or a linked chart image (.png/.svg).`,
      { filePath, line: 1 },
    );
  }
}

function validateDiagramArtifactReferences(
  filePath,
  artifactName,
  text,
  reportFn = error,
) {
  const expectedReferences = DIAGRAM_ARTIFACT_EXPECTATIONS[artifactName] ?? [];

  function refPresent(ref) {
    return text.includes(ref) || text.includes(ref.replace(/^\.\//, ""));
  }

  for (const expected of expectedReferences) {
    if (!refPresent(expected.image)) {
      reportFn(
        `${filePath} is missing required diagram image reference: ${expected.image}`,
        { filePath, line: 1 },
      );
    }

    if (!refPresent(expected.source)) {
      reportFn(
        `${filePath} is missing required diagram source reference: ${expected.source}`,
        { filePath, line: 1 },
      );
    }
  }
}

function validateDiagramArtifactFiles(filePath, artifactName, reportFn = warn) {
  const expectedReferences = DIAGRAM_ARTIFACT_EXPECTATIONS[artifactName] ?? [];
  const artifactDir = path.dirname(filePath);

  for (const expected of expectedReferences) {
    const imagePath = path.normalize(
      path.join(artifactDir, expected.image.replace(/^\.\//, "")),
    );
    const sourcePath = path.normalize(
      path.join(artifactDir, expected.source.replace(/^\.\//, "")),
    );

    if (!exists(imagePath)) {
      reportFn(
        `${filePath} requires diagram image artifact: ${expected.image}`,
        { filePath, line: 1 },
      );
    }

    if (!exists(sourcePath)) {
      reportFn(
        `${filePath} requires diagram source artifact: ${expected.source}`,
        { filePath, line: 1 },
      );
    }
  }
}

function validateStandardComponents(filePath, text, reportFn = warn) {
  const basename = path.basename(filePath);
  if (basename === "README.md" || basename === "PROJECT-README.template.md") {
    return;
  }

  if (!text.includes("![Step]")) {
    reportFn(
      `${filePath} is missing the badge row (![Step], ![Status], ![Agent]).`,
      { filePath, line: 1 },
    );
  }

  if (!text.includes("<details")) {
    reportFn(`${filePath} is missing the collapsible Table of Contents.`, {
      filePath,
      line: 1,
    });
  }

  if (!/> Generated by .* agent/.test(text)) {
    reportFn(`${filePath} is missing the attribution header.`, {
      filePath,
      line: 1,
    });
  }

  if (!text.includes("⬅️ Previous")) {
    reportFn(`${filePath} is missing the cross-navigation table.`, {
      filePath,
      line: 1,
    });
  }
}

const MERMAID_REQUIRED_TEMPLATES = [
  "01-requirements.md",
  "02-architecture-assessment.md",
  "04-governance-constraints.md",
  "04-preflight-check.md",
  "05-implementation-reference.md",
  "07-backup-dr-plan.md",
  "07-compliance-matrix.md",
  "07-documentation-index.md",
  "07-operations-runbook.md",
  "07-resource-inventory.md",
];

function validateMermaidPresence(filePath, text, reportFn = warn) {
  if (!/```mermaid/.test(text)) {
    reportFn(`${filePath} should contain at least one Mermaid diagram block.`, {
      filePath,
      line: 1,
    });
  }
}

const TRAFFIC_LIGHT_TEMPLATES = [
  "02-architecture-assessment.md",
  "04-governance-constraints.md",
  "05-implementation-reference.md",
  "06-deployment-summary.md",
  "07-ab-cost-estimate.md",
  "07-compliance-matrix.md",
  "07-design-document.md",
];

function validateTrafficLight(filePath, text, reportFn = warn) {
  const hasGreen = text.includes("✅");
  const hasYellow = text.includes("⚠️");
  const hasRed = text.includes("❌");
  if (!hasGreen || !hasYellow || !hasRed) {
    const missing = [];
    if (!hasGreen) missing.push("✅");
    if (!hasYellow) missing.push("⚠️");
    if (!hasRed) missing.push("❌");
    reportFn(
      `${filePath} should contain traffic-light indicators (missing: ${missing.join(", ")}).`,
      { filePath, line: 1 },
    );
  }
}

const COLLAPSIBLE_TEMPLATES = [
  "01-requirements.md",
  "02-architecture-assessment.md",
  "03-des-cost-estimate.md",
  "04-preflight-check.md",
  "05-implementation-reference.md",
  "06-deployment-summary.md",
  "07-ab-cost-estimate.md",
  "07-backup-dr-plan.md",
  "07-compliance-matrix.md",
  "07-design-document.md",
  "07-operations-runbook.md",
];

function validateCollapsibleBlocks(filePath, text, reportFn = warn) {
  if (!text.includes("<details>")) {
    reportFn(`${filePath} should contain collapsible <details> blocks.`, {
      filePath,
      line: 1,
    });
  }
}

function validateTemplate(artifactName) {
  const templatePath = TEMPLATES[artifactName];

  if (!exists(templatePath)) {
    error(`Missing template file: ${templatePath}`, {
      filePath: templatePath,
      line: 1,
    });
    return;
  }

  const text = readText(templatePath);
  const h2 = extractH2Headings(text);
  const required = ARTIFACT_HEADINGS[artifactName];
  const coreFound = h2.filter((h) => required.includes(h));

  if (coreFound.length !== required.length) {
    const missing = required.filter((r) => !coreFound.includes(r));
    error(
      `Template ${templatePath} is missing required H2 headings: ${missing.join(
        ", ",
      )}. Fix: Copy exact headings from the artifact template or run 'npm run fix:artifacts -- <file> --apply'.`,
      { filePath: templatePath, line: 1 },
    );
    return;
  }

  for (let i = 0; i < required.length; i += 1) {
    if (coreFound[i] !== required[i]) {
      error(
        `Template ${templatePath} has headings out of order. Expected '${
          required[i]
        }' at position ${i + 1}, found '${coreFound[i]}'.`,
        { filePath: templatePath, line: 1 },
      );
      break;
    }
  }

  const allowed = [...required, ...(OPTIONAL_ALLOWED[artifactName] || [])];
  const extraH2 = h2.filter((h) => !allowed.includes(h));
  const META_HEADINGS = ["## Template Instructions", "## Required Structure"];
  const trueExtras = extraH2.filter((h) => !META_HEADINGS.includes(h));
  if (trueExtras.length > 0) {
    warn(
      `Template ${templatePath} contains extra H2 headings: ${trueExtras.join(
        ", ",
      )}`,
      { filePath: templatePath, line: 1 },
    );
  }

  if (COST_ESTIMATE_ARTIFACTS.includes(artifactName)) {
    validateCostDistribution(templatePath, text);
  }

  validateDiagramArtifactReferences(templatePath, artifactName, text, error);

  if (MERMAID_REQUIRED_TEMPLATES.includes(artifactName)) {
    validateMermaidPresence(templatePath, text, error);
  }
  if (TRAFFIC_LIGHT_TEMPLATES.includes(artifactName)) {
    validateTrafficLight(templatePath, text, error);
  }
  if (COLLAPSIBLE_TEMPLATES.includes(artifactName)) {
    validateCollapsibleBlocks(templatePath, text, error);
  }

  validateStandardComponents(templatePath, text);
}

function validateAgentLinks() {
  for (const [artifactName, agentPath] of Object.entries(AGENTS)) {
    if (!agentPath) continue;
    if (agentPath === CONSOLIDATED_SKILL) continue;

    if (!exists(agentPath)) {
      error(`Missing agent file: ${agentPath}`, {
        filePath: agentPath,
        line: 1,
        title: TITLE_MISSING,
      });
      continue;
    }

    const agentText = readText(agentPath);
    const templatePath = TEMPLATES[artifactName];

    const relativeTemplatePath = path.relative(
      path.dirname(agentPath),
      templatePath,
    );

    const refsTemplate = agentText.includes(relativeTemplatePath);
    const refsSkill =
      agentText.includes("azure-artifacts") ||
      agentText.includes("azure-defaults");

    if (!refsTemplate && !refsSkill) {
      error(
        `Agent ${agentPath} must reference template ${relativeTemplatePath} or azure-artifacts skill. Fix: Add 'Read .github/skills/azure-artifacts/SKILL.md' to the agent body.`,
        { filePath: agentPath, line: 1 },
      );
    }
  }
}

function validateNoEmbeddedSkeletons() {
  for (const [artifactName, agentPath] of Object.entries(AGENTS)) {
    if (!agentPath || !exists(agentPath)) continue;
    if (agentPath === CONSOLIDATED_SKILL) continue;

    const text = readText(agentPath);
    const required = ARTIFACT_HEADINGS[artifactName];

    const blocks = extractFencedBlocks(text);

    for (const block of blocks) {
      const foundInBlock = required.filter((h) => block.includes(h));
      if (foundInBlock.length >= 3) {
        error(
          `Agent ${agentPath} appears to embed a ${artifactName} skeleton (found ${foundInBlock.length} headings in a fenced block). Fix: Remove the embedded H2 skeleton; agents should reference the azure-artifacts skill instead.`,
          { filePath: agentPath, line: 1 },
        );
        break;
      }
    }
  }
}

function validateStandardsReference() {
  if (!exists(STANDARD_DOC)) {
    warn(`Standards file not found: ${STANDARD_DOC}`, {
      filePath: STANDARD_DOC,
      line: 1,
      title: TITLE_MISSING,
    });
    return;
  }

  const text = readText(STANDARD_DOC);

  if (!text.includes("template") && !text.includes(".template.md")) {
    warn(
      `Standards file ${STANDARD_DOC} should reference template-first approach`,
      { filePath: STANDARD_DOC, line: 1 },
    );
  }
}

function validateGovernanceDiscovery(relPath, text, reportFn = error) {
  const discoverySourceMatch = text.match(
    /## (?:🔍\s*)?Discovery Source[\s\S]*?(?=##|$)/,
  );
  if (!discoverySourceMatch) {
    reportFn(
      `Governance constraints ${relPath} missing Discovery Source section content`,
      { filePath: relPath, line: 1, title: "Governance Discovery Missing" },
    );
    return;
  }

  const discoveryContent = discoverySourceMatch[0];

  const hasQueryResults =
    /\d+\s*(policies|tags|constraints)\s*discovered/i.test(discoveryContent);
  const hasTimestamp = /\d{4}-\d{2}-\d{2}|T\d{2}:\d{2}/i.test(discoveryContent);

  const hasPlaceholders = /\{X\}|\{subscription|UNVERIFIED/i.test(
    discoveryContent,
  );

  if (hasPlaceholders) {
    reportFn(
      `Governance constraints ${relPath} contains placeholder values - constraints may be assumed, not discovered`,
      { filePath: relPath, line: 1, title: "Governance Discovery Incomplete" },
    );
  }

  if (!hasQueryResults && !hasTimestamp) {
    warn(
      `Governance constraints ${relPath} may not have been discovered from Azure Resource Graph (no query results or timestamps found)`,
      { filePath: relPath, line: 1, title: "Governance Discovery Unverified" },
    );
  }
}

/**
 * Check for duplicate H1 headers — indicates a resumed artifact with
 * appended duplicate body content that needs delete-and-recreate.
 */
function validateNoDuplicateH1(relPath) {
  if (!exists(relPath)) return;
  const text = readText(relPath);
  const h1Matches = text.match(/^# .+$/gm) || [];
  if (h1Matches.length > 1) {
    error(
      `Artifact ${relPath} has ${h1Matches.length} H1 headers — likely a resumed artifact with duplicate body. Fix: Delete and recreate the file.`,
      { filePath: relPath, line: 1 },
    );
  }
}

function validateArtifactCompliance(relPath) {
  const basename = path.basename(relPath);

  const artifactType = Object.keys(ARTIFACT_HEADINGS).find((key) =>
    basename.endsWith(key),
  );

  if (!artifactType) return;

  const strictness =
    GLOBAL_STRICTNESS || ARTIFACT_STRICTNESS[artifactType] || "standard";

  if (!exists(relPath)) return;

  const text = readText(relPath);
  const h2 = extractH2Headings(text);
  const required = ARTIFACT_HEADINGS[artifactType];
  const anchor = required[required.length - 1];
  const optionals = OPTIONAL_ALLOWED[artifactType] || [];

  const anchorPos = h2.indexOf(anchor);

  const reportFn = strictness === "standard" ? error : warn;

  const missing = required.filter((h) => !h2.includes(h));
  if (missing.length > 0) {
    reportFn(
      `Artifact ${relPath} is missing required H2 headings: ${missing.join(
        ", ",
      )}. Fix: Copy exact headings from the template or run 'npm run fix:artifacts -- ${relPath} --apply'.`,
      { filePath: relPath, line: 1 },
    );
  }

  const presentRequired = required.filter((h) => h2.includes(h));
  for (let i = 0; i < presentRequired.length - 1; i += 1) {
    const currentPos = h2.indexOf(presentRequired[i]);
    const nextPos = h2.indexOf(presentRequired[i + 1]);
    if (currentPos > nextPos) {
      reportFn(
        `Artifact ${relPath} has required headings out of order: '${
          presentRequired[i]
        }' should come before '${presentRequired[i + 1]}'. Fix: Reorder headings to match: ${required.join(" → ")}.`,
        { filePath: relPath, line: 1 },
      );
      break;
    }
  }

  if (anchorPos !== -1) {
    for (const optional of optionals) {
      const optPos = h2.indexOf(optional);
      if (optPos !== -1 && optPos < anchorPos) {
        warn(
          `Artifact ${relPath} has optional heading '${optional}' before anchor '${anchor}' (consider moving it).`,
          { filePath: relPath, line: 1 },
        );
      }
    }
  }

  const recognized = [...required, ...optionals];
  const extras = h2.filter((h) => !recognized.includes(h));
  if (extras.length > 0 && strictness === "standard") {
    warn(
      `Artifact ${relPath} contains extra H2 headings: ${extras.join(", ")}`,
      { filePath: relPath, line: 1 },
    );
  }

  if (artifactType === "04-governance-constraints.md") {
    validateGovernanceDiscovery(relPath, text, reportFn);
  }

  if (COST_ESTIMATE_ARTIFACTS.includes(artifactType)) {
    validateCostDistribution(relPath, text, warn);
  }

  if (artifactType === "04-implementation-plan.md") {
    validateDiagramArtifactReferences(relPath, artifactType, text, reportFn);
    validateDiagramArtifactFiles(relPath, artifactType, reportFn);
  }

  validateStandardComponents(relPath, text, warn);

  if (MERMAID_REQUIRED_TEMPLATES.includes(artifactType)) {
    validateMermaidPresence(relPath, text, warn);
  }
  if (TRAFFIC_LIGHT_TEMPLATES.includes(artifactType)) {
    validateTrafficLight(relPath, text, warn);
  }
  if (COLLAPSIBLE_TEMPLATES.includes(artifactType)) {
    validateCollapsibleBlocks(relPath, text, warn);
  }
}

function findArtifacts() {
  const baseDir = path.resolve(process.cwd(), "agent-output");
  if (!fs.existsSync(baseDir)) return [];

  const artifactPatterns = Object.keys(ARTIFACT_HEADINGS);
  const entries = fs.readdirSync(baseDir, {
    withFileTypes: true,
    recursive: true,
  });

  return entries
    .filter((entry) => {
      if (!entry.isFile()) return false;
      if (!artifactPatterns.some((p) => entry.name.endsWith(p))) return false;
      const dir = entry.parentPath ?? entry.path;
      // Skip the top-level agent-output/README.md
      if (entry.name === "README.md" && dir === baseDir) return false;
      // Skip historical baseline snapshots
      const rel = path.relative(baseDir, dir);
      if (rel.startsWith("_baselines")) return false;
      return true;
    })
    .map((entry) => {
      const dir = entry.parentPath ?? entry.path;
      return path.relative(process.cwd(), path.join(dir, entry.name));
    });
}

function runTemplateValidation() {
  console.log("═══ Part 2: Artifact Template Compliance ═══\n");

  const modeDesc = GLOBAL_STRICTNESS
    ? `global: ${GLOBAL_STRICTNESS}`
    : "per-artifact";
  console.log(`Strictness: ${modeDesc}\n`);

  console.log("Step 1: Validating templates...");
  for (const artifactName of Object.keys(ARTIFACT_HEADINGS)) {
    validateTemplate(artifactName);
  }

  console.log("Step 2: Validating agent links...");
  validateAgentLinks();

  console.log("Step 3: Checking for embedded skeletons...");
  validateNoEmbeddedSkeletons();

  console.log("Step 4: Checking standards reference...");
  validateStandardsReference();

  console.log("Step 5: Validating agent-output artifacts...");
  const artifacts = findArtifacts();
  console.log(`  Found ${artifacts.length} artifact(s) in agent-output/\n`);
  for (const artifact of artifacts) {
    validateArtifactCompliance(artifact);
  }

  console.log(
    "Step 6: Checking for duplicate H1 headers (resume integrity)...",
  );
  for (const artifact of artifacts) {
    validateNoDuplicateH1(artifact);
  }

  console.log(`\n${"=".repeat(50)}`);
  if (hasHardFailure) {
    console.log("❌ Artifact template validation FAILED");
    return 1;
  }
  if (hasWarning) {
    console.log("⚠️  Artifact validation passed with warnings");
    return 0;
  }
  console.log("✅ All artifact template checks passed");
  return 0;
}

// ============================================================================
// Part 3: Artifact H2 Auto-Fix (was fix-artifact-h2.mjs, --fix mode)
// ============================================================================

const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0E}\u{FE0F}]+\s*/gu;
function normalizeH2(heading) {
  return heading
    .replace(EMOJI_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const CANONICAL_MAP = Object.fromEntries(
  Object.entries(ARTIFACT_HEADINGS).map(([artifact, headings]) => [
    artifact,
    new Map(headings.map((h) => [normalizeH2(h), h])),
  ]),
);

function resolveCanonical(artifactType, plainHeading) {
  const map = CANONICAL_MAP[artifactType];
  if (!map) return plainHeading;
  return map.get(normalizeH2(plainHeading)) || plainHeading;
}

const HEADING_FIXES = {
  "## Outputs": "## Outputs (Expected)",
  "## Output": "## Outputs (Expected)",
  "## Expected Outputs": "## Outputs (Expected)",
  "## Deployment Outputs": "## Outputs (Expected)",
  "## Post-Deployment Configuration": "## Post-Deployment Tasks",
  "## Deployment Summary": "## Preflight Validation",
  "## Project Summary": "## 3. Project Summary",
  "## Document Package Contents": "## 1. Document Package Contents",
  "## Source Artifacts": "## 2. Source Artifacts",
  "## Related Resources": "## 4. Related Resources",
  "## Quick Links": "## 5. Quick Links",
  "## Resource Details": "## Resource Listing",
  "## Resources": "## Resource Listing",
  "## Introduction": "## 1. Introduction",
  "## 2. Architecture Overview": "## 2. Azure Architecture Overview",
  "## 3. Network Architecture": "## 3. Networking",
  "## 4. Storage Architecture": "## 4. Storage",
  "## 5. Compute Architecture": "## 5. Compute",
  "## 6. Security Architecture": "## 6. Identity & Access",
  "## 7. Compliance & Governance": "## 7. Security & Compliance",
  "## 8. Operations & Monitoring": "## 8. Backup & Disaster Recovery",
  "## 9. Cost Management": "## 9. Management & Monitoring",
  "## 10. Deployment & CI/CD": "## 10. Appendix",
  "## 3. Common Operational Procedures": "## 3. Common Procedures",
  "## 6. Contact Information": "## 6. Change Log",
  "## 3. Disaster Recovery Architecture": "## 3. Disaster Recovery Procedures",
  "## 4. Recovery Procedures": "## 4. Testing Schedule",
  "## 5. Failover Procedures": "## 5. Communication Plan",
  "## 6. Testing & Validation": "## 6. Roles and Responsibilities",
  "## 8. Roles & Responsibilities": "## 8. Recovery Runbooks",
  "## 9. Dependencies & External Services": "## 9. Appendix",
  "## 9. Improvement Roadmap": "## 9. Appendix",
  "## Overview": "## IaC Templates Location",
  "## Resource Mapping": "## Resources Created",
};

function headingMatch(actual, required) {
  return actual === required || normalizeH2(actual) === normalizeH2(required);
}

function getArtifactType(filePath) {
  const basename = path.basename(filePath);
  if (ARTIFACT_HEADINGS[basename]) return basename;
  for (const key of Object.keys(ARTIFACT_HEADINGS)) {
    if (basename.endsWith(key)) return key;
  }
  return null;
}

function extractH2HeadingsFromContent(content) {
  return content.match(/^## .+$/gm) || [];
}

function analyzeArtifact(filePath) {
  const artifactType = getArtifactType(filePath);
  if (!artifactType) {
    return { error: `Unknown artifact type: ${path.basename(filePath)}` };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const actualH2s = extractH2HeadingsFromContent(content);
  const requiredH2s = ARTIFACT_HEADINGS[artifactType];

  const missing = requiredH2s.filter(
    (h) => !actualH2s.some((a) => headingMatch(a, h)),
  );
  const extra = actualH2s.filter(
    (h) =>
      !requiredH2s.some((r) => headingMatch(h, r)) &&
      normalizeH2(h) !== "## References",
  );

  const fixable = [];
  for (const actual of extra) {
    const normalized = normalizeH2(actual);
    const fixTarget = HEADING_FIXES[actual] || HEADING_FIXES[normalized];
    if (fixTarget) {
      fixable.push({
        from: actual,
        to: resolveCanonical(artifactType, fixTarget),
      });
    }
  }

  return {
    artifactType,
    filePath,
    actualH2s,
    requiredH2s,
    missing,
    extra,
    fixable,
    isCompliant: missing.length === 0,
  };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyFixes(filePath, analysis) {
  if (analysis.fixable.length === 0) {
    console.log("  No auto-fixable issues found.");
    return false;
  }

  let content = fs.readFileSync(filePath, "utf-8");
  let modified = false;

  for (const fix of analysis.fixable) {
    const regex = new RegExp(`^${escapeRegex(fix.from)}$`, "gm");
    if (content.match(regex)) {
      content = content.replace(regex, fix.to);
      console.log(`  ✓ Fixed: "${fix.from}" → "${fix.to}"`);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✓ File updated: ${filePath}`);
  }

  return modified;
}

function runFixMode(filePaths) {
  console.log(`\n🔧 Artifact H2 Auto-Fixer\n`);

  const applyMode = filePaths.includes("--apply");
  const actualFiles = filePaths.filter((a) => !a.startsWith("--"));

  if (actualFiles.length === 0) {
    console.log(`
Usage:
  npm run fix:artifacts -- <artifact-path> [--apply]

Options:
  --apply    Actually modify files (without this, only shows what would change)
`);
    process.exit(0);
  }

  let totalIssues = 0;
  let fixedCount = 0;

  for (const filePath of actualFiles) {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠ File not found: ${filePath}`);
      continue;
    }

    const analysis = analyzeArtifact(filePath);

    if (analysis.error) {
      console.log(`⏭ Skipping: ${analysis.error}`);
      continue;
    }

    console.log(`📄 ${path.basename(filePath)} (${analysis.artifactType})`);

    if (analysis.isCompliant && analysis.extra.length === 0) {
      console.log(`  ✅ Compliant`);
      continue;
    }

    if (analysis.missing.length > 0) {
      console.log(`  ❌ Missing H2 headings:`);
      for (const h of analysis.missing) {
        console.log(`     - ${h}`);
      }
      totalIssues += analysis.missing.length;
    }

    if (analysis.extra.length > 0) {
      console.log(`  ⚠ Extra H2 headings (not in template):`);
      for (const h of analysis.extra) {
        const fix = analysis.fixable.find((f) => f.from === h);
        const fixHint = fix ? ` → "${fix.to}"` : "";
        console.log(`     - ${h}${fixHint}`);
      }
      totalIssues += analysis.extra.length;
    }

    if (applyMode && analysis.fixable.length > 0) {
      const fixed = applyFixes(filePath, analysis);
      if (fixed) fixedCount++;
    }

    console.log("");
  }

  console.log("---");
  if (totalIssues === 0) {
    console.log("✅ All artifacts are compliant!");
  } else if (applyMode) {
    console.log(
      `Fixed ${fixedCount} file(s). ${totalIssues - fixedCount} issue(s) require manual fix.`,
    );
  } else {
    console.log(
      `Found ${totalIssues} issue(s). Run with --apply to auto-fix where possible.`,
    );
  }
}

// ============================================================================
// Main entry point
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  // --fix mode: run the auto-fixer
  if (args.includes("--fix")) {
    const fixArgs = args.filter((a) => a !== "--fix");
    runFixMode(fixArgs);
    process.exit(0);
  }

  // Default: run all validations
  console.log("🔍 Artifact Validators (consolidated)\n");

  const syncResult = runH2Sync();
  const templateResult = runTemplateValidation();

  const exitCode = Math.max(syncResult, templateResult);

  if (exitCode > 0) {
    process.exit(1);
  }
}

main();
