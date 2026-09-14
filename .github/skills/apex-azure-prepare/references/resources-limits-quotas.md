<!-- ref:resources-limits-quotas-v1 -->

# Azure Resource Limits and Quotas

Check Azure quota evidence during apex-azure-prepare workflow after the customer selects a region.
Read the canonical [quota evidence and fallback contract](../../apex-azure-quotas/references/commands.md#quota-evidence-and-fallback).
Quota headroom, SKU restrictions and physical regional capacity are separate checks.
Static catalogs and unrestricted SKU listings do not prove regional capacity or guarantee allocation.

## Types

1. **Hard Limits** - Fixed constraints that cannot be changed
2. **Quotas** - Subscription limits that can be increased via support request

**CLI First:** Start with `az quota` discovery at the approved scope. Missing, nonnumeric, `No Limit`
or `Unlimited` values are unknown evidence, not zero, unlimited quota or proof of unsupported capability.

## Hard Limits

Fixed service constraints (cannot be changed).

**Check via**: `mcp_azure-mcp_documentation` with `command: "microsoft_docs_search"` (query the relevant Azure service docs) or the apex-azure-quotas skill

**Examples**: Cosmos DB item size (2 MB), Container Apps HTTP timeout (240s), App Service Free tier deployment slots (0)

**Process**:

1. Identify services and resource sizes needed
2. Look up limits in documentation
3. Compare plan vs limits
4. If exceeded: redesign or change tier

## Quotas

Subscription/regional limits that can be increased via support request.

**Check via**: `az quota` CLI (install: `az extension add --name quota`)

**Examples**: AKS clusters (5,000/region), Storage accounts (250/region), Container Apps environments (50/region)

**Key Concept**: No 1:1 mapping between ARM resource types and quota names.

- ARM: `Microsoft.App/managedEnvironments` → Quota: `ManagedEnvironmentCount`
- ARM: `Microsoft.Compute/virtualMachines` → Quota: `standardDSv3Family`, `cores`, `virtualMachines`

**Process**:

1. Install extension: `az extension add --name quota`
2. Discover quota names: `az quota list --scope /subscriptions/{id}/providers/{Provider}/locations/{region}`
3. Check usage: `az quota usage show --resource-name {name} --scope ...`
4. Check limit: `az quota show --resource-name {name} --scope ...`
5. Calculate quota headroom = observed limit - current usage, only with complete matching evidence.
6. If exceeded: report the blocker; a quota increase or region change needs explicit approval.

Use matching units and scope as defined in the [plan quota contract](plan-template.md#phase-2-fetch-quotas-and-validate-capacity).
Counts cannot substitute for vCPU usage. Check VM-family and regional totals including autoscale/surge.
Quota headroom is not physical capacity. An authorization error or generic BadRequest is not evidence of unsupported
quota capability; diagnose the error and use fallback only when lack of support is established.

**Confirmed Unsupported Capability**:

Not all providers support the quota API. Diagnose `BadRequest` against the exact provider, scope and parameters.
Only after unsupported capability is established, use the following fallback for a documented count quota:

1. Get current usage:

   ```bash
   # Option A: Azure Resource Graph (recommended)
   az extension add --name resource-graph
    az graph query --subscriptions "{id}" -q "resources | where type == '{type}' and location == '{loc}' | count"

   # Option B: Resource list
    az resource list --subscription "{id}" --resource-type "{Type}" --query "[?location=='{loc}'] | length(@)" -o json
   ```

2. Verify usage against a documented service-specific usage source with matching quota name, unit and scope.
  Counts are valid only for documented count quotas; omit the region filter for subscription-wide quotas.
3. Establish the actual applicable subscription limit through a live service-specific source or Portal/support
  confirmation. Published defaults are not observed subscription limits and cannot fill missing evidence.
4. Record source command/API or confirmation, collection time, subscription/provider/region (or subscription-wide
  scope), quota name, units, current usage, limit and normalized demand. Keep limit and usage in the same
  collection window. If any evidence is missing, stale or invalid, report headroom as unknown; do not calculate.

Unknown or insufficient quota blocks readiness and infrastructure generation. Record explicit unknowns and the
next evidence needed in `infra/{iac}/{project}/.azure/plan.md`; a blocked draft is not a validated plan.
Do not substitute a static catalog or SKU availability for quota evidence or regional capacity.

Provider support is version- and scope-specific. Use current discovery evidence, not a static support list.

## Workflow

**Phase 1: Identify & Check Hard Limits**

1. Analyze app requirements and select Azure services
2. Determine resource counts, sizes, tiers, throughput
3. Check hard limits via apex-azure-quotas or official documentation
4. Validate plan against limits; redesign if needed

**Phase 2: Check Quotas After Region Selection**

1. Get customer subscription and region preference
2. For each service/region, check quota:
   - Use `az quota usage list` and `az quota show`
  - Calculate quota headroom, not physical capacity
3. If quota exceeded: request approval for an increase or a different region

**Phase 3: Validate Region**

- Confirm sufficient quota in selected region
- Obtain approval before requesting increases
- Only proceed after validation complete

## Limit Scopes

### Offline Arithmetic

Use documented SKU size as `unitsPerInstance` for vCPU quotas and `1` for resource-count quotas.
`instances` includes the planned maximum and surge. Evaluate each family quota separately, then regional total.
Match the entire scope (subscription/provider/region or subscription-wide) and quota name before summing.

```javascript
function plannedQuotaTotal(evidence, additions) {
  const { scope, quotaName, unit, current, limit } = evidence;
  if (!scope || !quotaName || !["count", "vCPU"].includes(unit) ||
      ![current, limit].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error("Incomplete quota evidence");
  }
  let total = current;
  for (const addition of additions) {
    if (addition.scope !== scope || addition.quotaName !== quotaName || addition.unit !== unit ||
        !Number.isInteger(addition.instances) || addition.instances < 0 ||
        !Number.isFinite(addition.unitsPerInstance) || addition.unitsPerInstance <= 0 ||
        (unit === "count" && addition.unitsPerInstance !== 1)) {
      throw new Error("Quota units, scope or SKU size do not match");
    }
    total += addition.instances * addition.unitsPerInstance;
  }
  if (!Number.isFinite(total)) throw new Error("Invalid quota total");
  return { total, headroom: limit - total, withinQuota: total <= limit, capacityVerified: false };
}
```

| Scope        | Example                                 |
| ------------ | --------------------------------------- |
| Subscription | 50 Cosmos DB accounts (any region)      |
| Regional     | 250 storage accounts per region         |
| Resource     | 500 apps per Container Apps environment |

## Service Patterns

| Service            | Hard Limits (examples)                                  | Quota Check                                                                                                                                   | Notes                                                                                                                             |
| ------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Cosmos DB** | Verify current service limits | Discover support; use scoped count fallback only for a documented count quota | `az graph query --subscriptions "{id}" -q "resources \| where type == 'microsoft.documentdb/databaseaccounts' \| count"` for subscription-wide counts; add region only for regional limits |
| **AKS**            | Pods/node (Azure CNI): 250, Node pools/cluster: 100     | ✅ `az quota` supported                                                                                                                       | Provider: Microsoft.ContainerService                                                                                              |
| **Storage**        | Block blob: 190.7 TiB, Page blob: 8 TiB                 | ✅ Quota: `StorageAccounts` (limit: 250/region)                                                                                               | Provider: Microsoft.Storage                                                                                                       |
| **Container Apps** | Revisions/app: 100, HTTP timeout: 240s                  | ✅ Quota: `ManagedEnvironmentCount` (limit: 50/region)                                                                                        | Provider: Microsoft.App                                                                                                           |
| **Functions**      | Timeout (Consumption): 10 min, Queue msg: 64KB          | ✅ Check function apps quota                                                                                                                  | Provider: Microsoft.Web                                                                                                           |

## CLI Reference

**Prerequisites**: `az extension add --name quota`

**Discovery**: List quotas to find resource names

```bash
az quota list --scope /subscriptions/{id}/providers/{provider}/locations/{location}
```

**Check Usage**:

```bash
az quota usage show --resource-name {quota-name} --scope /subscriptions/{id}/providers/{provider}/locations/{location}
```

**Check Limit**:

```bash
az quota show --resource-name {quota-name} --scope /subscriptions/{id}/providers/{provider}/locations/{location}
```

**Request Increase**:

```bash
az quota update --resource-name {quota-name} --scope /subscriptions/{id}/providers/{provider}/locations/{location} --limit-object value={new-limit} --resource-type {type}
```

## apex-azure-prepare Integration

**When to Check**:

1. After selecting services - Check hard limits
2. After customer selects region - Check quotas
3. Before generating infrastructure code - Validate availability

**Required Steps**:

**Phase 1 - Planning**:

- Select Azure services
- Check hard limits (service documentation)
- Create provisioning limit checklist (leave quota columns as "_TBD_")

**Phase 2 - Execution**:

- Get subscription and region preference
- **Must invoke apex-azure-quotas skill** - Process ONE resource type at a time:
  a. Try `az quota list` first (required)
  b. If supported: Use `az quota usage show` and `az quota show`
  c. If unsupported capability is confirmed: follow the canonical fallback above for live usage and applicable limit
  d. Calculate quota headroom; regional capacity remains independently unverified
  e. Document evidence and provenance; replace "_TBD_" with explicit unknowns and blockers when evidence is incomplete
  f. If insufficient: obtain approval before requesting an increase or changing region

**Phase 3 - Generate Artifacts**:

- Only proceed after Phase 2 complete (all quotas validated)

## Error Messages

| Error                        | Type                 | Action                                                                                                                                 |
| ---------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| "Quota exceeded"             | Quota                | Use apex-azure-quotas to request increase                                                                                                   |
| "(BadRequest) Bad request" | Unclassified request failure | Check parameters, scope and provider support; do not infer unsupported capability |
| "Limit exceeded"             | Hard Limit           | Redesign or change tier                                                                                                                |
| "Maximum size exceeded"      | Hard Limit           | Split data or use alternative storage                                                                                                  |
| "Too many requests"          | Rate Limit           | Implement retry logic or increase tier                                                                                                 |
| "Cannot exceed X"            | Hard Limit           | Stay within limit or use multiple resources                                                                                            |
| "Subscription limit reached" | Quota                | Request quota increase using apex-azure-quotas skill                                                                                        |
| "Regional capacity" | Physical capacity | A quota increase does not resolve capacity; obtain approval for a supported alternative |

## Best Practices

1. **Use Azure CLI quota discovery first**: fallback requires evidence that the exact provider/scope lacks support,
   not just a `BadRequest` or authorization failure.
2. **Don't trust "No Limit" values**: unknown evidence requires diagnosis; it proves neither unlimited quota nor unsupported capability.
3. **Always check after customer selects region**: establishes scoped quota evidence and allows time for approved requests.
4. **Use the discovery workflow**: Never assume quota resource names - always run `az quota list` first to discover correct names
5. **Check both usage and limit**: use live, scope-matched observations to calculate quota headroom, not regional capacity.
6. **Handle unsupported providers explicitly**: preserve diagnostics, source, collection time, quota name and units/scope.
7. **Request quota increases only with approval**: quota and regional capacity are independent constraints.
8. **Have alternative regions ready**: If quota increase denied, suggest backup regions
9. **Document unknowns and gate readiness**: incomplete quota evidence blocks readiness; record SKU restrictions and regional capacity separately in `infra/{iac}/{project}/.azure/plan.md`.
10. **Design for limits**: Architecture should account for both hard limits and quotas
11. **Monitor usage trends**: Regular quota checks help predict future needs
12. **Use lower environments wisely**: Dev/test environments count against quotas

## Quick Reference Limits

For complete quota checking workflow and commands, invoke the **apex-azure-quotas** skill.

> **Note:** These are typical default limits. Always verify actual quotas using `az quota show` for your specific subscription and region.

Common quotas to check:

### Subscription Level

- Cosmos DB accounts: verify the documented account-count limit and whether its scope is subscription-wide
- SQL logical servers: 250 per region
- Service Bus namespaces: 100-1,000 (tier dependent)

### Regional Level

- Storage accounts: 250 per region (quota resource name: `StorageAccounts`)
- AKS clusters: 5,000 per region (quota resource name: varies by configuration)
- Container Apps environments: 50 per region (quota resource name: `ManagedEnvironmentCount`)
- Function apps: 200 per region (Consumption)

### Resource Level

- Cosmos DB containers per account: Unlimited (subject to storage)
- Apps per Container Apps environment: 500
- Databases per SQL server: 500
- Queues/topics per Service Bus namespace: 10,000

## Related Documentation

- **apex-azure-quotas skill** - Complete quota checking workflow and CLI commands (invoke the **apex-azure-quotas** skill)
- [Azure subscription limits](https://learn.microsoft.com/azure/azure-resource-manager/management/azure-subscription-service-limits) - Official Microsoft documentation
- [Azure Quotas Overview](https://learn.microsoft.com/en-us/azure/quotas/quotas-overview) - Understanding quotas and limits
- [azure-context.md](azure-context.md) - How to confirm subscription and region
- [architecture.md](architecture.md) - Architecture planning workflow

## Example: Complete Check Workflow

```bash
# Scenario: Deploying app with Cosmos DB, Storage, and Container Apps
# Customer selected region: East US

# 1. Check Hard Limits (from apex-azure-quotas and official documentation)
# Cosmos DB: Item size max 2 MB ✓
# Storage: Blob size max 190.7 TiB ✓
# Container Apps: Timeout 240 sec ✓

# 2. Get Customer's Region Preference
# Customer: "I prefer East US"

# 3. Check Quotas for Customer's Selected Region (East US)

# 3a. Discover Cosmos DB quota support at the selected scope
az quota list \
  --scope /subscriptions/abc-123/providers/Microsoft.DocumentDB/locations/eastus
# If the request fails, diagnose it; continue only after unsupported capability is confirmed.

# Fallback: Get current usage with Azure Resource Graph
# Install extension first (if needed)
az extension add --name resource-graph

az graph query --subscriptions "abc-123" -q "resources | where type == 'microsoft.documentdb/databaseaccounts' | count"
# Result: 3 database accounts currently deployed

# Or use Azure CLI resource list
az resource list \
  --subscription "abc-123" \
  --resource-type "Microsoft.DocumentDB/databaseAccounts" \
  --query "length(@)" -o json
# Result: 3

# This example counts subscription-wide accounts. Use it only for a documented subscription-wide count quota.
# Establish the actual applicable limit from a live service-specific source or Portal/support confirmation.
# Published defaults alone leave headroom unknown. Record sources, scope, quota name, units and collection time.

# 3b. Storage Accounts
# Step 1: Discover resource name
az quota list \
  --scope /subscriptions/abc-123/providers/Microsoft.Storage/locations/eastus

# Step 2: Check usage (use discovered name "StorageAccounts")
az quota usage show \
  --resource-name StorageAccounts \
  --scope /subscriptions/abc-123/providers/Microsoft.Storage/locations/eastus
# Current: 180

# Step 3: Check limit
az quota show \
  --resource-name StorageAccounts \
  --scope /subscriptions/abc-123/providers/Microsoft.Storage/locations/eastus
# Limit: 250
# Available: 250 - 180 = 70 ✓

# 3c. Container Apps
# Step 1: Discover resource name
az quota list \
  --scope /subscriptions/abc-123/providers/Microsoft.App/locations/eastus
# Shows: "ManagedEnvironmentCount"

# Step 2: Check usage
az quota usage show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/abc-123/providers/Microsoft.App/locations/eastus
# Current: 8

# Step 3: Check limit
az quota show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/abc-123/providers/Microsoft.App/locations/eastus
# Limit: 50
# Available: 50 - 8 = 42 ✓

# 4. Validate Quota Evidence
# Cosmos DB headroom remains unknown until its actual applicable limit is established; readiness is blocked.
# Return quota evidence to validation; this does not authorize deployment or prove physical capacity.

# Alternative: If quotas were insufficient
# ❌ Container Apps: 49/50 (only 1 available, need 3)
# Action: Obtain approval before requesting a quota increase
#
# az quota update \
#   --resource-name ManagedEnvironmentCount \
#   --scope /subscriptions/abc-123/providers/Microsoft.App/locations/eastus \
#   --limit-object value=100 \
#   --resource-type Microsoft.App/managedEnvironments
```

---

> **Remember**: Checking limits and quotas early prevents deployment failures and ensures smooth infrastructure provisioning.
