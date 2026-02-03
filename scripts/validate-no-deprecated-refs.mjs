/**
 * Deprecated References Validator
 *
 * Detects references to removed agents, dead paths, and placeholder text.
 * Helps maintain documentation hygiene after refactoring.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Patterns to detect (case-insensitive where noted)
const DEPRECATED_PATTERNS = [
  // Removed agent file references
  {
    pattern: /\.github\/agents\/diagram\.agent\.md/gi,
    message: "Reference to removed diagram.agent.md (use azure-diagrams skill)",
    severity: "error",
  },
  {
    pattern: /\.github\/agents\/adr\.agent\.md/gi,
    message: "Reference to removed adr.agent.md (use azure-adr skill)",
    severity: "error",
  },
  {
    pattern: /\.github\/agents\/docs\.agent\.md/gi,
    message:
      "Reference to removed docs.agent.md (use azure-workload-docs skill)",
    severity: "error",
  },

  // Dead documentation paths
  {
    pattern: /docs\/guides\//gi,
    message: "Reference to non-existent docs/guides/ folder",
    severity: "error",
  },
  {
    pattern: /docs\/reference\//gi,
    message: "Reference to non-existent docs/reference/ folder",
    severity: "error",
  },

  // Agent mentions that should be skills (in prose, not agent definitions)
  {
    pattern: /@diagram\s+agent/gi,
    message: "Reference to @diagram agent (removed - use azure-diagrams skill)",
    severity: "warn",
  },
  {
    pattern: /@adr\s+agent/gi,
    message: "Reference to @adr agent (removed - use azure-adr skill)",
    severity: "warn",
  },
  {
    pattern: /@docs\s+agent/gi,
    message:
      "Reference to @docs agent (removed - use azure-workload-docs skill)",
    severity: "warn",
  },

  // Placeholder text
  {
    pattern: /\bTBD\b/g,
    message: "Placeholder text 'TBD' found",
    severity: "warn",
  },
  {
    pattern: /\bTODO\b(?!:.*enforce after)/g, // Allow "TODO: enforce after" in lefthook
    message: "Placeholder text 'TODO' found",
    severity: "warn",
  },
  {
    pattern: /\bFIXME\b/g,
    message: "Placeholder text 'FIXME' found",
    severity: "warn",
  },
  {
    pattern: /\[Insert\s+here\]/gi,
    message: "Placeholder '[Insert here]' found",
    severity: "warn",
  },
];

// Folders to scan
const SCAN_FOLDERS = [
  "docs",
  ".github/agents",
  ".github/skills",
  ".github/instructions",
  ".github/templates",
  "agent-output",
  "scenarios",
];

// Files to scan at root
const SCAN_ROOT_FILES = ["README.md", "CONTRIBUTING.md", "CHANGELOG.md"];

// Folders/files to exclude
const EXCLUDE_PATTERNS = [
  /_superseded/,
  /node_modules/,
  /\.github-archive/,
  /infra\//,
];

let errorCount = 0;
let warnCount = 0;

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function scanFile(filePath) {
  if (shouldExclude(filePath)) return;
  if (!filePath.endsWith(".md")) return;

  const content = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(ROOT, filePath);

  for (const { pattern, message, severity } of DEPRECATED_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      const icon = severity === "error" ? "❌" : "⚠️";
      console.log(`${icon} ${relativePath}:${lineNum} - ${message}`);
      console.log(`   Found: "${match[0]}"`);

      if (severity === "error") errorCount++;
      else warnCount++;
    }
  }
}

function scanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  if (shouldExclude(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile()) {
      scanFile(fullPath);
    }
  }
}

function main() {
  console.log("🔍 Deprecated References Validator\n");

  // Scan folders
  for (const folder of SCAN_FOLDERS) {
    const folderPath = path.join(ROOT, folder);
    scanDirectory(folderPath);
  }

  // Scan root files
  for (const file of SCAN_ROOT_FILES) {
    const filePath = path.join(ROOT, file);
    if (fs.existsSync(filePath)) {
      scanFile(filePath);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (errorCount > 0) {
    console.log(`❌ Found ${errorCount} error(s) and ${warnCount} warning(s)`);
    console.log("\n💡 Errors must be fixed before merge");
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(`⚠️  Found ${warnCount} warning(s) (no errors)`);
    process.exit(0);
  } else {
    console.log("✅ No deprecated references found");
    process.exit(0);
  }
}

main();
