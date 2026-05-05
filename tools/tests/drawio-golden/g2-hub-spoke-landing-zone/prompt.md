# G2 — Hub-Spoke Landing Zone

Generate a network architecture diagram for a hub-spoke topology spanning
three subscriptions in Sweden Central.

## Subscriptions

1. **Connectivity** — hub networking
2. **App Workload** — application spoke
3. **Data Workload** — data spoke

## Hub (Connectivity subscription)

- Hub VNet (`10.0.0.0/16`)
  - GatewaySubnet (`10.0.0.0/27`) → ExpressRoute Gateway
  - AzureFirewallSubnet (`10.0.1.0/26`) → Azure Firewall (Premium)
  - AzureBastionSubnet (`10.0.2.0/27`) → Azure Bastion (Standard)

## App Spoke (App Workload subscription)

- App Spoke VNet (`10.10.0.0/16`)
  - `snet-app` (`10.10.1.0/24`) → 2 App Service Plans + Web Apps (VNet-integrated)
  - `snet-pe` (`10.10.2.0/24`) → Private Endpoints only (Key Vault, Storage)

## Data Spoke (Data Workload subscription)

- Data Spoke VNet (`10.20.0.0/16`)
  - `snet-data` (`10.20.1.0/24`) → Azure SQL MI + Cosmos DB (Private Link)

## Connectivity

- VNet peering: hub ↔ each spoke (no spoke-to-spoke direct).
- ExpressRoute circuit terminating in hub.
- All east-west traffic forced through Azure Firewall.

## Diagram expectations

- **Type:** network.
- **Boundaries:** explicit trust boundary between hub and on-prem; subscription
  scopes labelled per [`references/semantic-zones.md`](../../../.github/skills/drawio/references/semantic-zones.md).
- **Edges:** `VNet Peering`, `ExpressRoute` labels visible.
- **Legend:** required.
