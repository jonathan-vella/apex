#!/usr/bin/env node
/**
 * Skill Validators (consolidated)
 *
 * Combines four skill validation checks into one script:
 * 1. Skills format & size validation (was validate-skills-format.mjs)
 * 2. Skill affinity validation (was validate-skill-affinity.mjs)
 * 3. Skill references validation (was validate-skill-references.mjs)
 * 4. Stale skill reference detection (was validate-no-stale-skill-references.mjs)
 *
 * @example
 * node scripts/validate-skills.mjs
 */

import fs from "node:fs";
import path from "node:path";
import {
  getAgents,
  getSkills,
  getInstructions,
  getSkillNames as getSkillNamesFromIndex,
} from "./_lib/workspace-index.mjs";
import { Reporter } from "./_lib/reporter.mjs";
import {
  MAX_SKILL_LINES_WITHOUT_REFS,
  SKILLS_DIR,
  INSTRUCTIONS_DIR,
  AFFINITY_PATH,
} from "./_lib/paths.mjs";

let overallFailed = false;

// ============================================================================
// Part 1: Skills Format & Size Validation (was validate-skills-format.mjs)
// ============================================================================

const FORBIDDEN_PATTERNS = [
  {
    pattern: /^description:\s*[>|][-\s]*$/m,
    message:
      "description uses a YAML block scalar (>, >-, | or |-). " +
      "Use a single-line inline string instead.",
  },
];

const DEPRECATED_PATTERNS = [
  {
    pattern: /skill-version:\s*beta/i,
    message: "skill-version: beta is deprecated, remove for GA",
  },
  {
    pattern: /\.skill\.json/i,
    message: ".skill.json files are deprecated, use SKILL.md frontmatter",
  },
];

const KNOWN_OVERSIZED = new Set([
  "azure-adr",
  "github-operations",
  "make-skill-template",
]);

function runFormatValidation() {
  const r = new Reporter("Skills Format Validator");
  r.header();

  const skills = getSkills();

  if (skills.size === 0) {
    console.log(
      "No .github/skills directory found - skipping skill validation",
    );
    return;
  }

  console.log(`Found ${skills.size} skill directories\n`);

  for (const [skillName, skill] of skills) {
    r.tick();
    const { dir: skillDir, content, frontmatter, hasRefs, refFiles } = skill;

    if (!content) {
      r.error(skillName, "Missing SKILL.md file");
      continue;
    }

    const rawFrontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const rawFrontmatter = rawFrontmatterMatch ? rawFrontmatterMatch[1] : "";

    if (!frontmatter) {
      r.error(skillName, "No frontmatter found in SKILL.md");
      continue;
    }

    if (!frontmatter.description) {
      r.error(skillName, "Missing required frontmatter field 'description'");
    }

    for (const { pattern, message } of FORBIDDEN_PATTERNS) {
      if (pattern.test(rawFrontmatter)) {
        r.error(skillName, message);
      }
    }

    for (const { pattern, message } of DEPRECATED_PATTERNS) {
      if (pattern.test(content)) {
        r.warn(skillName, message);
      }
    }

    const jsonFiles = fs
      .readdirSync(skillDir)
      .filter((f) => f.endsWith(".skill.json"));
    if (jsonFiles.length > 0) {
      r.warn(
        skillName,
        `Found deprecated .skill.json file(s): ${jsonFiles.join(", ")}`,
      );
    }

    if (frontmatter.name && frontmatter.name !== skillName) {
      r.error(
        skillName,
        `Frontmatter 'name' ("${frontmatter.name}") does not match directory name ("${skillName}")`,
      );
    }

    if (frontmatter.description && frontmatter.description.length < 10) {
      r.warn(
        skillName,
        `Description is too short (${frontmatter.description.length} chars)`,
      );
    }

    const lineCount = content.split("\n").length;
    if (lineCount > MAX_SKILL_LINES_WITHOUT_REFS && !hasRefs) {
      if (KNOWN_OVERSIZED.has(skillName)) {
        r.warn(
          skillName,
          `SKILL.md is ${lineCount} lines (>${MAX_SKILL_LINES_WITHOUT_REFS}) without references/ (known — tracked)`,
        );
      } else {
        r.error(
          skillName,
          `SKILL.md is ${lineCount} lines (>${MAX_SKILL_LINES_WITHOUT_REFS}) without references/`,
        );
      }
    } else if (lineCount > MAX_SKILL_LINES_WITHOUT_REFS && hasRefs) {
      r.warn(
        skillName,
        `SKILL.md is ${lineCount} lines (>${MAX_SKILL_LINES_WITHOUT_REFS}) but has ${refFiles.length} reference files`,
      );
    }

    r.ok(skillName, "Valid GA skill format");
  }

  r.summary();
  if (r.errors > 0) {
    overallFailed = true;
    console.log("❌ Skills format validation FAILED\n");
  } else {
    console.log("✅ All skills passed format validation\n");
  }
}

// ============================================================================
// Part 2: Skill Affinity Validation (was validate-skill-affinity.mjs)
// ============================================================================

function getAgentNames() {
  const names = new Set();
  for (const [, agent] of getAgents()) {
    const name = agent.frontmatter?.name?.trim();
    if (name) names.add(name);
  }
  return names;
}

function buildAgentSkillReadsMap() {
  const map = new Map();
  for (const [, agent] of getAgents()) {
    const name = agent.frontmatter?.name?.trim();
    if (!name) continue;
    const reads = new Set();
    const skillRefs = agent.content.matchAll(
      /\.github\/skills\/([a-z0-9-]+)\/SKILL\.md/g,
    );
    for (const match of skillRefs) {
      reads.add(match[1]);
    }
    map.set(name, reads);
  }
  return map;
}

function runAffinityValidation() {
  const r = new Reporter("Skill Affinity Validator");

  console.log("\n🎯 Validating skill affinity configuration...\n");

  if (!fs.existsSync(AFFINITY_PATH)) {
    r.error(`Skill affinity config not found at ${AFFINITY_PATH}`);
    overallFailed = true;
    return;
  }

  let affinity;
  try {
    affinity = JSON.parse(fs.readFileSync(AFFINITY_PATH, "utf-8"));
  } catch (e) {
    r.error(`Invalid JSON in ${AFFINITY_PATH}: ${e.message}`);
    overallFailed = true;
    return;
  }

  const skillNames = getSkillNamesFromIndex();
  const agentNames = getAgentNames();
  const agentSkillReadsMap = buildAgentSkillReadsMap();

  function validateEntry(key, entry, isSubagent) {
    for (const tier of ["primary", "secondary", "never"]) {
      if (!Array.isArray(entry[tier])) {
        r.error(`${key}: "${tier}" must be an array`);
        continue;
      }
      for (const skill of entry[tier]) {
        if (!skillNames.has(skill)) {
          r.error(
            `${key}: references non-existent skill "${skill}" in ${tier}`,
          );
        }
      }
    }

    if (Array.isArray(entry.primary) && Array.isArray(entry.never)) {
      for (const skill of entry.primary) {
        if (entry.never.includes(skill)) {
          r.error(
            `${key}: skill "${skill}" appears in both "primary" and "never"`,
          );
        }
      }
    }

    if (!isSubagent) {
      const bodyReads = agentSkillReadsMap.get(key) || new Set();
      if (bodyReads.size > 0 && Array.isArray(entry.primary)) {
        for (const skill of entry.primary) {
          if (!bodyReads.has(skill)) {
            r.warn(
              `${key}: primary skill "${skill}" is not referenced in agent body "Read" lines`,
            );
          }
        }
      }
    }
  }

  let entryCount = 0;

  if (affinity.agents) {
    for (const [key, entry] of Object.entries(affinity.agents)) {
      if (!agentNames.has(key)) {
        r.warn(`Agent "${key}" in affinity config not found in agent files`);
      }
      validateEntry(key, entry, false);
      entryCount++;
    }
  }

  if (affinity.subagents) {
    for (const [key, entry] of Object.entries(affinity.subagents)) {
      if (!agentNames.has(key)) {
        r.warn(`Subagent "${key}" in affinity config not found in agent files`);
      }
      validateEntry(key, entry, true);
      entryCount++;
    }
  }

  r.ok(`Validated ${entryCount} affinity entries`);

  console.log(`\n📊 Results: ${r.errors} error(s), ${r.warnings} warning(s)\n`);

  if (r.errors > 0) {
    overallFailed = true;
    console.log("❌ Skill affinity validation FAILED\n");
  } else {
    console.log("✅ Skill affinity validation passed\n");
  }
}

// ============================================================================
// Part 3: Skill References Validation (was validate-skill-references.mjs)
// ============================================================================

function runReferencesValidation() {
  const r = new Reporter("Skill References Validator");
  r.header();

  function gatherSearchableContent() {
    const content = [];
    for (const [, agent] of getAgents()) content.push(agent.content);
    for (const [, instr] of getInstructions()) content.push(instr.content);
    for (const [, skill] of getSkills()) {
      if (skill.content) content.push(skill.content);
    }
    return content.join("\n");
  }

  const allContent = gatherSearchableContent();

  const skills = getSkills();

  for (const [skill, info] of skills) {
    if (!info.hasRefs) continue;
    const refsDir = path.join(SKILLS_DIR, skill, "references");

    for (const refFile of info.refFiles) {
      r.tick();
      const refRelPath = `${skill}/references/${refFile}`;
      const refName = refFile.replace(/\.md$/, "");

      const isReferenced =
        allContent.includes(refRelPath) ||
        allContent.includes(`references/${refFile}`) ||
        allContent.includes(`${skill}/references/${refName}`);

      if (!isReferenced) {
        r.warnAnnotation(
          path.join(refsDir, refFile),
          `${refRelPath} is not referenced by any agent, skill, or instruction`,
        );
        console.log(
          `  Fix: Add a loading directive in ${skill}/SKILL.md or remove the orphaned file.`,
        );
      }
    }
  }

  const instrRefsDir = path.join(INSTRUCTIONS_DIR, "references");
  if (fs.existsSync(instrRefsDir)) {
    const instrRefFiles = fs
      .readdirSync(instrRefsDir)
      .filter((f) => f.endsWith(".md"));

    for (const refFile of instrRefFiles) {
      r.tick();
      const refName = refFile.replace(/\.md$/, "");
      const isReferenced =
        allContent.includes(refFile) || allContent.includes(refName);

      if (!isReferenced) {
        r.warnAnnotation(
          path.join(instrRefsDir, refFile),
          `instructions/references/${refFile} is not referenced anywhere`,
        );
        console.log(
          `  Fix: Add a reference in the parent instruction file or remove the orphaned file.`,
        );
      }
    }
  }

  r.summary();
  if (r.errors > 0) {
    overallFailed = true;
    console.log("❌ Skill references check FAILED\n");
  } else {
    console.log("✅ Skill references check passed\n");
  }
}

// ============================================================================
// Part 4: Stale Skill Reference Detection (was validate-no-stale-skill-references.mjs)
// ============================================================================

const RETIRED_SKILLS = [
  {
    old: "azure-troubleshooting",
    new: "azure-diagnostics",
    since: "Issue #240 — Azure Skills Plugin integration",
  },
];

const SCAN_DIRS = [".github", "docs", "scripts"];
const SCAN_ROOT_FILES = ["AGENTS.md", "CHANGELOG.md", "README.md"];

const SKIP_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /site\//,
  /\.venv/,
  /PLUGIN_VERSION\.md/,
  /validate-skills\.mjs/,
  /validate-no-stale-skill-references\.mjs/,
  /migration\//,
];

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some((p) => p.test(filePath));
}

function runStaleReferenceDetection() {
  const r = new Reporter("Stale Skill Reference Validator");
  r.header();

  function scanFile(filePath) {
    if (shouldSkip(filePath)) return;
    if (!fs.existsSync(filePath)) return;

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;

    const ext = path.extname(filePath);
    const textExts = [
      ".md",
      ".json",
      ".jsonc",
      ".mjs",
      ".js",
      ".ts",
      ".yml",
      ".yaml",
      ".sh",
      ".ps1",
      ".py",
      ".txt",
    ];
    if (!textExts.includes(ext)) return;

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (const retired of RETIRED_SKILLS) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(retired.old)) {
          r.error(
            `${filePath}:${i + 1}`,
            `Stale reference to "${retired.old}" — rename to "${retired.new}" (${retired.since})`,
          );
        }
      }
    }
    r.tick();
  }

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (shouldSkip(fullPath)) continue;
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else {
        scanFile(fullPath);
      }
    }
  }

  for (const dir of SCAN_DIRS) {
    scanDir(dir);
  }

  for (const file of SCAN_ROOT_FILES) {
    scanFile(file);
  }

  r.summary();
  if (r.errors > 0) {
    overallFailed = true;
    console.log("❌ Stale skill reference detection FAILED\n");
  } else {
    console.log("✅ Stale skill reference detection passed\n");
  }
}

// ============================================================================
// Main entry point
// ============================================================================

function main() {
  console.log("📚 Skill Validators (consolidated)\n");

  console.log("═══ Part 1: Skills Format & Size ═══");
  runFormatValidation();

  console.log("═══ Part 2: Skill Affinity ═══");
  runAffinityValidation();

  console.log("═══ Part 3: Skill References ═══");
  runReferencesValidation();

  console.log("═══ Part 4: Stale Skill References ═══");
  runStaleReferenceDetection();

  if (overallFailed) {
    console.log("❌ Skill validation FAILED");
    process.exit(1);
  }
  console.log("✅ All skill validations passed");
}

main();
