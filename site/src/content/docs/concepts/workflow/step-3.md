---
title: "Step 3 — Design Artifacts (optional)"
description: "Create architecture diagrams and Architecture Decision Records before locking down governance."
sidebar:
  order: 3
  label: "Step 3 — Design (opt)"
---

## Purpose

Produce the visual and textual design artifacts that future maintainers will reach for first:
code-based Python architecture diagrams plus Architecture Decision Records (ADRs).

Step 3 is **optional** — users who already have diagrams or who are iterating quickly can skip
straight to Step 3.5 Governance.

## Agent

[`04-Design`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/04-design.agent.md)
— delegates to the
[`python-diagrams`](https://github.com/jonathan-vella/apex/blob/main/.github/skills/python-diagrams/SKILL.md)
and
[`azure-adr`](https://github.com/jonathan-vella/apex/blob/main/.github/skills/azure-adr/SKILL.md)
skills.

## Invocation

```text
Invoke: Ctrl+Shift+A → 04-Design
Output: agent-output/{project}/03-des-diagram.py + .png + .svg
        agent-output/{project}/03-des-adr-*.md
```

## Artifact types

| Artifact            | Tooling                | Purpose                                            |
| ------------------- | ---------------------- | -------------------------------------------------- |
| Architecture diagram | python-diagrams        | Reproducible Azure system view                     |
| Runtime-flow diagram | python-diagrams        | Request paths and async messaging                  |
| Dependency diagram   | python-diagrams        | Resource dependency tree                           |
| ADR                  | azure-adr skill        | WAF-mapped decisions with alternatives             |

## Review

Opt-in: 1 × `comprehensive` adversarial pass on ADRs.

## Hand-off

The Orchestrator routes context to [`Step 3.5 —
Governance`](/concepts/workflow/step-3-5/).

## See also

- [`python-diagrams`
  skill](https://github.com/jonathan-vella/apex/blob/main/.github/skills/python-diagrams/SKILL.md)
- [`azure-adr`
  skill](https://github.com/jonathan-vella/apex/blob/main/.github/skills/azure-adr/SKILL.md)
