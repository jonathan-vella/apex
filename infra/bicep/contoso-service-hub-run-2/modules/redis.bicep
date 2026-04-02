// modules/redis.bicep — Redis Enterprise with private endpoint
// AVM: br/public:avm/res/cache/redis-enterprise:0.4.0
// Governance:
//   POL-001 — EU-only region (swedencentral enforced by location param)
//   POL-002 — Required governance tags (passed via tags param)
//   POL-013 — Redis Enterprise private access (no public endpoints)
//   POL-014 — Redis TLS 1.2 minimum
//   POL-022 — Diagnostic settings to Log Analytics
// Security: TLS 1.2, private endpoint only, noeviction policy

@description('Azure region for the Redis Enterprise cluster (must be swedencentral, POL-001).')
param location string

@description('Deployment environment — controls SKU, capacity, and zone redundancy.')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

@description('4-character unique suffix derived from resource group ID (passed from main.bicep).')
param uniqueSuffix string

@description('Redis Enterprise cluster name.')
param redisName string

@description('Log Analytics Workspace resource ID for diagnostic settings (POL-022).')
param workspaceId string

@description('Data subnet resource ID for the Redis private endpoint (POL-013).')
param dataSubnetId string

@description('Redis Enterprise private DNS zone resource ID (privatelink.redisenterprise.cache.azure.com).')
param redisPrivateDnsZoneId string

// ─────────────────────────────── Environment-specific sizing ─────────────────

// SKU: prod=Enterprise_E50 (128 GB), staging=Enterprise_E10, dev=Enterprise_E10
var redisSkuName = env == 'prod' ? 'Enterprise_E50' : 'Enterprise_E10'

// Capacity: Enterprise_E50 capacity=2 → 128 GB (prod); Enterprise_E10 capacity=2 → 24 GB (dev/staging)
// AVM 0.4.0 enforces minimum capacity of 2 for Enterprise SKUs
var redisCapacity = env == 'prod' ? 2 : 2

// Zone redundancy: enabled for prod (zones 1,2,3), disabled elsewhere
// AVM 0.4.0 availabilityZones expects int array
var redisZones = env == 'prod' ? [1, 2, 3] : []

// ──────────────────────────── Redis Enterprise Cluster ───────────────────────

module redisCluster 'br/public:avm/res/cache/redis-enterprise:0.4.0' = {
  name: 'redis-enterprise'
  params: {
    name: redisName
    location: location

    // SKU and capacity — environment-specific
    skuName: redisSkuName
    capacity: redisCapacity

    // POL-014: TLS 1.2 minimum at cluster level
    minimumTlsVersion: '1.2'

    // Zone redundancy for prod (POL-001 single-region with zone redundancy)
    // AVM 0.4.0 uses 'availabilityZones' (not 'zones')
    availabilityZones: redisZones

    // Database configuration — 'database' is a singular object in AVM 0.4.0
    database: {
      // POL-014: Encrypted client protocol enforces TLS in transit
      clientProtocol: 'Encrypted'
      // noeviction: never evict keys (service hub uses Redis as a primary cache)
      evictionPolicy: 'NoEviction'
      // Enterprise clustering mode for E-series SKUs
      clusteringPolicy: 'EnterpriseCluster'
    }

    // POL-013: Private endpoint at cluster level (not database level) — AVM 0.4.0
    privateEndpoints: [
      {
        name: 'pe-redis-${uniqueSuffix}'
        subnetResourceId: dataSubnetId
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: redisPrivateDnsZoneId
            }
          ]
        }
      }
    ]

    // POL-022: Diagnostic settings — metrics only (Redis Enterprise emits AllMetrics)
    // AVM 0.4.0 diagnosticSettings schema does not expose logCategoriesAndGroups
    diagnosticSettings: [
      {
        workspaceResourceId: workspaceId
        metricCategories: [
          {
            category: 'AllMetrics'
            enabled: true
          }
        ]
      }
    ]

    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Redis Enterprise cluster resource ID.')
output redisId string = redisCluster.outputs.resourceId

@description('Redis Enterprise cluster name.')
output redisName string = redisCluster.outputs.name

@description('Redis Enterprise database hostname (used by application connection strings).')
output redisHostname string = redisCluster.outputs.hostName
