---
description: "Terraform-specific IaC best practices for Azure templates. AVM-first, CAF naming, security baseline, provider pins."
applyTo: "**/*.tf"
---

# Terraform Best Practices

Azure values are canonical in [Copilot instructions](../copilot-instructions.md#azure-defaults-canonical);
shared naming, AVM, and security procedures live in [apex-azure-defaults](../skills/apex-azure-defaults/SKILL.md).
This file covers Terraform-specific patterns. Discovered policy constraints always take precedence.

## Policy and Security

Azure Policy always wins. Code adapts to policy, never the reverse.
Cross-reference `04-governance-constraints.json` before writing templates; use
`azurePropertyPath` (not `bicepPropertyPath`) for Terraform argument mapping. Shared rules:
`references/iac-security-baseline.md` and `references/iac-policy-compliance.md`
(checklist, resource type mapping and `azurePropertyPath` → Terraform argument tables).

## Provider and Backend

| Rule          | Standard                                          |
| ------------- | ------------------------------------------------- |
| Provider      | Pin `azurerm` to `~> 4.0`, `random ~> 3.0`        |
| Terraform     | >= 1.9                                            |
| State backend | Azure Storage Account — never HCP Terraform Cloud |

Never use `terraform { cloud {} }` or reference `TFE_TOKEN`.

## File Structure

| File                           | Purpose                                |
| ------------------------------ | -------------------------------------- |
| `main.tf`                      | Root module resources and module calls |
| `variables.tf` / `outputs.tf`  | Input/output declarations              |
| `providers.tf` / `versions.tf` | Provider and required_providers blocks |
| `locals.tf`                    | Local value computations               |
| `backend.tf`                   | Remote state backend configuration     |

## Naming

Singletons: `.this`. Multiples: `.app`, `.data`. Lowercase with hyphens.
CAF abbreviations (see `AGENTS.md` for the full table).

## AVM Modules

Use `Azure/avm-res-{service}-{resource}/azurerm` for all resources.
Raw `azurerm_*` only with approval. Resolve versions through the public
Terraform Registry API per `apex-azure-defaults/references/terraform-conventions.md`.

**Pin AVM-TF modules to exact semver** (`version = "X.Y.Z"`), resolved at
plan time from the public Terraform Registry. Range constraints (`~> X.Y`, `>= X.Y.Z`)
are NOT allowed in APEX-generated `04-iac-contract.json` and are flagged by
`npm run validate:avm-versions`. Lookup procedure and the stale-pin/freeze policy live in
[`apex-azure-defaults`](../skills/apex-azure-defaults/SKILL.md).

> Provider-version pins (`azurerm`) are different — those use `~> 4.0`
> major-series constraints (`>= 4.0.0, < 5.0.0`) to allow minor and patch upgrades.
> A constraint such as `~> 4.0.0` would allow patch upgrades only (`< 4.1.0`). The exact-semver
> rule applies to **AVM-TF module pins only**.

## RBAC Least Privilege

Blocked for app runtime: `Owner`, `Contributor`, `User Access Administrator`.

| Resource Type | Approved Role(s)                       |
| ------------- | -------------------------------------- |
| Key Vault     | `Key Vault Secrets User`               |
| Storage Blob  | `Storage Blob Data Reader/Contributor` |
| SQL Database  | `SQL DB Contributor` / Entra DB roles  |
| Service Bus   | `Service Bus Data Sender/Receiver`     |
| ACR Pull      | `AcrPull`                              |

SQL: Prefer Entra DB roles. Never `Contributor` at server scope.

## Cost Monitoring and Repeatability

Every deployment includes a budget resource (`references/iac-cost-monitoring.md`).
Zero hardcoded project-specific values: `var.project_name` has no default and tag values
reference variables. Unique suffix via `random_string` (4 chars, lower+numeric), generated
once, passed everywhere.

## Anti-Patterns

| Anti-Pattern                    | Solution                           |
| ------------------------------- | ---------------------------------- |
| Hardcoded resource names        | Use `random_string.suffix`         |
| Missing `description` on vars   | Document all input variables       |
| `>= 3.0` provider version range | Use `~> 4.0` major-series constraint |
| Raw `azurerm_*` when AVM exists | Use AVM-TF modules or get approval |
| `connection_string` auth        | Use managed identity RBAC          |
| AVM-TF `version = "~> X.Y"`     | Use exact semver `version = "X.Y.Z"` — resolved live from `registry.terraform.io` at plan time |

## Validation

```bash
terraform fmt -recursive && terraform validate
```

## Cross-References

- Governance discovery: `.github/instructions/governance-discovery.instructions.md`
- Terraform patterns skill: `.github/skills/apex-terraform-patterns/SKILL.md`
