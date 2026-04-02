// modules/redis.bicep
// Phase 2 — Azure Managed Redis Enterprise with private endpoint and TLS 1.2
// AVM: br/public:avm/res/cache/redis-enterprise:0.5.0
// Governance:
//   - publicNetworkAccess: Disabled (redis-private-only policy)
//   - minimumTlsVersion: 1.2 (redis-min-tls-12 policy)
//   - EU location enforced (allowed-eu-locations policy)
//   - Mandatory 4 tags (required-tags policy)

@description('Azure region for all resources.')
param location string

@description('Environment name (dev | staging | prod).')
param environment string

@description('Project short name for CAF naming.')
param projectName string

@description('Private Endpoint subnet resource ID (snet-pe).')
param subnetPeId string

@description('Private DNS zone resource ID for Redis Enterprise (privatelink.redisenterprise.cache.azure.net).')
param privateDnsZoneRedisId string

@description('Log Analytics workspace resource ID for diagnostic settings.')
param logAnalyticsWorkspaceId string

@description('Resource tags applied to all resources in this module.')
param tags object

// ─────────────────────────────── Derived configuration ───────────────────────

// CAF naming: redis-{project}-{env}
var clusterName = 'redis-${projectName}-${environment}'
var peName      = 'pe-redis-${projectName}-${environment}'

// SKU — Enterprise_E100 (128 GB) for prod, Enterprise_E10 (12 GB) for dev/staging
var skuName = environment == 'prod' ? 'Enterprise_E100' : 'Enterprise_E10'

// Availability zones for prod HA; AVM expects int array (1, 2, 3) not strings
var zones = environment == 'prod' ? [ 1, 2, 3 ] : []

// ─────────────────────────── Redis Enterprise Cluster ────────────────────────

module redis 'br/public:avm/res/cache/redis-enterprise:0.5.0' = {
  name: 'redis-enterprise'
  params: {
    name: clusterName
    location: location

    // SKU — Enterprise_E100 (128 GB) for prod, Enterprise_E10 (12 GB) for dev/staging
    skuName: skuName

    // Availability zones for prod HA (zone-redundant across 3 zones)
    availabilityZones: zones

    // Governance: redis-min-tls-12 (Deny) — TLS 1.2 minimum
    minimumTlsVersion: '1.2'

    // Governance: redis-private-only (Deny) — disable public network access
    publicNetworkAccess: 'Disabled'

    // Database within the cluster (singular ‘database’ param, not array)
    database: {
      clientProtocol: 'Encrypted'
      evictionPolicy: 'NoEviction'
      clusteringPolicy: 'EnterpriseCluster'
      port: 10000
    }

    // Private endpoint — snet-pe subnet + private DNS zone
    privateEndpoints: [
      {
        name: peName
        subnetResourceId: subnetPeId
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: privateDnsZoneRedisId
            }
          ]
        }
      }
    ]

    // Diagnostics → Log Analytics (mandatory for governance visibility)
    diagnosticSettings: [
      {
        workspaceResourceId: logAnalyticsWorkspaceId
        metricCategories: [
          {
            category: 'AllMetrics'
          }
        ]
      }
    ]

    // Governance: required-tags (Deny) — all 4 tags mandatory
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Redis Enterprise cluster resource ID.')
output redisId string = redis.outputs.resourceId

@description('Redis Enterprise cluster name.')
output redisName string = redis.outputs.name

@description('Redis Enterprise cluster host name (used by applications).')
output redisHostName string = redis.outputs.hostName
