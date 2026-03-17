targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment.')
param environment string

@allowed([
  'all'
  'foundation'
  'networking'
  'security'
  'data'
  'compute'
  'edge'
])
@description('Deployment phase selector. Use all to deploy the full stack or a specific phase for controlled rollout.')
param phase string = 'all'

@allowed([
  'swedencentral'
  'germanywestcentral'
  'westeurope'
])
@description('Primary Azure region for regional resources.')
param location string = 'swedencentral'

@description('Project identifier used for naming and tags. No default is allowed to keep the template repeatable.')
param projectName string

@description('Resource owner tag value.')
param owner string

@description('Cost center tag value.')
param costCenter string

@description('Workload tag value.')
param workloadName string

@allowed([
  '99.9'
  '99.5'
  'best-effort'
])
@description('SLA tag value.')
param slaTier string

@description('Backup policy tag value.')
param backupPolicy string

@description('Maintenance window tag value.')
param maintenanceWindow string

@description('Technical contact used for governance tags and alerts.')
param technicalContact string

@description('CIDR for the workload virtual network.')
param vnetAddressPrefix string

@description('API Management publisher display name.')
param publisherName string

@description('API Management publisher email.')
param publisherEmail string

@description('Email receiver list for the shared alert action group.')
param actionGroupEmailReceivers array

@description('SSH public key for the Linux management VM administrator.')
param managementVmAdminPublicKey string

@secure()
@description('Administrator password for PostgreSQL Flexible Server. Pass this from deployment tooling or Key Vault-backed automation.')
param postgresqlAdministratorPassword string

@description('AKS user pool node count.')
param aksNodeCount int

@description('AKS user pool VM size.')
param aksNodeSku string

@description('PostgreSQL Flexible Server SKU name.')
param postgresqlSkuName string

@allowed([
  'Disabled'
  'SameZone'
  'ZoneRedundant'
])
@description('PostgreSQL Flexible Server high availability mode.')
param postgresqlHaMode string

@description('Azure Managed Redis SKU name.')
param redisSku string

@description('Virtual machine size for the management VM.')
param vmSize string

@allowed([
  'Developer'
  'BasicV2'
  'StandardV2'
])
@description('API Management SKU name.')
param apimSkuName string

@description('Monthly budget amount in USD at resource-group scope.')
param budgetAmount int

@description('Optional Azure Front Door custom domain host name.')
param frontDoorCustomDomainHostName string = ''

@description('Health probe path used by Azure Front Door to test the API origin.')
param frontDoorHealthProbePath string = '/health'

var uniqueSuffix = uniqueString(resourceGroup().id)
var shortProjectName = take(replace(projectName, '-', ''), 8)
var suffix6 = take(uniqueSuffix, 6)
var tags = {
  environment: environment
  owner: owner
  costcenter: costCenter
  application: projectName
  workload: workloadName
  sla: slaTier
  'backup-policy': backupPolicy
  'maint-window': maintenanceWindow
  'technical-contact': technicalContact
  'tech-contact': technicalContact
  ManagedBy: 'Bicep'
}

var deployFoundation = phase == 'all' || phase == 'foundation'
var deployNetworking = phase == 'all' || phase == 'networking'
var deploySecurity = phase == 'all' || phase == 'security'
var deployData = phase == 'all' || phase == 'data'
var deployCompute = phase == 'all' || phase == 'compute'
var deployEdge = phase == 'all' || phase == 'edge'

var workspaceName = take('law-${shortProjectName}-${environment}-${suffix6}', 63)
var appInsightsName = take('appi-${shortProjectName}-${environment}-${suffix6}', 260)
var actionGroupName = take('ag-${shortProjectName}-${environment}', 64)
var managedIdentityName = take('uami-${shortProjectName}-${environment}-${suffix6}', 128)
var vnetName = take('vnet-${shortProjectName}-${environment}', 64)
var keyVaultName = take('kv-${shortProjectName}-${environment}-${suffix6}', 24)
var blobStorageAccountName = take('st${shortProjectName}${environment}${suffix6}b', 24)
var fileStorageAccountName = take('st${shortProjectName}${environment}${suffix6}f', 24)
var postgresqlName = take('psql-${shortProjectName}-${environment}-${suffix6}', 63)
var redisName = take('redis-${shortProjectName}-${environment}-${suffix6}', 63)
var aksName = take('aks-${shortProjectName}-${environment}-${suffix6}', 63)
var vmName = take('vm-${shortProjectName}-${environment}-${suffix6}', 64)
var managedDiskName = take('disk-${shortProjectName}-${environment}-${suffix6}', 80)
var apimName = take('apim-${shortProjectName}-${environment}-${suffix6}', 50)
var apimPrivateEndpointName = take('pe-apim-${shortProjectName}-${environment}', 80)
var frontDoorProfileName = take('afd-${shortProjectName}-${environment}', 260)
var frontDoorEndpointName = take('ep-api-${shortProjectName}-${environment}', 50)
var frontDoorOriginGroupName = 'og-apim'
var frontDoorOriginName = 'origin-apim'
var frontDoorRouteName = 'rt-api'
var frontDoorSecurityPolicyName = 'sp-waf'
var wafPolicyName = take('wafpolicy${shortProjectName}${environment}', 128)
var budgetName = take('budget-${shortProjectName}-${environment}', 63)

var aksSubnetName = 'snet-aks-${environment}'
var dataSubnetName = 'snet-data-${environment}'
var vmSubnetName = 'snet-vm-${environment}'
var postgresqlSubnetName = 'snet-pgsql-${environment}'

var logAnalyticsWorkspaceId = resourceId('Microsoft.OperationalInsights/workspaces', workspaceName)
var appInsightsId = resourceId('Microsoft.Insights/components', appInsightsName)
var actionGroupId = resourceId('Microsoft.Insights/actionGroups', actionGroupName)
var managedIdentityId = resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', managedIdentityName)
var vnetId = resourceId('Microsoft.Network/virtualNetworks', vnetName)
var aksSubnetId = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, aksSubnetName)
var dataSubnetId = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, dataSubnetName)
var vmSubnetId = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, vmSubnetName)
var postgresqlSubnetId = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, postgresqlSubnetName)
var postgresqlDnsZoneId = resourceId('Microsoft.Network/privateDnsZones', 'privatelink.postgres.database.azure.com')
var redisDnsZoneId = resourceId('Microsoft.Network/privateDnsZones', 'privatelink.redisenterprise.cache.azure.com')
var keyVaultDnsZoneId = resourceId('Microsoft.Network/privateDnsZones', 'privatelink.vaultcore.azure.net')
var blobPrivateDnsZoneName = 'privatelink.blob.${az.environment().suffixes.storage}'
var filePrivateDnsZoneName = 'privatelink.file.${az.environment().suffixes.storage}'
var blobDnsZoneId = resourceId('Microsoft.Network/privateDnsZones', blobPrivateDnsZoneName)
var fileDnsZoneId = resourceId('Microsoft.Network/privateDnsZones', filePrivateDnsZoneName)
var apimId = resourceId('Microsoft.ApiManagement/service', apimName)
var apimGatewayHostName = '${apimName}.azure-api.net'
var frontDoorProfileId = resourceId('Microsoft.Cdn/profiles', frontDoorProfileName)
var frontDoorEndpointId = resourceId('Microsoft.Cdn/profiles/afdEndpoints', frontDoorProfileName, frontDoorEndpointName)

module monitoring 'modules/monitoring.bicep' = if (deployFoundation) {
  params: {
    actionGroupEmailReceivers: actionGroupEmailReceivers
    actionGroupName: actionGroupName
    appInsightsName: appInsightsName
    environment: environment
    location: location
    logAnalyticsWorkspaceName: workspaceName
    tags: tags
  }
}

module managedIdentity 'modules/managed-identity.bicep' = if (deployFoundation) {
  params: {
    location: location
    managedIdentityName: managedIdentityName
    tags: tags
  }
}

module networking 'modules/networking.bicep' = if (deployNetworking) {
  params: {
    environment: environment
    location: location
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId
    tags: tags
    vnetAddressPrefix: vnetAddressPrefix
    vnetName: vnetName
  }
}

module privateDnsZones 'modules/private-dns-zones.bicep' = if (deployNetworking) {
  params: {
    postgresqlDnsZoneName: 'privatelink.postgres.database.azure.com'
    redisDnsZoneName: 'privatelink.redisenterprise.cache.azure.com'
    keyVaultDnsZoneName: 'privatelink.vaultcore.azure.net'
    blobDnsZoneName: blobPrivateDnsZoneName
    fileDnsZoneName: filePrivateDnsZoneName
    tags: tags
    virtualNetworkResourceId: vnetId
  }
}

module keyVault 'modules/key-vault.bicep' = if (deploySecurity) {
  params: {
    environment: environment
    keyVaultName: keyVaultName
    keyVaultPrivateDnsZoneResourceId: keyVaultDnsZoneId
    location: location
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId
    managedIdentityPrincipalId: deployFoundation ? managedIdentity.?outputs.?managedIdentityPrincipalId ?? reference(managedIdentityId, '2023-01-31', 'Full').principalId : reference(managedIdentityId, '2023-01-31', 'Full').principalId
    privateEndpointSubnetResourceId: dataSubnetId
    tags: tags
  }
}

module blobStorage 'modules/storage-blob.bicep' = if (deployData) {
  params: {
    blobPrivateDnsZoneResourceId: blobDnsZoneId
    blobStorageAccountName: blobStorageAccountName
    location: location
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId
    privateEndpointSubnetResourceId: dataSubnetId
    tags: tags
  }
}

module fileStorage 'modules/storage-files.bicep' = if (deployData) {
  params: {
    filePrivateDnsZoneResourceId: fileDnsZoneId
    fileStorageAccountName: fileStorageAccountName
    location: location
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId
    privateEndpointSubnetResourceId: dataSubnetId
    tags: tags
  }
}

module postgresql 'modules/postgresql.bicep' = if (deployData) {
  params: {
    environment: environment
    location: location
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId
    postgresqlAdministratorPassword: postgresqlAdministratorPassword
    postgresqlDnsZoneResourceId: postgresqlDnsZoneId
    postgresqlName: postgresqlName
    postgresqlSkuName: postgresqlSkuName
    postgresqlSubnetResourceId: postgresqlSubnetId
    highAvailabilityMode: postgresqlHaMode
    tags: tags
  }
}

module redis 'modules/redis.bicep' = if (deployData) {
  params: {
    environment: environment
    location: location
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId
    privateEndpointSubnetResourceId: dataSubnetId
    redisName: redisName
    redisPrivateDnsZoneResourceId: redisDnsZoneId
    redisSkuName: redisSku
    tags: tags
  }
}

module aks 'modules/aks.bicep' = if (deployCompute) {
  params: {
    aksClusterName: aksName
    aksNodeCount: aksNodeCount
    aksNodeSku: aksNodeSku
    aksSubnetResourceId: aksSubnetId
    environment: environment
    location: location
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId
    managedIdentityResourceId: managedIdentityId
    tags: tags
  }
}

module virtualMachine 'modules/virtual-machine.bicep' = if (deployCompute) {
  params: {
    adminPublicKey: managementVmAdminPublicKey
    environment: environment
    location: location
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId
    managedDiskName: managedDiskName
    managedIdentityResourceId: managedIdentityId
    subnetResourceId: vmSubnetId
    tags: tags
    vmName: vmName
    vmSize: vmSize
  }
}

module budget 'modules/budget.bicep' = if (deployFoundation) {
  params: {
    actionGroupResourceId: actionGroupId
    budgetAmount: budgetAmount
    budgetName: budgetName
    technicalContact: technicalContact
  }
}

module apim 'modules/apim.bicep' = if (deployEdge) {
  params: {
    apiManagementName: apimName
    apimPrivateEndpointName: apimPrivateEndpointName
    applicationInsightsResourceId: appInsightsId
    environment: environment
    location: location
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId
    managedIdentityResourceId: managedIdentityId
    privateEndpointSubnetResourceId: dataSubnetId
    publisherEmail: publisherEmail
    publisherName: publisherName
    skuName: apimSkuName
    tags: tags
  }
}

module frontDoor 'modules/front-door.bicep' = if (deployEdge) {
  params: {
    apiHostname: apimGatewayHostName
    apiManagementResourceId: apimId
    customDomainHostName: frontDoorCustomDomainHostName
    endpointName: frontDoorEndpointName
    healthProbePath: frontDoorHealthProbePath
    location: 'global'
    resourceLocation: location
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId
    originGroupName: frontDoorOriginGroupName
    originName: frontDoorOriginName
    profileName: frontDoorProfileName
    routeName: frontDoorRouteName
    securityPolicyName: frontDoorSecurityPolicyName
    tags: tags
    wafPolicyName: wafPolicyName
  }
}

@description('Unique suffix generated once per resource group.')
output uniqueSuffixValue string = uniqueSuffix

@description('Tag set applied to all child resources in this deployment.')
output effectiveTags object = tags

@description('Log Analytics workspace resource ID.')
output logAnalyticsWorkspaceId string = logAnalyticsWorkspaceId

@description('Application Insights connection string.')
output applicationInsightsConnectionString string = deployFoundation ? monitoring.?outputs.?appInsightsConnectionString ?? reference(appInsightsId, '2020-02-02').ConnectionString : reference(appInsightsId, '2020-02-02').ConnectionString

@description('Shared managed identity resource ID.')
output managedIdentityResourceId string = managedIdentityId

@description('Virtual network resource ID.')
output virtualNetworkResourceId string = vnetId

@description('Key Vault URI.')
output keyVaultUri string = deploySecurity ? keyVault.?outputs.?keyVaultUri ?? 'https://${keyVaultName}.${az.environment().suffixes.keyvaultDns}/' : 'https://${keyVaultName}.${az.environment().suffixes.keyvaultDns}/'

@description('Blob storage account name.')
output blobStorageAccountName string = blobStorageAccountName

@description('Azure Files storage account name.')
output fileStorageAccountName string = fileStorageAccountName

@description('PostgreSQL server FQDN.')
output postgresqlServerFqdn string = deployData ? postgresql.?outputs.?postgresqlServerFqdn ?? '${postgresqlName}.postgres.database.azure.com' : '${postgresqlName}.postgres.database.azure.com'

@description('Azure Managed Redis hostname.')
output redisHostName string = deployData ? redis.?outputs.?redisHostName ?? '${redisName}.${location}.redisenterprise.cache.azure.com' : '${redisName}.${location}.redisenterprise.cache.azure.com'

@description('AKS cluster name.')
output aksClusterName string = aksName

@description('API Management gateway URL.')
output apimGatewayUrl string = 'https://${apimGatewayHostName}'

@description('Azure Front Door profile resource ID.')
output frontDoorProfileId string = frontDoorProfileId

@description('Azure Front Door endpoint resource ID.')
output frontDoorEndpointId string = frontDoorEndpointId
