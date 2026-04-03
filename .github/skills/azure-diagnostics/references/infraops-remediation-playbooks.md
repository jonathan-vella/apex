<!-- ref:remediation-playbooks-v1 -->

# Remediation Playbooks

Step-by-step resolution procedures for common Azure resource issues,
plus the standard six-phase diagnostic workflow and report template.

---

## Diagnostic Workflow (Six Phases)

### Phase 1 — Discovery

```bash
az resource show --ids "$resourceId" \
  --query "{name:name, type:type, location:location, sku:sku, tags:tags}"
```

### Phase 2 — Health Assessment

Run the resource-type-specific health checks from `references/health-checks.md`.

### Phase 3 — Log Analysis

Run KQL queries from `references/kql-templates.md` (Generic Error Search).

### Phase 4 — Activity Log Review

Run the Activity Log failed-operations query from `references/kql-templates.md`.

### Phase 5 — Classification

Rate each finding using the severity table in SKILL.md. Include:

- **Finding**: What is wrong
- **Severity**: Critical / High / Medium / Low
- **Evidence**: KQL query result or CLI output
- **Remediation**: Specific fix steps

### Phase 6 — Report Generation

Structure the diagnostic report as:

```markdown
## Diagnostic Report: {resource-name}

**Assessment Date**: {date}
**Assessed By**: APEX Diagnose Agent
**Overall Health**: 🟢 Healthy | 🟡 Degraded | 🔴 Unhealthy

### Findings Summary

| #   | Finding | Severity | Status |
| --- | ------- | -------- | ------ |
| 1   | ...     | High     | Open   |

### Detailed Findings

#### Finding 1: {title}

...

### Recommended Actions

1. ...
```

---

## Common Remediation Playbooks

### High CPU on App Service

1. Check if autoscale is configured — if not, add scale-out rule at 70% CPU
2. Review Application Insights for slow dependencies
3. Check for synchronous blocking calls in application code
4. Consider scaling up the App Service Plan SKU

### Storage Account Throttling

1. Check current request rate against [storage scalability targets](https://learn.microsoft.com/azure/storage/common/scalability-targets-standard-account)
2. Enable CDN for read-heavy blob workloads
3. Distribute across multiple storage accounts if partition limits hit
4. Switch to Premium storage for high-IOPS requirements

### SQL Database DTU Exhaustion

1. Identify top resource-consuming queries via Query Performance Insight
2. Add missing indexes suggested by Azure SQL advisor
3. Scale up DTU tier or switch to vCore for more granular control
4. Review connection pooling settings in application
