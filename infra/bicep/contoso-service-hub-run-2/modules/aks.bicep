targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string
param location string
param tags object
param aksClusterName string
param aksNodeCount int
param aksNodeSku string
param aksSubnetResourceId string
param logAnalyticsWorkspaceResourceId string
param managedIdentityResourceId string

var systemNodeCount = environment == 'prod' ? 2 : 1
var systemNodeSku = environment == 'prod' ? 'Standard_D4s_v5' : environment == 'staging' ? 'Standard_D4s_v5' : 'Standard_D2s_v5'
var availabilityZones = environment == 'prod' ? [1, 2, 3] : []
var enableAutoscaling = environment != 'dev'

module aks 'br/public:avm/res/container-service/managed-cluster:0.13.0' = {
  params: {
    aadProfile: {
      adminGroupObjectIDs: []
      enableAzureRBAC: true
      managed: true
    }
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
    dnsPrefix: take(replace(aksClusterName, '-', ''), 30)
    enableOidcIssuerProfile: true
    enableRBAC: true
    enableStorageProfileBlobCSIDriver: true
    enableStorageProfileDiskCSIDriver: true
    enableStorageProfileFileCSIDriver: true
    kubernetesVersion: '1.30'
    loadBalancerSku: 'standard'
    location: location
    managedIdentities: {
      systemAssigned: true
      userAssignedResourceIds: [
        managedIdentityResourceId
      ]
    }
    monitoringWorkspaceResourceId: logAnalyticsWorkspaceResourceId
    name: aksClusterName
    networkPlugin: 'azure'
    networkPolicy: 'calico'
    omsAgentEnabled: true
    omsAgentUseAADAuth: true
    primaryAgentPoolProfiles: [
      {
        availabilityZones: availabilityZones
        count: systemNodeCount
        enableAutoScaling: false
        enableEncryptionAtHost: true
        enableNodePublicIP: false
        maxPods: 110
        mode: 'System'
        name: 'system'
        osSKU: 'Ubuntu2204'
        osType: 'Linux'
        type: 'VirtualMachineScaleSets'
        vmSize: systemNodeSku
        vnetSubnetResourceId: aksSubnetResourceId
      }
    ]
    agentPools: [
      {
        availabilityZones: availabilityZones
        count: aksNodeCount
        enableAutoScaling: enableAutoscaling
        enableEncryptionAtHost: true
        enableNodePublicIP: false
        maxCount: environment == 'prod' ? 5 : 2
        maxPods: 110
        minCount: environment == 'prod' ? 2 : 1
        mode: 'User'
        name: 'user'
        osSKU: 'Ubuntu2204'
        osType: 'Linux'
        type: 'VirtualMachineScaleSets'
        vmSize: aksNodeSku
        vnetSubnetResourceId: aksSubnetResourceId
      }
    ]
    publicNetworkAccess: 'Disabled'
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
    skuTier: environment == 'prod' ? 'Standard' : 'Free'
    tags: tags
  }
}

output aksClusterId string = aks.outputs.resourceId
output aksClusterName string = aks.outputs.name
output aksClusterFqdn string = aks.outputs.controlPlaneFQDN
output aksOidcIssuerUrl string = aks.outputs.?oidcIssuerUrl ?? ''
