# Consumption Plan to Flex Consumption Plan Upgrade

> **Source**: Azure Functions Consumption plan (Y1/Dynamic), Linux or Windows
> **Target**: Azure Functions Flex Consumption plan (FC1/FlexConsumption), Linux only
> **Docs**: [Migrate Consumption plan apps to Flex Consumption](https://learn.microsoft.com/azure/azure-functions/migration/migrate-plan-consumption-to-flex)

## Why Upgrade?

- **Faster cold starts** — always-ready instances mean functions respond more quickly
- **Better scaling** — per-function scaling and concurrency controls
- **Virtual network support** — connect to private networks and use private endpoints
- **Active investment** — Flex Consumption is where new features land first

## What to Expect

1. Your **code stays the same** — no rewriting required if on a supported language version
2. A **new app** is created alongside the existing one — an existing Consumption app can't be converted in place
3. The new app can run in the **same resource group** with access to the same dependencies
4. The user **controls the cutover timing** — test thoroughly before switching over

## Platform Notes

- Linux Consumption hosting retires **September 30, 2028**, and no new features or language enhancements land on it
- `az functionapp flex-migration list` (read-only) scans Linux Consumption apps and returns `eligible_apps` and `ineligible_apps` with reasons. It doesn't evaluate Windows apps.
- `az functionapp flex-migration start` creates the new app and copies its configuration. APEX doesn't use it: the new app ships through IaC so deployments don't drift from state.
- Linux deployment packages are in `squashfs` format in the `scm-releases` blob container

## Prerequisites (Assessment)

- Azure CLI v2.77.0+
- `resource-graph` extension: `az extension add --name resource-graph`
- `jq` tool for JSON processing
- Reader on the subscription or resource group

## Compatibility Requirements

### Supported Language Stacks

| Stack ID | Language | Supported? |
|----------|----------|------------|
| `dotnet-isolated` | .NET (isolated worker model) | ✅ Yes |
| `node` | JavaScript/TypeScript | ✅ Yes |
| `java` | Java | ✅ Yes |
| `python` | Python | ✅ Yes |
| `powershell` | PowerShell | ✅ Yes |
| `go` | Go (Preview) | ✅ Yes |
| `dotnet` | .NET (in-process model) | ❌ No — must migrate to isolated first |
| `custom` | Custom handlers | ✅ Yes |

### Known Limitations (Flex Consumption)

| Feature | Status | Impact |
|---------|--------|--------|
| Deployment slots | ❌ Not supported | Rearchitect to use separate apps |
| TLS/SSL certificates | ⚠️ Site-scoped only (three private and three public per app) | Re-add certificates to the new app; `WEBSITE_LOAD_CERTIFICATES` isn't used; code loads certificates from `/var/ssl/certs` and `/var/ssl/private` |
| Blob trigger (polling) | ❌ Only EventGrid source | Convert `LogsAndContainerScan` → `EventGrid` |
| Azure Government | ❌ Not available | Cannot migrate yet |

## Assessment

Run all checks from [assessment.md](assessment.md). Automated eligibility check for Linux apps:

```bash
az functionapp flex-migration list
```

Windows Consumption apps don't appear in that output. List them with Resource Graph:

```bash
az graph query -q "resources | where type == 'microsoft.web/sites' | where ['kind'] == 'functionapp' \
  | where properties.sku == 'Dynamic' | project name, location, resourceGroup" --query data -o table
```

## Pre-migration Inventory (Read-Only)

Collect everything the new app needs before planning it. Record names and settings, never secret values:

1. App setting names: `az functionapp config appsettings list --name <app> --resource-group <rg> --query "[].name" -o tsv`
2. Application configuration (HTTP version, HTTPS only, TLS, client certificates):
   `az functionapp config show --name <app> --resource-group <rg> --query "{http20Enabled:http20Enabled, httpsOnly:httpsOnly, minTlsVersion:minTlsVersion, clientCertEnabled:clientCertEnabled, clientCertMode:clientCertMode}"`
3. CORS and custom domains: `az functionapp cors show` and `az functionapp config hostname list --webapp-name <app> --resource-group <rg>`
4. Managed identities and role assignments: `az functionapp identity show`, then `az role assignment list --assignee <principal-id> --all`
5. Built-in authentication: record whether it's enabled and which identity providers it uses; never copy client secrets
6. Inbound access restrictions: `az functionapp config access-restriction show --name <app> --resource-group <rg>`
7. Code source: confirm the project is in source control; otherwise locate the deployment package

## Identity-First Configuration (Functions)

Enterprise subscriptions commonly enforce policies blocking local auth. Configure identity-based access:

- **Storage accounts**: Use `AzureWebJobsStorage__credential`, `__clientId`, and service-specific URIs (`__blobServiceUri`, `__queueServiceUri`, `__tableServiceUri`)
- **Application Insights**: Use `APPLICATIONINSIGHTS_AUTHENTICATION_STRING` with `Authorization=AAD`, and assign the app identity the **Monitoring Metrics Publisher** role on the Application Insights resource
- When using User Assigned Managed Identity, pass `managedIdentityClientId` explicitly

## IaC Target Mapping

An existing Consumption app can't be converted to Flex Consumption in place. 05-IaC Planner plans new resources
(new names, or an approved delete-then-create) and the deploy agents reconcile state with a what-if or plan run.

| Property | Consumption | Flex Consumption |
|----------|-------------|------------------|
| SKU | `Y1` (Dynamic) | `FC1` (FlexConsumption) |
| Plan required | Optional (auto-created) | Required (must be explicit) |
| OS | Windows or Linux | Linux only |
| Configuration | App settings | `functionAppConfig` section (deployment storage, scale and concurrency, runtime) |
| Storage | `WEBSITE_CONTENTSHARE` setting | `functionAppConfig.deployment.storage` (blob container with managed identity) |
| Terraform resource | `azurerm_linux_function_app` | `azurerm_function_app_flex_consumption` |

05-IaC Planner confirms AVM support for `functionAppConfig` before choosing a module. Reference samples:
[Flex Consumption IaC samples](https://github.com/Azure-Samples/azure-functions-flex-consumption-samples/tree/main/IaC).

## Deprecated Settings (Do NOT Migrate)

These settings from the source app are NOT copied to the Flex Consumption app:

- `WEBSITE_USE_PLACEHOLDER_DOTNETISOLATED`
- `AzureWebJobsStorage` and the source app's `AzureWebJobsStorage__*` values (the IaC sets the new app's
  identity-based storage settings, listed under Identity-First Configuration above)
- `WEBSITE_MOUNT_ENABLED`
- `ENABLE_ORYX_BUILD`
- `FUNCTIONS_EXTENSION_VERSION` (set via `functionAppConfig`)
- `FUNCTIONS_WORKER_RUNTIME` (set via `functionAppConfig`)
- `FUNCTIONS_WORKER_RUNTIME_VERSION`
- `FUNCTIONS_MAX_HTTP_CONCURRENCY`
- `FUNCTIONS_WORKER_PROCESS_COUNT`
- `FUNCTIONS_WORKER_DYNAMIC_CONCURRENCY_ENABLED`
- `SCM_DO_BUILD_DURING_DEPLOYMENT`
- `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING`
- `WEBSITE_CONTENTOVERVNET`
- `WEBSITE_CONTENTSHARE`
- `WEBSITE_DNS_SERVER`
- `WEBSITE_MAX_DYNAMIC_APPLICATION_SCALE_OUT`
- `WEBSITE_NODE_DEFAULT_VERSION`
- `WEBSITE_RUN_FROM_PACKAGE`
- `WEBSITE_SKIP_CONTENTSHARE_VALIDATION`
- `WEBSITE_VNET_ROUTE_ALL`
- `APPLICATIONINSIGHTS_CONNECTION_STRING` (already created in new app)

## Trigger Migration Risks

| Trigger Type | Risk | Mitigation |
|-------------|------|------------|
| Azure Blob storage | High | Create separate container for event-based trigger in new app |
| Azure Cosmos DB | High | Create dedicated lease container for new app; set `StartFromBeginning: false` |
| Azure Event Grid | Medium | Recreate event subscriptions; ensure idempotent functions |
| Azure Event Hubs | Medium | Create new consumer group for new app |
| Azure Service Bus | High | Create new topic/queue; update senders; drain original before shutdown |
| Azure Storage Queue | High | Create new queue; update senders; drain original before shutdown |
| HTTP | Low | Update clients to target new app URL |
| Timer | Low | Offset schedules during cutover to avoid simultaneous execution |

## Cutover And Rollback (For The Deployment Owner)

Code isn't migrated with the configuration: deploy it to the new app through the project's pipeline. Triggers
start processing as soon as code is deployed, so apply the trigger mitigations first.

Rollback:

1. Restart the original app
2. Redirect clients back to original resources (queues/topics/containers)
3. Revert DNS or custom domain changes
4. Remove the new Flex Consumption app only with explicit approval

Keep the original app until the new one is validated, and delete it only with explicit approval.

## Troubleshooting

| Issue | Remediation |
|-------|-------------|
| Cold start performance issues | Review concurrency settings; check for missing dependencies |
| Missing bindings | Verify extension bundles; update binding configurations |
| Permission errors | Check identity assignments and role permissions |
| Network connectivity | Validate access restrictions and networking settings |
| Missing App Insights | Recreate the Application Insights connection |
| App fails to start | Check portal Diagnose & Solve; review App Insights Failures blade |
| Triggers not processing | Verify binding configs, connection settings, consumer groups |

## References

- [Flex Consumption plan overview](https://learn.microsoft.com/azure/azure-functions/flex-consumption-plan)
- [How to use the Flex Consumption plan](https://learn.microsoft.com/azure/azure-functions/flex-consumption-how-to)
- [Azure CLI flex-migration commands](https://learn.microsoft.com/cli/azure/functionapp/flex-migration) (Linux only)
- [Flex Consumption plan deprecations](https://learn.microsoft.com/azure/azure-functions/functions-app-settings#flex-consumption-plan-deprecations)
