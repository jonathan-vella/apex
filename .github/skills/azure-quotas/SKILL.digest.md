<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Quotas - Service Limits & Capacity Management (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Overview

**What are Azure Quotas?**

Azure quotas (also called service limits) are the maximum number of resources you can deploy in a subscription. Quotas:

- Prevent accidental over-provisioning
- Ensure fair resource distribution across Azure

> _See SKILL.md for full content._

## When to Use This Skill

Invoke this skill when:

- **Planning a new deployment** - Validate capacity before deployment
- **Selecting an Azure region** - Compare quota availability across regions
- **Troubleshooting quota exceeded errors** - Check current usage vs limits
- **Requesting quota increases** - Submit increase requests via CLI or Portal

> _See SKILL.md for full content._

## Quick Reference

| **Property**               | **Details**                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Primary Tool**           | Azure CLI (`az quota`) - **USE THIS FIRST, ALWAYS**                                                                  |
| **Extension Required**     | `az extension add --name quota` (MUST install first)                                                                 |
| **Key Commands**           | `az quota list`, `az quota show`, `az quota usage list`, `az quota usage show`                                       |
| **Complete CLI Reference** | [commands.md](./references/commands.md)                                                                              |

> _See SKILL.md for full content._

## Quota Types

| **Type**           | **Adjustability**               | **Approval**          | **Examples**                           |
| ------------------ | ------------------------------- | --------------------- | -------------------------------------- |
| **Adjustable**     | Can increase via Portal/CLI/API | Usually auto-approved | VM vCPUs, Public IPs, Storage accounts |
| **Non-adjustable** | Fixed limits                    | Cannot be changed     | Subscription-wide hard limits          |

**Important:** Requesting quota increases is **free**. You only pay for resources you actually use, not for quota allocation.

> _See SKILL.md for full content._

## Understanding Resource Name Mapping

**⚠️ CRITICAL:** There is **NO 1:1 mapping** between ARM resource types and quota resource names. Never assume the quota resource name from the ARM type.

📋 **Reference**: Read `references/resource-name-mapping.md` for example mappings and the discovery workflow.

## Core Workflows

📋 **Reference**: Read `references/core-workflows.md` for 4 detailed workflows with full bash scripts:

1. **Check Quota for a Specific Resource** — Verify limit and usage before deployment
2. **Compare Quotas Across Regions** — Find the best region based on available capacity
3. **Request Quota Increase** — Submit increase requests with approval process
4. **List All Quotas for Planning** — Inventory quotas for a provider in a region

> _See SKILL.md for full content._

## Troubleshooting

📋 **Reference**: Read `references/troubleshooting.md` for common errors (ExtensionNotFound, BadRequest, QuotaExceeded, InvalidScope) and supported/unsupported resource providers.

## Additional Resources

| Resource                         | Link                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **CLI Commands Reference**       | [commands.md](./references/commands.md) - Complete syntax, parameters, examples                                                          |
| **Azure Quotas Overview**        | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/quotas/quotas-overview)                                                        |
| **Service Limits Documentation** | [Azure subscription limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) |
| **Azure Portal - My Quotas**     | [Portal Link](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas)                                          |

> _See SKILL.md for full content._

## Best Practices

1. ✅ **Always check quotas before deployment** - Prevent quota exceeded errors
2. ✅ **Run `az quota list` first** - Discover correct quota resource names
3. ✅ **Compare regions** - Find regions with available capacity
4. ✅ **Account for growth** - Request 20% buffer above immediate needs
5. ✅ **Use table output for overview** - `--output table` for quick scanning
6. ✅ **Document quota sources** - Track whether from quota API or official docs

> _See SKILL.md for full content._

## Workflow Summary

```
┌─────────────────────────────────────────┐
│  1. Install quota extension             │
│     az extension add --name quota       │
└─────────────────┬───────────────────────┘
                  │

> _See SKILL.md for full content._
