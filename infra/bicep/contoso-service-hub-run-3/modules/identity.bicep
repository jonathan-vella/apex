@description('Azure region for the optional workload identity resource.')
param location string

@description('Common resource tags applied to the placeholder identity resource.')
param tags object

@description('User-assigned managed identity name for External ID integration placeholders.')
param identityName string

@description('Key Vault resource ID used for the placeholder identity secret-read role assignment.')
param keyVaultResourceId string

@description('Controls whether a placeholder user-assigned managed identity is created for future Entra External ID integrations.')
param createManagedIdentity bool = true

resource workloadIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (createManagedIdentity) {
  name: identityName
  location: location
  tags: tags
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: last(split(keyVaultResourceId, '/'))
}

resource workloadIdentityKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (createManagedIdentity) {
  name: guid(keyVault.id, identityName, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    principalId: workloadIdentity.?properties.?principalId ?? ''
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

@description('User-assigned identity resource ID when the placeholder identity is enabled.')
output workloadIdentityId string = createManagedIdentity ? (workloadIdentity.?id ?? '') : ''

@description('User-assigned identity principal ID when the placeholder identity is enabled.')
output workloadIdentityPrincipalId string = createManagedIdentity ? (workloadIdentity.?properties.?principalId ?? '') : ''

@description('User-assigned identity client ID when the placeholder identity is enabled.')
output workloadIdentityClientId string = createManagedIdentity ? (workloadIdentity.?properties.?clientId ?? '') : ''

@description('Implementation note for Microsoft Entra External ID.')
output implementationNote string = 'Microsoft Entra External ID tenant configuration, user flows, app registrations, and federation are managed outside Bicep through the Entra admin center or Microsoft Graph. This module only provides an optional managed identity placeholder for downstream workload integration.'
