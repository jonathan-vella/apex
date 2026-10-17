---
name: apex-debug-log-export
description: "Bundle selected native Copilot SDK events locally for manual inspection or upload. Use /apex-debug-log-export inside VS Code after selecting the built-in agent owner and MAI-Code-1.1-Flash. Explicit workspace/session scope; no automatic upload."
argument-hint: "session scope and optional export choices"
user-invocable: true
disable-model-invocation: true
---

# Debug Log Export

## Prerequisites

Require the selected built-in owner `agent` and model `MAI-Code-1.1-Flash`.
This is not `11-Context Optimizer`.
Allowed operation tools are `ask_user`, `execute`,
and `read`, intersected with the active owner's permissions.
A skill does not bind agent/model/tools. **STOP** and request manual selection
if any cannot be verified; do not widen tools or inherit a different model.

## Procedure

Read [apex-context-management](../apex-context-management/SKILL.md), then follow
the [shared export procedure](../apex-context-management/references/debug-log-export.md).
Require native workspace/session identity and explicit session selection.
Never infer scope from Local variables. Preserve capture options, redaction warning,
manifest and archive output, and manual upload only. Do not delegate the export.

This manual skill replaces the archived Local adapter. Native discovery and
export need actual acceptance tests; static checks do not prove runtime access.
Do not enable experimental skill context forks to provide missing access.
