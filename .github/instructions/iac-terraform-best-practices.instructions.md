---
description: "Terraform-specific IaC best practices for Azure templates. AVM-first, CAF naming, security baseline, provider pins."
applyTo: "**/*.tf"
---

# Terraform Best Practices

Azure values are canonical in [Copilot instructions](../copilot-instructions.md#azure-defaults-canonical);
shared naming, AVM, and security procedures live in [azure-defaults](../skills/azure-defaults/SKILL.md).
This file covers Terraform-specific patterns. Discovered policy constraints always take precedence.

## Security

Azure Policy always wins. Code adapts to policy, never the reverse.
See `references/iac-security-baseline.md` for shared security rules and
`references/iac-policy-compliance.md` for the full policy compliance workflow
including `azurePropertyPath` → Terraform argument translation tables.

## Policy Compliance

Cross-reference `04-governance-constraints.json` before writing templates.
Use `azurePropertyPath` (not `bicepPropertyPath`) for Terraform argument mapping.
See `references/iac-policy-compliance.md` for the full checklist, resource type
mapping table, and property path examples.

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
Terraform Registry API per `azure-defaults/references/terraform-conventions.md`.

**Pin AVM-TF modules to exact semver** (`version = "X.Y.Z"`), resolved at
plan time. Range constraints (`~> X.Y`, `>= X.Y.Z`) are NOT allowed in
APEX-generated `04-iac-contract.json` and are flagged by
`npm run validate:avm-versions`. CLI lookup:

```bash
curl -sf https://registry.terraform.io/v1/modules/Azure/avm-res-{path}/azurerm/versions \
  | jq -r '.modules[0].versions[0].version'
```

The shared stale-pin exception and freeze policy lives in
[`azure-defaults`](../skills/azure-defaults/SKILL.md).

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

## Cost Monitoring

Every deployment includes a budget resource. See `references/iac-cost-monitoring.md`.

## Repeatability

Zero hardcoded project-specific values. `var.project_name` has no default.
All tag values reference variables. Unique suffix via `random_string` (4 chars,
lower+numeric), generated once, passed everywhere.

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

- Policy compliance: `references/iac-policy-compliance.md`
- Security baseline: `references/iac-security-baseline.md`
- Cost monitoring: `references/iac-cost-monitoring.md`
- Governance discovery: `.github/instructions/governance-discovery.instructions.md`
- Azure defaults: `.github/skills/azure-defaults/SKILL.md`
- Terraform patterns skill: `.github/skills/terraform-patterns/SKILL.md`
