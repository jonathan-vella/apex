---
title: "Step 6 — Deploy"
description: "Execute the Azure deployment with what-if/plan preview, security baseline, and policy precheck."
sidebar:
  order: 7
  label: "Step 6 — Deploy"
---

## Purpose

Execute the Azure deployment using the generated IaC. Both tracks run a preview step (what-if for
Bicep, `terraform plan` for Terraform), apply the security baseline, and gate the apply behind a
live policy precheck.

## Agents

- [`07b-Bicep
  Deploy`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/07b-bicep-deploy.agent.md)
  — uses `azd provision` (default) and `bicep-whatif-subagent` for preview.
- [`07t-Terraform
  Deploy`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/07t-terraform-deploy.agent.md)
  — uses `bootstrap.sh` / `deploy.sh` and `terraform-plan-subagent` for preview.
- [`policy-precheck-subagent`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/_subagents/policy-precheck-subagent.agent.md)
  — live policy + governance reconciliation, returns `deploy_gate = PROCEED|BLOCK`.

## Pre-deploy gates

:::caution[Pre-Deploy Security Review]
`npm run validate:iac-security-baseline` runs (TLS 1.2, HTTPS-only, no public blob, managed
identity, SQL Entra-only auth) and `challenger-review-subagent` performs a security-governance pass
on the what-if/plan output. Violations block deployment.
:::

## Invocation

```text
Bicep:     Invoke → 07b-Bicep Deploy
Terraform: Invoke → 07t-Terraform Deploy
Output:    agent-output/{project}/06-deployment-summary.md
```

## Review

No standalone challenger pass — policy precheck output is folded into the deployment summary as an
informational H2.

:::note[Approval Gate]
The user verifies deployed resources before proceeding to As-Built documentation.
:::

## Hand-off

The Orchestrator routes context to [`Step 7 —
As-Built`](/concepts/workflow/step-7/).
