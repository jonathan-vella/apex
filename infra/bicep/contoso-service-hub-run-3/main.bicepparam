using './main.bicep'

param environmentName = 'dev'
param deploymentPhase = 'foundation'
param location = 'swedencentral'

param projectName = 'contoso-service-hub-run-3'
param projectTagValue = 'contoso-service-hub'
param owner = 'contoso-team'

param governanceTags = {
  environment: 'dev'
  owner: 'contoso-team'
  costcenter: 'csh-dev'
  application: 'contoso-service-hub'
  workload: 'service-hub'
  sla: '99.9'
  'backup-policy': 'daily-30d'
  'maint-window': 'sun-02-06-cet'
  'tech-contact': 'contoso-team'
}

param budgetAmount = 2000
param budgetContactEmails = [
  'contoso-team@contoso.example'
]
