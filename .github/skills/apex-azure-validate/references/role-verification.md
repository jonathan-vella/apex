<!-- ref:role-verification-v1 -->

# Role Assignment Verification

Adapted from upstream `azure-validate`. This is a static, report-only review of
the role assignments in the generated IaC. It never edits IaC, grants roles or
queries live Azure state. Live checks after deployment belong to
[apex-azure-deploy](../../apex-azure-deploy/references/live-role-verification.md).

## When to Verify

After build verification and before recording proof. Missing roles surface as
opaque authorization errors at runtime, so report them here.

## Verification Checklist

Review every resource-to-identity relationship in the Bicep or Terraform:

| Check                                | How                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Every service identity has roles** | Each app with a managed identity has at least one role assignment                                 |
| **Roles match data operations**      | Data access uses service-specific data-plane roles; generic Reader/Contributor/Owner are management-plane only |
| **Scope is least privilege**         | Roles scoped to the target resource, not the resource group or subscription                       |
| **No missing roles**                 | App code operations are covered by assigned roles (see the mapping below)                         |
| **Principal type is set**            | `principalType` matches the identity (`ServicePrincipal` for managed identities)                  |

Find assignments in `Microsoft.Authorization/roleAssignments` resources, AVM
`roleAssignments` parameters, `azurerm_role_assignment` resources and AVM
Terraform `role_assignments` inputs.

## Common Service-to-Role Mapping

| Service operation                | Required role                                  | Common mistake                        |
| -------------------------------- | ---------------------------------------------- | ------------------------------------- |
| Read blobs                       | Storage Blob Data Reader                       | Generic Reader (no data access)       |
| Read and write blobs             | Storage Blob Data Contributor                  | Missing write permission              |
| Generate SAS by user delegation  | Storage Blob Delegator + Data Reader/Contributor | Forgetting the Delegator role       |
| Read Key Vault secrets           | Key Vault Secrets User                         | Key Vault Reader (no secret access)   |
| Read and write Cosmos DB data    | Cosmos DB Built-in Data Contributor (Cosmos DB data-plane assignment, not Azure RBAC) | Generic Contributor |
| Send Service Bus messages        | Azure Service Bus Data Sender                  | Generic Contributor                   |
| Read queues                      | Storage Queue Data Reader                      | A blob role for queues                |
| Pull container images            | AcrPull                                        | Registry admin user or no role        |

For roles outside this table, use [apex-azure-rbac](../../apex-azure-rbac/SKILL.md).

## How to Report

For each assignment, record the principal, role, scope and the code operation
it serves. Then classify each identity:

- **OK**: roles match the operations at the narrowest practical scope.
- **Missing**: an operation has no role; name the role and target scope.
- **Too broad**: a narrower role or scope covers the operations.
- **Unverified**: the code operations or identity can't be determined from source.

Generic `Contributor` or `Reader` roles don't include data-plane access; for
example, `Contributor` on a storage account can't read blobs.

## Hand Off

Report findings; don't fix them here.

- **APEX**: return findings to `06b-Bicep CodeGen` or `06t-Terraform CodeGen`
  through `01-Orchestrator`, and include them in the preflight evidence.
- **Generic**: add a Role Assignment Verification entry to the plan's
  Validation Proof section and return the gaps to **apex-azure-prepare**.
- **Local development roles**: report the gap; grant roles only with explicit
  approval through **apex-azure-rbac**.

```markdown
## Role Assignment Verification

- Status: Verified / Issues Found
- Identities checked: <app identities>
- Findings: <OK / Missing / Too broad / Unverified per identity>
```
