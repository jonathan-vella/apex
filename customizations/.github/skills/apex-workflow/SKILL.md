---
name: apex-workflow
description: "Orient and route an APEX project. Use for status, next step, resume, blocked runs, or project selection."
---

## APEX Workflow

Use this skill to orient an interactive agent without reconstructing workflow state from chat or files.

## Prerequisites

- The workspace has the APEX CLI and MCP server configured.
- The user has selected or identified an APEX project when more than one exists.

## Workflow

1. Call `apex/status` for the selected project.
2. Call `apex/nextTask` when status does not already include an actionable task.
3. Treat the returned state, blockers, gate status, and task owner as authoritative.
4. For resume, fetch fresh status instead of relying on an earlier conversation.
5. Route interactive work by direct handoff to the kernel-selected specialist.

Do not infer progress from generated files, conversation history, or handoff completion. If selection is ambiguous, the
interactive agent may use `vscode/askQuestions` before repeating `apex/status`.

## Output

Report the project, run, environment, current state, blockers, and one kernel-provided next action.
