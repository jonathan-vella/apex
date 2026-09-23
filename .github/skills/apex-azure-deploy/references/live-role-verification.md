<!-- ref:live-role-verification-v1 -->

# Live Role Verification

Adapted from upstream `azure-deploy`. After deployment, confirm with read-only
queries that the provisioned role assignments match what the app needs. This
complements the static review in
[apex-azure-validate](../../apex-azure-validate/references/role-verification.md).
It never creates, changes or deletes role assignments.

| Check      | Skill               | What it verifies                                        |
| ---------- | ------------------- | ------------------------------------------------------- |
| **Static** | apex-azure-validate | The IaC declares the right role assignments             |
| **Live**   | apex-azure-deploy   | The provisioned resources actually have those roles     |

Both are needed: provisioning can fail silently for a role, and policy or
manual changes can alter assignments after deployment.

## When to Run

After deployment verification, once resources exist. Skip it when nothing was
provisioned.

## Steps

### 1. Identify App Identities

Find the services with managed identities in the plan or IaC, then read their
principal IDs:

```bash
az webapp identity show --name <app-name> -g <resource-group> --query principalId -o tsv
az containerapp identity show --name <app-name> -g <resource-group> --query principalId -o tsv
az functionapp identity show --name <app-name> -g <resource-group> --query principalId -o tsv
```

### 2. List Live Role Assignments

Use `mcp_azure-mcp_role` with `command: "role_assignment_list"`, or the CLI, for
each target resource and identity:

```bash
az role assignment list --scope <resourceId> --assignee-object-id <principalId> --output table
```

### 3. Compare With Requirements

Use the service-to-role mapping in
[role verification](../../apex-azure-validate/references/role-verification.md#common-service-to-role-mapping).

| Issue                                | How to detect                                            |
| ------------------------------------ | -------------------------------------------------------- |
| Role at the wrong scope              | Assigned on the resource group, needed on the resource   |
| Generic role instead of a data role  | `Contributor` present, no data-plane role                |
| Missing role                         | No assignment for the identity on the target resource    |
| Stale role from a previous identity  | Roles on an old principal ID, none on the current one    |

## Report

Record `Pass` or `Fail` with the commands and results. Fixes go into the IaC
and a new approved deployment:

- **APEX**: report to `01-Orchestrator` for `06b-Bicep CodeGen` or
  `06t-Terraform CodeGen`; the deploy agent doesn't patch roles.
- **Generic**: return the gap to **apex-azure-prepare**. Removing stale
  assignments is destructive and needs `ask_user` approval.

```markdown
### Live Role Verification

- Command: `az role assignment list --scope <resourceId> --assignee-object-id <principalId>`
- Results:
  - <identity> → <role> on <resource> ✅
  - <identity> → missing <expected-role> on <resource> ❌
- Status: Pass / Fail
```
