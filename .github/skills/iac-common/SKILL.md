---
name: iac-common
description: "Shared IaC patterns for Bicep and Terraform deploy agents: CLI auth validation, deployment strategies, known issues, and governance-to-code property mapping. USE FOR: Deploy agent auth, known issues lookup, phased deployment, governance mapping. DO NOT USE FOR: Code generation (use azure-bicep-patterns or terraform-patterns), architecture decisions, cost estimation."
---

# IaC Common Skill

Shared infrastructure-as-code patterns used by both Bicep and Terraform
deploy agents (07b, 07t) and review subagents.

---

## Azure CLI Authentication

**Always** validate CLI auth with a two-step check before any deployment:

1. `az account show` — confirms login session exists
2. `az account get-access-token --resource https://management.azure.com/` — confirms ARM token is valid

> `az account show` alone is NOT sufficient. MSAL token cache can be stale
> in devcontainers/WSL. See `azure-defaults/references/azure-cli-auth-validation.md`
> for the full recovery procedure.

**VS Code extension auth ≠ CLI auth**: Being signed into the Azure extension
does NOT authenticate CLI commands. Always validate independently.

---

## Deployment Strategies

### Phased Deployment (recommended for >5 resources)

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

---

## Known Issues (Cross-IaC)

| Issue                                 | Workaround                                            |
| ------------------------------------- | ----------------------------------------------------- |
| MSAL token stale (devcontainer/WSL)   | `az login --use-device-code` in the **same terminal** |
| Azure extension auth ≠ CLI auth       | Validate CLI auth independently                       |
| RBAC permission errors                | Use validation-level flags to isolate                 |
| JSON parsing errors in deploy scripts | Use direct `az deployment` / `terraform` commands     |

### Bicep-Specific

| Issue                            | Workaround                             |
| -------------------------------- | -------------------------------------- |
| What-if fails (RG doesn't exist) | Create RG first: `az group create ...` |

### Terraform-Specific

| Issue                                    | Workaround                                        |
| ---------------------------------------- | ------------------------------------------------- |
| `terraform init` fails — backend missing | Run `bootstrap-backend.sh` first                  |
| Backend state lock held                  | `terraform force-unlock {id}` (requires approval) |
| Provider init slow                       | Set `TF_PLUGIN_CACHE_DIR`                         |
| `terraform fmt -check` fails             | Run `terraform fmt -recursive` to auto-fix        |

---

## Governance-to-Code Property Mapping

When translating Azure Policy `Deny` constraints to IaC:

1. Read `04-governance-constraints.json` for the machine-actionable policy data
2. For each `Deny` policy, extract `azurePropertyPath` + `requiredValue`
3. Translate to IaC property:
   - **Bicep**: Drop leading resource-type segment from `azurePropertyPath`
   - **Terraform**: Use translation table in `terraform-policy-compliance.instructions.md`
4. Governance-discovered tags always win over the 4 baseline defaults

**Policy Effect Reference**: `azure-defaults/references/policy-effect-decision-tree.md`

---

## Stop Rules (Both IaC Tracks)

**STOP IMMEDIATELY if:**

- Auth validation fails (`az account get-access-token` error)
- Validation errors (`bicep build` / `terraform validate`)
- Delete/Destroy operations without explicit user approval
- > 10 resource changes (summarize first, then ask)
- User hasn't approved the deployment
- Deprecation signals detected in preview output

---

## Reference Index

| Reference                     | Location                                                      |
| ----------------------------- | ------------------------------------------------------------- |
| CLI auth validation procedure | `azure-defaults/references/azure-cli-auth-validation.md`      |
| Policy effect decision tree   | `azure-defaults/references/policy-effect-decision-tree.md`    |
| Bicep policy compliance       | `instructions/bicep-policy-compliance.instructions.md`        |
| Terraform policy compliance   | `instructions/terraform-policy-compliance.instructions.md`    |
| Bootstrap backend templates   | `terraform-patterns/references/bootstrap-backend-template.md` |
| Deploy script templates       | `terraform-patterns/references/deploy-script-template.md`     |
| Circuit breaker               | `references/circuit-breaker.md`                               |

## Circuit Breaker

Deploy agents MUST read `references/circuit-breaker.md` before starting
any deployment. It defines:

- **Failure taxonomy**: 6 categories (build, validation, deployment, empty, timeout, auth)
- **Anomaly patterns**: detection thresholds for repetitive failures
- **Stopping rule**: 3 consecutive same-type failures → halt + escalate
- **Escalation protocol**: write to session state, notify user, wait for guidance
