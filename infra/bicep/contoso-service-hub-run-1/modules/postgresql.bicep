targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment.')
param environment string

@description('PostgreSQL Flexible Server name.')
param postgresqlName string

@description('Azure region.')
param location string

@description('Resource tags.')
param tags object

@description('Log Analytics workspace resource ID used for diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

@description('Subnet resource ID for the PostgreSQL private endpoint.')
param privateEndpointSubnetResourceId string

@description('Private DNS zone resource ID for privatelink.postgres.database.azure.com.')
param postgresqlPrivateDnsZoneResourceId string

var postgresqlSkuName = environment == 'prod' ? 'Standard_D4s_v5' : environment == 'staging' ? 'Standard_D2s_v5' : 'Standard_B1ms'
var postgresqlTier = environment == 'dev' ? 'Burstable' : 'GeneralPurpose'
var highAvailabilityMode = environment == 'prod' ? 'ZoneRedundant' : 'Disabled'

module postgresql 'br/public:avm/res/db-for-postgre-sql/flexible-server:0.15.2' = {
  params: {
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
    }
    availabilityZone: -1
    backupRetentionDays: 35
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
    geoRedundantBackup: 'Disabled'
    highAvailability: highAvailabilityMode
    highAvailabilityZone: -1
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    name: postgresqlName
    privateEndpoints: [
      {
        location: location
        name: 'pe-${postgresqlName}'
        privateDnsZoneGroup: {
          name: 'default'
          privateDnsZoneGroupConfigs: [
            {
              name: 'postgresql'
              privateDnsZoneResourceId: postgresqlPrivateDnsZoneResourceId
            }
          ]
        }
        privateLinkServiceConnectionName: 'plsc-${postgresqlName}'
        subnetResourceId: privateEndpointSubnetResourceId
        tags: tags
      }
    ]
    publicNetworkAccess: 'Disabled'
    skuName: postgresqlSkuName
    storageSizeGB: 256
    tags: tags
    tier: postgresqlTier
    version: '16'
  }
}

@description('PostgreSQL Flexible Server resource ID.')
output postgresqlId string = postgresql.outputs.resourceId

@description('PostgreSQL Flexible Server name.')
output postgresqlNameOut string = postgresql.outputs.name

@description('PostgreSQL Flexible Server FQDN.')
output postgresqlFqdn string = postgresql.outputs.?fqdn ?? ''
