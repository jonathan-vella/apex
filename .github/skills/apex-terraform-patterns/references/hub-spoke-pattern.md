<!-- ref:hub-spoke-pattern-v1 -->

# Hub-Spoke Networking Pattern

Standard pattern using AVM-TF VNet module with peering.

## Hub VNet

```hcl
module "hub_vnet" {
  source  = "Azure/avm-res-network-virtualnetwork/azurerm"
  version = "0.22.2" # example; resolve the current exact version at plan time

  name          = "vnet-hub-${local.suffix}"
  parent_id     = azurerm_resource_group.hub.id
  location      = var.location
  address_space = ["10.0.0.0/16"]

  subnets = {
    AzureFirewallSubnet = { name = "AzureFirewallSubnet", address_prefixes = ["10.0.1.0/24"] }
    GatewaySubnet       = { name = "GatewaySubnet", address_prefixes = ["10.0.2.0/24"] }
  }

  tags = local.tags
}
```

## Spoke VNet with Peering to Hub

```hcl
module "spoke_vnet" {
  source  = "Azure/avm-res-network-virtualnetwork/azurerm"
  version = "0.22.2" # example; resolve the current exact version at plan time

  name          = "vnet-spoke-${var.workload}-${local.suffix}"
  parent_id     = azurerm_resource_group.spoke.id
  location      = var.location
  address_space = [var.spoke_address_prefix]

  peerings = {
    to-hub = {
      name                               = "peer-spoke-${var.workload}-to-hub"
      remote_virtual_network_resource_id = module.hub_vnet.resource_id
      allow_forwarded_traffic            = true
      allow_gateway_transit              = false
      use_remote_gateways                = false
    }
  }

  tags = local.tags
}
```

## Key Rules

- Hub contains shared infrastructure (firewall, gateway, DNS)
- Spokes peer to hub — never to each other directly
- Use `module.hub_vnet.resource_id` output to wire peering in spoke modules
- Apply NSGs per subnet via the `subnets` map, not per VNet
