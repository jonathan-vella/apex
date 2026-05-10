---
name: azure-cloud-migrate
description: '**WORKFLOW SKILL** — Assess and migrate cross-cloud workloads to Azure. Generates assessment reports and converts code from AWS, GCP, or other providers to Azure services. WHEN: "migrate Lambda to Azure Functions", "migrate AWS to Azure", "convert AWS serverless to Azure", "migration readiness report", "cross-cloud migration". USE FOR: cross-cloud assessment, AWS-to-Azure code conversion, GCP-to-Azure code conversion. DO NOT USE FOR: greenfield Azure deployment (use azure-prepare), Azure-only refactor (use azure-prepare).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Cloud Migrate

> This skill handles **assessment and code migration** of existing cloud workloads to Azure.

## Rules

1. Follow phases sequentially — do not skip
2. Generate assessment before any code migration
3. Load the scenario reference and follow its rules
4. Use `mcp_azure_mcp_get_bestpractices` and `mcp_azure_mcp_documentation` MCP tools
5. Use the latest supported runtime for the target service
6. Destructive actions require `ask_user` — [global-rules](references/services/functions/global-rules.md)

## Migration Scenarios

| Source     | Target          | Reference                                                                      |
| ---------- | --------------- | ------------------------------------------------------------------------------ |
| AWS Lambda | Azure Functions | [lambda-to-functions.md](references/services/functions/lambda-to-functions.md) |

> No matching scenario? Use `mcp_azure_mcp_documentation` and `mcp_azure_mcp_get_bestpractices` tools.

## Output Directory

All output goes to `<source-folder>-azure/` at workspace root. Never modify the source directory.

## Steps

1. **Create** `<source-folder>-azure/` at workspace root
2. **Assess** — Analyze source, map services, generate report → [assessment.md](references/services/functions/assessment.md)
3. **Migrate** — Convert code using target programming model → [code-migration.md](references/services/functions/code-migration.md)
4. **Ask User** — "Migration complete. Test locally or deploy to Azure?"
5. **Hand off** to azure-prepare for infrastructure, testing, and deployment

Track progress in `migration-status.md` — see [workflow-details.md](references/workflow-details.md).

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                        | When to Load     |
| -------------------------------- | ---------------- |
| `references/workflow-details.md` | Workflow Details |
