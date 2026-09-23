<!-- ref:azure-storage-tiers-v1 -->

# Azure Storage Cost Review

Adapted from upstream `azure-cost`. Findings are review items, not actions. Price
them from actual cost data and the
[pricing guidance](../../apex-azure-defaults/references/pricing-guidance.md); never
use rule-of-thumb savings or deletion shortcuts.

## Access Tier Decision Matrix

| Typical time since last access | Access pattern                 | Tier    | Minimum retention       |
| ------------------------------ | ------------------------------ | ------- | ----------------------- |
| Under 30 days                  | Frequent reads and writes      | Hot     | None                    |
| 30 to 90 days                  | Occasional reads               | Cool    | 30 days                 |
| 90 to 180 days                 | Rare reads, compliance copies  | Cold    | 90 days                 |
| Over 180 days                  | Archival, legal hold           | Archive | 180 days; rehydration takes hours |

Moving data out of a tier before its minimum retention incurs an early-deletion
charge, so confirm access patterns from metrics before recommending a move.

## Review Signals

| Signal                                   | Check                                                         | Recommendation (after review)                 |
| ---------------------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| No lifecycle policy                      | Blob service has no lifecycle management rules                | Propose tiering rules                         |
| Hot-only data with infrequent access     | Last-access metrics show most blobs untouched for 30+ days    | Propose Cool or Cold, or last-access tiering  |
| Premium SKU outside production           | `sku.name` contains `Premium` and the environment tag is non-production | Confirm performance needs, then propose Standard |
| Geo-redundant SKU outside production     | `sku.name` contains `GRS` or `GZRS` and the environment tag is non-production | Confirm DR requirements, then propose LRS or ZRS |
| Long soft-delete retention               | `deleteRetentionPolicy.days` exceeds the agreed retention      | Align with the owner's retention requirement   |
| Heavy snapshot or version history        | Snapshot or version storage is a large share of the account    | Review retention with the data owner           |

Unattached disks, empty containers and old snapshots are cleanup candidates only
when the owner confirms they are unused; follow the skill's safe-classification
rules and never delete as part of the assessment.

## Lifecycle Policy Template (Tiering Only)

`daysAfterLastAccessTimeGreaterThan` requires last-access-time tracking on the
storage account. Add deletion rules only for retention periods the data owner
has approved.

```json
{
  "rules": [
    {
      "enabled": true,
      "name": "move-to-cool-after-30-days",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterLastAccessTimeGreaterThan": 30 }
          }
        },
        "filters": { "blobTypes": ["blockBlob"] }
      }
    },
    {
      "enabled": true,
      "name": "move-to-archive-after-180-days",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
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
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where sku.name contains 'Premium' or sku.name contains 'GRS'
| project id, subscriptionId, name, resourceGroup, location, sku=sku.name, tags
```

```kql
Resources
| where type =~ 'microsoft.compute/disks'
| where isempty(managedBy)
| project id, subscriptionId, name, resourceGroup, location, diskSizeGb=properties.diskSizeGB, sku=sku.name
```
