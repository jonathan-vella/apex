---
name: terraform-patterns
description: '**UTILITY SKILL** — Reusable Azure Terraform patterns: hub-spoke, private endpoints, diagnostics, AVM-TF modules. WHEN: "hub-spoke Terraform", "private endpoint module", "AVM-TF composition", "diagnostic settings", "plan interpretation". DO NOT USE FOR: Bicep code (azure-bicep-patterns), ADRs (azure-adr), diagrams (drawio).'
compatibility: Requires Terraform >= 1.9, azurerm ~> 4.0, Azure CLI
---

# Azure Terraform Patterns Skill

Composable architecture building blocks for Azure Terraform. Complements
`iac-terraform-best-practices.instructions.md` (style) and `azure-defaults` skill (naming, tags, regions).

> **Canonical sources** — the security baseline, AVM-first mandate, naming
> conventions, required tags, and unique-suffix rule live in
> [`azure-defaults/SKILL.md`](../azure-defaults/SKILL.md) and
> [`iac-policy-compliance.md`](../../instructions/references/iac-policy-compliance.md).
> This skill restates the rules tersely below for IaC-output convenience
> only; in conflict, the canonical sources win.

---

## Quick Reference

| Pattern                  | When to Use                                      | Reference                                  |
| ------------------------ | ------------------------------------------------ | ------------------------------------------ |
| Hub-Spoke Networking     | Multi-workload environments with shared services | `references/hub-spoke-pattern.md`          |
| Private Endpoint Wiring  | Any PaaS service requiring private connectivity  | `references/private-endpoint-pattern.md`   |
| Diagnostic Settings      | Every deployed resource (mandatory)              | `references/common-patterns.md`            |
| Conditional Deployment   | Optional resources controlled by variables       | `references/common-patterns.md`            |
| Module Composition       | Calling multiple AVM modules in root module      | See inline example below                   |
| Managed Identity         | Any service-to-service authentication            | `references/common-patterns.md`            |
| Budget & Cost Monitoring | Every deployment (mandatory)                     | `references/budget-pattern.md`             |
| Plan Interpretation      | Pre-deployment validation and change analysis    | `references/plan-interpretation.md`        |
| AVM Pitfalls             | Set-type diffs, provider pins, 4.x changes       | `references/avm-pitfalls.md`               |
| AVM Authoring            | AVM certification requirements, compliance       | `references/avm-authoring-requirements.md` |
| Module Refactoring       | Monolith → module extraction, state migration    | `references/refactor-module.md`            |

---

## Canonical Example — Module Composition

Wire AVM child modules by passing outputs as inputs (`module.<name>.<output>`); never
hardcode IDs. **AVM-TF module versions in APEX-generated code MUST be exact semver
(`version = "X.Y.Z"`)** — pinned at plan time from
`registry.terraform.io` (newest stable in `modules[0].versions[]`). Range
constraints (`~> X.Y`, `>= X.Y.Z`) are NOT allowed in `04-iac-contract.json` and
will be flagged by `npm run validate:avm-versions`. Full code sample
(resource group + key vault) and rationale in
[`references/module-composition.md`](references/module-composition.md).

---

## Rules

- **AVM-first**: Use `Azure/avm-res-*` registry modules over raw `azurerm_*` resources
- **AVM-TF version pins**: Exact semver only (`version = "X.Y.Z"`) — resolve the latest stable via `registry.terraform.io/v1/modules/Azure/avm-res-{path}/azurerm/versions` at plan time. Stale pins need a `pin_policy.mode = "exception"` block in `04-iac-contract.json`. Range constraints (`~>`, `>=`) are flagged by `validate:avm-versions`.
- **Hub-spoke**: Spokes peer to hub only; never spoke-to-spoke
- **Private endpoints**: Three resources per service — PE, DNS zone, VNet link
- **Diagnostics**: Every resource MUST have a diagnostic setting → Log Analytics
- **Conditional**: Use `for_each` (keyed) over `count` (indexed) for named resources
- **Identity**: SystemAssigned managed identity + RBAC; avoid keys/connection strings
- **Provider pin**: `~> 4.0` (allows 4.x patches, blocks 5.0)
- **Telemetry**: Set `enable_telemetry = false` in restricted-network environments
- **Moved blocks**: Use `moved {}` when renaming resources to prevent destroy/recreate
- **Budget**: 3 forecast thresholds (80%/100%/120%); amount and emails MUST be variables

## Steps

Applying a Terraform pattern in a root module:

1. **Identify the pattern** — match your need to a row in [Quick Reference](#quick-reference) (hub-spoke, private endpoint, diagnostics, conditional, identity, budget, plan interpretation)
2. **Load the reference** — read the linked `references/*.md`; do not load all at once
3. **Compose AVM modules** — wire outputs as inputs (see [Canonical Example](#canonical-example--module-composition)); never hardcode IDs
4. **Pin the provider** — `~> 4.0` only; do not use `>= 3.0` or exact `= 4.x.y`
5. **Add diagnostics + budget** — every resource gets a diagnostic setting; every deployment gets a budget with 80%/100%/120% forecast alerts
6. **Plan before apply** — `terraform plan -out=plan.tfplan`; review for `~`/`-`/`+/-` operations against [`references/plan-interpretation.md`](references/plan-interpretation.md)
7. **Validate** — `terraform fmt -check`, `terraform validate`, `npm run validate:terraform`, `npm run validate:iac-security-baseline`

## Gotchas

- **Set-type phantom diffs** — `azurerm_application_gateway`, `azurerm_lb`,
  `azurerm_network_security_group`, `azurerm_firewall`, `azurerm_frontdoor`:
  adding ONE element causes ALL elements to show `~` changes. Mitigation:
  `ignore_changes` on set-type blocks.
- **Provider pin `~> 4.0` is critical** — `>= 3.0` crosses breaking
  versions; `= 4.1.0` blocks patches. MUST use `~> 4.0`.
- **`for_each` over `count` for named resources** — `count` causes drift
  when items are inserted/removed (Terraform reindexes).
  Use `for_each = toset()`.
- **`moved` block required for renaming** — Renaming a resource ID
  without a `moved {}` block causes destroy + recreate.
- **azurerm 4.x renamed attributes** —
  `allow_blob_public_access` → `allow_nested_items_to_be_public`;
  `enable_https_traffic_only` → `https_traffic_only_enabled`;
  `azurerm_app_service` removed → use `azurerm_linux_web_app`.

---

## Reference Index

| File                                       | Contents                                                          |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `references/hub-spoke-pattern.md`          | Full hub & spoke VNet + peering HCL                               |
| `references/private-endpoint-pattern.md`   | PE + DNS zone + VNet link HCL, subresource table                  |
| `references/common-patterns.md`            | Diagnostics, conditional deployment, module composition, identity |
| `references/budget-pattern.md`             | Consumption budget, forecast alerts, anomaly detection            |
| `references/plan-interpretation.md`        | Plan commands, change symbols, red flags, summary script          |
| `references/avm-pitfalls.md`               | Set-type diffs, provider pins, tag ignore, moved blocks, 4.x      |
| `references/tf-best-practices-examples.md` | Best-practice code examples, formatting, code review checklist    |
| `references/bootstrap-backend-template.md` | Backend bootstrap template                                        |
| `references/deploy-script-template.md`     | Deployment script template                                        |
| `references/project-scaffold.md`           | Project scaffolding structure                                     |
| `references/avm-authoring-requirements.md` | AVM certification: 37 requirements, compliance checklist          |
| `references/refactor-module.md`            | Module extraction, state migration, refactoring patterns          |
| `references/module-composition.md`         | Canonical AVM module composition example with output wiring       |
