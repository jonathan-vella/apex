# SQL Managed Identity Access

Grant Azure managed identities database permissions on Azure SQL with Entra authentication.

## Prerequisites

- Azure SQL Server with Entra ID admin configured
- Verified system-assigned or user-assigned application identity
- Your account is Entra ID admin on SQL Server
- [Reviewed SQL execution contract](sql-entra-auth.md#reviewed-sql-execution), including Go sqlcmd and target/file approval

## Quick Grant

Create a reviewed `grant-runtime.sql` using the verified identity name, escaping SQL identifiers/literals.
Do not interpolate untrusted shell values. Resolve duplicate display names before granting access.

```sql
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'approved-runtime-identity')
  CREATE USER [approved-runtime-identity] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [approved-runtime-identity];
ALTER ROLE db_datawriter ADD MEMBER [approved-runtime-identity];
```

```bash
bash ./scripts/run-sql.sh grant-runtime.sql
```

## Database Roles

| Role            | Permissions                | Use For               |
| --------------- | -------------------------- | --------------------- |
| `db_datareader` | SELECT                     | Read-only queries     |
| `db_datawriter` | INSERT, UPDATE, DELETE     | CRUD operations       |
| `db_ddladmin`   | CREATE, ALTER, DROP schema | EF migrations         |
| `db_owner`      | Full control               | Admin (use sparingly) |

**Standard app:** Reader/writer as required. Grant DDL separately to an approved migration identity, not runtime by default.
**Read-only app:** Only `db_datareader`.

## Automate with azd Hook

Only add a grant hook when explicitly approved in the deployment plan. Copy the shared executor to the project;
supply target/file approval through the human-approved deployment process, never compute approval in the hook.
Add `postprovision` hook to `azure.yaml` (per-project: `infra/{iac}/{project}/azure.yaml`):

```yaml
hooks:
  postprovision:
    shell: sh
    run: bash ./scripts/run-sql.sh grant-runtime.sql
```

The shared executor fails on missing/stale approval or SQL errors. Never use `continueOnError` for grants.

## Verification

Place this read-only query in a separately reviewed `verify-roles.sql`:

```sql
    SELECT dp.name AS UserName, dr.name AS RoleName
    FROM sys.database_principals dp
    JOIN sys.database_role_members drm ON dp.principal_id = drm.member_principal_id
    JOIN sys.database_principals dr ON drm.role_principal_id = dr.principal_id
    WHERE dp.name = N'approved-runtime-identity';
  ```

  ```bash
  bash ./scripts/run-sql.sh verify-roles.sql
```

Expected: identity and roles match the approved set, with no unintended schema permissions.

## Troubleshooting

| Error                                | Solution                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| "Cannot find the user"               | Verify identity exists: `az webapp identity show` or `az containerapp identity show` |
| "Principal does not have permission" | Check you're Entra admin: `az sql server ad-admin list`                              |
| "Login failed for user"              | Run CREATE USER commands from this guide                                             |

**Idempotent Script Pattern:**

```sql
-- Check if user exists before creating
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'my-app')
  CREATE USER [my-app] FROM EXTERNAL PROVIDER;

-- Check role membership before adding
IF NOT EXISTS (
  SELECT 1 FROM sys.database_role_members drm
  JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
  JOIN sys.database_principals m ON drm.member_principal_id = m.principal_id
  WHERE r.name = 'db_datareader' AND m.name = 'my-app'
)
  ALTER ROLE db_datareader ADD MEMBER [my-app];
```

## References

- [SQL Entra Authentication](sql-entra-auth.md)
- [EF Core Migrations](ef-migrations.md)
- [Post-Deployment Guide](post-deployment.md)
