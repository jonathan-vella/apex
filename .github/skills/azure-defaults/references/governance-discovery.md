<!-- ref:governance-discovery-v1 -->

# Governance Discovery Reference

## MANDATORY Gate

Governance discovery is a **hard gate**. If Azure connectivity is
unavailable or policies cannot be fully retrieved (including
management group-inherited), STOP and inform the user. Do NOT
proceed to implementation planning with incomplete policy data.

## Discovery Commands (Ordered by Completeness)

### 1. REST API (MANDATORY — includes MG-inherited policies)

```bash
SUB_ID=$(az account show --query id -o tsv)
az rest --method GET \
  --url "https://management.azure.com/subscriptions/\
${SUB_ID}/providers/Microsoft.Authorization/\
policyAssignments?api-version=2022-06-01" \
  --query "value[].{name:name, \
displayName:properties.displayName, \
scope:properties.scope, \
enforcementMode:properties.enforcementMode, \
policyDefinitionId:properties.policyDefinitionId}" \
  -o json
```

> [!CAUTION]
> `az policy assignment list` only returns subscription-scoped
> assignments. Management group policies (often Deny/tag enforcement)
> are invisible to it.
> **ALWAYS use the REST API above as the primary discovery method.**

### 2. Policy Definition Drill-Down

For each Deny/DeployIfNotExists policy:

```bash
# Built-in or subscription-scoped
az policy definition show --name "{guid}" \
  --query "{displayName:displayName, \
effect:policyRule.then.effect, \
conditions:policyRule.if}" -o json

# Management-group-scoped custom policies
az policy definition show --name "{guid}" \
  --management-group "{mgId}" \
  --query "{displayName:displayName, \
effect:policyRule.then.effect}" -o json

# Policy set definitions (initiatives)
az policy set-definition show --name "{guid}" \
  --query "{displayName:displayName, \
policyCount:policyDefinitions | length(@)}" -o json
```

### 3. ARG KQL (supplemental — subscription-scoped only)

```kusto
PolicyResources
| where type ==
  'microsoft.authorization/policyassignments'
| where properties.enforcementMode == 'Default'
| project name, displayName=properties.displayName,
  effect=properties.parameters.effect.value,
  scope=properties.scope
| order by name asc
```

## Discovery Workflow

```text
1. Verify Azure connectivity: az account show
2. REST API: Get ALL effective policy assignments
3. Compare count with Azure Portal (Policy > Assignments)
4. For each Deny/DeployIfNotExists: drill into definition
5. Check tag enforcement policies (names with 'tag'/'Tag')
6. Check allowed resource types and locations
7. Document ALL findings in 04-governance-constraints.md
```

## Common Policy Constraints

> [!NOTE]
> The governance constraints JSON output schema must include
> `bicepPropertyPath`, `azurePropertyPath`, and `requiredValue`
> fields for each Deny policy.

| Policy             | Impact                    | Solution                        |
| ------------------ | ------------------------- | ------------------------------- |
| Required tags      | Deploy fails without tags | Include all 4 required tags     |
| Allowed locations  | Resources rejected        | Use `swedencentral` default     |
| SQL AAD-only auth  | SQL password auth blocked | Use `azureADOnlyAuth: true`     |
| Storage shared key | Shared key access denied  | Use managed identity RBAC       |
| Zone redundancy    | Non-zonal SKUs rejected   | Use P1v4+ for App Service Plans |

## L0 Discovery Envelope

The canonical specification (envelope shape, field reference,
completeness-signature algorithm, end-of-discovery self-check, refresh
handoff contract, consumer protocol, backward compatibility) lives in
[`azure-governance-discovery/references/l0-envelope.md`](../../azure-governance-discovery/references/l0-envelope.md).
That file is the single source of truth — load it on demand when
implementing or reviewing the envelope contract.

The envelope ties into the canonical defaults declared in
[`../SKILL.md`](../SKILL.md): the same region constants seed
`scope.management_groups`, and the tag schema discovered through Phase 1
respects (or augments) the lowercase 9-tag greenfield fallback when no
policy exists.
