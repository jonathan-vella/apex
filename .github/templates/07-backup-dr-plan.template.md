# Backup and Disaster Recovery Plan: {project-name}

**Generated**: {date}
**Version**: 1.0
**Environment**: {environment}
**Primary Region**: {primary-region}
**Secondary Region**: {secondary-region}

> [!NOTE]
> 📚 See [documentation-styling.md](../agents/_shared/documentation-styling.md) for visual standards.

---

## Executive Summary

> [!IMPORTANT]
> This document defines the backup strategy and disaster recovery procedures for {project-name}.

| Metric           | Current   | Target   |
| ---------------- | --------- | -------- |
| **RPO**          | {current} | {target} |
| **RTO**          | {current} | {target} |
| **Availability** | {current} | {target} |

---

## 1. Recovery Objectives

### 1.1 Recovery Time Objective (RTO)

| Tier      | RTO Target | Services   |
| --------- | ---------- | ---------- |
| Critical  | {time}     | {services} |
| Important | {time}     | {services} |
| Standard  | {time}     | {services} |

### 1.2 Recovery Point Objective (RPO)

| Data Type   | RPO Target | Backup Strategy   |
| ----------- | ---------- | ----------------- |
| {data-type} | {target}   | {backup-strategy} |

---

## 2. Backup Strategy

### 2.1 Azure SQL Database

| Setting             | Configuration |
| ------------------- | ------------- |
| Backup Type         | {config}      |
| Retention (PITR)    | {config}      |
| Long-Term Retention | {config}      |
| Geo-Redundancy      | {config}      |

**Point-in-Time Restore Command:**

```bash
az sql db restore \
  --resource-group {rg} \
  --server {server} \
  --name {db} \
  --dest-name {db}-restored \
  --time "{timestamp}"
```

### 2.2 Azure Key Vault

| Setting          | Configuration |
| ---------------- | ------------- |
| Soft Delete      | {config}      |
| Purge Protection | {config}      |

---

## 3. Disaster Recovery Procedures

### 3.1 Failover Procedure

{failover-procedure}

### 3.2 Failback Procedure

{failback-procedure}

---

## 4. Testing Schedule

| Test Type   | Frequency   | Last Test   | Next Test   |
| ----------- | ----------- | ----------- | ----------- |
| {test-type} | {frequency} | {last-test} | {next-test} |

---

## 5. Communication Plan

| Audience   | Channel   | Template   |
| ---------- | --------- | ---------- |
| {audience} | {channel} | {template} |

---

## 6. Roles and Responsibilities

| Role   | Team   | Responsibility   |
| ------ | ------ | ---------------- |
| {role} | {team} | {responsibility} |

---

## 7. Dependencies

| Dependency   | Impact   | Mitigation   |
| ------------ | -------- | ------------ |
| {dependency} | {impact} | {mitigation} |

---

## 8. Recovery Runbooks

| Scenario   | Runbook   | Owner   |
| ---------- | --------- | ------- |
| {scenario} | {runbook} | {owner} |

---

## 9. Appendix

<details>
<summary>📋 Detailed Recovery Procedures</summary>

{appendix-content}

</details>

---

## References

> [!NOTE]
> 📚 The following Microsoft Learn resources provide DR guidance.

| Topic                 | Link                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Azure Backup Overview | [Backup Overview](https://learn.microsoft.com/azure/backup/backup-overview)                     |
| Backup Best Practices | [Best Practices](https://learn.microsoft.com/azure/backup/backup-best-practices)                |
| RTO/RPO Guidance      | [Reliability Metrics](https://learn.microsoft.com/azure/well-architected/reliability/metrics)   |
| Site Recovery         | [ASR Overview](https://learn.microsoft.com/azure/site-recovery/site-recovery-overview)          |
| Business Continuity   | [DR Planning](https://learn.microsoft.com/azure/well-architected/reliability/disaster-recovery) |

---

_Backup and DR plan generated from infrastructure artifacts._
