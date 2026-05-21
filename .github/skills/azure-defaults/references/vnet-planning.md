<!-- ref:vnet-planning-v1 -->

# VNet Planning Gate (Architect Phase 6b)

Canonical contract for the interactive VNet planning gate that
03-Architect runs **after Phase 6a (SKU confirmation)** and **before
Step 7 (pricing)**. The gate captures (a) new-or-existing VNet
decision, (b) IP address space, and (c) a SKU-aware subnet plan.
Subnet counts and reserved-subnet network resources (Bastion /
Firewall / NAT Gateway / Gateways / App Gateway) feed the Step 7
pricing resource_list.

> **TODO (G5 — citation rot)**: Microsoft Learn URLs in the sizing
> matrix below are time-stamped at authoring. Revisit every
> release-train. `lint:md` link-check catches anchor rot but not URL
> reorganization; sweep manually.

## Trigger contract

The gate fires when **either** condition holds for the in-scope
architecture:

1. Any `services[].requires[]` row in `sku-manifest.json` contains
   `vnet-integration` or `private-endpoints` (canonical tokens owned
   by [`sku-manifest.instructions.md`](../../../instructions/sku-manifest.instructions.md)).
2. Any `services[].service_name` is in the **vnet-attached service
   whitelist** below.

Public-edge-only workloads (Static Web Apps + Functions Consumption +
Storage public + Front Door) do **not** trigger the gate.

## vnet-attached service whitelist

This fenced block is the **single source of truth** for the
service-name branch of the trigger contract.
`tools/scripts/validate-sku-manifest.mjs` parses it via the workspace-
relative path constant and must **not** redeclare the list elsewhere.

```yaml
# Authoritative list of service_name values that always require a VNet.
# Edit here only; the validator loads it from this fenced block.
vnet_attached_services:
  - app-gateway
  - aks
  - vm
  - vmss
  - apim-internal
  - bastion
  - azure-firewall
  - vpn-gateway
  - expressroute-gateway
  - nat-gateway
  - application-gateway-for-containers
```

When a whitelisted `service_name` is present in `sku-manifest.json`
and no `vnet_mode` decision is recorded **post-Step 2**,
`validate:sku-manifest` emits a warning (not an error — keeps
in-flight projects from regressing).

## `vnet_planning_mode`

Top-level decision key. Default: `guided`. Recorded via
`apex-recall decide --key vnet_planning_mode --value <mode> --step 2 --json`.

| Mode       | Behaviour                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guided`   | Full two-round askQuestions; mandatory for prod.                                                                                                                                                         |
| `fast`     | Round 1 only; Round 2 auto-confirms the proposed table with a Challenger-tagged informational finding (`subnet plan auto-confirmed in fast mode`).                                                       |
| `deferred` | Gate writes a placeholder `subnet_plan = []` and a Challenger-tagged informational finding (`VNet planning deferred; sandbox/exploration mode`). **Disallowed when the inferred environment is `prod`** — block with explanation. |

## askQuestions Round 1 (`guided` or `fast`)

Single batched `vscode_askQuestions` call. Three questions max
(Q3 only fires when Q1 = `use-existing`):

- **Q1 — `vnet_mode`** (options): `create-new` (default), `use-existing`.
- **Q2 — `vnet_address_space`** (freeform CIDR, when `vnet_mode =
  create-new`):
  - Default: `10.0.0.0/16`
  - Hint: at least `/22` so subnets up to `/24` fit; greenfield rule
    is to pick from RFC1918 not already used by governance-declared
    ranges.
- **Q3 — `existing_vnet_id`** (freeform resource ID, when `vnet_mode =
  use-existing`): full Azure resource ID
  (`/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Network/virtualNetworks/<name>`).
  After receipt, Architect runs the validation block below **before
  proceeding to Round 2**.

## Existing-VNet validation (two-step)

When `vnet_mode = use-existing`, capture-time validation:

### Step 1 — Auth preamble (S2-B)

Run once:

```bash
az account show -o none 2>/dev/null
```

- **Exit 0**: continue to Step 2.
- **Non-zero** (no `az login`, expired token, missing CLI): fall back
  to "trust user input, defer validation to Planner Phase 4" and
  record a Challenger-tagged informational finding via
  `apex-recall finding <project> --add "existing_vnet_validation_deferred: az auth unavailable; Planner Phase 4 owns reconciliation" --json`.
  Mirrors the auth-fallback pattern in
  [`azure-cli-auth-validation.md`](azure-cli-auth-validation.md).

### Step 2 — Resource probe (M4)

When auth succeeds, run:

```bash
az network vnet show \
  --ids "${existing_vnet_id}" \
  --query "{addr:addressSpace.addressPrefixes,loc:location,name:name}" \
  -o json
```

Three outcomes:

| Outcome                                | Action                                                                                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exists + reachable                     | Store `vnet_address_space` from live `addressSpace.addressPrefixes[0]` (overrides any user-typed value — becomes authoritative for subnet-overlap math).                                              |
| `NotFound` / `Forbidden`               | Re-prompt Q3 with the error inline. After two failures, fall back to "defer to Planner Phase 4" with a Challenger-tagged informational finding.                                                       |
| Tenant / subscription / region mismatch | Block until user supplies a correct ID or switches to `create-new`. Do not proceed.                                                                                                                   |

## Subnet sizing matrix

`(min, recommended)` tuples per workload. **Always recommend the
`recommended` value** for greenfield; `min` is the absolute floor.

| Workload                                  | Min  | Recommended         | Notes                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | ---- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App Gateway v2**                        | `/26` | `/24`              | Microsoft Learn — [Application Gateway infrastructure subnet sizing](https://learn.microsoft.com/en-us/azure/application-gateway/configuration-infrastructure#size-of-the-subnet). `/26` = non-autoscale; `/24` = autoscale headroom.                                                                                                                                                                        |
| **APIM stv2**                             | `/28` | `/27`              | Microsoft Learn — [API Management virtual network — subnet size requirements](https://learn.microsoft.com/en-us/azure/api-management/virtual-network-concepts#subnet-size). `/28` single-instance; `/27` multi-instance / zone-redundant.                                                                                                                                                                   |
| **AKS (Azure CNI Overlay)**               | formula | `/24` per system node pool | Microsoft Learn — [Plan IP addressing for your cluster — Azure CNI Overlay](https://learn.microsoft.com/en-us/azure/aks/azure-cni-overlay). Formula: `IPs = (max_pods × node_count) + (node_count × 1) + 1`, round up to nearest CIDR.                                                                                                                                                                        |
| **AKS (Azure CNI, non-overlay)**          | `/22` | `/22`               | Each pod consumes a VNet IP. Surface a warning to prefer Overlay for new clusters. Microsoft Learn — [Configure Azure CNI networking](https://learn.microsoft.com/en-us/azure/aks/configure-azure-cni).                                                                                                                                                                                                      |
| **AKS (kubenet)**                         | `/24` | **DEPRECATED**      | Retirement March 2028. Do **not** recommend for greenfield. If user pins kubenet, emit a `should_fix` Challenger finding referencing [`deprecated-services.md`](deprecated-services.md). Microsoft Learn — [Kubenet networking retirement](https://learn.microsoft.com/en-us/azure/aks/upgrade-azure-cni).                                                                                                   |
| **Private Endpoint subnet**               | `/29` | `/27`               | Min `/29` = 5 usable IPs (3 PE headroom). Recommend `/27` for PE-heavy boundaries (≥8 PEs). NSG support GA since Sept 2021; route-table support GA likewise. Microsoft Learn — [Manage network policies for private endpoints](https://learn.microsoft.com/en-us/azure/private-link/disable-private-endpoint-network-policy).                                                                                |
| **App Service VNet integration**          | `/28` | `/26`               | Regional VNet integration. 5 reserved Azure IPs. Delegation: `Microsoft.Web/serverFarms`. Microsoft Learn — [Integrate your app with an Azure virtual network — subnet](https://learn.microsoft.com/en-us/azure/app-service/configure-vnet-integration-enable).                                                                                                                                              |
| **VM/VMSS workload**                      | `/29` | `/27`               | General-purpose compute subnet. Size up to `/24` when VMSS has high scale.                                                                                                                                                                                                                                                                                                                                  |
| **Bastion — Basic**                       | `/26` | `/26`               | `AzureBastionSubnet` reserved name. Microsoft hardened minimum across SKUs. Microsoft Learn — [Azure Bastion configuration settings — AzureBastionSubnet](https://learn.microsoft.com/en-us/azure/bastion/configuration-settings#subnet).                                                                                                                                                                    |
| **Bastion — Standard (host scaling)**     | `/26` | `/24`               | `/24` for scale-unit headroom when host scaling is enabled.                                                                                                                                                                                                                                                                                                                                                  |
| **Azure Firewall**                        | `/26` | `/26`               | `AzureFirewallSubnet` reserved name; mandatory minimum. Microsoft Learn — [Azure Firewall FAQ — subnet requirements](https://learn.microsoft.com/en-us/azure/firewall/firewall-faq#what-are-the-subnet-requirements).                                                                                                                                                                                       |
| **VPN / ExpressRoute Gateway**            | `/27` | `/26`               | `GatewaySubnet` reserved name. Recommend `/26` when VPN and ExpressRoute coexist on the same VNet. Microsoft Learn — [About VPN Gateway configuration settings — Gateway subnet](https://learn.microsoft.com/en-us/azure/vpn-gateway/vpn-gateway-about-vpn-gateway-settings#gwsub).                                                                                                                          |
| **NAT Gateway**                           | n/a  | n/a                 | No dedicated subnet — associates with up to 16 subnets. Ensure outbound-needing subnets have it attached. Microsoft Learn — [Azure NAT Gateway](https://learn.microsoft.com/en-us/azure/nat-gateway/nat-overview).                                                                                                                                                                                           |
| **Application Gateway for Containers**    | `/24` | `/24`               | Dedicated subnet, delegation `Microsoft.ServiceNetworking/trafficControllers`. Microsoft Learn — [Application Gateway for Containers — quickstart](https://learn.microsoft.com/en-us/azure/application-gateway/for-containers/quickstart-deploy-application-gateway-for-containers-alb-controller).                                                                                                          |

## CIDR math notes

- All subnets MUST be non-overlapping and fully inside
  `vnet_address_space`.
- Reserve a **spare** `/27` (or larger) for growth.
- **5 Azure-reserved IPs** per subnet (network, default gateway, two
  DNS, broadcast). Important when sizing `/29` and smaller subnets —
  a `/29` has 8 total / 3 usable.
- Reserved-name subnets (`AzureBastionSubnet`, `AzureFirewallSubnet`,
  `GatewaySubnet`, `RouteServerSubnet`, `AzureBastionSubnet`) MUST
  use the exact case-sensitive name and may **only** appear when the
  respective resource is in scope.

## askQuestions Round 2 (table confirmation)

Present the proposed `subnet_plan` as a markdown table in the
question text. Columns: `purpose / SKU-derived size / address_prefix /
delegation / NSG-attached / route-table`.

Then run the **per-row askMe loop** — one
`vscode_askQuestions` call per subnet row with three options:

- `Apply edit (freeform diff)` — user types replacement values in the
  follow-up freeform field; Architect parses and updates the row.
- `Skip this row` — keep the proposed values.
- `Done` — exit the loop early (all remaining rows accepted).

**Soft warning at 3 edits**: after 3 consecutive `Apply edit` choices
without a `Done`, emit a chat message ("3 edit rounds — consider
Done") but never auto-defer. The loop continues until the user picks
`Done` or every row is processed.

In `fast` mode, skip the loop entirely and auto-confirm the proposed
table with a Challenger-tagged informational finding.

## Output

Write the final plan via `apex-recall`:

```bash
apex-recall decide <project> --key vnet_mode --value <create-new|use-existing> --step 2 --json
apex-recall decide <project> --key existing_vnet_id --value "<id-or-empty>" --step 2 --json   # only when use-existing
apex-recall decide <project> --key vnet_address_space --value "10.0.0.0/16" --step 2 --json
apex-recall decide <project> --key subnet_plan --value "$(cat plan.json)" --step 2 --json
apex-recall decide <project> --key vnet_plan_decision --value <confirmed|edited|deferred> --step 2 --json
```

`subnet_plan` MUST conform to
[`tools/schemas/subnet-plan.schema.json`](../../../../tools/schemas/subnet-plan.schema.json)
(v1). `validate:decision-keys` parses it and emits a soft warning
when the value is absent but the trigger contract holds.

## Defaults that always hold

- **NSG attached to every subnet** (`nsg: "auto"`) unless governance
  forbids it.
- **Reserved-name subnets** only emitted when the respective resource
  is in scope (`AzureBastionSubnet` ↔ Bastion in `services[]`, etc.).
- **`service_endpoints`** default to `[]`; per-row override allowed.
- **`private_endpoint_network_policies`**: `Disabled` on PE subnets
  (default), `Enabled` elsewhere.
- **Delegation** defaults per workload (App Service →
  `Microsoft.Web/serverFarms`, Application Gateway for Containers →
  `Microsoft.ServiceNetworking/trafficControllers`, etc.).

## Pricing wiring

`subnet_plan` resources of types `bastion`, `azure-firewall`,
`nat-gateway`, `vpn-gateway`, `expressroute-gateway`,
`application-gateway`, `application-gateway-for-containers` are
appended to the Step 7 `resource_list` passed to
`cost-estimate-subagent` — they are **outside** the static-fallback
whitelist and MUST be priced live.
[`pricing-guidance.md`](pricing-guidance.md) holds the
`product_filter` rows.

VNet base, NSG, subnet, route table remain on the static-fallback
whitelist (no MCP cost).

## Governance precedence

`04-governance-constraints.json` `network_constraints` always wins.
When a `network_constraints` block declares allowed address ranges,
required subnet names, mandatory NSG/UDR attachment, or
no-public-IP, every plan element must conform. If governance is
loaded **post-Step 2** and conflicts with the captured plan,
04g-Governance emits a `must_fix` reconciliation finding referencing
**D-V5** in [`adversarial-checklists.md`](adversarial-checklists.md).

## Cross-references

- [`pricing-guidance.md`](pricing-guidance.md) — gateway / Bastion /
  Firewall meters
- [`adversarial-checklists.md`](adversarial-checklists.md) — D-V1..D-V6
  assertions
- [`avm-modules.md`](avm-modules.md) —
  `avm/res/network/virtual-network` + child subnet child resource model
- [`deprecated-services.md`](deprecated-services.md) — kubenet
  retirement
- [`azure-cli-auth-validation.md`](azure-cli-auth-validation.md) — auth
  fallback pattern reused by Existing-VNet Step 1
- [`workflow-gates.md`](workflow-gates.md) — Architect Phase 6b
  workflow stub
