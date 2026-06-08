---
title: "Step 2 — Architecture"
description: "Evaluate requirements against the Azure Well-Architected Framework and pick SKUs with the 03-Architect agent."
sidebar:
  order: 2
  label: "Step 2 — Architecture"
---

## Purpose

Score the proposed architecture against the five Azure Well-Architected Framework (WAF) pillars and
turn user-pinned SKUs into a complete service list with real-time pricing.

## Agent

[`03-Architect`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/03-architect.agent.md)
— delegates pricing lookups to
[`cost-estimate-subagent`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/_subagents/cost-estimate-subagent.agent.md).

## Invocation

```text
Invoke: Ctrl+Shift+A → 03-Architect
Output: agent-output/{project}/02-architecture-assessment.md
        agent-output/{project}/02-cost-estimate.md
        agent-output/{project}/sku-manifest.{json,md} (rev 2)
```

## What gets produced

- **WAF pillar scoring** — Reliability, Security, Cost, Operations, Performance.
- **SKU recommendations** — sourced via the Azure Pricing MCP and folded into `sku-manifest`.
- **Architecture decisions** — with rationale and trade-offs.
- **Risk register** — assumptions, blast radius, mitigation pointers.

## Review

1 × `comprehensive` adversarial pass + 1 × cost-feasibility pass (mandatory).
`decisions.review_depth = "deep"` opts in to a multi-pass rotating-lens review.

## Hand-off

The Orchestrator routes context to [`Step 3 — Design
(optional)`](/concepts/workflow/step-3/) or, if the user skips design
artifacts, directly to [`Step 3.5 —
Governance`](/concepts/workflow/step-3-5/).

## See also

- [Azure WAF pillars](https://learn.microsoft.com/azure/well-architected/) — the external reference
  for scoring.
- [Cost estimate
  subagent](https://github.com/jonathan-vella/apex/blob/main/.github/agents/_subagents/cost-estimate-subagent.agent.md)
  — Azure Pricing MCP wrapper.
