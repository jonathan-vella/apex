targetScope = 'resourceGroup'

// ──────────────────────────────────────────────
// DNS Module — Private DNS Zones + VNet Links (prod only)
// ──────────────────────────────────────────────

@description('Resource tags')
param tags object

@description('Location for DNS zones (use global)')
param location string

@description('Virtual Network resource ID for VNet links')
param vnetResourceId string

// ──────────────────────────────────────────────
// Private DNS Zone — SQL
// ──────────────────────────────────────────────

module sqlDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  name: 'dns-sql'
  params: {
    name: 'privatelink.database.windows.net'
    tags: tags
    location: location
    virtualNetworkLinks: [
      {
        virtualNetworkResourceId: vnetResourceId
        registrationEnabled: false
      }
    ]
  }
}

// ──────────────────────────────────────────────
// Private DNS Zone — Blob Storage
// ──────────────────────────────────────────────

module blobDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  name: 'dns-blob'
  params: {
    name: 'privatelink.blob.core.windows.net'
    tags: tags
    location: location
    virtualNetworkLinks: [
      {
        virtualNetworkResourceId: vnetResourceId
        registrationEnabled: false
      }
    ]
  }
}

// ──────────────────────────────────────────────
// Private DNS Zone — Key Vault
// ──────────────────────────────────────────────

module kvDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  name: 'dns-kv'
  params: {
    name: 'privatelink.vaultcore.azure.net'
    tags: tags
    location: location
    virtualNetworkLinks: [
      {
        virtualNetworkResourceId: vnetResourceId
        registrationEnabled: false
      }
    ]
  }
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────

@description('SQL DNS Zone resource ID')
output sqlDnsZoneResourceId string = sqlDnsZone.outputs.resourceId

@description('Blob DNS Zone resource ID')
output blobDnsZoneResourceId string = blobDnsZone.outputs.resourceId

@description('Key Vault DNS Zone resource ID')
output kvDnsZoneResourceId string = kvDnsZone.outputs.resourceId
