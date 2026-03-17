targetScope = 'resourceGroup'

param tags object
param virtualNetworkResourceId string
param postgresqlDnsZoneName string
param redisDnsZoneName string
param keyVaultDnsZoneName string
param blobDnsZoneName string
param fileDnsZoneName string

module postgresqlDns 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: postgresqlDnsZoneName
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: virtualNetworkResourceId
      }
    ]
  }
}

module redisDns 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: redisDnsZoneName
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: virtualNetworkResourceId
      }
    ]
  }
}

module keyVaultDns 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: keyVaultDnsZoneName
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: virtualNetworkResourceId
      }
    ]
  }
}

module blobDns 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: blobDnsZoneName
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: virtualNetworkResourceId
      }
    ]
  }
}

module fileDns 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: fileDnsZoneName
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: virtualNetworkResourceId
      }
    ]
  }
}

output postgresqlDnsZoneId string = postgresqlDns.outputs.resourceId
output redisDnsZoneId string = redisDns.outputs.resourceId
output keyVaultDnsZoneId string = keyVaultDns.outputs.resourceId
output blobDnsZoneId string = blobDns.outputs.resourceId
output fileDnsZoneId string = fileDns.outputs.resourceId
