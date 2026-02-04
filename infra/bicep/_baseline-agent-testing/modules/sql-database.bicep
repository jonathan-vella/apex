// ============================================================================
// Azure SQL Database Module (Scenario 2: API + Database)
// ============================================================================
// Purpose: Deploy Azure SQL Server and Database for data testing
// Security: Entra ID-only auth, Private Endpoint, TLS 1.2, TDE enabled
// Policy Compliance: MCAPS deny policies for SQL authentication
// ============================================================================

@description('Name of the SQL Server (globally unique)')
param serverName string

@description('Azure region for deployment')
param location string

@description('Resource tags')
param tags object

@description('Database name')
param databaseName string = 'testdb'

@description('Database SKU name')
@allowed(['Basic', 'S0', 'S1', 'S2', 'GP_Gen5_2'])
param databaseSkuName string = 'Basic'

@description('Minimum TLS version')
@allowed(['1.0', '1.1', '1.2'])
param minimalTlsVersion string = '1.2'

@description('Entra ID administrator object ID')
param entraAdminObjectId string

@description('Entra ID administrator login name (UPN or group name)')
param entraAdminLogin string

@description('Entra ID administrator principal type')
@allowed(['User', 'Group', 'Application'])
param entraAdminPrincipalType string = 'User'

@description('Subnet resource ID for private endpoint')
param subnetId string = ''

@description('Deploy private endpoint')
param deployPrivateEndpoint bool = false

// ============================================================================
// SQL Server Resource - Entra ID Only Authentication
// ============================================================================

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: serverName
  location: location
  tags: tags
  properties: {
    minimalTlsVersion: minimalTlsVersion
    publicNetworkAccess: deployPrivateEndpoint ? 'Disabled' : 'Enabled'
    version: '12.0'
    // Entra ID-only authentication - NO SQL auth
    administrators: {
      administratorType: 'ActiveDirectory'
      azureADOnlyAuthentication: true // CRITICAL: Policy requirement
      login: entraAdminLogin
      principalType: entraAdminPrincipalType
      sid: entraAdminObjectId
      tenantId: subscription().tenantId
    }
  }
}

// Allow Azure services to access (only if not using private endpoint)
resource firewallRuleAllowAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = if (!deployPrivateEndpoint) {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ============================================================================
// Database Resource
// ============================================================================

resource database 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  tags: tags
  sku: {
    name: databaseSkuName
    tier: databaseSkuName == 'Basic' ? 'Basic' : 'Standard'
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648 // 2 GB
    catalogCollation: 'SQL_Latin1_General_CP1_CI_AS'
    zoneRedundant: false // Not required for test infrastructure
    readScale: 'Disabled'
    requestedBackupStorageRedundancy: 'Local' // Cost optimization
  }
}

// ============================================================================
// Private Endpoint
// ============================================================================

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = if (deployPrivateEndpoint && subnetId != '') {
  name: 'pe-${serverName}'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'plsc-${serverName}'
        properties: {
          privateLinkServiceId: sqlServer.id
          groupIds: [
            'sqlServer'
          ]
        }
      }
    ]
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('SQL Server fully qualified domain name')
output fullyQualifiedDomainName string = sqlServer.properties.fullyQualifiedDomainName

@description('SQL Server resource ID')
output resourceId string = sqlServer.id

@description('SQL Server name')
output name string = sqlServer.name

@description('Database resource ID')
output databaseResourceId string = database.id

@description('Database name')
output databaseName string = database.name

@description('Private endpoint resource ID')
output privateEndpointId string = deployPrivateEndpoint && subnetId != '' ? privateEndpoint.id : ''
