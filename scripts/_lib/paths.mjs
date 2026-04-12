/**
 * Shared Workspace Paths
 *
 * Canonical path constants used across validation scripts.
 * Eliminates ~32 lines of duplicated path definitions across 8+ scripts.
 */

export const AGENTS_DIR = ".github/agents";
export const SUBAGENTS_DIR = ".github/agents/_subagents";
export const SKILLS_DIR = ".github/skills";
export const INSTRUCTIONS_DIR = ".github/instructions";
export const AGENT_OUTPUT_DIR = "agent-output";
export const PROMPTS_DIR = ".github/prompts";

export const REGISTRY_PATH = ".github/agent-registry.json";
export const AFFINITY_PATH = ".github/skill-affinity.json";
export const COPILOT_INSTRUCTIONS = ".github/copilot-instructions.md";

export const MAX_BODY_LINES = 500;
export const MAX_SKILL_LINES_WITHOUT_REFS = 200;
export const MAX_LINES_WITH_WILDCARD = 50;
