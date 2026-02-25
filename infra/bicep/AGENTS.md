# Bicep Infrastructure

Agent instructions specific to the `infra/bicep/` subtree.

## Build Commands

```bash
# Validate a project's templates
bicep build infra/bicep/{project}/main.bicep
bicep lint infra/bicep/{project}/main.bicep

# Deploy (what-if preview first)
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
  deploy.ps1           # Deployment script (PowerShell)
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
