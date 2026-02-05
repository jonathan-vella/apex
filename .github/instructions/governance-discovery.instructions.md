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

### Step 1.1: Read Policy Definition JSON (CRITICAL - MANDATORY)

**NEVER trust policy display names alone.** Misleading names cause false positives.

**Example**: Policy named "Block Azure RM Resource Creation" actually blocks Classic resources only.

**MANDATORY**: For ALL policies with Deny or DeployIfNotExists effects, query the actual policy definition to verify impact.

#### Method 1: Azure Resource Graph (Preferred - via az graph query)

**Use Azure CLI `az graph query` command with KQL to join policy assignments with definitions**:

```bash
# Query Deny policies with policyRule JSON
az graph query -q "
policyresources
| where type =~ 'microsoft.authorization/policyassignments'
| extend policyDefId = tostring(properties.policyDefinitionId)
| join kind=inner (
    policyresources
    | where type =~ 'microsoft.authorization/policydefinitions'
    | extend policyDefId = tolower(id)
    | project policyDefId, 
              policyRule = properties.policyRule,
              description = properties.description
) on policyDefId
| where tostring(policyRule['then'].effect) =~ 'deny' or tostring(policyRule['then'].effect) =~ 'deployIfNotExists'
| project assignmentName = name,
          displayName = tostring(properties.displayName),
          policyDefinitionId = policyDefId,
          effect = tostring(policyRule['then'].effect),
          policyRule,
          description
" --management-groups "<your-management-group-id>" -o json

# Or scope to subscription
az graph query -q "<KQL>" --subscriptions "<subscription-id>" -o json
```

**Example ARG Query (KQL)**:

```kusto
policyresources
| where type =~ 'microsoft.authorization/policyassignments'
| extend policyDefId = tostring(properties.policyDefinitionId)
| join kind=inner (
    policyresources
    | where type =~ 'microsoft.authorization/policydefinitions'
    | extend policyDefId = tolower(id)
    | project policyDefId, 
              policyRule = properties.policyRule,
              description = properties.description
) on policyDefId
| where tostring(policyRule['then'].effect) =~ 'deny' or tostring(policyRule['then'].effect) =~ 'deployIfNotExists'
| project assignmentName = name,
          displayName = tostring(properties.displayName),
          policyDefinitionId = policyDefId,
          effect = tostring(policyRule['then'].effect),
          policyRule,
          description
```

#### Method 2: Azure CLI (Fallback for individual policies)

```bash
# Step 1: Get all Deny/DeployIfNotExists policy assignments
az policy assignment list \
  --query "[?enforcementMode=='Default'].{\
name:name, displayName:displayName, \
definitionId:policyDefinitionId, scope:scope}" \
  -o json > policy-assignments.json

# Step 2: For each assignment, fetch the policy definition
for assignment in $(jq -r '.[].definitionId' policy-assignments.json); do
  # Check if custom (management group) or built-in policy
  if [[ $assignment == *"/managementGroups/"* ]]; then
    # Custom policy - extract management group ID
    mgId=$(echo $assignment | grep -oP '/managementGroups/\K[^/]+')
    policyId=$(echo $assignment | grep -oP '/policyDefinitions/\K.*')
    
    az policy definition show \
      --name "$policyId" \
      --management-group "$mgId" \
      --query "{displayName:displayName, description:description, policyRule:policyRule, parameters:parameters}" \
      -o json
  else
    # Built-in policy
    policyId=$(echo $assignment | grep -oP '/policyDefinitions/\K.*')
    
    az policy definition show \
      --name "$policyId" \
      --query "{displayName:displayName, description:description, policyRule:policyRule, parameters:parameters}" \
      -o json
  fi
done
```

#### Required Analysis for Each Deny Policy

When analyzing `policyRule.if` conditions, extract:

1. **Resource Types Affected**:
   ```json
   "field": "type",
   "equals": "Microsoft.Storage/storageAccounts"  // Only affects Storage Accounts
   ```

2. **Conditional Logic**:
   ```json
   "allOf": [  // ALL conditions must be true
     {"field": "type", "equals": "Microsoft.ClassicCompute/virtualMachines"},
     {"value": "[resourceGroup().tags['ringValue']]", "in": "[parameters('ringValue')]"}
   ]
   // Policy only applies if BOTH resource is Classic VM AND RG has ringValue tag
   ```

3. **Configuration Checks**:
   ```json
   "field": "Microsoft.Storage/storageAccounts/allowBlobPublicAccess",
   "equals": "true"  // Denies if public access is enabled
   ```

**Red Flags for Misleading Names**:

| Policy Name Pattern | Likely Actual Behavior | Verify By Checking |
|---------------------|----------------------|-------------------|
| "Block Azure RM..." | May only block Classic resources | policyRule.if contains "ClassicCompute", "ClassicStorage", etc. |
| "Require [feature]" | May only apply to specific resource types | policyRule.if.field == "type" |
| "Deny [action]" with tag reference | May only apply if specific tags exist | policyRule.if contains resourceGroup().tags |
| "Enforce [setting]" | May only modify, not deny | policyRule.then.effect == "modify" or "deployIfNotExists" |

**Validation Checklist** (complete before documenting policy impact):

- [ ] Policy definition JSON retrieved (not just assignment)
- [ ] Resource types affected identified (field: "type")
- [ ] Conditional logic analyzed (allOf/anyOf requirements)
- [ ] Tag dependencies checked (resourceGroup().tags references)
- [ ] Effect verified (deny vs. modify vs. deployIfNotExists)
- [ ] Impact assessment based on ACTUAL policyRule, not display name

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

## Policy Effect Handling (Shift-Left Enforcement)

**CRITICAL**: Discovered policies MUST influence the implementation plan, not just be documented.

### Effect-Based Actions

| Policy Effect | Impact | Required Action |
|--------------|--------|----------------|
| **Deny** | Deployment blocked if non-compliant | Adapt architecture OR flag exemption requirement |
| **DeployIfNotExists** | Missing resources auto-deployed | Include expected resources in plan |
| **Modify** | Resources auto-modified at deployment | Document expected modifications |
| **Audit** | Non-compliance logged but allowed | Document compliance expectations |
| **Disabled** | Policy not enforced | Note for awareness |

### Critical Decision Tree

```
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
        │        Example: Public storage → Private endpoints
        └─ NO → Flag as DEPLOYMENT BLOCKER
                 Add to "## Deployment Blockers" section
                 Status: "⚠️ CANNOT PROCEED WITHOUT EXEMPTION"
                 Document exemption request details
```

### Adaptation Examples

**Example 1: Storage Public Access Denied**

```markdown
## Plan Adaptations Based on Policies

### Architectural Changes

| Original Design | Blocking Policy | Effect | Adaptation Applied |
|-----------------|----------------|--------|-------------------|
| Public blob storage | "Deny public storage accounts" | Deny | Private endpoints + vNet integration |
```

**Example 2: Required Diagnostic Settings**

```markdown
## Plan Adaptations Based on Policies

### Auto-Applied Resources

| Policy | Effect | Auto-Applied Resource |
|--------|--------|----------------------|
| "Deploy diagnostic settings for Storage" | DeployIfNotExists | Log Analytics diagnostic settings |
```

**Example 3: Deployment Blocker**

```markdown
## Deployment Blockers

🚫 **CRITICAL**: The following policies BLOCK this deployment:

### Policy: "Block Azure RM Resource Creation"

- **ID**: `918465337cff47588b23a6e9`
- **Effect**: Deny
- **Scope**: Management Group (root) - applies to all subscriptions
- **Enforcement Mode**: Default (enabled)
- **Impact**: Prevents ALL ARM template deployments (Bicep compiles to ARM)
- **Assessment Date**: 2026-02-05

**Resolution Options**:

1. **Request Policy Exemption** (Recommended):
   - **Justification**: E2E validation of Agentic InfraOps workflow
   - **Duration**: Temporary (7 days)
   - **Risk Level**: Low (dev/test subscription)
   - **Approval Process**: Submit via Azure Portal or contact governance team
   
2. **Alternative Architecture**:
   - Use Azure CLI/PowerShell scripts instead of Bicep
   - **Not Recommended**: Defeats purpose of IaC validation

**Status**: ⚠️ **DEPLOYMENT CANNOT PROCEED WITHOUT EXEMPTION APPROVAL**

**Next Steps**:
- [ ] User confirms exemption is in place
- [ ] OR User provides exemption approval timeline
- [ ] OR User selects alternative deployment method
```
