---
name: apex-host-git-commit
description: "Stage scoped changes, commit, push, and offer a PR in Agent Host. Use /apex-host-git-commit only after selecting the built-in agent owner and MAI-Code-1.1-Flash."
argument-hint: "Optional conventional commit subject"
user-invocable: true
disable-model-invocation: true
---

# Host Git Commit

## Prerequisites

Require the selected built-in owner `agent` and model `MAI-Code-1.1-Flash`.
This is the native Local operation's owner, not `01-Orchestrator` or a worker.
Allowed operation tools are `vscode/askQuestions`, `execute/runInTerminal`,
`read`, and `todo`, intersected with the active owner's permissions.
A skill does not bind agent/model/tools. **STOP** and request manual selection
if any cannot be verified; do not widen tools or inherit a different model.

## Procedure

Read [apex-github-operations](../apex-github-operations/SKILL.md), then execute
the [shared commit procedure](../apex-github-operations/references/git-commit.md).
Preserve exclusions, staged-index checks, normal hooks, no-main/no-force rules,
failure stops, and the separate PR decision. Use git and gh only, not MCP.
Do not dispatch this operation as a subagent or switch credentials implicitly.

The distinct Host name leaves Local `/apex-git-commit` unchanged. Native Host
support remains manual and unverified. Do not enable experimental nesting or
context forks to make the operation available.
