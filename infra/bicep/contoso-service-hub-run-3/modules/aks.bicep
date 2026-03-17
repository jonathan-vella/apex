@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment used to size the AKS cluster.')
param environmentName string

@description('Azure region for the AKS cluster.')
param location string

@description('Common resource tags applied to the AKS cluster.')
param tags object

@description('AKS cluster name.')
param aksName string

@description('Subnet resource ID for the AKS agent pool.')
param aksSubnetResourceId string

@description('Log Analytics workspace resource ID for the OMS agent addon.')
param logAnalyticsWorkspaceResourceId string

@description('Key Vault resource ID used for the Key Vault Secrets User role assignment.')
param keyVaultResourceId string

@description('Azure Container Registry resource ID used for the AcrPull role assignment.')
param acrResourceId string

@description('Azure Container Registry login server associated with the cluster workloads.')
param acrLoginServer string

var nodeCount = environmentName == 'prod' ? 3 : environmentName == 'staging' ? 2 : 1
var agentVmSize = environmentName == 'prod' ? 'Standard_D8s_v5' : 'Standard_D4s_v5'
var agentZones = environmentName == 'prod' ? [
  1
  2
  3
] : null
var dnsPrefix = take(replace('${aksName}-dns', '--', '-'), 54)

module aks 'br/public:avm/res/container-service/managed-cluster:0.13.0' = {
  params: {
    azurePolicyEnabled: true
    disableLocalAccounts: true
    dnsPrefix: dnsPrefix
    enableKeyvaultSecretsProvider: true
    enableRBAC: true
    enableSecretRotation: true
    kubernetesVersion: '1.30'
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    monitoringWorkspaceResourceId: logAnalyticsWorkspaceResourceId
    name: aksName
    networkPlugin: 'azure'
    networkPolicy: 'calico'
    omsAgentEnabled: true
    primaryAgentPoolProfiles: [
      {
        availabilityZones: agentZones
        count: nodeCount
        maxPods: 110
        mode: 'System'
        name: 'system'
        osDiskSizeGB: 128
        osSKU: 'Ubuntu2404'
        osType: 'Linux'
        type: 'VirtualMachineScaleSets'
        vmSize: agentVmSize
        vnetSubnetResourceId: aksSubnetResourceId
      }
    ]
    skuTier: 'Standard'
    tags: tags
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: last(split(keyVaultResourceId, '/'))
}

resource acr 'Microsoft.ContainerRegistry/registries@2025-06-01-preview' existing = {
  name: last(split(acrResourceId, '/'))
}

resource aksAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, aksName, 'AcrPull')
  scope: acr
  properties: {
    principalId: aks.outputs.?kubeletIdentityObjectId ?? aks.outputs.?systemAssignedMIPrincipalId ?? ''
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

resource aksKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, aksName, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    principalId: aks.outputs.?keyvaultIdentityObjectId ?? aks.outputs.?systemAssignedMIPrincipalId ?? ''
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

@description('AKS cluster resource ID.')
output aksResourceId string = aks.outputs.resourceId

@description('AKS cluster name.')
output aksClusterName string = aks.outputs.name

@description('AKS control plane FQDN.')
output aksFqdn string = aks.outputs.?controlPlaneFQDN ?? ''

@description('AKS system-assigned managed identity principal ID.')
output aksIdentityPrincipalId string = aks.outputs.?systemAssignedMIPrincipalId ?? ''

@description('AKS kubelet identity object ID used for ACR pull.')
output aksKubeletIdentityObjectId string = aks.outputs.?kubeletIdentityObjectId ?? ''

@description('Container registry login server wired to the cluster.')
output containerRegistryLoginServer string = acrLoginServer
