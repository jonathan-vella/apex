// recipes/sql/bicep/sql.bicep
// Azure SQL Database recipe module — adds SQL Server, database, and RBAC
// for Azure Functions with managed identity authentication.
//
// REQUIREMENTS FOR BASE TEMPLATE:
// 1. Storage account MUST have: allowSharedKeyAccess: false (Azure policy)
// 2. Storage account MUST have: allowBlobPublicAccess: false
// 3. Function app MUST have tag: union(tags, { 'azd-service-name': 'api' })
//
// USAGE: Add this as a module in your main.bicep:
//   module sql './app/sql.bicep' = {
//     name: 'sql'
//     scope: rg
//     params: {
//       name: name
//       location: location
//       tags: tags
//       functionAppPrincipalId: app.outputs.SERVICE_API_IDENTITY_PRINCIPAL_ID
//       aadAdminObjectId: principalId
//       aadAdminName: 'youruser@yourdomain.com'
//     }
//   }

targetScope = 'resourceGroup'

@description('Base name for resources')
param name string

@description('Azure region')
param location string = resourceGroup().location

@description('Resource tags')
param tags object = {}

@description('Principal ID of the Function App managed identity')
param functionAppPrincipalId string

@description('AAD admin object ID for SQL Server')
param aadAdminObjectId string

@description('AAD admin login name (UPN or group name)')
param aadAdminName string

@description('Database name')
param databaseName string = 'appdb'

@description('SQL Database SKU')
param sqlSku string = 'Basic'

@description('Retained for caller compatibility; SQL requires private networking in every environment')
param isProduction bool = true

@description('Deprecated compatibility parameter; public SQL access is not permitted')
@allowed([false])
param publicNetworkAccessApproved bool = false

@description('Approved private endpoint subnet resource ID')
param privateEndpointSubnetId string

@description('Function integration VNet resource ID for private DNS')
param virtualNetworkId string

// ============================================================================
// Naming
// ============================================================================
var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().name, name), 6)
var sqlServerName = 'sql-${name}-${resourceSuffix}'

// ============================================================================
// SQL Server
// ============================================================================
resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: sqlServerName
  location: location
  tags: tags
  properties: {
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'User'
      login: aadAdminName
      sid: aadAdminObjectId
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: true  // Entra-only, no SQL auth
    }
  }
}

// ============================================================================
// SQL Database (Serverless for cost optimization)
// ============================================================================
resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  tags: tags
  sku: {
    name: sqlSku
    tier: sqlSku
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648  // 2GB
  }
}

// ============================================================================
// NOTE: SQL RBAC for managed identity requires T-SQL
// The function app's managed identity must be added as a database user:
//
// CREATE USER [<function-app-name>] FROM EXTERNAL PROVIDER;
// ALTER ROLE db_datareader ADD MEMBER [<function-app-name>];
// ALTER ROLE db_datawriter ADD MEMBER [<function-app-name>];
//
// This cannot be done via ARM/Bicep - use a deployment script or post-deploy step.
// ============================================================================

// ============================================================================
// Outputs
// ============================================================================
resource sqlPrivateDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink${environment().suffixes.sqlServerHostname}'
  location: 'global'
  tags: tags
}

resource sqlDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: sqlPrivateDns
  name: 'sql-dns-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: virtualNetworkId }
  }
}

resource sqlPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'pe-${sqlServerName}'
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [{
      name: 'sql'
      properties: {
        privateLinkServiceId: sqlServer.id
        groupIds: ['sqlServer']
      }
    }]
  }
}

resource sqlDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: sqlPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [{
      name: 'sql'
      properties: { privateDnsZoneId: sqlPrivateDns.id }
    }]
  }
}

output sqlServerName string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDatabase.name
output sqlServerId string = sqlServer.id

// ============================================================================
// APP SETTINGS OUTPUT
// ============================================================================
@description('UAMI client ID from base template identity module - REQUIRED for UAMI auth')
param uamiClientId string

output appSettings object = {
  AZURE_SQL_CONNECTION_STRING_KEY: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${databaseName};Authentication=Active Directory Managed Identity;User Id=${uamiClientId};Encrypt=True;TrustServerCertificate=False;'
  SQL_SERVER_NAME: sqlServer.name
  SQL_DATABASE_NAME: databaseName
}
