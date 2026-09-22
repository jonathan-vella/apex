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
// Tools prompts are attachable references; native operational slash prompts live in .github/prompts/.
export const PROMPTS_DIR = "tools/apex-prompts";

export const PROMPT_SOURCE_DIRS = [".github/prompts", "tools/apex-prompts"];

export const REGISTRY_PATH = "tools/registry/agent-registry.json";
export const COUNT_MANIFEST_PATH = "tools/registry/count-manifest.json";
export const COPILOT_INSTRUCTIONS = ".github/copilot-instructions.md";

// MAX_BODY_LINES bumped 520 → 600 (2026-05-17) to accommodate two
// runtime token-budget contracts that legitimately consume body lines:
//   1. `## Completion Handoff` (verbatim /clear-handoff) — required in
//      every step agent for direct-invocation safety.
//   2. Mid-step `/clear` between challenger passes — required in the
//      orchestrator's Session Break Protocol.
// Both are hard-fail contracts enforced by
// tools/scripts/validate_orchestrator_handoff.py and are not
// extractable to references because the verbatim line must appear in
// each agent body. The 600-line ceiling gives ~45 lines of working
// headroom on top of today's largest agent (550 lines).
export const MAX_BODY_LINES = 600;
export const MAX_SKILL_LINES_WITHOUT_REFS = 200;
export const MAX_LINES_WITH_WILDCARD = 50;
