<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Diagnostics (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Triggers

Activate this skill when user wants to:
- Debug or troubleshoot production issues
- Diagnose errors in Azure services
- Analyze application logs or metrics
- Fix image pull, cold start, or health probe issues
- Investigate why Azure resources are failing
- Find root cause of application errors
- Troubleshoot Azure Function Apps (invocation failures, timeouts, binding errors)

> _See SKILL.md for full content._

## Rules

1. Start with systematic diagnosis flow
2. Use AppLens (MCP) for AI-powered diagnostics when available
3. Check resource health before deep-diving into logs
4. Select appropriate troubleshooting guide based on service type
5. Document findings and attempted remediation steps

---


## Quick Diagnosis Flow

1. **Identify symptoms** - What's failing?
2. **Check resource health** - Is Azure healthy?
3. **Review logs** - What do logs show?
4. **Analyze metrics** - Performance patterns?
5. **Investigate recent changes** - What changed?

---


## Troubleshooting Guides by Service

| Service | Common Issues | Reference |
|---------|---------------|-----------|
| **Container Apps** | Image pull failures, cold starts, health probes, port mismatches | [container-apps/](references/container-apps/README.md) |
| **Function Apps** | App details, invocation failures, timeouts, binding errors, cold starts, missing app settings | [functions/](references/functions/README.md) |

---


## Quick Reference

### Common Diagnostic Commands

```bash
# Check resource health
az resource show --ids RESOURCE_ID

# View activity log
az monitor activity-log list -g RG --max-events 20

> _See SKILL.md for full content._

## Check Azure Resource Health

### Using MCP

```
mcp_azure_mcp_resourcehealth
  intent: "check health status of <resource-name>"
  command: "get"
  parameters:
    resourceId: "<resource-id>"

> _See SKILL.md for full content._
