---
title: "Step 3 — Design Artifacts (optional)"
description: "Create architecture diagrams and Architecture Decision Records before locking down governance."
sidebar:
  order: 3
  label: "Step 3 — Design (opt)"
---

## Purpose

Produce the visual and textual design artifacts that future maintainers will reach for first:
architecture diagrams (Draw.io or Python-diagrams) plus Architecture Decision Records (ADRs).

Step 3 is **optional** — users who already have diagrams or who are iterating quickly can skip
straight to Step 3.5 Governance.

## Agent

[`04-Design`](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/agents/04-design.agent.md)
— delegates to the
[`drawio`](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/skills/drawio/SKILL.md)
and
[`azure-adr`](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/skills/azure-adr/SKILL.md)
skills.

## Invocation

```text
Invoke: Ctrl+Shift+A → 04-Design
Output: agent-output/{project}/03-des-diagram.drawio
        agent-output/{project}/03-des-adr-*.md
```

## Artifact types

| Artifact            | Tooling                | Purpose                                            |
| ------------------- | ---------------------- | -------------------------------------------------- |
| Architecture diagram | drawio skill           | Azure-icon system view                             |
| Runtime-flow diagram | drawio / mermaid       | Request paths and async messaging                  |
| Dependency diagram   | python-diagrams        | Resource dependency tree                           |
| ADR                  | azure-adr skill        | WAF-mapped decisions with alternatives             |

## Review

Opt-in: 1 × `comprehensive` adversarial pass on ADRs.

## Hand-off

The Orchestrator routes context to [`Step 3.5 —
Governance`](/azure-agentic-infraops/concepts/workflow/step-3-5/).

## See also

- [`drawio`
  skill](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/skills/drawio/SKILL.md)
- [`azure-adr`
  skill](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/skills/azure-adr/SKILL.md)
