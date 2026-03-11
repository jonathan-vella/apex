targetScope = 'resourceGroup'

// ──────────────────────────────────────────────
// SQL Module — SQL Server + Database + Private Endpoint (prod)
// ──────────────────────────────────────────────

@description('Project name for resource naming')
param projectName string

@description('Application name for database naming')
param applicationName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Deployment environment')
@allowed(['dev', 'prod'])
param environment string

@description('SQL Database SKU object')
param sqlDatabaseSku object

@description('Entra ID admin group object ID')
param sqlAdminGroupObjectId string

@description('Entra ID admin group display name')
param sqlAdminGroupName string

@description('Enable private endpoint')
param enablePrivateEndpoints bool

@description('Private endpoint subnet resource ID')
param peSubnetResourceId string

@description('SQL DNS zone resource ID')
param sqlDnsZoneResourceId string

// ──────────────────────────────────────────────
// Variables
// ──────────────────────────────────────────────

var sqlServerName = 'sql-${projectName}-${environment}'
var sqlDatabaseName = 'sqldb-${applicationName}-${environment}'

// ──────────────────────────────────────────────
// SQL Server (AVM) — Azure AD-only auth (policy: Deny)
// ──────────────────────────────────────────────

module sqlServer 'br/public:avm/res/sql/server:0.21.1' = {
  name: sqlServerName
  params: {
    name: sqlServerName
    location: location
    tags: tags
    minimalTlsVersion: '1.2'
    publicNetworkAccess: enablePrivateEndpoints ? 'Disabled' : 'Enabled'
    administrators: {
      azureADOnlyAuthentication: true
      login: sqlAdminGroupName
      sid: sqlAdminGroupObjectId
      principalType: 'Group'
      tenantId: tenant().tenantId
    }
    managedIdentities: {
      systemAssigned: true
    }
    databases: [
      {
        name: sqlDatabaseName
        sku: sqlDatabaseSku
        maxSizeBytes: 268435456000
        availabilityZone: -1
        zoneRedundant: false
      }
    ]
    securityAlertPolicies: [
      {
        name: 'default'
        state: 'Enabled'
        emailAccountAdmins: true
        retentionDays: 30
      }
    ]
    privateEndpoints: enablePrivateEndpoints ? [
      {
        subnetResourceId: peSubnetResourceId
        privateDnsZoneResourceIds: [
          sqlDnsZoneResourceId
        ]
      }
    ] : []
  }
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────

@description('SQL Server resource ID')
output sqlServerResourceId string = sqlServer.outputs.resourceId

@description('SQL Server name')
output sqlServerName string = sqlServer.outputs.name

@description('SQL Server FQDN')
output sqlServerFqdn string = sqlServer.outputs.fullyQualifiedDomainName

@description('SQL Server system-assigned identity principal ID')
output sqlServerPrincipalId string = sqlServer.outputs.systemAssignedMIPrincipalId
