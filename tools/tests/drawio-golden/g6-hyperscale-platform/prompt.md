# G6 — Hyperscale Multi-Region Platform

Generate a decomposed diagram set (overview + region details) for a
multi-region hyperscale platform.

## Regions

- **Sweden Central** (primary)
- **Germany West Central** (secondary, fully active)

## Subscriptions per region (3 each, 6 total)

- Platform sub
- App sub
- Data sub

## Per-region resources (replicated in each region)

- 2× AKS cluster (production + canary), private clusters with Azure CNI
- Container Registry Premium (geo-replication enabled across both regions)
- Key Vault Premium
- 2× Log Analytics workspace
- Storage Account (ZRS)
- Synapse workspace
- Purview account (per region)
- Front Door Standard endpoint origin

## Global resources

- Azure Front Door **Premium** (global, multi-region routing)
- Azure Traffic Manager (DNS-level fallback)
- Cosmos DB for NoSQL (multi-master, both regions writable)
- Event Hubs **dedicated cluster** (Sweden Central, geo-paired to DE)

## Observability

- Microsoft Sentinel
- Application Insights (per workload)
- Defender for Cloud at MG scope

## Diagram expectations

- **Type:** decomposed — MUST emit at least 3 `<diagram>` pages:
  1. **Overview** — global resources + region zones.
  2. **Sweden Central detail** — per-sub resources.
  3. **Germany West Central detail** — per-sub resources.
- **Per-page resource count:** ≤ 30 (T-023 tier `>50` rule).
- **Zones:** 2 region labels, 6 subscription scopes, multi-master
  replication links visible at overview level only.
- **Edges:** `Multi-master replication`, `Front Door routing`.
- **Legend:** required on overview page.
