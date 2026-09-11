---
description: "Resume an existing APEX project through the Orchestrator's canonical recovery and routing procedure."
agent: "01-Orchestrator"
---

# Resume Workflow

Resume the supplied project using [Resuming a Project][resume] in
01-Orchestrator. If no project was supplied, use that procedure's project-selection rules.

Follow the agent body's Graph-Based Step Routing and Session Break Protocol.
Preserve required reviews and human approvals. Present current status and the applicable gate or handoff,
then stop. Do not add independent routing tables, raw session-state reads, or a next-step-selection question.

[resume]: ../agents/01-orchestrator.agent.md#resuming-a-project
