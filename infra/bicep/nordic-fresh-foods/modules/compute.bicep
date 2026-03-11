targetScope = 'resourceGroup'

// ──────────────────────────────────────────────
// Compute Module — App Service Plan + App Service + Autoscale + RBAC
// ──────────────────────────────────────────────

@description('Project name for resource naming')
param projectName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Deployment environment')
@allowed(['dev', 'prod'])
param environment string

@description('Unique suffix from main.bicep')
param uniqueSuffix string

@description('App Service Plan SKU object')
param appServicePlanSku object

@description('App subnet resource ID for VNet integration')
param appSubnetResourceId string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Key Vault URI')
param keyVaultUri string

@description('Key Vault resource ID for RBAC')
param keyVaultResourceId string

@description('Storage Account resource ID for RBAC')
param storageAccountResourceId string

@description('Log Analytics workspace name for diagnostics')
param logAnalyticsWorkspaceName string

// ──────────────────────────────────────────────
// Variables
// ──────────────────────────────────────────────

var aspName = 'asp-${projectName}-${environment}'
var appName = 'app-${projectName}-${environment}-${take(uniqueSuffix, 6)}'
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

// ──────────────────────────────────────────────
// Log Analytics (existing)
// ──────────────────────────────────────────────

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

// ──────────────────────────────────────────────
// App Service Plan (AVM)
// ──────────────────────────────────────────────

module appServicePlan 'br/public:avm/res/web/serverfarm:0.7.0' = {
  name: aspName
  params: {
    name: aspName
    location: location
    tags: tags
    kind: 'Linux'
    reserved: true
    skuName: appServicePlanSku.name
    skuCapacity: appServicePlanSku.capacity
  }
}

// ──────────────────────────────────────────────
// App Service (AVM)
// ──────────────────────────────────────────────

module appService 'br/public:avm/res/web/site:0.22.0' = {
  name: appName
  params: {
    name: appName
    location: location
    tags: tags
    kind: 'app,linux'
    serverFarmResourceId: appServicePlan.outputs.resourceId
    httpsOnly: true
    managedIdentities: {
      systemAssigned: true
    }
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      alwaysOn: environment == 'prod'
      vnetRouteAllEnabled: true
      http20Enabled: true
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'AZURE_KEY_VAULT_URI'
          value: keyVaultUri
        }
      ]
    }
    virtualNetworkSubnetResourceId: appSubnetResourceId
    diagnosticSettings: [
      {
        workspaceResourceId: workspace.id
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
  }
}

// ──────────────────────────────────────────────
// RBAC — App Service MI → Key Vault Secrets User
// ──────────────────────────────────────────────

resource keyVaultResource 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: last(split(keyVaultResourceId, '/'))!
}

resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultResource.id, appName, keyVaultSecretsUserRoleId)
  scope: keyVaultResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: appService.outputs.systemAssignedMIPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ──────────────────────────────────────────────
// RBAC — App Service MI → Storage Blob Data Contributor
// ──────────────────────────────────────────────

resource storageResource 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: last(split(storageAccountResourceId, '/'))!
}

resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageResource.id, appName, storageBlobDataContributorRoleId)
  scope: storageResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: appService.outputs.systemAssignedMIPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ──────────────────────────────────────────────
// Autoscale (prod only)
// ──────────────────────────────────────────────

resource autoscaleSettings 'Microsoft.Insights/autoscalesettings@2022-10-01' = if (environment == 'prod') {
  name: 'autoscale-${aspName}'
  location: location
  tags: tags
  properties: {
    targetResourceUri: appServicePlan.outputs.resourceId
    enabled: true
    profiles: [
      {
        name: 'default'
        capacity: {
          minimum: '2'
          maximum: '3'
          default: '2'
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.outputs.resourceId
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 70
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.outputs.resourceId
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: 30
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
        ]
      }
    ]
  }
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────

@description('App Service resource ID')
output appServiceResourceId string = appService.outputs.resourceId

@description('App Service default hostname')
output appServiceHostname string = appService.outputs.defaultHostname

@description('App Service managed identity principal ID')
output appServicePrincipalId string = appService.outputs.systemAssignedMIPrincipalId
