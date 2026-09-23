# Azure App Service — Reliability Reference

Assessment rules for App Service plans and web apps. The commands here are read-only. Record gaps as findings
and hand the target settings to the IaC owner (06b/06t).

## Supported Plans & Zone Redundancy

| Plan | Zone Redundancy | Min Instances | Health Check |
|------|----------------|---------------|--------------|
| Free/Shared (F1/D1) | ❌ Not supported | N/A | ❌ |
| Basic (B1/B2/B3) | ❌ Not supported | N/A | ✅ |
| Standard (S1/S2/S3) | ❌ Not supported | N/A | ✅ |
| Premium v2 (P1v2+) | ✅ `zoneRedundant: true` + `capacity: 2` | 2 | ✅ |
| Premium v3 (P0v3+) | ✅ `zoneRedundant: true` + `capacity: 2` | 2 (recommended) | ✅ |
| Premium v4 (P0v4+) | ✅ `zoneRedundant: true` + `capacity: 2` | 2 (recommended) | ✅ |
| Isolated v2 (I1v2+) | ✅ `zoneRedundant: true` + `capacity: 2` | 2 | ✅ |

## Assessment Queries

> **⚠️ Output format:** Use `--query "data[]" -o json` for `az graph query`. `-o table` only shows summary columns (`Count`, `Total_records`) and hides projected fields. Standard `az webapp` commands work fine with `-o table`.

### Plan Zone Redundancy

```bash
az graph query -q "
resources
| where resourceGroup =~ '<rg>'
| where type =~ 'microsoft.web/serverfarms'
| where kind !contains 'functionapp'
| project name, sku=sku.name, capacity=sku.capacity, zoneRedundant=properties.zoneRedundant, location
" --subscriptions <sub-id> --query "data[]" -o json
```

### Health Check, Always On and Auto Heal

```bash
az webapp config show --name <app> --resource-group <rg> \
  --query "{healthCheckPath:healthCheckPath, alwaysOn:alwaysOn, autoHealEnabled:autoHealEnabled}" -o table
```

### Client Affinity (ARR Affinity) — should be **disabled** for ZR / multi-region

```bash
az webapp show --name <app> --resource-group <rg> \
  --query "clientAffinityEnabled" -o tsv
```

When `true`, sticky sessions pin clients to a single instance and defeat zone load balancing. Leave it on only
if the app keeps state in instance memory and can't move it to a shared cache or database.

### Deployment Slots (for zero-downtime deploys)

```bash
az webapp deployment slot list --name <app> --resource-group <rg> \
  --query "[].{name:name, state:state}" -o table
```

## Health Check Behavior

- Ping interval: **1 minute**
- Failure threshold: **10 consecutive failures** (configurable via `WEBSITE_HEALTHCHECK_MAXPINGFAILURES`)
- After threshold: instance marked unhealthy, replaced within **1 hour**
- Healthy threshold: **1 successful response** restores instance
- Enabling health check restarts the app, so the change belongs in a maintenance window

## Target Settings For The IaC Owner

Plan tier changes come from `sku-manifest.json` and are priced through `cost-estimate-subagent`. Look up any
other parameter (Auto Heal rules, deployment slots) in the module documentation.

| Finding | AVM Bicep (`avm/res/web/serverfarm`, `avm/res/web/site`) | Terraform (`azurerm_service_plan`, `azurerm_linux_web_app`) |
|---|---|---|
| Plan tier doesn't support zone redundancy | `skuName` Premium v3 or higher | `sku_name` Premium v3 or higher |
| Zone redundancy off | `zoneRedundant: true`, `skuCapacity: 2` or more | `zone_balancing_enabled = true`, `worker_count = 2` or more |
| No health check | `siteConfig.healthCheckPath: '/api/health'` | `site_config.health_check_path = "/api/health"` |
| Always On off | `siteConfig.alwaysOn: true` | `site_config.always_on = true` |
| Client affinity on (stateless app) | `clientAffinityEnabled: false` | `client_affinity_enabled = false` |

## Back Up Support by SKU

| Plan | Automatic Backup | Custom Backup |
|------|----------------|---------------|
| Free/Shared (F1/D1) | ❌ Not supported | ❌ Not supported |
| Basic (B1/B2/B3) | ✅ | ✅ Configuration required |
| Standard (S1/S2/S3) | ✅ | ✅ Configuration required |
| Premium v2 (P1v2+) | ✅ | ✅ Configuration required |
| Premium v3 (P0v3+) | ✅ | ✅ Configuration required |
| Premium v4 (P0v4+) | ✅ | ✅ Configuration required |
| Isolated v2 (I1v2+) | ✅ | ✅ Configuration required |

- Automatic backups are recommended: they need no configuration and are enabled by default.

## Virtual Network Integration Notes

- Subnet sizing is important. VNet integration consumes IPs during scale-out and slot swaps.
- Undersized subnets cause scale or deployment failures during regional stress or failover. Recommend /26 minimum, /24 for larger plans. Zone-redundant plans need an integration subnet sized for zone redundancy (more IPs).
- Subnets cannot be resized after assignment without reconfiguring VNet integration.
- Dependencies reached over private endpoints must have a per-region private endpoint and private DNS zone. Sharing a single or global private DNS zone linked to the primary VNet will break failover.
- Recommend Azure DNS Private Resolver per region, or per-region forwarders. Verify `WEBSITE_DNS_SERVER`/`WEBSITE_DNS_ALT_SERVER` are set with a fallback.
- For predictable outbound traffic during failover, attach a NAT Gateway to the subnet in each region so partner allow lists work for all regions. NAT Gateway also avoids SNAT port exhaustion under load.
- Service endpoints are regional and don't fail over. Use private endpoints per region for resiliency.

## Multi-Region Notes

- App Service supports deployment slots — use slot swap for safe regional deployments
- Consider auto-scale rules to handle failover traffic surge
- App Service Managed Certificates don't support custom domains on Front Door — use App Service Certificate or Key Vault
- Client affinity (ARR Affinity) must be disabled for multi-region (see Client Affinity above)
- App Service Environment v3 lives in one subnet and is regional; multi-region still requires one ASE per region with Azure Front Door or Traffic Manager in front

## Reporting (for the assessment table)

When the parent skill builds the feature-pivoted assessment table, report each App Service resource on the relevant rows:

| Feature row | What to report |
|---|---|
| Zone redundancy — compute | `🟢 ON` if the **plan** has `zoneRedundant: true` AND `sku.capacity ≥ 2`. `🔴 OFF` if either is missing or the plan tier doesn't support ZR (Free / Shared / Basic / Standard). Annotate `(needs plan upgrade)` for unsupported tiers. |
| Health probes | `🟢 ON` if `siteConfig.healthCheckPath` is set on the **app**. `🔴 OFF` if empty. Basic tier and above support it; Free/Shared do not — annotate `(needs plan upgrade)` in that case. |
| Multi-region failover | `🟢 ON` if the same app is deployed in ≥2 regions behind Front Door / Traffic Manager. `🟡 PARTIAL` if multi-region is set up but `clientAffinityEnabled` is still `true` (sticky sessions break failover). `🔴 OFF` otherwise. |
