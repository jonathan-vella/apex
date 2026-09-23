---
name: apex-azure-cloud-migrate
user-invocable: true
disable-model-invocation: false
argument-hint: "source provider, workload path and migration scope"
description: '**WORKFLOW SKILL** — Assess and migrate cross-cloud workloads to Azure: assessments and code conversion from AWS, GCP, Heroku, Kubernetes or Spring. WHEN: "migrate Lambda to Azure Functions", "migrate AWS to Azure", "migrate Heroku to App Service", "migrate GKE to Container Apps", "migration readiness report". DO NOT USE FOR: greenfield deployment or Azure-only refactor (apex-azure-prepare).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Cloud Migrate

> This skill handles **assessment and code migration** of existing cloud workloads to Azure.

## Workflow Routing

Resolve workflow identity and requested action first, per
[`apex-azure-validate`](../apex-azure-validate/SKILL.md#workflow-and-requested-action).
This skill assesses and converts application code only. For an APEX project, return infrastructure work to the
current step owner through `01-Orchestrator`; do not create `.azure/plan.md` or generate IaC here.
Assessment-only requests stop after the report.

## Rules

1. Follow phases sequentially — do not skip
2. Generate assessment before any code migration
3. Load the scenario reference and follow its rules
4. Use `mcp_azure-mcp_get_bestpractices` and `mcp_azure-mcp_documentation` MCP tools
5. Use the latest supported runtime for the target service
6. Destructive actions require `ask_user` — [global-rules](references/services/functions/global-rules.md)
7. Audit service discovery in app code — Kubernetes DNS names (for example `http://order-service:3001`) don't
   resolve in Container Apps; flag hard-coded hostnames and ports for environment-variable URL injection

## Migration Scenarios

The scenarios documented today are listed below. For other source platforms
(GCP, on-premises, etc.), call `mcp_azure-mcp_documentation` with
`command: "microsoft_docs_search"` to research the target Azure service and
adapt the AWS-Lambda assessment workflow as a template.

| Source     | Target          | Reference                                                                      |
| ---------- | --------------- | ------------------------------------------------------------------------------ |
| AWS Lambda | Azure Functions | [lambda-to-functions.md](references/services/functions/lambda-to-functions.md) |
| AWS Elastic Beanstalk | Azure App Service | [beanstalk-to-app-service.md](references/services/app-service/beanstalk-to-app-service.md) |
| Heroku | Azure App Service | [heroku-to-app-service.md](references/services/app-service/heroku-to-app-service.md) |
| Google App Engine | Azure App Service | [app-engine-to-app-service.md](references/services/app-service/app-engine-to-app-service.md) |
| AWS Fargate (ECS) | Azure Container Apps | [fargate-to-container-apps.md](references/services/container-apps/fargate-to-container-apps.md) |
| Kubernetes (GKE, EKS, self-hosted) | Azure Container Apps | [k8s-to-container-apps.md](references/services/container-apps/k8s-to-container-apps.md) |
| GCP Cloud Run | Azure Container Apps | [cloudrun-to-container-apps.md](references/services/container-apps/cloudrun-to-container-apps.md) |
| Spring Boot (Azure Spring Apps, VMs) | Azure Container Apps | [spring-apps-to-aca.md](references/services/container-apps/spring-apps-to-aca.md) |

App Service scenarios share [assessment](references/services/app-service/assessment.md),
[code migration](references/services/app-service/code-migration.md) and
[global rules](references/services/app-service/global-rules.md); Container Apps scenarios share the
[assessment guide](references/services/container-apps/assessment-guide.md).

> No matching scenario? Use `mcp_azure-mcp_documentation` and `mcp_azure-mcp_get_bestpractices` tools.

## Output Directory

All output goes to `<source-folder>-azure/` at workspace root. Never modify the source directory.

## Steps

1. **Create** `<source-folder>-azure/` at workspace root
2. **Assess** — Analyze source, map services, generate report → [assessment.md](references/services/functions/assessment.md)
3. **Migrate** — Convert code using target programming model → [code-migration.md](references/services/functions/code-migration.md)
4. **Ask User** — "Migration complete. Test locally or deploy to Azure?"
5. **Hand off** to apex-azure-prepare for infrastructure, testing, and deployment

Track progress in `migration-status.md` — see [workflow-details.md](references/workflow-details.md).

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                        | When to Load     |
| -------------------------------- | ---------------- |
| `references/workflow-details.md` | Workflow Details |
