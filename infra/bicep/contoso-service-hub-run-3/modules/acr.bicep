@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment used to size the container registry SKU.')
param environmentName string

@description('Azure region for the container registry.')
param location string

@description('Common resource tags applied to the container registry.')
param tags object

@description('Azure Container Registry name.')
param acrName string

var acrSku = environmentName == 'dev' ? 'Basic' : 'Standard'

module acr 'br/public:avm/res/container-registry/registry:0.11.0' = {
  params: {
    acrAdminUserEnabled: false
    acrSku: acrSku
    anonymousPullEnabled: false
    location: location
    name: acrName
    tags: tags
  }
}

@description('Azure Container Registry resource ID.')
output acrId string = acr.outputs.resourceId

@description('Azure Container Registry name.')
output acrNameOut string = acr.outputs.name

@description('Azure Container Registry login server.')
output acrLoginServer string = acr.outputs.loginServer
