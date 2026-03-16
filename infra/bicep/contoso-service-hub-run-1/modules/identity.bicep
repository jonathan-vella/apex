targetScope = 'resourceGroup'

@description('Azure region.')
param location string

@description('Resource tags.')
param tags object

@description('User-assigned identity name.')
param workloadIdentityName string

@description('Key Vault name to grant secret access to.')
param keyVaultName string

@description('Blob storage account name to grant blob-read access to.')
param blobStorageAccountName string

@description('Redis resource name to grant read access to.')
param redisName string

@description('Optional APIM principal ID to grant Key Vault access to.')
param apimPrincipalId string = ''

resource workloadIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: workloadIdentityName
  location: location
  tags: tags
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource blobStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: blobStorageAccountName
}

resource redis 'Microsoft.Cache/redisEnterprise@2024-09-01-preview' existing = {
  name: redisName
}

resource workloadIdentityKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, workloadIdentityName, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    principalId: workloadIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

resource workloadIdentityBlobReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(blobStorage.id, workloadIdentityName, 'Storage Blob Data Reader')
  scope: blobStorage
  properties: {
    principalId: workloadIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1')
  }
}

resource workloadIdentityRedisReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(redis.id, workloadIdentityName, 'Reader')
  scope: redis
  properties: {
    principalId: workloadIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'acdd72a7-3385-48ef-bd42-f606fba81ae7')
  }
}

resource apimKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(apimPrincipalId)) {
  name: guid(keyVault.id, apimPrincipalId, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    principalId: apimPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

@description('User-assigned identity resource ID.')
output workloadIdentityId string = workloadIdentity.id

@description('User-assigned identity name.')
output workloadIdentityNameOut string = workloadIdentity.name

@description('User-assigned identity principal ID.')
output workloadIdentityPrincipalId string = workloadIdentity.properties.principalId

@description('User-assigned identity client ID.')
output workloadIdentityClientId string = workloadIdentity.properties.clientId

@description('Role assignment resource IDs created for the workload identity and APIM.')
output roleAssignmentIds array = concat([
  workloadIdentityKeyVaultSecretsUser.id
  workloadIdentityBlobReader.id
  workloadIdentityRedisReader.id
], !empty(apimPrincipalId) ? [
  apimKeyVaultSecretsUser.id
] : [])
