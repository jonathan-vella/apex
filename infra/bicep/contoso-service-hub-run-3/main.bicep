@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment for naming, sizing, and tags.')
param environmentName string

@allowed([
  'foundation'
  'data'
  'edge'
  'platform'
  'all'
])
@description('Deployment phase selector for phased deployments across foundation, data, edge, and platform resources.')
param deploymentPhase string = 'foundation'

@allowed([
  'swedencentral'
])
@description('Azure region for all regional foundation resources.')
param location string = 'swedencentral'

@description('Project identifier used for resource naming. For this E2E run, use contoso-service-hub-run-3.')
param projectName string

@description('Project tag value required by the baseline tagging convention.')
param projectTagValue string

@description('Owner tag value required by the baseline tagging convention.')
param owner string

@description('Additional governance tags discovered from policy analysis. Governance keys win when they overlap baseline keys.')
param governanceTags object = {}

@description('Monthly budget amount for the resource-group scope budget.')
param budgetAmount int

@description('Email recipients for budget notifications.')
param budgetContactEmails array

var uniqueSuffix = uniqueString(resourceGroup().id)
var suffix6 = take(uniqueSuffix, 6)
var normalizedProjectName = toLower(replace(projectName, '-', ''))
var shortProjectName = take(normalizedProjectName, 10)
var environmentCode = take(environmentName, 3)

var baselineTags = {
  Environment: environmentName
  ManagedBy: 'Bicep'
  Project: projectTagValue
  Owner: owner
}

var tags = union(baselineTags, governanceTags)

var deployFoundation = deploymentPhase == 'foundation' || deploymentPhase == 'all'
var deployData = deploymentPhase == 'data' || deploymentPhase == 'all'
var deployEdge = deploymentPhase == 'edge' || deploymentPhase == 'all'
var deployPlatform = deploymentPhase == 'platform' || deploymentPhase == 'all'

var logAnalyticsWorkspaceName = take('law-${shortProjectName}-${environmentName}-${suffix6}', 63)
var appInsightsName = take('appi-${shortProjectName}-${environmentName}-${suffix6}', 260)
var keyVaultName = take('kv-${take(shortProjectName, 8)}-${environmentCode}-${suffix6}', 24)
var vnetName = take('vnet-${projectName}-${environmentName}', 64)
var budgetName = take('budget-${projectName}-${environmentName}', 63)
var keyVaultPrivateDnsZoneId = resourceId('Microsoft.Network/privateDnsZones', 'privatelink.vaultcore.azure.net')
var postgresqlName = take('psql-${take(shortProjectName, 8)}-${environmentCode}-${suffix6}', 63)
var redisName = take('redis-${projectName}-${environmentName}-${suffix6}', 63)
var storageAccountName = take('st${take(shortProjectName, 8)}${environmentCode}${suffix6}', 24)
var apimName = take('apim-${shortProjectName}-${environmentName}-${suffix6}', 50)
var frontDoorProfileName = take('afd-${shortProjectName}-${environmentName}-${suffix6}', 260)
var frontDoorEndpointName = take('ep-api-${shortProjectName}-${environmentName}-${suffix6}', 50)
var frontDoorOriginGroupName = 'og-apim'
var frontDoorOriginName = 'origin-apim'
var frontDoorRouteName = 'rt-api'
var frontDoorSecurityPolicyName = 'sp-waf'
var frontDoorWafPolicyName = take('waf-${shortProjectName}-${environmentCode}-${suffix6}', 128)
var identityName = take('id-${shortProjectName}-${environmentName}-${suffix6}', 128)
var acrName = take('acr${take(shortProjectName, 10)}${environmentCode}${suffix6}', 50)
var aksName = take('aks-${projectName}-${environmentName}-${suffix6}', 63)
var vmName = take('vm-${projectName}-${environmentName}-${suffix6}', 64)

var foundationSubnetIds = deployFoundation
  ? (networking.?outputs.?subnetIds ?? {
      aks: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'snet-aks-${environmentName}')
      apim: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'snet-apim-${environmentName}')
      pe: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'snet-pe-${environmentName}')
      data: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'snet-data-${environmentName}')
      vm: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'snet-vm-${environmentName}')
    })
  : {
      aks: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'snet-aks-${environmentName}')
      apim: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'snet-apim-${environmentName}')
      pe: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'snet-pe-${environmentName}')
      data: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'snet-data-${environmentName}')
      vm: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'snet-vm-${environmentName}')
    }

var foundationLogAnalyticsWorkspaceId = deployFoundation
  ? (monitoring.?outputs.?logAnalyticsWorkspaceId ?? resourceId('Microsoft.OperationalInsights/workspaces', logAnalyticsWorkspaceName))
  : resourceId('Microsoft.OperationalInsights/workspaces', logAnalyticsWorkspaceName)

var foundationAppInsightsId = deployFoundation
  ? (monitoring.?outputs.?appInsightsId ?? resourceId('Microsoft.Insights/components', appInsightsName))
  : resourceId('Microsoft.Insights/components', appInsightsName)

var foundationVirtualNetworkId = deployFoundation
  ? (networking.?outputs.?vnetId ?? resourceId('Microsoft.Network/virtualNetworks', vnetName))
  : resourceId('Microsoft.Network/virtualNetworks', vnetName)

var foundationKeyVaultId = deployFoundation
  ? (keyVault.?outputs.?keyVaultId ?? resourceId('Microsoft.KeyVault/vaults', keyVaultName))
  : resourceId('Microsoft.KeyVault/vaults', keyVaultName)

module monitoring 'modules/monitoring.bicep' = if (deployFoundation) {
  params: {
    appInsightsName: appInsightsName
    environmentName: environmentName
    location: location
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    tags: tags
  }
}

module networking 'modules/networking.bicep' = if (deployFoundation) {
  params: {
    environmentName: environmentName
    location: location
    logAnalyticsWorkspaceResourceId: monitoring.?outputs.?logAnalyticsWorkspaceId ?? ''
    tags: tags
    vnetName: vnetName
  }
}

module keyVault 'modules/keyvault.bicep' = if (deployFoundation) {
  params: {
    environmentName: environmentName
    keyVaultName: keyVaultName
    keyVaultPrivateDnsZoneResourceId: keyVaultPrivateDnsZoneId
    location: location
    logAnalyticsWorkspaceResourceId: monitoring.?outputs.?logAnalyticsWorkspaceId ?? ''
    privateEndpointSubnetResourceId: networking.?outputs.?subnetIds.?pe ?? ''
    tags: tags
  }
}

module budget 'modules/budget.bicep' = if (deployFoundation) {
  params: {
    budgetAmount: budgetAmount
    budgetContactEmails: budgetContactEmails
    budgetName: budgetName
  }
}

module postgresql 'modules/postgresql.bicep' = if (deployData) {
  params: {
    delegatedSubnetResourceId: foundationSubnetIds.data
    environmentName: environmentName
    location: location
    logAnalyticsWorkspaceResourceId: foundationLogAnalyticsWorkspaceId
    postgresqlName: postgresqlName
    tags: tags
    virtualNetworkResourceId: foundationVirtualNetworkId
  }
}

module redis 'modules/redis.bicep' = if (deployData) {
  params: {
    environmentName: environmentName
    location: location
    logAnalyticsWorkspaceResourceId: foundationLogAnalyticsWorkspaceId
    privateEndpointSubnetResourceId: foundationSubnetIds.pe
    redisName: redisName
    tags: tags
    virtualNetworkResourceId: foundationVirtualNetworkId
  }
}

module storage 'modules/storage.bicep' = if (deployData) {
  params: {
    environmentName: environmentName
    keyVaultResourceId: foundationKeyVaultId
    location: location
    logAnalyticsWorkspaceResourceId: foundationLogAnalyticsWorkspaceId
    privateEndpointSubnetResourceId: foundationSubnetIds.pe
    storageAccountName: storageAccountName
    tags: tags
    virtualNetworkResourceId: foundationVirtualNetworkId
  }
}

module apim 'modules/apim.bicep' = if (deployEdge) {
  params: {
    apimName: apimName
    apimSubnetResourceId: foundationSubnetIds.apim
    applicationInsightsResourceId: foundationAppInsightsId
    keyVaultResourceId: foundationKeyVaultId
    location: location
    logAnalyticsWorkspaceResourceId: foundationLogAnalyticsWorkspaceId
    publisherEmail: first(budgetContactEmails)
    publisherName: projectTagValue
    tags: tags
  }
}

module frontDoor 'modules/frontdoor.bicep' = if (deployEdge) {
  params: {
    apiHostname: apim.?outputs.?apimGatewayHostName ?? '${apimName}.azure-api.net'
    apiManagementResourceId: apim.?outputs.?apimId ?? resourceId('Microsoft.ApiManagement/service', apimName)
    endpointName: frontDoorEndpointName
    healthProbePath: '/status-0123456789abcdef'
    logAnalyticsWorkspaceResourceId: foundationLogAnalyticsWorkspaceId
    originGroupName: frontDoorOriginGroupName
    originName: frontDoorOriginName
    profileName: frontDoorProfileName
    resourceLocation: location
    routeName: frontDoorRouteName
    securityPolicyName: frontDoorSecurityPolicyName
    tags: tags
    wafPolicyName: frontDoorWafPolicyName
  }
}

module identity 'modules/identity.bicep' = if (deployEdge) {
  params: {
    identityName: identityName
    keyVaultResourceId: foundationKeyVaultId
    location: location
    tags: tags
  }
}

module acr 'modules/acr.bicep' = if (deployPlatform) {
  params: {
    acrName: acrName
    environmentName: environmentName
    location: location
    tags: tags
  }
}

module aks 'modules/aks.bicep' = if (deployPlatform) {
  params: {
    acrLoginServer: acr.?outputs.?acrLoginServer ?? '${acrName}.azurecr.io'
    acrResourceId: acr.?outputs.?acrId ?? resourceId('Microsoft.ContainerRegistry/registries', acrName)
    aksName: aksName
    aksSubnetResourceId: foundationSubnetIds.aks
    environmentName: environmentName
    keyVaultResourceId: foundationKeyVaultId
    location: location
    logAnalyticsWorkspaceResourceId: foundationLogAnalyticsWorkspaceId
    tags: tags
  }
}

module vm 'modules/vm.bicep' = if (deployPlatform) {
  params: {
    environmentName: environmentName
    keyVaultResourceId: foundationKeyVaultId
    location: location
    tags: tags
    vmName: vmName
    vmSubnetResourceId: foundationSubnetIds.vm
  }
}

@description('The unique suffix generated once for this resource group and reused across foundation modules.')
output uniqueSuffixValue string = uniqueSuffix

@description('The effective tag set applied to the generated foundation resources.')
output effectiveTags object = tags

@description('Log Analytics workspace resource ID when foundation deployment is selected.')
output logAnalyticsWorkspaceId string = deployFoundation ? (monitoring.?outputs.?logAnalyticsWorkspaceId ?? '') : ''

@description('Application Insights connection string when foundation deployment is selected.')
output applicationInsightsConnectionString string = deployFoundation ? (monitoring.?outputs.?appInsightsConnectionString ?? '') : ''

@description('Virtual network resource ID when foundation deployment is selected.')
output virtualNetworkId string = deployFoundation ? (networking.?outputs.?vnetId ?? '') : ''

@description('Key Vault URI when foundation deployment is selected.')
output keyVaultUri string = deployFoundation ? (keyVault.?outputs.?keyVaultUri ?? '') : ''

@description('PostgreSQL Flexible Server resource ID when the data phase is selected.')
output postgresqlId string = deployData ? (postgresql.?outputs.?postgresqlId ?? '') : ''

@description('Redis resource ID when the data phase is selected.')
output redisId string = deployData ? (redis.?outputs.?redisId ?? '') : ''

@description('Storage account resource ID when the data phase is selected.')
output storageAccountId string = deployData ? (storage.?outputs.?storageAccountId ?? '') : ''

@description('API Management resource ID when the edge phase is selected.')
output apimId string = deployEdge ? (apim.?outputs.?apimId ?? '') : ''

@description('Azure Front Door endpoint host name when the edge phase is selected.')
output frontDoorEndpointHostName string = deployEdge ? (frontDoor.?outputs.?frontDoorEndpointHostName ?? '') : ''

@description('Placeholder managed identity resource ID for Entra External ID integration when the edge phase is selected.')
output identityId string = deployEdge ? (identity.?outputs.?workloadIdentityId ?? '') : ''

@description('Azure Container Registry login server when the platform phase is selected.')
output acrLoginServer string = deployPlatform ? (acr.?outputs.?acrLoginServer ?? '') : ''

@description('AKS cluster resource ID when the platform phase is selected.')
output aksId string = deployPlatform ? (aks.?outputs.?aksResourceId ?? '') : ''

@description('AKS control plane FQDN when the platform phase is selected.')
output aksFqdn string = deployPlatform ? (aks.?outputs.?aksFqdn ?? '') : ''

@description('Virtual machine resource ID when the platform phase is selected.')
output vmId string = deployPlatform ? (vm.?outputs.?vmId ?? '') : ''
