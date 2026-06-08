---
title: "Step 3.5 — Governance"
description: "Discover Azure Policy assignments and emit a machine-readable governance constraint set."
sidebar:
  order: 4
  label: "Step 3.5 — Governance"
---

## Purpose

Discover **effective** Azure Policy assignments (including management-group-inherited ones),
classify their effects, and emit the `04-governance-constraints.{md,json}` artifacts that gate
downstream IaC planning and deployment.

## Agent

[`04g-Governance`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/04g-governance.agent.md)
— uses the
[`azure-governance-discovery`](https://github.com/jonathan-vella/apex/blob/main/.github/skills/azure-governance-discovery/SKILL.md)
skill.

## Invocation

```text
Invoke: Ctrl+Shift+A → 04g-Governance
Output: agent-output/{project}/04-governance-constraints.md
        agent-output/{project}/04-governance-constraints.json
```

## What gets discovered

- Policy assignments at subscription + management-group scope.
- Policy definitions and exemptions referenced by assignments.
- Effect classification (`Deny`, `Audit`, `Modify`, `DeployIfNotExists`).
- Dual-track property mapping — `bicepPropertyPath` + `azurePropertyPath` — so both IaC tracks can
  self-validate.
- SKU allowlist projection via `derive-sku-allowlist.mjs`, written into
  `sku-manifest.sku_allowlist_snapshot`.

## Review

1 × `governance-reconciliation` adversarial pass (mandatory when constraints exist; skipped when the
policy array is empty).

:::note[Approval Gate]
The user must approve governance constraints before proceeding to Step 4 planning.
:::

## Hand-off

The Orchestrator routes context to [`Step 4 — IaC
Plan`](/concepts/workflow/step-4/).
