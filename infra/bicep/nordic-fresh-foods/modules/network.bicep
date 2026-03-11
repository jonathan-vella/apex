targetScope = 'resourceGroup'

// ──────────────────────────────────────────────
// Network Module — VNet + Subnets + NSGs
// ──────────────────────────────────────────────

@description('Project name for resource naming')
param projectName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Deployment environment')
@allowed(['dev', 'prod'])
param environment string

@description('Enable private endpoint subnet and data subnet')
param enablePrivateEndpoints bool

// ──────────────────────────────────────────────
// NSGs (AVM)
// ──────────────────────────────────────────────

module nsgApp 'br/public:avm/res/network/network-security-group:0.5.2' = {
  name: 'nsg-${projectName}-app-${environment}'
  params: {
    name: 'nsg-${projectName}-app-${environment}'
    location: location
    tags: tags
    securityRules: [
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
    ]
  }
}

module nsgData 'br/public:avm/res/network/network-security-group:0.5.2' = if (enablePrivateEndpoints) {
  name: 'nsg-${projectName}-data-${environment}'
  params: {
    name: 'nsg-${projectName}-data-${environment}'
    location: location
    tags: tags
    securityRules: [
      {
        name: 'DenyAllInbound'
        properties: {
          priority: 4096
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

module nsgPe 'br/public:avm/res/network/network-security-group:0.5.2' = if (enablePrivateEndpoints) {
  name: 'nsg-${projectName}-pe-${environment}'
  params: {
    name: 'nsg-${projectName}-pe-${environment}'
    location: location
    tags: tags
    securityRules: [
      {
        name: 'AllowVnetInbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

// ──────────────────────────────────────────────
// Virtual Network (AVM)
// ──────────────────────────────────────────────

var prodSubnets = [
  {
    name: 'snet-app'
    addressPrefix: '10.0.1.0/24'
    networkSecurityGroupResourceId: nsgApp.outputs.resourceId
    delegation: 'Microsoft.Web/serverFarms'
  }
  {
    name: 'snet-data'
    addressPrefix: '10.0.2.0/24'
    networkSecurityGroupResourceId: nsgData.outputs.resourceId
  }
  {
    name: 'snet-pe'
    addressPrefix: '10.0.3.0/24'
    networkSecurityGroupResourceId: nsgPe.outputs.resourceId
    privateEndpointNetworkPolicies: 'Enabled'
  }
]

var devSubnets = [
  {
    name: 'snet-app'
    addressPrefix: '10.0.1.0/24'
    networkSecurityGroupResourceId: nsgApp.outputs.resourceId
    delegation: 'Microsoft.Web/serverFarms'
  }
]

module vnet 'br/public:avm/res/network/virtual-network:0.7.2' = {
  name: 'vnet-${projectName}-${environment}'
  params: {
    name: 'vnet-${projectName}-${environment}'
    location: location
    tags: tags
    addressPrefixes: [
      '10.0.0.0/16'
    ]
    subnets: enablePrivateEndpoints ? prodSubnets : devSubnets
  }
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────

@description('Virtual Network resource ID')
output vnetResourceId string = vnet.outputs.resourceId

@description('Virtual Network name')
output vnetName string = vnet.outputs.name

@description('App subnet resource ID')
output appSubnetResourceId string = vnet.outputs.subnetResourceIds[0]

@description('Private endpoint subnet resource ID (empty if dev)')
output peSubnetResourceId string = enablePrivateEndpoints ? vnet.outputs.subnetResourceIds[2] : ''
