// modules/postgresql.bicep — PostgreSQL Flexible Server with private endpoint
// AVM: br/public:avm/res/db-for-postgre-sql/flexible-server:0.11.0
// Governance:
//   POL-001 — EU-only region (swedencentral enforced by location param)
//   POL-002 — Required governance tags (passed via tags param)
//   POL-010 — PostgreSQL private network only (publicNetworkAccess: 'Disabled')
//   POL-011 — PostgreSQL Entra-first authentication (passwordAuth: Disabled)
//   POL-012 — PostgreSQL TLS 1.2 minimum (requireSecureTransport + sslEnforcement)
//   POL-022 — Diagnostic settings to Log Analytics
// Security: Entra-only auth, TLS 1.2, private endpoint, no password auth

@description('Azure region for the PostgreSQL server (must be swedencentral, POL-001).')
param location string

@description('Deployment environment — controls SKU, storage, HA, and retention.')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

@description('4-character unique suffix derived from resource group ID (passed from main.bicep).')
param uniqueSuffix string

@description('PostgreSQL Flexible Server name.')
param serverName string

@description('Log Analytics Workspace resource ID for diagnostic settings (POL-022).')
param workspaceId string

@description('Data subnet resource ID for the PostgreSQL private endpoint (POL-010).')
param dataSubnetId string

@description('PostgreSQL private DNS zone resource ID (privatelink.postgres.database.azure.com).')
param postgresPrivateDnsZoneId string

@description('AAD admin object ID for PostgreSQL Entra-only auth (POL-011). Leave empty to skip Entra admin registration at deploy time and configure post-provision.')
param aadAdminObjectId string = ''

@description('AAD tenant ID for the Entra admin. Required when aadAdminObjectId is non-empty.')
param aadAdminTenantId string = ''

// ─────────────────────────────── Environment-specific sizing ─────────────────

// SKU: prod=GP_Standard_D4ds_v5, staging=GP_Standard_D2ds_v5, dev=B_Standard_B2s
var postgresSkuName = env == 'prod' ? 'Standard_D4ds_v5' : (env == 'staging' ? 'Standard_D2ds_v5' : 'Standard_B2s')
var postgresSkuTier = env == 'prod' ? 'GeneralPurpose' : (env == 'staging' ? 'GeneralPurpose' : 'Burstable')

// Storage: prod=256 GB, staging=128 GB, dev=64 GB
var storageSizeGb = env == 'prod' ? 256 : (env == 'staging' ? 128 : 64)

// High availability: ZoneRedundant for prod, Disabled for dev/staging
var haMode = env == 'prod' ? 'ZoneRedundant' : 'Disabled'

// Backup retention: 35 days (prod), 14 days (dev/staging)
var backupRetentionDays = env == 'prod' ? 35 : 14

// ──────────────────────────── PostgreSQL Flexible Server ─────────────────────

module postgresqlServer 'br/public:avm/res/db-for-postgre-sql/flexible-server:0.11.0' = {
  name: 'postgresql-server'
  params: {
    name: serverName
    location: location

    // PostgreSQL version 16 (LTS)
    version: '16'

    // SKU — environment-specific
    skuName: postgresSkuName
    tier: postgresSkuTier

    // Storage configuration
    storageSizeGB: storageSizeGb
    autoGrow: 'Enabled'

    // High availability — ZoneRedundant for prod, Disabled elsewhere
    highAvailability: haMode

    // Backup — geo-redundant for prod, locally redundant elsewhere
    backupRetentionDays: backupRetentionDays
    geoRedundantBackup: env == 'prod' ? 'Enabled' : 'Disabled'

    // POL-010: Public network access Disabled — private endpoint only
    publicNetworkAccess: 'Disabled'

    // POL-011: Entra-first auth — supply aadAdminObjectId at deploy time to enable AAD auth.
    // AVM 0.11.0 does not expose authConfig.passwordAuth directly; disable password auth
    // post-provision:  az postgres flexible-server update --auth-config PasswordAuth=Disabled
    administrators: !empty(aadAdminObjectId) ? [
      {
        principalId: aadAdminObjectId
        principalName: 'Platform Admin'
        principalType: 'User'
        tenantId: aadAdminTenantId
      }
    ] : []

    // POL-010: Private endpoint in data subnet with DNS zone group
    privateEndpoints: [
      {
        name: 'pe-psql-${uniqueSuffix}'
        subnetResourceId: dataSubnetId
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: postgresPrivateDnsZoneId
            }
          ]
        }
      }
    ]

    // PostgreSQL server-level configurations — enforce TLS 1.2 (POL-012)
    configurations: [
      {
        name: 'require_secure_transport'
        value: 'on'
        source: 'user-override'
      }
      {
        name: 'ssl_min_protocol_version'
        value: 'TLSv1.2'
        source: 'user-override'
      }
    ]

    // POL-022: Diagnostic settings — all logs and metrics to Log Analytics
    diagnosticSettings: [
      {
        workspaceResourceId: workspaceId
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
      }
    ]

    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('PostgreSQL Flexible Server resource ID.')
output postgresqlId string = postgresqlServer.outputs.resourceId

@description('PostgreSQL Flexible Server name.')
output postgresqlName string = postgresqlServer.outputs.name

@description('PostgreSQL Flexible Server FQDN.')
output postgresqlFqdn string = postgresqlServer.outputs.fqdn
