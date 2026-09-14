---
name: apex-azure-diagnostics
user-invocable: true
disable-model-invocation: false
argument-hint: "resource scope, symptom and time range"
description: "**WORKFLOW SKILL** — Debug and troubleshoot Azure production issues: Container Apps + Function Apps diagnostics, KQL log analysis, health checks. WHEN: 'debug production issues', 'troubleshoot container apps', 'troubleshoot function apps', 'image pull failures', 'cold start issues', 'health probe failures'. DO NOT USE FOR: pre-deployment validation (apex-azure-validate), cost analysis (apex-azure-cost-optimization)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.2"
---

# Azure Diagnostics

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This document is the **official source** for debugging and troubleshooting Azure production issues. Follow these instructions to diagnose and resolve common Azure service problems systematically.

## Triggers

Activate this skill when user wants to:

- Debug or troubleshoot production issues
- Diagnose errors in Azure services
- Analyze application logs or metrics
- Fix image pull, cold start, or health probe issues
- Investigate why Azure resources are failing
- Find root cause of application errors
- Troubleshoot Azure Function Apps (invocation failures, timeouts, binding errors)
- Find the App Insights or Log Analytics workspace linked to a Function App

## Rules

1. Start with systematic diagnosis flow
2. Use AppLens (MCP) for AI-powered diagnostics when available
3. Check resource health before deep-diving into logs
4. Select appropriate troubleshooting guide based on service type
5. Document findings and attempted remediation steps
6. Diagnose only the approved scope; obtain separate approval before remediation

## Prerequisites

- Confirm resource IDs, subscription, incident window and read access.
- Use available Azure CLI or MCP capabilities; unavailable telemetry is a gap,
  not a healthy result. Do not dump credentials or app settings into reports.

---

## Steps

Follow the [diagnostic workflow](references/infraops-remediation-playbooks.md#diagnostic-workflow-six-phases)
for discovery, health/metrics, logs, recent changes, severity classification and
reporting. That procedure owns phase order and the severity-to-priority mapping.
Load only the health checks and query templates needed for the selected service.

---

## Troubleshooting Guides by Service

| Service            | Common Issues                                                                                 | Reference                                              |
| ------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Container Apps** | Image pull failures, cold starts, health probes, port mismatches                              | [container-apps/](references/container-apps/README.md) |
| **Function Apps**  | App details, invocation failures, timeouts, binding errors, cold starts, missing app settings | [functions/](references/functions/README.md)           |

---

## Quick Reference

### Common Diagnostic Commands

```bash
# Inspect resource metadata (not Resource Health availability)
az resource show --ids RESOURCE_ID

# View activity log
az monitor activity-log list -g RG --max-events 20

# Container Apps logs
az containerapp logs show --name APP -g RG --follow

# Function App logs (query App Insights traces)
az monitor app-insights query --apps APP-INSIGHTS -g RG \
  --analytics-query "traces | where timestamp > ago(1h) | order by timestamp desc | take 50"
```

### AppLens (MCP Tools)

For AI-powered diagnostics, use:

```
mcp_azure-mcp_applens
  intent: "diagnose issues with <resource-name>"
  command: "diagnose"
  parameters:
    resourceId: "<resource-id>"

Provides:
- Automated issue detection
- Root cause analysis
- Remediation recommendations
```

### Azure Monitor (MCP Tools)

For querying logs and metrics:

```
mcp_azure-mcp_monitor
  intent: "query logs for <resource-name>"
  command: "logs_query"
  parameters:
    workspaceId: "<workspace-id>"
    query: "<KQL-query>"
```

See [kql-queries.md](references/kql-queries.md) for common diagnostic queries.

---

## Check Azure Resource Health

### Using MCP

```
mcp_azure-mcp_resourcehealth
  intent: "check health status of <resource-name>"
  command: "get"
  parameters:
    resourceId: "<resource-id>"
```

Metadata/provisioning state from `az resource show` is not Resource Health
availability. If the Resource Health tool is unavailable, report that check as
unavailable and continue the approved [health checks](references/infraops-health-checks.md).

---

## Reference Index

- [KQL Query Library](references/kql-queries.md)
- [Azure Resource Graph Queries](references/azure-resource-graph.md)
- [InfraOps KQL Templates](references/infraops-kql-templates.md) — custom Azure Resource Graph and Log Analytics queries
- [InfraOps Health Checks](references/infraops-health-checks.md) — per-resource-type diagnostic commands
- [InfraOps Remediation Playbooks](references/infraops-remediation-playbooks.md) — 6-phase diagnostic workflow
- [Function Apps Troubleshooting](references/functions/README.md)

Load these references on demand, not all at once.
