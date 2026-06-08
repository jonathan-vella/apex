---
title: "Step 1 — Requirements"
description: "Gather Azure platform-engineering requirements with the 02-Requirements agent."
sidebar:
  order: 1
  label: "Step 1 — Requirements"
---

## Purpose

Capture the functional, non-functional, compliance, and budget constraints for a new Azure workload
through an interactive conversation. Step 1 also produces the empty `sku-manifest.{json,md}`
artifact that downstream steps mutate.

## Agent

[`02-Requirements`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/02-requirements.agent.md)

## Invocation

```text
Invoke: Ctrl+Shift+A → 02-Requirements
Output: agent-output/{project}/01-requirements.md
        agent-output/{project}/sku-manifest.{json,md} (rev 1)
```

## What gets captured

- **Functional requirements** — what the system does
- **Non-functional requirements** — performance, availability, security, scale targets
- **Compliance requirements** — regulatory, organizational, residency
- **Budget constraints** — monthly cap, cost guardrails
- **User-pinned SKUs** (optional) — anything the user has already decided

## Review

1 × `comprehensive` adversarial pass by `challenger-review-subagent` is mandatory. Findings land in
`challenge-findings-01-requirements.json` and must be triaged before Step 2.

## Hand-off

The Orchestrator routes context to [`Step 2 —
Architecture`](/concepts/workflow/step-2/) once the user approves the
requirements artifact.

## See also

- [Workflow overview](/concepts/workflow/) — the linear narrative across all
  steps.
- [Workflow deep dive](/concepts/workflow-deep-dive/) — cross-cutting
  decisions and gates.
- [Agent architecture](/concepts/how-it-works/agents/) — how agents, skills,
  and subagents compose.
