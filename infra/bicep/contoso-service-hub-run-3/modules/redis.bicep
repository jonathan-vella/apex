@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment used to size the Redis cache.')
param environmentName string

@description('Azure region for the Redis deployment.')
param location string

@description('Common resource tags applied to Redis resources.')
param tags object

@description('Azure Cache for Redis name.')
param redisName string

@description('Subnet resource ID used for the Redis private endpoint.')
param privateEndpointSubnetResourceId string

@description('Virtual network resource ID used to link the Redis private DNS zone.')
param virtualNetworkResourceId string

@description('Log Analytics workspace resource ID used for Redis diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

var redisPrivateDnsZoneName = 'privatelink.redis.cache.windows.net'
var redisSkuName = environmentName == 'prod' ? 'Premium' : environmentName == 'staging' ? 'Premium' : 'Basic'
var redisCapacity = environmentName == 'prod' ? 4 : environmentName == 'staging' ? 1 : 0

module redisPrivateDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: redisPrivateDnsZoneName
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: virtualNetworkResourceId
      }
    ]
  }
}

module redis 'br/public:avm/res/cache/redis:0.16.4' = {
  params: {
    capacity: redisCapacity
    diagnosticSettings: [
      {
        logCategoriesAndGroups: [
          {
            categoryGroup: 'allLogs'
            enabled: true
          }
        ]
        metricCategories: [
          {
            category: 'AllMetrics'
            enabled: true
          }
        ]
        workspaceResourceId: logAnalyticsWorkspaceResourceId
      }
    ]
    enableNonSslPort: false
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    minimumTlsVersion: '1.2'
    name: redisName
    privateEndpoints: [
      {
        location: location
        name: 'pe-${redisName}'
        privateDnsZoneGroup: {
          name: 'default'
          privateDnsZoneGroupConfigs: [
            {
              name: 'redis'
              privateDnsZoneResourceId: redisPrivateDnsZone.outputs.resourceId
            }
          ]
        }
        privateLinkServiceConnectionName: 'plsc-${redisName}'
        subnetResourceId: privateEndpointSubnetResourceId
        tags: tags
      }
    ]
    publicNetworkAccess: 'Disabled'
    redisConfiguration: environmentName == 'prod'
      ? {
          'aof-backup-enabled': '1'
        }
      : {}
    skuName: redisSkuName
    tags: tags
    zoneRedundant: environmentName == 'prod'
  }
}

@description('Azure Cache for Redis resource ID.')
output redisId string = redis.outputs.resourceId

@description('Azure Cache for Redis name.')
output redisNameOut string = redis.outputs.name

@description('Azure Cache for Redis host name.')
output redisHostName string = redis.outputs.?hostName ?? '${redisName}.redis.cache.windows.net'
