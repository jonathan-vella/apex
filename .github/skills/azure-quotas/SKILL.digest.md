<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Quotas - Service Limits & Capacity Management (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Overview

**What are Azure Quotas?**

Azure quotas (also called service limits) are the maximum number of resources you can deploy in a subscription. Quotas:
- Prevent accidental over-provisioning
- Ensure fair resource distribution across Azure
- Represent **available capacity** in each region
- Can be increased (adjustable quotas) or are fixed (non-adjustable)

**Key Concept:** **Quotas = Resource Availability**

If you don't have quota, you cannot deploy resources. Always check quotas when planning deployments or selecting regions.


## When to Use This Skill

Invoke this skill when:

- **Planning a new deployment** - Validate capacity before deployment
- **Selecting an Azure region** - Compare quota availability across regions
- **Troubleshooting quota exceeded errors** - Check current usage vs limits
- **Requesting quota increases** - Submit increase requests via CLI or Portal
- **Comparing regional capacity** - Find regions with available quota
- **Validating provisioning limits** - Ensure deployment won't exceed quotas


## Quick Reference

| **Property** | **Details** |
|--------------|-------------|
| **Primary Tool** | Azure CLI (`az quota`) - **USE THIS FIRST, ALWAYS** |
| **Extension Required** | `az extension add --name quota` (MUST install first) |
| **Key Commands** | `az quota list`, `az quota show`, `az quota usage list`, `az quota usage show` |
| **Complete CLI Reference** | [commands.md](./references/commands.md) |
| **Azure Portal** | [My quotas](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas) - Use only as fallback |
| **REST API** | Microsoft.Quota provider - **Unreliable, do NOT use first** |
| **Required Permission** | Reader (view) or Quota Request Operator (manage) |

> **⚠️ CRITICAL: ALWAYS USE CLI FIRST**
>
> **Azure CLI (`az quota`) is the ONLY reliable method** for checking quotas. **Use CLI FIRST, always.**
>
> **DO NOT use REST API or Portal as your first approach.** They are unreliable and misleading.

> _See SKILL.md for full content._

## Quota Types

| **Type** | **Adjustability** | **Approval** | **Examples** |
|----------|-------------------|--------------|--------------|
| **Adjustable** | Can increase via Portal/CLI/API | Usually auto-approved | VM vCPUs, Public IPs, Storage accounts |
| **Non-adjustable** | Fixed limits | Cannot be changed | Subscription-wide hard limits |

**Important:** Requesting quota increases is **free**. You only pay for resources you actually use, not for quota allocation.


## Understanding Resource Name Mapping

**⚠️ CRITICAL:** There is **NO 1:1 mapping** between ARM resource types and quota resource names.

### Example Mappings

| ARM Resource Type | Quota Resource Name |
|-------------------|---------------------|
| `Microsoft.App/managedEnvironments` | `ManagedEnvironmentCount` |
| `Microsoft.Compute/virtualMachines` | `standardDSv3Family`, `cores`, `virtualMachines` |
| `Microsoft.Network/publicIPAddresses` | `PublicIPAddresses`, `IPv4StandardSkuPublicIpAddresses` |

### Discovery Workflow

**Never assume the quota resource name from the ARM type.** Always use this workflow:

1. **List all quotas** for the resource provider:

> _See SKILL.md for full content._

## Core Workflows

### Workflow 1: Check Quota for a Specific Resource

**Scenario:** Verify quota limit and current usage before deployment

```bash
# 1. Install quota extension (if not already installed)
az extension add --name quota

# 2. List all quotas for the provider to find the quota resource name
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus

# 3. Show quota limit for a specific resource
az quota show \
  --resource-name standardDSv3Family \

> _See SKILL.md for full content._

## Troubleshooting

### Common Errors

| **Error** | **Cause** | **Solution** |
|-----------|-----------|--------------|
| REST API "No Limit" | REST API showing misleading "unlimited" values | **CRITICAL: "No Limit" ≠ unlimited!** Use CLI instead. See warning above. Check [service limits docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) |
| REST API failures | REST API unreliable and misleading | **Always use Azure CLI** - See [commands.md](./references/commands.md) for complete CLI reference |
| `ExtensionNotFound` | Quota extension not installed | `az extension add --name quota` |
| `BadRequest` | Resource provider not supported by quota API | Use CLI (preferred) or [service limits docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) |
| `MissingRegistration` | Microsoft.Quota provider not registered | `az provider register --namespace Microsoft.Quota` |
| `QuotaExceeded` | Deployment would exceed quota | Request increase or choose different region |
| `InvalidScope` | Incorrect scope format | Use pattern: `/subscriptions/<id>/providers/<namespace>/locations/<region>` |

### Unsupported Resource Providers

**Known unsupported providers:**

> _See SKILL.md for full content._

## Additional Resources

| Resource | Link |
|----------|------|
| **CLI Commands Reference** | [commands.md](./references/commands.md) - Complete syntax, parameters, examples |
| **Azure Quotas Overview** | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/quotas/quotas-overview) |
| **Service Limits Documentation** | [Azure subscription limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) |
| **Azure Portal - My Quotas** | [Portal Link](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas) |
| **Request Quota Increases** | [How to request increases](https://learn.microsoft.com/en-us/azure/quotas/quickstart-increase-quota-portal) |


## Best Practices

1. ✅ **Always check quotas before deployment** - Prevent quota exceeded errors
2. ✅ **Run `az quota list` first** - Discover correct quota resource names
3. ✅ **Compare regions** - Find regions with available capacity
4. ✅ **Account for growth** - Request 20% buffer above immediate needs
5. ✅ **Use table output for overview** - `--output table` for quick scanning
6. ✅ **Document quota sources** - Track whether from quota API or official docs
7. ✅ **Monitor usage trends** - Set up alerts at 80% threshold (via Portal)


## Workflow Summary

```
┌─────────────────────────────────────────┐
│  1. Install quota extension             │
│     az extension add --name quota       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  2. Discover quota resource names       │
│     az quota list --scope ...           │
│     (Match by localizedValue)           │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐

> _See SKILL.md for full content._
