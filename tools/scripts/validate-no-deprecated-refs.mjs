/**
 * Deprecated References Validator
 *
 * Detects references to removed agents, dead paths, and placeholder text.
 * Helps maintain documentation hygiene after refactoring.
 */

import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { getAgents, getSkills, getInstructions } from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import { findAllMatches } from "./_lib/regex-helpers.mjs";

const ROOT = process.cwd();
const r = new Reporter("Deprecated References Validator");

// Patterns to detect (case-insensitive where noted)
const DEPRECATED_PATTERNS = [
  // Removed shared directory references (migrated to skills)
  {
    pattern: /agents\/_shared\//gi,
    message: "Reference to removed _shared/ directory (use azure-defaults skill)",
    severity: "error",
  },
  // Removed skill references (consolidated)
  {
    pattern: /skills\/orchestration-helper/gi,
    message: "Reference to removed orchestration-helper skill (deleted)",
    severity: "error",
  },
  {
    pattern: /skills\/azure-deployment-preflight/gi,
    message: "Reference to removed azure-deployment-preflight skill (merged into deploy agent)",
    severity: "error",
  },
  {
    pattern: /skills\/azure-workload-docs/gi,
    message: "Reference to removed azure-workload-docs skill (use azure-artifacts skill)",
    severity: "error",
  },
  {
    pattern: /skills\/github-issues/gi,
    message: "Reference to removed github-issues skill (use github-operations skill)",
    severity: "error",
  },
  {
    pattern: /skills\/github-pull-requests/gi,
    message: "Reference to removed github-pull-requests skill (use github-operations skill)",
    severity: "error",
  },
  // Removed agent file references
  {
    pattern: /\.github\/agents\/diagram\.agent\.md/gi,
    message: "Reference to removed diagram.agent.md (use drawio or python-diagrams skill)",
    severity: "error",
  },
  {
    pattern: /\.github\/agents\/adr\.agent\.md/gi,
    message: "Reference to removed adr.agent.md (use azure-adr skill)",
    severity: "error",
  },
  {
    pattern: /\.github\/agents\/docs\.agent\.md/gi,
    message: "Reference to removed docs.agent.md (use azure-artifacts skill)",
    severity: "error",
  },

  // Renamed agent files (b/t suffix convention)
  {
    pattern: /05-bicep-planner\.agent\.md/gi,
    message: "Renamed to 05-iac-planner.agent.md",
    severity: "error",
  },
  {
    pattern: /05b-bicep-planner\.agent\.md/gi,
    message: "Consolidated to 05-iac-planner.agent.md",
    severity: "error",
  },
  {
    pattern: /05t-terraform-planner\.agent\.md/gi,
    message: "Consolidated to 05-iac-planner.agent.md",
    severity: "error",
  },
  {
    pattern: /06-bicep-code-generator\.agent\.md/gi,
    message: "Renamed to 06b-bicep-codegen.agent.md",
    severity: "error",
  },
  {
    pattern: /07-deploy\.agent\.md/gi,
    message: "Renamed to 07b-bicep-deploy.agent.md",
    severity: "error",
  },
  {
    pattern: /11-terraform-planner\.agent\.md/gi,
    message: "Renamed to 05-iac-planner.agent.md",
    severity: "error",
  },
  {
    pattern: /12-terraform-code-generator\.agent\.md/gi,
    message: "Renamed to 06t-terraform-codegen.agent.md",
    severity: "error",
  },
  {
    pattern: /13-terraform-deploy\.agent\.md/gi,
    message: "Renamed to 07t-terraform-deploy.agent.md",
    severity: "error",
  },

  // Detect stale references to the retired top-level docs/ tree.
  // The canonical documentation source is site/src/content/docs/.
  // Historical references in changelogs and archival records are excluded
  // via EXCLUDE_PATTERNS.
  {
    pattern: /(?<![\w/])docs\/(?!tf-support|adr\/|diagrams\/)[\w-]+/gi,
    message: "Reference to retired docs/ tree (canonical source is site/src/content/docs/)",
    severity: "warn",
  },

  // Agent mentions that should be skills (in prose, not agent definitions)
  {
    pattern: /@diagram\s+agent/gi,
    message: "Reference to @diagram agent (removed - use drawio or python-diagrams skill)",
    severity: "warn",
  },
  {
    pattern: /@adr\s+agent/gi,
    message: "Reference to @adr agent (removed - use azure-adr skill)",
    severity: "warn",
  },
  {
    pattern: /@docs\s+agent/gi,
    message: "Reference to @docs agent (removed - use azure-artifacts skill)",
    severity: "warn",
  },

  // Placeholder text (skip lines that are guardrail examples like "don't use TBD")
  // These are checked contextually in scanFile function
  // {
  //   pattern: /\bTBD\b/g,
  //   message: "Placeholder text 'TBD' found",
  //   severity: "warn",
  // },
  // Removed: Too many false positives in guardrail documentation
  {
    pattern: /\[Insert\s+here\]/gi,
    message: "Placeholder '[Insert here]' found",
    severity: "warn",
  },
];

// Folders to scan
const _SCAN_FOLDERS = [
  "site/src/content/docs",
  ".github/agents",
  ".github/skills",
  ".github/instructions",
  ".github/skills/azure-artifacts/templates",
  "agent-output",
  "scenarios",
];

// Files to scan at root
const SCAN_ROOT_FILES = ["README.md", "CONTRIBUTING.md", "CHANGELOG.md"];

// Folders/files to exclude
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /infra\//,
  /(?:^|\/)changelog\.md$/i, // Historical logs may reference retired paths intentionally
  /^QUALITY_SCORE\.md$/,
  /^tests\/exec-plans\/tech-debt-tracker\.md$/,
  /agent-output\//, // Generated artifacts may contain old references
];

let errorCount = 0;
let warnCount = 0;

function getLineText(content, index) {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const lineEnd = content.indexOf("\n", index);
  return content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
}

function shouldIgnoreDeprecatedMatch(message, lineText, matchedText) {
  if (!message.includes("retired docs/ tree")) return false;

  const branchExamplePatterns = [/git checkout -b docs\//i, /^\|\s*`docs\//, /branch name.*`docs\//i];

  if (branchExamplePatterns.some((pattern) => pattern.test(lineText))) {
    return true;
  }

  return matchedText === "docs/update-workflow-guide";
}

function scanFile(filePath, content) {
  const relativePath = path.relative(ROOT, filePath);
  if (EXCLUDE_PATTERNS.some((p) => p.test(relativePath))) return;

  for (const { pattern, message, severity } of DEPRECATED_PATTERNS) {
    for (const match of findAllMatches(pattern, content)) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      const lineText = getLineText(content, match.index);
      if (shouldIgnoreDeprecatedMatch(message, lineText, match[0])) {
        continue;
      }

      const icon = severity === "error" ? "❌" : "⚠️";
      console.log(`${icon} ${relativePath}:${lineNum} - ${message}`);
      console.log(`   Found: "${match[0]}"`);

      if (severity === "error") errorCount++;
      else warnCount++;
    }
  }
}

const SCAN_EXTENSIONS = new Set([".md", ".mjs", ".yml", ".yaml", ".json"]);

/**
 * Walk a directory tree and yield every file path with a scan-eligible
 * extension that is not excluded. Synchronous walk (cheap), async read.
 */
function* walkScanFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const dirRel = path.relative(ROOT, dirPath);
  if (EXCLUDE_PATTERNS.some((p) => p.test(dirRel))) return;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      yield* walkScanFiles(fullPath);
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      yield fullPath;
    }
  }
}

async function scanDirectoryAsync(dirPath) {
  const files = [...walkScanFiles(dirPath)];
  // Read all files in parallel, then scan sequentially (scanFile is CPU-bound
  // but writes to a shared counter, so serial scan after parallel I/O is
  // both correct and fast).
  const contents = await Promise.all(files.map((f) => fsp.readFile(f, "utf8")));
  for (let i = 0; i < files.length; i++) {
    scanFile(files[i], contents[i]);
  }
}

async function main() {
  r.header();

  // Leverage workspace-index for agents, skills, instructions (already cached)
  for (const [, agent] of getAgents()) {
    scanFile(agent.path, agent.content);
  }
  for (const [, skill] of getSkills()) {
    if (skill.content) scanFile(path.join(skill.dir, "SKILL.md"), skill.content);
  }
  for (const [, instr] of getInstructions()) {
    scanFile(instr.path, instr.content);
  }

  // Scan additional directories not covered by workspace-index — in parallel.
  await Promise.all(
    ["site/src/content/docs", ".github/skills/azure-artifacts/templates"].map((folder) =>
      scanDirectoryAsync(path.join(ROOT, folder)),
    ),
  );

  // Scan root files in parallel.
  const rootPaths = SCAN_ROOT_FILES.map((f) => path.join(ROOT, f)).filter((p) => fs.existsSync(p));
  const rootContents = await Promise.all(rootPaths.map((p) => fsp.readFile(p, "utf8")));
  for (let i = 0; i < rootPaths.length; i++) {
    scanFile(rootPaths[i], rootContents[i]);
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
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
