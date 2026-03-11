using 'main.bicep'

param projectName = 'nordic-fresh-foods'
param shortProjectName = 'nff'
param applicationName = 'freshconnect'
param environment = 'dev'
param location = 'swedencentral'
param phase = 'all'
param enablePrivateEndpoints = false

param appServicePlanSku = {
  name: 'B1'
  capacity: 1
}

param sqlDatabaseSku = {
  name: 'Basic'
  tier: 'Basic'
}

param sqlAdminGroupObjectId = '<replace-with-entra-group-object-id>'
param sqlAdminGroupName = '<replace-with-entra-group-name>'

param budgetAmount = 200
param budgetContactEmail = '<replace-with-budget-contact>'
param technicalContact = '<replace-with-technical-contact>'

// Governance-enforced tags (9 policy + derived)
param ownerTag = 'nordic-fresh-foods-team'
param costcenterTag = 'NFF-001'
param workloadTag = 'web-app-dev'
param slaTag = 'best-effort'
param backupPolicyTag = 'none'
param maintWindowTag = 'any'
