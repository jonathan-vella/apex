targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment.')
param environment string

@description('Azure region.')
param location string

@description('Resource tags.')
param tags object

@description('AKS cluster name.')
param aksClusterName string

@description('Resource ID of the AKS system node pool subnet.')
param aksSystemSubnetResourceId string

@description('Resource ID of the AKS user node pool subnet.')
param aksUserSubnetResourceId string

@description('Log Analytics workspace resource ID used for Container Insights and diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

var kubernetesVersion = '1.29'
var privateClusterEnabled = environment != 'dev'
var publicNetworkAccess = privateClusterEnabled ? 'Disabled' : 'Enabled'
var userPoolVmSize = environment == 'prod' ? 'Standard_D8s_v5' : environment == 'staging' ? 'Standard_D4s_v5' : 'Standard_D2s_v5'
var userPoolNodeCount = environment == 'prod' ? 3 : environment == 'staging' ? 2 : 1
var userPoolAvailabilityZones = environment == 'prod' ? [1, 2, 3] : []
var userPoolProfile = environment == 'prod'
  ? {
      name: 'usernp'
      availabilityZones: userPoolAvailabilityZones
      count: userPoolNodeCount
      enableAutoScaling: true
      enableEncryptionAtHost: true
      enableNodePublicIP: false
      maxCount: 6
      minCount: 3
      mode: 'User'
      osSKU: 'Ubuntu2204'
      osType: 'Linux'
      type: 'VirtualMachineScaleSets'
      vmSize: userPoolVmSize
      vnetSubnetResourceId: aksUserSubnetResourceId
    }
  : {
      name: 'usernp'
      availabilityZones: userPoolAvailabilityZones
      count: userPoolNodeCount
      enableAutoScaling: false
      enableEncryptionAtHost: true
      enableNodePublicIP: false
      mode: 'User'
      osSKU: 'Ubuntu2204'
      osType: 'Linux'
      type: 'VirtualMachineScaleSets'
      vmSize: userPoolVmSize
      vnetSubnetResourceId: aksUserSubnetResourceId
    }

module aks 'br/public:avm/res/container-service/managed-cluster:0.13.0' = {
  params: {
    aadProfile: {
      adminGroupObjectIDs: []
      enableAzureRBAC: true
      managed: true
    }
    apiServerAccessProfile: privateClusterEnabled
      ? {
          enablePrivateCluster: true
          enablePrivateClusterPublicFQDN: false
        }
      : null
    diagnosticSettings: [
      {
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
        workspaceResourceId: logAnalyticsWorkspaceResourceId
      }
    ]
    disableLocalAccounts: true
    dnsPrefix: aksClusterName
    enableOidcIssuerProfile: true
    enableRBAC: true
    enableStorageProfileBlobCSIDriver: true
    enableStorageProfileDiskCSIDriver: true
    enableStorageProfileFileCSIDriver: true
    kubernetesVersion: kubernetesVersion
    loadBalancerSku: 'standard'
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    monitoringWorkspaceResourceId: logAnalyticsWorkspaceResourceId
    name: aksClusterName
    networkPlugin: 'azure'
    networkPolicy: 'azure'
    omsAgentEnabled: true
    omsAgentUseAADAuth: true
    primaryAgentPoolProfiles: [
      {
        availabilityZones: [1, 2, 3]
        count: 2
        enableAutoScaling: false
        enableEncryptionAtHost: true
        enableNodePublicIP: false
        mode: 'System'
        name: 'sysnp'
        osSKU: 'Ubuntu2204'
        osType: 'Linux'
        type: 'VirtualMachineScaleSets'
        vmSize: 'Standard_D2s_v5'
        vnetSubnetResourceId: aksSystemSubnetResourceId
      }
    ]
    agentPools: [
      userPoolProfile
    ]
    publicNetworkAccess: publicNetworkAccess
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
    skuTier: 'Standard'
    tags: tags
  }
}

@description('AKS cluster resource ID.')
output resourceId string = aks.outputs.resourceId

@description('AKS cluster name.')
output name string = aks.outputs.name

@description('AKS control plane FQDN.')
output controlPlaneFqdn string = aks.outputs.controlPlaneFQDN

@description('AKS OIDC issuer URL.')
output oidcIssuerUrl string = aks.outputs.?oidcIssuerUrl ?? ''

@description('AKS system-assigned managed identity principal ID.')
output principalId string = aks.outputs.?systemAssignedMIPrincipalId ?? ''
