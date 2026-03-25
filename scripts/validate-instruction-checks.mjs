#!/usr/bin/env node
/**
 * Instruction Checks Validator
 *
 * Combined instruction validation:
 * 1. Frontmatter: required fields (description, applyTo), no unknown fields
 * 2. References: instruction file refs exist, applyTo globs match files,
 *    skill refs exist, cross-references between instruction files valid
 *
 * Replaces validate-instruction-frontmatter.mjs and
 * validate-instruction-references.mjs.
 *
 * @example
 * node scripts/validate-instruction-checks.mjs
 */

import fs, { globSync } from "node:fs";
import path from "node:path";
import { getInstructions } from "./_lib/workspace-index.mjs";

const ROOT = process.cwd();

let errors = 0;
let warnings = 0;
let checks = 0;

function check(description, condition, severity = "error") {
  checks++;
  if (condition) {
    console.log(`  ✅ ${description}`);
  } else if (severity === "warn") {
    console.log(`  ⚠️  ${description}`);
    warnings++;
  } else {
    console.log(`  ❌ ${description}`);
    errors++;
  }
}

function fileExists(relPath) {
  return fs.existsSync(path.resolve(ROOT, relPath));
}

function collectFiles(dirs, extensions) {
  const files = [];
  for (const dir of dirs) {
    const absDir = path.resolve(ROOT, dir);
    if (!fs.existsSync(absDir)) continue;
    for (const entry of fs.readdirSync(absDir, {
      withFileTypes: true,
      recursive: true,
    })) {
      const full = path.join(entry.parentPath || entry.path, entry.name);
      if (
        entry.isFile() &&
        extensions.some((ext) => entry.name.endsWith(ext))
      ) {
        files.push(full);
      }
    }
  }
  return files;
}

function splitApplyTo(pattern) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of pattern) {
    if (ch === "{") {
      depth++;
      current += ch;
    } else if (ch === "}") {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

function globHasMatch(pattern) {
  const patterns = splitApplyTo(pattern);
  const hiddenPrefixes = [".github", ".vscode"];
  const expanded = [];
  for (const pat of patterns) {
    expanded.push(pat);
    if (pat.startsWith("**/")) {
      for (const prefix of hiddenPrefixes) {
        expanded.push(`${prefix}/**/${pat.slice(3)}`);
      }
    }
  }
  try {
    const matches = globSync(expanded, {
      cwd: ROOT,
      exclude: (p) =>
        p === ".venv" || p === "node_modules" || p === "dist" || p === "build",
    });
    return matches.length > 0;
  } catch {
    return false;
  }
}

function stripCodeBlocks(content) {
  return content.replace(/```[\s\S]*?```/g, "");
}

// ── Part 1: Frontmatter validation ──

console.log("\n🔍 Instruction Checks Validator\n");
console.log("─".repeat(60));
console.log("📄 Part 1: Frontmatter validation\n");

const REQUIRED_FIELDS = ["description", "applyto"];
const REQUIRED_FIELDS_DISPLAY = ["description", "applyTo"];
const OPTIONAL_FIELDS = ["name"];
const ALLOWED_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];
const ALLOWED_FIELDS_DISPLAY = [...REQUIRED_FIELDS_DISPLAY, ...OPTIONAL_FIELDS];

const instructions = getInstructions();
console.log(`Found ${instructions.size} instruction file(s)\n`);

for (const [fileName, instr] of instructions) {
  const { path: filePath, frontmatter: fm } = instr;
  const relPath = path.relative(ROOT, filePath);

  if (!fm) {
    console.log(
      `::error file=${relPath},line=1::Missing YAML frontmatter (requires description and applyTo)`,
    );
    errors++;
    continue;
  }

  for (const field of REQUIRED_FIELDS) {
    if (!fm[field]) {
      const display = REQUIRED_FIELDS_DISPLAY[REQUIRED_FIELDS.indexOf(field)];
      console.log(
        `::error file=${relPath},line=1::Missing required frontmatter field: ${display}`,
      );
      errors++;
    }
  }

  const unknownFields = Object.keys(fm).filter(
    (k) => !ALLOWED_FIELDS.includes(k),
  );
  if (unknownFields.length > 0) {
    console.log(
      `::error file=${relPath},line=1::Unknown frontmatter fields: ${unknownFields.join(", ")} (allowed: ${ALLOWED_FIELDS_DISPLAY.join(", ")})`,
    );
    errors++;
  }
}

// ── Part 2: Instruction file references exist ──

console.log("\n" + "─".repeat(60));
console.log("📄 Part 2: Instruction file references exist\n");

const scanDirs = [
  ".github/agents",
  ".github/skills",
  ".github/instructions",
  ".github/prompts",
];
const scanExts = [".md"];
const allMdFiles = collectFiles(scanDirs, scanExts);

const instructionRefPattern =
  /[Rr]ead\s+[`"]?\.github\/instructions\/([^`"\s)]+)[`"]?/g;

const foundInstructionRefs = new Map();

for (const filePath of allMdFiles) {
  const content = fs.readFileSync(filePath, "utf-8");
  const relFile = path.relative(ROOT, filePath);
  let match;

  instructionRefPattern.lastIndex = 0;
  while ((match = instructionRefPattern.exec(content)) !== null) {
    const refFile = `.github/instructions/${match[1]}`;
    if (!foundInstructionRefs.has(refFile)) {
      foundInstructionRefs.set(refFile, []);
    }
    foundInstructionRefs.get(refFile).push(relFile);
  }
}

for (const [refFile, sources] of foundInstructionRefs) {
  check(
    `${refFile} (referenced by ${sources.length} file(s))`,
    fileExists(refFile),
  );
}

if (foundInstructionRefs.size === 0) {
  console.log("  ℹ️  No instruction references found in scanned files");
}

// ── Part 3: applyTo globs have matching files ──

console.log("\n" + "─".repeat(60));
console.log("📄 Part 3: applyTo glob patterns have matching files\n");

const instructionFiles = collectFiles(
  [".github/instructions"],
  [".instructions.md"],
);

for (const filePath of instructionFiles) {
  const content = fs.readFileSync(filePath, "utf-8");
  const relFile = path.relative(ROOT, filePath);
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) continue;

  const applyToMatch = fmMatch[1].match(/applyTo:\s*['"]?([^'"\n]+)['"]?/);
  if (!applyToMatch) continue;

  const applyTo = applyToMatch[1].trim();

  if (applyTo === "**" || applyTo === "*") {
    console.log(
      `  ℹ️  ${path.basename(relFile)}: applyTo="${applyTo}" (universal — skipped)`,
    );
    continue;
  }

  // Instructions targeting runtime-generated files (agent-output artifacts)
  // won't have matches in a clean repo — skip with info message
  const RUNTIME_ONLY_PATTERNS = ["04-governance-constraints"];
  const isRuntimeOnly = RUNTIME_ONLY_PATTERNS.some((p) => applyTo.includes(p));
  if (isRuntimeOnly) {
    console.log(
      `  ℹ️  ${path.basename(relFile)}: applyTo="${applyTo}" (runtime-generated — skipped)`,
    );
    continue;
  }

  const hasMatch = globHasMatch(applyTo);
  check(
    `${path.basename(relFile)}: applyTo="${applyTo}" has matching files`,
    hasMatch,
    "warn",
  );
}

// ── Part 4: Skill SKILL.md references exist ──

console.log("\n" + "─".repeat(60));
console.log("📄 Part 4: Skill SKILL.md references exist\n");

const skillRefPattern =
  /[Rr]ead\s+[`"]?\.github\/skills\/([^/`"\s]+)\/SKILL\.md[`"]?/g;

const foundSkillRefs = new Map();

for (const filePath of allMdFiles) {
  const content = fs.readFileSync(filePath, "utf-8");
  const relFile = path.relative(ROOT, filePath);
  let match;

  skillRefPattern.lastIndex = 0;
  while ((match = skillRefPattern.exec(content)) !== null) {
    if (match[1].includes("{") || match[1].includes("}")) continue;
    const skillFile = `.github/skills/${match[1]}/SKILL.md`;
    if (!foundSkillRefs.has(skillFile)) {
      foundSkillRefs.set(skillFile, []);
    }
    foundSkillRefs.get(skillFile).push(relFile);
  }
}

for (const [skillFile, sources] of foundSkillRefs) {
  check(
    `${skillFile} (referenced by ${sources.length} file(s))`,
    fileExists(skillFile),
  );
}

if (foundSkillRefs.size === 0) {
  console.log("  ℹ️  No skill references found in scanned files");
}

// ── Part 5: Cross-references between instruction files ──

console.log("\n" + "─".repeat(60));
console.log("📄 Part 5: Cross-references between instruction files\n");

const crossRefPattern = /[`"]?([a-z][\w-]+\.instructions\.md)[`"]?/g;
const EXAMPLE_PATTERNS = ["react-best-practices.instructions.md"];

const crossRefs = new Map();

for (const filePath of allMdFiles) {
  const rawContent = fs.readFileSync(filePath, "utf-8");
  const content = stripCodeBlocks(rawContent);
  const relFile = path.relative(ROOT, filePath);
  let match;

  crossRefPattern.lastIndex = 0;
  while ((match = crossRefPattern.exec(content)) !== null) {
    const refName = match[1];
    if (EXAMPLE_PATTERNS.includes(refName)) continue;
    const refPath = `.github/instructions/${refName}`;
    if (relFile.endsWith(refName)) continue;
    if (!crossRefs.has(refPath)) {
      crossRefs.set(refPath, new Set());
    }
    crossRefs.get(refPath).add(relFile);
  }
}

for (const [refPath, sources] of crossRefs) {
  check(
    `${refPath} (cross-referenced by ${sources.size} file(s))`,
    fileExists(refPath),
  );
}

if (crossRefs.size === 0) {
  console.log("  ℹ️  No cross-references found");
}

// ── Summary ──

console.log(`\n${"═".repeat(60)}`);
console.log(`Checks: ${checks} | Errors: ${errors} | Warnings: ${warnings}`);

if (errors > 0) {
  console.log(`\n❌ ${errors} error(s) found`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`\n⚠️  Passed with ${warnings} warning(s)`);
} else {
  console.log(`\n✅ All instruction checks passed`);
}
