using 'main.bicep'

param projectName = 'e2e-ralph-loop'
param shortProjectName = 'e2erlp'
param applicationName = 'nordicfresh'
param environment = 'prod'
param location = 'swedencentral'
param phase = 'all'

param appServicePlanSku = {
  name: 'B1'
  capacity: 1
}

param sqlDatabaseSku = {
  name: 'Basic'
  tier: 'Basic'
}

param sqlAdminPrincipalName = 'sql-admins'
param sqlAdminObjectId = '00000000-0000-0000-0000-000000000000'
param sqlAdminPrincipalType = 'Group'

param budgetAmount = 500
param budgetAlertEmails = [
  'e2e@example.com'
]
param technicalContactEmail = 'e2e@example.com'

param ownerTag = 'E2E'
param managedByTag = 'Bicep'
