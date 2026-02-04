// ============================================================================
// Agent Testing Framework - Main Orchestration Module
// ============================================================================
// Purpose: Deploy ephemeral test infrastructure for agent validation
// Generated: 2026-01-22
// Reference: agent-output/agent-testing/04-implementation-plan.md
// ============================================================================

targetScope = 'resourceGroup'

// ============================================================================
// Parameters
// ============================================================================

@description('Environment name (always test for this framework)')
@allowed(['test'])
param environment string = 'test'

@description('Azure region for resource deployment')
@allowed([
  'swedencentral'
  'germanywestcentral'
])
param location string = 'swedencentral'

@description('Project name used for resource naming')
param projectName string = 'agent-testing'

@description('Resource owner for tagging')
param owner string = 'platform-engineering'

@description('Test scenario name for resource group naming')
param scenarioName string = 'all'

@description('Deploy Scenario 1: Static Web App (smoke tests)')
param deployScenario1 bool = true

@description('Deploy Scenario 2: API + Database')
param deployScenario2 bool = true

@description('Deploy Scenario 3: Microservices')
param deployScenario3 bool = true

@description('Deploy cleanup automation (persistent infrastructure)')
param deployCleanupAutomation bool = true

@description('Entra ID administrator object ID for SQL Server')
param sqlEntraAdminObjectId string

@description('Entra ID administrator login (UPN or group name)')
param sqlEntraAdminLogin string

// ============================================================================
// Variables
// ============================================================================

// CAF naming: Generate unique suffix from resource group ID
var uniqueSuffix = uniqueString(resourceGroup().id)

// Region abbreviations for naming
var regionAbbreviations = {
  swedencentral: 'swc'
  germanywestcentral: 'gwc'
}
var regionAbbr = regionAbbreviations[location]

// Required tags for all resources (CAF + TTL for cleanup)
var tags = {
  Environment: environment
  ManagedBy: 'Bicep'
  Project: projectName
  Owner: owner
  TTL: '2h'
  Scenario: scenarioName
}

// ============================================================================
// Scenario 1: Static Web App (Smoke Tests)
// Note: SWA not available in swedencentral, deploying to westeurope
// ============================================================================

module staticWebApp 'modules/static-web-app.bicep' = if (deployScenario1) {
  name: 'staticWebApp-${uniqueSuffix}'
  params: {
    name: 'stapp-test-${projectName}-weu-${take(uniqueSuffix, 6)}'
    location: 'westeurope' // SWA only available in limited regions
    tags: tags
  }
}

// ============================================================================
// Scenario 2: API + Database
// ============================================================================

module appServicePlan 'modules/app-service-plan.bicep' = if (deployScenario2) {
  name: 'appServicePlan-${uniqueSuffix}'
  params: {
    name: 'plan-test-${projectName}-${regionAbbr}-${take(uniqueSuffix, 6)}'
    location: location
    tags: tags
    skuName: 'B1'
    skuCapacity: 1
  }
}

module appService 'modules/app-service.bicep' = if (deployScenario2) {
  name: 'appService-${uniqueSuffix}'
  params: {
    name: 'app-test-${projectName}-${regionAbbr}-${take(uniqueSuffix, 6)}'
    location: location
    tags: tags
    serverFarmResourceId: deployScenario2 ? appServicePlan!.outputs.resourceId : ''
    keyVaultName: deployScenario2 ? keyVaultScenario2!.outputs.name : ''
  }
}

module sqlServer 'modules/sql-database.bicep' = if (deployScenario2) {
  name: 'sqlServer-${uniqueSuffix}'
  params: {
    serverName: 'sql-test-${projectName}-${regionAbbr}-${take(uniqueSuffix, 6)}'
    location: location
    tags: tags
    databaseName: 'testdb'
    entraAdminObjectId: sqlEntraAdminObjectId
    entraAdminLogin: sqlEntraAdminLogin
    entraAdminPrincipalType: 'User'
    deployPrivateEndpoint: false // No VNet in test framework
  }
}

module keyVaultScenario2 'modules/key-vault.bicep' = if (deployScenario2) {
  name: 'keyVaultScenario2-${uniqueSuffix}'
  params: {
    name: 'kv-s2-${regionAbbr}-${take(uniqueSuffix, 8)}'
    location: location
    tags: tags
  }
}

// ============================================================================
// Scenario 3: Microservices
// ============================================================================

module containerAppsEnv 'modules/container-apps-env.bicep' = if (deployScenario3) {
  name: 'containerAppsEnv-${uniqueSuffix}'
  params: {
    name: 'cae-test-${projectName}-${regionAbbr}-${take(uniqueSuffix, 6)}'
    location: location
    tags: tags
  }
}

module serviceBus 'modules/service-bus.bicep' = if (deployScenario3) {
  name: 'serviceBus-${uniqueSuffix}'
  params: {
    name: 'sb-test-${projectName}-${regionAbbr}-${take(uniqueSuffix, 6)}'
    location: location
    tags: tags
  }
}

module storageAccount 'modules/storage-account.bicep' = if (deployScenario3) {
  name: 'storageAccount-${uniqueSuffix}'
  params: {
    name: 'sttest${take(replace(projectName, '-', ''), 6)}${take(uniqueSuffix, 8)}'
    location: location
    tags: tags
  }
}

module keyVaultScenario3 'modules/key-vault.bicep' = if (deployScenario3) {
  name: 'keyVaultScenario3-${uniqueSuffix}'
  params: {
    name: 'kv-s3-${regionAbbr}-${take(uniqueSuffix, 8)}'
    location: location
    tags: tags
  }
}

// ============================================================================
// Persistent Infrastructure: Cleanup Automation
// ============================================================================

module automationAccount 'modules/automation-cleanup.bicep' = if (deployCleanupAutomation) {
  name: 'automationAccount-${uniqueSuffix}'
  params: {
    name: 'aa-${projectName}-${regionAbbr}'
    location: location
    tags: union(tags, { TTL: 'persistent' })
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Static Web App default hostname (Scenario 1)')
output staticWebAppUrl string = deployScenario1 ? staticWebApp!.outputs.defaultHostname : ''

@description('App Service default hostname (Scenario 2)')
output appServiceUrl string = deployScenario2 ? appService!.outputs.defaultHostname : ''

@description('SQL Server fully qualified domain name (Scenario 2)')
output sqlServerFqdn string = deployScenario2 ? sqlServer!.outputs.fullyQualifiedDomainName : ''

@description('Key Vault URI for Scenario 2')
output keyVaultUriScenario2 string = deployScenario2 ? keyVaultScenario2!.outputs.uri : ''

@description('Container Apps Environment default domain (Scenario 3)')
output containerAppsEnvDomain string = deployScenario3 ? containerAppsEnv!.outputs.defaultDomain : ''

@description('Service Bus endpoint (Scenario 3)')
output serviceBusEndpoint string = deployScenario3 ? serviceBus!.outputs.serviceBusEndpoint : ''

@description('Storage Account blob endpoint (Scenario 3)')
output storageBlobEndpoint string = deployScenario3 ? storageAccount!.outputs.primaryBlobEndpoint : ''

@description('Key Vault URI for Scenario 3')
output keyVaultUriScenario3 string = deployScenario3 ? keyVaultScenario3!.outputs.uri : ''

@description('Automation Account resource ID')
output automationAccountId string = deployCleanupAutomation ? automationAccount!.outputs.resourceId : ''
