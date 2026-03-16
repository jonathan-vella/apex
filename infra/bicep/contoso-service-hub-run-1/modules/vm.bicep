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

@description('Virtual machine name.')
param vmName string

@description('Subnet resource ID for the management VM private NIC.')
param subnetResourceId string

@description('Log Analytics workspace resource ID used for VM diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

@description('Administrator username for the Linux management VM.')
param adminUsername string = 'azureadmin'

@description('SSH public key for the Linux administrator. Provide a value before deployment.')
param adminSshPublicKey string = ''

var vmSize = environment == 'prod' ? 'Standard_D8s_v5' : environment == 'staging' ? 'Standard_D8s_v5' : 'Standard_D2s_v5'

module vm 'br/public:avm/res/compute/virtual-machine:0.21.0' = {
  params: {
    adminUsername: adminUsername
    availabilityZone: -1
    bootDiagnostics: true
    disablePasswordAuthentication: !empty(adminSshPublicKey)
    encryptionAtHost: true
    imageReference: {
      offer: '0001-com-ubuntu-server-jammy'
      publisher: 'Canonical'
      sku: '22_04-lts-gen2'
      version: 'latest'
    }
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    name: vmName
    nicConfigurations: [
      {
        nicSuffix: '-nic-01'
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
    }
    osType: 'Linux'
    publicKeys: !empty(adminSshPublicKey)
      ? [
          {
            keyData: adminSshPublicKey
            path: '/home/${adminUsername}/.ssh/authorized_keys'
          }
        ]
      : []
    tags: tags
    vmSize: vmSize
  }
}

resource virtualMachine 'Microsoft.Compute/virtualMachines@2024-07-01' existing = {
  name: vmName
}

resource vmDiagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${vmName}-diagnostics'
  scope: virtualMachine
  dependsOn: [
    vm
  ]
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

@description('Management VM resource ID.')
output resourceId string = vm.outputs.resourceId

@description('Management VM name.')
output name string = vm.outputs.name

@description('Management VM system-assigned managed identity principal ID.')
output principalId string = vm.outputs.?systemAssignedMIPrincipalId ?? ''

@description('Management VM private NIC configuration outputs.')
output nicConfigurations array = vm.outputs.nicConfigurations
