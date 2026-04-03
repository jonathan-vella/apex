<!-- ref:styling-standards-v1 -->

# Documentation Styling Standards

## Callout Styles

```markdown
> [!NOTE]
> Informational — background context, tips, FYI

> [!TIP]
> Best practice recommendation or optimization

> [!IMPORTANT]
> Critical configuration that must not be overlooked

> [!WARNING]
> Security concern, reliability risk, potential issue

> [!CAUTION]
> Data loss risk, breaking change, irreversible action
```

## Status Emoji

| Purpose           | Emoji | Example                     |
| ----------------- | ----- | --------------------------- |
| Success/Complete  | ✅    | `✅ Health check passed`    |
| Warning/Attention | ⚠️    | `⚠️ Requires manual config` |
| Error/Critical    | ❌    | `❌ Validation failed`      |
| Info/Tip          | 💡    | `💡 Consider Premium tier`  |
| Security          | 🔐    | `🔐 Requires Key Vault`     |
| Cost              | 💰    | `💰 Estimated: $50/month`   |

## Category Icons

| Category   | Icon | Usage                         |
| ---------- | ---- | ----------------------------- |
| Compute    | 💻   | `### 💻 Compute Resources`    |
| Data       | 💾   | `### 💾 Data Services`        |
| Networking | 🌐   | `### 🌐 Networking Resources` |
| Messaging  | 📨   | `### 📨 Messaging Resources`  |
| Security   | 🔐   | `### 🔐 Security Resources`   |
| Monitoring | 📊   | `### 📊 Monitoring Resources` |
| Identity   | 👤   | `### 👤 Identity & Access`    |
| Storage    | 📦   | `### 📦 Storage Resources`    |

## WAF Pillar Icons

| Pillar      | Icon |
| ----------- | ---- |
| Security    | 🔒   |
| Reliability | 🔄   |
| Performance | ⚡   |
| Cost        | 💰   |
| Operations  | 🔧   |

## Badge Row

Every artifact opens with badges after the title:

```markdown
![Step](https://img.shields.io/badge/Step-{n}-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-{Draft|Complete}-{orange|brightgreen}?style=for-the-badge)
![Agent](https://img.shields.io/badge/Agent-{agent--name}-purple?style=for-the-badge)
```

## Collapsible Table of Contents

Include after badge row using `<details open>`:

```markdown
<details open>
<summary><strong>📑 {Contextual Label}</strong></summary>

- Section Name (#section-name)

</details>
```

## Cross-Navigation

Header (after attribution):

```markdown
| ⬅️ Previous | 📑 Index  | Next ➡️ |
| ----------- | --------- | ------- |
| {prev-file} | README.md | {next}  |
```

Footer (end of document, before closing div):

```markdown
<div align="center">

| ⬅️ [{prev-file}]({prev-file}) | 🏠 [Project Index](README.md) | ➡️ [{next-file}]({next-file}) |
| ----------------------------- | ----------------------------- | ----------------------------- |

</div>
```

## Metadata Block

Place **after** the cross-navigation header and **before** the first H2 content section.
Use consistent field labels across all artifacts.

**Required fields** (all artifacts):

```markdown
**Generated**: {YYYY-MM-DD}
**Region**: {primary-region}
**Environment**: {Production|Staging|Development}
```

**Optional fields** (include when applicable):

```markdown
**Version**: {1.0}
**Source**: {e.g., Implemented Bicep Templates}
**MCP Tools Used**: {tool list}
**Architecture Reference**: [{link}]({path})
**IaC Reference**: [{link}]({path})
```

> [!IMPORTANT]
> Use **bold labels** (not table format) for metadata. Position consistently
> across all artifacts to aid scanning.

## Status Badge States

| State    | Color       | Badge Code                                                                                | When to Use                     |
| -------- | ----------- | ----------------------------------------------------------------------------------------- | ------------------------------- |
| Draft    | orange      | `![Status](https://img.shields.io/badge/Status-Draft-orange?style=for-the-badge)`         | Initial generation by agent     |
| Complete | brightgreen | `![Status](https://img.shields.io/badge/Status-Complete-brightgreen?style=for-the-badge)` | Agent has finished generating   |
| Approved | blue        | `![Status](https://img.shields.io/badge/Status-Approved-blue?style=for-the-badge)`        | User approved via approval gate |

> Agents should set **Complete** when generation finishes. Templates default to **Draft**.
> **Approved** is set only after explicit user approval at a workflow gate.

## References Section

```markdown
## References

> [!NOTE]
> 📚 Additional Microsoft Learn resources.

| Topic | Link |
| ----- | ---- |
| ...   | ...  |
```

## Common Reference Links

| Topic               | URL                                                              |
| ------------------- | ---------------------------------------------------------------- |
| WAF Overview        | `https://learn.microsoft.com/azure/well-architected/`            |
| Security Checklist  | `.../azure/well-architected/security/checklist`                  |
| Reliability         | `.../azure/well-architected/reliability/checklist`               |
| Cost Optimization   | `.../azure/well-architected/cost-optimization/checklist`         |
| Azure Backup        | `.../azure/backup/backup-best-practices`                         |
| Azure Monitor       | `.../azure/azure-monitor/overview`                               |
| Managed Identities  | `.../entra/identity/managed-identities-azure-resources/overview` |
| Key Vault Practices | `.../azure/key-vault/general/best-practices`                     |
| Pricing Calculator  | `https://azure.microsoft.com/pricing/calculator/`                |
