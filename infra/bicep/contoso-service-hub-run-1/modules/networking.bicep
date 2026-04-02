// modules/networking.bicep
// Phase 1 — VNet (/16) with 6 subnets (/24-/21) and 4 NSGs
// AVM: br/public:avm/res/network/network-security-group:0.5.3
//      br/public:avm/res/network/virtual-network:0.7.2
// Governance: EU location, mandatory tags, deny-all inbound default, subnet segregation

@description('Azure region for all resources.')
param location string

@description('Environment name (dev | staging | prod).')
param environment string

@description('Project short name for CAF naming.')
param projectName string

@description('Resource tags applied to all resources in this module.')
param tags object

// ─────────────────────────────── Derived names ───────────────────────────────

var vnetName    = 'vnet-${projectName}-${environment}'
var nsgCompute  = 'nsg-compute-${environment}'
var nsgData     = 'nsg-data-${environment}'
var nsgAppGw    = 'nsg-appgw-${environment}'
var nsgPe       = 'nsg-pe-${environment}'

// ─────────────────────────── Network Security Groups ─────────────────────────
// Default: deny-all inbound, allow VNet-to-VNet, allow Azure infrastructure

module nsgComputeModule 'br/public:avm/res/network/network-security-group:0.5.3' = {
  name: 'nsg-compute'
  params: {
    name: nsgCompute
    location: location
    securityRules: [
      {
        name: 'deny-all-inbound'
        properties: {
          priority: 4096
          protocol: '*'
          access: 'Deny'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
    tags: tags
  }
}

module nsgDataModule 'br/public:avm/res/network/network-security-group:0.5.3' = {
  name: 'nsg-data'
  params: {
    name: nsgData
    location: location
    securityRules: [
      {
        name: 'allow-vnet-inbound'
        properties: {
          priority: 100
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '*'
        }
      }
      {
        name: 'deny-all-inbound'
        properties: {
          priority: 4096
          protocol: '*'
          access: 'Deny'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
    tags: tags
  }
}

// App Gateway NSG must allow GatewayManager and AzureLoadBalancer (required by Azure)
module nsgAppGwModule 'br/public:avm/res/network/network-security-group:0.5.3' = {
  name: 'nsg-appgw'
  params: {
    name: nsgAppGw
    location: location
    securityRules: [
      {
        name: 'allow-gateway-manager-inbound'
        properties: {
          priority: 100
          protocol: '*'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: 'GatewayManager'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '65200-65535'
        }
      }
      {
        name: 'allow-azure-load-balancer-inbound'
        properties: {
          priority: 110
          protocol: '*'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: 'AzureLoadBalancer'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
      {
        name: 'allow-https-inbound'
        properties: {
          priority: 200
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'deny-all-inbound'
        properties: {
          priority: 4096
          protocol: '*'
          access: 'Deny'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
    tags: tags
  }
}

module nsgPeModule 'br/public:avm/res/network/network-security-group:0.5.3' = {
  name: 'nsg-pe'
  params: {
    name: nsgPe
    location: location
    securityRules: [
      {
        name: 'deny-all-inbound'
        properties: {
          priority: 4096
          protocol: '*'
          access: 'Deny'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
    tags: tags
  }
}

// ─────────────────────────────── Virtual Network ─────────────────────────────

module vnet 'br/public:avm/res/network/virtual-network:0.7.2' = {
  name: 'virtual-network'
  params: {
    name: vnetName
    location: location
    addressPrefixes: [
      '10.0.0.0/16'
    ]
    subnets: [
      // AKS nodes and virtual machines
      {
        name: 'snet-compute-${environment}'
        addressPrefix: '10.0.1.0/24'
        networkSecurityGroupResourceId: nsgComputeModule.outputs.resourceId
      }
      // PostgreSQL Flexible Server (delegated in Phase 2) and data services
      {
        name: 'snet-data-${environment}'
        addressPrefix: '10.0.2.0/24'
        networkSecurityGroupResourceId: nsgDataModule.outputs.resourceId
      }
      // Application Gateway WAF v2
      {
        name: 'snet-appgw-${environment}'
        addressPrefix: '10.0.3.0/24'
        networkSecurityGroupResourceId: nsgAppGwModule.outputs.resourceId
      }
      // Private Endpoints (NSG enforcement disabled per Azure PE requirement)
      {
        name: 'snet-pe-${environment}'
        addressPrefix: '10.0.4.0/24'
        networkSecurityGroupResourceId: nsgPeModule.outputs.resourceId
        privateEndpointNetworkPolicies: 'Disabled'
      }
      // API Management
      {
        name: 'snet-apim-${environment}'
        addressPrefix: '10.0.5.0/24'
        networkSecurityGroupResourceId: nsgComputeModule.outputs.resourceId
      }
      // AKS — /21 for pod CIDR growth (Azure CNI Overlay)
      {
        name: 'snet-aks-${environment}'
        addressPrefix: '10.0.8.0/21'
        networkSecurityGroupResourceId: nsgComputeModule.outputs.resourceId
      }
    ]
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Virtual network resource ID.')
output vnetId string = vnet.outputs.resourceId

@description('Virtual network name.')
output vnetName string = vnet.outputs.name

// Subnet IDs derived from the VNet resource ID — deterministic construction
@description('Compute subnet resource ID (AKS nodes, VMs).')
output subnetComputeId string = '${vnet.outputs.resourceId}/subnets/snet-compute-${environment}'

@description('Data subnet resource ID (PostgreSQL, Redis).')
output subnetDataId string = '${vnet.outputs.resourceId}/subnets/snet-data-${environment}'

@description('Application Gateway subnet resource ID.')
output subnetAppGwId string = '${vnet.outputs.resourceId}/subnets/snet-appgw-${environment}'

@description('Private Endpoint subnet resource ID.')
output subnetPeId string = '${vnet.outputs.resourceId}/subnets/snet-pe-${environment}'

@description('API Management subnet resource ID.')
output subnetApimId string = '${vnet.outputs.resourceId}/subnets/snet-apim-${environment}'

@description('AKS subnet resource ID (/21 for pod CIDR).')
output subnetAksId string = '${vnet.outputs.resourceId}/subnets/snet-aks-${environment}'
