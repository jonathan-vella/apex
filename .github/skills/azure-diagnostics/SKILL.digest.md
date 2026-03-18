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

> _See SKILL.md for full content._

## Rules

1. Start with systematic diagnosis flow
2. Use AppLens (MCP) for AI-powered diagnostics when available
3. Check resource health before deep-diving into logs
4. Select appropriate troubleshooting guide based on service type
5. Document findings and attempted remediation steps

---

> _See SKILL.md for full content._

## Quick Diagnosis Flow

1. **Identify symptoms** - What's failing?
2. **Check resource health** - Is Azure healthy?
3. **Review logs** - What do logs show?
4. **Analyze metrics** - Performance patterns?
5. **Investigate recent changes** - What changed?

---

> _See SKILL.md for full content._

## Troubleshooting Guides by Service

| Service            | Common Issues                                                                                 | Reference                                              |
| ------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Container Apps** | Image pull failures, cold starts, health probes, port mismatches                              | [container-apps/](references/container-apps/README.md) |
| **Function Apps**  | App details, invocation failures, timeouts, binding errors, cold starts, missing app settings | [functions/](references/functions/README.md)           |

---

## Quick Reference

### Common Diagnostic Commands

```bash
# Check resource health
az resource show --ids RESOURCE_ID

# View activity log
az monitor activity-log list --resource-group <rg-name> --output table
```

> _See SKILL.md for full content._

## Check Azure Resource Health

### Using MCP

```text
mcp_azure_mcp_resourcehealth
  intent: "check health status of <resource-name>"
  command: "get"
  parameters: ...
```

> _See SKILL.md for full content._

## References

- [KQL Query Library](references/kql-queries.md)
- [Azure Resource Graph Queries](references/azure-resource-graph.md)
- [InfraOps KQL Templates](references/infraops-kql-templates.md) — custom Azure Resource Graph and Log Analytics queries
- [InfraOps Health Checks](references/infraops-health-checks.md) — per-resource-type diagnostic commands
- [InfraOps Remediation Playbooks](references/infraops-remediation-playbooks.md) — 6-phase diagnostic workflow
- [Function Apps Troubleshooting](references/functions/README.md)
