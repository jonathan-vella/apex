targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string
param location string
param tags object
param postgresqlName string
param postgresqlSkuName string
param highAvailabilityMode string
param postgresqlSubnetResourceId string
param postgresqlDnsZoneResourceId string
param logAnalyticsWorkspaceResourceId string
@secure()
param postgresqlAdministratorPassword string

var tier = environment == 'dev' ? 'Burstable' : 'GeneralPurpose'
var storageSizeGb = environment == 'prod' ? 256 : environment == 'staging' ? 128 : 32

module postgresql 'br/public:avm/res/db-for-postgre-sql/flexible-server:0.15.2' = {
  params: {
    administratorLogin: 'psqladmin'
    administratorLoginPassword: postgresqlAdministratorPassword
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
    }
    availabilityZone: -1
    backupRetentionDays: 30
    delegatedSubnetResourceId: postgresqlSubnetResourceId
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
    location: location
    name: postgresqlName
    privateDnsZoneArmResourceId: postgresqlDnsZoneResourceId
    publicNetworkAccess: 'Disabled'
    skuName: postgresqlSkuName
    storageSizeGB: storageSizeGb
    tags: tags
    tier: tier
    version: '16'
  }
}

resource postgresqlServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-03-01-preview' existing = {
  name: postgresqlName
}

resource requireSecureTransport 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-03-01-preview' = {
  parent: postgresqlServer
  name: 'require_secure_transport'
  properties: {
    source: 'user-override'
    value: 'ON'
  }
}

resource minimumTlsVersion 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-03-01-preview' = {
  parent: postgresqlServer
  name: 'ssl_min_protocol_version'
  properties: {
    source: 'user-override'
    value: 'TLSv1.2'
  }
}

output postgresqlServerId string = postgresql.outputs.resourceId
output postgresqlServerName string = postgresql.outputs.name
output postgresqlServerFqdn string = postgresql.outputs.?fqdn ?? '${postgresqlName}.postgres.database.azure.com'
