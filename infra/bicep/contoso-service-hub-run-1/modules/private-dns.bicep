// modules/private-dns.bicep
// Phase 1 — Private DNS zones for all data and platform services + VNet links
// AVM: br/public:avm/res/network/private-dns-zone:0.8.1
// Zones: PostgreSQL, Redis Enterprise, Key Vault, Blob Storage, Azure Files, AKS API
// Governance: EU location, mandatory tags

@description('Virtual network resource ID to link all private DNS zones.')
param vnetId string

@description('Resource tags applied to all resources in this module.')
param tags object

// ───────────── Zone names (IANA-standard Azure Private Link DNS zones) ────────

var zones = [
  'privatelink.postgres.database.azure.com'          // PostgreSQL Flexible Server
  'privatelink.redisenterprise.cache.azure.net'       // Azure Managed Redis Enterprise
  'privatelink.vaultcore.azure.net'                   // Key Vault
  #disable-next-line no-hardcoded-env-urls            // Required — Azure-standardised private DNS zone name
  'privatelink.blob.core.windows.net'                 // Azure Blob Storage
  #disable-next-line no-hardcoded-env-urls            // Required — Azure-standardised private DNS zone name
  'privatelink.file.core.windows.net'                 // Azure Files
  'privatelink.swedencentral.azmk8s.io'               // AKS private cluster API server
]

// VNet link name derived from the last segment of the VNet resource ID
var vnetLinkName = last(split(vnetId, '/'))

// ─────────────── Private DNS Zones (one per service) + VNet links ─────────────

module privateDnsZonePostgreSql 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  name: 'pdns-postgresql'
  params: {
    name: zones[0]
    location: 'global'
    virtualNetworkLinks: [
      {
        name: 'link-${vnetLinkName}'
        virtualNetworkResourceId: vnetId
        registrationEnabled: false
        tags: tags
      }
    ]
    tags: tags
  }
}

module privateDnsZoneRedis 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  name: 'pdns-redis'
  params: {
    name: zones[1]
    location: 'global'
    virtualNetworkLinks: [
      {
        name: 'link-${vnetLinkName}'
        virtualNetworkResourceId: vnetId
        registrationEnabled: false
        tags: tags
      }
    ]
    tags: tags
  }
}

module privateDnsZoneKeyVault 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  name: 'pdns-keyvault'
  params: {
    name: zones[2]
    location: 'global'
    virtualNetworkLinks: [
      {
        name: 'link-${vnetLinkName}'
        virtualNetworkResourceId: vnetId
        registrationEnabled: false
        tags: tags
      }
    ]
    tags: tags
  }
}

module privateDnsZoneBlob 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  name: 'pdns-blob'
  params: {
    name: zones[3]
    location: 'global'
    virtualNetworkLinks: [
      {
        name: 'link-${vnetLinkName}'
        virtualNetworkResourceId: vnetId
        registrationEnabled: false
        tags: tags
      }
    ]
    tags: tags
  }
}

module privateDnsZoneFile 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  name: 'pdns-file'
  params: {
    name: zones[4]
    location: 'global'
    virtualNetworkLinks: [
      {
        name: 'link-${vnetLinkName}'
        virtualNetworkResourceId: vnetId
        registrationEnabled: false
        tags: tags
      }
    ]
    tags: tags
  }
}

module privateDnsZoneAks 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  name: 'pdns-aks'
  params: {
    name: zones[5]
    location: 'global'
    virtualNetworkLinks: [
      {
        name: 'link-${vnetLinkName}'
        virtualNetworkResourceId: vnetId
        registrationEnabled: false
        tags: tags
      }
    ]
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Private DNS zone resource ID for PostgreSQL.')
output dnsZonePostgreSqlId string = privateDnsZonePostgreSql.outputs.resourceId

@description('Private DNS zone resource ID for Redis Enterprise.')
output dnsZoneRedisId string = privateDnsZoneRedis.outputs.resourceId

@description('Private DNS zone resource ID for Key Vault.')
output dnsZoneKeyVaultId string = privateDnsZoneKeyVault.outputs.resourceId

@description('Private DNS zone resource ID for Blob Storage.')
output dnsZoneBlobId string = privateDnsZoneBlob.outputs.resourceId

@description('Private DNS zone resource ID for Azure Files.')
output dnsZoneFileId string = privateDnsZoneFile.outputs.resourceId

@description('Private DNS zone resource ID for AKS private cluster API server.')
output dnsZoneAksId string = privateDnsZoneAks.outputs.resourceId
