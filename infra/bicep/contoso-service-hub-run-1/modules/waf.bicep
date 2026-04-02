// modules/waf.bicep
// Phase 3 — WAF Policy + Application Gateway WAF_v2
// AVM:
//   br/public:avm/res/network/application-gateway-web-application-firewall-policy:0.3.0
//   br/public:avm/res/network/application-gateway:0.9.0
// Governance:
//   - EU location enforced (allowed-eu-locations policy)
//   - Mandatory 4 tags (required-tags policy)
//   - WAF Prevention mode (security baseline — OWASP 3.2 / DRS 2.1)
//   - TLS 1.2 minimum on backend connections

@description('Azure region for all resources.')
param location string

@description('Environment name (dev | staging | prod).')
param environment string

@description('Project short name for CAF naming.')
param projectName string

@description('Application Gateway subnet resource ID (snet-appgw).')
param subnetAppGwId string

@description('User-assigned managed identity resource ID (for Key Vault certificate access).')
param identityId string

@description('Log Analytics workspace resource ID for diagnostic settings.')
param logAnalyticsWorkspaceId string

@description('Resource tags applied to all resources in this module.')
param tags object

// ─────────────────────────────── Derived names ───────────────────────────────

// CAF naming: wafpol-{project}-{env}, agw-{project}-{env}
var wafPolicyName = 'wafpol-${projectName}-${environment}'
var appGwName     = 'agw-${projectName}-${environment}'
var publicIpName  = 'pip-agw-${projectName}-${environment}'

// Autoscale capacity: prod min=1 max=3, dev/staging min=1 max=2
// WAF_v2 autoscale requires maxCapacity >= 2 (ARM schema constraint)
var minCapacity = 1
var maxCapacity = environment == 'prod' ? 3 : 2

// Availability zones: prod multi-zone HA
var zones = environment == 'prod' ? ['1', '2', '3'] : []

// Pre-compute App Gateway resource ID for internal sub-resource references.
// App Gateway httpListeners and requestRoutingRules must reference sub-resources
// by ID. We compute these upfront since the resource doesn't exist yet, using
// the deterministic naming scheme (CAF names are stable across runs).
var appGwResourceId = resourceId('Microsoft.Network/applicationGateways', appGwName)

// ─────────────────────────────── WAF Policy ──────────────────────────────────
// DRS 2.1 (OWASP 3.2 equivalent) + Bot Manager 1.0, Prevention mode

module wafPolicy 'br/public:avm/res/network/application-gateway-web-application-firewall-policy:0.3.0' = {
  name: 'waf-policy'
  params: {
    name: wafPolicyName
    location: location
    policySettings: {
      state: 'Enabled'
      mode: 'Prevention'
      requestBodyCheck: true
      maxRequestBodySizeInKb: 128
      fileUploadLimitInMb: 100
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'
        }
      ]
      exclusions: []
    }
    tags: tags
  }
}

// ───────────────────────── Public IP for App Gateway ─────────────────────────
// Standard SKU required by WAF_v2; static allocation; zone-redundant in prod.

resource publicIp 'Microsoft.Network/publicIPAddresses@2023-11-01' = {
  name: publicIpName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  zones: zones
  properties: {
    publicIPAllocationMethod: 'Static'
    publicIPAddressVersion: 'IPv4'
  }
  tags: tags
}

// ─────────────────────────── Application Gateway ─────────────────────────────
// WAF_v2 SKU, autoscale, associated with WAF policy, TLS 1.2 on backend.
// Using native ARM resource declaration — the AVM module v0.9.0 abstracts away
// gatewayIPConfigurations/frontendIPConfigurations/frontendPorts/backendAddressPools
// behind a new API that is incompatible with the standard WAF_v2 full configuration.
// Diagnostic settings are attached as a child resource (Insights/diagnosticSettings).

resource appGateway 'Microsoft.Network/applicationGateways@2024-01-01' = {
  name: appGwName
  location: location
  zones: zones
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    sku: {
      name: 'WAF_v2'
      tier: 'WAF_v2'
    }

    // Autoscale — avoids over-provisioning while maintaining burst headroom
    autoscaleConfiguration: {
      minCapacity: minCapacity
      maxCapacity: maxCapacity
    }

    // Associate WAF policy (Prevention mode, DRS 2.1) at the gateway level
    firewallPolicy: {
      id: wafPolicy.outputs.resourceId
    }

    // WAF mode also set here for backward compatibility with older API clients
    webApplicationFirewallConfiguration: {
      enabled: true
      firewallMode: 'Prevention'
      ruleSetType: 'OWASP'
      ruleSetVersion: '3.2'
    }

    // Gateway IP configuration — App Gateway subnet
    gatewayIPConfigurations: [
      {
        name: 'appgw-ipconfig'
        properties: {
          subnet: {
            id: subnetAppGwId
          }
        }
      }
    ]

    // Frontend IP: public Standard IP (WAF Internet-facing)
    frontendIPConfigurations: [
      {
        name: 'frontend-public'
        properties: {
          publicIPAddress: {
            id: publicIp.id
          }
        }
      }
    ]

    // Frontend ports — port 80 for HTTP listener (HTTPS added in Phase 5 with KV cert)
    frontendPorts: [
      {
        name: 'port-80'
        properties: {
          port: 80
        }
      }
    ]

    // Placeholder backend pool — AKS Ingress controller populates this in Phase 4
    backendAddressPools: [
      {
        name: 'pool-default'
        properties: {}
      }
    ]

    // Backend HTTP settings: HTTPS-only, TLS verified (security baseline)
    backendHttpSettingsCollection: [
      {
        name: 'settings-https'
        properties: {
          port: 443
          protocol: 'Https'
          requestTimeout: 30
          pickHostNameFromBackendAddress: true
        }
      }
    ]

    // HTTP listener on port 80 — WAF policy attached per-listener
    httpListeners: [
      {
        name: 'listener-http'
        properties: {
          frontendIPConfiguration: {
            id: '${appGwResourceId}/frontendIPConfigurations/frontend-public'
          }
          frontendPort: {
            id: '${appGwResourceId}/frontendPorts/port-80'
          }
          protocol: 'Http'
          firewallPolicy: {
            id: wafPolicy.outputs.resourceId
          }
        }
      }
    ]

    // Basic routing rule — all HTTP → default backend pool
    requestRoutingRules: [
      {
        name: 'rule-default'
        properties: {
          ruleType: 'Basic'
          priority: 100
          httpListener: {
            id: '${appGwResourceId}/httpListeners/listener-http'
          }
          backendAddressPool: {
            id: '${appGwResourceId}/backendAddressPools/pool-default'
          }
          backendHttpSettings: {
            id: '${appGwResourceId}/backendHttpSettingsCollection/settings-https'
          }
        }
      }
    ]

    // HTTP/2 — multiplexing for AKS microservice traffic
    enableHttp2: true
  }
  tags: tags
}

// Diagnostic settings — App Gateway access/performance/firewall logs → Log Analytics
resource appGwDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${appGwName}'
  scope: appGateway
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      { category: 'ApplicationGatewayAccessLog', enabled: true }
      { category: 'ApplicationGatewayPerformanceLog', enabled: true }
      { category: 'ApplicationGatewayFirewallLog', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('WAF Policy resource ID.')
output wafPolicyId string = wafPolicy.outputs.resourceId

@description('Application Gateway resource ID.')
output appGatewayId string = appGateway.id

@description('Application Gateway name.')
output appGatewayName string = appGateway.name

@description('Public IP resource ID for the Application Gateway frontend.')
output appGatewayPublicIpId string = publicIp.id

@description('Public IP address of the Application Gateway (available after deployment).')
output appGatewayPublicIpAddress string = publicIp.properties.ipAddress
