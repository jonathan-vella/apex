---
description: "MANDATORY IaC best practices for Azure Bicep and Terraform templates. Covers security baseline, policy compliance, cost monitoring, repeatability, and Bicep-specific patterns."
applyTo: "**/*.bicep, **/*.tf, **/04-implementation-plan.md"
---

# IaC Best Practices

## Quick Reference

Region, tags, AVM-first mandate, unique suffix, and security baseline
are defined in the root `AGENTS.md` (always loaded). This file covers
IaC-specific patterns, policy compliance, cost monitoring, and repeatability.

**Policy constraints** (`04-governance-constraints.md`) ALWAYS take precedence.

---

## Security Baseline

**First Principle: Azure Policy always wins.** Current Azure Policy
implementation cannot be changed. Code MUST adapt to policy, never
the reverse.

### Bicep-Specific Security Implementation

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

### Zone Redundancy SKUs

| SKU       | Zone Redundancy  | Use Case            |
| --------- | ---------------- | ------------------- |
| S1/S2     | ❌ Not supported | Dev/test            |
| P1v3/P2v3 | ✅ Supported     | Production          |
| P1v4/P2v4 | ✅ Supported     | Production (latest) |

---

## Policy Compliance

### Mandate

ALL IaC code generation MUST cross-reference
`04-governance-constraints.md` and `04-governance-constraints.json`
before writing templates. These artifacts contain the discovered
Azure Policy constraints for the target subscription.

### Dynamic Tag List

Tags MUST come from governance constraints, not hardcoded defaults.
The 4 baseline defaults (`Environment`, `ManagedBy`, `Project`, `Owner`)
are a **MINIMUM** — discovered policies always win. If governance
constraints specify 9 tags, the generated code MUST include all 9.

#### Example

```text
Defaults (azure-defaults skill):  4 tags
Governance constraints discovered: 9 tags (environment, owner,
  costcenter, application, workload, sla, backup-policy,
  maint-window, tech-contact)
Required in generated code:       9 tags (governance wins)
```

### Policy Compliance Checklist

For every policy in `04-governance-constraints.json`:

#### Deny Policies

- [ ] Read property path and `requiredValue` from JSON
- [ ] Translate to IaC-specific argument (see implementation sections below)
- [ ] Verify the generated code sets the property to the required value
- [ ] If the property is missing, add it
- [ ] If the property value conflicts, change it to match policy

#### Modify Policies

- [ ] Document expected auto-modifications in the implementation reference
- [ ] Do NOT set values that Modify policies auto-apply (avoid conflicts)

#### DeployIfNotExists Policies

- [ ] Document auto-deployed resources in the implementation reference
- [ ] Include expected resources in cost estimates

#### Audit Policies

- [ ] Document compliance expectations
- [ ] Set compliant values where feasible (best effort)

### Implementation: Bicep

For Deny policies, prefer `azurePropertyPath` from JSON; fall back to
`bicepPropertyPath` if absent. Translate by dropping the leading
resource-type segment (e.g., `storageAccount.`) and using the remainder
as the ARM property path.

### Implementation: Terraform

#### `azurePropertyPath` Translation

For each Deny or Modify policy in `04-governance-constraints.json`,
read the `azurePropertyPath` field and translate it to the corresponding
`azurerm_*` resource argument:

1. Split `azurePropertyPath` on `.` → `[resourceType, "properties", ...rest]`
2. Map `resourceType` to the corresponding `azurerm_*` resource using the table below
3. Map the `properties.` path to the Terraform argument name (snake_case)

#### Resource Type Mapping

| `azurePropertyPath` prefix | Terraform resource                                  |
| -------------------------- | --------------------------------------------------- |
| `storageAccount`           | `azurerm_storage_account`                           |
| `keyVault`                 | `azurerm_key_vault`                                 |
| `sqlServer`                | `azurerm_mssql_server`                              |
| `sqlDatabase`              | `azurerm_mssql_database`                            |
| `cosmosDbAccount`          | `azurerm_cosmosdb_account`                          |
| `webApp`                   | `azurerm_linux_web_app` / `azurerm_windows_web_app` |
| `appServicePlan`           | `azurerm_service_plan`                              |
| `containerRegistry`        | `azurerm_container_registry`                        |
| `aksCluster`               | `azurerm_kubernetes_cluster`                        |
| `serviceBusNamespace`      | `azurerm_servicebus_namespace`                      |
| `eventHubNamespace`        | `azurerm_eventhub_namespace`                        |
| `logAnalyticsWorkspace`    | `azurerm_log_analytics_workspace`                   |

#### Property Path Mapping Examples

| `azurePropertyPath`                                  | Terraform Argument                        |
| ---------------------------------------------------- | ----------------------------------------- |
| `storageAccount.properties.minimumTlsVersion`        | `min_tls_version`                         |
| `storageAccount.properties.allowBlobPublicAccess`    | `allow_nested_items_to_be_public`         |
| `storageAccount.properties.supportsHttpsTrafficOnly` | `https_traffic_only_enabled`              |
| `sqlServer.properties.minimalTlsVersion`             | `minimum_tls_version`                     |
| `sqlServer.properties.publicNetworkAccess`           | `public_network_access_enabled`           |
| `keyVault.properties.enableSoftDelete`               | `soft_delete_retention_days` (> 0 = true) |
| `keyVault.properties.enablePurgeProtection`          | `purge_protection_enabled`                |
| `containerRegistry.properties.publicNetworkAccess`   | `public_network_access_enabled`           |
| `webApp.properties.httpsOnly`                        | `https_only`                              |

#### Audit Policy Comment Pattern

```hcl
resource "azurerm_storage_account" "this" {
  # AUDIT: Policy "Require diagnostic settings" — compliant if Log Analytics configured
  # ...
}
```

#### HCP Terraform Cloud Guardrail

**NEVER** use HCP Terraform Cloud (`terraform { cloud {} }`) or
reference `TFE_TOKEN` in generated code. State backend MUST be
Azure Storage Account. See `terraform-code-best-practices.instructions.md`.

### Enforcement Rule

**Azure Policy always wins.** A governance compliance failure is a
HARD GATE — the Code Generator MUST NOT proceed past Phase 1.5 with
unresolved policy violations.

### Policy Anti-Patterns

| Anti-Pattern                                            | Why It Fails                                                                              | Correct Approach                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Assume 4 tags are sufficient                            | Azure Policy may enforce 9+ tags                                                          | Read `04-governance-constraints.md` for actual tag list |
| Ignore `publicNetworkAccess` constraints                | Deny policy blocks deployment                                                             | Check network policies in governance constraints        |
| Skip governance constraints reading                     | Trusting the chain means accepting architecture decisions, NOT skipping compliance checks | Always read and enforce governance constraints          |
| Hardcode security settings without checking policy      | Policy may require stricter values                                                        | Cross-reference `04-governance-constraints.json`        |
| Generate code without reading governance constraints    | Governance-blind code fails deployment                                                    | Phase 1.5 is a HARD GATE                                |
| Use `terraform { cloud {} }` or `TFE_TOKEN` (Terraform) | Vendor lock-in; violates Azure-only backend policy                                        | Use `backend "azurerm"` with Azure Storage Account      |
| Use `bicepPropertyPath` for Terraform translation       | Bicep path format is ARM-only                                                             | Use `azurePropertyPath` for Terraform argument mapping  |

---

## Cost Monitoring (MANDATORY for every deployment)

Every IaC deployment MUST include these cost-management resources:

### 1. Azure Budget

- Resource type: `Microsoft.Consumption/budgets`
- Amount: Aligned to the cost estimate from Step 2 (`03-des-cost-estimate.md`)
- Time grain: Monthly
- Budget amount MUST be a parameter (never hardcoded)

### 2. Forecast Alerts

Three forecast-based contact notifications at:

| Threshold | Type     | Action                              |
| --------- | -------- | ----------------------------------- |
| 80%       | Forecast | Email notification to `owner` param |
| 100%      | Forecast | Email notification + action group   |
| 120%      | Forecast | Email notification + action group   |

### 3. Anomaly Detection

- Enable Azure Cost Management anomaly alerts
- Alert on unexpected spend spikes
- Notify `technicalContact` parameter

### Implementation Notes

- IaC Planner (05) MUST include budget resources in every implementation plan
- CodeGen agents (06b/06t) MUST generate the budget module/resource
- Challenger reviews MUST verify cost monitoring exists

---

## Repeatability (MANDATORY — zero hardcoded values)

Generated IaC templates MUST deploy to any tenant, region,
subscription, or customer without source code modification.

### Prohibited Hardcoded Values

| Category               | Example of Violation              | Required Fix                          |
| ---------------------- | --------------------------------- | ------------------------------------- |
| Project names          | `projectName = 'nordic-foods'`    | Parameter with no default             |
| Application names      | `application: 'FreshConnect'`     | Derive from parameter                 |
| Short names            | `var shortName = 'nff'`           | Parameter or `take(projectName, N)`   |
| Subscription/tenant ID | Inline GUIDs                      | Use `subscription().id` / parameters  |
| Resource group names   | `rg-my-project-dev`               | Parameter or convention from input    |
| Tag values             | `workload: 'my-project'`          | Use `projectName` parameter reference |
| Customer identifiers   | Any inline customer-specific text | Parameter                             |

### Rules

1. `projectName` parameter: no default value — caller must provide
2. `shortProjectName` parameter (or derived via `take()`): for length-constrained names
3. `applicationName` parameter: for tag and display-name use
4. All tag values: reference parameters, never inline strings
5. `.bicepparam` / `terraform.tfvars`: only place for project-specific defaults
6. `location` may have a convention default (`swedencentral`) — this is acceptable

---

## Bicep-Specific Patterns

### Naming Conventions

#### Resource Patterns

| Resource   | Max | Pattern                        | Example                  |
| ---------- | --- | ------------------------------ | ------------------------ |
| Storage    | 24  | `st{project}{env}{suffix}`     | `stcontosodev7xk2`       |
| Key Vault  | 24  | `kv-{project}-{env}-{suffix}`  | `kv-contoso-dev-abc123`  |
| SQL Server | 63  | `sql-{project}-{env}-{suffix}` | `sql-contoso-dev-abc123` |

#### Identifiers

Use lowerCamelCase for parameters, variables, resources, modules.

### Unique Names (CRITICAL)

```bicep
// main.bicep - Generate once, pass to ALL modules
var uniqueSuffix = uniqueString(resourceGroup().id)

module keyVault 'modules/key-vault.bicep' = {
  params: { uniqueSuffix: uniqueSuffix }
}

// Every module must accept uniqueSuffix and use it in resource names
var kvName = 'kv-${take(projectName, 10)}-${environment}-${take(uniqueSuffix, 6)}'
```

### Parameters

```bicep
@description('Azure region for all resources.')
@allowed(['swedencentral', 'germanywestcentral', 'northeurope'])
param location string = 'swedencentral'

@description('Unique suffix for resource naming.')
@minLength(5)
param uniqueSuffix string
```

### Diagnostic Settings Pattern

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

### Module Outputs (MANDATORY)

```bicep
// Every module must output BOTH ID and Name
output resourceId string = resource.id
output resourceName string = resource.name
output principalId string = resource.identity.principalId
```

### Azure Verified Modules (AVM)

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

#### AVM Approval Workflow

1. **Check AVM availability**: Use `mcp_bicep_list_avm_metadata` or https://aka.ms/avm/index
2. **If AVM exists**: Use `br/public:avm/res/{service}/{resource}:{version}`
3. **If no AVM**: STOP and ask user: "No AVM module found for {resource}. Type **approve raw bicep** to proceed."
4. **If approved**: Document justification in implementation reference

### Bicep Anti-Patterns

| Anti-Pattern           | Problem          | Solution                            |
| ---------------------- | ---------------- | ----------------------------------- |
| Hardcoded names        | Collisions       | Use `uniqueString()` suffix         |
| Hardcoded project name | Not repeatable   | Parameter with no default           |
| Hardcoded tag values   | Not repeatable   | Reference parameters                |
| Missing `@description` | Poor docs        | Document all parameters             |
| Explicit `dependsOn`   | Unnecessary      | Use symbolic references             |
| Resource ID for scope  | BCP036 error     | Use `existing` + names              |
| S1 for zone redundancy | Policy blocks    | Use P1v3+                           |
| `RequestHeaders`       | ARM error        | Use `RequestHeader` (singular)      |
| WAF policy hyphens     | Validation fails | `wafpolicy{name}` alphanumeric only |
| Raw Bicep (no AVM)     | Policy drift     | Use AVM modules or get approval     |
| No budget module       | No cost guard    | Include `modules/budget.bicep`      |

### Deployment Scripts

`deploy.ps1` must include:

- `[CmdletBinding(SupportsShouldProcess)]` for WhatIf
- Pre-flight checks (Azure CLI, Bicep CLI)
- `bicep build` and `bicep lint` validation
- What-if with change summary
- User confirmation before deploy

### Validation Commands

```bash
bicep build main.bicep
bicep lint main.bicep
az deployment group what-if --resource-group rg-example --template-file main.bicep
```

---

## Cross-References

- **Governance constraints artifact**: `agent-output/{project}/04-governance-constraints.md`
- **Governance constraints JSON**: `agent-output/{project}/04-governance-constraints.json`
- **Governance discovery instructions**: `.github/instructions/governance-discovery.instructions.md`
- **Azure defaults (baseline tags)**: `.github/skills/azure-defaults/SKILL.md`
- **Terraform best practices**: `.github/instructions/terraform-code-best-practices.instructions.md`
