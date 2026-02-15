---
applyTo: "**/04-governance-constraints.md, **/04-governance-constraints.json"
description: "MANDATORY Azure Policy discovery requirements for governance constraints"
---

# Governance Discovery Instructions

**CRITICAL**: Governance constraints MUST be discovered from the live Azure
environment, NOT assumed from best practices.
**GATE**: This is a mandatory gate. If Azure connectivity fails or policies
cannot be retrieved, STOP and inform the user.
Do NOT generate governance constraints from assumptions.

## Why This Matters

Assumed governance constraints cause deployment failures. Example:

- **Assumed**: 4 tags required (Environment, ManagedBy, Project, Owner)
- **Actual**: 9 tags required via Azure Policy (environment, owner, costcenter, application,
  workload, sla, backup-policy, maint-window, tech-contact)
- **Result**: Deployment denied by Azure Policy

**Management group-inherited policies are invisible to basic queries.** Example:

- **`az policy assignment list`**: Returns only 5 subscription-scoped policies
- **Portal shows**: 19 total (includes 7 inherited from management groups)
- **Missed**: `MCAPSGov Deny Policies`, `Block Azure RM Resource Creation` — actual deployment
  blockers!

## Discovery Is Delegated to Subagent

The `governance-discovery-subagent` handles all procedural work:

1. Verifies Azure connectivity via ARM token
2. Queries ALL policy assignments via REST API (including MG-inherited)
3. Drills into Deny/DeployIfNotExists definitions to verify actual impact
4. Classifies effects and returns a structured report

See `.github/agents/_subagents/governance-discovery-subagent.agent.md` for the complete
discovery procedure, REST API commands, and output format.

**This instruction file defines the output format standards and decision framework
that the parent agent (Bicep Plan) applies to the subagent's findings.**

## Required Documentation

The `04-governance-constraints.md` file MUST include:

### Discovery Source Section (MANDATORY)

```markdown
## Discovery Source

> [!IMPORTANT]
> Governance constraints discovered via REST API including management group-inherited policies.

| Query              | Result                 | Timestamp  |
| ------------------ | ---------------------- | ---------- |
| REST API Total     | {X} assignments total  | {ISO-8601} |
| Subscription-scope | {X} direct assignments | {ISO-8601} |
| MG-inherited       | {X} inherited policies | {ISO-8601} |
| Deny-effect        | {X} blockers found     | {ISO-8601} |
| Tag Policies       | {X} tags required      | {ISO-8601} |
| Security Policies  | {X} constraints        | {ISO-8601} |

**Discovery Method**: REST API (`/providers/Microsoft.Authorization/policyAssignments`)
**Subscription**: {subscription-name} (`{subscription-id}`)
**Tenant**: {tenant-id}
**Scope**: All effective (subscription + management group inherited)
**Portal Validation**: {X} assignments shown in Portal — matches REST API count: {Y/N}
```

**GATE CHECK**: If `Portal Validation` shows a mismatch, STOP and investigate.
All policies visible in the Portal must be captured in the governance document.

### Fail-Safe: If Discovery Fails

If the subagent returns PARTIAL or FAILED status:

1. **STOP** — Do NOT proceed to implementation planning
2. Document the failure in the governance constraints file
3. Mark all constraints as "⚠️ UNVERIFIED - Query Failed"
4. Add warning: "⛔ GATE BLOCKED: Deployment CANNOT proceed due to undiscovered
   policy requirements"
5. **Do NOT generate assumed/best-practice policies as a fallback**

## Policy Effect Decision Tree

```text
Policy with Deny Effect Discovered
    ↓
Extract: Policy Name, Scope, Enforcement Mode
    ↓
Does it apply to this deployment?
    ↓
├─ NO → Document for awareness, proceed
└─ YES → Does it block proposed architecture?
        ↓
    ├─ NO → Document compliance, proceed
    └─ YES → Can architecture be adapted to comply?
            ↓
        ├─ YES → Update implementation plan with compliant alternative
        │        Document adaptation in "## Plan Adaptations" section
        └─ NO → Flag as DEPLOYMENT BLOCKER
                 Add to "## Deployment Blockers" section
                 Status: "⚠️ CANNOT PROCEED WITHOUT EXEMPTION"
```

## Policy Effect Handling (Shift-Left Enforcement)

**CRITICAL**: Discovered policies MUST influence the implementation plan, not just be documented.

| Policy Effect         | Impact                                | Required Action                                  |
| --------------------- | ------------------------------------- | ------------------------------------------------ |
| **Deny**              | Deployment blocked if non-compliant   | Adapt architecture OR flag exemption requirement |
| **DeployIfNotExists** | Missing resources auto-deployed       | Include expected resources in plan               |
| **Modify**            | Resources auto-modified at deployment | Document expected modifications                  |
| **Audit**             | Non-compliance logged but allowed     | Document compliance expectations                 |
| **Disabled**          | Policy not enforced                   | Note for awareness                               |

## Misleading Policy Names — Verify Definitions

> [!WARNING]
> **NEVER trust policy display names alone.** Policy named "Block Azure RM Resource Creation"
> may actually only block Classic resources.

| Policy Name Pattern          | Likely Actual Behavior                    | Verify By Checking                                     |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| "Block Azure RM..."          | May only block Classic resources          | policyRule.if contains "ClassicCompute", etc.          |
| "Require [feature]"          | May only apply to specific resource types | policyRule.if.field == "type"                          |
| "Deny [action]" with tag ref | May only apply if specific tags exist     | policyRule.if contains resourceGroup().tags            |
| "Enforce [setting]"          | May only modify, not deny                 | policyRule.then.effect == "modify"/"deployIfNotExists" |

## Plan Adaptation Examples

**Storage Public Access Denied:**

```markdown
| Original Design     | Blocking Policy                | Effect | Adaptation Applied                   |
| ------------------- | ------------------------------ | ------ | ------------------------------------ |
| Public blob storage | "Deny public storage accounts" | Deny   | Private endpoints + vNet integration |
```

**Required Diagnostic Settings:**

```markdown
| Policy                                   | Effect            | Auto-Applied Resource             |
| ---------------------------------------- | ----------------- | --------------------------------- |
| "Deploy diagnostic settings for Storage" | DeployIfNotExists | Log Analytics diagnostic settings |
```

## Validation Checklist

Before completing governance constraints, verify:

- [ ] Subagent returned COMPLETE status (not PARTIAL or FAILED)
- [ ] Discovery Source section is populated with timestamps
- [ ] REST API count matches Azure Portal count
- [ ] All tag requirements match actual Azure Policy (case-sensitive!)
- [ ] Security policies reflect actual enforcement (deny vs audit)
- [ ] Deny policies have been drilled into (actual policyRule verified)
- [ ] Plan adaptations documented for each blocker
- [ ] No placeholder values like `{requirement}` remain

## Anti-Patterns (DO NOT DO)

❌ **Assumption-based constraints**:

```markdown
## Required Tags

Based on Azure best practices, the following tags are recommended...
```

✅ **Discovery-based constraints**:

```markdown
## Required Tags

Discovered from Azure Policy assignment "JV-Inherit Multiple Tags" (effect: modify):

- environment, owner, costcenter, application, workload, sla, backup-policy, maint-window,
  tech-contact
```
