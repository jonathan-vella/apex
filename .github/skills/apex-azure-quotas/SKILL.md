---
name: apex-azure-quotas
user-invocable: true
disable-model-invocation: false
argument-hint: "subscription, region, services and planned quantities"
description: '**UTILITY SKILL** — Check Azure quota headroom and SKU availability (region, zones, restrictions) for deployment planning; neither proves allocation capacity. WHEN: "check quotas", "service limits", "request quota increase", "quota exceeded", "SKU availability", "SKU restrictions", "vCPU limit". DO NOT USE FOR: deployment execution (apex-azure-deploy), cost analysis (apex-azure-cost-optimization).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.5"
---

# Azure Quotas — Service Limits & Headroom

Azure quotas constrain usage in provider-specific units and scopes. Sufficient
quota headroom does not establish SKU availability or regional capacity. Check
family and total regional vCPU limits, SKU restrictions and allocation capacity
separately; quota success is not deployment approval.

For whether a SKU is offered in the region and zones, read
[SKU availability](references/sku-availability.md). It owns the `AVAILABLE`,
`RESTRICTED`, `NOT_OFFERED` and `UNKNOWN` statuses used by the deploy pre-flight.

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
| Azure Portal        | [My quotas](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas) — request/support follow-up |
| REST API            | Same provider coverage constraints; not a bypass for unsupported quota types |
| Required permission | Reader (view) or Quota Request Operator (manage)                                                              |

Read [quota evidence and fallback](references/commands.md#quota-evidence-and-fallback)
before checks. It owns scope, units, numeric validation and failure handling.

## Rules

1. ✅ Always check quotas before deployment
2. ✅ Run `az quota list` first to discover correct quota resource names
   (ARM resource type ≠ quota resource name — there is **no 1:1 mapping**)
3. ✅ Compare quota headroom across approved candidate regions, not regional capacity
4. ✅ Propose an agreed buffer; submit increases only with explicit approval
5. ✅ CLI-first; follow the canonical failure classification and fallback
6. ✅ Monitor usage; alert at 80% threshold (Portal)

## Steps

Read [core workflows](references/core-workflows.md) for checks, region comparison,
approved increase requests and listing. Preserve selected subscription and region
on every command. Installation, registration, region changes and quota requests
require appropriate authorization; a read-only check does not grant it.

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
| `references/sku-availability.md`      | SKU availability by region and zone, statuses and helper    |
