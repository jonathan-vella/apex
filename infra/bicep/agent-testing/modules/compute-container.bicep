// ============================================================================
// Compute Container Module - Container Apps Environment & Container App
// ============================================================================
// Purpose: Container-based application hosting
// AVM Modules:
//   - app/managed-environment v0.11.3
//   - app/container-app v0.20.0
// ============================================================================

// =============================================================================
// PARAMETERS
// =============================================================================

@description('Azure region for resource deployment')
param location string

@description('Location abbreviation for naming')
param locationAbbr string

@description('Environment name')
param environment string

@description('Project name')
param projectName string

@description('Unique suffix for resource naming')
param uniqueSuffix string

@description('Tags for all resources')
param tags object

@description('Application Insights Connection String')
param applicationInsightsConnectionString string

// =============================================================================
// VARIABLES
// =============================================================================

// Resource naming following CAF pattern
var containerEnvName = 'cae-${projectName}-${environment}-${locationAbbr}-${take(uniqueSuffix, 6)}'
var containerAppName = 'ca-${projectName}-${environment}-${locationAbbr}-${take(uniqueSuffix, 6)}'

// =============================================================================
// RESOURCES
// =============================================================================

// -----------------------------------------------------------------------------
// Container Apps Environment
// AVM: avm/res/app/managed-environment v0.11.3
// Configuration: Consumption tier with Azure Monitor logging
// PITFALL: Use appLogsConfiguration object, not deprecated logAnalyticsWorkspaceResourceId
// -----------------------------------------------------------------------------

module containerAppsEnvironment 'br/public:avm/res/app/managed-environment:0.11.3' = {
  name: 'container-apps-environment'
  params: {
    name: containerEnvName
    location: location
    tags: tags

    // Logging configuration (CORRECT: use appLogsConfiguration object)
    appLogsConfiguration: {
      destination: 'azure-monitor'
    }

    // Zone redundancy (disabled for dev to save costs)
    zoneRedundant: false

    // Infrastructure subnet (none for consumption tier)
    internal: false

    // Managed identity
    managedIdentities: {
      systemAssigned: true
    }
  }
}

// -----------------------------------------------------------------------------
// Container App
// AVM: avm/res/app/container-app v0.20.0
// Configuration: Simple hello-world container for testing
// PITFALL: Use scaleSettings object (minReplicas, maxReplicas)
// -----------------------------------------------------------------------------

module containerApp 'br/public:avm/res/app/container-app:0.20.0' = {
  name: 'container-app'
  params: {
    name: containerAppName
    location: location
    tags: tags

    // Link to Container Apps Environment
    environmentResourceId: containerAppsEnvironment.outputs.resourceId

    // Managed identity
    managedIdentities: {
      systemAssigned: true
    }

    // Container configuration
    containers: [
      {
        name: 'main'
        image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        resources: {
          cpu: json('0.25') // JSON for decimal value
          memory: '0.5Gi'
        }
        env: [
          {
            name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
            value: applicationInsightsConnectionString
          }
        ]
      }
    ]

    // Scale settings (CORRECT: use scaleSettings object)
    scaleSettings: {
      minReplicas: 0 // Scale to zero for cost savings
      maxReplicas: 3
    }

    // Ingress configuration
    ingressExternal: true
    ingressTargetPort: 80
    ingressTransport: 'auto'
  }
}

// =============================================================================
// OUTPUTS
// =============================================================================

@description('Container Apps Environment Resource ID')
output containerAppsEnvironmentId string = containerAppsEnvironment.outputs.resourceId

@description('Container Apps Environment Name')
output containerAppsEnvironmentName string = containerAppsEnvironment.outputs.name

@description('Container Apps Environment Default Domain')
output containerAppsEnvironmentDefaultDomain string = containerAppsEnvironment.outputs.defaultDomain

@description('Container App Resource ID')
output containerAppId string = containerApp.outputs.resourceId

@description('Container App Name')
output containerAppName string = containerApp.outputs.name

@description('Container App FQDN')
output containerAppFqdn string = containerApp.outputs.fqdn

@description('Container App System Assigned Identity Principal ID')
output containerAppPrincipalId string = containerApp.outputs.systemAssignedMIPrincipalId ?? ''
