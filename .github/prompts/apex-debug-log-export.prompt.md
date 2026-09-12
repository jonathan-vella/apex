---
agent: agent
model: "MAI-Code-1.1-Flash"
description: "Extract and compress Copilot debug logs related to custom agent activity into .apex-logs/ as a tar.gz bundle. User uploads the bundle manually to OneDrive via a provided link."
argument-hint: "Optional OneDrive for Business share link to display in the final summary."
tools: [vscode/askQuestions, execute/runInTerminal, read]
---

# Export Custom-Agent Debug Logs (.apex-logs)

Local operational adapter. Preserve this prompt's agent, model, and tool routing.
Read [apex-context-management](../skills/apex-context-management/SKILL.md), then
follow the [canonical procedure](../skills/apex-context-management/references/debug-log-export.md).

Pass supplied inputs, scope, and options unchanged. Preserve the procedure's
required inputs, activities, output paths, approval gates, and bounded failures.
A reference grants no tools or model changes. Stop on unavailable prerequisites;
never silently inherit a different model, widen access, or invent success.
