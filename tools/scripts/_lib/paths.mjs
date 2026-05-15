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
// NOTE: APEX prompt files live under `tools/apex-prompts/` (not `.github/prompts/`)
// so they are never auto-loaded by VS Code Copilot's prompt-file discovery.
// They remain invokable via `runSubagent`-style references and direct attach.
export const PROMPTS_DIR = "tools/apex-prompts";

/**
 * Additional prompt-source directories scanned by `getPromptFiles()`.
 * `tools/tests/prompts/` holds E2E loop and benchmark prompts that ship
 * alongside production prompts and must satisfy the same vendor-prompting
 * rules (notably `prompt-model-source-001`).
 */
export const PROMPT_SOURCE_DIRS = ["tools/apex-prompts", "tools/tests/prompts"];

export const REGISTRY_PATH = "tools/registry/agent-registry.json";
export const COUNT_MANIFEST_PATH = "tools/registry/count-manifest.json";
export const COPILOT_INSTRUCTIONS = ".github/copilot-instructions.md";

export const MAX_BODY_LINES = 520;
export const MAX_SKILL_LINES_WITHOUT_REFS = 200;
export const MAX_LINES_WITH_WILDCARD = 50;
