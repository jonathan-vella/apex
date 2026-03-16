targetScope = 'resourceGroup'

@description('Azure region.')
param location string

@description('Microsoft Entra administrator object ID for the SQL Server.')
param sqlAdminObjectId string

@description('Microsoft Entra administrator display name for the SQL Server.')
param sqlAdminPrincipalName string

@allowed([
  'Application'
  'Group'
  'User'
])
@description('Microsoft Entra administrator principal type.')
param sqlAdminPrincipalType string

@description('Azure SQL Database resource name.')
param sqlDatabaseName string

@description('Azure SQL Database SKU object.')
param sqlDatabaseSku object

@description('Azure SQL Server resource name.')
param sqlServerName string

@description('Resource tags.')
param tags object

module sqlServer 'br/public:avm/res/sql/server:0.21.1' = {
  params: {
    administrators: {
      azureADOnlyAuthentication: true
      login: sqlAdminPrincipalName
      principalType: sqlAdminPrincipalType
      sid: sqlAdminObjectId
      tenantId: tenant().tenantId
    }
    databases: [
      {
        availabilityZone: -1
        maxSizeBytes: 2147483648
        name: sqlDatabaseName
        sku: sqlDatabaseSku
        zoneRedundant: false
      }
    ]
    // B1 App Service lacks VNet integration; allow Azure services as compensating control
    firewallRules: [
      {
        name: 'AllowAllAzureServices'
        startIpAddress: '0.0.0.0'
        endIpAddress: '0.0.0.0'
      }
    ]
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    minimalTlsVersion: '1.2'
    name: sqlServerName
    publicNetworkAccess: 'Enabled'
    securityAlertPolicies: [
      {
        emailAccountAdmins: true
        name: 'default'
        retentionDays: 30
        state: 'Enabled'
      }
    ]
    tags: tags
  }
}

@description('SQL Server resource ID.')
output resourceId string = sqlServer.outputs.resourceId

@description('SQL Server resource name.')
output resourceName string = sqlServer.outputs.name

@description('SQL Server fully qualified domain name.')
output fullyQualifiedDomainName string = sqlServer.outputs.fullyQualifiedDomainName

@description('SQL Database name.')
output databaseName string = sqlDatabaseName
