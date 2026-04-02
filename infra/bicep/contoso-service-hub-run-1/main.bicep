// main.bicep — Contoso Service Hub orchestrator
// Scope: subscription — creates resource group then deploys phased modules
// Phase 1: Foundation (monitoring, identity, networking, private-dns, key-vault, budget, dns-zone)
// Phases 2-4: Placeholder stubs — uncomment when implementing subsequent phases
// Governance: swedencentral (EU Data Boundary), mandatory 4-tag policy, security baseline

targetScope = 'subscription'

// ─────────────────────────────── Parameters ──────────────────────────────────

@description('Azure region for all resources. Must be an approved EU region per governance policy.')
param location string = 'swedencentral'

@description('Environment name.')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'dev'

@description('Project short name used in CAF resource naming (e.g. contoso-svchub).')
param projectName string = 'contoso-svchub'

@description('Owner tag value — team or individual responsible for this workload.')
param owner string = 'Contoso'

@description('Monthly budget amount in USD. Dev=$1500, Staging=$2100, Prod=$7500.')
param budgetAmount int = 1500

@description('Email addresses for budget threshold alerts (80%/100%/120%).')
param budgetContactEmails array = [
  'platform@contoso.com'
]

@description('Public DNS zone name used for externally routable endpoints.')
param publicDnsZoneName string = 'dev.contoso-svchub.com'

@description('''
Deployment phase controlling which module groups are provisioned.
1 = Foundation (monitoring, identity, networking, DNS, Key Vault, budget)
2 = Foundation + Data (PostgreSQL, Redis, Storage)
3 = Foundation + Data + Edge (WAF, App Gateway, APIM)
4 = All phases including Platform (AKS, VMs)
''')
@minValue(1)
@maxValue(4)
param deploymentPhase int = 1

@description('PostgreSQL administrator login name. Required by ARM API even when Entra-only auth is enabled.')
param postgresAdminLogin string = 'pgadmin'

@description('PostgreSQL administrator login password. Blocked from use — Entra-only auth is enforced via authConfig.')
@secure()
param postgresAdminPassword string

@description('APIM publisher email address. Required by Azure API Management.')
param apimPublisherEmail string = 'platform@contoso.com'

@description('APIM publisher display name shown in the developer portal.')
param apimPublisherName string = 'Contoso Platform Engineering'

@description('SSH public key for the utility VM azureuser account (Phase 4). Must be a valid RSA public key in OpenSSH format. Required when deploymentPhase >= 4.')
@secure()
param vmSshPublicKey string = ''

// ─────────────────────────────────── Variables ───────────────────────────────

var rgName = 'rg-${projectName}-${environment}'

// Unique 4-char suffix derived from subscription + project + environment.
// Deterministic across idempotent runs. Used for length-constrained resources
// (Key Vault ≤24 chars, Storage Account ≤24 chars, APIM global uniqueness).
var uniqueSuffix = take(uniqueString(subscription().id, projectName, environment), 4)

// Required governance tags — satisfy Azure Policy: "Require mandatory governance tags"
// All 4 tags must be present on every resource per Deny policy.
var tags = {
  Environment: environment
  ManagedBy: 'Bicep'
  Project: 'contoso-service-hub'
  Owner: owner
}

var phase1Enabled = deploymentPhase >= 1
var phase2Enabled = deploymentPhase >= 2
var phase3Enabled = deploymentPhase >= 3
var phase4Enabled = deploymentPhase >= 4

// ─────────────────────────────── Resource Group ──────────────────────────────
// Created at subscription scope. Tags propagated by Azure Policy (Modify/Inherit).

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: rgName
  location: location
  tags: tags
}

// ─────────────────────────── Phase 1: Foundation ─────────────────────────────
// Dependency order: monitoring → identity → networking → private-dns → key-vault
//                  budget and dns-zone are independent of the above chain

// 1.1 — Centralised observability (Log Analytics + Application Insights)
module monitoring 'modules/monitoring.bicep' = if (phase1Enabled) {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    tags: tags
  }
}

// 1.2 — Shared User-Assigned Managed Identity
module identity 'modules/identity.bicep' = if (phase1Enabled) {
  name: 'identity'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    tags: tags
  }
}

// 1.3 — Virtual Network, subnets, NSGs
module networking 'modules/networking.bicep' = if (phase1Enabled) {
  name: 'networking'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    tags: tags
  }
}

// 1.4 — Private DNS zones + VNet links (requires VNet from networking)
module privateDns 'modules/private-dns.bicep' = if (phase1Enabled) {
  name: 'private-dns'
  scope: rg
  params: {
    vnetId: networking.outputs.vnetId
    tags: tags
  }
}

// 1.5 — Key Vault with RBAC, purge protection, PE (requires networking + privateDns + identity)
module keyVault 'modules/key-vault.bicep' = if (phase1Enabled) {
  name: 'key-vault'
  scope: rg
  params: {
    location: location
    environment: environment
    uniqueSuffix: uniqueSuffix
    identityPrincipalId: identity.outputs.identityPrincipalId
    subnetPeId: networking.outputs.subnetPeId
    privateDnsZoneKeyVaultId: privateDns.outputs.dnsZoneKeyVaultId
    tags: tags
  }
}

// 1.6 — Consumption budget with 4 alert thresholds
module budget 'modules/budget.bicep' = if (phase1Enabled) {
  name: 'budget'
  scope: rg
  params: {
    environment: environment
    projectName: projectName
    budgetAmount: budgetAmount
    contactEmails: budgetContactEmails
  }
}

// 1.7 — Public DNS zone for externally routable endpoints
module dnsZone 'modules/dns-zone.bicep' = if (phase1Enabled) {
  name: 'dns-zone'
  scope: rg
  params: {
    dnsZoneName: publicDnsZoneName
    tags: tags
  }
}

// ── Phase 2: Data ─────────────────────────────────────────────────────────────
// Requires Phase 1 to be complete. Deploy with deploymentPhase=2.

// 2.1 — PostgreSQL Flexible Server (VNet injection, Entra-only auth, TLS 1.2)
module postgresql 'modules/postgresql.bicep' = if (phase2Enabled) {
  name: 'postgresql'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    uniqueSuffix: uniqueSuffix
    subnetDataId: networking.outputs.subnetDataId
    privateDnsZonePostgreSqlId: privateDns.outputs.dnsZonePostgreSqlId
    identityId: identity.outputs.identityId
    identityPrincipalId: identity.outputs.identityPrincipalId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    postgresAdminLogin: postgresAdminLogin
    postgresAdminPassword: postgresAdminPassword
    tags: tags
  }
}

// 2.2 — Azure Managed Redis Enterprise (private endpoint, TLS 1.2)
module redis 'modules/redis.bicep' = if (phase2Enabled) {
  name: 'redis'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    subnetPeId: networking.outputs.subnetPeId
    privateDnsZoneRedisId: privateDns.outputs.dnsZoneRedisId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    tags: tags
  }
}

// 2.3 — Storage Account (ZRS, blob + file private endpoints, managed identity RBAC)
module storage 'modules/storage.bicep' = if (phase2Enabled) {
  name: 'storage'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    uniqueSuffix: uniqueSuffix
    subnetPeId: networking.outputs.subnetPeId
    privateDnsZoneBlobId: privateDns.outputs.dnsZoneBlobId
    privateDnsZoneFileId: privateDns.outputs.dnsZoneFileId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    identityPrincipalId: identity.outputs.identityPrincipalId
    tags: tags
  }
}

// ── Phase 3: Edge ────────────────────────────────────────────────────────────
// Requires Phases 1-2 to be complete. Deploy with deploymentPhase=3.

// 3.1 — Application Gateway WAF_v2 + WAF Policy (replaces Front Door for EU Data Boundary)
module waf 'modules/waf.bicep' = if (phase3Enabled) {
  name: 'waf'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    subnetAppGwId: networking.outputs.subnetAppGwId
    identityId: identity.outputs.identityId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    tags: tags
  }
}

// 3.2 — API Management (StandardV2 for prod, Developer for dev/staging)
module apim 'modules/apim.bicep' = if (phase3Enabled) {
  name: 'apim'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    uniqueSuffix: uniqueSuffix
    subnetApimId: networking.outputs.subnetApimId
    identityId: identity.outputs.identityId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    publisherEmail: apimPublisherEmail
    publisherName: apimPublisherName
    tags: tags
  }
}

// ── Phase 4: Platform ────────────────────────────────────────────────────────
// Requires Phases 1-3 to be complete. Deploy with deploymentPhase=4.

// 4.1 — AKS Managed Cluster (Standard SKU, Kubernetes 1.30, Azure CNI, Azure RBAC)
module aks 'modules/aks.bicep' = if (phase4Enabled) {
  name: 'aks'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    identityId: identity.outputs.identityId
    subnetAksId: networking.outputs.subnetAksId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    tags: tags
  }
}

// 4.2 — Utility Virtual Machine (Ubuntu 22.04 LTS, no public IP, encryption at host)
module utilityVm 'modules/vm.bicep' = if (phase4Enabled) {
  name: 'utility-vm'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    identityId: identity.outputs.identityId
    subnetComputeId: networking.outputs.subnetComputeId
    vmSshPublicKey: vmSshPublicKey
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Name of the provisioned resource group.')
output resourceGroupName string = rg.name

@description('Unique 4-character suffix used for globally unique resource names.')
output uniqueSuffix string = uniqueSuffix

@description('Log Analytics workspace resource ID (available when phase >= 1).')
output logAnalyticsWorkspaceId string = phase1Enabled ? monitoring.outputs.logAnalyticsWorkspaceId : ''

@description('Application Insights resource ID (available when phase >= 1).')
output applicationInsightsId string = phase1Enabled ? monitoring.outputs.applicationInsightsId : ''

@description('Application Insights connection string (available when phase >= 1).')
output applicationInsightsConnectionString string = phase1Enabled ? monitoring.outputs.applicationInsightsConnectionString : ''

@description('Managed identity resource ID (available when phase >= 1).')
output identityId string = phase1Enabled ? identity.outputs.identityId : ''

@description('Managed identity principal ID for RBAC assignments (available when phase >= 1).')
output identityPrincipalId string = phase1Enabled ? identity.outputs.identityPrincipalId : ''

@description('Virtual network resource ID (available when phase >= 1).')
output vnetId string = phase1Enabled ? networking.outputs.vnetId : ''

@description('Private Endpoint subnet resource ID (available when phase >= 1).')
output subnetPeId string = phase1Enabled ? networking.outputs.subnetPeId : ''

@description('Key Vault URI (available when phase >= 1).')
output keyVaultUri string = phase1Enabled ? keyVault.outputs.keyVaultUri : ''

@description('Key Vault resource ID (available when phase >= 1).')
output keyVaultId string = phase1Enabled ? keyVault.outputs.keyVaultId : ''

@description('Public DNS zone resource ID (available when phase >= 1).')
output publicDnsZoneId string = phase1Enabled ? dnsZone.outputs.dnsZoneId : ''

@description('Public DNS zone name servers — delegate from domain registrar (available when phase >= 1).')
output publicDnsNameServers array = phase1Enabled ? dnsZone.outputs.nameServers : []

// ── Phase 2 outputs ──────────────────────────────────────────────────────────
// Null-safe access (?.): when phase < 2 the conditional modules are null;
// the ?? '' coalesces to empty string rather than failing the deployment.

@description('PostgreSQL Flexible Server resource ID (available when phase >= 2).')
output postgresqlServerId string = postgresql.?outputs.postgresqlServerId ?? ''

@description('PostgreSQL Flexible Server FQDN (available when phase >= 2).')
output postgresqlServerFqdn string = postgresql.?outputs.postgresqlServerFqdn ?? ''

@description('Redis Enterprise cluster resource ID (available when phase >= 2).')
output redisId string = redis.?outputs.redisId ?? ''

@description('Redis Enterprise cluster host name (available when phase >= 2).')
output redisHostName string = redis.?outputs.redisHostName ?? ''

@description('Storage account resource ID (available when phase >= 2).')
output storageAccountId string = storage.?outputs.storageAccountId ?? ''

@description('Storage account name (available when phase >= 2).')
output storageAccountName string = storage.?outputs.storageAccountName ?? ''

@description('Primary blob endpoint URL (available when phase >= 2).')
output blobEndpoint string = storage.?outputs.blobEndpoint ?? ''

@description('Primary file endpoint URL (available when phase >= 2).')
output fileEndpoint string = storage.?outputs.fileEndpoint ?? ''

// ── Phase 3 outputs ──────────────────────────────────────────────────────────

@description('WAF Policy resource ID (available when phase >= 3).')
output wafPolicyId string = waf.?outputs.wafPolicyId ?? ''

@description('Application Gateway resource ID (available when phase >= 3).')
output appGatewayId string = waf.?outputs.appGatewayId ?? ''

@description('Application Gateway name (available when phase >= 3).')
output appGatewayName string = waf.?outputs.appGatewayName ?? ''

@description('Application Gateway public IP address (available when phase >= 3).')
output appGatewayPublicIpAddress string = waf.?outputs.appGatewayPublicIpAddress ?? ''

@description('API Management service resource ID (available when phase >= 3).')
output apimId string = apim.?outputs.apimId ?? ''

@description('API Management service name (available when phase >= 3).')
output apimName string = apim.?outputs.apimName ?? ''

@description('API Management gateway URL (available when phase >= 3).')
output apimGatewayUrl string = apim.?outputs.apimGatewayUrl ?? ''

// ── Phase 4 outputs ──────────────────────────────────────────────────────────

@description('AKS cluster resource ID (available when phase >= 4).')
output aksClusterId string = aks.?outputs.aksClusterId ?? ''

@description('AKS cluster name (available when phase >= 4).')
output aksClusterName string = aks.?outputs.aksClusterName ?? ''

@description('AKS OIDC issuer URL for Workload Identity federation (available when phase >= 4).')
output aksOidcIssuerUrl string = aks.?outputs.aksOidcIssuerUrl ?? ''

@description('Utility VM resource ID (available when phase >= 4).')
output utilityVmId string = utilityVm.?outputs.vmId ?? ''

@description('Utility VM name (available when phase >= 4).')
output utilityVmName string = utilityVm.?outputs.vmName ?? ''
