# UAMI Binding Configuration

> ⛔ **MANDATORY FOR ALL SERVICE BINDINGS**
>
> This document defines the required app settings pattern for User Assigned Managed Identity (UAMI)
> when connecting Azure Functions to Azure services. **All recipes MUST follow this pattern.**

## The Problem

Azure Functions base templates use **User Assigned Managed Identity (UAMI)**, not System Assigned MI.
UAMI requires **explicit credential configuration** — the runtime cannot auto-detect the identity.

**Without proper configuration**, functions fail with:

- `500 Internal Server Error`
- `401 Unauthorized`
- `403 Forbidden`
- `The connection string did not contain required properties`

## The Solution: Three Required Settings

For identity-based bindings using a connection prefix, configure these settings. SQL is the explicit exception:
it consumes one identity-bearing connection string, not split `__credential`/`__clientId` settings.

| Setting                                                                    | Purpose          | Example                                |
| -------------------------------------------------------------------------- | ---------------- | -------------------------------------- |
| `{Connection}__fullyQualifiedNamespace` or `{Connection}__accountEndpoint` | Service endpoint | `myhub.servicebus.windows.net`         |
| `{Connection}__credential`                                                 | Auth method      | `managedidentity`                      |
| `{Connection}__clientId`                                                   | UAMI identity    | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

> **All three are required.** Missing any one causes auth failures.

## Per-Service Configuration

### Event Hubs

```bicep
EventHubConnection__fullyQualifiedNamespace: '${eventHubNamespace}.servicebus.windows.net'
EventHubConnection__credential: 'managedidentity'
EventHubConnection__clientId: uamiClientId
EVENTHUB_NAME: 'events'
```

### Service Bus

```bicep
ServiceBusConnection__fullyQualifiedNamespace: '${serviceBusNamespace}.servicebus.windows.net'
ServiceBusConnection__credential: 'managedidentity'
ServiceBusConnection__clientId: uamiClientId
SERVICEBUS_QUEUE_NAME: 'orders'
```

### Cosmos DB

```bicep
COSMOS_CONNECTION__accountEndpoint: 'https://${cosmosAccount}.documents.azure.com:443/'
COSMOS_CONNECTION__credential: 'managedidentity'
COSMOS_CONNECTION__clientId: uamiClientId
COSMOS_DATABASE_NAME: 'mydb'
COSMOS_CONTAINER_NAME: 'items'
```

### Blob Storage

```bicep
PDFProcessorSTORAGE__blobServiceUri: 'https://${storageAccount}.blob.core.windows.net'
PDFProcessorSTORAGE__credential: 'managedidentity'
PDFProcessorSTORAGE__clientId: uamiClientId
```

### SQL Database

```bicep
AZURE_SQL_CONNECTION_STRING_KEY: 'Server=${sqlServer}.database.windows.net;Database=${database};Authentication=Active Directory Managed Identity;User Id=${uamiClientId};Encrypt=True;TrustServerCertificate=False;'
```

> **Note:** SQL uses connection string format with `Authentication=Active Directory Managed Identity`

## Composition Contract

Use these contracts for every bundled language and both IaC tracks. Merge the recipe's emitted settings rather
than retyping them. A migration may retain an existing binding name only by explicitly mapping it to the same
emitted setting value; never silently rename just the application or just the infrastructure.

| Recipe | Source contract | IaC contract |
| --- | --- | --- |
| SQL | `AZURE_SQL_CONNECTION_STRING_KEY` | Same key; managed identity authentication plus UAMI client ID |
| Blob/Event Grid | `PDFProcessorSTORAGE`; `ProcessBlobUpload` | Same prefix; Event Grid destination ends in `/functions/ProcessBlobUpload` |
| Blob input/output | `unprocessed-pdf/{name}` and `processed-pdf` | Create both containers; filter events to the input container only |

If container parameters change, update selected-language source binding paths and the Event Grid filter together.
Keep output and input containers distinct to avoid recursion. Preserve host queue endpoints and poison-message
RBAC from the selected Blob extension/template. Compile/index the actual runtime; string checks do not verify
SDK-type bindings, extension support or Event Grid delivery.
Production data networking follows governance and remains private. Use AVM-first adaptation or an explicitly
approved raw-resource exception; unavailable module interfaces block verification, not policy.

## Recipe Module Pattern

All recipe Bicep modules MUST:

1. **Accept `uamiClientId` as a parameter**
2. **Export an `appSettings` output** with all required settings pre-configured

```bicep
// In recipe module (e.g., eventhubs.bicep)
@description('UAMI client ID - REQUIRED for UAMI auth')
param uamiClientId string

output appSettings object = {
  EventHubConnection__fullyQualifiedNamespace: '${namespace.name}.servicebus.windows.net'
  EventHubConnection__credential: 'managedidentity'
  EventHubConnection__clientId: uamiClientId
  EVENTHUB_NAME: hub.name
}
```

```bicep
// In main.bicep - consume the output
module eventhubs './app/eventhubs.bicep' = {
  params: {
    uamiClientId: apiUserAssignedIdentity.outputs.clientId  // Pass UAMI
  }
}

// Merge into function app settings
var appSettings = union(baseAppSettings, eventhubs.outputs.appSettings)
```

## Validation Checklist

Before deploying, verify:

- [ ] Recipe module has `uamiClientId` parameter
- [ ] Recipe module exports `appSettings` output
- [ ] Prefix-based settings include `__credential: 'managedidentity'` and `__clientId` referencing the UAMI
- [ ] SQL instead includes its identity-bearing connection string with `User Id` referencing the UAMI
- [ ] main.bicep passes `apiUserAssignedIdentity.outputs.clientId` to recipe
- [ ] main.bicep merges recipe's `appSettings` into function config

## Common Mistakes

| Mistake                        | Result                              | Fix                                                               |
| ------------------------------ | ----------------------------------- | ----------------------------------------------------------------- |
| Missing `__credential` setting | 401/403 errors                      | Add `{Connection}__credential: 'managedidentity'`                 |
| Missing `__clientId` setting   | 401/403 errors                      | Add `{Connection}__clientId: uamiClientId`                        |
| Using wrong clientId           | 403 Forbidden                       | Use `apiUserAssignedIdentity.outputs.clientId` from base template |
| Using System MI pattern        | Auth fails                          | UAMI requires explicit credential + clientId                      |
| Hardcoding clientId            | Works initially, breaks on redeploy | Reference identity module output                                  |

## Why UAMI Instead of System MI?

The base templates use UAMI because:

1. **Pre-deployment RBAC**: Identity exists before function app, enabling RBAC assignment during provisioning
2. **Consistent identity**: Same identity across redeployments (System MI changes on recreation)
3. **Multi-resource**: One UAMI can be shared across multiple function apps
4. **Cross-resource group**: UAMI can access resources in other resource groups

The tradeoff is requiring explicit credential configuration, which this document addresses.
