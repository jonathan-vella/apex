// ============================================================================
// App Service Plan Module (Scenario 2: API + Database)
// ============================================================================
// Purpose: Deploy App Service Plan for hosting web applications
// AVM Reference: br/public:avm/res/web/serverfarm
// ============================================================================

@description('Name of the App Service Plan')
param name string

@description('Azure region for deployment')
param location string

@description('Resource tags')
param tags object

@description('SKU name for App Service Plan')
@allowed(['B1', 'B2', 'B3', 'S1', 'S2', 'S3', 'P1v3', 'P2v3', 'P3v3'])
param skuName string = 'B1'

@description('Number of instances')
@minValue(1)
@maxValue(10)
param skuCapacity int = 1

@description('Operating system for the App Service Plan')
@allowed(['Linux', 'Windows'])
param kind string = 'Linux'

// ============================================================================
// App Service Plan Resource
// ============================================================================

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: kind == 'Linux' ? 'linux' : 'app'
  sku: {
    name: skuName
    capacity: skuCapacity
  }
  properties: {
    reserved: kind == 'Linux'
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('App Service Plan resource ID')
output resourceId string = appServicePlan.id

@description('App Service Plan name')
output name string = appServicePlan.name
