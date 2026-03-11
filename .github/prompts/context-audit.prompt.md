---
description: "Audit agent context window utilization from Copilot Chat debug logs and produce optimization recommendations."
agent: "11-Context Optimizer"
model: "Claude Opus 4.6"
---

# Context Window Audit

Analyze Copilot Chat debug logs to identify context bloat, redundant file reads, and optimization
opportunities across agents.

## Instructions

1. Read `.github/skills/context-optimizer/SKILL.md` for audit methodology.
2. Ask the user to provide the debug log file path or paste log content.
3. Parse the debug log to extract:
   - Token counts per agent invocation
   - File reads and their sizes
   - Skill/instruction loading patterns
   - Hand-off context transfer sizes
4. Identify optimization opportunities:
   - Bloated prompts (>80% context utilization)
   - Redundant file reads (same file loaded multiple times)
   - Missing hand-off points (context not transferred between steps)
   - Oversized skill/instruction loading
5. Produce an actionable report with specific refactoring recommendations.
6. Save the report to `agent-output/_baselines/ctx-opt-{timestamp}/`.

## Constraints

- Read-only analysis — do NOT modify agent definitions or skill files.
- Produces recommendations only — user decides what to implement.
- Reusable across any project with custom agents.
