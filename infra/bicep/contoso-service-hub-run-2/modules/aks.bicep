// modules/aks.bicep — AKS Managed Cluster
// AVM: br/public:avm/res/container-service/managed-cluster:0.11.0
// Governance:
//   POL-001 — EU-only region (swedencentral enforced by location param)
//   POL-002 — Required governance tags (passed via tags param)
//   POL-016 — AKS Azure Policy addon enabled
//   POL-017 — AKS Kubernetes RBAC + Azure AD integration
//   POL-018 — AKS private cluster (prod/staging)
//   POL-022 — Diagnostic settings to Log Analytics
// Security: Private cluster (prod/staging), Azure RBAC, managed identity, Container Insights

@description('Azure region for the AKS cluster (must be swedencentral, POL-001).')
param location string

@description('Deployment environment — controls SKU tier, node sizing, and private cluster toggle.')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

@description('Deterministic suffix derived from resource group ID (passed from main.bicep).')
#disable-next-line no-unused-params
param uniqueSuffix string

@description('AKS cluster name.')
param aksName string

@description('AKS dedicated subnet resource ID (snet-aks) for pod IP allocation with Azure CNI.')
param aksSubnetId string

@description('Log Analytics Workspace resource ID for Container Insights and diagnostic settings (POL-022).')
param workspaceId string

@description('User-assigned managed identity resource ID (POL-021 — managed identity preference).')
param managedIdentityId string

// ─────────────────────────────── Environment sizing ──────────────────────────

// SKU tier: Standard for prod (SLA-backed 99.95%), Free for dev/staging (cost governance)
var skuTier = env == 'prod' ? 'Standard' : 'Free'

// System node pool sizing
var systemNodeCount = env == 'prod' ? 3 : 2
var systemVmSize    = env == 'prod' ? 'Standard_D4ds_v5' : 'Standard_D2ds_v5'

// User node pool sizing and autoscale bounds
var userVmSize   = env == 'prod' ? 'Standard_D8ds_v5' : 'Standard_D4ds_v5'
var userMinCount = env == 'prod' ? 3 : 1
var userMaxCount = env == 'prod' ? 10 : 3

// Zone redundancy: spread across 3 zones for prod HA; single zone for dev/staging
var availabilityZones = env == 'prod' ? [ 1, 2, 3 ] : []

// Private cluster: enabled for all environments.
// This removes the remaining public API-server dependency from dev and aligns the baseline
// with the challenger requirement for a consistently private AKS control plane.
var enablePrivateCluster = true

// ─────────────────────────────── AKS Managed Cluster ─────────────────────────

module aksCluster 'br/public:avm/res/container-service/managed-cluster:0.11.0' = {
  name: 'aks-cluster'
  params: {
    name: aksName
    location: location
    tags: tags

    // Kubernetes version 1.30 (LTS channel)
    kubernetesVersion: '1.30'

    // SKU tier — environment-specific
    skuTier: skuTier

    // ── Identity ─────────────────────────────────────────────────────────────
    // User-assigned identity shared with Key Vault, ACR, and other platform components.
    managedIdentities: {
      userAssignedResourceIds: [ managedIdentityId ]
    }

    // ── System node pool ─────────────────────────────────────────────────────
    // Runs kube-system workloads. Zone-redundant for prod, single-AZ for dev/staging.
    primaryAgentPoolProfiles: [
      {
        name: 'systempool'
        count: systemNodeCount
        vmSize: systemVmSize
        osType: 'Linux'
        osSKU: 'Ubuntu'
        mode: 'System'
        enableAutoScaling: false
        osDiskType: 'Managed'
        osDiskSizeGB: 128
        maxPods: 30
        vnetSubnetResourceId: aksSubnetId
        availabilityZones: availabilityZones
      }
    ]

    // ── User node pool ────────────────────────────────────────────────────────
    // Runs application workloads with horizontal autoscaling.
    agentPools: [
      {
        name: 'userpool'
        count: userMinCount
        vmSize: userVmSize
        osType: 'Linux'
        osSKU: 'Ubuntu'
        mode: 'User'
        enableAutoScaling: true
        minCount: userMinCount
        maxCount: userMaxCount
        osDiskType: 'Managed'
        osDiskSizeGB: 128
        maxPods: 30
        vnetSubnetResourceId: aksSubnetId
        availabilityZones: availabilityZones
      }
    ]

    // ── Networking ────────────────────────────────────────────────────────────
    // Azure CNI (pods get VNet IPs from snet-aks) with Calico network policy enforcement.
    networkPlugin: 'azure'
    networkPolicy: 'calico'

    // ── API Server Access ─────────────────────────────────────────────────────
    // ALL environments restrict API server access — no environment exposes the API server publicly.
    //
    // All environments: full private cluster. API server is accessible only via Private Link
    //   (not routable from the public internet regardless of IP). privateDNSZone: 'system'
    //   delegates private DNS zone creation to AKS.
    // NOTE: enablePrivateCluster is an AVM-abstracted parameter mapping to
    //   properties.apiServerAccessProfile.enablePrivateCluster in the ARM resource.
    //   If the AVM v0.11.0 schema does not expose this parameter by name, replace with:
    //     apiServerAccessProfile: { enablePrivateCluster: enablePrivateCluster }
    enablePrivateCluster: enablePrivateCluster
    privateDNSZone: 'system'
    authorizedIPRanges: null

    // ── RBAC / Azure AD ───────────────────────────────────────────────────────
    // Kubernetes RBAC + Azure AD group-based access (no local K8s accounts).
    // POL-017: Azure RBAC integration — no static kubeconfig secrets.
    enableRBAC: true
    aadProfile: {
      aadProfileManaged: true
      aadProfileEnableAzureRBAC: true
    }

    // ── Add-ons ───────────────────────────────────────────────────────────────
    // Container Insights — sends cluster metrics/logs to Log Analytics (POL-022).
    // enableContainerInsights replaces omsAgentEnabled in AVM v0.11.0+
    enableContainerInsights: true
    monitoringWorkspaceResourceId: workspaceId

    // Azure Policy addon — enforces OPA Gatekeeper policies on cluster (POL-016).
    // azurePolicyVersion enables the addon (value controls policy agent version)
    azurePolicyVersion: 'v2'

    // ── Diagnostic Settings (POL-022) ─────────────────────────────────────────
    diagnosticSettings: [
      {
        workspaceResourceId: workspaceId
        logCategoriesAndGroups: [
          { categoryGroup: 'allLogs' }
        ]
        metricCategories: [
          { category: 'AllMetrics' }
        ]
      }
    ]
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('AKS Managed Cluster resource ID.')
output aksId string = aksCluster.outputs.resourceId

@description('AKS cluster name.')
output aksClusterName string = aksCluster.outputs.name

@description('AKS OIDC issuer URL (for Workload Identity federation).')
output aksOidcIssuerUrl string = aksCluster.outputs.?oidcIssuerUrl ?? ''
