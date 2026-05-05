# G7 — Multi-Region Active-Active Web Platform

Generate a logical diagram for an active-active web platform spanning two
Azure regions.

## Regions

- **Sweden Central** (primary writes possible)
- **Germany West Central** (primary writes possible)

## Global

- Azure Front Door **Premium** (single endpoint, weighted routing)
- Azure DNS zone

## Per-region (mirrored)

- App Service Plan (Premium V3 P1v3)
- Web App (deployed to plan above)
- Azure Cosmos DB account region (multi-region writes enabled)
- Storage Account **GZRS** (geo-zone redundant)
- Key Vault per region
- Application Insights per workload

## Shared (single instance)

- Log Analytics workspace (in Sweden Central, both regions ship logs here)

## Diagram expectations

- **Type:** logical with explicit region zones.
- **Boundaries:** 2 region zones; trust boundary at Front Door (public
  ingress); paired Web App + Cosmos region as visual groups.
- **Edges:** `Multi-region writes` between Cosmos regions;
  `Geo-replication` for storage; Front Door routing edges to both
  regions.
- **Legend:** required.
