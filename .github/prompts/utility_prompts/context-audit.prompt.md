---
description: "Audit agent context window utilization from Copilot Chat debug logs and produce optimization recommendations."
agent: "11-Context Optimizer"
---

# Context Window Audit

Analyze Copilot Chat debug logs to identify context bloat, redundant file reads, and optimization
opportunities across agents.

<investigate_before_answering>
- Context audits depend on real telemetry. Before producing recommendations,
  confirm: (a) the source debug log path or content; (b) which agents and
  skills are in scope; (c) whether the user wants per-invocation findings
  or repo-wide patterns.
- If the log is missing, partial, or stale, ask before proceeding. Do not
  fabricate token counts.
</investigate_before_answering>

<context>
- Copilot Chat debug logging must be enabled in VS Code.
- Log files live under
  `~/.vscode-server/data/logs/*/exthost1/GitHub.copilot-chat/`.
- Read `.github/skills/context-management/SKILL.md` for audit methodology
  (token accounting, hand-off detection, skill-loading heuristics).
</context>

<task>
1. Ask the user for the debug log file path (or pasted log content) plus
   the agents/skills in scope.
2. Parse the log to extract:
   - Token counts per agent invocation
   - File reads and their sizes
   - Skill / instruction loading patterns
   - Hand-off context transfer sizes
3. Identify optimization opportunities:
   - Bloated prompts (> 80% context utilization)
   - Redundant file reads (same file loaded multiple times)
   - Missing hand-off points (context not transferred between steps)
   - Oversized skill / instruction loading
4. Produce an actionable report with specific refactoring recommendations
   per agent / skill.
5. Save the report to `agent-output/_baselines/ctx-opt-{timestamp}/`.
</task>

<rules>
- Read-only analysis — do NOT modify agent definitions, skill files, or
  instruction files.
- Produces recommendations only; the user decides what to implement.
- Reusable across any project with custom agents — do not hardcode
  project-specific findings.
</rules>

<output_contract>
- `agent-output/_baselines/ctx-opt-{timestamp}/report.md` (top findings,
  per-agent breakdown, prioritized recommendations).
- Optional supporting JSON
  `agent-output/_baselines/ctx-opt-{timestamp}/raw-counts.json` with the
  parsed telemetry.
- Summary returned to the user with the top 3 optimizations.
</output_contract>
