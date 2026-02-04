// ============================================================================
// Agent Testing Infrastructure - Parameters File
// ============================================================================
// Purpose: Default parameter values for deployment
// Usage: az deployment group create --template-file main.bicep --parameters main.bicepparam
// ============================================================================

using 'main.bicep'

// =============================================================================
// DEPLOYMENT PARAMETERS
// =============================================================================

// Azure region for deployment
param location = 'swedencentral'

// Environment (dev, staging, prod)
param environment = 'dev'

// Project name for resource naming
param projectName = 'agenttest'

// Resource owner (for tagging)
param owner = 'platform-team'

// Cost center for billing allocation
param costCenter = 'CC-AGENTOPS'

// SQL Administrator Azure AD Group Object ID
// IMPORTANT: This should be set at deployment time
// Use: az ad group show --group "SQL Administrators" --query id -o tsv
param sqlAdminGroupObjectId = ''  // Must be provided at deployment

// SQL Administrator Azure AD Group Name
param sqlAdminGroupName = 'SQL Administrators'
