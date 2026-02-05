// ============================================================================
// Resource Group Module - e2e-conductor-test
// ============================================================================
// Purpose: Deploy resource group with required tags
// AVM Module: avm/res/resources/resource-group:0.4.3
// ============================================================================

targetScope = 'subscription'

// ============================================================================
// Parameters
// ============================================================================

@description('Resource group name')
param resourceGroupName string

@description('Azure region for deployment')
param location string

@description('Required tags for governance compliance')
param tags object

// ============================================================================
// Resource Group Deployment (AVM)
// ============================================================================

module resourceGroup 'br/public:avm/res/resources/resource-group:0.4.3' = {
  name: 'rg-deployment'
  params: {
    name: resourceGroupName
    location: location
    tags: tags
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Resource group name')
output resourceGroupName string = resourceGroup.outputs.name

@description('Resource group resource ID')
output resourceGroupId string = resourceGroup.outputs.resourceId

@description('Resource group location')
output resourceGroupLocation string = resourceGroup.outputs.location
