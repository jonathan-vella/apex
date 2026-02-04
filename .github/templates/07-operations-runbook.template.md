# Operations Runbook: {project-name}

**Version**: 1.0
**Date**: {date}
**Environment**: {environment}
**Region**: {region}

> [!NOTE]
> 📚 See [documentation-styling.md](../agents/_shared/documentation-styling.md) for visual standards.

---

## Quick Reference

| Item                | Value             |
| ------------------- | ----------------- |
| **Primary Region**  | {region}          |
| **Resource Group**  | {resource-group}  |
| **Support Contact** | {support-contact} |
| **Escalation Path** | {escalation-path} |

### Critical Resources

| Resource   | Name   | Resource Group   |
| ---------- | ------ | ---------------- |
| {resource} | {name} | {resource-group} |

---

## 1. Daily Operations

### 1.1 Health Checks

**Morning Health Check:**

1. ✅ {health-check-1}
2. ✅ {health-check-2}
3. ✅ {health-check-3}

**KQL Query - System Health Overview:**

```kusto
// Health query example
{kql-query}
```

### 1.2 Log Review

**Priority Logs to Review:**

| Log Source   | Query Focus   | Action Threshold |
| ------------ | ------------- | ---------------- |
| {log-source} | {query-focus} | {threshold}      |

---

## 2. Incident Response

### 2.1 Severity Definitions

| Severity | Definition   | Response Time |
| -------- | ------------ | ------------- |
| P1       | {definition} | {time}        |
| P2       | {definition} | {time}        |
| P3       | {definition} | {time}        |

### 2.2 Runbooks by Alert

| Alert        | Runbook            | Owner   |
| ------------ | ------------------ | ------- |
| {alert-name} | {runbook-location} | {owner} |

---

## 3. Common Procedures

### 3.1 Restart Services

<details>
<summary>🔧 Restart App Service</summary>

```bash
# Restart App Service
{restart-command}
```

</details>

### 3.2 Scale Resources

<details>
<summary>📈 Scale Up/Out Commands</summary>

```bash
# Scale up/out
{scale-command}
```

</details>

---

## 4. Maintenance Windows

| Task               | Schedule   | Duration   |
| ------------------ | ---------- | ---------- |
| {maintenance-task} | {schedule} | {duration} |

> [!TIP]
> 💡 Schedule maintenance during low-traffic periods. Use Azure Update Manager for coordinated patching.

---

## 5. Contacts & Escalation

| Role   | Contact   | Phone   |
| ------ | --------- | ------- |
| {role} | {contact} | {phone} |

---

## 6. Change Log

| Date   | Change   | Author   |
| ------ | -------- | -------- |
| {date} | {change} | {author} |

---

## References

> [!NOTE]
> 📚 The following Microsoft Learn resources provide operational guidance.

| Topic                 | Link                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Azure Monitor Alerts  | [Alerting Best Practices](https://learn.microsoft.com/azure/azure-monitor/best-practices-alerts) |
| Log Analytics Queries | [KQL Reference](https://learn.microsoft.com/azure/azure-monitor/logs/get-started-queries)        |
| Incident Management   | [Azure Status](https://status.azure.com/)                                                        |
| Service Health        | [Azure Service Health](https://learn.microsoft.com/azure/service-health/overview)                |

---

_Operations runbook generated from infrastructure artifacts._
