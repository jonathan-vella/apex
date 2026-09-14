# EF Core Migrations Deployment

Apply Entity Framework Core migrations to Azure SQL Database after deployment.

Require explicit approval of the target, reviewed migrations and migration identity. Preparation/validation never
apply migrations. Use the [SQL execution contract](sql-entra-auth.md#reviewed-sql-execution) for target/hash approval.

## Detection

EF Core projects contain `Migrations/` folder or `Microsoft.EntityFrameworkCore` package reference in `.csproj`.

```bash
find . -type d -name "Migrations" 2>/dev/null
find . -name "*.csproj" -exec grep -l "Microsoft.EntityFrameworkCore" {} \;
```

## Deployment Methods

### Method 1: azd Hook (Recommended)

Only automate when the approved deployment plan includes migrations. Generate and review the SQL first (Method 2).
Use the shared executor in `postprovision` (per-project: `infra/{iac}/{project}/azure.yaml`):

```yaml
hooks:
  postprovision:
    shell: sh
    run: bash ./scripts/run-sql.sh migrations.sql
```

Supply approval values from the human-approved deployment process, never auto-approve current files in a hook.
Direct `dotnet ef database update` remains available for separately approved development workflows with the project's
Entra connection and reviewed migrations. Production uses the reviewed SQL path below.

### Method 2: SQL Script (Production)

Generate idempotent script for review before applying:

```bash
dotnet ef migrations script --idempotent --output migrations.sql
```

Review destructive/data changes, backup/rollback and required schema privileges. After target/file approval:

```bash
bash ./scripts/run-sql.sh migrations.sql
```

### Method 3: Application Startup (Dev Only)

⚠️ **Development only** — production should use explicit migration steps.

```csharp
// Program.cs
if (app.Environment.IsDevelopment()) {
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.Migrate();
}
```

## Combined Hook: SQL Access + Migrations

Combine both steps — see [sql-managed-identity.md](sql-managed-identity.md) for SQL grant commands.

```bash
bash ./scripts/run-sql.sh approved-grants-and-migrations.sql
```

Review the combined file as one operation. Use a distinct migration identity for DDL; do not grant runtime DDL by default.

## Prerequisites

Install EF Core tools:

```bash
dotnet tool install --global dotnet-ef
dotnet ef --version  # Verify installation
```

## Connection String

```
Server=tcp:{server}.database.windows.net,1433;Database={database};Authentication=Active Directory Default;Encrypt=True;
```

## Troubleshooting

| Error                               | Solution                                                                |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Cannot open database                | Check firewall rules: `az sql server firewall-rule list`                |
| Login failed                        | Grant SQL access per [sql-managed-identity.md](sql-managed-identity.md) |
| Unable to create DbContext          | Add `IDesignTimeDbContextFactory` implementation                        |
| Hook fails but deployment continues | Remove `continueOnError: true` to make migrations block deployment      |

**DbContext Factory Example:**

```csharp
public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext> {
    public ApplicationDbContext CreateDbContext(string[] args) {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING")
            ?? args.FirstOrDefault() ?? "Server=(localdb)\\mssqllocaldb;Database=MyDb;Trusted_Connection=True;";
        optionsBuilder.UseSqlServer(connectionString);
        return new ApplicationDbContext(optionsBuilder.Options);
    }
}
```

## Best Practices

- Use `--idempotent` flag for production scripts
- Version control Migrations/ folder
- Test locally before deploying
- Backup production databases before applying
- Keep migrations small and focused

## References

- [SQL Managed Identity Access](sql-managed-identity.md)
- [Post-Deployment Guide](post-deployment.md)
- [EF Core Migrations](https://learn.microsoft.com/ef/core/managing-schemas/migrations/)
