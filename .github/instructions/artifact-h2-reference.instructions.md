---
applyTo: "**/agent-output/**/*.md"
description: "MANDATORY template compliance rules for artifact generation"
---

# Artifact Generation Rules - MANDATORY

> **CRITICAL**: This file is the SINGLE SOURCE OF TRUTH for artifact H2 headings.
> All agents MUST use these EXACT headings when generating artifacts.
> Violations block commits (pre-commit) and PRs (CI validation).

## Golden Rule

**DO NOT INVENT H2 HEADINGS.** Use ONLY the headings listed below for each artifact type.

## Complete H2 Heading Reference

> **IMPORTANT**: Copy-paste these headings. Do not paraphrase or abbreviate.

---

### 01-requirements.md

```markdown
## Project Overview
## Functional Requirements
## Non-Functional Requirements (NFRs)
## Compliance & Security Requirements
## Budget
## Operational Requirements
## Regional Preferences
## References  <!-- Optional, add at end -->
```

**H3 subsections** (within H2s above):

- `## Project Overview` → Business Context
- `## Functional Requirements` → Core Capabilities, User Types, Integrations,
  Data Types, Architecture Pattern
- `## Non-Functional Requirements (NFRs)` → Availability & Reliability,
  Performance, Scalability
- `## Compliance & Security Requirements` → Regulatory Frameworks,
  Data Residency, Auth & Authorization, Network Security,
  Recommended Security Controls
- `## Budget` → Cost Optimization Priorities (optional)
- `## Operational Requirements` → Monitoring & Alerting, Support & Maintenance, Backup & Disaster Recovery

---

### 02-architecture-assessment.md

```markdown
## Requirements Validation ✅
## Executive Summary
## WAF Pillar Assessment
## Resource SKU Recommendations
## Architecture Decision Summary
## Implementation Handoff
## Approval Gate
## References  <!-- Optional, add at end -->
```

---

### 04-implementation-plan.md

```markdown
## Overview
## Resource Inventory
## Module Structure
## Implementation Tasks
## Dependency Graph
## Naming Conventions
## Security Configuration
## Estimated Implementation Time
## Approval Gate
## References  <!-- Optional, add at end -->
```

---

### 04-governance-constraints.md

```markdown
## Discovery Source
## Azure Policy Compliance
## Required Tags
## Security Policies
## Cost Policies
## Network Policies
## Plan Adaptations Based on Policies  <!-- Optional, add after Network Policies -->
## Deployment Blockers  <!-- Optional, add after Plan Adaptations -->
## References  <!-- Optional, add at end -->
```

---

### 04-preflight-check.md

```markdown
## Purpose
## AVM Schema Validation Results
## Parameter Type Analysis
## Region Limitations Identified
## Pitfalls Checklist
## Ready for Implementation
## References  <!-- Optional, add at end -->
```

---

### 05-implementation-reference.md

```markdown
## Bicep Templates Location
## File Structure
## Validation Status
## Resources Created
## Deployment Instructions
## References  <!-- Optional, add at end -->
```

---

### 06-deployment-summary.md

```markdown
## Preflight Validation
## Deployment Details
## Deployed Resources
## Outputs (Expected)
## To Actually Deploy
## Post-Deployment Tasks
## References  <!-- Optional, add at end -->
```

---

### 07-documentation-index.md

```markdown
## 1. Document Package Contents
## 2. Source Artifacts
## 3. Project Summary
## 4. Related Resources
## 5. Quick Links
## References  <!-- Optional, add at end -->
```

---

### 07-design-document.md

```markdown
## 1. Introduction
## 2. Azure Architecture Overview
## 3. Networking
## 4. Storage
## 5. Compute
## 6. Identity & Access
## 7. Security & Compliance
## 8. Backup & Disaster Recovery
## 9. Management & Monitoring
## 10. Appendix
## References  <!-- Optional, add at end -->
```

---

### 07-operations-runbook.md

```markdown
## Quick Reference
## 1. Daily Operations
## 2. Incident Response
## 3. Common Procedures
## 4. Maintenance Windows
## 5. Contacts & Escalation
## 6. Change Log
## References  <!-- Optional, add at end -->
```

---

### 07-resource-inventory.md

```markdown
## Summary
## Resource Listing
## References  <!-- Optional, add at end -->
```

---

### 07-backup-dr-plan.md

```markdown
## Executive Summary
## 1. Recovery Objectives
## 2. Backup Strategy
## 3. Disaster Recovery Procedures
## 4. Testing Schedule
## 5. Communication Plan
## 6. Roles and Responsibilities
## 7. Dependencies
## 8. Recovery Runbooks
## 9. Appendix
## References  <!-- Optional, add at end -->
```

---

### 07-compliance-matrix.md

```markdown
## Executive Summary
## 1. Control Mapping
## 2. Gap Analysis
## 3. Evidence Collection
## 4. Audit Trail
## 5. Remediation Tracker
## 6. Appendix
## References  <!-- Optional, add at end -->
```

---

### 07-ab-cost-estimate.md

> **NOTE**: Cost estimate files follow a separate template with emoji-prefixed headings
> and are validated by `validate-cost-estimate-templates.mjs`, NOT the artifact template validator.
> See the actual template for the definitive heading structure:

**Template**: `.github/templates/07-ab-cost-estimate.template.md`

```markdown
## 💰 Cost At-a-Glance
## ✅ Decision Summary
## 🔁 Requirements → Cost Mapping
## 📊 Top 5 Cost Drivers
## Architecture Overview
## 🧾 What We Are Not Paying For (Yet)
## ⚠️ Cost Risk Indicators
## 🎯 Quick Decision Matrix
## 💰 Savings Opportunities
## Detailed Cost Breakdown
## References  <!-- Required -->
```

---

## Enforcement Layers

| Layer | Mechanism | When |
|-------|-----------|------|
| 1. Instructions | This file auto-applies to all agent-output | Generation time |
| 2. Pre-commit | `npm run lint:artifact-templates` via Lefthook | Before commit |
| 3. CI/CD | Same validation in GitHub Actions | Before merge |
| 4. Agent Definition | Each agent embeds its artifact's H2 structure | Agent invocation |

## Error Messages and Fixes

If you see:
```
missing required H2 headings: ## Outputs (Expected)
```

**Fix**: You used `## Outputs` instead of `## Outputs (Expected)`. Use the EXACT text.

If you see:
```
contains extra H2 headings: ## Cost Summary
```

**Fix**: `## Cost Summary` is not in the template. Either:
1. Remove it
2. Change to H3: `### Cost Summary` (under a valid H2)
3. Move after `## References` as optional section

## Generation Workflow

```
1. Identify artifact type (e.g., 06-deployment-summary.md)
2. Find matching section in THIS FILE (above)
3. Use EXACT H2 headings in EXACT order
4. Fill content under each H2
5. Add ## References at end (always allowed)
6. Add custom H3 subsections under H2s as needed
```

## Why This Matters

- Validation runs on every commit
- Non-compliant artifacts block commits
- CI fails if artifacts don't match
- Consistent structure enables automation

## Quick Reference Card

| Artifact | First H2 | Last Required H2 |
|----------|----------|------------------|
| 01-requirements | `## Project Overview` | `## Regional Preferences` |
| 02-architecture | `## Requirements Validation ✅` | `## Approval Gate` |
| 04-implementation-plan | `## Overview` | `## Approval Gate` |
| 04-governance | `## Discovery Source` | `## Network Policies` |
| 04-preflight | `## Purpose` | `## Ready for Implementation` |
| 05-implementation-ref | `## Bicep Templates Location` | `## Deployment Instructions` |
| 06-deployment | `## Preflight Validation` | `## Post-Deployment Tasks` |
| 07-doc-index | `## 1. Document Package Contents` | `## 5. Quick Links` |
| 07-design | `## 1. Introduction` | `## 10. Appendix` |
| 07-runbook | `## Quick Reference` | `## 6. Change Log` |
| 07-inventory | `## Summary` | `## Resource Listing` |
| 07-backup-dr | `## Executive Summary` | `## 9. Appendix` |
| 07-compliance | `## Executive Summary` | `## 6. Appendix` |
| 07-cost | `## 💰 Cost At-a-Glance` | `## Detailed Cost Breakdown` |
