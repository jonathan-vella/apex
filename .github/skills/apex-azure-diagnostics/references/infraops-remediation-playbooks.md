<!-- ref:remediation-playbooks-v1 -->

# Remediation Playbooks

Step-by-step resolution procedures for common Azure resource issues,
plus the standard six-phase diagnostic workflow and report template.

---

## Diagnostic Workflow (Six Phases)

### Phase 1 — Discovery

Confirm symptoms, UTC incident window, selected resource IDs and approved scope.
Related-resource discovery is not permission to diagnose unrelated workloads.

```bash
az resource show --ids "$resourceId" \
  --query "{name:name, type:type, location:location, sku:sku, tags:tags}"
```

### Phase 2 — Health Assessment

Run the resource-type-specific [health checks](infraops-health-checks.md).

### Phase 3 — Log Analysis

Run [KQL templates](infraops-kql-templates.md) (Generic Error Search).

### Phase 4 — Activity Log Review

Run the Activity Log failed-operations query from [KQL templates](infraops-kql-templates.md).
Compare recent configuration/deployment changes with the incident window; temporal
proximity alone is not proof of causation.

### Phase 5 — Classification

Rate each finding using this mapping; severity does not authorize remediation:

| Severity | Evidence-based impact | Report priority |
| -------- | --------------------- | --------------- |
| Critical | Active outage, data loss or confirmed security compromise | P0 |
| High | Major degradation or imminent outage with observed impact | P1 |
| Medium | Limited degradation or material risk without current outage | P2 |
| Low | Minor issue or improvement without material current impact | P3 |

Unknown impact remains unclassified pending evidence, not automatically Low.
Keep this diagnostic severity distinct from challenger review severity. Include:

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

These are recommendations only. Obtain separate approval for the exact resource,
change, cost and downtime before modifying configuration, scale, indexes or data.
Discovery of related resources does not authorize expanding diagnosis scope.

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
