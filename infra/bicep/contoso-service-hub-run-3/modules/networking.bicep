@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment used for subnet naming and conditional defaults.')
param environmentName string

@description('Azure region for the virtual network and NSGs.')
param location string

@description('Common resource tags applied to the network resources.')
param tags object

@description('Virtual network name.')
param vnetName string

@description('Log Analytics workspace resource ID used for VNet diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

var aksSubnetName = 'snet-aks-${environmentName}'
var dataSubnetName = 'snet-data-${environmentName}'
var peSubnetName = 'snet-pe-${environmentName}'
var apimSubnetName = 'snet-apim-${environmentName}'
var vmSubnetName = 'snet-vm-${environmentName}'

var aksNsgName = 'nsg-aks-${environmentName}'
var dataNsgName = 'nsg-data-${environmentName}'
var peNsgName = 'nsg-pe-${environmentName}'
var apimNsgName = 'nsg-apim-${environmentName}'
var vmNsgName = 'nsg-vm-${environmentName}'

var aksRules = [
  {
    name: 'AllowPlatformHttps'
    properties: {
      access: 'Allow'
      destinationAddressPrefix: '*'
      destinationPortRange: '443'
      direction: 'Inbound'
      priority: 200
      protocol: 'Tcp'
      sourceAddressPrefix: 'VirtualNetwork'
      sourcePortRange: '*'
    }
  }
]

var dataRules = [
  {
    name: 'AllowPostgreSqlFromVnet'
    properties: {
      access: 'Allow'
      destinationAddressPrefix: '*'
      destinationPortRange: '5432'
      direction: 'Inbound'
      priority: 200
      protocol: 'Tcp'
      sourceAddressPrefix: 'VirtualNetwork'
      sourcePortRange: '*'
    }
  }
]

var peRules = [
  {
    name: 'AllowPrivateEndpointTraffic'
    properties: {
      access: 'Allow'
      destinationAddressPrefix: '*'
      destinationPortRange: '*'
      direction: 'Inbound'
      priority: 200
      protocol: '*'
      sourceAddressPrefix: 'VirtualNetwork'
      sourcePortRange: '*'
    }
  }
]

var apimRules = [
  {
    name: 'AllowApimManagement'
    properties: {
      access: 'Allow'
      destinationAddressPrefix: '*'
      destinationPortRange: '3443'
      direction: 'Inbound'
      priority: 200
      protocol: 'Tcp'
      sourceAddressPrefix: 'ApiManagement'
      sourcePortRange: '*'
    }
  }
  {
    name: 'AllowFrontDoorBackend'
    properties: {
      access: 'Allow'
      destinationAddressPrefix: '*'
      destinationPortRange: '443'
      direction: 'Inbound'
      priority: 210
      protocol: 'Tcp'
      sourceAddressPrefix: 'AzureFrontDoor.Backend'
      sourcePortRange: '*'
    }
  }
]

var vmRules = [
  {
    name: 'AllowSshFromVnet'
    properties: {
      access: 'Allow'
      destinationAddressPrefix: '*'
      destinationPortRange: '22'
      direction: 'Inbound'
      priority: 200
      protocol: 'Tcp'
      sourceAddressPrefix: 'VirtualNetwork'
      sourcePortRange: '*'
    }
  }
]

module aksNsg 'br/public:avm/res/network/network-security-group:0.5.2' = {
  params: {
    location: location
    name: aksNsgName
    securityRules: aksRules
    tags: tags
  }
}

module dataNsg 'br/public:avm/res/network/network-security-group:0.5.2' = {
  params: {
    location: location
    name: dataNsgName
    securityRules: dataRules
    tags: tags
  }
}

module peNsg 'br/public:avm/res/network/network-security-group:0.5.2' = {
  params: {
    location: location
    name: peNsgName
    securityRules: peRules
    tags: tags
  }
}

module apimNsg 'br/public:avm/res/network/network-security-group:0.5.2' = {
  params: {
    location: location
    name: apimNsgName
    securityRules: apimRules
    tags: tags
  }
}

module vmNsg 'br/public:avm/res/network/network-security-group:0.5.2' = {
  params: {
    location: location
    name: vmNsgName
    securityRules: vmRules
    tags: tags
  }
}

module vnet 'br/public:avm/res/network/virtual-network:0.7.2' = {
  params: {
    addressPrefixes: [
      '10.0.0.0/16'
    ]
    location: location
    name: vnetName
    subnets: [
      {
        addressPrefix: '10.0.0.0/21'
        name: aksSubnetName
        networkSecurityGroupResourceId: aksNsg.outputs.resourceId
      }
      {
        addressPrefix: '10.0.8.0/24'
        name: apimSubnetName
        networkSecurityGroupResourceId: apimNsg.outputs.resourceId
      }
      {
        addressPrefix: '10.0.9.0/24'
        name: peSubnetName
        networkSecurityGroupResourceId: peNsg.outputs.resourceId
        privateEndpointNetworkPolicies: 'Disabled'
      }
      {
        addressPrefix: '10.0.10.0/24'
        delegation: 'Microsoft.DBforPostgreSQL/flexibleServers'
        name: dataSubnetName
        networkSecurityGroupResourceId: dataNsg.outputs.resourceId
      }
      {
        addressPrefix: '10.0.11.0/24'
        name: vmSubnetName
        networkSecurityGroupResourceId: vmNsg.outputs.resourceId
      }
    ]
    tags: tags
  }
}

resource deployedVnet 'Microsoft.Network/virtualNetworks@2024-05-01' existing = {
  name: vnetName
}

resource vnetDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${vnetName}-diagnostics'
  scope: deployedVnet
  dependsOn: [
    vnet
  ]
  properties: {
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
    workspaceId: logAnalyticsWorkspaceResourceId
  }
}

@description('Virtual network resource ID.')
output vnetId string = vnet.outputs.resourceId

@description('Virtual network name.')
output vnetNameOut string = vnet.outputs.name

@description('Subnet resource IDs keyed by logical foundation subnet name.')
output subnetIds object = {
  aks: vnet.outputs.subnetResourceIds[0]
  apim: vnet.outputs.subnetResourceIds[1]
  pe: vnet.outputs.subnetResourceIds[2]
  data: vnet.outputs.subnetResourceIds[3]
  vm: vnet.outputs.subnetResourceIds[4]
}
