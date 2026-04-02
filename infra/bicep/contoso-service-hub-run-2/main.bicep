// main.bicep — Contoso Service Hub Run-2 Orchestrator
// Scope: resourceGroup — deploys phased modules into an existing resource group
// Phases:
//   foundation — monitoring, networking, identity, key-vault, budget
//   data       — storage, postgresql, redis
//   edge       — appgateway, apim
//   platform   — aks, bastion, vm
//   all        — all phases
// Governance: swedencentral (EU Data Boundary), live 9-tag resource-group baseline,
//             security baseline (TLS 1.2, HTTPS-only, no public blob, managed identity)

targetScope = 'resourceGroup'

// ─────────────────────────────── Parameters ──────────────────────────────────

@description('Deployment environment. Controls environment-specific sizing, retention, and budgets.')
@allowed([
  'dev'
  'staging'
  'prod'
])
param env string = 'dev'

@description('Azure region for all resources. Must be swedencentral per EU Data Boundary governance policy (POL-001).')
param location string = 'swedencentral'

@description('Deployment phase. Determines which module groups are provisioned in this run.')
@allowed([
  'foundation'
  'data'
  'edge'
  'platform'
  'all'
])
param deployPhase string = 'foundation'

@description('Owner tag value — team or individual responsible for this workload (LIVE-002, LIVE-003: required governance tag).')
param owner string

@description('Cost centre code for billing allocation (LIVE-002, LIVE-003: required governance tag).')
param costCenter string

@description('Application identifier for the workload (LIVE-002, LIVE-003: required governance tag).')
param application string

@description('Workload name for resource grouping (LIVE-002, LIVE-003: required governance tag).')
param workload string

@description('SLA tier classification for this workload (LIVE-002, LIVE-003: required governance tag).')
param sla string

@description('Backup policy identifier applied to data resources (LIVE-002, LIVE-003: required governance tag).')
param backupPolicy string

@description('Maintenance window specification in cron-like format (LIVE-002, LIVE-003: required governance tag).')
param maintWindow string

@description('Technical contact email — satisfies both the resource-group policy key (technical-contact, LIVE-002) and the resource inherit policy key (tech-contact, LIVE-004). Both keys are set on the resource to handle the documented live tag-key drift.')
param technicalContact string

@description('Email addresses for budget forecast alert notifications (80%/100%/120%).')
param budgetContactEmails array = [
  'platform-ops@contoso.com'
]

@description('APIM publisher email address — required by API Management; used for system notifications.')
param apimPublisherEmail string = 'platform-ops@contoso.com'

@description('APIM publisher organisation name displayed in the developer portal.')
param apimPublisherName string = 'Contoso'

@description('SSH public key for the management VM admin account (platform phase). RSA public key in OpenSSH format.')
@secure()
param vmSshPublicKey string

@description('Admin username for the management VM. Must not be a reserved OS username.')
param vmAdminUsername string = 'azureuser'

// ─────────────────────────────────── Variables ───────────────────────────────

// Generated once in main.bicep and passed to all modules that need globally unique names.
// Deterministic across idempotent runs within the same resource group (POL scope).
var uniqueSuffix = uniqueString(resourceGroup().id)

// 9-tag governance baseline — satisfies LIVE-002 (sdx RG Deny, subscription scope) and
// LIVE-003 (JV RG Deny, management-group scope). Both Deny policies block resource-group creation
// when any of the nine mandatory tag keys is absent.
// 'technical-contact' is the resource-group policy key (LIVE-002/LIVE-003).
// 'tech-contact' is the child-resource inherit policy key (LIVE-004 Modify effect).
// The live tag-key drift means these two keys differ; we set both to satisfy both policies.
// NOTE: tag inheritance (LIVE-004, Modify) is applied by Azure Policy — not enforced in this template.
var tags = {
  environment:          env
  owner:                owner
  costcenter:           costCenter
  application:          application
  workload:             workload
  sla:                  sla
  'backup-policy':      backupPolicy
  'maint-window':       maintWindow
  'technical-contact':  technicalContact
  'tech-contact':       technicalContact   // drift: LIVE-004 modify key differs from LIVE-002/003 deny key
  ManagedBy:            'Bicep'             // IaC tooling visibility (not a governance requirement)
}

// CAF-compliant resource names — generated once, passed to modules.
// Key Vault: max 24 chars; Storage: max 24 chars, no hyphens (computed in modules).
var resourceNames = {
  // Foundation
  vnet:                    'vnet-contoso-hub-${env}'
  logAnalytics:            'log-contoso-hub-${env}'
  appInsightsFrontend:     'appi-contoso-frontend-${env}'
  appInsightsBackend:      'appi-contoso-backend-${env}'
  appInsightsPlatform:     'appi-contoso-platform-${env}'
  managedIdentity:         'id-contoso-hub-${env}'
  keyVault:                take('kv-contoso-${env}-${uniqueSuffix}', 24)
  budget:                  'budget-contoso-hub-${env}'
  // Data (placeholder — Sub-phase E2)
  storageAccount:          take('stcontoso${env}${uniqueSuffix}', 24)
  postgresql:              'psql-contoso-hub-${env}'
  redis:                   'redis-contoso-hub-${env}'
  // Edge (placeholder — Sub-phase E3)
  appGateway:              'agw-contoso-hub-${env}'
  apim:                    'apim-contoso-hub-${env}'
  // Platform (placeholder — Sub-phase E4)
  aks:                     'aks-contoso-hub-${env}'
  bastion:                 'bas-contoso-hub-${env}'
  vm:                      'vm-contoso-mgmt-${env}'
}

// Phase selectors — cumulative deployment model.
// Foundation modules always deploy (they are idempotent and required by every later phase).
// 'data' = foundation + data; 'edge' = foundation + data + edge;
// 'platform' = foundation + data + edge + platform; 'all' = everything.
// This guarantees later phases never reference null prerequisite module outputs (BCP318 safe).
var isData     = deployPhase == 'data' || deployPhase == 'edge' || deployPhase == 'platform' || deployPhase == 'all'
var isEdge     = deployPhase == 'edge' || deployPhase == 'platform' || deployPhase == 'all'
var isPlatform = deployPhase == 'platform' || deployPhase == 'all'

// Environment-specific budget amount passed to budget module (separates sizing logic from alert config).
var budgetAmountByEnv = env == 'prod' ? 6000 : env == 'staging' ? 2500 : 1500

// ─────────────────────── Phase 1 — Foundation ────────────────────────────────
// Dependency order: monitoring → networking → identity → keyvault → budget
// monitoring and networking are independent; identity is independent.
// keyvault depends on monitoring (diagnostics) and networking (PE + DNS zone).

// 1.1 — Centralised observability (Log Analytics + 3× Application Insights)
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    env: env
    workspaceName: resourceNames.logAnalytics
    appInsightsFrontendName: resourceNames.appInsightsFrontend
    appInsightsBackendName: resourceNames.appInsightsBackend
    appInsightsPlatformName: resourceNames.appInsightsPlatform
    tags: tags
  }
}

// 1.2 — Hub-spoke VNet, NSGs per subnet, Private DNS Zones + VNet links
module networking 'modules/networking.bicep' = {
  name: 'networking'
  params: {
    location: location
    env: env
    vnetName: resourceNames.vnet
    tags: tags
  }
}

// 1.3 — User-Assigned Managed Identity (shared by AKS, APIM, App GW, VMs)
module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    location: location
    identityName: resourceNames.managedIdentity
    tags: tags
  }
}

// 1.4 — Key Vault with RBAC, purge protection, private endpoint (security baseline)
module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    keyVaultName: resourceNames.keyVault
    tags: tags
    workspaceId: monitoring.outputs.workspaceId
    dataSubnetId: networking.outputs.dataSubnetId
    kvPrivateDnsZoneId: networking.outputs.kvPrivateDnsZoneId
    identityPrincipalId: identity.outputs.identityPrincipalId
  }
}

// 1.5 — Consumption budget (env-specific amount, forecast 80%/100%/120% alert thresholds)
module budget 'modules/budget.bicep' = {
  name: 'budget'
  params: {
    budgetName: resourceNames.budget
    amount: budgetAmountByEnv
    contactEmails: budgetContactEmails
  }
}

// ─────────────────────── Phase 2 — Data ──────────────────────────────────────
// Dependency order: all three data modules depend on monitoring (workspaceId) and
// networking (dataSubnetId + DNS zone IDs). PostgreSQL additionally stores its
// admin credentials in Key Vault. Storage and Redis are independent of each other.

// 2.1 — Storage Account (StorageV2, ZRS for prod) with blob + file private endpoints
// POL-004,005,006,007: HTTPS-only, TLS 1.2, no public blob, private-only access
module storage 'modules/storage.bicep' = if (isData) {
  name: 'storage'
  params: {
    location: location
    env: env
    tags: tags
    uniqueSuffix: uniqueSuffix
    storageAccountName: resourceNames.storageAccount
    workspaceId: monitoring.outputs.workspaceId
    dataSubnetId: networking.outputs.dataSubnetId
    blobPrivateDnsZoneId: networking.outputs.blobPrivateDnsZoneId
    filePrivateDnsZoneId: networking.outputs.filePrivateDnsZoneId
  }
}

// 2.2 — PostgreSQL Flexible Server (GP D4ds_v5 prod / D2ds_v5 staging / B2s dev)
// POL-010,011,012: private-only, Entra-only auth, TLS 1.2
module postgresql 'modules/postgresql.bicep' = if (isData) {
  name: 'postgresql'
  params: {
    location: location
    env: env
    tags: tags
    uniqueSuffix: uniqueSuffix
    serverName: resourceNames.postgresql
    workspaceId: monitoring.outputs.workspaceId
    dataSubnetId: networking.outputs.dataSubnetId
    postgresPrivateDnsZoneId: networking.outputs.postgresPrivateDnsZoneId
  }
}

// 2.3 — Redis Enterprise (E50 128 GB prod / E10 staging / E10 dev)
// POL-013,014: private endpoint only, TLS 1.2
module redis 'modules/redis.bicep' = if (isData) {
  name: 'redis'
  params: {
    location: location
    env: env
    tags: tags
    uniqueSuffix: uniqueSuffix
    redisName: resourceNames.redis
    workspaceId: monitoring.outputs.workspaceId
    dataSubnetId: networking.outputs.dataSubnetId
    redisPrivateDnsZoneId: networking.outputs.redisPrivateDnsZoneId
  }
}

// ─────────────────────── Phase 3 — Edge ──────────────────────────────────────
// Dependency order: both modules depend on monitoring (workspaceId) and
// networking (appGwSubnetId for App GW). APIM is provisioned first so the
// Application Gateway can route to the APIM hostname as its regional backend.
// identity is required for App GW managed identity (Key Vault cert access).

// 3.1 — API Management Standard v2 (no classic VNet injection — StandardV2 uses dedicated compute)
// POL-021: system-assigned managed identity. POL-022: diagnostics to Log Analytics.
module apim 'modules/apim.bicep' = if (isEdge) {
  name: 'apim'
  params: {
    location:          location
    env:               env
    tags:              tags
    uniqueSuffix:      uniqueSuffix
    apimName:          resourceNames.apim
    workspaceId:       monitoring.outputs.workspaceId
    publisherEmail:    apimPublisherEmail
    publisherName:     apimPublisherName
  }
}

// 3.2 — Application Gateway WAF v2 (ADR-003: EU Data Boundary, replaces Front Door)
// POL-015: Prevention mode, OWASP CRS 3.2. TLS 1.2 via AppGwSslPolicy20220101.
// The baseline routes regional ingress to the APIM gateway hostname instead of a placeholder backend.
module appgateway 'modules/appgateway.bicep' = if (isEdge) {
  name: 'appgateway'
  params: {
    location:                     location
    env:                          env
    tags:                         tags
    uniqueSuffix:                 uniqueSuffix
    appGatewayName:               resourceNames.appGateway
    appGwSubnetId:                networking.outputs.appGwSubnetId
    workspaceId:                  monitoring.outputs.workspaceId
    managedIdentityId:            identity.outputs.identityId
    backendHostName:              replace(apim!.outputs.apimGatewayUrl, 'https://', '')
    sslCertificateKeyVaultSecretId: keyvault.outputs.appGatewayCertificateSecretId
  }
}

// ─────────────────────── Phase 4 — Platform ──────────────────────────────────
// Dependency order: all three depend on monitoring (workspaceId) and networking.
// AKS additionally needs identity (managedIdentityId).
// VM additionally needs identity (managedIdentityId).
// Bastion needs only vnetId — no identity dependency.
// BCP318 suppressed: isFoundation gate guarantees monitoring/networking/identity non-null when isPlatform=true.

// 4.1 — AKS Managed Cluster (Standard SKU, private API server all envs, Azure CNI + Calico)
// POL-016,017,018: Azure Policy addon, Azure RBAC, restricted API server access.
// The 'system' privateDNSZone value delegates private zone creation to AKS.
module aks 'modules/aks.bicep' = if (isPlatform) {
  name: 'aks'
  params: {
    location:           location
    env:                env
    tags:               tags
    uniqueSuffix:       uniqueSuffix
    aksName:            resourceNames.aks
    aksSubnetId:        networking.outputs.aksSubnetId
    workspaceId:        monitoring.outputs.workspaceId
    managedIdentityId:  identity.outputs.identityId
  }
}

// 4.2 — Azure Bastion (Standard SKU) — sole legitimate ingress to management VMs (POL-020)
// No identity dependency — Bastion accesses VMs via the Azure fabric.
module bastion 'modules/bastion.bicep' = if (isPlatform) {
  name: 'bastion'
  params: {
    location:     location
    env:          env
    tags:         tags
    bastionName:  resourceNames.bastion
    vnetId:       networking.outputs.vnetId
    workspaceId:  monitoring.outputs.workspaceId
  }
}

// 4.3 — Management / SDLC VM (D8s_v5 prod, no public IP, SSH key auth, Bastion access only)
// POL-019,020,021: disk encryption, private-only, managed identity.
module vm 'modules/vm.bicep' = if (isPlatform) {
  name: 'vm'
  params: {
    location:           location
    env:                env
    tags:               tags
    uniqueSuffix:       uniqueSuffix
    vmName:             resourceNames.vm
    mgmtSubnetId:       networking.outputs.mgmtSubnetId
    managedIdentityId:  identity.outputs.identityId
    vmSshPublicKey:     vmSshPublicKey
    vmAdminUsername:    vmAdminUsername
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

// Foundation modules are always deployed — outputs are always available.
@description('Virtual Network resource ID.')
output vnetId string = networking.outputs.vnetId

@description('Virtual Network name.')
output vnetName string = networking.outputs.vnetName

@description('Log Analytics Workspace resource ID.')
output workspaceId string = monitoring.outputs.workspaceId

@description('Log Analytics Workspace name.')
output workspaceName string = monitoring.outputs.workspaceName

@description('Application Insights — Frontend — connection string.')
output appInsightsFrontendConnectionString string = monitoring.outputs.appInsightsFrontendConnectionString

@description('Application Insights — Backend — connection string.')
output appInsightsBackendConnectionString string = monitoring.outputs.appInsightsBackendConnectionString

@description('Application Insights — Platform — connection string.')
output appInsightsPlatformConnectionString string = monitoring.outputs.appInsightsPlatformConnectionString

@description('Key Vault resource ID.')
output keyVaultId string = keyvault.outputs.keyVaultId

@description('Key Vault URI for secret references.')
output keyVaultUri string = keyvault.outputs.keyVaultUri

@description('User-Assigned Managed Identity resource ID.')
output managedIdentityId string = identity.outputs.identityId

@description('User-Assigned Managed Identity principal ID (for RBAC assignments).')
output managedIdentityPrincipalId string = identity.outputs.identityPrincipalId

@description('User-Assigned Managed Identity client ID (for workload identity federation).')
output managedIdentityClientId string = identity.outputs.identityClientId

@description('4-character unique suffix derived from resource group ID.')
output uniqueSuffix string = uniqueSuffix

// ─────────────────────────────── Data outputs ────────────────────────────────

@description('Storage account resource ID.')
output storageAccountId string = isData ? storage!.outputs.storageAccountId : ''

@description('Storage account primary blob endpoint.')
output storageBlobEndpoint string = isData ? storage!.outputs.blobEndpoint : ''

@description('PostgreSQL Flexible Server resource ID.')
output postgresqlId string = isData ? postgresql!.outputs.postgresqlId : ''

@description('PostgreSQL Flexible Server FQDN.')
output postgresqlFqdn string = isData ? postgresql!.outputs.postgresqlFqdn : ''

@description('Redis Enterprise cluster resource ID.')
output redisId string = isData ? redis!.outputs.redisId : ''

@description('Redis Enterprise cluster hostname.')
output redisHostname string = isData ? redis!.outputs.redisHostname : ''

// ─────────────────────────────── Edge outputs ────────────────────────────────

@description('Application Gateway resource ID.')
output appGatewayId string = isEdge ? appgateway!.outputs.appGatewayId : ''

@description('Application Gateway public IP resource ID.')
output appGatewayPublicIpId string = isEdge ? appgateway!.outputs.publicIpId : ''

@description('WAF Policy resource ID (Prevention mode, OWASP CRS 3.2).')
output wafPolicyId string = isEdge ? appgateway!.outputs.wafPolicyId : ''

@description('API Management service resource ID.')
output apimId string = isEdge ? apim!.outputs.apimId : ''

@description('API Management gateway URL.')
output apimGatewayUrl string = isEdge ? apim!.outputs.apimGatewayUrl : ''

// ─────────────────────────────── Platform outputs ────────────────────────────

@description('AKS Managed Cluster resource ID.')
output aksId string = isPlatform ? aks!.outputs.aksId : ''

@description('AKS cluster name.')
output aksClusterName string = isPlatform ? aks!.outputs.aksClusterName : ''

@description('AKS OIDC issuer URL (for Workload Identity federation).')
output aksOidcIssuerUrl string = isPlatform ? aks!.outputs.aksOidcIssuerUrl : ''

@description('Azure Bastion host resource ID.')
output bastionId string = isPlatform ? bastion!.outputs.bastionId : ''

@description('Azure Bastion host name.')
output bastionHostName string = isPlatform ? bastion!.outputs.bastionHostName : ''

@description('Management VM resource ID.')
output vmId string = isPlatform ? vm!.outputs.vmId : ''

@description('Management VM name.')
output vmName string = isPlatform ? vm!.outputs.vmName : ''

@description('API Management system-assigned managed identity principal ID.')
output apimPrincipalId string = isEdge ? apim!.outputs.apimPrincipalId : ''
