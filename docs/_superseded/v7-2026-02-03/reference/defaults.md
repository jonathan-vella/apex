# Defaults Reference

> Version: see [VERSION.md](../../VERSION.md) | Single source of truth for regions, naming, tags, and SKUs

This document centralizes all default configuration values for Agentic InfraOps. All other documentation and agent
files should reference this document rather than duplicating content.

---

## Default Regions

| Purpose              | Region               | Location             | Rationale                                 |
| -------------------- | -------------------- | -------------------- | ----------------------------------------- |
| **Primary**          | `swedencentral`      | Sweden Central       | EU GDPR compliant, sustainable operations |
| **Alternative**      | `germanywestcentral` | Germany West Central | Fallback for quota issues                 |
| **Preview Features** | `eastus`             | East US              | Early access to new Azure features        |

### Region Selection Guidelines

| Requirement               | Recommended Region   | Notes                           |
| ------------------------- | -------------------- | ------------------------------- |
| Default (no constraints)  | `swedencentral`      | Sustainable, EU-compliant       |
| German data residency     | `germanywestcentral` | German sovereignty requirements |
| Swiss banking/healthcare  | `switzerlandnorth`   | Swiss regulations               |
| UK GDPR requirements      | `uksouth`            | UK data residency               |
| French data sovereignty   | `francecentral`      | French regulations              |
| APAC latency optimization | `southeastasia`      | Asia-Pacific users              |
| Americas latency          | `eastus`, `westus2`  | North/South America users       |
| Preview feature access    | `eastus`, `westus2`  | New Azure features first        |

📖 **Full guidance**: See [ADR-004: Region Defaults (Archived)][adr-004]

---

## CAF Naming Conventions

Follow Cloud Adoption Framework pattern: `{type}-{workload}-{env}-{region}-{instance}`

### Region Abbreviations

| Region               | Abbreviation |
| -------------------- | ------------ |
| `swedencentral`      | `swc`        |
| `germanywestcentral` | `gwc`        |
| `westeurope`         | `weu`        |
| `northeurope`        | `neu`        |
| `eastus`             | `eus`        |
| `eastus2`            | `eus2`       |
| `westus2`            | `wus2`       |
| `southeastasia`      | `sea`        |
| `australiaeast`      | `aue`        |

### Resource Type Prefixes

| Resource Type          | Prefix  | Example                 | Max Length |
| ---------------------- | ------- | ----------------------- | ---------- |
| Resource Group         | `rg-`   | `rg-ecommerce-prod-swc` | 90         |
| Virtual Network        | `vnet-` | `vnet-hub-prod-swc-001` | 64         |
| Subnet                 | `snet-` | `snet-web-prod-swc`     | 80         |
| Network Security Group | `nsg-`  | `nsg-web-prod-swc`      | 80         |
| Key Vault              | `kv-`   | `kv-app-dev-a1b2c3`     | **24**     |
| Storage Account        | `st`    | `steabordevswca1b2c3`   | **24**     |
| App Service            | `app-`  | `app-api-prod-swc`      | 60         |
| App Service Plan       | `asp-`  | `asp-web-prod-swc`      | 40         |
| Azure SQL Server       | `sql-`  | `sql-crm-prod-swc-main` | **63**     |
| Log Analytics          | `log-`  | `log-platform-prod-swc` | 63         |
| Application Insights   | `appi-` | `appi-web-prod-swc`     | 255        |

### Name Length Constraints

> ⚠️ **Critical**: These resources have strict length limits that cause deployment failures if exceeded.

| Resource        | Max Length | Special Rules                    |
| --------------- | ---------- | -------------------------------- |
| Key Vault       | 24 chars   | Alphanumeric + hyphens           |
| Storage Account | 24 chars   | Lowercase + numbers only, NO `-` |
| SQL Server      | 63 chars   | Lowercase + numbers + hyphens    |

### Unique Suffix Pattern

Generate unique suffixes in `main.bicep` and pass to all modules:

```bicep
// main.bicep - Generate suffix once
var uniqueSuffix = uniqueString(resourceGroup().id)

// Pass to all modules
module keyVault 'modules/key-vault.bicep' = {
  params: {
    uniqueSuffix: uniqueSuffix
  }
}

// modules/key-vault.bicep - Apply to resource names
param uniqueSuffix string
var keyVaultName = 'kv-${take(replace(projectName, '-', ''), 8)}-${take(environment, 3)}-${take(uniqueSuffix, 6)}'
// Result: "kv-contosop-dev-abc123" (22 chars, within 24 limit)
```

---

## Required Tags

All Azure resources **MUST** include these tags:

| Tag           | Required | Description            | Example Values                   |
| ------------- | -------- | ---------------------- | -------------------------------- |
| `Environment` | ✅ Yes   | Deployment environment | `dev`, `staging`, `prod`, `demo` |
| `ManagedBy`   | ✅ Yes   | IaC tool used          | `Bicep`, `ARM`                   |
| `Project`     | ✅ Yes   | Project identifier     | `ecommerce`, `patient-portal`    |
| `Owner`       | ✅ Yes   | Team or individual     | `platform-team`, `john.doe`      |
| `CostCenter`  | Optional | Billing allocation     | `CC-12345`                       |

### Bicep Tag Pattern

```bicep
var tags = {
  Environment: environment
  ManagedBy: 'Bicep'
  Project: projectName
  Owner: owner
  CostCenter: costCenter
  DeploymentDate: utcNow('yyyy-MM-dd')
}
```

---

## SKU Recommendations

### By Environment

| Environment | Compute      | Storage      | Database    | Notes             |
| ----------- | ------------ | ------------ | ----------- | ----------------- |
| Dev/Demo    | B-series VMs | Standard_LRS | Basic/S0    | Cost-optimized    |
| Staging     | D-series VMs | Standard_ZRS | Standard/S1 | Zone-redundant    |
| Production  | D/E-series   | Premium_ZRS  | Premium/P1+ | HA, geo-redundant |

### Zone Redundancy Requirements

> ⚠️ **App Service Plans**: Must use **P1v4** or higher for zone redundancy. Standard SKU (S1/S2/S3) does NOT support
> zone redundancy.

| Resource         | Zone-Redundant SKU | Non-ZR Alternative |
| ---------------- | ------------------ | ------------------ |
| App Service Plan | P1v4, P2v4, P3v4   | S1, S2, S3         |
| Storage Account  | Standard_ZRS       | Standard_LRS       |
| Azure SQL        | Premium, Business  | Basic, Standard    |

---

## Azure Verified Modules (AVM)

**Always prefer AVM modules over raw Bicep resources.**

### AVM Registry

- **Registry**: `br/public:avm/res/*`
- **Documentation**: <https://aka.ms/avm>
- **Module Index**: <https://aka.ms/avm/index>

### Common AVM Modules

| Resource        | Module Path                                        | Min Version |
| --------------- | -------------------------------------------------- | ----------- |
| Key Vault       | `br/public:avm/res/key-vault/vault`                | `0.11.0`    |
| Virtual Network | `br/public:avm/res/network/virtual-network`        | `0.5.0`     |
| NSG             | `br/public:avm/res/network/network-security-group` | `0.4.0`     |
| Storage Account | `br/public:avm/res/storage/storage-account`        | `0.14.0`    |
| App Service     | `br/public:avm/res/web/site`                       | `0.8.0`     |
| SQL Server      | `br/public:avm/res/sql/server`                     | `0.8.0`     |

📖 **Full guidance**: See [ADR-003: AVM-First Approach (Archived)][adr-003]

---

## Security Baseline

All resources should follow these security principles:

| Principle             | Implementation                          |
| --------------------- | --------------------------------------- |
| 🔒 Encryption         | TLS 1.2+ in transit, encryption at rest |
| 🚫 No Public Access   | Private endpoints where possible        |
| 🛡️ Network Isolation  | NSGs on all subnets, deny by default    |
| 🔑 Managed Identities | Prefer over connection strings          |
| 📝 Audit Logging      | Enable diagnostic settings              |
| 🔄 Soft Delete        | Enable for Storage and Key Vault        |

### Common Azure Policy Requirements

| Policy                        | Solution                               |
| ----------------------------- | -------------------------------------- |
| SQL Server Azure AD-only auth | `azureADOnlyAuthentication: true`      |
| Storage shared key access     | Use identity-based storage connections |
| App Service zone redundancy   | Use P1v4+ SKU (not Standard)           |

---

## Related Documentation

- [Workflow Guide](workflow.md) — 7-step agent workflow
- [Agents Overview](agents-overview.md) — All 7 agents
- [Bicep Patterns](bicep-patterns.md) — Deployment patterns
- [ADR-003: AVM-First (Archived)][adr-003]
- [ADR-004: Region Defaults (Archived)][adr-004]

[adr-003]: ../_superseded/adr/ADR-003-avm-first-approach.md
[adr-004]: ../_superseded/adr/ADR-004-region-defaults.md
