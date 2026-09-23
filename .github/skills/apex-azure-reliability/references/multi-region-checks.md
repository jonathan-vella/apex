<!-- ref:multi-region-checks-v1 -->

# Multi-Region & Failover Checks

## Overview

Multi-region deployment protects against entire region outages. This requires deploying compute in multiple regions and using a global load balancer (Azure Front Door or Traffic Manager) to route traffic.

## Resource Graph Queries

> **⚠️ Output format:** Use `--query "data[]" -o json` (not `-o table`). `az graph query -o table` only renders summary columns and does not show projected fields.

### Check if App is Deployed in Multiple Regions

```bash
az graph query -q "
Resources
| where type in~ ('microsoft.web/sites', 'microsoft.app/containerapps')
| extend appKind = case(
    type =~ 'microsoft.web/sites' and kind contains 'functionapp', 'FunctionApp',
    type =~ 'microsoft.web/sites', 'WebApp',
    type =~ 'microsoft.app/containerapps', 'ContainerApp',
    'Other')
| extend baseName = extract('^(.+?)(-[a-z]+\\d*)?$', 1, name)
| summarize regions=make_list(location), regionCount=dcount(location), apps=make_list(name) by baseName, appKind
| where regionCount > 1
| project baseName, appKind, regionCount, regions, apps
" --query "data[]" -o json
```

**Interpretation:**
- Results show apps with the same base name deployed across multiple regions → ✅ Multi-region
- No results → ❌ All apps are single-region

**Important:** The `baseName` extraction uses a naming convention (e.g., `my-app-swedencentral`, `my-app-germanywestcentral`). If apps don't follow this pattern, also check by resource tags:

```bash
az graph query -q "
Resources
| where type in~ ('microsoft.web/sites', 'microsoft.app/containerapps')
| where isnotempty(tags['app-group']) or isnotempty(tags['application'])
| extend appGroup = coalesce(tostring(tags['app-group']), tostring(tags['application']))
| summarize regions=make_list(location), regionCount=dcount(location) by appGroup
| where regionCount > 1
| project appGroup, regionCount, regions
" --query "data[]" -o json
```

### Check for Azure Front Door

```bash
az graph query -q "
Resources
| where type =~ 'microsoft.cdn/profiles'
| where sku.name =~ 'Standard_AzureFrontDoor' or sku.name =~ 'Premium_AzureFrontDoor'
| project name, resourceGroup, sku=sku.name
" --query "data[]" -o json
```

### Check for Traffic Manager Profiles

```bash
az graph query -q "
Resources
| where type =~ 'microsoft.network/trafficmanagerprofiles'
| extend routingMethod = tostring(properties.trafficRoutingMethod)
| extend endpoints = array_length(properties.endpoints)
| project name, resourceGroup, routingMethod, endpoints, status=properties.profileStatus
" --query "data[]" -o json
```

### Check Front Door Origins/Backends

```bash
# List Front Door origin groups and origins
az afd origin-group list \
  --profile-name <front-door-name> \
  --resource-group <rg> \
  --query "[].{name:name, origins:length(origins)}" -o table

az afd origin list \
  --profile-name <front-door-name> \
  --resource-group <rg> \
  --origin-group-name <group-name> \
  --query "[].{name:name, hostName:hostName, priority:priority, weight:weight}" -o table
```

## Assessment Criteria

| Check | Pass | Fail |
|---|---|---|
| App deployed in ≥2 regions | ✅ Multi-region | ❌ Single region |
| Global load balancer exists (Front Door or TM) | ✅ Traffic routing | ❌ No failover mechanism |
| Health probes configured on load balancer | ✅ Auto-failover | ⚠️ Manual failover only |
| Storage is geo-redundant (GRS/GZRS) | ✅ Data survives region failure | ❌ Data loss risk |

## Multi-Region Patterns

### Active-Passive (Recommended starting point)

```
Users → Azure Front Door → Primary Region (priority 1)
                        → Secondary Region (priority 2, standby)
```

- Primary serves all traffic
- Front Door health probes detect primary failure
- Automatic failover to secondary
- Lower cost (secondary can be scaled down)

### Active-Active

```
Users → Azure Front Door → Region A (weight 50)
                        → Region B (weight 50)
```

- Both regions serve traffic simultaneously
- Better performance (route to nearest)
- Higher cost (both at full capacity)
- Requires stateless design or data sync

## Target Design For The IaC Owner

When the user wants multi-region, record this target design as a finding for 05-IaC Planner. This skill doesn't
generate or deploy the IaC.

1. **Secondary region compute** — Same service type as primary, in the failover region (`germanywestcentral` by default)
2. **Secondary region storage** — ZRS in secondary region
3. **Azure Front Door profile** (AVM `avm/res/cdn/profile`) — With:
   - Origin group containing both regions
   - Health probe (HTTPS to the health endpoint)
   - Routing rule (priority for active-passive, weighted for active-active)
   - Premium tier with Private Link origins when the apps are private
4. **DNS configuration** — Custom domain on Front Door
5. **Per-region private endpoints and private DNS** for dependencies reached over private endpoints

## Reporting

For the reliability checklist, mark the **Multi-Region** column per resource:
- ✅ — resource is deployed in ≥2 regions AND fronted by Azure Front Door / Traffic Manager with health probes
- ❌ — single region OR multi-region without an active global load balancer / health probes
- For Front Door / Traffic Manager rows: ✅ if configured with health probes, ❌ if absent or missing health probes
