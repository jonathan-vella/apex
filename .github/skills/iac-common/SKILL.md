---
name: iac-common
description: "Shared IaC deploy patterns for Bicep and Terraform deploy agents: deployment strategies, circuit breaker, known deploy issues. For preflight validation (auth, governance, stop rules), see azure-validate. USE FOR: Phased deployment, circuit breaker, deploy-specific known issues. DO NOT USE FOR: Preflight validation (use azure-validate), code generation (use azure-bicep-patterns or terraform-patterns)."
---

# IaC Common Skill

Shared deployment patterns used by both Bicep and Terraform deploy agents
(07b, 07t) and review subagents.

> **Preflight validation** (CLI auth, governance mapping, stop rules, known issues)
> has moved to the **azure-validate** skill. See `azure-validate/references/infraops-preflight.md`.

---

## Deployment Strategies

### azd Deployment (recommended for Bicep projects with azure.yaml)

Use `azd` when the project has an `azure.yaml` manifest:

```bash
# Create/select environment
azd env new dev
azd env set AZURE_LOCATION swedencentral

# Preview changes (replaces what-if)
azd provision --preview

# Deploy infrastructure
azd provision

# Full provision + deploy in one step
azd up
```

**azd hooks** replace custom deploy.ps1 pre/post steps:

- `preprovision` — auth validation, banner, prerequisite checks
- `postprovision` — resource verification, diagnostic setup

**Environment management** replaces manual parameterization:

- `azd env new prod` / `azd env new dev`
- `azd env set AZURE_LOCATION swedencentral`

### azd Environment Preflight (MANDATORY for --no-prompt Deploys)

Before `azd provision --no-prompt`, verify these environment values are set:

- `AZURE_SUBSCRIPTION_ID` — from `az account show --query id -o tsv`
- `AZURE_RESOURCE_GROUP` — target resource group name
- `AZURE_ENV_NAME` — environment name
- `AZURE_LOCATION` — target region

Run `azd env get-values` and check for missing values. If any are empty,
set them via `azd env set {KEY} {VALUE}` before attempting `--no-prompt`.

### Phased Deployment via deploy.ps1 (legacy, backward-compatible)

| Phase      | Resources                             | Gate          |
| ---------- | ------------------------------------- | ------------- |
| Foundation | Resource group, networking, Key Vault | User approval |
| Security   | Identity, RBAC, certificates          | User approval |
| Data       | Storage, databases, messaging         | User approval |
| Compute    | App Service, Functions, containers    | User approval |
| Edge       | CDN, Front Door, DNS                  | User approval |

- **Bicep**: Pass `-Phase {name}` to `deploy.ps1`
- **Terraform**: Pass `-var deployment_phase={name}` to plan/apply

### Single Deployment (only for <5 resources, dev/test)

Deploy everything in one operation. Still requires user approval.

### Decision: azd vs deploy.ps1

| Factor                 | azd                            | deploy.ps1                  |
| ---------------------- | ------------------------------ | --------------------------- |
| Cross-platform         | Yes                            | PowerShell only             |
| Environment management | Built-in (`azd env`)           | Manual parameters           |
| Hooks (pre/post)       | `azure.yaml` hooks             | Custom script logic         |
| Phased deployment      | Single provision               | Fine-grained phases         |
| New projects           | **Use azd**                    | Not generated               |
| Existing projects      | Use azd if `azure.yaml` exists | Fallback if no `azure.yaml` |

---

## Reference Index

| Reference                     | Location                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| Preflight validation          | `azure-validate/references/infraops-preflight.md`                                                        |
| CLI auth validation procedure | `azure-defaults/references/azure-cli-auth-validation.md`                                                 |
| Policy effect decision tree   | `azure-defaults/references/policy-effect-decision-tree.md`                                               |
| IaC policy compliance         | `.github/instructions/iac-bicep-best-practices.instructions.md` / `iac-terraform-best-practices.instructions.md` |
| Bootstrap backend templates   | `terraform-patterns/references/bootstrap-backend-template.md`                                            |
| Deploy script templates       | `terraform-patterns/references/deploy-script-template.md`                                                |
| Circuit breaker               | `references/circuit-breaker.md`                                                                          |

## Circuit Breaker

Deploy agents MUST read `references/circuit-breaker.md` before starting
any deployment. It defines:

- **Failure taxonomy**: 6 categories (build, validation, deployment, empty, timeout, auth)
- **Anomaly patterns**: detection thresholds for repetitive failures
- **Stopping rule**: 3 consecutive same-type failures → halt + escalate
- **Escalation protocol**: write to session state, notify user, wait for guidance
