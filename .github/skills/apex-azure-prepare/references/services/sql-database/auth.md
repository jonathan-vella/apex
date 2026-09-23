# SQL Database - Entra ID Authentication

## Entra ID Admin Configuration (User)

**Recommended for development** — Uses signed-in user as admin.

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
  }
}
```

> ⚠️ **Warning:** If deploying from CI/CD with a service principal, set `principalType` to `'Application'`. The default `'User'` only works for interactive (human) deployments.

**Get signed-in user info:**

```bash
az ad signed-in-user show --query "{id:id, name:displayName}" -o json
```

**Set as azd environment variables:**

```bash
PRINCIPAL_INFO=$(az ad signed-in-user show --query "{id:id, name:displayName}" -o json)
azd env set AZURE_PRINCIPAL_ID $(echo $PRINCIPAL_INFO | jq -r '.id')
azd env set AZURE_PRINCIPAL_NAME $(echo $PRINCIPAL_INFO | jq -r '.name')
```

> 💡 **Tip:** Set these immediately after `azd init` to avoid deployment failures.

## Entra ID Admin Configuration (Group)

**Recommended for production** — Uses Entra group for admin access.

```bicep
resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: '${resourcePrefix}-sql-${uniqueHash}'
  location: location
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'Group'
      login: 'SQL Admins'
      sid: entraGroupObjectId
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: true
    }
    minimalTlsVersion: '1.2'
  }
}
```

## Managed Identity Access

Grant app managed identity access via SQL:

```sql
CREATE USER [my-container-app] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [my-container-app];
ALTER ROLE db_datawriter ADD MEMBER [my-container-app];
```

## Common Database Roles

| Role            | Permissions            |
| --------------- | ---------------------- |
| `db_datareader` | Read all tables        |
| `db_datawriter` | Insert, update, delete |
| `db_ddladmin`   | Create/modify schema   |
| `db_owner`      | Full access            |

## Connection Strings

### Entra ID Authentication (Recommended)

Always include an `Authentication` parameter in SQL connection strings for apps with Entra-only auth. Use
`Authentication=Active Directory Default` for general scenarios (App Service, local development), or
`Authentication=Active Directory Managed Identity` when a user-assigned managed identity with a specific `User Id`
is required (for example, Azure Functions SQL bindings). Don't assign `AccessToken` manually, call
`DefaultAzureCredential().GetToken()`, or omit the parameter. It is required both in the IaC output (for example,
the App Service `connectionStrings` property) and in application configuration such as `appsettings.json`.

```
Server=tcp:{server}.database.windows.net,1433;Database={database};Authentication=Active Directory Default;Encrypt=True;TrustServerCertificate=False;
```

**Required for .NET applications:**

- `Microsoft.Data.SqlClient` (v5.1.0+)
- `Azure.Identity` (for local development)

### Legacy SQL Authentication (⛔ Prohibited)

Never generate connection strings with `User ID` and `Password`, and never generate `administratorLogin` or
`administratorLoginPassword` properties, including in conditional, ternary or optional branches. SQL
authentication is disabled in subscriptions with Entra-only policies and breaks the APEX security baseline.
