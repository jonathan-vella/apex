---
title: "Adversarial Reviews"
description: "Challenger agent findings across all workflow steps"
sidebar:
  order: 9
---

:::caution[Adversarial Review]
The Challenger agent runs rotating-lens reviews at each workflow step — checking for security gaps, governance violations, WAF blind spots, and cost issues. Findings below are actual agent output.
:::

## Review Summary

| Review | Lens | Findings |
|--------|------|----------|
| requirements | comprehensive | 7 must-fix, 0 should-fix |
| architecture pass1 | security-governance | 6 must-fix, 0 should-fix |
| architecture pass2 | architecture-reliability | 7 must-fix, 0 should-fix |
| architecture pass3 | cost-feasibility | 6 must-fix, 0 should-fix |
| cost estimate | comprehensive | 7 must-fix, 0 should-fix |
| governance constraints pass1 | comprehensive | 0 must-fix, 0 should-fix |
| governance revalidation | comprehensive | 0 must-fix, 0 should-fix |
| plan pass1 | comprehensive | 0 must-fix, 0 should-fix |
| plan pass2 | comprehensive | 0 must-fix, 0 should-fix |
| plan pass3 | comprehensive | 0 must-fix, 0 should-fix |
| plan revalidation | comprehensive | 0 must-fix, 0 should-fix |
| deployment | comprehensive | 4 must-fix, 0 should-fix |

## Detailed Findings


### requirements

- **[must_fix]** Azure AD B2C is an invalid default for a 2026 greenfield build
- **[must_fix]** EU-only residency stops at Azure and ignores external processors
- **[must_fix]** Environment topology is incompatible with a public regulated launch
- **[should_fix]** The requirements pre-select an undersized platform before architecture validation
- **[should_fix]** Complexity is understated and may suppress downstream review depth
- *...and 2 more findings*

### architecture pass1

- **[must_fix]** Private endpoints are specified without explicitly shutting off SQL and Storage public access
- **[must_fix]** GDPR residency and processor obligations are asserted, not validated
- **[must_fix]** The PCI token-only model is not proven by the proposed payment flow
- **[should_fix]** Azure Policy compliance is presented as covered before live discovery occurs
- **[should_fix]** Key Vault is hardened for RBAC and recovery, but not for network isolation
- *...and 1 more findings*

### architecture pass2

- **[must_fix]** 99.9% workload SLA is not currently achievable from the stated availability budget
- **[must_fix]** Regional disaster recovery path is incomplete for full workload recovery
- **[must_fix]** External integration outages can cascade into order-processing failures
- **[should_fix]** Health-check automation is contradictory across sections
- **[should_fix]** Autoscale strategy is under-validated for 3x peak and growth path
- *...and 2 more findings*

### architecture pass3

- **[must_fix]** Peak-season estimate scales only compute and underprices 3x demand
- **[should_fix]** Peak totals are internally inconsistent across sections
- **[should_fix]** Free-tier assumptions sit at pricing cliffs without overflow modeling
- **[should_fix]** Private Link and DNS variable charges are only partially modeled
- **[should_fix]** Budget monitoring design is below mandatory cost-governance baseline
- *...and 1 more findings*

### cost estimate

- **[must_fix]** Peak-season cost model is internally inconsistent and not approval-safe
- **[should_fix]** Workspace-based Application Insights is priced with wrong billing model
- **[should_fix]** Savings opportunities are not operationally achievable as written
- **[should_fix]** Variable networking and storage meters are omitted or understated
- **[should_fix]** Cost guardrails below repository baseline
- *...and 2 more findings*

### governance constraints pass1

No findings.

### governance revalidation

No findings.

### plan pass1

No findings.

### plan pass2

No findings.

### plan pass3

No findings.

### plan revalidation

No findings.

### deployment

- **[must_fix]** SQL Entra admin placeholders will block SQL server provisioning
- **[should_fix]** App Service still lacks automated SQL data-plane bootstrap
- **[should_fix]** Subscription Activity Log routing is outside what-if and appears miswired
- **[should_fix]** Cost governance is incomplete and too loose for the documented spend profile
