<!-- ref:azure-storage-tiers-v2 -->

# Azure Storage Cost Review

Adapted from upstream `azure-cost` (`cost-optimization/references/services/storage.md`
and `storage-lifecycle.md`). Findings are review items, not actions. Price them
from actual cost data and the
[pricing guidance](../../apex-azure-defaults/references/pricing-guidance.md); never
use rule-of-thumb savings or deletion shortcuts.

## Scope

Resolve subscription names to subscription scope paths. For cross-subscription
requests, process no more than ten accessible subscriptions per batch. Tenant
IDs are not Cost Management scopes.

## Evidence Workflow

1. Query `AdvisorResources` for Cost recommendations whose resource ID belongs
   to a storage account or managed disk.
2. Query `Resources` for matching configuration such as SKU, redundancy, kind,
   access tier, location, attachment state and ownership tags.
3. Join recommendations to inventory by resource ID. Preserve the Advisor
   recommendation text, impact, savings fields, currency, and period.
4. Use access, capacity, and transaction metrics only when an ARM MCP monitoring
   operation (or the Azure Monitor Metrics API fallback) returns them for the
   same resource and period.

An unattached disk, missing policy, SKU, redundancy choice, or resource tag is
an inventory fact, not proof of waste. Do not classify storage as idle,
underutilized, or safe to tier, resize, or delete without an authoritative
recommendation or matching observed usage evidence. Report evidence gaps
instead of filling them.

## Access Tiers

Compare tiers against the workload's observed access frequency and retrieval
requirements, not a generic age threshold. Do not recommend Archive for data
with unpredictable or urgent retrieval.

| Tier    | Suited to                              | Minimum retention | Retrieval                  |
| ------- | -------------------------------------- | ----------------- | -------------------------- |
| Hot     | Frequent reads and writes              | None              | Immediate                  |
| Cool    | Occasional reads                       | 30 days           | Immediate, per-GB charge   |
| Cold    | Rare reads, compliance copies          | 90 days           | Immediate, per-GB charge   |
| Archive | Archival, legal hold                   | 180 days          | Rehydration takes hours    |

Moving data out of a tier before its minimum retention incurs an early-deletion
charge. Include minimum-retention, retrieval, early-deletion, and rehydration
costs in any comparison.

## Review Signals

Each signal is a question for the owner. Recommend a change only when Advisor or
observed metrics support it.

| Signal                                   | Check                                                         | Recommendation (after review)                 |
| ---------------------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| No lifecycle policy                      | Blob service has no lifecycle management rules                | Propose tiering rules                         |
| Hot-only data with infrequent access     | Last-access metrics show most blobs untouched for the period  | Propose Cool or Cold, or last-access tiering  |
| Premium SKU outside production           | `sku.name` contains `Premium` and the environment tag is non-production | Confirm performance needs, then propose Standard |
| Geo-redundant SKU outside production     | `sku.name` contains `GRS` or `GZRS` and the environment tag is non-production | Confirm DR requirements, then propose LRS or ZRS |
| Classic (v1) account                     | `kind =~ 'Storage'`                                           | Confirm, then propose an upgrade to StorageV2 |
| Long soft-delete retention               | `deleteRetentionPolicy.days` exceeds the agreed retention      | Align with the owner's retention requirement   |
| Heavy snapshot or version history        | Snapshot or version storage is a large share of the account    | Review retention with the data owner           |

Unattached disks, empty containers and old snapshots are cleanup candidates only
when the owner confirms they are unused; follow the skill's safe-classification
rules and never delete as part of the assessment.

## Lifecycle Policy Template (Tiering Only)

Lifecycle policy contents are not queryable through Resource Graph. Read them
with the applicable ARM MCP storage operation, or the Storage Resource Provider
API through the [fallback process](tools-and-safety.md#tool-preference).

The day values below are placeholders, not recommendations. Derive them from
observed access evidence and the owner's retention requirements.
`daysAfterLastAccessTimeGreaterThan` requires last-access-time tracking; verify
it the same way, and leave the recommendation unresolved if that evidence is
unavailable. Add deletion rules only for retention periods the data owner has
approved.

```json
{
  "rules": [
    {
      "enabled": true,
      "name": "example-tier-inactive-base-blobs",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterLastAccessTimeGreaterThan": 30 },
            "tierToArchive": { "daysAfterLastAccessTimeGreaterThan": 180 }
          }
        },
        "filters": { "blobTypes": ["blockBlob"] }
      }
    }
  ]
}
```

## Resource Graph Queries

Keep `id` and `subscriptionId` so duplicate names across subscriptions stay distinct.

```kql
AdvisorResources
| where properties.category == 'Cost'
| extend resourceId = tolower(tostring(properties.resourceMetadata.resourceId))
| where resourceId has '/providers/microsoft.storage/storageaccounts/'
    or resourceId has '/providers/microsoft.compute/disks/'
| project id, subscriptionId, resourceId, impact=properties.impact,
    solution=properties.shortDescription.solution, extendedProperties=properties.extendedProperties
```

```kql
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where sku.name contains 'Premium' or sku.name contains 'GRS'
| project id, subscriptionId, name, resourceGroup, location, kind, sku=sku.name, tags
```

```kql
Resources
| where type =~ 'microsoft.compute/disks'
| where isempty(managedBy)
| project id, subscriptionId, name, resourceGroup, location, diskSizeGb=properties.diskSizeGB, sku=sku.name, tags
```

## Pricing

Use the ARM MCP `get_retail_prices` tool for the requested region, redundancy,
tier, and currency. Include storage, transaction, retrieval, early-deletion, and
rehydration costs when relevant; never rely on embedded rates.
