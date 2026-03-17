targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string
param location string
param tags object
param redisName string
param redisSkuName string
param logAnalyticsWorkspaceResourceId string
param privateEndpointSubnetResourceId string
param redisPrivateDnsZoneResourceId string

var availabilityZones = environment == 'prod' ? [1, 2, 3] : []
var clusterCapacity = environment == 'prod' ? 8 : 2

module redis 'br/public:avm/res/cache/redis-enterprise:0.5.0' = {
  params: {
    availabilityZones: availabilityZones
    capacity: clusterCapacity
    database: {
      accessKeysAuthentication: 'Disabled'
      clientProtocol: 'Encrypted'
      clusteringPolicy: 'OSSCluster'
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
      evictionPolicy: 'NoEviction'
      name: 'default'
      port: 10000
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

output redisClusterId string = redis.outputs.resourceId
output redisClusterName string = redis.outputs.name
output redisHostName string = redis.outputs.hostName
output redisPort int = 10000
