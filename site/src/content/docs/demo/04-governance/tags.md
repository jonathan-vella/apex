---
title: "Tagging Policy"
sidebar:
  order: 1
---

## 🏷️ Required Tags

### Resource Group Level (Policy-Enforced)

```bicep
// All 9 tags are MANDATORY on resource groups (Azure Policy: Deny)
var rgTags = {
  environment: environment          // 'dev' | 'prod'
  owner: owner                       // team or individual
  costcenter: costCenter             // cost center code
  application: applicationName       // application identifier
  workload: workloadName             // workload type
  sla: slaTarget                     // SLA percentage
  'backup-policy': backupPolicy      // backup schedule
  'maint-window': maintWindow        // maintenance window
  'technical-contact': techContact   // technical contact email
  // Best-practice additions (not policy-enforced):
  ManagedBy: 'Bicep'
  Project: 'nordic-fresh-foods'
}
```

### Child Resources (Auto-Inherited)

Child resources automatically receive all 9 policy-enforced tags from their resource group via the **JV - Inherit Multiple Tags** Modify policy. Additional resource-specific tags (e.g., `ManagedBy`, `Project`) should be set explicitly in templates.

---
