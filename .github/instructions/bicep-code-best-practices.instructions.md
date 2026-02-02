---
description: "Infrastructure as Code best practices for Azure Bicep templates"
applyTo: "**/*.bicep"
---

# Bicep Development Best Practices

## Quick Reference

| Rule          | Standard                                                            |
| ------------- | ------------------------------------------------------------------- |
| Region        | `swedencentral` (alt: `germanywestcentral`)                         |
| Unique suffix | `var uniqueSuffix = uniqueString(resourceGroup().id)` in main.bicep |
| AVM first     | **MANDATORY** - Use Azure Verified Modules where available          |
| Tags          | Environment, ManagedBy, Project, Owner on ALL resources             |

## Naming Conventions

### Resource Patterns

| Resource   | Max | Pattern                        | Example                  |
| ---------- | --- | ------------------------------ | ------------------------ |
| Storage    | 24  | `st{project}{env}{suffix}`     | `stcontosodev7xk2`       |
| Key Vault  | 24  | `kv-{project}-{env}-{suffix}`  | `kv-contoso-dev-abc123`  |
| SQL Server | 63  | `sql-{project}-{env}-{suffix}` | `sql-contoso-dev-abc123` |

### Identifiers

Use lowerCamelCase for parameters, variables, resources, modules.

## Unique Names (CRITICAL)

```bicep
// main.bicep - Generate once, pass to ALL modules
var uniqueSuffix = uniqueString(resourceGroup().id)

module keyVault 'modules/key-vault.bicep' = {
  params: { uniqueSuffix: uniqueSuffix }
}

// Every module must accept uniqueSuffix and use it in resource names
var kvName = 'kv-${take(projectName, 10)}-${environment}-${take(uniqueSuffix, 6)}'
```

## Parameters

```bicep
@description('Azure region for all resources.')
@allowed(['swedencentral', 'germanywestcentral', 'northeurope'])
param location string = 'swedencentral'

@description('Unique suffix for resource naming.')
@minLength(5)
param uniqueSuffix string
```

## Security Defaults (MANDATORY)

```bicep
// Storage
supportsHttpsTrafficOnly: true
minimumTlsVersion: 'TLS1_2'
allowBlobPublicAccess: false
allowSharedKeyAccess: false  // Policy may require this

// SQL
azureADOnlyAuthentication: true
minimalTlsVersion: '1.2'
publicNetworkAccess: 'Disabled'
```

## Diagnostic Settings Pattern

```bicep
// Pass NAMES not IDs to diagnostic modules
module diagnostics 'modules/diagnostics.bicep' = {
  params: { appServiceName: appModule.outputs.appServiceName }
}

// In module - use existing keyword
resource appService 'Microsoft.Web/sites@2023-12-01' existing = {
  name: appServiceName
}
resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: appService  // ✅ Symbolic reference works
}
```

## Module Outputs (MANDATORY)

```bicep
// Every module must output BOTH ID and Name
output resourceId string = resource.id
output resourceName string = resource.name
output principalId string = resource.identity.principalId
```

## Azure Verified Modules (AVM)

**MANDATORY: Use AVM modules for ALL resources where an AVM module exists.**

Raw Bicep is only permitted when no AVM module exists AND user explicitly approves.
Document the rationale in implementation reference.

```bicep
// ✅ Use AVM for Key Vault
module keyVault 'br/public:avm/res/key-vault/vault:0.11.0' = {
  params: { name: kvName, location: location, tags: tags }
}

// ❌ Only use raw resources if no AVM exists
// Requires explicit user approval: "approve raw bicep"
```

### AVM Approval Workflow

1. **Check AVM availability**: Use `mcp_bicep_list_avm_metadata` or https://aka.ms/avm/index
2. **If AVM exists**: Use `br/public:avm/res/{service}/{resource}:{version}`
3. **If no AVM**: STOP and ask user: "No AVM module found for {resource}. Type **approve raw bicep** to proceed."
4. **If approved**: Document justification in implementation reference

## Patterns to Avoid

| Anti-Pattern           | Problem          | Solution                            |
| ---------------------- | ---------------- | ----------------------------------- |
| Hardcoded names        | Collisions       | Use `uniqueString()` suffix         |
| Missing `@description` | Poor docs        | Document all parameters             |
| Explicit `dependsOn`   | Unnecessary      | Use symbolic references             |
| Resource ID for scope  | BCP036 error     | Use `existing` + names              |
| S1 for zone redundancy | Policy blocks    | Use P1v3+                           |
| `RequestHeaders`       | ARM error        | Use `RequestHeader` (singular)      |
| WAF policy hyphens     | Validation fails | `wafpolicy{name}` alphanumeric only |
| Raw Bicep (no AVM)     | Policy drift     | Use AVM modules or get approval     |

## Zone Redundancy SKUs

| SKU       | Zone Redundancy  | Use Case            |
| --------- | ---------------- | ------------------- |
| S1/S2     | ❌ Not supported | Dev/test            |
| P1v3/P2v3 | ✅ Supported     | Production          |
| P1v4/P2v4 | ✅ Supported     | Production (latest) |

## Deployment Scripts

`deploy.ps1` must include:

- `[CmdletBinding(SupportsShouldProcess)]` for WhatIf
- Pre-flight checks (Azure CLI, Bicep CLI)
- `bicep build` and `bicep lint` validation
- What-if with change summary
- User confirmation before deploy

## Validation Commands

```bash
bicep build main.bicep
bicep lint main.bicep
az deployment group what-if --resource-group rg-example --template-file main.bicep
```
