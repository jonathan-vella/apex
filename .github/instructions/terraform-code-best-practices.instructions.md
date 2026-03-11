---
description: "Infrastructure as Code best practices for Azure Terraform templates. AVM-first, CAF naming, security baseline."
applyTo: "**/*.tf"
---

# Terraform Development Best Practices

## Quick Reference

| Rule          | Standard                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| Region        | `swedencentral` (alt: `germanywestcentral`)                              |
| Unique suffix | `resource "random_string" "suffix" { length = 4; lower = true }` in root |
| AVM first     | **MANDATORY** - Use Azure Verified Modules where available               |
| Tags          | Environment, ManagedBy, Project, Owner on ALL resources                  |
| Provider      | Pin `azurerm` to `~> 4.0`                                                |
| State backend | Azure Storage Account — **NEVER** HCP Terraform Cloud                    |

**Policy constraints** (`04-governance-constraints.md`) always override these defaults.

## File Structure (MANDATORY)

| File                           | Purpose                                |
| ------------------------------ | -------------------------------------- |
| `main.tf`                      | Root module resources and module calls |
| `variables.tf` / `outputs.tf`  | Input/output declarations              |
| `providers.tf` / `versions.tf` | Provider and required_providers blocks |
| `locals.tf`                    | Local value computations               |
| `backend.tf`                   | Remote state backend configuration     |

## Naming Conventions

Singletons: `.this`. Multiples: `.app`, `.data`.
Lowercase with hyphens. CAF abbreviations:

| Resource        | Pattern                        | Example                |
| --------------- | ------------------------------ | ---------------------- |
| Resource Group  | `rg-{project}-{env}`           | `rg-contoso-dev`       |
| Virtual Network | `vnet-{project}-{env}`         | `vnet-contoso-dev`     |
| Key Vault       | `kv-{short}-{env}-{suffix}`    | `kv-contoso-dev-a1b2`  |
| Storage Account | `st{short}{env}{suffix}`       | `stcontosodeva1b2`     |
| App Service     | `app-{project}-{env}-{suffix}` | `app-contoso-dev-a1b2` |
| SQL Server      | `sql-{project}-{env}-{suffix}` | `sql-contoso-dev-a1b2` |

## Core Configuration

- **Unique Suffix**: `random_string` (length 4, lower+numeric) — generate once, pass everywhere.
- **Provider**: Pin `azurerm ~> 4.0`, `random ~> 3.0`. Terraform >= 1.9.
- **State Backend**: Azure Storage Account. **NEVER** HCP Terraform Cloud.
- **Tags**: 4 mandatory (Environment, ManagedBy, Project, Owner) — `local.tags` everywhere.
- **Security**: TLS 1.2+, HTTPS-only, no public blob, managed identity preferred.

**Policy constraints** (`04-governance-constraints.md`) ALWAYS override defaults above.

## RBAC Least Privilege (MANDATORY)

**Blocked** for app runtime: `Owner`, `Contributor`, `User Access Administrator`.

| Resource Type | Approved Role(s)                       | Required Scope        |
| ------------- | -------------------------------------- | --------------------- |
| Key Vault     | `Key Vault Secrets User`               | Key Vault resource ID |
| Storage Blob  | `Storage Blob Data Reader/Contributor` | Account or container  |
| SQL Database  | `SQL DB Contributor` / Entra DB roles  | Database scope        |
| Service Bus   | `Service Bus Data Sender/Receiver`     | NS or queue/topic     |
| Event Hubs    | `Event Hubs Data Sender/Receiver`      | NS or hub             |
| ACR Pull      | `AcrPull`                              | Registry scope        |

**SQL**: Prefer Entra DB roles. Never `Contributor` at server scope.

**Exceptions**: (1) `RBAC_EXCEPTION_APPROVED: <ticket>`, (2) docs justification,
(3) time-bound review. Missing any = non-compliant.

## Azure Verified Modules (AVM-TF)

**MANDATORY**: Use `Azure/avm-res-{service}-{resource}/azurerm` for all resources.
Lookup: `mcp_terraform_get_latest_module_version`. Raw `azurerm_*` only with approval.

## Patterns to Avoid

| Anti-Pattern                    | Problem                      | Solution                               |
| ------------------------------- | ---------------------------- | -------------------------------------- |
| Hardcoded resource names        | Naming collisions            | Use `random_string.suffix`             |
| Missing `description` on vars   | Poor documentation           | Document all input variables           |
| `>= 3.0` provider version range | Unintended major upgrades    | Use `~> 4.0` for minor-version pinning |
| Raw `azurerm_*` when AVM exists | Policy drift and maintenance | Use AVM-TF modules or get approval     |
| `connection_string` auth        | Credential exposure          | Use managed identity RBAC              |

## Validation Commands

```bash
terraform fmt -recursive && terraform validate
terraform plan -out=plan.tfplan
```

## Cross-References

- **Policy**: `terraform-policy-compliance.instructions.md`
- **Governance**: `governance-discovery.instructions.md`
- **Patterns**: `terraform-patterns/SKILL.md` | **Defaults**: `azure-defaults/SKILL.md`
- **HCL examples**: `terraform-patterns/references/tf-best-practices-examples.md`
