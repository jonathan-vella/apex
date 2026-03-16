using './main.bicep'

param environment = 'prod'
param location = 'swedencentral'
param deployPhase = 1
param tags = {
  owner: 'Platform-Engineering'
  costcenter: 'platform-engineering'
  application: 'contoso-service-hub'
  workload: 'service-hub'
  sla: '99.9'
  'backup-policy': 'daily-35d'
  'maint-window': 'Sun-02:00-04:00-CET'
  'technical-contact': 'platform-engineering@contoso.local'
  'tech-contact': 'platform-engineering@contoso.local'
  'budget-contact-email': 'platform-engineering@contoso.local'
  'technical-contact-email': 'platform-engineering@contoso.local'
}
