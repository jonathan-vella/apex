# Governance Discovery Reference

Deep domain knowledge for governance constraint discovery, policy effect
handling, and plan adaptations. Loaded on-demand by Planner agents.

## Policy Effect Handling

Discovered policies MUST influence the implementation plan, not just be documented.
Per-effect Planner and Code Generator actions live in the canonical
[policy effect decision tree](../../skills/apex-azure-defaults/references/policy-effect-decision-tree.md).
A Deny that the architecture cannot satisfy is a deployment blocker
("CANNOT PROCEED WITHOUT EXEMPTION"); an adaptable one is recorded under Plan Adaptations.

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

- [ ] `discover.py` exited 0 and `discovery_status` is COMPLETE (not PARTIAL or FAILED)
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

### JSON (`04-governance-constraints.json`)

`discover.py` writes this file; its envelope and per-finding fields
(`discovery_status`, `azurePropertyPath`, `bicepPropertyPath`, `requiredValue`, tag-policy
semantics) are defined in the skill's
[schema reference](../../skills/apex-azure-governance-discovery/references/schema.md) and
[`governance-constraints.schema.json`](../../../tools/schemas/governance-constraints.schema.json).

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
