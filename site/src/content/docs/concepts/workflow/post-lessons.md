---
title: "Post — Lessons Learned"
description: "Capture cross-step lessons and convert them into agent or skill updates."
sidebar:
  order: 9
  label: "Post — Lessons"
---

## Purpose

Capture the systemic lessons surfaced during a project run — challenger findings that recurred,
governance gaps, plan-vs-apply deltas, context-window blowups — and convert the most valuable ones
into agent or skill updates so the next project benefits.

## Artifact

```text
Output: agent-output/{project}/09-lessons-learned.{json,md}
```

## Lesson schema (subset)

```json
{
  "step": 4,
  "phase": "phase_3_module_selection",
  "category": "factual-accuracy",
  "trigger": "challenger must_fix",
  "observation": "Planner pinned avm/res/storage/storage-account at a version that lacked the requireInfrastructureEncryption flag required by an inherited deny policy.",
  "root_cause": "AVM module-index lifecycle was Available but the version chosen predated the policy property.",
  "action": "Move policy-property-map.json check earlier in IaC Planner Phase 2, before module pinning.",
  "telemetry": { "iterations": 2, "wall_time_min": 18 }
}
```

## Loop closure

Lessons feed three downstream paths:

- **Agent body updates** — when a lesson reveals a missing rule or misaligned phase.
- **Skill reference docs** — when a lesson is a pattern that should be reusable.
- **Validators** — when a lesson reveals a class of error that lint can catch.

See the [`11-Context
Optimizer`](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/agents/11-context-optimizer.agent.md)
agent for the audit-mode counterpart that mines Copilot debug logs.
