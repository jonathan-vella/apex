import fs from "node:fs";
import path from "node:path";

// Artifact H2 structure definitions
// Core artifacts (01, 02, 04, 06) use "standard" strictness
// Wave 2 artifacts (05, 07-*) use "relaxed" strictness
const ARTIFACT_HEADINGS = {
  // Core artifacts (standard strictness)
  "01-requirements.md": [
    "## Project Overview",
    "## Functional Requirements",
    "## Non-Functional Requirements (NFRs)",
    "## Compliance & Security Requirements",
    "## Budget",
    "## Operational Requirements",
    "## Regional Preferences",
    "## Summary for Architecture Assessment",
  ],
  "02-architecture-assessment.md": [
    "## Requirements Validation ✅",
    "## Executive Summary",
    "## WAF Pillar Assessment",
    "## Resource SKU Recommendations",
    "## Architecture Decision Summary",
    "## Implementation Handoff",
    "## Approval Gate",
  ],
  "04-implementation-plan.md": [
    "## Overview",
    "## Resource Inventory",
    "## Module Structure",
    "## Implementation Tasks",
    "## Deployment Phases",
    "## Dependency Graph",
    "## Runtime Flow Diagram",
    "## Naming Conventions",
    "## Security Configuration",
    "## Estimated Implementation Time",
    "## Approval Gate",
  ],
  "04-governance-constraints.md": [
    "## Discovery Source",
    "## Azure Policy Compliance",
    "## Plan Adaptations Based on Policies",
    "## Deployment Blockers",
    "## Required Tags",
    "## Security Policies",
    "## Cost Policies",
    "## Network Policies",
  ],
  "04-preflight-check.md": [
    "## Purpose",
    "## AVM Schema Validation Results",
    "## Parameter Type Analysis",
    "## Region Limitations Identified",
    "## Pitfalls Checklist",
    "## Ready for Implementation",
  ],
  "06-deployment-summary.md": [
    "## Preflight Validation",
    "## Deployment Details",
    "## Deployed Resources",
    "## Outputs (Expected)",
    "## To Actually Deploy",
    "## Post-Deployment Tasks",
  ],
  // Wave 2 artifacts (relaxed strictness)
  "05-implementation-reference.md": [
    "## Bicep Templates Location",
    "## File Structure",
    "## Validation Status",
    "## Resources Created",
    "## Deployment Instructions",
    "## Key Implementation Notes",
  ],
  "07-design-document.md": [
    "## 1. Introduction",
    "## 2. Azure Architecture Overview",
    "## 3. Networking",
    "## 4. Storage",
    "## 5. Compute",
    "## 6. Identity & Access",
    "## 7. Security & Compliance",
    "## 8. Backup & Disaster Recovery",
    "## 9. Management & Monitoring",
    "## 10. Appendix",
  ],
  "07-operations-runbook.md": [
    "## Quick Reference",
    "## 1. Daily Operations",
    "## 2. Incident Response",
    "## 3. Common Procedures",
    "## 4. Maintenance Windows",
    "## 5. Contacts & Escalation",
    "## 6. Change Log",
  ],
  "07-resource-inventory.md": ["## Summary", "## Resource Listing"],
  "07-backup-dr-plan.md": [
    "## Executive Summary",
    "## 1. Recovery Objectives",
    "## 2. Backup Strategy",
    "## 3. Disaster Recovery Procedures",
    "## 4. Testing Schedule",
    "## 5. Communication Plan",
    "## 6. Roles and Responsibilities",
    "## 7. Dependencies",
    "## 8. Recovery Runbooks",
    "## 9. Appendix",
  ],
  "07-compliance-matrix.md": [
    "## Executive Summary",
    "## 1. Control Mapping",
    "## 2. Gap Analysis",
    "## 3. Evidence Collection",
    "## 4. Audit Trail",
    "## 5. Remediation Tracker",
    "## 6. Appendix",
  ],
  "07-documentation-index.md": [
    "## 1. Document Package Contents",
    "## 2. Source Artifacts",
    "## 3. Project Summary",
    "## 4. Related Resources",
    "## 5. Quick Links",
  ],
  // Cost-estimate artifacts (shared structure for design + as-built)
  "03-des-cost-estimate.md": [
    "## 💰 Cost At-a-Glance",
    "## ✅ Decision Summary",
    "## 🔁 Requirements → Cost Mapping",
    "## 📊 Top 5 Cost Drivers",
    "## Architecture Overview",
    "## 🧾 What We Are Not Paying For (Yet)",
    "## ⚠️ Cost Risk Indicators",
    "## 🎯 Quick Decision Matrix",
    "## 💰 Savings Opportunities",
    "## Detailed Cost Breakdown",
  ],
  "07-ab-cost-estimate.md": [
    "## 💰 Cost At-a-Glance",
    "## ✅ Decision Summary",
    "## 🔁 Requirements → Cost Mapping",
    "## 📊 Top 5 Cost Drivers",
    "## Architecture Overview",
    "## 🧾 What We Are Not Paying For (Yet)",
    "## ⚠️ Cost Risk Indicators",
    "## 🎯 Quick Decision Matrix",
    "## 💰 Savings Opportunities",
    "## Detailed Cost Breakdown",
  ],
  // Project README (content headings only — template has meta-headings)
  "README.md": [
    "## 📋 Project Summary",
    "## ✅ Workflow Progress",
    "## 🏛️ Architecture",
    "## 📄 Generated Artifacts",
    "## 🔗 Related Resources",
  ],
};

// Per-artifact strictness configuration
// "standard" = fail on issues, "relaxed" = warn on issues
const ARTIFACT_STRICTNESS = {
  // Core artifacts - standard strictness (established templates)
  "01-requirements.md": "standard",
  "02-architecture-assessment.md": "standard",
  "04-implementation-plan.md": "standard",
  "04-governance-constraints.md": "standard",
  "04-preflight-check.md": "standard",
  "05-implementation-reference.md": "standard",
  "06-deployment-summary.md": "standard",
  // Wave 2 artifacts - ratcheted to standard after v3.9.0 restructuring
  "07-design-document.md": "standard",
  "07-operations-runbook.md": "standard",
  "07-resource-inventory.md": "standard",
  "07-backup-dr-plan.md": "standard",
  "07-compliance-matrix.md": "standard",
  "07-documentation-index.md": "standard",
  "03-des-cost-estimate.md": "standard",
  "07-ab-cost-estimate.md": "standard",
  "README.md": "relaxed",
};

// Optional sections that can appear after the anchor (last invariant H2)
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
};

const TITLE_DRIFT = "Artifact Template Drift";
const TITLE_MISSING = "Missing Template or Agent";

// Global strictness override (env var) - if not set, use per-artifact config
const GLOBAL_STRICTNESS = process.env.STRICTNESS;

// Core artifacts validated by agents/skills
// The azure-artifacts skill intentionally embeds template H2 structures
// (consolidates all 16 templates for agent convenience). Skip it from
// agent-link and embedded-skeleton checks.
const CONSOLIDATED_SKILL = ".github/skills/azure-artifacts/SKILL.md";

const AGENTS = {
  "01-requirements.md": ".github/agents/requirements.agent.md",
  "02-architecture-assessment.md": ".github/agents/architect.agent.md",
  "04-implementation-plan.md": ".github/agents/bicep-plan.agent.md",
  "04-governance-constraints.md": ".github/agents/bicep-plan.agent.md",
  "04-preflight-check.md": ".github/agents/bicep-code.agent.md",
  "06-deployment-summary.md": ".github/agents/deploy.agent.md",
  "05-implementation-reference.md": ".github/agents/bicep-code.agent.md",
  "07-design-document.md": ".github/skills/azure-artifacts/SKILL.md",
  "07-operations-runbook.md": ".github/skills/azure-artifacts/SKILL.md",
  "07-resource-inventory.md": ".github/skills/azure-artifacts/SKILL.md",
  "07-backup-dr-plan.md": ".github/skills/azure-artifacts/SKILL.md",
  "07-compliance-matrix.md": ".github/skills/azure-artifacts/SKILL.md",
  "07-documentation-index.md": ".github/skills/azure-artifacts/SKILL.md",
  "03-des-cost-estimate.md": ".github/agents/architect.agent.md",
  "07-ab-cost-estimate.md": ".github/skills/azure-artifacts/SKILL.md",
  "README.md": null,
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
      image: "./03-des-diagram.png",
      source: "./03-des-diagram.py",
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

  for (const expected of expectedReferences) {
    if (!text.includes(expected.image)) {
      reportFn(
        `${filePath} is missing required diagram image reference: ${expected.image}`,
        { filePath, line: 1 },
      );
    }

    if (!text.includes(expected.source)) {
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

/**
 * Validates standard visual components that all templates define:
 * badge row, collapsible TOC, attribution header, and navigation table.
 * PROJECT-README uses a different layout — skip component checks for it.
 */
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

  if (!text.includes("📑 Table of Contents")) {
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

// Artifacts that should contain at least one Mermaid diagram (Phase 3)
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

/**
 * Validates that templates requiring Mermaid diagrams contain at least one
 * fenced mermaid block. Advisory for agent-output (warn), enforced for templates (error).
 */
function validateMermaidPresence(filePath, text, reportFn = warn) {
  if (!/```mermaid/.test(text)) {
    reportFn(`${filePath} should contain at least one Mermaid diagram block.`, {
      filePath,
      line: 1,
    });
  }
}

// Artifacts that should contain traffic-light status indicators (Phase 3)
const TRAFFIC_LIGHT_TEMPLATES = [
  "02-architecture-assessment.md",
  "04-governance-constraints.md",
  "05-implementation-reference.md",
  "06-deployment-summary.md",
  "07-ab-cost-estimate.md",
  "07-compliance-matrix.md",
  "07-design-document.md",
];

/**
 * Validates that templates requiring traffic-light indicators contain
 * the expected status emoji set (✅/⚠️/❌).
 */
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

// Artifacts that should contain collapsible <details> blocks (Phase 3)
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

/**
 * Validates that templates requiring collapsible sections contain <details> blocks.
 */
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

  // Check all required headings are present
  if (coreFound.length !== required.length) {
    const missing = required.filter((r) => !coreFound.includes(r));
    error(
      `Template ${templatePath} is missing required H2 headings: ${missing.join(
        ", ",
      )}`,
      { filePath: templatePath, line: 1 },
    );
    return;
  }

  // Check order of required headings
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

  // Check for extra headings (warn only)
  const allowed = [...required, ...(OPTIONAL_ALLOWED[artifactName] || [])];
  const extraH2 = h2.filter((h) => !allowed.includes(h));
  // PROJECT-README has meta-headings (Template Instructions, Required Structure)
  // that are expected in the template but not in generated output
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

  // Cost-estimate templates require cost distribution table or chart image
  if (COST_ESTIMATE_ARTIFACTS.includes(artifactName)) {
    validateCostDistribution(templatePath, text);
  }

  validateDiagramArtifactReferences(templatePath, artifactName, text, error);

  // Phase 3 visual element checks (error for templates)
  if (MERMAID_REQUIRED_TEMPLATES.includes(artifactName)) {
    validateMermaidPresence(templatePath, text, error);
  }
  if (TRAFFIC_LIGHT_TEMPLATES.includes(artifactName)) {
    validateTrafficLight(templatePath, text, error);
  }
  if (COLLAPSIBLE_TEMPLATES.includes(artifactName)) {
    validateCollapsibleBlocks(templatePath, text, error);
  }

  // Validate standard visual components (badges, TOC, attribution, nav)
  validateStandardComponents(templatePath, text);
}

function validateAgentLinks() {
  for (const [artifactName, agentPath] of Object.entries(AGENTS)) {
    if (!agentPath) continue; // Skip if no agent (e.g., Plan or manual)
    if (agentPath === CONSOLIDATED_SKILL) continue; // H2s embedded by design

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

    // Check that agent links to template directly OR via azure-artifacts skill
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
        `Agent ${agentPath} must reference template ${relativeTemplatePath} or azure-artifacts skill`,
        { filePath: agentPath, line: 1 },
      );
    }
  }
}

function validateNoEmbeddedSkeletons() {
  for (const [artifactName, agentPath] of Object.entries(AGENTS)) {
    if (!agentPath || !exists(agentPath)) continue;
    if (agentPath === CONSOLIDATED_SKILL) continue; // H2s embedded by design

    const text = readText(agentPath);
    const required = ARTIFACT_HEADINGS[artifactName];

    // Check for embedded skeleton indicators
    const blocks = extractFencedBlocks(text);

    for (const block of blocks) {
      // Look for multiple required headings appearing in a fenced block
      const foundInBlock = required.filter((h) => block.includes(h));
      if (foundInBlock.length >= 3) {
        error(
          `Agent ${agentPath} appears to embed a ${artifactName} skeleton (found ${foundInBlock.length} headings in a fenced block).`,
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

  // Check that standards reference template-first approach
  if (!text.includes("template") && !text.includes(".template.md")) {
    warn(
      `Standards file ${STANDARD_DOC} should reference template-first approach`,
      { filePath: STANDARD_DOC, line: 1 },
    );
  }
}

function validateArtifactCompliance(relPath) {
  const basename = path.basename(relPath);

  // Check if this is a recognized artifact type
  const artifactType = Object.keys(ARTIFACT_HEADINGS).find((key) =>
    basename.endsWith(key),
  );

  if (!artifactType) {
    return; // Not a recognized artifact, skip
  }

  // Agent-output artifacts use per-artifact strictness from ARTIFACT_STRICTNESS.
  // Override with STRICTNESS=relaxed env var during migration periods.
  const strictness =
    GLOBAL_STRICTNESS || ARTIFACT_STRICTNESS[artifactType] || "standard";

  if (!exists(relPath)) {
    return; // File doesn't exist, skip
  }

  const text = readText(relPath);
  const h2 = extractH2Headings(text);
  const required = ARTIFACT_HEADINGS[artifactType];
  const anchor = required[required.length - 1]; // Last required heading
  const optionals = OPTIONAL_ALLOWED[artifactType] || [];

  // Find positions
  const corePositions = required.map((heading) => h2.indexOf(heading));
  const anchorPos = h2.indexOf(anchor);

  const reportFn = strictness === "standard" ? error : warn;

  // Check all required headings are present
  const missing = required.filter((h) => !h2.includes(h));
  if (missing.length > 0) {
    reportFn(
      `Artifact ${relPath} is missing required H2 headings: ${missing.join(
        ", ",
      )}`,
      { filePath: relPath, line: 1 },
    );
  }

  // Check order of required headings (only those present)
  const presentRequired = required.filter((h) => h2.includes(h));
  for (let i = 0; i < presentRequired.length - 1; i += 1) {
    const currentPos = h2.indexOf(presentRequired[i]);
    const nextPos = h2.indexOf(presentRequired[i + 1]);
    if (currentPos > nextPos) {
      reportFn(
        `Artifact ${relPath} has required headings out of order: '${
          presentRequired[i]
        }' should come before '${presentRequired[i + 1]}'.`,
        { filePath: relPath, line: 1 },
      );
      break;
    }
  }

  // Check optional headings placement (should be after anchor)
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

  // Check for unrecognized headings (warn only in relaxed mode)
  const recognized = [...required, ...optionals];
  const extras = h2.filter((h) => !recognized.includes(h));
  if (extras.length > 0 && strictness === "standard") {
    warn(
      `Artifact ${relPath} contains extra H2 headings: ${extras.join(", ")}`,
      { filePath: relPath, line: 1 },
    );
  }

  // Special validation for governance constraints: check discovery source content
  if (artifactType === "04-governance-constraints.md") {
    validateGovernanceDiscovery(relPath, text, reportFn);
  }

  // Cost-estimate artifacts require cost distribution table or chart image
  // (warn-only for existing agent-output artifacts during transition)
  if (COST_ESTIMATE_ARTIFACTS.includes(artifactType)) {
    validateCostDistribution(relPath, text, warn);
  }

  // Step 4 diagrams are mandatory outputs and enforced by artifact strictness.
  if (artifactType === "04-implementation-plan.md") {
    validateDiagramArtifactReferences(relPath, artifactType, text, reportFn);
    validateDiagramArtifactFiles(relPath, artifactType, reportFn);
  }

  // Validate standard visual components (badges, TOC, attribution, nav)
  // Warn-only for agent-output to avoid blocking pre-existing artifacts
  validateStandardComponents(relPath, text, warn);

  // Phase 3 visual element checks (warn for agent-output)
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

/**
 * Validates that governance constraints were discovered from Azure Resource Graph,
 * not assumed from best practices. This prevents deployment failures due to
 * undiscovered Azure Policy requirements.
 */
function validateGovernanceDiscovery(relPath, text, reportFn = error) {
  // Check for Discovery Source section content (not just heading)
  const discoverySourceMatch = text.match(
    /## Discovery Source[\s\S]*?(?=##|$)/,
  );
  if (!discoverySourceMatch) {
    reportFn(
      `Governance constraints ${relPath} missing Discovery Source section content`,
      { filePath: relPath, line: 1, title: "Governance Discovery Missing" },
    );
    return;
  }

  const discoveryContent = discoverySourceMatch[0];

  // Check for evidence of actual ARG query (not placeholders)
  const hasQueryResults =
    /\d+\s*(policies|tags|constraints)\s*discovered/i.test(discoveryContent);
  const hasTimestamp = /\d{4}-\d{2}-\d{2}|T\d{2}:\d{2}/i.test(discoveryContent);
  const hasSubscription =
    /Subscription.*?[a-f0-9-]{36}|Subscription.*?[A-Za-z]/i.test(
      discoveryContent,
    );

  // Check for placeholder values that indicate assumption-based constraints
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

function findArtifacts() {
  const baseDir = path.resolve(process.cwd(), "agent-output");
  if (!fs.existsSync(baseDir)) return [];

  const matches = [];
  const artifactPatterns = Object.keys(ARTIFACT_HEADINGS);
  const stack = [baseDir];

  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) break;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (
        entry.isFile() &&
        artifactPatterns.some((pattern) => entry.name.endsWith(pattern))
      ) {
        // README.md: only match project-level READMEs (agent-output/{project}/README.md)
        // not the top-level agent-output/README.md
        if (entry.name === "README.md" && dir === baseDir) continue;
        matches.push(path.relative(process.cwd(), full));
      }
    }
  }

  return matches;
}

function main() {
  const modeDesc = GLOBAL_STRICTNESS
    ? `global: ${GLOBAL_STRICTNESS}`
    : "per-artifact";
  console.log(`🔍 Artifact Template Validator (strictness: ${modeDesc})\n`);

  // Step 1: Validate templates exist and have correct structure
  console.log("Step 1: Validating templates...");
  for (const artifactName of Object.keys(ARTIFACT_HEADINGS)) {
    validateTemplate(artifactName);
  }

  // Step 2: Validate agent links to templates
  console.log("Step 2: Validating agent links...");
  validateAgentLinks();

  // Step 3: Validate no embedded skeletons in agents
  console.log("Step 3: Checking for embedded skeletons...");
  validateNoEmbeddedSkeletons();

  // Step 4: Validate standards documentation
  console.log("Step 4: Validating standards documentation...");
  validateStandardsReference();

  // Step 5: Validate actual artifacts in agent-output/
  console.log("Step 5: Validating artifacts in agent-output/...");
  const artifacts = findArtifacts();

  if (artifacts.length === 0) {
    warn("No artifacts found in agent-output/ (expected for new workflow).");
  } else {
    console.log(`   Found ${artifacts.length} artifacts to validate`);
    for (const artifact of artifacts) {
      validateArtifactCompliance(artifact);
    }
  }

  // Report results
  console.log("\n" + "=".repeat(60));
  if (hasHardFailure) {
    console.log("❌ Validation FAILED - hard failures detected");
    process.exit(1);
  } else if (hasWarning) {
    console.log("⚠️  Validation passed with warnings");
  } else {
    console.log("✅ Validation passed - no issues detected");
  }
}

main();
