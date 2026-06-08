---
title: "Step 4 — IaC Plan"
description: "Translate the architecture into a machine-readable Bicep or Terraform implementation plan."
sidebar:
  order: 5
  label: "Step 4 — IaC Plan"
---

## Purpose

Produce a comprehensive, machine-readable implementation plan that selects Azure Verified Modules,
pins versions, maps governance constraints onto module inputs, and lays out the phased deployment
graph.

## Agent

[`05-IaC
Planner`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/05-iac-planner.agent.md)
— track-aware (Bicep or Terraform via `decisions.iac_tool`).

## Invocation

```text
Invoke: Ctrl+Shift+A → 05-IaC Planner
Output: agent-output/{project}/04-implementation-plan.md
        agent-output/{project}/04-dependency-diagram.py and .png
        agent-output/{project}/04-runtime-diagram.py and .png
```

## Prerequisites

- `04-governance-constraints.{md,json}` from Step 3.5 — `discovery_status: "COMPLETE"` with a valid
  policy array (empty is acceptable when no Deny effects exist for scope).
- `sku-manifest.json` revised through Step 2.

The planner halts and asks the user to refresh governance if those preconditions fail.

## What gets produced

- AVM module selection — Bicep: `br/public:avm/res/…`; Terraform: AVM-TF registry.
- Resource dependency map.
- CAF naming validation.
- Phased implementation graph (network → identity → data → compute → app).
- Step 4 diagrams auto-generated alongside the plan.

## Review

1 × `comprehensive` adversarial pass (mandatory). `decisions.review_depth = "deep"` opts in to a
multi-pass rotating-lens review.

:::note[Approval Gate]
The user must approve the implementation plan before code generation.
:::

## Hand-off

The Orchestrator routes context to [`Step 5 — IaC
Code`](/concepts/workflow/step-5/).
