# AZD Verification

Verify deployment success and application health.

## Step 1: Verify Resources

```bash
azd show
```

Expected output:

```
Showing deployed resources:
  Resource Group: rg-myapp-dev
  Services:
    api - Endpoint: https://api-xxxx.azurecontainerapps.io
```

## Step 2: Health Check

```bash
# Get endpoint
ENDPOINT=$(azd env get-values | grep -E "SERVICE_.*_URI|.*_ENDPOINT" | head -1 | cut -d'=' -f2)

# Test endpoint
curl -f "$ENDPOINT/health" || curl -f "$ENDPOINT"
```

Expected: HTTP 200 response.

## Step 3: Post-Deployment Verification (if applicable)

For deployments with Azure SQL Database and managed identity:

### Verify SQL Access

Use the [reviewed SQL executor](sql-entra-auth.md#reviewed-sql-execution) with explicit data-plane approval.
Put this query in `verify-identity.sql`:

```sql
SELECT name, type_desc FROM sys.database_principals WHERE type = 'E';
```

```bash
bash ./scripts/run-sql.sh verify-identity.sql
```

**Expected:** Should list the App Service or Container App managed identity.

### Verify Database Schema

For EF Core applications:

Put this query in a separately reviewed `verify-schema.sql`:

```sql
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE';
```

```bash
bash ./scripts/run-sql.sh verify-schema.sql
```

**Expected:** Should list application tables (not just `__EFMigrationsHistory`).

### Check Application Logs

```bash
# For App Service
az webapp log tail --name <app-name> --resource-group <resource-group>

# For Container Apps
az containerapp logs show --name <app-name> --resource-group <resource-group> --follow
```

**Look for:**

- ✅ No SQL authentication errors
- ✅ Successful database connection
- ✅ Application started successfully

## Common Issues

| Symptom                      | Cause                      | Fix                                                    |
| ---------------------------- | -------------------------- | ------------------------------------------------------ |
| HTTP 500 on startup          | SQL authentication failure | See [sql-managed-identity.md](sql-managed-identity.md) |
| "Invalid object name" errors | Migrations not applied     | See [ef-migrations.md](ef-migrations.md)               |
| Endpoint not accessible      | Service still starting     | Wait 1-2 minutes, retry                                |
| Health check fails           | Application error          | Check logs with `az webapp log tail`                   |

## References

- [Post-Deployment Steps](post-deployment.md)
- [SQL Managed Identity Access](sql-managed-identity.md)
- [EF Core Migrations](ef-migrations.md)
