targetScope = 'resourceGroup'

@description('Project name for resource naming.')
param projectName string

@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment.')
param environment string

@description('Azure region.')
param location string

@description('Resource tags.')
param tags object

module aksSystemNsg 'br/public:avm/res/network/network-security-group:0.5.2' = {
  params: {
    location: location
    name: 'nsg-aks-system-${environment}'
    securityRules: []
    tags: tags
  }
}

module aksUserNsg 'br/public:avm/res/network/network-security-group:0.5.2' = {
  params: {
    location: location
    name: 'nsg-aks-user-${environment}'
    securityRules: []
    tags: tags
  }
}

module dataNsg 'br/public:avm/res/network/network-security-group:0.5.2' = {
  params: {
    location: location
    name: 'nsg-data-${environment}'
    securityRules: []
    tags: tags
  }
}

module managementNsg 'br/public:avm/res/network/network-security-group:0.5.2' = {
  params: {
    location: location
    name: 'nsg-management-${environment}'
    securityRules: []
    tags: tags
  }
}

module vnet 'br/public:avm/res/network/virtual-network:0.7.2' = {
  params: {
    addressPrefixes: [
      '10.0.0.0/16'
    ]
    location: location
    name: 'vnet-${projectName}-${environment}'
    subnets: [
      {
        addressPrefix: '10.0.0.0/22'
        name: 'snet-aks-system-${environment}'
        networkSecurityGroupResourceId: aksSystemNsg.outputs.resourceId
      }
      {
        addressPrefix: '10.0.4.0/22'
        name: 'snet-aks-user-${environment}'
        networkSecurityGroupResourceId: aksUserNsg.outputs.resourceId
      }
      {
        addressPrefix: '10.0.8.0/24'
        name: 'snet-data-${environment}'
        networkSecurityGroupResourceId: dataNsg.outputs.resourceId
        privateEndpointNetworkPolicies: 'Disabled'
      }
      {
        addressPrefix: '10.0.9.0/24'
        name: 'snet-management-${environment}'
        networkSecurityGroupResourceId: managementNsg.outputs.resourceId
      }
    ]
    tags: tags
  }
}

module keyVaultDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: 'privatelink.vaultcore.azure.net'
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: vnet.outputs.resourceId
      }
    ]
  }
}

module postgresqlDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: 'privatelink.postgres.database.azure.com'
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: vnet.outputs.resourceId
      }
    ]
  }
}

module redisDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: 'privatelink.redis.cache.windows.net'
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: vnet.outputs.resourceId
      }
    ]
  }
}

module storageDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: 'privatelink.blob.core.windows.net'
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: vnet.outputs.resourceId
      }
    ]
  }
}

module containerRegistryDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: 'privatelink.azurecr.io'
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: vnet.outputs.resourceId
      }
    ]
  }
}

@description('Virtual network resource ID.')
output vnetId string = vnet.outputs.resourceId

@description('Virtual network name.')
output vnetName string = vnet.outputs.name

@description('Subnet resource IDs keyed by logical subnet name.')
output subnetIds object = {
  aksSystem: vnet.outputs.subnetResourceIds[0]
  aksUser: vnet.outputs.subnetResourceIds[1]
  data: vnet.outputs.subnetResourceIds[2]
  management: vnet.outputs.subnetResourceIds[3]
}

@description('Private DNS zone resource IDs keyed by service.')
output privateDnsZoneIds object = {
  keyVault: keyVaultDnsZone.outputs.resourceId
  postgresql: postgresqlDnsZone.outputs.resourceId
  redis: redisDnsZone.outputs.resourceId
  storage: storageDnsZone.outputs.resourceId
  containerRegistry: containerRegistryDnsZone.outputs.resourceId
}
