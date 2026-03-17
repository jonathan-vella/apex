@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment used to size the PostgreSQL Flexible Server.')
param environmentName string

@description('Azure region for the PostgreSQL deployment.')
param location string

@description('Common resource tags applied to the PostgreSQL resources.')
param tags object

@description('PostgreSQL Flexible Server name.')
param postgresqlName string

@description('Delegated subnet resource ID used for private PostgreSQL access.')
param delegatedSubnetResourceId string

@description('Virtual network resource ID used to link the private DNS zone.')
param virtualNetworkResourceId string

@description('Log Analytics workspace resource ID used for PostgreSQL diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

var postgresqlPrivateDnsZoneName = 'privatelink.postgres.database.azure.com'
var postgresqlSkuName = environmentName == 'prod' ? 'Standard_D8s_v5' : environmentName == 'staging' ? 'Standard_D4s_v5' : 'Standard_B2s'
var postgresqlTier = environmentName == 'dev' ? 'Burstable' : 'GeneralPurpose'
var postgresqlStorageSizeGb = environmentName == 'prod' ? 256 : environmentName == 'staging' ? 128 : 32
var postgresqlHighAvailability = environmentName == 'prod' ? 'ZoneRedundant' : 'Disabled'

module postgresqlPrivateDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: postgresqlPrivateDnsZoneName
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: virtualNetworkResourceId
      }
    ]
  }
}

module postgresql 'br/public:avm/res/db-for-postgre-sql/flexible-server:0.15.2' = {
  params: {
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
    }
    availabilityZone: -1
    backupRetentionDays: 35
    delegatedSubnetResourceId: delegatedSubnetResourceId
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
    highAvailability: postgresqlHighAvailability
    highAvailabilityZone: -1
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    name: postgresqlName
    privateDnsZoneArmResourceId: postgresqlPrivateDnsZone.outputs.resourceId
    publicNetworkAccess: 'Disabled'
    skuName: postgresqlSkuName
    storageSizeGB: postgresqlStorageSizeGb
    tags: tags
    tier: postgresqlTier
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

@description('PostgreSQL Flexible Server resource ID.')
output postgresqlId string = postgresql.outputs.resourceId

@description('PostgreSQL Flexible Server name.')
output postgresqlNameOut string = postgresql.outputs.name

@description('PostgreSQL Flexible Server fully qualified domain name.')
output postgresqlFqdn string = postgresql.outputs.?fqdn ?? '${postgresqlName}.postgres.database.azure.com'
