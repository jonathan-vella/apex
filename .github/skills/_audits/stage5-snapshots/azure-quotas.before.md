---
name: azure-quotas
description: '**UTILITY SKILL** — Check and manage Azure quotas and usage across providers for deployment planning, capacity validation, and region selection. WHEN: "check quotas", "service limits", "request quota increase", "quota exceeded", "validate capacity", "regional availability", "vCPU limit". USE FOR: pre-deployment capacity checks, region selection, quota increase requests. DO NOT USE FOR: deployment execution (use azure-deploy), cost analysis (use azure-cost-optimization). INVOKES: azure-quota MCP (check, region-availability).'
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

## Prerequisites

- **Azure CLI** ≥ 2.50 authenticated (`az login`)
- **CLI extension**: `az extension add --name quota` (install once per machine)
- **RBAC**: `Reader` to view quotas; `Quota Request Operator` to submit increases
- **MCP server (optional augmentation)**: Azure MCP server in `.vscode/mcp.json` for the
  `mcp_azure_mcp_quota` namespace — see [MCP Tools (Optional Augmentation)](#mcp-tools-optional-augmentation)
  below. The CLI is the **primary** path; the MCP server is only for cases where an agent
  is already inside the Azure MCP namespace.

## Quick Reference

| Property            | Details                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Primary tool        | Azure CLI (`az quota`) — **always use first**                                                                 |
| Extension           | `az extension add --name quota` (install once)                                                                |
| Key commands        | `az quota list`, `az quota show`, `az quota usage list`, `az quota usage show`                                |
| Full CLI reference  | [commands.md](./references/commands.md)                                                                       |
| Azure Portal        | [My quotas](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas) — fallback only |
| REST API            | Microsoft.Quota provider — **unreliable, do NOT use first**                                                   |
| Required permission | Reader (view) or Quota Request Operator (manage)                                                              |

> **CLI-first is mandatory.** REST API and Portal show misleading data: `"No Limit"` and `"Unlimited"` typically mean the quota API does not support the resource type, **not** that capacity is unlimited. Service-specific hard limits still apply. Always start with `az quota list` / `az quota show` / `az quota usage show`. If CLI returns `BadRequest`, fall back to [Azure service limits docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) — never to REST API or Portal.

## Quota Types

| Type           | Adjustability               | Approval              | Examples                               |
| -------------- | --------------------------- | --------------------- | -------------------------------------- |
| Adjustable     | Increase via Portal/CLI/API | Usually auto-approved | VM vCPUs, Public IPs, Storage accounts |
| Non-adjustable | Fixed                       | Cannot be changed     | Subscription-wide hard limits          |

Requesting quota increases is **free** — you only pay for resources you use.

## Understanding Resource Name Mapping

⚠️ There is **NO 1:1 mapping** between ARM resource types and quota resource names. Never assume; always discover via `az quota list`. See [resource-name-mapping.md](references/resource-name-mapping.md) for examples and the discovery workflow.

## Core Workflows

See [core-workflows.md](references/core-workflows.md) for the 4 detailed workflows with full bash scripts:

1. **Check Quota for a Specific Resource** — verify limit + usage before deployment
2. **Compare Quotas Across Regions** — find the best region by available capacity
3. **Request Quota Increase** — submit + track approval
4. **List All Quotas for Planning** — inventory quotas for a provider in a region

## Troubleshooting

See [troubleshooting.md](references/troubleshooting.md) for common errors (`ExtensionNotFound`, `BadRequest`, `QuotaExceeded`, `InvalidScope`) and supported / unsupported resource providers.

## Additional Resources

- [Azure Quotas Overview](https://learn.microsoft.com/en-us/azure/quotas/quotas-overview)
- [Azure subscription limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
- [Request quota increases](https://learn.microsoft.com/en-us/azure/quotas/quickstart-increase-quota-portal)
- [Portal — My quotas](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas)

## MCP Tools (Optional Augmentation)

Frontmatter declares `INVOKES: azure-quota MCP` because Azure MCP exposes a `quota`
namespace that mirrors a subset of `az quota` commands. **The CLI remains the primary
path** (see Quick Reference above); the MCP namespace is only useful when an agent is
already operating inside Azure MCP and wants to avoid shelling out.

| MCP tool                                    | CLI equivalent (preferred)                      |
| ------------------------------------------- | ----------------------------------------------- |
| `mcp_azure_mcp_quota` `check`               | `az quota show` / `az quota list`               |
| `mcp_azure_mcp_quota` `region-availability` | `az quota list --scope ... -o table` per region |

If the MCP namespace is available **and** the user has not asked for shell-level output,
prefer it for a tighter agent loop. If `az quota` returns `BadRequest`, fall back to the
[Azure service limits docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
— never to the REST API or Portal.

## Rules

1. ✅ Always check quotas before deployment
2. ✅ Run `az quota list` first to discover correct quota resource names
3. ✅ Compare regions to find available capacity
4. ✅ Request a 20% buffer above immediate needs
5. ✅ Use `--output table` for quick scanning
6. ✅ Document quota sources (CLI vs docs)
7. ✅ Monitor usage; alert at 80% threshold (Portal)

## Steps

1. Install: `az extension add --name quota`
2. Discover quota resource names: `az quota list --scope ...` (match by `localizedValue`)
3. Check current usage: `az quota usage show --resource-name <name>`
4. Check quota limit: `az quota show --resource-name <name>`
5. Validate capacity: `Available = Limit - (Usage + Need)`
6. If sufficient → proceed; if insufficient → request increase or change region

## Gotchas

- **"No Limit" is misleading** — usually means the resource doesn't support the quota API; service-specific hard limits still apply.
- **REST API data is unreliable** — never use REST API or Portal as first approach.
- **No 1:1 ARM-to-quota mapping** — ARM resource type name ≠ quota resource name. Always discover via `az quota list`.
- **CLI-first workflow is mandatory** — `az quota list` → if `BadRequest` → docs. Never start with REST API or Portal.

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                             | When to Load                                                |
| ------------------------------------- | ----------------------------------------------------------- |
| `references/advanced-commands.md`     | Advanced Commands                                           |
| `references/commands.md`              | Commands                                                    |
| `references/core-workflows.md`        | Detailed quota check, compare, increase, and list workflows |
| `references/troubleshooting.md`       | Common errors and unsupported providers                     |
| `references/resource-name-mapping.md` | ARM-to-quota resource name mapping and discovery            |
