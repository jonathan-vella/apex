# SQL Database - Bicep Patterns

## Basic Setup (Entra-Only Authentication)

**Recommended approach** — Uses Microsoft Entra ID authentication only. Required for subscriptions with policies enforcing Entra-only authentication.

```bicep
param principalId string
param principalName string
@allowed(['User', 'Group', 'Application'])
param principalType string = 'User'

resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: '${resourcePrefix}-sql-${uniqueHash}'
  location: location
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: principalType
      login: principalName
      sid: principalId
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: true
    }
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: 'appdb'
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648  // 2 GB
  }
}
```

Apps reach the server through the [private endpoint](#private-endpoint). Don't add an `AllowAzureServices`
(`0.0.0.0`) firewall rule: it admits traffic from every Azure tenant.

> ⚠️ **Warning:** If deploying from CI/CD with a service principal, set `principalType` to `'Application'`. The default `'User'` only works for interactive (human) deployments.

**Set Entra admin parameters:**

1. Get current user info:

```bash
az ad signed-in-user show --query "{id:id, name:displayName}" -o json
```

2. Set as azd environment variables:

```bash
PRINCIPAL_INFO=$(az ad signed-in-user show --query "{id:id, name:displayName}" -o json)
azd env set AZURE_PRINCIPAL_ID $(echo $PRINCIPAL_INFO | jq -r '.id')
azd env set AZURE_PRINCIPAL_NAME $(echo $PRINCIPAL_INFO | jq -r '.name')
```

> 💡 **Tip:** Set these variables immediately after `azd init` to avoid deployment failures. The Bicep `principalId` and `principalName` parameters will automatically use these environment variables.

## Serverless Configuration

```bicep
resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: 'appdb'
  location: location
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  properties: {
    autoPauseDelay: 60  // minutes
    minCapacity: json('0.5')
  }
}
```

## Private Endpoint

```bicep
resource sqlPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: '${sqlServer.name}-pe'
  location: location
  properties: {
    subnet: {
      id: subnet.id
    }
    privateLinkServiceConnections: [
      {
        name: '${sqlServer.name}-connection'
        properties: {
          privateLinkServiceId: sqlServer.id
          groupIds: ['sqlServer']
        }
      }
    ]
  }
}
```

## Legacy SQL Authentication (⛔ Prohibited)

Never generate `administratorLogin` or `administratorLoginPassword`, including in conditional or optional
branches. SQL authentication fails in subscriptions with Entra-only policies and breaks the APEX security
baseline. See [auth.md](auth.md#connection-strings) for the required connection strings.
