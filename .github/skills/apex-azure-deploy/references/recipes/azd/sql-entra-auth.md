# SQL Database Entra Authentication

Quick reference for Azure SQL Database Entra authentication in post-deployment scenarios.

## Prerequisites

Azure SQL Server must be configured with Entra-only authentication during provisioning. The signed-in user must be set as Entra admin:

```bicep
properties: {
  administrators: {
    administratorType: 'ActiveDirectory'
    principalType: 'User'
    login: principalName
    sid: principalId
    tenantId: subscription().tenantId
    azureADOnlyAuthentication: true
  }
}
```

## Connection Patterns

### Reviewed SQL Execution

Use [run-sql.sh](../../../scripts/run-sql.sh), copied to the project's `scripts/` directory with editing tools.
Prerequisite: Go sqlcmd supporting `--authentication-method ActiveDirectoryDefault`, an Entra-authorized identity,
and network/DNS access to the approved SQL endpoint. Azure CLI does not provide a database query command.
ODBC sqlcmd is a different interface; do not silently substitute it or use SQL passwords.
If the binary, supported authentication method or credential is unavailable, stop and report a verification gap.

On 2026-09-14, official Go sqlcmd `v1.10.0` Linux ARM64 help (`sqlcmd -?`) confirmed
`--authentication-method ActiveDirectoryDefault`, `-S`, `-d`, `-b` and `-i`.
The release archive matched published SHA-256
`9faaa981f9c374f319ac796dedb4678499b8596c87d5b6c512e9b0e7a3b74f8e`.
This verifies CLI availability at that version, not credentials, connectivity or SQL execution.

Human approval must bind `SQL_APPROVED_TARGET` to `SQL_SERVER_FQDN/SQL_DATABASE`
and `SQL_APPROVED_SHA256` to the reviewed SQL file. Do not auto-approve the current file by computing its hash.
This applies to verification queries too: data-plane access is not authorized by deployment readiness.
The helper preserves SQL failure exit status (`-b`) and never disables certificate checks.

```bash
bash ./scripts/run-sql.sh verify.sql
```

For connectivity checks, the reviewed `verify.sql` contains `SELECT 1;`. Never log tokens or full environments.

### Connection Strings

**For .NET applications with managed identity:**

```
Server=tcp:{server}.database.windows.net,1433;Database={database};Authentication=Active Directory Default;Encrypt=True;
```

**Required packages:**

- `Microsoft.Data.SqlClient` (v5.1.0+)
- `Azure.Identity` (for local development)

## Database Roles

| Role            | Permissions                | Use For               |
| --------------- | -------------------------- | --------------------- |
| `db_datareader` | SELECT                     | Read operations       |
| `db_datawriter` | INSERT, UPDATE, DELETE     | Write operations      |
| `db_ddladmin`   | CREATE, ALTER, DROP schema | EF migrations         |
| `db_owner`      | Full control               | Admin (use sparingly) |

## Grant Managed Identity Access

```sql
-- Create user from managed identity
CREATE USER [app-name] FROM EXTERNAL PROVIDER;

-- Grant standard application permissions
ALTER ROLE db_datareader ADD MEMBER [app-name];
ALTER ROLE db_datawriter ADD MEMBER [app-name];
```

Resolve the actual approved identity; a UAMI may have a different name from the application.
Schema permissions belong to a separately approved migration identity, not the runtime identity by default.

## Verify Current Admin

```bash
az sql server ad-admin list \
  --server "$SQL_SERVER" \
  --resource-group "$AZURE_RESOURCE_GROUP"
```

## References

- [SQL Managed Identity Access](sql-managed-identity.md)
- [EF Core Migrations](ef-migrations.md)
- [Post-Deployment Guide](post-deployment.md)
