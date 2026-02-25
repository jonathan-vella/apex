---
applyTo: "**/agent-output/**/*.md"
description: "MANDATORY template compliance rules for artifact generation"
---

# Artifact Generation Rules - MANDATORY

> **CRITICAL**: This file is the ENFORCEMENT TRIGGER for artifact H2 headings.
> All agents MUST use these EXACT headings when generating artifacts.
> Violations block commits (pre-commit) and PRs (CI validation).

> [!NOTE]
> This instruction file and the `azure-artifacts` skill (`SKILL.md`) intentionally
> contain the same H2 heading lists. The `SKILL.md` is the authoritative source;
> this instruction file is the enforcement trigger via `applyTo` scope.
> For template mapping, generation workflow, styling, and standard components,
> read the SKILL.md directly.

## Complete H2 Heading Reference

> **IMPORTANT**: Copy-paste these headings. Do not paraphrase or abbreviate.

### 01-requirements.md

```text
## 🎯 Project Overview
## 🚀 Functional Requirements
## ⚡ Non-Functional Requirements (NFRs)
## 🔒 Compliance & Security Requirements
## 💰 Budget
## 🔧 Operational Requirements
## 🌍 Regional Preferences
## 📋 Summary for Architecture Assessment
## References <!-- Optional, add at end -->
```

### 02-architecture-assessment.md

```text
## ✅ Requirements Validation
## 💎 Executive Summary
## 🏛️ WAF Pillar Assessment
## 📦 Resource SKU Recommendations
## 🎯 Architecture Decision Summary
## 🚀 Implementation Handoff
## 🔒 Approval Gate
## References <!-- Optional, add at end -->
```

### 03-des-cost-estimate.md

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
## References <!-- Required -->
```

### 04-implementation-plan.md

```text
## 📋 Overview
## 📦 Resource Inventory
## 🗂️ Module Structure
## 🔨 Implementation Tasks
## 🚀 Deployment Phases
## 🔗 Dependency Graph
## 🔄 Runtime Flow Diagram
## 🏷️ Naming Conventions
## 🔐 Security Configuration
## ⏱️ Estimated Implementation Time
## 🔒 Approval Gate
## References <!-- Optional, add at end -->
```

### 04-governance-constraints.md

```text
## 🔍 Discovery Source
## 📋 Azure Policy Compliance
## 🔄 Plan Adaptations Based on Policies
## 🚫 Deployment Blockers
## 🏷️ Required Tags
## 🔐 Security Policies
## 💰 Cost Policies
## 🌐 Network Policies
## References <!-- Optional, add at end -->
```

### 04-preflight-check.md

```text
## 🎯 Purpose
## ✅ AVM Schema Validation Results
## 🔎 Parameter Type Analysis
## 🌍 Region Limitations Identified
## ⚠️ Pitfalls Checklist
## 🚀 Ready for Implementation
## References <!-- Optional, add at end -->
```

### 05-implementation-reference.md

```text
## 📁 IaC Templates Location
## 🗂️ File Structure
## ✅ Validation Status
## 🏗️ Resources Created
## 🚀 Deployment Instructions
## 📝 Key Implementation Notes
## References <!-- Optional, add at end -->
```

### 06-deployment-summary.md

```text
## ✅ Preflight Validation
## 📋 Deployment Details
## 🏗️ Deployed Resources
## 📤 Outputs (Expected)
## 🚀 To Actually Deploy
## 📝 Post-Deployment Tasks
## References <!-- Optional, add at end -->
```

### 07-documentation-index.md

```text
## 📦 1. Document Package Contents
## 📚 2. Source Artifacts
## 📋 3. Project Summary
## 🔗 4. Related Resources
## ⚡ 5. Quick Links
## References <!-- Optional, add at end -->
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
## References <!-- Optional, add at end -->
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
## References <!-- Optional, add at end -->
```

### 07-resource-inventory.md

```text
## 📊 Summary
## 📦 Resource Listing
## References <!-- Optional, add at end -->
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
## References <!-- Optional, add at end -->
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
## References <!-- Optional, add at end -->
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
## References <!-- Required -->
```

## Enforcement Layers

| Layer           | Mechanism                                      | When                 |
| --------------- | ---------------------------------------------- | -------------------- |
| 1. Instructions | This file auto-applies to all agent-output     | Generation time      |
| 2. Pre-commit   | `npm run lint:artifact-templates` via Lefthook | Before commit        |
| 3. CI/CD        | Same validation in GitHub Actions              | Before merge         |
| 4. Auto-fix     | `npm run fix:artifact-h2`                      | On-demand correction |

## Quick Fix Command

```bash
# Analyze what's wrong
npm run fix:artifact-h2 agent-output/{project}/{file}.md

# Auto-fix where possible
npm run fix:artifact-h2 agent-output/{project}/{file}.md --apply
```

## Common Errors and Fixes

If you see:

```text
missing required H2 headings: ## Outputs (Expected)
```

**Fix**: You used `## Outputs` instead of `## Outputs (Expected)`. Use the EXACT text.

If you see:

```text
contains extra H2 headings: ## Cost Summary
```

**Fix**: `## Cost Summary` is not in the template. Either:

1. Remove it
2. Change to H3: `### Cost Summary` (under a valid H2)
3. Move after `## References` as optional section

## Quick Reference Card

| Artifact               | First H2                             | Last Required H2                            |
| ---------------------- | ------------------------------------ | ------------------------------------------- |
| 01-requirements        | `## 🎯 Project Overview`             | `## 📋 Summary for Architecture Assessment` |
| 02-architecture        | `## ✅ Requirements Validation`      | `## 🔒 Approval Gate`                       |
| 04-implementation-plan | `## 📋 Overview`                     | `## 🔒 Approval Gate`                       |
| 04-governance          | `## 🔍 Discovery Source`             | `## 🌐 Network Policies`                    |
| 04-preflight           | `## 🎯 Purpose`                      | `## 🚀 Ready for Implementation`            |
| 05-implementation-ref  | `## 📁 IaC Templates Location`       | `## 📝 Key Implementation Notes`            |
| 06-deployment          | `## ✅ Preflight Validation`         | `## 📝 Post-Deployment Tasks`               |
| 07-doc-index           | `## 📦 1. Document Package Contents` | `## ⚡ 5. Quick Links`                      |
| 07-design              | `## 📝 1. Introduction`              | `## 📎 10. Appendix`                        |
| 07-runbook             | `## ⚡ Quick Reference`              | `## 📝 6. Change Log`                       |
| 07-inventory           | `## 📊 Summary`                      | `## 📦 Resource Listing`                    |
| 07-backup-dr           | `## 📋 Executive Summary`            | `## 📎 9. Appendix`                         |
| 07-compliance          | `## 📋 Executive Summary`            | `## 📎 6. Appendix`                         |
| 07-cost                | `## 💵 Cost At-a-Glance`             | `## 🧾 Detailed Cost Breakdown`             |
