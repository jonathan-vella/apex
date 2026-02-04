// ============================================================================
// Container Apps Environment Module (Scenario 3: Microservices)
// ============================================================================
// Purpose: Deploy Container Apps Environment for containerized workloads
// AVM Reference: br/public:avm/res/app/managed-environment
// ============================================================================

@description('Name of the Container Apps Environment')
param name string

@description('Azure region for deployment')
param location string

@description('Resource tags')
param tags object

@description('Enable zone redundancy')
param zoneRedundant bool = false

// ============================================================================
// Log Analytics Workspace (Required for Container Apps)
// ============================================================================

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${name}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30 // Minimal retention for test resources
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ============================================================================
// Container Apps Environment Resource
// ============================================================================

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    zoneRedundant: zoneRedundant
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// ============================================================================
// Sample Container App (for testing)
// ============================================================================

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-${take(name, 20)}'
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    workloadProfileName: 'Consumption'
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'hello-world'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0 // Scale to zero for cost optimization
        maxReplicas: 1
      }
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Container Apps Environment default domain')
output defaultDomain string = containerAppsEnv.properties.defaultDomain

@description('Container Apps Environment resource ID')
output resourceId string = containerAppsEnv.id

@description('Container Apps Environment name')
output name string = containerAppsEnv.name

@description('Container App FQDN')
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn

@description('Log Analytics Workspace ID')
output logAnalyticsWorkspaceId string = logAnalytics.id
