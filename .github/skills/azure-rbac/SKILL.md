---
name: azure-rbac
description: '**ANALYSIS SKILL** — Find the right Azure RBAC role for an identity with least-privilege access; generate CLI, Bicep, and Terraform code to assign it. WHEN: "what role should I assign", "least privilege role", "RBAC role for", "role for managed identity", "custom role definition", "assign role to identity". DO NOT USE FOR: deploying (azure-deploy), security audits (azure-compliance).'
license: MIT
metadata:
  author: Microsoft
  version: "1.1.0"
---

# Azure RBAC Skill

Find the minimal built-in Azure role that grants the requested permissions to
an identity, then generate the `az role assignment create` CLI and a Bicep
`Microsoft.Authorization/roleAssignments` snippet. Custom roles only when no
built-in fits.

## Rules

- **Least privilege first** — prefer the most narrowly-scoped built-in role that satisfies the permissions; only define a custom role when no built-in fits
- **Role assignment scope matters** — prefer resource-level or resource-group scope over subscription scope
- **Discover roles via `mcp_azure-mcp_documentation`** — invoke with `command: "microsoft_docs_search"` to query for built-in role definitions before generating any CLI or Bicep
- **Verify with `az role definition list`** — cross-check the discovered role against the live Azure RBAC catalogue
- **Use `guid()` in Bicep** for `Microsoft.Authorization/roleAssignments` names so assignments are idempotent across re-deploys; set `principalType: 'ServicePrincipal'` for managed identities
- **Granting roles requires elevated permission** — see [Prerequisites for Granting Roles](#prerequisites-for-granting-roles) below
- **Out of scope**: deploying resources (use `azure-deploy`), security audits (use `azure-compliance`)

## Steps

1. **Identify the operation** — what action does the identity need (read storage, manage keys, deploy resources, etc.)?
2. **Search Microsoft docs** — invoke `mcp_azure-mcp_documentation` with `command: "microsoft_docs_search"` and a query such as `"Azure built-in role <operation>"` (e.g., `"Azure built-in role read blob storage"`); collect candidate role names + role IDs
3. **Verify against the live catalogue** — `az role definition list --query "[?roleName=='<RoleName>'].{name:roleName,id:name,actions:permissions[0].actions}" -o table`
4. **If no built-in fits** — scaffold a custom role definition with only the required `actions` / `dataActions`:

   ```bash
   cat > custom-role.json <<'JSON'
   {
     "Name": "<CustomRoleName>",
     "Description": "<purpose>",
     "Actions": ["<provider>/<resource>/<action>"],
     "DataActions": [],
     "AssignableScopes": ["/subscriptions/<sub-id>"]
   }
   JSON
   az role definition create --role-definition custom-role.json
   ```

5. **Generate the assignment CLI** —

   ```bash
   az role assignment create \
     --assignee <objectId|appId> \
     --role "<RoleName>" \
     --scope <scope>
   ```

6. **Generate the IaC snippet** —

   **Bicep:**

   ```bicep
   resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
     name: guid(resourceId, principalId, roleDefinitionId)
     scope: targetResource
     properties: {
       roleDefinitionId: subscriptionResourceId(
         'Microsoft.Authorization/roleDefinitions',
         '<role-id-guid>'
       )
       principalId: principalId
       principalType: 'ServicePrincipal'
     }
   }
   ```

   **Terraform (raw `azurerm_role_assignment`):**

   ```hcl
   resource "azurerm_role_assignment" "this" {
     scope                = azurerm_resource_group.target.id   # or any resource ID
     role_definition_name = "<RoleName>"                       # e.g., "Storage Blob Data Reader"
     principal_id         = azurerm_user_assigned_identity.app.principal_id
     principal_type       = "ServicePrincipal"
     # For idempotent imports/refreshes, lock to the role definition GUID instead:
     # role_definition_id = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/providers/Microsoft.Authorization/roleDefinitions/<role-id-guid>"
   }
   ```

   AVM-TF callers should prefer the
   [`Azure/avm-res-authorization-roleassignment`](https://registry.terraform.io/modules/Azure/avm-res-authorization-roleassignment/azurerm/latest)
   module over raw `azurerm_role_assignment` when available — it wraps the
   resource with the canonical AVM input/output contract.

7. **Verify the caller has assignment permission** — cross-check with [Prerequisites for Granting Roles](#prerequisites-for-granting-roles)

## Prerequisites for Granting Roles

To assign RBAC roles to identities, you need a role that includes the `Microsoft.Authorization/roleAssignments/write` permission. The most common roles with this permission are:

- **User Access Administrator** (least privilege - recommended for role assignment only)
- **Owner** (full access including role assignment)
- **Custom Role** with `Microsoft.Authorization/roleAssignments/write`
