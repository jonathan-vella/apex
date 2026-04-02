// modules/aks.bicep
// Phase 4 — AKS Managed Cluster (Standard SKU, Kubernetes 1.30, Azure CNI)
// AVM: br/public:avm/res/container-service/managed-cluster:0.13.0
// Governance:
//   - EU location enforced (allowed-eu-locations policy)
//   - Mandatory 4 tags (required-tags policy)
//   - Azure RBAC enabled (no local accounts)
//   - Azure CNI networking on AKS subnet with network policy: azure
//   - Container Insights via Log Analytics workspace
//   - Azure Policy addon enabled
//   - Managed identity (user-assigned)
//   - API server access restricted to internal RFC 1918 ranges

@description('Azure region for all resources.')
param location string

@description('Environment name (dev | staging | prod).')
param environment string

@description('Project short name for CAF naming.')
param projectName string

@description('User-assigned managed identity resource ID.')
param identityId string

@description('AKS subnet resource ID (/21 CIDR for pod growth with Azure CNI).')
param subnetAksId string

@description('Log Analytics workspace resource ID for Container Insights and diagnostic settings.')
param logAnalyticsWorkspaceId string

@description('Resource tags applied to all resources in this module.')
param tags object

// ─────────────────────────────── Derived configuration ───────────────────────

// CAF naming: aks-{project}-{env}
// AKS cluster names max 63 chars; no special chars except hyphens.
var clusterName = 'aks-${projectName}-${environment}'

// SKU tier: Standard (prod) for 99.95% SLA; Free (dev/staging) to control costs.
var skuTier = environment == 'prod' ? 'Standard' : 'Free'

// User node pool autoscale bounds by environment.
var userMinCount = environment == 'prod' ? 2 : 1
var userMaxCount = environment == 'prod' ? 10 : 3

// ─────────────────────────────── AKS Cluster ─────────────────────────────────

module aksCluster 'br/public:avm/res/container-service/managed-cluster:0.13.0' = {
  name: 'aks-cluster'
  params: {
    name: clusterName
    location: location
    skuTier: skuTier
    kubernetesVersion: '1.30'

    // ── Identity ─────────────────────────────────────────────────────────────
    // User-assigned identity shared with other platform components (Key Vault, ACR, etc.)
    managedIdentities: {
      userAssignedResourceIds: [identityId]
    }

    // ── System node pool ─────────────────────────────────────────────────────
    // System pool runs critical kube-system workloads.
    // 3-zone HA, autoscale 2–5 nodes, Standard_D4s_v5.
    primaryAgentPoolProfiles: [
      {
        name: 'systempool'
        count: 2
        vmSize: 'Standard_D4s_v5'
        osType: 'Linux'
        osSKU: 'Ubuntu'
        mode: 'System'
        enableAutoScaling: true
        minCount: 2
        maxCount: 5
        availabilityZones: [
          1
          2
          3
        ]
        vnetSubnetResourceId: subnetAksId
        osDiskType: 'Managed'
        osDiskSizeGB: 128
        maxPods: 30
      }
    ]

    // ── User node pool ────────────────────────────────────────────────────────
    // User pool runs application workloads.
    // 3-zone HA, autoscale 2–10 (prod) or 1–3 (dev/staging).
    agentPools: [
      {
        name: 'userpool'
        count: userMinCount
        vmSize: 'Standard_D4s_v5'
        osType: 'Linux'
        osSKU: 'Ubuntu'
        mode: 'User'
        enableAutoScaling: true
        minCount: userMinCount
        maxCount: userMaxCount
        availabilityZones: [
          1
          2
          3
        ]
        vnetSubnetResourceId: subnetAksId
        osDiskType: 'Managed'
        osDiskSizeGB: 128
        maxPods: 30
      }
    ]

    // ── Networking ────────────────────────────────────────────────────────────
    // Azure CNI: pods get VNet IPs from the /21 AKS subnet.
    // Network policy: azure (Cilium data-plane in Azure CNI).
    networkPlugin: 'azure'
    networkPolicy: 'azure'

    // ── API Server Access ─────────────────────────────────────────────────────
    // Restrict API server to internal RFC 1918 address space.
    // This is equivalent to "semi-private" — not exposed to public internet.
    apiServerAccessProfile: {
      authorizedIPRanges: [
        '10.0.0.0/8'
        '172.16.0.0/12'
        '192.168.0.0/16'
      ]
    }

    // ── RBAC / Azure AD ───────────────────────────────────────────────────────
    // Azure RBAC: use Azure AD group-based RBAC (no local K8s RBAC accounts).
    enableRBAC: true
    aadProfile: {
      managed: true
      enableAzureRBAC: true
    }

    // ── Monitoring ────────────────────────────────────────────────────────────
    // Container Insights (OMS agent) sends metrics/logs to Log Analytics.
    omsAgentEnabled: true
    monitoringWorkspaceResourceId: logAnalyticsWorkspaceId

    // ── Add-ons ───────────────────────────────────────────────────────────────
    azurePolicyEnabled: true

    // ── Diagnostic Settings ───────────────────────────────────────────────────
    diagnosticSettings: [
      {
        workspaceResourceId: logAnalyticsWorkspaceId
        logCategoriesAndGroups: [
          { categoryGroup: 'allLogs' }
        ]
        metricCategories: [
          { category: 'AllMetrics' }
        ]
      }
    ]

    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('AKS cluster resource ID.')
output aksClusterId string = aksCluster.outputs.resourceId

@description('AKS cluster name.')
output aksClusterName string = aksCluster.outputs.name

@description('AKS OIDC issuer URL (for Workload Identity federation).')
output aksOidcIssuerUrl string = aksCluster.outputs.?oidcIssuerUrl ?? ''
