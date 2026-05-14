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

| IaC Type  | File       | Syntax | Policy Compliant | Status |
| --------- | ---------- | ------ | ---------------- | ------ |
| Bicep     | blob.bicep | ✅     | ✅               | PASS   |
| Terraform | blob.tf    | ✅     | ✅               | PASS   |

## Deployment Validation

| Test              | Status  | Details                                          |
| ----------------- | ------- | ------------------------------------------------ |
| AZD Template Init | ✅ PASS | `functions-quickstart-python-azd-eventgrid-blob` |
| AZD Provision     | ✅ PASS | Resources created in `rg-blob-eval`              |
| AZD Deploy        | ✅ PASS | Function deployed to `func-mtgqcoepn4p3w`        |
| HTTP Response     | ✅ PASS | HTTP 200 from function endpoint                  |
| Event Grid Topic  | ✅ PASS | `eventgridpdftopic` created                      |
| Storage Account   | ✅ PASS | RBAC-only storage provisioned                    |

## Results

| Test              | Python | TypeScript | JavaScript | .NET | Java | PowerShell |
| ----------------- | ------ | ---------- | ---------- | ---- | ---- | ---------- |
| Health            | ✅     | -          | -          | -    | -    | -          |
| Blob trigger      | ✅     | -          | -          | -    | -    | -          |
| EventGrid event   | ✅     | -          | -          | -    | -    | -          |
| Copy to processed | ✅     | -          | -          | -    | -    | -          |

## Notes

Dedicated AZD templates available for all 6 languages:

- `functions-quickstart-{lang}-azd-eventgrid-blob`

## IaC Features

| Feature                     | Bicep | Terraform |
| --------------------------- | ----- | --------- |
| Storage Account (RBAC-only) | ✅    | ✅        |
| Event Grid System Topic     | ✅    | ✅        |
| Event Grid Subscription     | ✅    | ✅        |
| RBAC Assignment             | ✅    | ✅        |
| Private Endpoint (VNet)     | ✅    | ✅        |
| Azure Policy Compliance     | ✅    | ✅        |

## Test Date

2025-02-19
