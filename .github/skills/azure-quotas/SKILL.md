---
name: azure-quotas
description: '**UTILITY SKILL** — Check and manage Azure quotas and usage across providers for deployment planning, capacity validation, and region selection. WHEN: "check quotas", "service limits", "request quota increase", "quota exceeded", "validate capacity", "regional availability", "vCPU limit". DO NOT USE FOR: deployment execution (azure-deploy), cost analysis (azure-cost-optimization).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.5"
---

# Azure Quotas — Service Limits & Capacity Management

Azure quotas (service limits) are the maximum number of resources you can
deploy in a subscription. **Quotas = available capacity** — if you do not
have quota, you cannot deploy. Always check before planning deployments
or selecting regions.

## Prerequisites

- **Azure CLI** ≥ 2.50 authenticated (`az login`)
- **CLI extension**: `az extension add --name quota` (install once)
- **RBAC**: `Reader` to view quotas; `Quota Request Operator` to submit increases

## Quick Reference

| Property            | Details                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Primary tool        | Azure CLI (`az quota`) — **always use first**                                                                 |
| Extension           | `az extension add --name quota` (install once)                                                                |
| Key commands        | `az quota list`, `az quota show`, `az quota usage list`, `az quota usage show`                                |
| Full CLI reference  | [`references/commands.md`](references/commands.md)                                                            |
| Azure Portal        | [My quotas](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas) — fallback only |
| REST API            | Microsoft.Quota provider — **unreliable, do NOT use first**                                                   |
| Required permission | Reader (view) or Quota Request Operator (manage)                                                              |

> **CLI-first is mandatory.** REST API and Portal report `"No Limit"` /
> `"Unlimited"` when the API does not cover a resource type — **not**
> when capacity is unlimited. Service-specific hard limits still apply.
> If CLI returns `BadRequest`, fall back to
> [Azure service limits docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
> — never to REST API or Portal.

## Rules

1. ✅ Always check quotas before deployment
2. ✅ Run `az quota list` first to discover correct quota resource names
   (ARM resource type ≠ quota resource name — there is **no 1:1 mapping**)
3. ✅ Compare regions to find available capacity
4. ✅ Request a 20% buffer above immediate needs
5. ✅ CLI-first; REST API and Portal are fallback-only
6. ✅ Monitor usage; alert at 80% threshold (Portal)

## Steps

1. Install: `az extension add --name quota`
2. Discover quota resource names: `az quota list --scope ...` (match by `localizedValue`)
3. Check current usage: `az quota usage show --resource-name <name>`
4. Check quota limit: `az quota show --resource-name <name>`
5. Validate capacity: `Available = Limit − (Usage + Need)`
6. If sufficient → proceed; if insufficient → request increase or change region

For the 4 detailed workflows (specific check, region compare, increase request,
list-all), read [`references/core-workflows.md`](references/core-workflows.md).

For ARM-to-quota name mapping examples and discovery workflow, read
[`references/resource-name-mapping.md`](references/resource-name-mapping.md).

For common errors (`ExtensionNotFound`, `BadRequest`, `QuotaExceeded`,
`InvalidScope`) and supported/unsupported providers, read
[`references/troubleshooting.md`](references/troubleshooting.md).

## Reference Index

| Reference                             | When to Load                                                |
| ------------------------------------- | ----------------------------------------------------------- |
| `references/commands.md`              | Full `az quota` CLI command reference                       |
| `references/advanced-commands.md`     | Less-common quota CLI patterns                              |
| `references/core-workflows.md`        | Detailed check, compare, increase, and list workflows       |
| `references/troubleshooting.md`       | Common errors and unsupported providers                     |
| `references/resource-name-mapping.md` | ARM-to-quota resource name mapping and discovery            |
