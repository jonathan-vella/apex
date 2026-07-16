targetScope = 'subscription'

@description('Short project identifier used in Azure resource names.')
param projectName string

@description('Qualification environment identifier.')
param environment string

@description('Azure region for all qualification resources.')
param location string

@description('Object ID of the dedicated GitHub OIDC service principal.')
param deploymentPrincipalId string

@description('Object ID of the local principal that uploads and retrieves encrypted handoff envelopes.')
param handoffUploaderPrincipalId string

@description('Live-policy tag contract applied to every resource group and resource.')
param tags object

var uniqueSuffix = take(uniqueString(subscription().id, projectName, environment), 6)
var controlResourceGroupName = 'rg-${projectName}-${environment}-control'
var bicepResourceGroupName = 'rg-${projectName}-${environment}-bicep'
var terraformResourceGroupName = 'rg-${projectName}-${environment}-terraform'
var logAnalyticsWorkspaceName = take('log-${projectName}-${environment}', 63)
var backendStorageAccountName = take(toLower('st${take(replace(projectName, '-', ''), 8)}tf${uniqueSuffix}'), 24)

module controlResourceGroup 'br/public:avm/res/resources/resource-group:0.4.3' = {
  name: 'control-resource-group'
  params: {
    name: controlResourceGroupName
    location: location
    tags: tags
    enableTelemetry: false
  }
}

module bicepResourceGroup 'br/public:avm/res/resources/resource-group:0.4.3' = {
  name: 'bicep-resource-group'
  params: {
    name: bicepResourceGroupName
    location: location
    tags: tags
    enableTelemetry: false
    roleAssignments: [
      {
        principalId: deploymentPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'b24988ac-6180-42a0-ab88-20f7382dd24c'
        description: 'Deploy the isolated Bicep qualification workload.'
      }
    ]
  }
}

module terraformResourceGroup 'br/public:avm/res/resources/resource-group:0.4.3' = {
  name: 'terraform-resource-group'
  params: {
    name: terraformResourceGroupName
    location: location
    tags: tags
    enableTelemetry: false
    roleAssignments: [
      {
        principalId: deploymentPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'b24988ac-6180-42a0-ab88-20f7382dd24c'
        description: 'Deploy the isolated Terraform qualification workload.'
      }
    ]
  }
}

module logAnalyticsWorkspace 'br/public:avm/res/operational-insights/workspace:0.15.1' = {
  name: 'qualification-observability'
  scope: resourceGroup(controlResourceGroupName)
  dependsOn: [
    controlResourceGroup
  ]
  params: {
    name: logAnalyticsWorkspaceName
    location: location
    tags: tags
    skuName: 'PerGB2018'
    dailyQuotaGb: '0.1'
    dataRetention: 30
    enableTelemetry: false
    forceCmkForQuery: false
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    features: {
      disableLocalAuth: true
      enableLogAccessUsingOnlyResourcePermissions: true
      immediatePurgeDataOn30Days: true
    }
    roleAssignments: [
      {
        principalId: deploymentPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: '73c42c96-874c-492b-b04d-ab87d138a893'
        description: 'Read qualification diagnostics without workspace mutation.'
      }
    ]
  }
}

module backendStorageAccount 'br/public:avm/res/storage/storage-account:0.32.1' = {
  name: 'terraform-backend'
  scope: resourceGroup(controlResourceGroupName)
  dependsOn: [
    controlResourceGroup
  ]
  params: {
    name: backendStorageAccountName
    location: location
    tags: tags
    kind: 'StorageV2'
    skuName: 'Standard_LRS'
    allowBlobPublicAccess: false
    allowCrossTenantReplication: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    requireInfrastructureEncryption: true
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      bypass: 'Logging, Metrics'
      defaultAction: 'Deny'
    }
    roleAssignments: [
      {
        principalId: deploymentPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: '17d1049b-9a84-46fb-8f53-869881c3d3ab'
        description: 'Add and remove the ephemeral qualification runner firewall rule.'
      }
      {
        principalId: handoffUploaderPrincipalId
        roleDefinitionIdOrName: '17d1049b-9a84-46fb-8f53-869881c3d3ab'
        description: 'Add and remove the local uploader ephemeral firewall rule.'
      }
    ]
    diagnosticSettings: [
      {
        name: 'diag-account'
        workspaceResourceId: logAnalyticsWorkspace.outputs.resourceId
        logAnalyticsDestinationType: 'Dedicated'
        metricCategories: [
          {
            category: 'AllMetrics'
          }
        ]
      }
    ]
    blobServices: {
      isVersioningEnabled: true
      deleteRetentionPolicyEnabled: true
      deleteRetentionPolicyDays: 7
      containerDeleteRetentionPolicyEnabled: true
      containerDeleteRetentionPolicyDays: 7
      diagnosticSettings: [
        {
          name: 'diag-blob'
          workspaceResourceId: logAnalyticsWorkspace.outputs.resourceId
          logAnalyticsDestinationType: 'Dedicated'
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
      containers: [
        {
          name: 'tfstate'
          publicAccess: 'None'
          roleAssignments: [
            {
              principalId: deploymentPrincipalId
              principalType: 'ServicePrincipal'
              roleDefinitionIdOrName: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
              description: 'Read, lock, and write Terraform qualification state.'
            }
          ]
        }
        {
          name: 'handoff'
          publicAccess: 'None'
          roleAssignments: [
            {
              principalId: deploymentPrincipalId
              principalType: 'ServicePrincipal'
              roleDefinitionIdOrName: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
              description: 'Exchange encrypted qualification authority envelopes.'
            }
            {
              principalId: handoffUploaderPrincipalId
              roleDefinitionIdOrName: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
              description: 'Upload and retrieve encrypted qualification handoff envelopes.'
            }
          ]
        }
      ]
    }
    enableTelemetry: false
  }
}

output bicepResourceGroupName string = bicepResourceGroup.outputs.name
output terraformResourceGroupName string = terraformResourceGroup.outputs.name
output controlResourceGroupName string = controlResourceGroup.outputs.name
output logAnalyticsWorkspaceResourceId string = logAnalyticsWorkspace.outputs.resourceId
output backendStorageAccountName string = backendStorageAccount.outputs.name
output backendContainerName string = 'tfstate'
output handoffContainerName string = 'handoff'
