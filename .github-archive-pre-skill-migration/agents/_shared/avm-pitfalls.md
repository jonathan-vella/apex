# AVM Pitfalls & Common Issues

> **Purpose**: Document known AVM parameter issues and region limitations discovered during implementation.
> Updated: 2025-02-04

This file captures real-world issues encountered when using Azure Verified Modules.
**Agents MUST consult this file before generating Bicep code.**

---

## Region Limitations

Some Azure services are not available in all regions. Check before deployment.

| Service                          | Limitation                                                        | Solution                            |
| -------------------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| **Static Web Apps**              | Only: `westus2`, `centralus`, `eastus2`, `westeurope`, `eastasia` | Use `westeurope` for EU workloads   |
| **Azure OpenAI**                 | Limited regions - check Azure docs                                | Use `swedencentral` or `eastus`     |
| **Container Apps (Consumption)** | Most regions supported, some features region-specific             | Verify zone redundancy availability |

### Static Web App Pattern

```bicep
// Static Web Apps only support specific regions - hardcode westeurope for EU
var staticWebAppLocation = 'westeurope'  // NOT the location parameter!

module staticWebApp 'br/public:avm/res/web/static-site:0.9.3' = {
  params: {
    location: staticWebAppLocation  // Use hardcoded value
    // ...
  }
}
```

---

## AVM Parameter Type Mismatches

Parameters that don't match expected types or have changed between versions.

### Log Analytics Workspace (`operational-insights/workspace`)

| Parameter      | ❌ Wrong Type | ✅ Correct Type | Notes                         |
| -------------- | ------------- | --------------- | ----------------------------- |
| `dailyQuotaGb` | `int`         | `string`        | Must be string: `'1'` not `1` |

```bicep
// ❌ WRONG
dailyQuotaGb: 1

// ✅ CORRECT
dailyQuotaGb: '1'
```

### Container Apps Managed Environment (`app/managed-environment`)

| Parameter                         | ❌ Deprecated/Wrong | ✅ Correct                        |
| --------------------------------- | ------------------- | --------------------------------- |
| `logAnalyticsWorkspaceResourceId` | String parameter    | Use `appLogsConfiguration` object |

```bicep
// ❌ WRONG - deprecated parameter
logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId

// ✅ CORRECT - use appLogsConfiguration
appLogsConfiguration: {
  destination: 'azure-monitor'
}
```

### Container Apps (`app/container-app`)

| Parameter          | ❌ Deprecated         | ✅ Correct                 |
| ------------------ | --------------------- | -------------------------- |
| `scaleMinReplicas` | Individual parameters | Use `scaleSettings` object |
| `scaleMaxReplicas` | Individual parameters | Use `scaleSettings` object |

```bicep
// ❌ WRONG - deprecated individual params
scaleMinReplicas: 0
scaleMaxReplicas: 3

// ✅ CORRECT - use scaleSettings object
scaleSettings: {
  minReplicas: 0
  maxReplicas: 3
}
```

### SQL Server (`sql/server`)

| Parameter             | ❌ Wrong Pattern    | ✅ Correct Pattern               |
| --------------------- | ------------------- | -------------------------------- |
| `skuName` / `skuTier` | Separate parameters | Use `sku` object                 |
| `availabilityZone`    | Omitted             | Required: `availabilityZone: -1` |

```bicep
// ❌ WRONG - separate sku params
skuName: 'Basic'
skuTier: 'Basic'

// ✅ CORRECT - sku object + availabilityZone
sku: {
  name: 'Basic'
  tier: 'Basic'
}
availabilityZone: -1  // -1 = no zone redundancy
```

### App Service (`web/site`)

| Parameter                       | Status        | Notes                                          |
| ------------------------------- | ------------- | ---------------------------------------------- |
| `appInsightsInstrumentationKey` | ⚠️ Deprecated | Use connection string via app settings instead |

```bicep
// ❌ WRONG - deprecated parameter
appInsightsInstrumentationKey: appInsightsKey

// ✅ CORRECT - use app settings with connection string
siteConfig: {
  appSettings: [
    {
      name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
      value: appInsightsConnectionString
    }
  ]
}
```

### Key Vault (`key-vault/vault`)

| Parameter                   | ❌ Issue                        | ✅ Correct Pattern                  |
| --------------------------- | ------------------------------- | ----------------------------------- |
| `softDeleteRetentionInDays` | Cannot modify on existing vault | Omit parameter for existing vaults  |
| `enablePurgeProtection`     | Cannot disable once enabled     | Set `false` only for new dev vaults |

```bicep
// ❌ WRONG - will fail if vault exists with different retention
softDeleteRetentionInDays: 7

// ✅ CORRECT - omit for existing vaults, or match existing value
// For new vaults only:
enableSoftDelete: true
// softDeleteRetentionInDays: 90  // Only set on initial creation
```

> **Note**: Once a Key Vault is created, `softDeleteRetentionInDays` is immutable.
> Attempting to change it will result in deployment failure.

### Static Web App (`web/static-site`)

| Parameter | ❌ Issue                         | ✅ Correct Pattern |
| --------- | -------------------------------- | ------------------ |
| `sku`     | `Free` not available via ARM API | Use `Standard`     |

```bicep
// ❌ WRONG - Free SKU not available via ARM deployment
sku: 'Free'

// ✅ CORRECT - use Standard for ARM deployments
sku: 'Standard'
```

> **Note**: The `Free` tier can only be selected via Azure Portal.
> ARM/Bicep deployments must use `Standard` tier.

---

## Pre-Implementation Checklist

Before generating Bicep code, agents MUST:

1. **Check region limitations** for each resource type
2. **Query AVM schema** using `azure_bicep-get_azure_verified_module` for parameter structure
3. **Validate types** - watch for string vs int mismatches
4. **Check for object parameters** - many AVM modules use objects instead of flat params
5. **Run `bicep build`** after each module to catch errors early

---

## Validation Pattern

```powershell
# After generating each module, validate immediately
bicep build main.bicep

# If errors, check:
# 1. Parameter types (string vs int)
# 2. Object structures (sku, scaleSettings, etc.)
# 3. Deprecated parameters
# 4. Region availability
```

---

## How to Update This File

When encountering a new AVM issue:

1. Document the error message received
2. Add the correct pattern to this file
3. Include both wrong and correct examples
4. Update the bicep-code agent guardrails if pattern is common

---

_Last verified against AVM versions as of February 2025_
