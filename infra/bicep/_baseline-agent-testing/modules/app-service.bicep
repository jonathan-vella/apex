// ============================================================================
// App Service Module (Scenario 2: API + Database)
// ============================================================================
// Purpose: Deploy App Service for API testing
// AVM Reference: br/public:avm/res/web/site
// Security: HTTPS-only, TLS 1.2, Managed Identity enabled
// ============================================================================

@description('Name of the App Service')
param name string

@description('Azure region for deployment')
param location string

@description('Resource tags')
param tags object

@description('App Service Plan resource ID')
param serverFarmResourceId string

@description('Key Vault name for secret references')
param keyVaultName string = ''

@description('Runtime stack')
param linuxFxVersion string = 'DOTNETCORE|8.0'

// ============================================================================
// App Service Resource
// ============================================================================

resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: serverFarmResourceId
    httpsOnly: true // PCI DSS requirement
    siteConfig: {
      linuxFxVersion: linuxFxVersion
      minTlsVersion: '1.2' // PCI DSS requirement
      ftpsState: 'Disabled'
      http20Enabled: true
      alwaysOn: false // Cost optimization for test resources
      appSettings: [
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'KeyVaultName'
          value: keyVaultName
        }
      ]
    }
    clientAffinityEnabled: false
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('App Service default hostname')
output defaultHostname string = appService.properties.defaultHostName

@description('App Service resource ID')
output resourceId string = appService.id

@description('App Service name')
output name string = appService.name

@description('App Service system-assigned managed identity principal ID')
output principalId string = appService.identity.principalId
