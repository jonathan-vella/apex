#!/usr/bin/env node

/**
 * Auto-Fix Artifact H2 Structure
 *
 * This script analyzes artifacts and suggests/applies fixes to match template structure.
 *
 * Usage:
 *   node scripts/fix-artifact-h2.mjs <artifact-path> [--apply]
 *   node scripts/fix-artifact-h2.mjs agent-output/myproject/06-deployment-summary.md --apply
 *
 * Without --apply: Shows what would be fixed
 * With --apply: Actually modifies the file
 */

import fs from "node:fs";
import path from "node:path";
import { ARTIFACT_HEADINGS } from "./validate-artifact-templates.mjs";

// Strip emoji prefixes for comparison (handles variation selectors)
const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0E}\u{FE0F}]+\s*/gu;
function normalizeH2(heading) {
  return heading
    .replace(EMOJI_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Reverse lookup: normalized text → canonical emoji heading, per artifact type
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

// Agent drift patterns: wrong text → correct plain text
// Resolved to canonical emoji headings at match time via CANONICAL_MAP
const HEADING_FIXES = {
  // 06-deployment-summary.md variants
  "## Outputs": "## Outputs (Expected)",
  "## Output": "## Outputs (Expected)",
  "## Expected Outputs": "## Outputs (Expected)",
  "## Deployment Outputs": "## Outputs (Expected)",
  "## Post-Deployment Configuration": "## Post-Deployment Tasks",
  "## Deployment Summary": "## Preflight Validation",
  // 07-documentation-index.md variants
  "## Project Summary": "## 3. Project Summary",
  "## Document Package Contents": "## 1. Document Package Contents",
  "## Source Artifacts": "## 2. Source Artifacts",
  "## Related Resources": "## 4. Related Resources",
  "## Quick Links": "## 5. Quick Links",
  // 07-resource-inventory.md variants
  "## Resource Details": "## Resource Listing",
  "## Resources": "## Resource Listing",
  // 07-design-document.md variants
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
  // 07-operations-runbook.md variants
  "## 3. Common Operational Procedures": "## 3. Common Procedures",
  // NOTE: "## 5. Monitoring & Alerting" is NOT mapped — monitoring content
  // belongs under "## 4. Maintenance Windows" as a subsection (### 4.3 KPIs),
  // not as a rename to "## 5. Contacts & Escalation". Manual restructuring required.
  "## 6. Contact Information": "## 6. Change Log",
  // 07-backup-dr-plan.md variants
  "## 3. Disaster Recovery Architecture": "## 3. Disaster Recovery Procedures",
  "## 4. Recovery Procedures": "## 4. Testing Schedule",
  "## 5. Failover Procedures": "## 5. Communication Plan",
  "## 6. Testing & Validation": "## 6. Roles and Responsibilities",
  "## 8. Roles & Responsibilities": "## 8. Recovery Runbooks",
  "## 9. Dependencies & External Services": "## 9. Appendix",
  "## 9. Improvement Roadmap": "## 9. Appendix",
  // 05-implementation-reference.md variants
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

function extractH2Headings(content) {
  return content.match(/^## .+$/gm) || [];
}

function analyzeArtifact(filePath) {
  const artifactType = getArtifactType(filePath);
  if (!artifactType) {
    return { error: `Unknown artifact type: ${path.basename(filePath)}` };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const actualH2s = extractH2Headings(content);
  const requiredH2s = ARTIFACT_HEADINGS[artifactType];

  const missing = requiredH2s.filter(
    (h) => !actualH2s.some((a) => headingMatch(a, h)),
  );
  const extra = actualH2s.filter(
    (h) =>
      !requiredH2s.some((r) => headingMatch(h, r)) &&
      normalizeH2(h) !== "## References",
  );

  // Resolve fixable headings through HEADING_FIXES → canonical lookup
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

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main() {
  const args = process.argv.slice(2);
  const applyMode = args.includes("--apply");
  const helpMode = args.includes("--help") || args.includes("-h");
  const filePaths = args.filter((a) => !a.startsWith("--"));

  if (helpMode || filePaths.length === 0) {
    console.log(`
Artifact H2 Auto-Fixer

Usage:
  node scripts/fix-artifact-h2.mjs <artifact-path> [--apply]
  node scripts/fix-artifact-h2.mjs agent-output/myproject/*.md --apply

Options:
  --apply    Actually modify files (without this, only shows what would change)
  --help     Show this help

Examples:
  # Analyze a single file
  node scripts/fix-artifact-h2.mjs agent-output/e2e-conductor-test/06-deployment-summary.md

  # Fix a single file
  node scripts/fix-artifact-h2.mjs agent-output/e2e-conductor-test/06-deployment-summary.md --apply

  # Analyze all artifacts in a project
  find agent-output/e2e-conductor-test -name "*.md" | xargs node scripts/fix-artifact-h2.mjs
`);
    process.exit(0);
  }

  console.log(`\n🔧 Artifact H2 ${applyMode ? "Auto-Fixer" : "Analyzer"}\n`);

  let totalIssues = 0;
  let fixedCount = 0;

  for (const filePath of filePaths) {
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

main();
