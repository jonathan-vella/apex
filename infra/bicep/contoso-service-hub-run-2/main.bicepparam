using './main.bicep'

param environment = 'prod'
param phase = 'all'
param location = 'swedencentral'

param projectName = 'contoso-service-hub'
param owner = 'contoso-platform'
param costCenter = 'CSH-001'
param workloadName = 'service-hub'
param slaTier = '99.9'
param backupPolicy = 'daily-30d'
param maintenanceWindow = 'sun-02-06-utc'
param technicalContact = 'platform@contoso.example'

param vnetAddressPrefix = '10.0.0.0/16'
param publisherName = 'Contoso Service Hub'
param publisherEmail = 'api-admin@contoso.example'
param managementVmAdminPublicKey = ''
param postgresqlAdministratorPassword = ''

param actionGroupEmailReceivers = [
  {
    name: 'primary'
    emailAddress: 'platform@contoso.example'
  }
  {
    name: 'operations'
    emailAddress: 'operations@contoso.example'
  }
]

param aksNodeCount = 2
param aksNodeSku = 'Standard_D8s_v5'
param postgresqlSkuName = 'Standard_D4ds_v5'
param postgresqlHaMode = 'ZoneRedundant'
param redisSku = 'MemoryOptimized_M200'
param vmSize = 'Standard_D8s_v5'
param apimSkuName = 'StandardV2'
param budgetAmount = 5500

param frontDoorCustomDomainHostName = ''
param frontDoorHealthProbePath = '/health'
