# Azure Cache for Redis → Azure Managed Redis (AMR) Migration

> **Target for both paths**: Azure Managed Redis (AMR) — M, B, X (Flash), A series
> **The source SKU decides the migration path** — see the decision table below.

## Retirement Dates

| Source | Retires | Instances disabled from |
|---|---|---|
| Azure Cache for Redis Basic, Standard, Premium | September 30, 2028 | October 1, 2028 |
| Azure Cache for Redis Enterprise, Enterprise Flash | March 31, 2027 | April 1, 2027 |

Source: [Azure Cache for Redis retirement FAQ](https://learn.microsoft.com/azure/azure-cache-for-redis/retirement-faq).
Don't recommend any Azure Cache for Redis tier for new projects.

## Decision Table — Which Path?

| Source SKU | ARM Resource Type | CLI / PowerShell | Microsoft Learn guide | Dedicated skill (optional) |
|---|---|---|---|---|
| **ACR / OSS Redis** — Basic, Standard, Premium (C0–C6, P1–P5) | `Microsoft.Cache/redis` | `az redis`, `*-AzRedisCache` | [Migrate Basic, Standard, and Premium tiers](https://learn.microsoft.com/azure/redis/migrate/migrate-basic-standard-premium-overview) | [`amr-migration-skill`](https://github.com/AzureManagedRedis/amr-migration-skill) |
| **ACRE** — Enterprise (`Enterprise_E*`), Enterprise Flash (`EnterpriseFlash_F*`) | `Microsoft.Cache/redisEnterprise` | `az redisenterprise`, `*-AzRedisEnterprise*` | [Migrate Enterprise tier](https://learn.microsoft.com/azure/redis/migrate/migrate-redis-enterprise-overview) | [`acre-to-amr-migration-skill`](https://github.com/AzureManagedRedis/acre-to-amr-migration-skill) |

The dedicated skills are maintained by the Azure Managed Redis team and aren't bundled with APEX; installing them
is the user's decision. ACR and ACRE are **fundamentally different products** with different ARM resource types,
APIs and migration mechanics. Always disambiguate first.

## Disambiguation — How to Tell ACR from ACRE

Ask the user, or inspect the resource. Any **one** of these signals identifies the source:

**ACR (OSS) indicators:**

- Resource type `Microsoft.Cache/redis` (no "Enterprise" suffix)
- SKU names `Basic`, `Standard`, `Premium`, or sizes `C0`–`C6`, `P1`–`P5`
- CLI: `az redis ...` commands
- PowerShell: `New-AzRedisCache`, `Get-AzRedisCache`, etc.
- DNS suffix `.redis.cache.windows.net`
- Default TLS port `6380`

**ACRE indicators:**

- Resource type `Microsoft.Cache/redisEnterprise`
- SKU names starting with `Enterprise_` (e.g. `Enterprise_E10`, `Enterprise_E20`) or `EnterpriseFlash_` (e.g. `EnterpriseFlash_F300`)
- CLI: `az redisenterprise ...` commands
- PowerShell: `New-AzRedisEnterpriseCache`, `Get-AzRedisEnterpriseCache`, etc.
- Default TLS port `10000`
- May reference geo-replication groups (`databases create-replica-link`), Private Endpoints, or Private Link DNS zones

If the user has a **mix of ACR and ACRE** resources, assess each group separately.

## Key Migration Facts

### ACR → AMR

- **Port**: 6380 → **10000**. Non-TLS 6379 not supported on AMR.
- **DNS suffix**: `.redis.cache.windows.net` → `<region>.redis.azure.net`
- **Redis version**: 6 → **7.4**
- **Clustering**: AMR is clustered by default; clients must support clustered Redis (a nonclustered option exists up to 25 GB)
- **No "shards"** in AMR-facing terminology — sharding is internal. Use performance tier (Balanced, Memory Optimized) and size (e.g. B10, M20).
- **Auth**: Adopt **Microsoft Entra ID** post-migration. Entra config is **not** auto-migrated.
- **DNS-switch automated migration** keeps old hostname working, but the port change still applies — apps must be updated.

### ACRE → AMR

- **ARM resource type is unchanged** between the ACRE source and AMR target — both use `Microsoft.Cache/redisEnterprise`. Property values do change (API version, SKU naming, etc.).
- **Geo-replicated caches** require create-new-and-swap, not in-place migration.
- **Private Endpoints / Private Link** DNS zones must be updated.
- **Database config parity** (eviction policy, modules) must match across replicas before migration.

## APEX Path

1. Determine the source with the disambiguation signals above.
2. 03-Architect records the target AMR tier and size in `sku-manifest.json`, priced through `cost-estimate-subagent`.
3. 05-IaC Planner plans the AMR resource (`Microsoft.Cache/redisEnterprise`; AVM `avm/res/cache/redis-enterprise`
   for Bicep) with Microsoft Entra ID authentication and private endpoints per the APEX security baseline.
4. Data migration and client cutover follow the Microsoft Learn guide. Any step that changes or deletes the source
   cache needs explicit approval.

## References

- [Azure Cache for Redis retirement FAQ](https://learn.microsoft.com/azure/azure-cache-for-redis/retirement-faq)
- [What is Azure Managed Redis?](https://learn.microsoft.com/azure/redis/overview)
- [Migrate Basic, Standard, and Premium tiers to Azure Managed Redis](https://learn.microsoft.com/azure/redis/migrate/migrate-basic-standard-premium-overview)
- [Migrate Enterprise tier to Azure Managed Redis](https://learn.microsoft.com/azure/redis/migrate/migrate-redis-enterprise-overview)
