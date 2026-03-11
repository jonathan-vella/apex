using 'main.bicep'

param projectName = 'nordic-fresh-foods'
param shortProjectName = 'nff'
param applicationName = 'freshconnect'
param environment = 'prod'
param location = 'swedencentral'
param phase = 'all'
param enablePrivateEndpoints = true

param appServicePlanSku = {
  name: 'S1'
  capacity: 2
}

param sqlDatabaseSku = {
  name: 'S0'
  tier: 'Standard'
}

param sqlAdminGroupObjectId = '<replace-with-entra-group-object-id>'
param sqlAdminGroupName = '<replace-with-entra-group-name>'

param budgetAmount = 800
param budgetContactEmail = '<replace-with-budget-contact>'
param technicalContact = '<replace-with-technical-contact>'

// Governance-enforced tags (9 policy + derived)
param ownerTag = 'nordic-fresh-foods-team'
param costcenterTag = 'NFF-001'
param workloadTag = 'web-app'
param slaTag = '99.9%'
param backupPolicyTag = 'daily-30d'
param maintWindowTag = 'sun-02:00-06:00-utc'
