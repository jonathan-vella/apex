# Eval Summary

## Coverage Status

| Language   | Source | Eval | Status  |
| ---------- | ------ | ---- | ------- |
| Python     | ✅     | ✅   | PASS    |
| TypeScript | ✅     | 🔲   | Pending |
| JavaScript | ✅     | 🔲   | Pending |
| C# (.NET)  | ✅     | 🔲   | Pending |
| Java       | ✅     | 🔲   | Pending |
| PowerShell | ✅     | 🔲   | Pending |

## IaC Validation

| IaC Type  | File      | Syntax | Policy Compliant | Status |
| --------- | --------- | ------ | ---------------- | ------ |
| Bicep     | sql.bicep | ✅     | ✅               | PASS   |
| Terraform | sql.tf    | ✅     | ✅               | PASS   |

## Deployment Validation

| Test              | Status  | Details                                       |
| ----------------- | ------- | --------------------------------------------- |
| AZD Template Init | ✅ PASS | `functions-quickstart-python-azd-sql`         |
| AZD Provision     | ✅ PASS | Resources created in `rg-sql-eval`            |
| AZD Deploy        | ✅ PASS | Function deployed to `func-api-arkwcvhvbkqwc` |
| HTTP Response     | ✅ PASS | HTTP 200 from function endpoint               |
| SQL Server        | ✅ PASS | `sql-arkwcvhvbkqwc` with Entra-only auth      |
| SQL Database      | ✅ PASS | `ToDo` database created                       |

## Results

| Test        | Python | TypeScript | JavaScript | .NET | Java | PowerShell |
| ----------- | ------ | ---------- | ---------- | ---- | ---- | ---------- |
| Health      | ✅     | -          | -          | -    | -    | -          |
| SQL trigger | ✅     | -          | -          | -    | -    | -          |
| SQL output  | ✅     | -          | -          | -    | -    | -          |

## Notes

Dedicated AZD templates available:

- `functions-quickstart-python-azd-sql`
- `functions-quickstart-typescript-azd-sql`
- `functions-quickstart-dotnet-azd-sql`

## IaC Features

| Feature                 | Bicep | Terraform |
| ----------------------- | ----- | --------- |
| SQL Server (Entra-only) | ✅    | ✅        |
| SQL Database            | ✅    | ✅        |
| Firewall Rules          | ✅    | ✅        |
| Private Endpoint (VNet) | ✅    | ✅        |
| Azure Policy Compliance | ✅    | ✅        |

## Post-Deploy Note

SQL managed identity access requires T-SQL after deployment:

```sql
CREATE USER [<function-app-name>] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [<function-app-name>];
ALTER ROLE db_datawriter ADD MEMBER [<function-app-name>];
```

## Test Date

2025-02-19
