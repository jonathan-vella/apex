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
[`apex-python-diagrams`](https://github.com/jonathan-vella/apex/blob/main/.github/skills/apex-python-diagrams/SKILL.md)
and
[`apex-azure-adr`](https://github.com/jonathan-vella/apex/blob/main/.github/skills/apex-azure-adr/SKILL.md)
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
| Architecture diagram | apex-python-diagrams        | Reproducible Azure system view                     |
| Runtime-flow diagram | apex-python-diagrams        | Request paths and async messaging                  |
| Dependency diagram   | apex-python-diagrams        | Resource dependency tree                           |
| ADR                  | apex-azure-adr skill        | WAF-mapped decisions with alternatives             |

## Review

Opt-in: 1 × `comprehensive` adversarial pass on ADRs.

## Hand-off

The Orchestrator routes context to [`Step 3.5 —
Governance`](/concepts/workflow/step-3-5/).

## See also

- [`apex-python-diagrams`
  skill](https://github.com/jonathan-vella/apex/blob/main/.github/skills/apex-python-diagrams/SKILL.md)
- [`apex-azure-adr`
  skill](https://github.com/jonathan-vella/apex/blob/main/.github/skills/apex-azure-adr/SKILL.md)
