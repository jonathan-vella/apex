targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string
param location string
param tags object
param vnetName string
param vnetAddressPrefix string
param logAnalyticsWorkspaceResourceId string

var vnetAddress = split(vnetAddressPrefix, '/')[0]
var octets = split(vnetAddress, '.')
var prefixBase = '${octets[0]}.${octets[1]}'

var defaultSubnetName = 'snet-default-${environment}'
var aksSubnetName = 'snet-aks-${environment}'
var apimSubnetName = 'snet-apim-${environment}'
var dataSubnetName = 'snet-data-${environment}'
var vmSubnetName = 'snet-vm-${environment}'
var postgresqlSubnetName = 'snet-pgsql-${environment}'

resource defaultNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-default-${environment}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'DenyInboundInternet'
        properties: {
          access: 'Deny'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
          direction: 'Inbound'
          priority: 4096
          protocol: '*'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
        }
      }
    ]
  }
}

resource aksNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-aks-${environment}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowApimHttps'
        properties: {
          access: 'Allow'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
          direction: 'Inbound'
          priority: 200
          protocol: 'Tcp'
          sourceAddressPrefix: '${prefixBase}.2.0/24'
          sourcePortRange: '*'
        }
      }
    ]
  }
}

resource apimNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-apim-${environment}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowFrontDoorBackend'
        properties: {
          access: 'Allow'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
          direction: 'Inbound'
          priority: 200
          protocol: 'Tcp'
          sourceAddressPrefix: 'AzureFrontDoor.Backend'
          sourcePortRange: '*'
        }
      }
      {
        name: 'AllowApimManagement'
        properties: {
          access: 'Allow'
          destinationAddressPrefix: '*'
          destinationPortRange: '3443'
          direction: 'Inbound'
          priority: 210
          protocol: 'Tcp'
          sourceAddressPrefix: 'ApiManagement'
          sourcePortRange: '*'
        }
      }
    ]
  }
}

resource dataNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-data-${environment}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowVirtualNetworkInbound'
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
  }
}

resource vmNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-vm-${environment}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowSshFromDefaultSubnet'
        properties: {
          access: 'Allow'
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
          direction: 'Inbound'
          priority: 200
          protocol: 'Tcp'
          sourceAddressPrefix: '${prefixBase}.0.0/24'
          sourcePortRange: '*'
        }
      }
    ]
  }
}

resource postgresqlNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-pgsql-${environment}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowPostgresFromPlatform'
        properties: {
          access: 'Allow'
          destinationAddressPrefix: '*'
          destinationPortRange: '5432'
          direction: 'Inbound'
          priority: 200
          protocol: 'Tcp'
          sourceAddressPrefixes: [
            '${prefixBase}.1.0/24'
            '${prefixBase}.4.0/24'
          ]
          sourcePortRange: '*'
        }
      }
    ]
  }
}

module vnet 'br/public:avm/res/network/virtual-network:0.7.2' = {
  params: {
    addressPrefixes: [
      vnetAddressPrefix
    ]
    location: location
    name: vnetName
    subnets: [
      {
        addressPrefix: '${prefixBase}.0.0/24'
        name: defaultSubnetName
        networkSecurityGroupResourceId: defaultNsg.id
      }
      {
        addressPrefix: '${prefixBase}.1.0/24'
        name: aksSubnetName
        networkSecurityGroupResourceId: aksNsg.id
      }
      {
        addressPrefix: '${prefixBase}.2.0/24'
        name: apimSubnetName
        networkSecurityGroupResourceId: apimNsg.id
        delegation: 'Microsoft.Web/serverFarms'
      }
      {
        addressPrefix: '${prefixBase}.3.0/24'
        name: dataSubnetName
        networkSecurityGroupResourceId: dataNsg.id
        privateEndpointNetworkPolicies: 'Disabled'
      }
      {
        addressPrefix: '${prefixBase}.4.0/24'
        name: vmSubnetName
        networkSecurityGroupResourceId: vmNsg.id
      }
      {
        addressPrefix: '${prefixBase}.5.0/24'
        delegation: 'Microsoft.DBforPostgreSQL/flexibleServers'
        name: postgresqlSubnetName
        networkSecurityGroupResourceId: postgresqlNsg.id
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

output vnetId string = vnet.outputs.resourceId
output vnetName string = vnet.outputs.name
output defaultSubnetId string = vnet.outputs.subnetResourceIds[0]
output aksSubnetId string = vnet.outputs.subnetResourceIds[1]
output apimSubnetId string = vnet.outputs.subnetResourceIds[2]
output dataSubnetId string = vnet.outputs.subnetResourceIds[3]
output vmSubnetId string = vnet.outputs.subnetResourceIds[4]
output postgresqlSubnetId string = vnet.outputs.subnetResourceIds[5]
