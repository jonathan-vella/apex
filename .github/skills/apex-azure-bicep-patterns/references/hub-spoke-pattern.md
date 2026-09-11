<!-- ref:hub-spoke-pattern-v1 -->

# Hub-Spoke Networking Pattern

Standard pattern for shared services hub with workload spokes.

## Hub-Spoke Orchestration

```bicep
// main.bicep — hub-spoke orchestration
module hub 'modules/hub-vnet.bicep' = {
  name: 'hub-vnet'
  params: {
    vnetName: 'vnet-hub-${uniqueSuffix}'
    addressPrefix: '10.0.0.0/16'
    subnets: [
      { name: 'AzureFirewallSubnet', prefix: '10.0.1.0/24' }
      { name: 'GatewaySubnet', prefix: '10.0.2.0/24' }
    ]
    tags: tags
  }
}

module spoke 'modules/spoke-vnet.bicep' = {
  name: 'spoke-vnet-${workloadName}'
  params: {
    vnetName: 'vnet-spoke-${workloadName}-${uniqueSuffix}'
    addressPrefix: spokeAddressPrefix
    hubVnetId: hub.outputs.resourceId
    tags: tags
  }
}
```

## Key Rules

- Hub contains shared infrastructure (firewall, gateway, DNS)
- Spokes peer to hub — never to each other directly
- Use `hubVnetId` output to wire peering in spoke modules
- Apply NSGs per subnet, not per VNet
