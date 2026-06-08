---
title: "Step 5 — IaC Code"
description: "Generate AVM-aligned Bicep or Terraform templates with built-in lint and security review."
sidebar:
  order: 6
  label: "Step 5 — IaC Code"
---

## Purpose

Generate the IaC templates that realise the Step 4 plan, following Azure Verified Modules (AVM)
standards. The agent emits track-specific code plus an `05-implementation-reference.md` that maps
each AVM module to the plan's resource graph.

## Agents

Track-routed via `decisions.iac_tool`:

- [`06b-Bicep
  CodeGen`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/06b-bicep-codegen.agent.md)
- [`06t-Terraform
  CodeGen`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/06t-terraform-codegen.agent.md)

## Invocation

```text
Bicep:     Invoke → 06b-Bicep CodeGen
           Output  infra/bicep/{project}/main.bicep + modules/
Terraform: Invoke → 06t-Terraform CodeGen
           Output  infra/terraform/{project}/main.tf + modules/
Shared:    agent-output/{project}/05-implementation-reference.md
```

## Standards (both tracks)

- AVM-first composition; never re-derive resources by hand when an AVM module exists.
- Unique-suffix pattern for globally-named resources.
- Required tags enforced by `tag_contract` from Step 3.5.
- Security baseline: TLS 1.2, HTTPS-only, no public blob, managed identity, Entra-only SQL.
- Step 3.5 (governance) compliance mapping wired into module inputs.

## Preflight validation

| Bicep subagent            | Terraform subagent            | Validation                  |
| ------------------------- | ----------------------------- | --------------------------- |
| `bicep-validate-subagent` | `terraform-validate-subagent` | Lint + AVM code review      |

## Review

Opt-in by default. `decisions.review_depth = "deep"` or an explicit `10-Challenger` invocation
triggers an adversarial code review.

:::note[Approval Gate]
The user must approve preflight validation results before deployment.
:::

## Hand-off

The Orchestrator routes context to [`Step 6 —
Deploy`](/concepts/workflow/step-6/).
