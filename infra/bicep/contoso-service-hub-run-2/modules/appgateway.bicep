// modules/appgateway.bicep — Application Gateway WAF v2
// AVM: br/public:avm/res/network/public-ip-address:0.7.0 (Public IP)
// Raw: Microsoft.Network/applicationGateways (WAF v2 classic model)
//      Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies (WAF Policy)
//      Microsoft.Insights/diagnosticSettings (diagnostics)
// Note: AVM application-gateway:0.5.0 exposes a simplified routing model that does not
//       expose classic WAF v2 properties (gatewayIPConfigurations, frontendIPConfigurations,
//       backendAddressPools, httpListeners, requestRoutingRules, probes, sslCertificates).
//       Raw resource is used for the gateway to enable full WAF v2 classic configuration.
// Governance:
//   POL-001 — EU-only region (swedencentral enforced by location param)
//   POL-002 — Required governance tags (passed via tags param)
//   POL-015 — WAF Prevention mode, OWASP CRS 3.2 (ADR-003: EU Data Boundary — replaces Front Door)
//   POL-022 — Diagnostic settings to Log Analytics
// Security: TLS 1.2 minimum (AppGwSslPolicy20220101), WAF Prevention mode, HTTPS-only listeners
// ADR-003: Application Gateway WAF v2 selected over Front Door for EU Data Boundary compliance.

@description('Azure region for all resources (must be swedencentral, POL-001).')
param location string

@description('Deployment environment — controls autoscaling limits and zone redundancy.')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

@description('Deterministic suffix derived from resource group ID (passed from main.bicep).')
#disable-next-line no-unused-params
param uniqueSuffix string

@description('Application Gateway name.')
param appGatewayName string

@description('Application Gateway dedicated subnet resource ID (snet-appgw).')
param appGwSubnetId string

@description('Log Analytics Workspace resource ID for diagnostic settings (POL-022).')
param workspaceId string

@description('User-assigned managed identity resource ID — grants App GW access to Key Vault for SSL certificates.')
param managedIdentityId string

@description('Backend hostname for regional ingress routing. The baseline uses the APIM gateway hostname rather than a hardcoded private IP placeholder.')
param backendHostName string

@secure()
@description('Key Vault secret identifier for the TLS certificate presented by the HTTPS listener.')
param sslCertificateKeyVaultSecretId string

// ─────────────────────────────── Environment sizing ──────────────────────────

// Autoscaling: prod=1–10 instances, dev/staging=1–2 instances (cost governance)
var minCapacity = 1
var maxCapacity = env == 'prod' ? 10 : 2

// Zone redundancy: enabled for prod across zones 1, 2, 3 (single-region HA, POL-001)
// dev/staging: no zones (cost saving)
// Note: AVM public-ip-address:0.7.0 zones param expects int array
var appGwZonesInt    = env == 'prod' ? [1, 2, 3] : []
// Raw Application Gateway 'zones' property requires string array
var appGwZonesString = env == 'prod' ? ['1', '2', '3'] : []

// ─────────────────────── Public IP for Application Gateway ───────────────────
// Standard SKU required for Application Gateway WAF v2.
// Static allocation ensures IP stability across restarts and zone failovers.

module publicIp 'br/public:avm/res/network/public-ip-address:0.7.0' = {
  name: 'appgw-public-ip'
  params: {
    name: 'pip-${appGatewayName}'
    location: location
    tags: tags

    // Standard SKU required for WAF_v2 Application Gateway
    skuName: 'Standard'

    // Static: IP is preserved across gateway restarts (zone reassignment stability)
    publicIPAllocationMethod: 'Static'

    // Zone redundancy mirrors the gateway (prod only) — int array for AVM public-ip
    zones: appGwZonesInt

    // POL-022: Diagnostic settings — Public IP metrics
    diagnosticSettings: [
      {
        workspaceResourceId: workspaceId
        metricCategories: [
          {
            category: 'AllMetrics'
            enabled: true
          }
        ]
      }
    ]
  }
}

// ────────────────────────── WAF Policy (Prevention Mode) ─────────────────────
// Separate WAF Policy resource (modern pattern, preferred over inline WAF config).
// POL-015: OWASP CRS 3.2, Prevention mode — blocks rather than just detects threats.
// ADR-003: EU Data Boundary — all inspection stays within swedencentral.

resource wafPolicy 'Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies@2024-01-01' = {
  name: 'wafpol-${appGatewayName}'
  location: location
  tags: tags
  properties: {
    policySettings: {
      // Prevention mode: blocks requests that match WAF rules (POL-015 Deny compliance)
      mode: 'Prevention'
      state: 'Enabled'
      // Request body inspection: enabled (catches injection in POST bodies)
      requestBodyCheck: true
      maxRequestBodySizeInKb: 128
      fileUploadLimitInMb: 100
    }
    managedRules: {
      managedRuleSets: [
        {
          // OWASP CRS 3.2: latest rule set covering OWASP Top 10 (POL-015)
          ruleSetType: 'OWASP'
          ruleSetVersion: '3.2'
          ruleGroupOverrides: []
        }
        {
          // Microsoft_BotManagerRuleSet: blocks known bad bots
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'
          ruleGroupOverrides: []
        }
      ]
      exclusions: []
    }
    customRules: []
  }
}

// ─────────────────────────── Application Gateway WAF v2 ──────────────────────
// Classic WAF v2 configuration using raw Bicep resource for full property control.
// TLS 1.2+ enforced via predefined SSL policy AppGwSslPolicy20220101.
// The listener certificate is sourced from Key Vault via the managed identity.

resource appGateway 'Microsoft.Network/applicationGateways@2024-01-01' = {
  name: appGatewayName
  location: location
  tags: tags

  // Zone redundancy (prod only) — string array for ARM gateway resource
  zones: appGwZonesString

  // Managed identity: allows App GW to retrieve SSL certs from Key Vault
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }

  properties: {
    // WAF_v2 SKU: supports autoscaling, WAF policy, zone redundancy
    sku: {
      name: 'WAF_v2'
      tier: 'WAF_v2'
    }

    // Autoscaling: replaces fixed capacity; no capacity field when autoscaleConfiguration set
    autoscaleConfiguration: {
      minCapacity: minCapacity
      maxCapacity: maxCapacity
    }

    // SSL Policy: TLS 1.2 minimum (security baseline) — strong cipher suites only
    sslPolicy: {
      policyType: 'Predefined'
      policyName: 'AppGwSslPolicy20220101'
    }

    // WAF policy reference (Prevention mode, OWASP CRS 3.2 — POL-015)
    firewallPolicy: {
      id: wafPolicy.id
    }

    // Gateway IP configuration: binds App GW to its dedicated subnet (snet-appgw)
    gatewayIPConfigurations: [
      {
        name: 'gateway-ip-config'
        properties: {
          subnet: {
            id: appGwSubnetId
          }
        }
      }
    ]

    // Frontend IP: Standard public IP (static allocation)
    frontendIPConfigurations: [
      {
        name: 'frontend-public-ip'
        properties: {
          publicIPAddress: {
            id: publicIp.outputs.resourceId
          }
        }
      }
    ]

    // Frontend port 443 — HTTPS only (no HTTP port 80 listener)
    frontendPorts: [
      {
        name: 'port-443'
        properties: {
          port: 443
        }
      }
    ]

    // SSL certificate: sourced from Key Vault via managed identity.
    sslCertificates: [
      {
        name: 'ssl-cert-kv'
        properties: {
          keyVaultSecretId: sslCertificateKeyVaultSecretId
        }
      }
    ]

    // Backend address pool: regional APIM gateway hostname.
    // This keeps the baseline ingress contract explicit and removes the earlier placeholder IP.
    backendAddressPools: [
      {
        name: 'apim-backend-pool'
        properties: {
          backendAddresses: [
            {
              fqdn: backendHostName
            }
          ]
        }
      }
    ]

    // Backend HTTP settings: HTTPS backend on port 443 with health probe
    backendHttpSettingsCollection: [
      {
        name: 'apim-https-settings'
        properties: {
          port: 443
          protocol: 'Https'
          cookieBasedAffinity: 'Disabled'
          requestTimeout: 30
          probe: {
            id: resourceId('Microsoft.Network/applicationGateways/probes', appGatewayName, 'apim-health-probe')
          }
          // Use backend FQDN as the host header.
          pickHostNameFromBackendAddress: true
        }
      }
    ]

    // Health probe: checks the default APIM gateway endpoint over HTTPS.
    probes: [
      {
        name: 'apim-health-probe'
        properties: {
          protocol: 'Https'
          host: backendHostName
          path: '/status-0123456789abcdef'
          interval: 30
          timeout: 30
          unhealthyThreshold: 3
          pickHostNameFromBackendHttpSettings: false
          match: {
            statusCodes: ['200-399']
          }
        }
      }
    ]

    // HTTPS listener on port 443 with WAF policy and Key Vault-backed certificate.
    httpListeners: [
      {
        name: 'https-listener'
        properties: {
          frontendIPConfiguration: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendIPConfigurations', appGatewayName, 'frontend-public-ip')
          }
          frontendPort: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', appGatewayName, 'port-443')
          }
          protocol: 'Https'
          sslCertificate: {
            id: resourceId('Microsoft.Network/applicationGateways/sslCertificates', appGatewayName, 'ssl-cert-kv')
          }
          // WAF policy applied at listener scope for per-listener policy flexibility
          firewallPolicy: {
            id: wafPolicy.id
          }
          requireServerNameIndication: false
        }
      }
    ]

    // Basic routing rule: all HTTPS traffic routed to the APIM backend pool.
    // Priority 100: lower number = higher priority (path-based rules can be added later)
    requestRoutingRules: [
      {
        name: 'default-routing-rule'
        properties: {
          ruleType: 'Basic'
          priority: 100
          httpListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGatewayName, 'https-listener')
          }
          backendAddressPool: {
            id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', appGatewayName, 'apim-backend-pool')
          }
          backendHttpSettings: {
            id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', appGatewayName, 'apim-https-settings')
          }
        }
      }
    ]
  }
}

// POL-022: Diagnostic settings — all AGW logs + metrics to central Log Analytics
resource appGatewayDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${appGatewayName}'
  scope: appGateway
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        // Access log: all incoming requests, response codes, latency
        category: 'ApplicationGatewayAccessLog'
        enabled: true
      }
      {
        // Performance log: throughput, connection count, healthy/unhealthy host counts
        category: 'ApplicationGatewayPerformanceLog'
        enabled: true
      }
      {
        // Firewall log: WAF rule matches (Prevention mode — includes blocked requests)
        category: 'ApplicationGatewayFirewallLog'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Application Gateway resource ID.')
output appGatewayId string = appGateway.id

@description('Application Gateway name.')
output appGatewayName string = appGateway.name

@description('Application Gateway public IP resource ID.')
output publicIpId string = publicIp.outputs.resourceId

@description('WAF Policy resource ID (Prevention mode, OWASP CRS 3.2).')
output wafPolicyId string = wafPolicy.id
