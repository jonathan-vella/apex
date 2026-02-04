// ============================================================================
// Agent Testing Framework - Parameter File
// ============================================================================
// Usage: az deployment group create -g <rg-name> -f main.bicep -p main.bicepparam
// ============================================================================

using './main.bicep'

// Environment is always 'test' for this framework
param environment = 'test'

// Primary region (CAF default)
param location = 'swedencentral'

// Project identification
param projectName = 'agent-testing'
param owner = 'platform-engineering'

// Test scenario name (used in tagging)
param scenarioName = 'all'

// Scenario toggles - set to false to skip specific scenarios
param deployScenario1 = true  // Static Web App (smoke tests)
param deployScenario2 = true  // API + Database
param deployScenario3 = true  // Microservices

// Cleanup automation (persistent infrastructure)
param deployCleanupAutomation = true

// SQL Server credentials
// IMPORTANT: Override these in CI/CD or use Key Vault reference
param sqlAdminLogin = 'sqladmin'
// param sqlAdminPassword = '' // Must be provided at deployment time
