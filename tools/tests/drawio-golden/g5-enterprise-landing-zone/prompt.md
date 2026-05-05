# G5 — Enterprise Landing Zone

Generate an architecture diagram for a single-region Azure enterprise landing
zone in Sweden Central.

## Management group hierarchy (4 MGs)

```text
Tenant Root MG
└── Platform MG
    ├── Connectivity MG
    └── Identity MG
└── Landing Zones MG
    └── (App Shared, App Workload subs)
└── Sandbox MG
```

## Subscriptions (5)

1. **Platform** — shared services
2. **Connectivity** — hub networking
3. **Identity** — Entra hybrid + AD DS
4. **App Shared** — shared tooling (ACR, AKS shared)
5. **App Workload** — workload-specific resources

## Connectivity subscription

- Hub VNet (`10.0.0.0/16`)
  - Azure Firewall (Premium)
  - Azure Bastion (Standard)
  - VPN Gateway

## App Workload subscription

- Spoke VNet (`10.10.0.0/16`)
- AKS cluster (private, with Azure CNI)
- Container Registry (Premium)
- Key Vault (Premium)

## Platform subscription

- Log Analytics workspace (central)
- Microsoft Sentinel
- Microsoft Defender for Cloud (subscription-level)

## Diagram expectations

- **Type:** logical + network (single page acceptable; if >25 resources
  rendered, agent SHOULD apply T-023 tier `21-50` decomposition guidance).
- **Zones:** management group hierarchy, 5 subscription scopes, hub VNet,
  and trust boundary at firewall.
- **Edges:** `VNet Peering`, `Private Link`.
- **Legend:** required.
