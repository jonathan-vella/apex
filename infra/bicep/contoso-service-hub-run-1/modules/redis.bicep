targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment.')
param environment string

@description('Azure Managed Redis cluster name.')
param redisName string

@description('Azure region.')
param location string

@description('Resource tags.')
param tags object

@description('Log Analytics workspace resource ID used for diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

@description('Subnet resource ID for the Redis private endpoint.')
param privateEndpointSubnetResourceId string

@description('Private DNS zone resource ID for privatelink.redis.cache.windows.net.')
param redisPrivateDnsZoneResourceId string

var redisSkuName = environment == 'prod' ? 'EnterpriseFlash_F300' : environment == 'staging' ? 'Enterprise_E10' : 'Enterprise_E5'
var redisCapacity = environment == 'prod' ? 3 : 2
var redisAvailabilityZones = environment == 'prod' ? [1, 2, 3] : []
var persistenceConfig = environment == 'prod'
  ? {
      frequency: '1h'
      type: 'rdb'
    }
  : {
      type: 'disabled'
    }

module redis 'br/public:avm/res/cache/redis-enterprise:0.5.0' = {
  params: {
    availabilityZones: redisAvailabilityZones
    capacity: redisCapacity
    database: {
      accessKeysAuthentication: 'Disabled'
      clientProtocol: 'Encrypted'
      diagnosticSettings: [
        {
          logCategoriesAndGroups: [
            {
              categoryGroup: 'allLogs'
              enabled: true
            }
          ]
          workspaceResourceId: logAnalyticsWorkspaceResourceId
        }
      ]
      evictionPolicy: 'VolatileLRU'
      name: 'default'
      persistence: persistenceConfig
    }
    diagnosticSettings: [
      {
        metricCategories: [
          {
            category: 'AllMetrics'
            enabled: true
          }
        ]
        workspaceResourceId: logAnalyticsWorkspaceResourceId
      }
    ]
    location: location
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
              privateDnsZoneResourceId: redisPrivateDnsZoneResourceId
            }
          ]
        }
        privateLinkServiceConnectionName: 'plsc-${redisName}'
        subnetResourceId: privateEndpointSubnetResourceId
        tags: tags
      }
    ]
    publicNetworkAccess: 'Disabled'
    skuName: redisSkuName
    tags: tags
  }
}

@description('Azure Managed Redis resource ID.')
output redisId string = redis.outputs.resourceId

@description('Azure Managed Redis name.')
output redisNameOut string = redis.outputs.name

@description('Azure Managed Redis hostname.')
output redisHostName string = redis.outputs.hostName
