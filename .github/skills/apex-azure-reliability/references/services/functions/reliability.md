# Azure Functions — Reliability Reference

Assessment rules for Function App plans. The commands here are read-only. Record gaps as findings and hand the
target settings to the IaC owner (06b/06t).

## Supported Plans & Zone Redundancy

| Plan | Zone Redundancy | Min Instances | Health Check |
|------|----------------|---------------|--------------|
| Flex Consumption (FC1) | ✅ `zoneRedundant: true` | Auto-managed | ❌ Platform health check not supported |
| Premium (EP1/EP2/EP3) | ✅ `zoneRedundant: true` + `sku.capacity: 2` | `minimumElasticInstanceCount: 2` per app | ✅ `healthCheckPath` |
| Consumption (Y1) | ❌ Not supported | N/A | ❌ Not supported |
| Dedicated (P1v2+) | ✅ (treated as App Service) | `sku.capacity: 2` | ✅ `healthCheckPath` |

## Assessment Queries

### Zone Redundancy Check

```bash
az graph query -q "
resources
| where resourceGroup =~ '<rg>'
| where type =~ 'microsoft.web/serverfarms'
| where kind contains 'functionapp' or kind =~ 'linux' or kind =~ 'elastic'
| project name, sku=sku.name, zoneRedundant=properties.zoneRedundant, location
" --subscriptions <sub-id> --query "data[]" -o json
```

### Function App Instance Count and Health Check (Premium)

```bash
az functionapp show --name <app> --resource-group <rg> \
  --query "{minInstances:siteConfig.minimumElasticInstanceCount, healthCheckPath:siteConfig.healthCheckPath}" -o table
```

## Consumption (Y1) — Upgrade Path Required

Consumption (Y1) plans do **not** support zone redundancy. Record a plan upgrade as the finding:

- **Recommended:** **Flex Consumption** — similar serverless model, supports zone redundancy, no per-app minimum
  instances. Use `apex-azure-upgrade` for the Consumption to Flex Consumption assessment.
- **Alternative:** **Premium (EP1+)** — more control; always-ready instances bill continuously.

Price any plan change through `cost-estimate-subagent` before recommending it.

## Health Endpoint

Flex Consumption does NOT support the platform health check (`healthCheckPath`). The application owner adds an
HTTP endpoint in code instead:

### TypeScript (v4 programming model)

```typescript
import { app } from "@azure/functions";

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => ({ status: 200, body: 'OK' })
});
```

### Python (v2 programming model)

```python
import azure.functions as func

app = func.FunctionApp()

@app.route(route="health", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def health(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("OK", status_code=200)
```

### C# (isolated worker)

```csharp
[Function("Health")]
public IActionResult Health([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequest req)
{
    return new OkObjectResult("OK");
}
```

On Premium and Dedicated plans the platform health check is an IaC setting (below). Enabling it restarts the app.

## Target Settings For The IaC Owner

| Finding | AVM Bicep (`avm/res/web/serverfarm`, `avm/res/web/site`) | Terraform (`azurerm_service_plan`, `azurerm_linux_function_app`) |
|---|---|---|
| Zone redundancy off (FC1, Premium, Dedicated) | `zoneRedundant: true` | `zone_balancing_enabled = true` |
| Premium plan capacity below 2 | `skuCapacity: 2` | `worker_count = 2` |
| Premium app minimum instances below 2 | `siteConfig.minimumElasticInstanceCount: 2` | `site_config.elastic_instance_minimum = 2` |
| No platform health check (Premium, Dedicated) | `siteConfig.healthCheckPath: '/api/health'` | `site_config.health_check_path = "/api/health"` |

## Multi-Region Notes

- Flex Consumption bills per execution, so an idle standby region adds little compute cost — suits active-passive. Confirm through `cost-estimate-subagent`.
- Code must be deployed to both regions separately
- Event Hub checkpoints are per-app — secondary starts from its own checkpoint on failover
- Consider Event Hubs Geo-DR for true event replication

## Reporting (for the assessment table)

When the parent skill builds the feature-pivoted assessment table, report each Functions resource on the relevant rows:

| Feature row | What to report |
|---|---|
| Zone redundancy — compute | `🟢 ON` if the **plan** has `zoneRedundant: true`. For Premium plans, also requires `sku.capacity ≥ 2` AND each Function App has `minimumElasticInstanceCount ≥ 2`. `🔴 OFF` if the plan tier doesn't support ZR (Consumption Y1) — annotate `(needs plan upgrade to Flex / Premium)`. |
| Health probes | For Premium / Dedicated: `🟢 ON` if `siteConfig.healthCheckPath` is set, `🔴 OFF` otherwise. For Flex Consumption (FC1) / Consumption (Y1): always annotate `🔴 OFF (code-only fix)` — `healthCheckPath` is not supported on these plans, so the application owner adds an HTTP-triggered `/api/health` function (see Health Endpoint above). |
| Multi-region failover | `🟢 ON` if the same Function App is deployed in ≥2 regions behind Front Door / Traffic Manager; otherwise `🔴 OFF`. |

## Additional References

- [Reliability in Azure Functions (Microsoft Learn)](https://learn.microsoft.com/azure/reliability/reliability-functions)
