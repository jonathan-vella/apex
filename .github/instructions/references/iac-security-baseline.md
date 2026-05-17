# IaC Security Baseline

Shared security rules for both Bicep and Terraform IaC generation.
Referenced by `iac-bicep-best-practices.instructions.md` and
`iac-terraform-best-practices.instructions.md`.

## First Principle

Azure Policy always wins. Current Azure Policy implementation cannot
be changed. Code adapts to policy, never the reverse.

## Zone Redundancy SKUs

| SKU       | Zone Redundancy | Use Case            |
| --------- | --------------- | ------------------- |
| S1/S2     | Not supported   | Dev/test            |
| P1v3/P2v3 | Supported       | Production          |
| P1v4/P2v4 | Supported       | Production (latest) |

## Diagnostic Settings — required on every resource

Every Azure resource that supports diagnostic settings must route platform
logs and metrics to the project Log Analytics workspace. A plan that wires
diagnostics for **App Service only** (a common omission) is non-compliant.

### Minimum coverage

| Service | Log categories | Metrics | Notes |
| ------- | -------------- | ------- | ----- |
| Key Vault | `AuditEvent`, `AzurePolicyEvaluationDetails` | `AllMetrics` | Required for secret-access audit trail. |
| Storage (account + blob/file/queue/table services) | `StorageRead`, `StorageWrite`, `StorageDelete` | `Transaction` | Diagnostics belong on the service resource (blobServices/fileServices), not the account itself. |
| SQL Server / Database | `SQLSecurityAuditEvents`, `AutomaticTuning`, `Blocks`, `DatabaseWaitStatistics` | `Basic` | Auditing already routes to Log Analytics via `auditing.isAzureMonitorTargetEnabled`; diagnostic settings provide the complementary platform-log stream. |
| App Service / Function App | `AppServiceHTTPLogs`, `AppServiceConsoleLogs`, `AppServiceAppLogs`, `AppServiceAuditLogs` | `AllMetrics` | Already commonly wired; keep enabled. |
| Networking (NSG, VNet, Private Endpoint, App Gateway, Front Door) | `AllLogs` (service-dependent) | `AllMetrics` | Required for flow-log + private-link diagnostics. |
| Container Registry / Container Apps / AKS | service-specific log categories | `AllMetrics` | Required for image-pull + runtime audit. |

### Required parameter shape

The diagnostic settings block (Bicep) lives on the AVM module call or as a
sibling `Microsoft.Insights/diagnosticSettings` resource:

```bicep
diagnosticSettings: [
  {
    workspaceResourceId: logAnalyticsWorkspaceId
    logs: [ /* service-specific categories */ ]
    metrics: [ { category: 'AllMetrics', enabled: true } ]
    logAnalyticsDestinationType: 'Dedicated'  // recommended over 'AzureDiagnostics'
  }
]
```

The `logAnalyticsWorkspaceId` parameter must appear in every module's
Code-Generation Contract that owns a diag-settings-bearing resource — not
only the App Service module.

### Anti-pattern

A plan whose Code-Generation Contract lists `logAnalyticsWorkspaceId` only
on `compute.bicep` (App Service) and omits it from `keyvault.bicep`,
`storage.bicep`, `database.bicep`, or `networking.bicep` fails this rule.
The Challenger flags it as a `should_fix` (Operational Excellence).
