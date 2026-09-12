---
name: apex-host-debug-log-export
description: "Bundle selected custom-agent debug logs locally for manual upload in Agent Host. Use /apex-host-debug-log-export after selecting the built-in agent owner and MAI-Code-1.1-Flash."
argument-hint: "Optional OneDrive share link, displayed only; never uploaded automatically"
user-invocable: true
disable-model-invocation: true
---

# Host Debug Log Export

## Prerequisites

Require the selected built-in owner `agent` and model `MAI-Code-1.1-Flash`.
This is the native Local operation's owner, not `11-Context Optimizer`.
Allowed operation tools are `vscode/askQuestions`, `execute/runInTerminal`,
and `read`, intersected with the active owner's permissions.
A skill does not bind agent/model/tools. **STOP** and request manual selection
if any cannot be verified; do not widen tools or inherit a different model.

## Procedure

Read [apex-context-management](../apex-context-management/SKILL.md), then follow
the [shared export procedure](../apex-context-management/references/debug-log-export.md).
Require workspace/session identity and the session picker; never guess Host log
paths from Local-only variables. Preserve capture options, redaction warning,
manifest and archive output, and manual upload only. Do not delegate the export.

The distinct Host name leaves Local `/apex-debug-log-export` unchanged. Native
Host log availability, discovery and execution remain manual and unverified.
Do not enable experimental nesting or context forks to provide missing access.
