<!-- ref:07-docs-template-v1 -->

# Step 7: Workload Documentation Templates

### 07-documentation-index.md

```text
## 📦 1. Document Package Contents
## 📚 2. Source Artifacts
## 📋 3. Project Summary
## 🔗 4. Related Resources
## ⚡ 5. Quick Links
```

### 07-design-document.md

```text
## 📝 1. Introduction
## 🏛️ 2. Azure Architecture Overview
## 🌐 3. Networking
## 💾 4. Storage
## 💻 5. Compute
## 👤 6. Identity & Access
## 🔐 7. Security & Compliance
## 🔄 8. Backup & Disaster Recovery
## 📊 9. Management & Monitoring
## 📎 10. Appendix
## References
```

### 07-operations-runbook.md

```text
## ⚡ Quick Reference
## 📋 1. Daily Operations
## 🚨 2. Incident Response
## 🔧 3. Common Procedures
## 🕐 4. Maintenance Windows
## 📞 5. Contacts & Escalation
## 📝 6. Change Log
## References
```

### 07-resource-inventory.md

```text
## 📊 Summary
## 📦 Resource Listing
## References
```

### 07-ab-cost-estimate.md

```text
## 💵 Cost At-a-Glance
## ✅ Decision Summary
## 🔁 Requirements → Cost Mapping
## 📊 Top 5 Cost Drivers
## 🏛️ Architecture Overview
## 🧾 What We Are Not Paying For (Yet)
## ⚠️ Cost Risk Indicators
## 🎯 Quick Decision Matrix
## 💰 Savings Opportunities
## 🧾 Detailed Cost Breakdown
## References
```

### 07-backup-dr-plan.md

```text
## 📋 Executive Summary
## 🎯 1. Recovery Objectives
## 💾 2. Backup Strategy
## 🌍 3. Disaster Recovery Procedures
## 🧪 4. Testing Schedule
## 📢 5. Communication Plan
## 👥 6. Roles and Responsibilities
## 🔗 7. Dependencies
## 📖 8. Recovery Runbooks
## 📎 9. Appendix
## References
```

### 07-compliance-matrix.md

```text
## 📋 Executive Summary
## 🗺️ 1. Control Mapping
## 🔍 2. Gap Analysis
## 📁 3. Evidence Collection
## 📝 4. Audit Trail
## 🔧 5. Remediation Tracker
## 📎 6. Appendix
## References
```

### PROJECT-README.md

```text
## Template Instructions
## Required Structure
## 📋 Project Summary
## ✅ Workflow Progress
## 🏛️ Architecture
## 📄 Generated Artifacts
## 🔗 Related Resources
```

## Generation Workflow

1. **Gather Context** — Read project artifacts (01-06)
2. **Check H2 Structures** — Reference templates above
3. **Extract Resources** — Parse from `06-deployment-summary.md`
4. **Query Pricing** — Use Azure Resource Manager MCP through the cost subagent
5. **Generate Documents** — Follow H2 structure exactly
6. **Cross-Reference** — Ensure consistency across documents
7. **Create Index** — Generate `07-documentation-index.md` last

## Step 7 Source Artifacts

| Source                          | Information Extracted              |
| ------------------------------- | ---------------------------------- |
| `01-requirements.md`            | Business context, NFRs, compliance |
| `02-architecture-assessment.md` | WAF scores, SKU recommendations    |
| `04-implementation-plan.md`     | Resource inventory, dependencies   |
| `06-deployment-summary.md`      | Deployed resources, outputs        |
| `infra/bicep/{project}/`        | Actual Bicep configuration values  |
