---
description: "Generate as-built documentation for an existing Azure deployment with no prior artifacts. Discovers resources, collects requirements interactively, synthesizes pseudo-artifacts, then hands off to 08-As-Built."
agent: "agent"
# Uses GPT-5.6-Terra for discovery and synthesis before handing off to the
# target agent's configured model through a human handoff.
model: "GPT-5.6-Terra"
tools:
  - vscode
  - execute
  - read
  - agent
  - browser
  - edit
  - search
  - web
  - "azure-mcp/*"
  - todo
argument-hint: "Provide subscription name/ID, resource group(s), and workload name"
---

# As-Built Documentation from Existing Azure Deployment

Local operational adapter. Preserve this prompt's agent, model, and tool routing.
Read [apex-workflow-engine](../../../.github/skills/apex-workflow-engine/SKILL.md), then
follow the [canonical procedure](../../../.github/skills/apex-workflow-engine/references/as-built-from-azure.md).

Pass supplied inputs, scope, and options unchanged. Preserve the procedure's
required inputs, activities, output paths, approval gates, and bounded failures.
A reference grants no tools or model changes. Stop on unavailable prerequisites;
never silently inherit a different model, widen access, or invent success.
