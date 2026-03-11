targetScope = 'resourceGroup'

// ──────────────────────────────────────────────
// Parameters
// ──────────────────────────────────────────────

@description('Project name — used in resource naming. No default; caller must provide.')
param projectName string

@description('Short project name for length-constrained resources (KV ≤24, Storage ≤24)')
@maxLength(6)
param shortProjectName string

@description('Application display name for tags')
param applicationName string

@allowed(['dev', 'prod'])
@description('Deployment environment')
param environment string

@description('Azure region for all resources')
param location string = 'swedencentral'

@description('Deployment phase: foundation, observability, security, data, compute, or all')
@allowed(['foundation', 'observability', 'security', 'data', 'compute', 'all'])
param phase string = 'all'

@description('Enable private endpoints (true for prod, false for dev)')
param enablePrivateEndpoints bool = true

@description('App Service Plan SKU object')
param appServicePlanSku object = {
  name: 'S1'
  capacity: 2
}

@description('SQL Database SKU object')
param sqlDatabaseSku object = {
  name: 'S0'
  tier: 'Standard'
}

@description('Entra ID admin group object ID for SQL Server')
param sqlAdminGroupObjectId string

@description('Entra ID admin group display name for SQL Server')
param sqlAdminGroupName string

@description('Budget amount in EUR for this resource group')
param budgetAmount int

@description('Budget contact email for notifications')
param budgetContactEmail string

@description('Technical contact email')
param technicalContact string

// ──────────────────────────────────────────────
// Tag parameters (governance-enforced, 9 policy + 2 best-practice)
// ──────────────────────────────────────────────

@description('Owner tag value (policy-enforced)')
param ownerTag string

@description('Cost center tag value (policy-enforced)')
param costcenterTag string

@description('Workload tag value (policy-enforced)')
param workloadTag string

@description('SLA tag value (policy-enforced)')
param slaTag string

@description('Backup policy tag value (policy-enforced)')
param backupPolicyTag string

@description('Maintenance window tag value (policy-enforced)')
param maintWindowTag string

// ──────────────────────────────────────────────
// Variables
// ──────────────────────────────────────────────

var uniqueSuffix = uniqueString(resourceGroup().id)

var tags = {
  environment: environment
  owner: ownerTag
  costcenter: costcenterTag
  application: applicationName
  workload: workloadTag
  sla: slaTag
  'backup-policy': backupPolicyTag
  'maint-window': maintWindowTag
  'technical-contact': technicalContact
  ManagedBy: 'Bicep'
  Project: projectName
}

// ──────────────────────────────────────────────
// Phase 1: Foundation
// ──────────────────────────────────────────────

module network 'modules/network.bicep' = if (phase == 'all' || phase == 'foundation') {
  name: 'network-${uniqueSuffix}'
  params: {
    projectName: projectName
    location: location
    tags: tags
    environment: environment
    enablePrivateEndpoints: enablePrivateEndpoints
  }
}

// ──────────────────────────────────────────────
// Phase 2: Observability
// ──────────────────────────────────────────────

module monitoring 'modules/monitoring.bicep' = if (phase == 'all' || phase == 'observability') {
  name: 'monitoring-${uniqueSuffix}'
  params: {
    projectName: projectName
    location: location
    tags: tags
    environment: environment
  }
}

// ──────────────────────────────────────────────
// Phase 3: Security + DNS
// ──────────────────────────────────────────────

module dns 'modules/dns.bicep' = if ((phase == 'all' || phase == 'security') && enablePrivateEndpoints) {
  name: 'dns-${uniqueSuffix}'
  params: {
    tags: tags
    location: 'global'
    vnetResourceId: network.outputs.vnetResourceId
  }
}

module keyvault 'modules/keyvault.bicep' = if (phase == 'all' || phase == 'security') {
  name: 'keyvault-${uniqueSuffix}'
  params: {
    shortProjectName: shortProjectName
    location: location
    tags: tags
    environment: environment
    uniqueSuffix: uniqueSuffix
    enablePrivateEndpoints: enablePrivateEndpoints
    peSubnetResourceId: enablePrivateEndpoints ? network.outputs.peSubnetResourceId : ''
    kvDnsZoneResourceId: enablePrivateEndpoints ? dns.outputs.kvDnsZoneResourceId : ''
    logAnalyticsWorkspaceName: monitoring.outputs.logAnalyticsWorkspaceName
  }
}

// ──────────────────────────────────────────────
// Phase 4: Data
// ──────────────────────────────────────────────

module sql 'modules/sql.bicep' = if (phase == 'all' || phase == 'data') {
  name: 'sql-${uniqueSuffix}'
  params: {
    projectName: projectName
    applicationName: applicationName
    location: location
    tags: tags
    environment: environment
    sqlDatabaseSku: sqlDatabaseSku
    sqlAdminGroupObjectId: sqlAdminGroupObjectId
    sqlAdminGroupName: sqlAdminGroupName
    enablePrivateEndpoints: enablePrivateEndpoints
    peSubnetResourceId: enablePrivateEndpoints ? network.outputs.peSubnetResourceId : ''
    sqlDnsZoneResourceId: enablePrivateEndpoints ? dns.outputs.sqlDnsZoneResourceId : ''
  }
}

module storage 'modules/storage.bicep' = if (phase == 'all' || phase == 'data') {
  name: 'storage-${uniqueSuffix}'
  params: {
    shortProjectName: shortProjectName
    location: location
    tags: tags
    environment: environment
    uniqueSuffix: uniqueSuffix
    enablePrivateEndpoints: enablePrivateEndpoints
    peSubnetResourceId: enablePrivateEndpoints ? network.outputs.peSubnetResourceId : ''
    blobDnsZoneResourceId: enablePrivateEndpoints ? dns.outputs.blobDnsZoneResourceId : ''
    logAnalyticsWorkspaceName: monitoring.outputs.logAnalyticsWorkspaceName
  }
}

// ──────────────────────────────────────────────
// Phase 5: Compute + Budget
// ──────────────────────────────────────────────

module compute 'modules/compute.bicep' = if (phase == 'all' || phase == 'compute') {
  name: 'compute-${uniqueSuffix}'
  params: {
    projectName: projectName
    location: location
    tags: tags
    environment: environment
    uniqueSuffix: uniqueSuffix
    appServicePlanSku: appServicePlanSku
    appSubnetResourceId: network.outputs.appSubnetResourceId
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    keyVaultUri: keyvault.outputs.keyVaultUri
    keyVaultResourceId: keyvault.outputs.keyVaultResourceId
    storageAccountResourceId: storage.outputs.storageAccountResourceId
    logAnalyticsWorkspaceName: monitoring.outputs.logAnalyticsWorkspaceName
  }
}

module budget 'modules/budget.bicep' = if (phase == 'all' || phase == 'compute') {
  name: 'budget-${uniqueSuffix}'
  params: {
    projectName: projectName
    environment: environment
    budgetAmount: budgetAmount
    budgetContactEmail: budgetContactEmail
    technicalContact: technicalContact
  }
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────

@description('Virtual Network resource ID')
output vnetResourceId string = (phase == 'all' || phase == 'foundation') ? network.outputs.vnetResourceId : ''

@description('Log Analytics workspace name')
output logAnalyticsWorkspaceName string = (phase == 'all' || phase == 'observability') ? monitoring.outputs.logAnalyticsWorkspaceName : ''

@description('Key Vault URI')
output keyVaultUri string = (phase == 'all' || phase == 'security') ? keyvault.outputs.keyVaultUri : ''

@description('SQL Server FQDN')
output sqlServerFqdn string = (phase == 'all' || phase == 'data') ? sql.outputs.sqlServerFqdn : ''

@description('Storage Account name')
output storageAccountName string = (phase == 'all' || phase == 'data') ? storage.outputs.storageAccountName : ''

@description('App Service default hostname')
output appServiceHostname string = (phase == 'all' || phase == 'compute') ? compute.outputs.appServiceHostname : ''

@description('App Service managed identity principal ID')
output appServicePrincipalId string = (phase == 'all' || phase == 'compute') ? compute.outputs.appServicePrincipalId : ''
