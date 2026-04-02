// modules/identity.bicep
// Phase 1 — User-Assigned Managed Identity (shared cross-service identity)
// AVM: br/public:avm/res/managed-identity/user-assigned-identity:0.5.0
// Governance: EU location, mandatory tags, managed identity over keys

@description('Azure region for the managed identity.')
param location string

@description('Environment name (dev | staging | prod).')
param environment string

@description('Project short name for CAF naming.')
param projectName string

@description('Resource tags applied to all resources in this module.')
param tags object

// ─────────────────────────────── Derived names ───────────────────────────────

var identityName = 'id-${projectName}-${environment}'

// ──────────────────────────── User-Assigned Managed Identity ─────────────────

module userAssignedIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.5.0' = {
  name: 'user-assigned-identity'
  params: {
    name: identityName
    location: location
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Resource ID of the user-assigned managed identity.')
output identityId string = userAssignedIdentity.outputs.resourceId

@description('Principal ID of the managed identity (for RBAC assignments).')
output identityPrincipalId string = userAssignedIdentity.outputs.principalId

@description('Client ID of the managed identity (for workload configuration).')
output identityClientId string = userAssignedIdentity.outputs.clientId
