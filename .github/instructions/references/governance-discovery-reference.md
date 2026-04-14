# Governance Discovery Reference

Deep domain knowledge for governance constraint discovery, policy effect
handling, and plan adaptations. Loaded on-demand by Planner agents.

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
                 Status: "CANNOT PROCEED WITHOUT EXEMPTION"
```

## Policy Effect Handling (Shift-Left Enforcement)

Discovered policies MUST influence the implementation plan, not just be documented.

| Policy Effect         | Impact                                | Required Action                                  |
| --------------------- | ------------------------------------- | ------------------------------------------------ |
| **Deny**              | Deployment blocked if non-compliant   | Adapt architecture OR flag exemption requirement |
| **DeployIfNotExists** | Missing resources auto-deployed       | Include expected resources in plan               |
| **Modify**            | Resources auto-modified at deployment | Document expected modifications                  |
| **Audit**             | Non-compliance logged but allowed     | Document compliance expectations                 |
| **Disabled**          | Policy not enforced                   | Note for awareness                               |

## Misleading Policy Names — Verify Definitions

**NEVER trust policy display names alone.** Policy named "Block Azure RM Resource Creation"
may actually only block Classic resources.

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

## Anti-Patterns

**Assumption-based constraints** (WRONG):

```markdown
## Required Tags

Based on Azure best practices, the following tags are recommended...
```

**Discovery-based constraints** (CORRECT):

```markdown
## Required Tags

Discovered from Azure Policy assignment "JV-Inherit Multiple Tags" (effect: modify):

- environment, owner, costcenter, application, workload, sla, backup-policy, maint-window,
  tech-contact
```

## Governance Constraints File Format

### JSON Schema (`04-governance-constraints.json`)

- Root: envelope object with `discovery_status` and `policies` fields (NOT a bare array)
- **`discovery_status`**: `"COMPLETE"`, `"PARTIAL"`, or `"FAILED"` — validated by Step 4 at startup
- **`policies`**: array of policy objects
- Required fields per policy: `displayName`, `policyDefinitionId`, `effect`, `scope`
- For `Deny` policies, add machine-actionable fields:
  - `bicepPropertyPath` (e.g., `"storageAccounts::properties.publicNetworkAccess"`)
  - `azurePropertyPath` (e.g., `"storageAccount.properties.publicNetworkAccess"`)
  - `requiredValue` (e.g., `"Disabled"`)
  - `affectedResourceTypes` (e.g., `["Microsoft.Storage/storageAccounts"]`)
- For tag-enforcement policies (Deny/Modify targeting tags, not resource properties):
  - `bicepPropertyPath`: `"resourceGroups::tags"`
  - `azurePropertyPath`: `"resourceGroup.tags"`
  - `requiredTags`: array of exact tag key names
  - `pathSemantics`: `"tag-policy-non-property"`
- These fields enable programmatic compliance verification by Code Generators
  and review subagents across both Bicep and Terraform

### Discovery Source Section (MANDATORY in `04-governance-constraints.md`)

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
