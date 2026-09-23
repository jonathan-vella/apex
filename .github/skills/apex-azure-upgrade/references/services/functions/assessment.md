# Assessment: Functions Plan Upgrade

Generate an upgrade assessment report before any change to Azure resources. The assessment is read-only.

## Prerequisites

- An existing Azure Functions app on a Consumption or other plan
- Azure CLI v2.77.0+ with the `resource-graph` extension (`az extension add --name resource-graph`)
- Reader on the target subscription or resource group

## Assessment Steps

1. **Identify Source App** — Confirm the function app name, resource group, region, and current hosting plan
2. **Check Region Compatibility** — Verify the target plan is available in the app's region
3. **Verify Language Stack** — Confirm the app's runtime is supported on the target plan
4. **Verify Stack Version** — Confirm the runtime version is supported on the target plan in the region
5. **Check Deployment Slots** — Determine if slots are in use (Flex Consumption doesn't support slots)
6. **Check Certificates** — Determine if TLS/SSL certificates are in use (Flex Consumption supports site-scoped certificates only)
7. **Check Blob Triggers** — Verify blob triggers use EventGrid source (container polling not supported in Flex Consumption)
8. **Assess Dependencies** — Review upstream and downstream service dependencies and plan mitigation strategies
9. **Generate Report** — Create `agent-output/{project}/upgrade-assessment-report.md`

List app settings by name only (`--query "[].name" -o tsv`). Never copy setting values into the report:
connection strings and keys move to managed identity connections or Key Vault references.

## Assessment Report Format

> ⚠️ **MANDATORY**: Use these exact section headings in every assessment report. Do NOT rename, reorder, or omit sections.

```markdown
# Upgrade Assessment Report

## 1. Executive Summary

| Property | Value |
|----------|-------|
| **App Name** | <app-name> |
| **Resource Group** | <resource-group> |
| **Current Plan** | <current-plan (e.g., Consumption / Y1 Dynamic)> |
| **Target Plan** | <target-plan (e.g., Flex Consumption / FC1)> |
| **Region** | <region> |
| **Runtime** | <runtime and version> |
| **OS** | <Linux / Windows> |
| **Upgrade Readiness** | <Ready / Needs Attention / Blocked> |
| **Assessment Date** | <date> |

## 2. Compatibility Checks

| Check | Status | Details |
|-------|--------|---------|
| Region supported | ✅ / ❌ | |
| Language stack supported | ✅ / ❌ | |
| Stack version supported | ✅ / ❌ | |
| No deployment slots | ✅ / ⚠️ | |
| Certificates fit site-scoped limits | ✅ / ⚠️ / N/A | |
| Blob triggers use EventGrid | ✅ / ⚠️ / N/A | |
| .NET isolated (not in-process) | ✅ / ❌ / N/A | |

## 3. App Settings Inventory

| Setting name | Migrate? | Notes |
|--------------|----------|-------|
| | Yes / No / Convert | |

## 4. Managed Identities

| Type | Principal ID | Roles | Action |
|------|-------------|-------|--------|
| System-assigned | | | Recreate in new app |
| User-assigned | | | Reassign to new app |

## 5. Application Configurations

| Configuration | Current Value | Migrate? | Notes |
|---------------|---------------|----------|-------|
| CORS settings | | | |
| Custom domains | | | |
| HTTP version | | | |
| HTTPS only | | | |
| TLS version | | | |
| Client certificates | | | |
| Access restrictions | | | |
| Built-in auth | | | |

## 6. Trigger & Binding Analysis

| Function | Trigger Type | Source | Migration Risk | Mitigation |
|----------|-------------|--------|----------------|------------|
| | | | Low / Medium / High | |

## 7. Dependent Services

| Service | Dependency Type | Migration Risk | Mitigation Strategy |
|---------|----------------|----------------|---------------------|
| | Upstream / Downstream | | |

## 8. Blockers & Warnings

### Blockers (must fix before upgrade)
- [ ] <any blocking issues>

### Warnings (should address but not blocking)
- [ ] <any non-blocking concerns>

## 9. Recommendations

1. **Plan**: <recommended target plan>
2. **Auth**: <switch to Managed Identity if using connection strings>
3. **Monitoring**: <Application Insights configuration>
4. **Scaling**: <recommended instance count and concurrency settings>

## 10. Next Steps

- [ ] Review and approve this assessment
- [ ] Address any blockers listed above
- [ ] Record the target plan decision with 03-Architect and hand the IaC target mapping to 05-IaC Planner
```

> 💡 **Tip:** Use `mcp_azure-mcp_get_azure_bestpractices` to get the latest recommendations for the target hosting plan.
