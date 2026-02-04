// ============================================================================
// Data Module - SQL Server & Database
// ============================================================================
// Purpose: Azure SQL Server with database for application data
// AVM Module: sql/server v0.21.1
// Security: Azure AD-only authentication (no SQL auth)
// ============================================================================

// =============================================================================
// PARAMETERS
// =============================================================================

@description('Azure region for resource deployment')
param location string

@description('Location abbreviation for naming')
param locationAbbr string

@description('Environment name')
param environment string

@description('Project name')
param projectName string

@description('Unique suffix for resource naming')
param uniqueSuffix string

@description('Tags for all resources')
param tags object

@description('SQL Administrator Azure AD Group Object ID')
param sqlAdminGroupObjectId string

@description('SQL Administrator Azure AD Group Name')
param sqlAdminGroupName string

// =============================================================================
// VARIABLES
// =============================================================================

// SQL Server name (max 63 chars, lowercase)
var sqlServerName = 'sql-${projectName}-${environment}-${locationAbbr}-${take(uniqueSuffix, 6)}'
var sqlDatabaseName = 'sqldb-${projectName}-${environment}'

// =============================================================================
// RESOURCES
// =============================================================================

// -----------------------------------------------------------------------------
// SQL Server with Database
// AVM: avm/res/sql/server v0.21.1
// Security: Azure AD-only authentication (azureADOnlyAuthentication: true)
// PITFALL: Use sku object in databases array with availabilityZone
// -----------------------------------------------------------------------------

module sqlServer 'br/public:avm/res/sql/server:0.21.1' = {
  name: 'sql-server'
  params: {
    name: sqlServerName
    location: location
    tags: tags

    // Azure AD-only authentication (no SQL passwords)
    administrators: {
      azureADOnlyAuthentication: true
      login: sqlAdminGroupName
      sid: sqlAdminGroupObjectId
      principalType: 'Group'
      tenantId: subscription().tenantId
    }

    // Managed identity
    managedIdentities: {
      systemAssigned: true
    }

    // Public network access (enabled for dev)
    publicNetworkAccess: 'Enabled'

    // Minimum TLS version
    minimalTlsVersion: '1.2'

    // Firewall rules (allow Azure services for dev)
    firewallRules: [
      {
        name: 'AllowAllAzureIps'
        startIpAddress: '0.0.0.0'
        endIpAddress: '0.0.0.0'
      }
    ]

    // Database configuration
    // Note: AVM requires availabilityZone in database config
    databases: [
      {
        name: sqlDatabaseName
        sku: {
          name: 'Basic'
          tier: 'Basic'
        }
        maxSizeBytes: 2147483648 // 2 GB
        collation: 'SQL_Latin1_General_CP1_CI_AS'
        zoneRedundant: false // Not available for Basic tier
        requestedBackupStorageRedundancy: 'Local' // Local for dev
        availabilityZone: -1 // Required by AVM: -1 = no zone preference
      }
    ]
  }
}

// =============================================================================
// OUTPUTS
// =============================================================================

@description('SQL Server Resource ID')
output sqlServerId string = sqlServer.outputs.resourceId

@description('SQL Server Name')
output sqlServerName string = sqlServer.outputs.name

@description('SQL Server Fully Qualified Domain Name')
output sqlServerFqdn string = sqlServer.outputs.fullyQualifiedDomainName

@description('SQL Database Resource ID - derive from server ID')
output sqlDatabaseId string = '${sqlServer.outputs.resourceId}/databases/${sqlDatabaseName}'

@description('SQL Database Name')
output sqlDatabaseName string = sqlDatabaseName

@description('SQL Server System Assigned Identity Principal ID')
output sqlServerPrincipalId string = sqlServer.outputs.systemAssignedMIPrincipalId ?? ''
