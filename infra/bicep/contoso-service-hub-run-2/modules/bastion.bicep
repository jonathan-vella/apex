// modules/bastion.bicep — Azure Bastion Host (Standard SKU)
// AVM: br/public:avm/res/network/bastion-host:0.5.0
// Governance:
//   POL-001 — EU-only region (swedencentral enforced by location param)
//   POL-002 — Required governance tags (passed via tags param)
//   POL-020 — Bastion Standard SKU for session recording and native client support
//   POL-022 — Diagnostic settings to Log Analytics
// Security: Standard SKU (session recording + native client); no jumpboxes exposed to internet.
//           VMs in snet-mgmt are reachable only through this Bastion endpoint.

@description('Azure region for all resources (must be swedencentral, POL-001).')
param location string

@description('Deployment environment.')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

@description('Azure Bastion host name.')
param bastionName string

@description('Virtual Network resource ID — Bastion uses the AzureBastionSubnet within this VNet.')
param vnetId string

@description('Log Analytics Workspace resource ID for diagnostic settings (POL-022).')
param workspaceId string

// ─────────────────────────────── Environment config ──────────────────────────

// Zone redundancy: prod uses zones 1, 2, 3 for HA; dev/staging single-zone.
// AVM publicIPAddressObject zones expects int array.
var pipZones = env == 'prod' ? [ 1, 2, 3 ] : []

// ─────────────────────────── Azure Bastion Host ───────────────────────────────
// Standard SKU: enables session recording, native client support, shareable links (POL-020).
// AVM derives the AzureBastionSubnet from virtualNetworkResourceId and creates a
// Public IP inline based on the publicIPAddressObject configuration.

module bastionHost 'br/public:avm/res/network/bastion-host:0.5.0' = {
  name: 'bastion-host'
  params: {
    name: bastionName
    location: location
    tags: tags

    // Standard SKU for session recording and native client support (POL-020)
    skuName: 'Standard'

    // VNet reference — AVM derives AzureBastionSubnet path from this VNet ID
    virtualNetworkResourceId: vnetId

    // Public IP configuration — Standard SKU Static required for Bastion Standard
    publicIPAddressObject: {
      name: 'pip-${bastionName}'
      allocationMethod: 'Static'
      skuName: 'Standard'
      zones: pipZones
    }

    // POL-022: Diagnostic settings — Bastion session events and connectivity logs.
    // Note: Bastion does not expose metric categories — logs only.
    diagnosticSettings: [
      {
        workspaceResourceId: workspaceId
        logCategoriesAndGroups: [
          { categoryGroup: 'allLogs' }
        ]
      }
    ]
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Azure Bastion host resource ID.')
output bastionId string = bastionHost.outputs.resourceId

@description('Azure Bastion host name.')
output bastionHostName string = bastionHost.outputs.name
