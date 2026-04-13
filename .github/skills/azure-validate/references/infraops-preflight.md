<!-- ref:infraops-preflight-v1 — Merged from iac-common (Issue #240) -->

# InfraOps Preflight Validation

Additional preflight checks specific to the APEX workflow.
These augment the plugin's standard azure-validate checks.

## Azure CLI Authentication

**Always** validate CLI auth with a two-step check before any deployment:

1. `az account show` — confirms login session exists
2. `az account get-access-token --resource https://management.azure.com/` —
   confirms ARM token is valid

> `az account show` alone is NOT sufficient. MSAL token cache can be stale
> in devcontainers/WSL. See `azure-defaults/references/azure-cli-auth-validation.md`
> for the full recovery procedure.

**VS Code extension auth ≠ CLI auth**: Being signed into the Azure extension
does NOT authenticate CLI commands. Always validate independently.

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

## Governance-to-Code Property Mapping

When translating Azure Policy `Deny` constraints to IaC:

1. Read `04-governance-constraints.json` for the machine-actionable policy data
2. For each `Deny` policy, extract `azurePropertyPath` + `requiredValue`
3. Translate to IaC property:
   - **Bicep**: Drop leading resource-type segment from `azurePropertyPath`
   - **Terraform**: Use translation table in `.github/instructions/references/iac-policy-compliance.md`
4. Governance-discovered tags always win over the 4 baseline defaults

**Policy Effect Reference**: `azure-defaults/references/policy-effect-decision-tree.md`

## Stop Rules (Both IaC Tracks)

**STOP IMMEDIATELY if:**

- Auth validation fails (`az account get-access-token` error)
- Validation errors (`bicep build` / `terraform validate`)
- Delete/Destroy operations without explicit user approval
- > 10 resource changes (summarize first, then ask)
- User hasn't approved the deployment
- Deprecation signals detected in preview output
