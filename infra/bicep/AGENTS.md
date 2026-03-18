# Bicep Infrastructure

Agent instructions specific to the `infra/bicep/` subtree.

## Authentication Prerequisites

`az` and `azd` use **independent** MSAL token caches. A valid `az` session does **not**
authenticate `azd`. Container restarts and new devcontainer sessions can invalidate either
context. Both must be validated before any `azd` operation.

| Tool  | Token cache | Validate with                                                                        |
| ----- | ----------- | ------------------------------------------------------------------------------------ |
| `az`  | `~/.azure/` | `az account get-access-token --resource https://management.azure.com/ --output none` |
| `azd` | `~/.azd/`   | `azd auth login --check-status`                                                      |

```bash
# Step 1 — Azure CLI (az account show is NOT sufficient; must get a real token)
az account get-access-token \
  --resource https://management.azure.com/ --output none

# Step 2 — Azure Developer CLI (separate auth context)
azd auth login --check-status \
  || azd auth login --use-device-code
```

## Build Commands

```bash
# Validate a project's templates
bicep build infra/bicep/{project}/main.bicep
bicep lint infra/bicep/{project}/main.bicep

# Deploy with azd (preferred — when azure.yaml exists)
cd infra/bicep/{project}
azd provision --preview    # Preview
azd provision              # Deploy

# Deploy with deploy.ps1 (legacy fallback)
cd infra/bicep/{project}
pwsh deploy.ps1 -WhatIf
pwsh deploy.ps1
```

## Module Structure

Each project follows this layout:

```text
infra/bicep/{project}/
  main.bicep           # Orchestrator — parameters, unique suffix, module calls
  main.bicepparam      # Parameter values
  azure.yaml           # azd project manifest (preferred deployment method)
  deploy.ps1           # Deployment script — legacy fallback
  modules/
    *.bicep            # One module per resource or logical group
```

## Conventions

- **AVM-first**: Use `br/public:avm/res/{provider}/{resource}:{version}` for all resources that have an AVM module
- **Unique suffix**: Generate `uniqueString(resourceGroup().id)` once in `main.bicep`, pass to all modules
- **Tags**: Every resource gets the 4 required tags (`Environment`, `ManagedBy: Bicep`, `Project`, `Owner`)
- **Parameters**: Use `@description()` decorator on every parameter
- **Security**: TLS 1.2, HTTPS-only, managed identity, no public blob access, Azure AD-only SQL auth
- **No hardcoded secrets**: Use Key Vault references for sensitive values
- **Diagnostics**: Send logs to Log Analytics workspace; use AVM diagnostic settings pattern

## Governance

Before generating templates, always check `agent-output/{project}/04-governance-constraints.md`
for subscription-level Azure Policy requirements that may impose additional rules.
