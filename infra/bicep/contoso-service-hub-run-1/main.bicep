targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment.')
param environment string

@allowed([
  'swedencentral'
  'westeurope'
  'germanywestcentral'
])
@description('Azure region for Contoso Service Hub resources.')
param location string = 'swedencentral'

@allowed([
  0
  1
  2
  3
  4
])
@description('Deployment phase selector. 0 deploys all implemented phases, 1 deploys foundation.')
param deployPhase int

@description('Additional resource tags merged with required governance and baseline tags.')
param tags object = {}

@description('Publisher name used by API Management.')
param publisherName string = 'Contoso Platform Engineering'

@description('Publisher email used by API Management.')
param publisherEmail string = 'platform-engineering@contoso.local'

@description('Optional Azure Front Door custom domain host name.')
param frontDoorCustomDomainHostName string = ''

@description('SSH public key for the management VM Linux admin account. Provide a value before deployment.')
param managementVmAdminPublicKey string = ''

var projectName = 'contoso-service-hub'
var shortProjectName = 'contoso'
var uniqueSuffix = uniqueString(resourceGroup().id)
var suffix6 = take(uniqueSuffix, 6)
var deployFoundation = deployPhase == 0 || deployPhase >= 1
var deployData = deployPhase == 0 || deployPhase >= 2
var deployEdge = deployPhase == 0 || deployPhase >= 3
var deployPlatform = deployPhase == 0 || deployPhase >= 4

var governanceDefaultTags = {
  environment: environment
  owner: 'Platform-Engineering'
  costcenter: 'platform-engineering'
  application: projectName
  workload: 'service-hub'
  sla: environment == 'prod' ? '99.9' : '99.5'
  'backup-policy': environment == 'prod' ? 'daily-35d' : 'daily-7d'
  'maint-window': 'Sun-02:00-04:00-CET'
  'technical-contact': 'platform-engineering@contoso.local'
  'tech-contact': 'platform-engineering@contoso.local'
}

var baselineTags = {
  Environment: environment
  ManagedBy: 'Bicep'
  Project: projectName
  Owner: 'Platform-Engineering'
}

var effectiveTags = union(governanceDefaultTags, tags, baselineTags)

var logAnalyticsWorkspaceName = 'log-${projectName}-${environment}'
var applicationInsightsName = 'appi-${projectName}-${environment}'
var keyVaultName = take('kv-${shortProjectName}-${environment}-${suffix6}', 24)
var postgresqlName = take('psql-${shortProjectName}-${environment}-${suffix6}', 63)
var redisName = take('redis-${shortProjectName}-${environment}-${suffix6}', 63)
var blobStorageAccountName = take('st${shortProjectName}${environment}${suffix6}b', 24)
var fileStorageAccountName = take('st${shortProjectName}${environment}${suffix6}f', 24)
var apimName = take('apim-${projectName}-${environment}', 50)
var frontDoorProfileName = 'afd-${projectName}-${environment}'
var frontDoorEndpointName = take('afd-${shortProjectName}-${environment}-${suffix6}', 50)
var workloadIdentityName = take('uami-${shortProjectName}-${environment}-aks', 128)
var aksClusterName = take('aks-${projectName}-${environment}', 63)
var managementVmName = take('vm-${shortProjectName}-${environment}-mgmt', 64)

module monitoring 'modules/monitoring.bicep' = if (deployFoundation) {
  params: {
    applicationInsightsName: applicationInsightsName
    environment: environment
    location: location
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    tags: effectiveTags
  }
}

module networking 'modules/networking.bicep' = if (deployFoundation) {
  params: {
    environment: environment
    location: location
    projectName: projectName
    tags: effectiveTags
  }
}

module keyVault 'modules/keyvault.bicep' = if (deployFoundation) {
  params: {
    keyVaultName: keyVaultName
    keyVaultPrivateDnsZoneResourceId: networking.?outputs.?privateDnsZoneIds.?keyVault ?? ''
    location: location
    logAnalyticsWorkspaceResourceId: monitoring.?outputs.?logAnalyticsWorkspaceId ?? ''
    privateEndpointSubnetResourceId: networking.?outputs.?subnetIds.?data ?? ''
    tags: effectiveTags
  }
}

module budget 'modules/budget.bicep' = if (deployFoundation) {
  params: {
    environment: environment
    projectName: projectName
    tags: effectiveTags
  }
}

module postgresql 'modules/postgresql.bicep' = if (deployData) {
  params: {
    environment: environment
    location: location
    logAnalyticsWorkspaceResourceId: monitoring.?outputs.?logAnalyticsWorkspaceId ?? ''
    postgresqlName: postgresqlName
    postgresqlPrivateDnsZoneResourceId: networking.?outputs.?privateDnsZoneIds.?postgresql ?? ''
    privateEndpointSubnetResourceId: networking.?outputs.?subnetIds.?data ?? ''
    tags: effectiveTags
  }
}

module redis 'modules/redis.bicep' = if (deployData) {
  params: {
    environment: environment
    location: location
    logAnalyticsWorkspaceResourceId: monitoring.?outputs.?logAnalyticsWorkspaceId ?? ''
    privateEndpointSubnetResourceId: networking.?outputs.?subnetIds.?data ?? ''
    redisName: redisName
    redisPrivateDnsZoneResourceId: networking.?outputs.?privateDnsZoneIds.?redis ?? ''
    tags: effectiveTags
  }
}

module storage 'modules/storage.bicep' = if (deployData) {
  params: {
    blobPrivateDnsZoneResourceId: networking.?outputs.?privateDnsZoneIds.?storage ?? ''
    blobStorageAccountName: blobStorageAccountName
    environment: environment
    fileStorageAccountName: fileStorageAccountName
    keyVaultResourceId: keyVault.?outputs.?keyVaultId ?? ''
    location: location
    logAnalyticsWorkspaceResourceId: monitoring.?outputs.?logAnalyticsWorkspaceId ?? ''
    privateEndpointSubnetResourceId: networking.?outputs.?subnetIds.?data ?? ''
    projectName: shortProjectName
    tags: effectiveTags
    virtualNetworkResourceId: networking.?outputs.?vnetId ?? ''
  }
}

module apim 'modules/apim.bicep' = if (deployEdge) {
  params: {
    apimName: apimName
    apimSubnetResourceId: networking.?outputs.?subnetIds.?management ?? ''
    applicationInsightsResourceId: monitoring.?outputs.?applicationInsightsId ?? ''
    environment: environment
    location: location
    logAnalyticsWorkspaceResourceId: monitoring.?outputs.?logAnalyticsWorkspaceId ?? ''
    privateEndpointSubnetResourceId: networking.?outputs.?subnetIds.?data ?? ''
    publisherEmail: publisherEmail
    publisherName: publisherName
    tags: effectiveTags
  }
}

module waf 'modules/waf.bicep' = if (deployEdge) {
  params: {
    apimGatewayHostName: apim.?outputs.?apimGatewayHostName ?? ''
    customDomainHostName: frontDoorCustomDomainHostName
    frontDoorEndpointName: frontDoorEndpointName
    frontDoorProfileName: frontDoorProfileName
    location: location
    logAnalyticsWorkspaceResourceId: monitoring.?outputs.?logAnalyticsWorkspaceId ?? ''
    tags: effectiveTags
  }
}

module identity 'modules/identity.bicep' = if (deployEdge) {
  params: {
    apimPrincipalId: apim.?outputs.?apimPrincipalId ?? ''
    blobStorageAccountName: storage.?outputs.?blobStorageName ?? ''
    keyVaultName: keyVault.?outputs.?keyVaultNameOut ?? ''
    location: location
    redisName: redis.?outputs.?redisNameOut ?? ''
    tags: effectiveTags
    workloadIdentityName: workloadIdentityName
  }
}

module aks 'modules/aks.bicep' = if (deployPlatform) {
  params: {
    aksClusterName: aksClusterName
    aksSystemSubnetResourceId: networking.?outputs.?subnetIds.?aksSystem ?? ''
    aksUserSubnetResourceId: networking.?outputs.?subnetIds.?aksUser ?? ''
    environment: environment
    location: location
    logAnalyticsWorkspaceResourceId: monitoring.?outputs.?logAnalyticsWorkspaceId ?? ''
    tags: effectiveTags
  }
  dependsOn: [
    identity
  ]
}

module vm 'modules/vm.bicep' = if (deployPlatform) {
  params: {
    adminSshPublicKey: managementVmAdminPublicKey
    environment: environment
    location: location
    logAnalyticsWorkspaceResourceId: monitoring.?outputs.?logAnalyticsWorkspaceId ?? ''
    subnetResourceId: networking.?outputs.?subnetIds.?management ?? ''
    tags: effectiveTags
    vmName: managementVmName
  }
}

@description('The unique suffix generated once for the deployment scope.')
output uniqueSuffixValue string = uniqueSuffix

@description('The Log Analytics workspace resource ID when foundation resources are deployed.')
output logAnalyticsWorkspaceId string = deployFoundation ? monitoring.?outputs.?logAnalyticsWorkspaceId ?? '' : ''

@description('The virtual network resource ID when foundation resources are deployed.')
output virtualNetworkId string = deployFoundation ? networking.?outputs.?vnetId ?? '' : ''

@description('The Key Vault resource ID when foundation resources are deployed.')
output keyVaultId string = deployFoundation ? keyVault.?outputs.?keyVaultId ?? '' : ''

@description('The budget resource ID when foundation resources are deployed.')
output budgetId string = deployFoundation ? budget.?outputs.?budgetId ?? '' : ''

@description('The PostgreSQL Flexible Server resource ID when data resources are deployed.')
output postgresqlId string = deployData ? postgresql.?outputs.?postgresqlId ?? '' : ''

@description('The Azure Managed Redis resource ID when data resources are deployed.')
output redisId string = deployData ? redis.?outputs.?redisId ?? '' : ''

@description('The blob storage account resource ID when data resources are deployed.')
output blobStorageId string = deployData ? storage.?outputs.?blobStorageId ?? '' : ''

@description('The Azure Files storage account resource ID when data resources are deployed.')
output fileStorageId string = deployData ? storage.?outputs.?fileStorageId ?? '' : ''

@description('The API Management resource ID when edge resources are deployed.')
output apimId string = deployEdge ? apim.?outputs.?apimId ?? '' : ''

@description('The API Management gateway URL when edge resources are deployed.')
output apimGatewayUrl string = deployEdge ? apim.?outputs.?apimGatewayUrl ?? '' : ''

@description('The Azure Front Door profile resource ID when edge resources are deployed.')
output frontDoorId string = deployEdge ? waf.?outputs.?frontDoorId ?? '' : ''

@description('The Azure Front Door endpoint URL when edge resources are deployed.')
output frontDoorEndpoint string = deployEdge ? waf.?outputs.?frontDoorEndpoint ?? '' : ''

@description('The AKS workload identity resource ID when edge resources are deployed.')
output workloadIdentityId string = deployEdge ? identity.?outputs.?workloadIdentityId ?? '' : ''

@description('The AKS cluster resource ID when platform resources are deployed.')
output aksId string = deployPlatform ? aks.?outputs.?resourceId ?? '' : ''

@description('The AKS cluster name when platform resources are deployed.')
output aksName string = deployPlatform ? aks.?outputs.?name ?? '' : ''

@description('The AKS control plane FQDN when platform resources are deployed.')
output aksControlPlaneFqdn string = deployPlatform ? aks.?outputs.?controlPlaneFqdn ?? '' : ''

@description('The AKS OIDC issuer URL when platform resources are deployed.')
output aksOidcIssuerUrl string = deployPlatform ? aks.?outputs.?oidcIssuerUrl ?? '' : ''

@description('The management VM resource ID when platform resources are deployed.')
output managementVmId string = deployPlatform ? vm.?outputs.?resourceId ?? '' : ''

@description('The management VM name when platform resources are deployed.')
output managementVmNameOut string = deployPlatform ? vm.?outputs.?name ?? '' : ''

@description('The management VM managed identity principal ID when platform resources are deployed.')
output managementVmPrincipalId string = deployPlatform ? vm.?outputs.?principalId ?? '' : ''
