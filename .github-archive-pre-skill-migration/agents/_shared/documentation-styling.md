# Documentation Styling Standards

This file defines the visual styling standards for all agent-generated documentation.
Agents and skills MUST reference these standards when generating artifacts.

---

## Callout Styles

Use GitHub-flavored markdown callouts for emphasis:

```markdown
> [!NOTE]
> Informational callout for tips and supplementary context.

> [!TIP]
> Best practice recommendation or optimization suggestion.

> [!IMPORTANT]
> Critical configuration or requirement that must not be overlooked.

> [!WARNING]
> Security concern, reliability risk, or potential issue.

> [!CAUTION]
> Potential data loss, breaking change, or irreversible action.
```

### When to Use Each Callout

| Callout        | Use For                              | Example                                         |
| -------------- | ------------------------------------ | ----------------------------------------------- |
| `[!NOTE]`      | Background info, context, FYI        | "Note: This service is in preview."             |
| `[!TIP]`       | Best practices, optimizations        | "Tip: Use managed identities over keys."        |
| `[!IMPORTANT]` | Must-do items, critical config       | "Important: Enable TLS 1.2 minimum."            |
| `[!WARNING]`   | Security risks, reliability concerns | "Warning: Public endpoint exposed."             |
| `[!CAUTION]`   | Data loss risk, irreversible actions | "Caution: Purge protection cannot be disabled." |

---

## Status Indicators (Emoji)

Use consistent emoji for status indication:

| Purpose           | Emoji | Usage Example                      |
| ----------------- | ----- | ---------------------------------- |
| Success/Complete  | ✅    | `✅ Health check passed`           |
| Warning/Attention | ⚠️    | `⚠️ Requires manual configuration` |
| Error/Critical    | ❌    | `❌ Validation failed`             |
| Info/Tip          | 💡    | `💡 Consider using Premium tier`   |
| Security          | 🔐    | `🔐 Requires Key Vault access`     |
| Cost              | 💰    | `💰 Estimated: $50/month`          |
| Reference/Link    | 📚    | `📚 See: Microsoft Learn`          |
| Time/Schedule     | ⏰    | `⏰ Runs daily at 02:00 UTC`       |
| Pending           | ⏳    | `⏳ Awaiting approval`             |

---

## Category Icons

Use consistent icons for resource categories:

| Category   | Icon | Example                       |
| ---------- | ---- | ----------------------------- |
| Compute    | 💻   | `### 💻 Compute Resources`    |
| Data       | 💾   | `### 💾 Data Services`        |
| Networking | 🌐   | `### 🌐 Networking Resources` |
| Messaging  | 📨   | `### 📨 Messaging Resources`  |
| Security   | 🔐   | `### 🔐 Security Resources`   |
| Monitoring | 📊   | `### 📊 Monitoring Resources` |
| Identity   | 👤   | `### 👤 Identity & Access`    |
| Storage    | 📦   | `### 📦 Storage Resources`    |

---

## WAF Pillar Icons

Use consistent icons for Well-Architected Framework pillars:

| Pillar                 | Icon | Usage                           |
| ---------------------- | ---- | ------------------------------- |
| Security               | 🔒   | `### 🔒 Security Assessment`    |
| Reliability            | 🔄   | `### 🔄 Reliability Assessment` |
| Performance Efficiency | ⚡   | `### ⚡ Performance Assessment` |
| Cost Optimization      | 💰   | `### 💰 Cost Assessment`        |
| Operational Excellence | 🔧   | `### 🔧 Operational Excellence` |

---

## Collapsible Sections

Use HTML `<details>` tags for lengthy content that doesn't need to be visible by default:

```markdown
<details>
<summary>📋 Detailed Resource Configuration</summary>

| Resource  | Setting  | Value  |
| --------- | -------- | ------ |
| Resource1 | Setting1 | Value1 |
| Resource1 | Setting2 | Value2 |

</details>
```

### When to Use Collapsible Sections

- Long tables (>10 rows)
- Detailed configuration that's reference material
- Code examples that support but aren't central to the narrative
- Historical data or change logs
- Appendix content

### Collapsible Section Patterns

````markdown
<!-- For code blocks -->
<details>
<summary>🔧 PowerShell Script</summary>

```powershell
# Script content here
```
````

</details>

<!-- For tables -->
<details>
<summary>📊 Full Resource Inventory (15 resources)</summary>

| Name | Type | SKU |
| ---- | ---- | --- |
| ...  | ...  | ... |

</details>

<!-- For KQL queries -->
<details>
<summary>📈 KQL Query: Error Analysis</summary>

```kusto
// Query content
```

</details>
```

---

## References Section

Every documentation artifact SHOULD include a `## References` section at the bottom with relevant Microsoft Learn links.

### Standard Format

```markdown
---

## References

> [!NOTE]
> 📚 The following Microsoft Learn resources provide additional guidance.

| Topic                       | Link                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| Well-Architected Framework  | [Overview](https://learn.microsoft.com/azure/well-architected/)            |
| Azure Backup Best Practices | [Guidance](https://learn.microsoft.com/azure/backup/backup-best-practices) |
```

### Reference Links by Topic

#### Well-Architected Framework

| Topic                            | URL                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| WAF Overview                     | https://learn.microsoft.com/azure/well-architected/                                 |
| Reliability Checklist            | https://learn.microsoft.com/azure/well-architected/reliability/checklist            |
| Security Checklist               | https://learn.microsoft.com/azure/well-architected/security/checklist               |
| Cost Optimization Checklist      | https://learn.microsoft.com/azure/well-architected/cost-optimization/checklist      |
| Operational Excellence Checklist | https://learn.microsoft.com/azure/well-architected/operational-excellence/checklist |
| Performance Efficiency Checklist | https://learn.microsoft.com/azure/well-architected/performance-efficiency/checklist |

#### Backup & Disaster Recovery

| Topic                  | URL                                                                              |
| ---------------------- | -------------------------------------------------------------------------------- |
| Azure Backup Overview  | https://learn.microsoft.com/azure/backup/backup-overview                         |
| Backup Best Practices  | https://learn.microsoft.com/azure/backup/backup-best-practices                   |
| RTO/RPO Metrics        | https://learn.microsoft.com/azure/well-architected/reliability/metrics           |
| Site Recovery Overview | https://learn.microsoft.com/azure/site-recovery/site-recovery-overview           |
| Business Continuity    | https://learn.microsoft.com/azure/well-architected/reliability/disaster-recovery |

#### Security & Compliance

| Topic                              | URL                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Microsoft Cloud Security Benchmark | https://learn.microsoft.com/security/benchmark/azure/overview                          |
| Azure Policy                       | https://learn.microsoft.com/azure/governance/policy/overview                           |
| Managed Identities                 | https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview |
| Key Vault Best Practices           | https://learn.microsoft.com/azure/key-vault/general/best-practices                     |
| Network Security Best Practices    | https://learn.microsoft.com/azure/security/fundamentals/network-best-practices         |

#### Monitoring & Operations

| Topic                   | URL                                                                         |
| ----------------------- | --------------------------------------------------------------------------- |
| Azure Monitor Overview  | https://learn.microsoft.com/azure/azure-monitor/overview                    |
| Log Analytics           | https://learn.microsoft.com/azure/azure-monitor/logs/log-analytics-overview |
| Alerting Best Practices | https://learn.microsoft.com/azure/azure-monitor/best-practices-alerts       |
| Application Insights    | https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview   |

#### Cost Management

| Topic                    | URL                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Cost Management Overview | https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management               |
| Azure Pricing Calculator | https://azure.microsoft.com/pricing/calculator/                                                        |
| Reserved Instances       | https://learn.microsoft.com/azure/cost-management-billing/reservations/save-compute-costs-reservations |

---

## Example: Enhanced Section

### Before (Plain)

```markdown
## Backup Strategy

| Resource | Backup Method | Retention |
| -------- | ------------- | --------- |
| SQL DB   | Automated     | 7 days    |
```

### After (Enhanced)

````markdown
## 💾 Backup Strategy

> [!IMPORTANT]
> Backup configurations must align with business RTO/RPO requirements.

| Resource   | Backup Method  | Retention | RTO | RPO | Status        |
| ---------- | -------------- | --------- | --- | --- | ------------- |
| ✅ SQL DB  | Automated PITR | 7 days    | 4h  | 1h  | Configured    |
| ⚠️ Storage | Manual export  | 30 days   | 24h | 24h | Review needed |

> [!TIP]
> 💡 Consider enabling geo-redundant backup for production workloads.

<details>
<summary>📚 Backup Configuration Commands</summary>

```bash
# Enable geo-redundant backup
az sql db update --resource-group rg-prod --server sql-prod --name db-main --backup-storage-redundancy Geo
```
````

</details>

---

## References

| Topic                       | Link                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Azure Backup Best Practices | [Microsoft Learn](https://learn.microsoft.com/azure/backup/backup-best-practices)                       |
| Geo-Redundant Backup        | [Documentation](https://learn.microsoft.com/azure/backup/backup-create-rs-vault#set-storage-redundancy) |

```

---

_Last updated: February 2025_
```
