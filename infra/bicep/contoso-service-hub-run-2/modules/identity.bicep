// modules/identity.bicep — User-Assigned Managed Identity
// AVM: br/public:avm/res/managed-identity/user-assigned-identity:0.4.0
// Governance: POL-021 (Managed identity preference — no shared keys or connection strings)
// Purpose: Shared identity for AKS, APIM, App Gateway, VMs, and Key Vault RBAC.

@description('Azure region for the managed identity (must be swedencentral, POL-001).')
param location string

@description('Managed identity resource name.')
param identityName string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

// ─────────────────────────── User-Assigned Managed Identity ──────────────────
// Single shared identity across workload tiers. Scoped RBAC assignments are
// made by each consuming module (Key Vault, Storage, ACR, etc.).

module managedIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.0' = {
  name: 'managed-identity'
  params: {
    name: identityName
    location: location
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Managed identity resource ID (for resource associations).')
output identityId string = managedIdentity.outputs.resourceId

@description('Managed identity principal ID (for RBAC role assignments).')
output identityPrincipalId string = managedIdentity.outputs.principalId

@description('Managed identity client ID (for workload identity federation and MSAL).')
output identityClientId string = managedIdentity.outputs.clientId
