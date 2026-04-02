// modules/postgresql.bicep
// Phase 2 — PostgreSQL Flexible Server with VNet injection, Entra-only auth, TLS 1.2
// AVM: br/public:avm/res/db-for-postgre-sql/flexible-server:0.15.2
// Governance:
//   - publicNetworkAccess: Disabled (postgresql-private-only policy)
//   - authConfig.passwordAuth: Disabled (postgresql-entra-only-auth policy)
//   - minimalTlsVersion: TLS1_2 (postgresql-min-tls-12 policy)
//   - EU location enforced (allowed-eu-locations policy)
//   - Mandatory 4 tags (required-tags policy)

@description('Azure region for all resources.')
param location string

@description('Environment name (dev | staging | prod).')
param environment string

@description('Project short name for CAF naming.')
param projectName string

@description('4-character unique suffix for globally unique names.')
param uniqueSuffix string

@description('Delegated subnet resource ID for PostgreSQL VNet injection (snet-data).')
param subnetDataId string

@description('Private DNS zone resource ID for PostgreSQL (privatelink.postgres.database.azure.com).')
param privateDnsZonePostgreSqlId string

@description('Resource ID of the user-assigned managed identity (for Entra admin).')
param identityId string

@description('Principal ID of the managed identity (for Entra auth config).')
param identityPrincipalId string

@description('Log Analytics workspace resource ID for diagnostic settings.')
param logAnalyticsWorkspaceId string

@description('PostgreSQL administrator login name (required by ARM even with Entra-only auth).')
param postgresAdminLogin string = 'pgadmin'

@description('PostgreSQL administrator login password (blocked from use when Entra-only auth is enabled).')
@secure()
param postgresAdminPassword string

@description('Resource tags applied to all resources in this module.')
param tags object

// ─────────────────────────────── Derived configuration ───────────────────────

// CAF naming: psql-{project}-{env}-{suffix}
var serverName = 'psql-${projectName}-${environment}-${uniqueSuffix}'

// AVM splits the tier prefix from the SKU compute name:
//   GP_Standard_D4s_v3 → tier: 'GeneralPurpose', skuName: 'Standard_D4s_v3'
//   GP_Standard_D2s_v3 → tier: 'GeneralPurpose', skuName: 'Standard_D2s_v3'
var skuComputeName = environment == 'prod' ? 'Standard_D4s_v3' : 'Standard_D2s_v3'

// Storage: prod → 256 GB, staging → 128 GB, dev → 32 GB
var storageSizeGB = environment == 'prod' ? 256 : (environment == 'staging' ? 128 : 32)

// Managed identity name (derived from standard naming convention — id-{project}-{env})
var identityDisplayName = 'id-${projectName}-${environment}'

// ────────────────────────── PostgreSQL Flexible Server ───────────────────────

module postgresql 'br/public:avm/res/db-for-postgre-sql/flexible-server:0.15.2' = {
  name: 'postgresql'
  params: {
    name: serverName
    location: location

    // AVM requires tier and skuName as separate params (not the combined 'GP_Standard_D4s_v3')
    tier: 'GeneralPurpose'
    skuName: skuComputeName
    storageSizeGB: storageSizeGB

    // Availability zone — required int param; 1 = primary zone (use -1 for auto)
    availabilityZone: 1

    // PostgreSQL version
    version: '16'

    // Admin credentials — password auth disabled via authConfig; Entra-only enforced
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword

    // Governance: postgresql-entra-only-auth (Deny) — disable password auth, enable Entra
    authConfig: {
      passwordAuth: 'Disabled'
      activeDirectoryAuth: 'Enabled'
      #disable-next-line use-safe-access  // tenant().tenantId is always non-null at runtime
      tenantId: tenant().tenantId
    }

    // Entra admin — set managed identity as the Entra administrator
    // objectId = principal ID of the service principal; principalType = ServicePrincipal
    administrators: [
      {
        objectId: identityPrincipalId
        principalName: identityDisplayName
        principalType: 'ServicePrincipal'
        #disable-next-line use-safe-access  // tenant().tenantId is always non-null at runtime
        tenantId: tenant().tenantId
      }
    ]

    // Managed identity attached to the server for Entra operations
    managedIdentities: {
      userAssignedResourceIds: [
        identityId
      ]
    }

    // Governance: postgresql-private-only (Deny) — VNet injection (flat params, not 'network' object)
    delegatedSubnetResourceId: subnetDataId
    privateDnsZoneArmResourceId: privateDnsZonePostgreSqlId
    publicNetworkAccess: 'Disabled'

    // High availability — string param: ZoneRedundant for prod, Disabled for dev/staging
    highAvailability: environment == 'prod' ? 'ZoneRedundant' : 'Disabled'
    highAvailabilityZone: 2  // standby replica in zone 2 (prod only — ignored when HA disabled)

    // Governance: postgresql-min-tls-12 (Deny) — TLS 1.2 via server configuration parameter
    configurations: [
      {
        name: 'ssl_min_protocol_version'
        value: 'TLSv1.2'
        source: 'user-override'
      }
    ]

    // Backup — flat params (not nested 'backup' object)
    backupRetentionDays: 35
    geoRedundantBackup: 'Disabled'  // EU Data Boundary — no cross-region replication

    // Diagnostics → Log Analytics (mandatory for governance visibility)
    diagnosticSettings: [
      {
        workspaceResourceId: logAnalyticsWorkspaceId
        logCategoriesAndGroups: [
          {
            categoryGroup: 'allLogs'
          }
        ]
        metricCategories: [
          {
            category: 'AllMetrics'
          }
        ]
      }
    ]

    // Governance: required-tags (Deny) — all 4 tags mandatory
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('PostgreSQL Flexible Server resource ID.')
output postgresqlServerId string = postgresql.outputs.resourceId

@description('PostgreSQL Flexible Server name.')
output postgresqlServerName string = postgresql.outputs.name

@description('PostgreSQL Flexible Server fully-qualified domain name.')
#disable-next-line use-safe-access  // fqdn can be null for servers without public access; ?? '' handles that
output postgresqlServerFqdn string = postgresql.outputs.fqdn ?? ''
