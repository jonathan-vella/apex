// ============================================================================
// Parameters File - e2e-conductor-test
// ============================================================================
// Purpose: Default parameter values for deployment
// Usage: az deployment sub create --template-file main.bicep --parameters main.bicepparam
// ============================================================================

using './main.bicep'

// ============================================================================
// Required Parameters
// ============================================================================

param owner = 'DevOps Team'
param technicalContact = 'devops@example.com'

// ============================================================================
// Optional Parameters (using defaults)
// ============================================================================

// param projectName = 'e2e-conductor-test'
// param environment = 'dev'
// param location = 'westeurope'
// param costCenter = 'IT-001'
