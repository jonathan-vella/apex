// ============================================================================
// Automation Account Module for Test Resource Cleanup
// ============================================================================
// Purpose: Automated cleanup of expired test resource groups based on TTL tags
// Schedule: Runs every 30 minutes
// ============================================================================

@description('Name of the Automation Account')
param name string

@description('Azure region for deployment')
param location string

@description('Resource tags')
param tags object

@description('Name of the cleanup runbook')
param runbookName string = 'Cleanup-ExpiredTestResources'

@description('TTL duration in hours for test resources')
param ttlHours int = 2

@description('Base time for schedule calculation (defaults to deployment time)')
param baseTime string = utcNow()

// ============================================================================
// Automation Account Resource (Free Tier)
// ============================================================================

resource automationAccount 'Microsoft.Automation/automationAccounts@2023-11-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    sku: {
      name: 'Free'
    }
    publicNetworkAccess: true
    disableLocalAuth: false
  }
}

// ============================================================================
// Cleanup Runbook
// ============================================================================

resource cleanupRunbook 'Microsoft.Automation/automationAccounts/runbooks@2023-11-01' = {
  parent: automationAccount
  name: runbookName
  location: location
  tags: tags
  properties: {
    runbookType: 'PowerShell72'
    logProgress: true
    logVerbose: true
    description: 'Cleans up expired test resource groups based on TTL tag'
    publishContentLink: {
      uri: 'https://raw.githubusercontent.com/jonathan-vella/azure-agentic-infraops/main/scripts/cleanup-test-resources.ps1'
    }
  }
}

// ============================================================================
// Schedule (Every 30 minutes)
// ============================================================================

resource cleanupSchedule 'Microsoft.Automation/automationAccounts/schedules@2023-11-01' = {
  parent: automationAccount
  name: 'cleanup-schedule-30min'
  properties: {
    frequency: 'Minute'
    interval: 30
    startTime: dateTimeAdd(baseTime, 'PT10M') // Start 10 minutes from now
    timeZone: 'UTC'
    description: 'Runs cleanup every 30 minutes'
  }
}

// ============================================================================
// Job Schedule (Link Runbook to Schedule)
// ============================================================================

resource jobSchedule 'Microsoft.Automation/automationAccounts/jobSchedules@2023-11-01' = {
  parent: automationAccount
  name: guid('${automationAccount.id}-${cleanupRunbook.id}-${cleanupSchedule.id}')
  properties: {
    schedule: {
      name: cleanupSchedule.name
    }
    runbook: {
      name: cleanupRunbook.name
    }
    parameters: {
      TtlHours: '${ttlHours}'
      TagName: 'TTL'
    }
  }
}

// ============================================================================
// Variables for Runbook Configuration
// ============================================================================

resource ttlVariable 'Microsoft.Automation/automationAccounts/variables@2023-11-01' = {
  parent: automationAccount
  name: 'DefaultTtlHours'
  properties: {
    value: '"${ttlHours}"'
    isEncrypted: false
    description: 'Default TTL in hours for test resources'
  }
}

resource tagNameVariable 'Microsoft.Automation/automationAccounts/variables@2023-11-01' = {
  parent: automationAccount
  name: 'TtlTagName'
  properties: {
    value: '"TTL"'
    isEncrypted: false
    description: 'Tag name to check for TTL expiration'
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Automation Account resource ID')
output resourceId string = automationAccount.id

@description('Automation Account name')
output name string = automationAccount.name

@description('Automation Account principal ID for RBAC')
output principalId string = automationAccount.identity.principalId

@description('Runbook name')
output runbookName string = cleanupRunbook.name
