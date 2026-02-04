---
applyTo: "**/04-governance-constraints.md, **/04-governance-constraints.json"
description: "MANDATORY Azure Policy discovery requirements for governance constraints"
---

# Governance Discovery Instructions

**CRITICAL**: Governance constraints MUST be discovered from Azure Resource Graph, NOT assumed from best practices.

## Why This Matters

Assumed governance constraints cause deployment failures. Example:

- **Assumed**: 4 tags required (Environment, ManagedBy, Project, Owner)
- **Actual**: 9 tags required via Azure Policy (environment, owner, costcenter, application,
  workload, sla, backup-policy, maint-window, tech-contact)
- **Result**: Deployment denied by Azure Policy

## MANDATORY Discovery Workflow

### Step 1: Query Azure Policy Assignments

```text
MANDATORY: Before creating 04-governance-constraints.md, execute Azure Resource Graph query
to discover all active Azure Policy assignments in the target subscription.
```

Use `azure_resources-query_azure_resource_graph` with intent:

```text
Query ALL Azure Policy assignments including their display names, effects (deny/audit/modify),
enforcement mode, and the actual parameter values - specifically tag names that are enforced
```

### Step 2: Extract Tag Requirements

Query specifically for tag policies:

```text
Get all policy assignments with their display names and actual parameter values -
specifically looking for tag enforcement policies with names containing 'tag' or 'Tag'
```

Expected output includes:

- `tagName1`, `tagName2`, etc. with actual required tag names
- Effect (deny = deployment blocked, modify = auto-remediated, audit = logged)

### Step 3: Query Security Policies

```text
Query Azure Policy assignments related to security - TLS versions, HTTPS requirements,
public access restrictions, encryption requirements, authentication methods
```

### Step 4: Query Resource Restrictions

```text
Query Azure Policy assignments for allowed/denied resource types, SKU restrictions,
allowed locations, and naming conventions
```

## Required Documentation

The `04-governance-constraints.md` file MUST include:

### Discovery Source Section (MANDATORY)

```markdown
## Discovery Source

| Query              | Result                  | Timestamp  |
| ------------------ | ----------------------- | ---------- |
| Policy Assignments | {X} policies discovered | {ISO-8601} |
| Tag Policies       | {X} tags required       | {ISO-8601} |
| Security Policies  | {X} constraints         | {ISO-8601} |

**Discovery Method**: Azure Resource Graph via MCP
**Subscription**: {subscription-name or ID}
**Scope**: {management-group, subscription, or resource-group}
```

### Fail-Safe: If ARG Query Fails

If Azure Resource Graph is unavailable:

1. Document the failure in the governance constraints file
2. Mark all constraints as "⚠️ UNVERIFIED - Query Failed"
3. Add warning: "Deployment may fail due to undiscovered policy requirements"
4. Recommend: "Run `az policy assignment list --scope /subscriptions/{id}` manually"

## Validation Checklist

Before completing governance constraints, verify:

- [ ] Azure Resource Graph was queried (not assumed)
- [ ] Discovery Source section is populated with timestamps
- [ ] All tag requirements match actual Azure Policy (case-sensitive!)
- [ ] Security policies reflect actual enforcement (deny vs audit)
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

- environment, owner, costcenter, application, workload, sla, backup-policy, maint-window, tech-contact
```

## KQL Reference Queries

### All Policy Assignments

```kusto
policyresources
| where type =~ 'microsoft.authorization/policyassignments'
| extend displayName = tostring(properties.displayName)
| extend effect = tostring(properties.parameters.effect.value)
| extend enforcementMode = tostring(properties.enforcementMode)
| project id, displayName, effect, enforcementMode, scope = properties.scope
```

### Tag Policy Parameters

```kusto
policyresources
| where type =~ 'microsoft.authorization/policyassignments'
| extend displayName = tostring(properties.displayName)
| where displayName contains 'tag' or displayName contains 'Tag'
| project displayName, parameters = properties.parameters
```

### Security Policies

```kusto
policyresources
| where type =~ 'microsoft.authorization/policyassignments'
| join kind=inner (
    policyresources
    | where type =~ 'microsoft.authorization/policydefinitions'
    | where tostring(properties.metadata.category) in ('Security', 'Network', 'Storage')
    | project definitionId = tolower(id), category = tostring(properties.metadata.category)
) on $left.policyDefinitionId == $right.definitionId
| project displayName = properties.displayName, category, effect = properties.parameters.effect.value
```
