---
name: azure-quotas
description: 'Check/manage Azure quotas and usage across providers. For deployment planning, capacity validation, region selection. WHEN: "check quotas", "service limits", "current usage", "request quota increase", "quota exceeded", "validate capacity", "regional availability", "provisioning limits", "vCPU limit", "how many vCPUs available in my subscription".'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.5"
---

---

# Azure Quotas - Service Limits & Capacity Management

> **AUTHORITATIVE GUIDANCE** — Follow these instructions exactly for quota management and capacity validation.

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

| **Property**               | **Details**                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Primary Tool**           | Azure CLI (`az quota`) - **USE THIS FIRST, ALWAYS**                                                                  |
| **Extension Required**     | `az extension add --name quota` (MUST install first)                                                                 |
| **Key Commands**           | `az quota list`, `az quota show`, `az quota usage list`, `az quota usage show`                                       |
| **Complete CLI Reference** | [commands.md](./references/commands.md)                                                                              |
| **Azure Portal**           | [My quotas](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas) - Use only as fallback |
| **REST API**               | Microsoft.Quota provider - **Unreliable, do NOT use first**                                                          |
| **Required Permission**    | Reader (view) or Quota Request Operator (manage)                                                                     |

> **⚠️ CRITICAL: ALWAYS USE CLI FIRST**
>
> **Azure CLI (`az quota`) is the ONLY reliable method** for checking quotas. **Use CLI FIRST, always.**
>
> **DO NOT use REST API or Portal as your first approach.** They are unreliable and misleading.
>
> **Why you must use CLI first:**
>
> - REST API is unreliable and shows misleading results
> - REST API "No Limit" or "Unlimited" values **DO NOT mean unlimited capacity**
> - "No Limit" typically means the resource doesn't support quota API (not unlimited!)
> - CLI provides clear `BadRequest` errors when providers aren't supported
> - CLI has consistent output format and better error messages
> - Portal may show incomplete or cached data
>
> **Mandatory workflow:**
>
> 1. **FIRST:** Try `az quota list` / `az quota show` / `az quota usage show`
> 2. **If CLI returns `BadRequest`:** Then use [Azure service limits docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
> 3. **Never start with REST API or Portal** - only use as last resort
>
> **If you see "No Limit" in REST API/Portal:** This is NOT unlimited capacity. It means:
>
> - The quota API doesn't support that resource type, OR
> - The quota isn't enforced via the API, OR
> - Service-specific limits still apply (check documentation)
>
> For complete CLI command reference and examples, see [commands.md](./references/commands.md).

## Quota Types

| **Type**           | **Adjustability**               | **Approval**          | **Examples**                           |
| ------------------ | ------------------------------- | --------------------- | -------------------------------------- |
| **Adjustable**     | Can increase via Portal/CLI/API | Usually auto-approved | VM vCPUs, Public IPs, Storage accounts |
| **Non-adjustable** | Fixed limits                    | Cannot be changed     | Subscription-wide hard limits          |

**Important:** Requesting quota increases is **free**. You only pay for resources you actually use, not for quota allocation.

## Understanding Resource Name Mapping

**⚠️ CRITICAL:** There is **NO 1:1 mapping** between ARM resource types and quota resource names. Never assume the quota resource name from the ARM type.

📋 **Reference**: Read `references/resource-name-mapping.md` for example mappings and the discovery workflow.

## Core Workflows

📋 **Reference**: Read `references/core-workflows.md` for 4 detailed workflows with full bash scripts:

1. **Check Quota for a Specific Resource** — Verify limit and usage before deployment
2. **Compare Quotas Across Regions** — Find the best region based on available capacity
3. **Request Quota Increase** — Submit increase requests with approval process
4. **List All Quotas for Planning** — Inventory quotas for a provider in a region

## Troubleshooting

📋 **Reference**: Read `references/troubleshooting.md` for common errors (ExtensionNotFound, BadRequest, QuotaExceeded, InvalidScope) and supported/unsupported resource providers.

## Additional Resources

| Resource                         | Link                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **CLI Commands Reference**       | [commands.md](./references/commands.md) - Complete syntax, parameters, examples                                                          |
| **Azure Quotas Overview**        | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/quotas/quotas-overview)                                                        |
| **Service Limits Documentation** | [Azure subscription limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) |
| **Azure Portal - My Quotas**     | [Portal Link](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas)                                          |
| **Request Quota Increases**      | [How to request increases](https://learn.microsoft.com/en-us/azure/quotas/quickstart-increase-quota-portal)                              |

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
│  3. Check current usage                 │
│     az quota usage show                 │
│     --resource-name <name>              │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  4. Check quota limit                   │
│     az quota show                       │
│     --resource-name <name>              │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  5. Validate capacity                   │
│     Available = Limit - (Usage + Need)  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
         ┌────────┴────────┐
         │                 │
    ✅ Sufficient     ❌ Insufficient
         │                 │
         ▼                 ▼
    Proceed          Request increase
                     or change region
```

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                             | When to Load                                                |
| ------------------------------------- | ----------------------------------------------------------- |
| `references/advanced-commands.md`     | Advanced Commands                                           |
| `references/commands.md`              | Commands                                                    |
| `references/core-workflows.md`        | Detailed quota check, compare, increase, and list workflows |
| `references/troubleshooting.md`       | Common errors and unsupported providers                     |
| `references/resource-name-mapping.md` | ARM-to-quota resource name mapping and discovery            |
