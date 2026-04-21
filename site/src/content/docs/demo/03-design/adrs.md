---
title: "Architecture Decision Records"
description: "Three ADRs documenting compute, persistence, and network posture decisions for the Malta catering online ordering app"
sidebar:
  order: 1
---

## ADR-0001: App Service S1 (Linux Containers) as Compute Platform

> **Status**: Accepted (Revised 2026-04-15 — replaces original ACA Consumption decision)
> **Date**: 2026-04-15
> **Deciders**: Architecture Agent (malta-catering project)

### Context

The Malta Catering ordering portal needs a compute platform to host a containerized
React SPA with a lightweight API for pastizzi/Cisk/Kinnie orders. Requirements:

- **Budget**: EUR 100–500/month (soft cap)
- **Traffic**: 1 TPS sustained, up to 1,000 concurrent users at lunch-rush peaks
- **Operations**: Minimal ops overhead — managed TLS, no dedicated infra to manage
- **Deployment**: Containerized workload (single Docker image) via Azure Container Registry
- **Region**: `swedencentral` for GDPR EU data residency

The original decision selected Azure Container Apps (Consumption plan). However,
deployment was blocked by a **regional capacity error**
(`ManagedEnvironmentCapacityHeavyUsageError` in `swedencentral`) preventing creation
of the Container Apps Environment. Combined with a strategic preference for App Service
as a more familiar, always-on PaaS platform with native staging slot support, the
team decided to switch to Azure App Service S1 (Linux) with container deployment
from ACR Premium.

The architecture must be simple enough for a demo/dev environment while retaining
a clear production upgrade path.

### Decision

Use **Azure App Service S1 (Linux) with containers deployed from ACR Premium** to
host both the React SPA and API within a single containerized application.

#### Configuration

| Setting             | Value                              |
| ------------------- | ---------------------------------- |
| SKU                 | S1 (Standard)                      |
| OS                  | Linux (reserved)                   |
| Container source    | ACR Premium (private endpoint)     |
| VNet Integration    | `snet-app-service` (`10.0.0.0/27`) |
| Staging Slot        | Enabled (blue-green deployments)   |
| Always-on           | `true`                             |
| Managed Identity    | System-assigned, enabled           |
| HTTPS only          | `true`                             |
| HTTP/2              | Enabled                            |
| TLS minimum version | 1.2                                |
| FTPS                | Disabled                           |

### Alternatives Considered

| Option                             | Pros                                                      | Cons                                                                                                                                             | WAF Impact                               |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **App Service S1 (Linux)**         | Always-on, staging slots, VNet integration, familiar PaaS | ~$73/mo base cost, no scale-to-zero                                                                                                              | Cost: →, Operations: ↑, Performance: ↑   |
| Container Apps Consumption         | Scale-to-zero, ~$10.76/mo, managed TLS                    | **Rejected** — regional capacity blocker (`ManagedEnvironmentCapacityHeavyUsageError` in `swedencentral`) + strategic preference for App Service | Cost: ↑↑, Operations: ↑, Performance: ↓  |
| Container Apps Dedicated           | No cold starts, higher throughput                         | **Rejected** — same regional capacity issues as Consumption; ~$50+/mo baseline                                                                   | Cost: ↓↓, Performance: ↑, Reliability: ↑ |
| Azure App Service (Free/B1)        | Familiar, always-on, CI/CD via deployment slots           | B1 ~$13/mo, limited compute; Free tier no container support                                                                                      | Cost: ↓, Operations: →, Performance: ↑   |
| Azure Functions (Flex Consumption) | True per-invocation billing, great for API                | SPA hosting requires separate service; more complex                                                                                              | Cost: ↑, Operations: ↓, Performance: →   |
| AKS (smallest node pool)           | Full orchestration, multi-service                         | Complex, ~$72/mo minimum for 1 node; no scale-to-zero                                                                                            | Cost: ↓↓↓, Operations: ↓↓                |

### Consequences

**Positive:**

- No cold start — always-on eliminates scale-from-zero latency entirely
- Staging slot — blue-green deployments with zero-downtime swap
- VNet integration — native support via `snet-app-service` subnet
- Private endpoint capable — ACR Premium with PE for secure image pulls
- Familiar PaaS — Easy Auth, Kudu console, well-documented platform
- Managed Identity natively supported — no secrets in environment variables
- Resolves the ACA regional capacity blocker (`ManagedEnvironmentCapacityHeavyUsageError`)

**Negative:**

- Higher base cost (~$73/mo vs ~$10.76/mo for ACA Consumption)
- No scale-to-zero — S1 App Service Plan is always running
- Single container model couples SPA and API — a future split requires separate App Services

### WAF Pillar Analysis

| Pillar      | Score | Impact | Notes                                                                     |
| ----------- | ----- | ------ | ------------------------------------------------------------------------- |
| Security    | 8     | ↑      | Managed Identity + TLS 1.2 + VNet integration + ACR private endpoint      |
| Reliability | 7     | ↑      | 99.95% SLA, always-on (no cold start), staging slots for safe deployments |
| Performance | 9     | ↑↑     | Always-on eliminates cold start; 1 TPS well within S1 capacity            |
| Cost        | 7     | →      | ~$73/mo base cost — higher than ACA but within EUR 100–500 budget         |
| Operations  | 7     | ↑      | Managed TLS, Kudu console, Easy Auth, staging slot, familiar platform     |

### Compliance Considerations

- Container Apps deploys within `swedencentral` Azure region — EU data residency satisfied
- Managed Identity eliminates credential storage, reducing GDPR data minimization risk
- No customer PII stored in container runtime environment — orders go to Table Storage
- Platform-managed encryption at rest for container runtime; no additional config needed

### Implementation Notes

- Container image should be built multi-arch (`linux/amd64`) for ACR compatibility
- Set `WEBSITES_PORT` / `PORT` environment variable for the container port
- Application Insights connection string should be sourced from Key Vault reference
- Use staging slot for blue-green deployments; swap to production after validation
- App Service Plan: `S1` (Standard), Linux reserved, single instance
- Estimated monthly cost: **~$73/mo** for App Service Plan S1
- ACR Premium with private endpoint for secure image pulls
- VNet integration on `snet-app-service` (`10.0.0.0/27`) subnet

---

## ADR-0002: Azure Table Storage for Order Persistence with Accepted Data Loss

> **Status**: Accepted
> **Date**: 2026-04-14
> **Deciders**: Architecture Agent (malta-catering project)
> **Supersedes**: ARC-001 open finding from Step 1 requirements review

### Context

The Malta Catering portal requires persistent storage for:

1. **Customer orders** — items ordered, timestamp, customer reference, status
2. **Menu items** — available pastizzi, Cisk, Kinnie with prices
3. **GDPR compliance** — customer profile data must be erasable (right-to-erasure)

Budget constraint: storage must cost under ~$10/month. Traffic: 1 TPS, up to 20
orders/hour at peak. Relational joins are not required — orders are simple
key-value lookups by customer or date. A Step 1 challenger review flagged that
Table Storage lacks native backup (REQ-001).

The RPO from requirements is 12 hours — however, this is a dev/demo environment
with explicitly relaxed reliability expectations.

### Decision

Use **Azure Table Storage (Standard LRS)** as the persistence layer, with:

- **ARC-001 accepted**: For this dev/demo environment, application-level data loss
  is explicitly accepted. The 12h RPO is **relaxed to best-effort** for the demo.
- **ARC-003 GDPR pattern**: PII and order facts are stored in separate partition
  keys to support right-to-erasure without destroying order records.

**Table design:**

| Partition Key     | Row Key     | Contains PII | Erasure Action                  |
| ----------------- | ----------- | ------------ | ------------------------------- |
| `customer_{id}`   | `profile`   | Yes          | Delete entire entity            |
| `order_{date}`    | `{orderId}` | No (anon.)   | Retain; `customer_id` → SHA-256 |
| `menu_{category}` | `{itemId}`  | No           | Retain indefinitely             |

On erasure request: delete `customer_*` partition, replace `customer_id` field
in all order entities with a one-way SHA-256 hash. Menu table never holds PII.

### Alternatives Considered

| Option                       | Pros                                                 | Cons                                                      | WAF Impact                          |
| ---------------------------- | ---------------------------------------------------- | --------------------------------------------------------- | ----------------------------------- |
| **Table Storage (LRS)**      | $0.0184/GB/mo, 20K TPS, simple API, Managed Identity | No native backup, no multi-region, no advanced querying   | Cost: ↑↑, Reliability: ↓            |
| Azure Cosmos DB (Serverless) | Native backup, global distribution, rich querying    | Min ~$24/mo additional; over-engineered for 1 TPS         | Cost: ↓, Reliability: ↑↑            |
| Azure SQL (Free tier)        | Relational, backup included, familiar tooling        | 32 GiB / 100K DTU/month then paid; overkill for key-value | Cost: ↔, Operations: ↓              |
| Azure Blob Storage (JSON)    | Very cheap, simple                                   | No indexing; querying requires full scan                  | Cost: ↑, Performance: ↓↓            |
| Table Storage + daily export | Adds native backup via scheduled Function App        | ~$1-2/mo extra; adds operational complexity               | Cost: →, Reliability: ↑ (prod path) |

### Consequences

**Positive:**

- Storage Account (Table + Blob) costs ~$8.47/month — extremely low
- Table Storage provides 20,000 entities/second — 1 TPS is negligible
- LRS provides 11 nines durability against hardware failure
- Managed Identity access eliminates connection string exposure
- Single Storage Account serves both Table (orders/menu) and Blob (future use)

**Negative:**

- **ARC-001**: No automated backup — accidental deletion or app-level corruption
  is unrecoverable without manual intervention. Accepted for demo.
- No analytical query support — order reporting requires full-partition scans
- No native TTL/expiry on entities — expired orders require manual cleanup logic

**Neutral:**

- The architecture includes a documented production upgrade path:
  add a daily Azure Functions timer trigger to export Table Storage to Blob
  as JSON snapshots (~$1-2/mo additional cost, to be implemented before prod)

### WAF Pillar Analysis

| Pillar      | Impact | Notes                                                                             |
| ----------- | ------ | --------------------------------------------------------------------------------- |
| Security    | ↑      | Managed Identity access; no connection string in app config; LRS encryption       |
| Reliability | ↓      | No backup for demo; ARC-001 accepted; LRS protects hardware failure only          |
| Performance | ↑      | 20K TPS capacity vs 1 TPS demand; table design matches query patterns             |
| Cost        | ↑↑     | $8.47/mo for full storage account — best available for this workload profile      |
| Operations  | →      | Standard LRS requires no replication config; erasure pattern adds mild complexity |

### Compliance Considerations

- **GDPR Right-to-Erasure (ARC-003)**: PII/order separation ensures customer
  profile deletion does not destroy order records or business audit trail
- **Data residency**: LRS stores all 3 copies within `swedencentral` — EU-only,
  no cross-region replication, satisfies GDPR geographic constraint
- **Encryption**: Azure Storage encrypts data at rest with platform-managed keys
  by default — no additional BYOK configuration required for dev/demo
- **Social IdP**: Customer identity tokens are processed by the external IdP
  (Google/Microsoft); only the derived `customer_id` value enters Table Storage

### Implementation Notes

- Partition key design must be implemented as specified in the table above
- Application must hash `customer_id` with SHA-256 before writing to order entities
  (hash input: `customer_id + app_secret_salt` to prevent rainbow table attacks)
- Erasure endpoint (`DELETE /api/customer/{id}`) must:
  1. Delete `customer_{id}` partition
  2. Query all `order_*` partitions for matching `customer_id`
  3. Replace with `SHA256(customer_id + salt)`
  4. Log erasure event to Application Insights (without PII)
- **Production path before go-live**: Add daily timer-trigger Azure Function to
  export Table Storage entities to Blob Storage as timestamped JSON snapshots

---

## ADR-0003: VNet Integration with Private Endpoints for Dev Environment

> **Status**: Accepted (Revised 2026-04-15 — replaces original public-endpoint posture)
> **Date**: 2026-04-15
> **Deciders**: Architecture Agent (malta-catering project)
> **See also**: ARC-004 in `02-architecture-assessment.md`

### Context

The Malta Catering portal uses three data-plane Azure services that support private
endpoint connectivity: **Azure Storage Account**, **Azure Key Vault**, and **Azure
Container Registry (ACR)**. The original ADR-0003 accepted public endpoints as a
provisional trade-off for the dev/demo environment.

The switch from Container Apps Consumption to **App Service S1** enables **native
VNet integration at no additional compute cost** — S1 supports regional VNet
integration via a delegated subnet. This eliminates the primary cost barrier
(Dedicated plan ~$50+/mo) that made private endpoints prohibitive under the
original architecture.

Private endpoints are now used for all backend services:

- Route traffic between App Service and Storage/Key Vault/ACR through the Azure
  backbone (no public internet traversal)
- Disable public network access on Storage, Key Vault, and ACR, reducing attack
  surface
- Private DNS zones provide name resolution for private endpoint FQDNs

Additional cost for VNet + private endpoint configuration:

- VNet: free
- 3 Private Endpoints (Storage, Key Vault, ACR): 3 × ~$7.20/mo = ~$21.60/mo
- 3 Private DNS Zones: 3 × $0.50/mo = ~$1.50/mo

Total additional networking cost: **~$23.10/month** — modest compared to the
original $64.60/mo estimate under Container Apps Dedicated.

### Decision

**ARC-004 resolved**: Migrate from public endpoints to **VNet integration with
private endpoints** for all backend services.

- **App Service S1** with VNet integration via delegated subnet
  (`snet-app-service`, `10.0.0.0/27`)
- **Private endpoints** for Key Vault, Storage Account (table), and ACR in
  `snet-private-endpoints` (`10.0.0.32/27`)
- **3 private DNS zones** linked to the VNet:
  - `privatelink.vaultcore.azure.net`
  - `privatelink.table.core.windows.net`
  - `privatelink.azurecr.io`
- **Public inbound** to App Service only (HTTPS via App Service default hostname)
- **All backend traffic** routed through VNet (`vnetRouteAllEnabled: true`)

### Alternatives Considered

| Option                                    | Pros                                         | Cons                                                | WAF Impact                           |
| ----------------------------------------- | -------------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| **VNet + PE for all backends (selected)** | Backend isolation; resolves ARC-004; ~$23/mo | Added VNet/DNS complexity                           | Cost: →, Security: ↑↑, Operations: ↓ |
| Public endpoints (original ADR-0003)      | Zero additional cost; simple config          | Larger attack surface; blocked by strict governance | Cost: ↑↑, Security: ↓                |
| Service Endpoints (Storage + KV)          | Near-zero cost; scopes access to VNet        | Does not cover ACR; limited to same-region          | Cost: →, Security: ↑, Operations: →  |
| Azure Firewall + SNAT                     | Full egress control                          | ~$140/mo for Firewall Standard; overkill for demo   | Cost: ↓↓↓, Security: ↑↑              |

### Consequences

**Positive:**

- Backend services (Storage, Key Vault, ACR) are **not exposed to the public
  internet** — accessible only via private endpoints within the VNet
- DNS resolution for backend services uses **private DNS zones**, ensuring
  traffic stays on the Azure backbone
- **ARC-004 risk (public endpoint exposure) is resolved** — no longer provisional
- Managed Identity authentication remains in place as a defense-in-depth layer

**Negative:**

- Added infrastructure complexity: VNet, 2 subnets, 3 private endpoints,
  3 private DNS zones — more Bicep modules to author and maintain
- Additional cost of **~$23.10/month** (3 PE + 3 DNS zones)
- Debugging connectivity issues requires understanding of VNet routing and
  private DNS resolution

**Risk Mitigated:**

- **ARC-004** (public endpoint exposure) from `02-architecture-assessment.md`
  is now fully resolved by this revised decision

### WAF Pillar Analysis

| Pillar      | Impact | Notes                                                                             |
| ----------- | ------ | --------------------------------------------------------------------------------- |
| Security    | ↑↑     | Backend services isolated in VNet; public internet exposure eliminated            |
| Reliability | →      | No material reliability change; private endpoints are highly available            |
| Performance | →      | VNet routing adds negligible latency; backbone traffic remains fast               |
| Cost        | ↓      | +~$23.10/mo for PE + DNS zones (modest vs. original $64.60 CA Dedicated estimate) |
| Operations  | ↓      | Additional VNet, DNS zone, and PE resources to manage and troubleshoot            |

### Compliance Considerations

- **GDPR**: Private endpoints strengthen GDPR posture — backend data services
  are no longer reachable from the public internet; TLS 1.2 enforced
- **Azure Policy**: VNet + PE architecture satisfies common enterprise policies
  such as `deny-public-network-access` on Key Vault and Storage
- **PCI DSS**: Not in scope for this project (cash-on-delivery payment model)
- **SOC 2 / ISO 27001**: Private endpoints and network segmentation provide a
  foundation for future compliance certification if needed

### Implementation Notes

- This ADR **supersedes** the original provisional ADR-0003 (public endpoints)
- Networking cost breakdown:
  - 3 Private Endpoints × $7.20/mo = **$21.60/mo**
  - 3 Private DNS Zones × $0.50/mo = **$1.50/mo**
  - Total networking addition: **~$23.10/mo**
- Bicep modules required: `vnet.bicep`, `private-endpoint.bicep`,
  `private-dns-zone.bicep` (or equivalent AVM modules)
- VNet address space: `10.0.0.0/24` with two subnets:
  - `snet-app-service` (`10.0.0.0/27`) — delegated to `Microsoft.Web/serverFarms`
  - `snet-private-endpoints` (`10.0.0.32/27`) — hosts PE NICs
- For production: consider adding Azure Front Door Standard with WAF policy
  (~$36/mo) to protect the App Service public ingress
