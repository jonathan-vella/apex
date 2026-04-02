// modules/networking.bicep — Hub-spoke VNet, NSGs, Private DNS Zones
// AVM: br/public:avm/res/network/network-security-group:0.5.1
//      br/public:avm/res/network/virtual-network:0.5.2
//      br/public:avm/res/network/private-dns-zone:0.6.0
// Resources: 5 NSGs, 1 VNet (5 subnets + AzureBastionSubnet), 5 Private DNS Zones
// Address space: 10.0.0.0/16
// Governance: POL-001 (EU region), POL-007 (private DNS zones for PE),
//             POL-009 (Key Vault private-only), POL-020 (Bastion-only admin ingress)

@description('Azure region for NSGs and VNet (must be swedencentral, POL-001).')
param location string

@description('Deployment environment for resource naming.')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Virtual Network name.')
param vnetName string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

// ─────────────────────── Cloud-portable DNS zone names ───────────────────────
// Use environment() function to derive Azure storage suffix — avoids hardcoded
// 'core.windows.net' which triggers the no-hardcoded-env-urls linter rule.
// environment().suffixes.storage = 'core.windows.net' on AzureCloud.
var storageSuffix = environment().suffixes.storage

// ─────────────────────── Network Security Groups ──────────────────────────────
// One NSG per subnet. Default: deny-all inbound, allow VNet-internal.
// All explicit allow rules are additive; lower priority number = higher precedence.

// NSG: AKS subnet — allows VNet-internal traffic; deny external inbound
module nsgAks 'br/public:avm/res/network/network-security-group:0.5.1' = {
  name: 'nsg-aks'
  params: {
    name: 'nsg-aks-${env}'
    location: location
    securityRules: [
      {
        name: 'allow-vnet-inbound'
        properties: {
          priority: 100
          protocol: '*'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '*'
        }
      }
      {
        name: 'allow-azure-load-balancer-inbound'
        properties: {
          priority: 200
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

// NSG: Data subnet — restricts inbound to VNet only; data services use private endpoints
module nsgData 'br/public:avm/res/network/network-security-group:0.5.1' = {
  name: 'nsg-data'
  params: {
    name: 'nsg-data-${env}'
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

// NSG: Application Gateway subnet — requires GatewayManager and AzureLoadBalancer rules
// (Azure App Gateway health probes use ports 65200-65535; BlockingRule would break AGIC)
module nsgAppGw 'br/public:avm/res/network/network-security-group:0.5.1' = {
  name: 'nsg-appgw'
  params: {
    name: 'nsg-appgw-${env}'
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
        name: 'allow-http-inbound'
        properties: {
          priority: 210
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
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

// NSG: Management subnet — no direct internet inbound; admin access via Bastion only (POL-020)
module nsgMgmt 'br/public:avm/res/network/network-security-group:0.5.1' = {
  name: 'nsg-mgmt'
  params: {
    name: 'nsg-mgmt-${env}'
    location: location
    securityRules: [
      {
        name: 'allow-bastion-ssh-inbound'
        properties: {
          priority: 100
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '10.0.7.0/26'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '22'
        }
      }
      {
        name: 'allow-bastion-rdp-inbound'
        properties: {
          priority: 110
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '10.0.7.0/26'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '3389'
        }
      }
      {
        name: 'deny-internet-inbound'
        properties: {
          priority: 200
          protocol: '*'
          access: 'Deny'
          direction: 'Inbound'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
    tags: tags
  }
}

// NSG: AzureBastionSubnet — specific rules required by Azure Bastion (POL-020)
// Reference: https://learn.microsoft.com/azure/bastion/bastion-nsg
module nsgBastion 'br/public:avm/res/network/network-security-group:0.5.1' = {
  name: 'nsg-bastion'
  params: {
    name: 'nsg-bastion-${env}'
    location: location
    securityRules: [
      // Inbound — required by Azure Bastion
      {
        name: 'allow-https-from-internet'
        properties: {
          priority: 100
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'allow-gateway-manager'
        properties: {
          priority: 110
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: 'GatewayManager'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'allow-azure-load-balancer'
        properties: {
          priority: 120
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: 'AzureLoadBalancer'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'allow-bastion-host-communication'
        properties: {
          priority: 130
          protocol: '*'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '8080'
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
      // Outbound — required by Azure Bastion
      {
        name: 'allow-ssh-rdp-to-vnet'
        properties: {
          priority: 100
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '22'
        }
      }
      {
        name: 'allow-rdp-to-vnet'
        properties: {
          priority: 110
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '3389'
        }
      }
      {
        name: 'allow-azure-cloud-outbound'
        properties: {
          priority: 120
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: 'AzureCloud'
          destinationPortRange: '443'
        }
      }
      {
        name: 'allow-session-information-outbound'
        properties: {
          priority: 130
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: 'Internet'
          destinationPortRange: '80'
        }
      }
    ]
    tags: tags
  }
}

// ─────────────────────────────── Virtual Network ─────────────────────────────
// Hub-spoke VNet — 10.0.0.0/16 with 6 subnets for workload segregation.
// PE network policies disabled on data subnet where private endpoints will be placed.

module vnet 'br/public:avm/res/network/virtual-network:0.5.2' = {
  name: 'virtual-network'
  params: {
    name: vnetName
    location: location
    addressPrefixes: [
      '10.0.0.0/16'
    ]
    subnets: [
      // AKS nodes — /22 provides 1022 IPs for pod + node capacity (Azure CNI)
      {
        name: 'snet-aks'
        addressPrefix: '10.0.0.0/22'
        networkSecurityGroupResourceId: nsgAks.outputs.resourceId
      }
      // Data services — private endpoints for PostgreSQL, Redis, Key Vault, Storage
      {
        name: 'snet-data'
        addressPrefix: '10.0.4.0/24'
        networkSecurityGroupResourceId: nsgData.outputs.resourceId
        privateEndpointNetworkPolicies: 'Disabled'
      }
      // Application Gateway WAF v2 — dedicated subnet required by Azure (POL-015)
      {
        name: 'snet-appgw'
        addressPrefix: '10.0.5.0/24'
        networkSecurityGroupResourceId: nsgAppGw.outputs.resourceId
      }
      // Management — SSH/RDP via Bastion only (POL-020)
      {
        name: 'snet-mgmt'
        addressPrefix: '10.0.6.0/24'
        networkSecurityGroupResourceId: nsgMgmt.outputs.resourceId
        privateEndpointNetworkPolicies: 'Disabled'
      }
      // AzureBastionSubnet — exact name required by Azure (POL-020)
      {
        name: 'AzureBastionSubnet'
        addressPrefix: '10.0.7.0/26'
        networkSecurityGroupResourceId: nsgBastion.outputs.resourceId
      }
    ]
    tags: tags
  }
}

// ─────────────────────── Private DNS Zones ───────────────────────────────────
// Required for private endpoint name resolution (POL-007, POL-009, POL-013).
// Each zone is linked to the hub VNet for centralized DNS resolution.
// Private DNS zones are global (no location parameter).

// Key Vault private DNS zone (POL-009: Key Vault private-only access)
module dnsZoneKeyVault 'br/public:avm/res/network/private-dns-zone:0.6.0' = {
  name: 'dns-zone-keyvault'
  params: {
    name: 'privatelink.vaultcore.azure.net'
    virtualNetworkLinks: [
      {
        name: 'link-kv-${vnetName}'
        virtualNetworkResourceId: vnet.outputs.resourceId
        registrationEnabled: false
      }
    ]
    tags: tags
  }
}

// Blob Storage private DNS zone (POL-007: storage public network disabled)
module dnsZoneBlob 'br/public:avm/res/network/private-dns-zone:0.6.0' = {
  name: 'dns-zone-blob'
  params: {
    name: 'privatelink.blob.${storageSuffix}'
    virtualNetworkLinks: [
      {
        name: 'link-blob-${vnetName}'
        virtualNetworkResourceId: vnet.outputs.resourceId
        registrationEnabled: false
      }
    ]
    tags: tags
  }
}

// File Storage private DNS zone
module dnsZoneFile 'br/public:avm/res/network/private-dns-zone:0.6.0' = {
  name: 'dns-zone-file'
  params: {
    name: 'privatelink.file.${storageSuffix}'
    virtualNetworkLinks: [
      {
        name: 'link-file-${vnetName}'
        virtualNetworkResourceId: vnet.outputs.resourceId
        registrationEnabled: false
      }
    ]
    tags: tags
  }
}

// PostgreSQL Flexible Server private DNS zone (POL-010: private network only)
module dnsZonePostgres 'br/public:avm/res/network/private-dns-zone:0.6.0' = {
  name: 'dns-zone-postgres'
  params: {
    name: 'privatelink.postgres.database.azure.com'
    virtualNetworkLinks: [
      {
        name: 'link-psql-${vnetName}'
        virtualNetworkResourceId: vnet.outputs.resourceId
        registrationEnabled: false
      }
    ]
    tags: tags
  }
}

// Redis Enterprise private DNS zone (POL-013: Redis Enterprise private access)
module dnsZoneRedis 'br/public:avm/res/network/private-dns-zone:0.6.0' = {
  name: 'dns-zone-redis'
  params: {
    name: 'privatelink.redisenterprise.cache.azure.com'
    virtualNetworkLinks: [
      {
        name: 'link-redis-${vnetName}'
        virtualNetworkResourceId: vnet.outputs.resourceId
        registrationEnabled: false
      }
    ]
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Virtual Network resource ID.')
output vnetId string = vnet.outputs.resourceId

@description('Virtual Network name.')
output vnetName string = vnet.outputs.name

@description('AKS subnet resource ID (/22 for pod + node CIDR).')
output aksSubnetId string = '${vnet.outputs.resourceId}/subnets/snet-aks'

@description('Data subnet resource ID (private endpoints for PostgreSQL, Redis, KV, Storage).')
output dataSubnetId string = '${vnet.outputs.resourceId}/subnets/snet-data'

@description('Application Gateway subnet resource ID.')
output appGwSubnetId string = '${vnet.outputs.resourceId}/subnets/snet-appgw'

@description('Management subnet resource ID.')
output mgmtSubnetId string = '${vnet.outputs.resourceId}/subnets/snet-mgmt'

@description('Azure Bastion subnet resource ID.')
output bastionSubnetId string = '${vnet.outputs.resourceId}/subnets/AzureBastionSubnet'

@description('Key Vault private DNS zone resource ID.')
output kvPrivateDnsZoneId string = dnsZoneKeyVault.outputs.resourceId

@description('Blob Storage private DNS zone resource ID.')
output blobPrivateDnsZoneId string = dnsZoneBlob.outputs.resourceId

@description('File Storage private DNS zone resource ID.')
output filePrivateDnsZoneId string = dnsZoneFile.outputs.resourceId

@description('PostgreSQL private DNS zone resource ID.')
output postgresPrivateDnsZoneId string = dnsZonePostgres.outputs.resourceId

@description('Redis Enterprise private DNS zone resource ID.')
output redisPrivateDnsZoneId string = dnsZoneRedis.outputs.resourceId
