---
name: azure-rbac
description: '**ANALYSIS SKILL** — Find the right Azure RBAC role for an identity with least-privilege access; generate CLI + Bicep code to assign it. WHEN: "what role should I assign", "least privilege role", "RBAC role for", "role for managed identity", "custom role definition", "assign role to identity". USE FOR: role discovery, RBAC scaffolding, least-privilege analysis. DO NOT USE FOR: deploying resources (use azure-deploy), security audits (use azure-compliance).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.1"
---

Use the `azure__documentation` tool to find the minimal role definition that matches the desired permissions the user wants to assign to an identity. If no built-in role matches the desired permissions, use the `azure__extension_cli_generate` tool to create a custom role definition with the desired permissions. Then use the `azure__extension_cli_generate` tool to generate the CLI commands needed to assign that role to the identity. Finally, use the `azure__bicepschema` and `azure__get_azure_bestpractices` tools to provide a Bicep code snippet for adding the role assignment. If user is asking about role necessary to set access, refer to Prerequisites for Granting Roles down below:

## Rules

- **Least privilege first** — prefer the most narrowly-scoped built-in role that satisfies the permissions; only define a custom role when no built-in fits
- **Role assignment scope matters** — prefer resource-level or resource-group scope over subscription scope
- **Use `azure__documentation` first** to discover built-in roles before generating any CLI or Bicep
- **Use `azure__extension_cli_generate`** for `az role assignment create` and custom-role definitions
- **Use `azure__bicepschema` + `azure__get_azure_bestpractices`** for Bicep `Microsoft.Authorization/roleAssignments` snippets (use `guid()` for idempotent assignment names)
- **Granting roles requires elevated permission** — see [Prerequisites for Granting Roles](#prerequisites-for-granting-roles) below
- **Out of scope**: deploying resources (use `azure-deploy`), security audits (use `azure-compliance`)

## Steps

1. **Identify the operation** — what action does the identity need (read storage, manage keys, deploy resources, etc.)?
2. **Find the minimal built-in role** — query `azure__documentation` for roles whose permissions match the operation
3. **If no built-in fits** — use `azure__extension_cli_generate` to scaffold a custom role definition with only the required `actions` / `dataActions`
4. **Generate the assignment CLI** — `azure__extension_cli_generate` for `az role assignment create --assignee <id> --role <name> --scope <scope>`
5. **Generate the Bicep snippet** — `azure__bicepschema` + `azure__get_azure_bestpractices` for `Microsoft.Authorization/roleAssignments` with `guid()` name and `principalType: 'ServicePrincipal'`
6. **Verify the caller has assignment permission** — cross-check with [Prerequisites for Granting Roles](#prerequisites-for-granting-roles)

## Prerequisites for Granting Roles

To assign RBAC roles to identities, you need a role that includes the `Microsoft.Authorization/roleAssignments/write` permission. The most common roles with this permission are:

- **User Access Administrator** (least privilege - recommended for role assignment only)
- **Owner** (full access including role assignment)
- **Custom Role** with `Microsoft.Authorization/roleAssignments/write`
