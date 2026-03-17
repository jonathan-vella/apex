@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment used to size the virtual machine.')
param environmentName string

@description('Azure region for the virtual machine.')
param location string

@description('Common resource tags applied to the virtual machine resources.')
param tags object

@description('Virtual machine name.')
param vmName string

@description('Subnet resource ID for the virtual machine NIC.')
param vmSubnetResourceId string

@description('Key Vault resource ID used for the Key Vault Secrets User role assignment.')
param keyVaultResourceId string

@description('Administrative username for the Linux VM.')
param adminUsername string = 'azureuser'

@description('SSH public key used for Linux authentication in automated E2E builds.')
param adminPublicKey string = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDG5b9l1UpK6sG7W8Ww0KQ0x1QJmN8tV3M4bF8uQ6j3W8x2d8o1VqH5nW2fL6cY7rN9qL3zP4bW0fM9nK6jD1cQ2pV7hT3sN8xR5mC0kL4nB7vQ2aD5fH8jK1mN4pQ7rS0tU3vW6xY9zA2bC5dE8fG1hJ4kL7mN0pQ3rT6vW9xY2zA5bC8dE1fG4hJ7kL0mN3pQ6rT9vW2xY5z azureuser@contoso-service-hub'

var vmSize = environmentName == 'prod' ? 'Standard_D8s_v5' : environmentName == 'staging' ? 'Standard_D4s_v5' : 'Standard_B2s'
var osDiskStorageAccountType = environmentName == 'prod' ? 'Premium_LRS' : 'StandardSSD_LRS'
var osDiskSizeGb = environmentName == 'prod' ? 128 : 64
var availabilityZone = environmentName == 'prod' ? 1 : -1

module vm 'br/public:avm/res/compute/virtual-machine:0.21.0' = {
  params: {
    adminUsername: adminUsername
    availabilityZone: availabilityZone
    disablePasswordAuthentication: true
    imageReference: {
      offer: 'ubuntu-24_04-lts'
      publisher: 'Canonical'
      sku: 'server'
      version: 'latest'
    }
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    name: vmName
    nicConfigurations: [
      {
        deleteOption: 'Delete'
        enableAcceleratedNetworking: environmentName != 'dev'
        ipConfigurations: [
          {
            name: 'ipconfig01'
            privateIPAllocationMethod: 'Dynamic'
            subnetResourceId: vmSubnetResourceId
          }
        ]
        name: 'nic01'
      }
    ]
    osDisk: {
      caching: 'ReadWrite'
      createOption: 'FromImage'
      deleteOption: 'Delete'
      diskSizeGB: osDiskSizeGb
      managedDisk: {
        storageAccountType: osDiskStorageAccountType
      }
    }
    osType: 'Linux'
    publicKeys: [
      {
        keyData: adminPublicKey
        path: '/home/${adminUsername}/.ssh/authorized_keys'
      }
    ]
    publicNetworkAccess: 'Disabled'
    tags: tags
    vmSize: vmSize
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: last(split(keyVaultResourceId, '/'))
}

resource vmKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, vmName, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    principalId: vm.outputs.?systemAssignedMIPrincipalId ?? ''
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

@description('Virtual machine resource ID.')
output vmId string = vm.outputs.resourceId

@description('Virtual machine name.')
output vmNameOut string = vm.outputs.name

@description('Virtual machine system-assigned managed identity principal ID.')
output vmPrincipalId string = vm.outputs.?systemAssignedMIPrincipalId ?? ''
