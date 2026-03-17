targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string
param location string
param tags object
param vmName string
param vmSize string
param managedDiskName string
param subnetResourceId string
param logAnalyticsWorkspaceResourceId string
param managedIdentityResourceId string
param adminPublicKey string

module dataDisk 'br/public:avm/res/compute/disk:0.6.0' = {
  params: {
    availabilityZone: -1
    createOption: 'Empty'
    diskSizeGB: 256
    location: location
    name: managedDiskName
    networkAccessPolicy: 'DenyAll'
    publicNetworkAccess: 'Disabled'
    sku: environment == 'prod' ? 'Premium_LRS' : environment == 'staging' ? 'Premium_LRS' : 'StandardSSD_LRS'
    tags: tags
  }
}

module vm 'br/public:avm/res/compute/virtual-machine:0.21.0' = {
  params: {
    adminUsername: 'azureadmin'
    availabilityZone: -1
    bootDiagnostics: true
    dataDisks: [
      {
        caching: 'ReadOnly'
        createOption: 'Attach'
        deleteOption: 'Delete'
        lun: 0
        managedDisk: {
          resourceId: dataDisk.outputs.resourceId
          storageAccountType: environment == 'prod' ? 'Premium_LRS' : environment == 'staging' ? 'Premium_LRS' : 'StandardSSD_LRS'
        }
        name: managedDiskName
      }
    ]
    disablePasswordAuthentication: true
    encryptionAtHost: true
    imageReference: {
      offer: 'ubuntu-24_04-lts'
      publisher: 'Canonical'
      sku: 'server'
      version: 'latest'
    }
    location: location
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [
        managedIdentityResourceId
      ]
    }
    name: vmName
    nicConfigurations: [
      {
        nicSuffix: '-nic-01'
        enableAcceleratedNetworking: true
        ipConfigurations: [
          {
            name: 'ipconfig01'
            privateIPAllocationMethod: 'Dynamic'
            privateIPAddressVersion: 'IPv4'
            subnetResourceId: subnetResourceId
          }
        ]
      }
    ]
    osDisk: {
      caching: 'ReadWrite'
      createOption: 'FromImage'
      managedDisk: {
        storageAccountType: 'Premium_LRS'
      }
      diskSizeGB: 128
    }
    osType: 'Linux'
    publicKeys: [
      {
        keyData: adminPublicKey
        path: '/home/azureadmin/.ssh/authorized_keys'
      }
    ]
    tags: tags
    vmSize: vmSize
  }
}

resource virtualMachine 'Microsoft.Compute/virtualMachines@2024-07-01' existing = {
  name: vmName
}

resource vmDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${vmName}-diagnostics'
  scope: virtualMachine
  properties: {
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
    workspaceId: logAnalyticsWorkspaceResourceId
  }
}

output vmId string = vm.outputs.resourceId
output vmName string = vm.outputs.name
output vmAttachedIdentityResourceId string = managedIdentityResourceId
