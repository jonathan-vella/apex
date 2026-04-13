<!-- ref:known-deploy-issues-v1 -->

# Known Deploy Issues

Common deployment issues shared across Bicep and Terraform deploy agents.

| Issue                                         | Workaround                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| MSAL token stale (devcontainer/Codespaces)    | `az login --use-device-code` in the same terminal                                          |
| Azure extension auth ≠ CLI auth               | VS Code extension and `az` CLI use separate token stores — validate CLI auth independently |
| `az account show` succeeds but ARM calls fail | Always validate with `az account get-access-token`                                         |

## Bicep-Specific

| Issue                                 | Workaround                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| What-if fails (RG doesn't exist)      | Create RG first: `az group create ...`                                                         |
| deploy.ps1 JSON parsing errors        | Use direct `az deployment group create`                                                        |
| RBAC permission errors in what-if     | Use `--validation-level ProviderNoRbac`                                                        |
| What-if: unsupported AVM-managed RBAC | AVM manages role-assignment resource IDs at deploy time; surface in `06-deployment-summary.md` |

## Terraform-Specific

| Issue                                    | Workaround                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `terraform init` fails — backend missing | Run `bootstrap-backend.sh` first                                             |
| Backend state lock held                  | `terraform force-unlock {lease-id}` (requires explicit approval)             |
| `azurerm` provider init slow             | Provider cache: `TF_PLUGIN_CACHE_DIR=/home/vscode/.terraform.d/plugin-cache` |
| `terraform fmt -check` fails             | Run `terraform fmt -recursive` to auto-fix                                   |
