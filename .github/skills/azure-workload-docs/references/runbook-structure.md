# Operations Runbook Structure

The operations runbook provides day-2 procedures for operating the workload.

## Quick Reference

| Item | Value |
|------|-------|
| Primary Region | {region} |
| Resource Group | {rg-name} |
| Environment | {dev/staging/prod} |
| Support Contact | {email/Teams} |
| Escalation | {escalation-path} |

## Section 1: Daily Operations

### Health Checks

| Check | Command/Location | Expected Result |
|-------|------------------|-----------------|
| App Service Status | Portal > App Service > Overview | Running |
| Database Connectivity | Connection test | Success |
| Storage Access | Blob list operation | No errors |

### Monitoring Review

- Review Azure Monitor alerts
- Check Application Insights for exceptions
- Verify backup job completion

## Section 2: Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| Sev 1 | Complete outage | 15 minutes | Production down |
| Sev 2 | Degraded service | 1 hour | Slow response times |
| Sev 3 | Minor issue | 4 hours | Single component issue |
| Sev 4 | Cosmetic/low impact | 24 hours | UI glitch |

### Initial Response

1. Acknowledge alert
2. Assess impact scope
3. Communicate to stakeholders
4. Begin troubleshooting
5. Escalate if needed

## Section 3: Common Procedures

### Restart App Service

```bash
az webapp restart --name {app-name} --resource-group {rg-name}
```

### Scale Up/Out

```bash
# Scale out (add instances)
az appservice plan update --name {plan-name} --resource-group {rg-name} \
  --number-of-workers {count}

# Scale up (change SKU)
az appservice plan update --name {plan-name} --resource-group {rg-name} \
  --sku {sku-name}
```

### Clear Cache

```bash
az redis flush --name {redis-name} --resource-group {rg-name}
```

## Section 4: Maintenance Windows

| Task | Frequency | Window | Duration |
|------|-----------|--------|----------|
| OS Patching | Monthly | Sunday 02:00-06:00 UTC | 4 hours |
| Certificate Renewal | As needed | Scheduled | 30 minutes |
| Backup Verification | Weekly | Saturday 00:00 UTC | 2 hours |

## Section 5: Contacts & Escalation

| Role | Name | Contact | Hours |
|------|------|---------|-------|
| Primary On-Call | {name} | {phone/email} | 24/7 |
| Platform Team | {team} | {channel} | Business hours |
| Azure Support | Microsoft | Portal ticket | 24/7 |

## Section 6: Change Log

| Date | Change | Author |
|------|--------|--------|
| YYYY-MM-DD | Initial creation | {author} |
