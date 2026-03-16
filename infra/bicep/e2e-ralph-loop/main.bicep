targetScope = 'resourceGroup'

@description('Project name used in resource naming. No default to preserve repeatability.')
param projectName string

@description('Short project name used for length-constrained resources such as Key Vault and Storage Account.')
@maxLength(8)
param shortProjectName string

@description('Application name used for application-facing resource names such as the SQL database.')
param applicationName string

@allowed([
  'dev'
  'prod'
])
@description('Deployment environment.')
param environment string

@allowed([
  'swedencentral'
  'germanywestcentral'
])
@description('Azure region for all regional resources.')
param location string = 'swedencentral'

@allowed([
  'foundation'
  'data'
  'compute'
  'all'
])
@description('Deployment phase selector. Use foundation, data, compute, or all.')
param phase string = 'all'

@description('App Service Plan SKU configuration.')
param appServicePlanSku object = {
  name: 'B1'
  capacity: 1
}

@description('SQL Database SKU configuration.')
param sqlDatabaseSku object = {
  name: 'Basic'
  tier: 'Basic'
}

@description('Microsoft Entra administrator display name for the Azure SQL Server.')
param sqlAdminPrincipalName string

@description('Microsoft Entra administrator object ID for the Azure SQL Server.')
param sqlAdminObjectId string

@allowed([
  'Application'
  'Group'
  'User'
])
@description('Microsoft Entra principal type for the SQL administrator.')
param sqlAdminPrincipalType string = 'Group'

@minValue(1)
@description('Monthly budget amount in EUR.')
param budgetAmount int

@description('Email addresses that receive budget notifications.')
param budgetAlertEmails array

@description('Technical contact email used for escalation notifications.')
param technicalContactEmail string

@description('Owner tag value required by governance policy.')
param ownerTag string

@description('ManagedBy tag value required by governance policy.')
param managedByTag string = 'Bicep'

var uniqueSuffix = uniqueString(resourceGroup().id)
var suffix6 = take(uniqueSuffix, 6)
var logAnalyticsWorkspaceName = 'log-${projectName}-${environment}'
var appInsightsName = 'appi-${projectName}-${environment}'
var keyVaultName = take('kv-${shortProjectName}-${environment}-${suffix6}', 24)
var sqlServerName = 'sql-${projectName}-${environment}-${suffix6}'
var sqlDatabaseName = 'sqldb-${applicationName}-${environment}'
var storageAccountName = take('st${shortProjectName}${environment}${suffix6}', 24)
var appServicePlanName = take('asp-${projectName}-${environment}', 40)
var appServiceName = take('app-${projectName}-${environment}-${suffix6}', 60)
var tags = {
  Environment: environment
  ManagedBy: managedByTag
  Project: projectName
  Owner: ownerTag
}

module monitoring 'modules/monitoring.bicep' = if (phase == 'all' || phase == 'foundation') {
  params: {
    appInsightsName: appInsightsName
    environment: environment
    location: location
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    tags: tags
  }
}

module keyVault 'modules/keyvault.bicep' = if (phase == 'all' || phase == 'foundation') {
  params: {
    keyVaultName: keyVaultName
    location: location
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    tags: tags
  }
}

module budget 'modules/budget.bicep' = if (phase == 'all' || phase == 'foundation') {
  params: {
    budgetAlertEmails: budgetAlertEmails
    budgetAmount: budgetAmount
    environment: environment
    projectName: projectName
    technicalContactEmail: technicalContactEmail
  }
}

module sql 'modules/sql.bicep' = if (phase == 'all' || phase == 'data') {
  params: {
    location: location
    sqlAdminObjectId: sqlAdminObjectId
    sqlAdminPrincipalName: sqlAdminPrincipalName
    sqlAdminPrincipalType: sqlAdminPrincipalType
    sqlDatabaseName: sqlDatabaseName
    sqlDatabaseSku: sqlDatabaseSku
    sqlServerName: sqlServerName
    tags: tags
  }
}

module storage 'modules/storage.bicep' = if (phase == 'all' || phase == 'data') {
  params: {
    location: location
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    storageAccountName: storageAccountName
    tags: tags
  }
}

module compute 'modules/compute.bicep' = if (phase == 'all' || phase == 'compute') {
  params: {
    appInsightsName: appInsightsName
    appServiceName: appServiceName
    appServicePlanName: appServicePlanName
    appServicePlanSku: appServicePlanSku
    environment: environment
    keyVaultName: keyVaultName
    location: location
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    sqlDatabaseName: sqlDatabaseName
    sqlServerName: sqlServerName
    storageAccountName: storageAccountName
    tags: tags
  }
}

@description('Unique suffix generated from the resource group ID.')
output uniqueSuffix string = suffix6

@description('Deployment tags applied to resources.')
output deploymentTags object = tags

@description('Log Analytics workspace name for this deployment.')
output logAnalyticsWorkspaceName string = logAnalyticsWorkspaceName

@description('Key Vault name for this deployment.')
output keyVaultName string = keyVaultName

@description('SQL Server name for this deployment.')
output sqlServerName string = sqlServerName

@description('Storage Account name for this deployment.')
output storageAccountName string = storageAccountName

@description('App Service name for this deployment.')
output appServiceName string = appServiceName
