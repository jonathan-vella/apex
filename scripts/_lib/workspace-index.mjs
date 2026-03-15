/**
 * Shared Workspace Index
 *
 * Scans agents, skills, and instructions once and caches content +
 * parsed frontmatter. All accessors are lazy-initialized on first call.
 *
 * Usage:
 *   import { getAgents, getSkills, getInstructions } from "./_lib/workspace-index.mjs";
 *   const agents = getAgents();   // Map<filename, { path, dir, content, frontmatter }>
 *   const skills = getSkills();   // Map<skillName, { dir, content, frontmatter, hasRefs, refFiles }>
 *   const instructions = getInstructions(); // Map<filename, { path, content, frontmatter }>
 */

import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./parse-frontmatter.mjs";
import {
  AGENTS_DIR,
  SUBAGENTS_DIR,
  SKILLS_DIR,
  INSTRUCTIONS_DIR,
} from "./paths.mjs";

let _agents = null;
let _skills = null;
let _instructions = null;

/**
 * Returns a Map of all agent files: filename → { path, dir, content, frontmatter, isSubagent }
 */
export function getAgents() {
  if (_agents) return _agents;
  _agents = new Map();
  for (const [dir, isSubagent] of [
    [AGENTS_DIR, false],
    [SUBAGENTS_DIR, true],
  ]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".agent.md")) continue;
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const frontmatter = parseFrontmatter(content);
      _agents.set(file, {
        path: filePath,
        dir,
        content,
        frontmatter,
        isSubagent,
      });
    }
  }
  return _agents;
}

/**
 * Returns a Map of agent name (from frontmatter) → filename.
 */
export function getAgentNameMap() {
  const map = new Map();
  for (const [file, agent] of getAgents()) {
    const name = agent.frontmatter?.name?.trim();
    if (name) map.set(name, file);
  }
  return map;
}

/**
 * Returns a Map of all skills: skillName → { dir, content, frontmatter, hasRefs, refFiles }
 */
export function getSkills() {
  if (_skills) return _skills;
  _skills = new Map();
  if (!fs.existsSync(SKILLS_DIR)) return _skills;
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(SKILLS_DIR, entry.name);
    const skillFile = path.join(skillDir, "SKILL.md");
    const refsDir = path.join(skillDir, "references");
    const hasRefs = fs.existsSync(refsDir);
    let content = null;
    let frontmatter = null;
    if (fs.existsSync(skillFile)) {
      content = fs.readFileSync(skillFile, "utf-8");
      frontmatter = parseFrontmatter(content);
    }
    const refFiles = hasRefs
      ? fs.readdirSync(refsDir).filter((f) => f.endsWith(".md"))
      : [];
    _skills.set(entry.name, {
      dir: skillDir,
      content,
      frontmatter,
      hasRefs,
      refFiles,
    });
  }
  return _skills;
}

/**
 * Returns a Set of skill directory names.
 */
export function getSkillNames() {
  return new Set(getSkills().keys());
}

/**
 * Returns a Map of all instructions: filename → { path, content, frontmatter }
 */
export function getInstructions() {
  if (_instructions) return _instructions;
  _instructions = new Map();
  if (!fs.existsSync(INSTRUCTIONS_DIR)) return _instructions;
  for (const entry of fs.readdirSync(INSTRUCTIONS_DIR, {
    withFileTypes: true,
    recursive: true,
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".instructions.md")) continue;
    const filePath = path.join(entry.parentPath || entry.path, entry.name);
    const content = fs.readFileSync(filePath, "utf-8");
    const frontmatter = parseFrontmatter(content);
    _instructions.set(entry.name, { path: filePath, content, frontmatter });
  }
  return _instructions;
}

/** Reset all caches (useful for testing). */
export function resetIndex() {
  _agents = null;
  _skills = null;
  _instructions = null;
}
