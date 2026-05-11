# Module Interface — Canonical Example

> The standard module-interface contract every Bicep module in this
> repo follows. Loaded by `azure-bicep-patterns` SKILL.md when authoring
> a new module or auditing an existing one for shape compliance.

```bicep
// modules/storage.bicep — every module follows this contract
@description('Storage account name')
param name string
param location string
param tags object
param logAnalyticsWorkspaceName string

output resourceId string = storageAccount.id
output resourceName string = storageAccount.name
output principalId string = storageAccount.identity.?principalId ?? ''
```

**Inputs (required)**: `name`, `location`, `tags`, `logAnalyticsWorkspaceName`.

**Outputs (required)**: `resourceId`, `resourceName`, `principalId` (use the safe-access
operator `.?principalId ?? ''` so modules without managed identity still expose the
output).

**Why this contract**: keeps `main.bicep` composable, makes diagnostic settings wiring
mechanical (always pass `logAnalyticsWorkspaceName`), and gives downstream RBAC modules a
predictable principal-id source.
