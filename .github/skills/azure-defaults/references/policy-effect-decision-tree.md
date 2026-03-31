<!-- ref:policy-effect-decision-tree-v1 -->

# Policy Effect Decision Tree

Use this table when translating Azure Policy discovery results into
IaC planning actions and code generation requirements.

## Planner Action (Step 4 / 05-IaC Planner)

| Effect              | Action                                     |
| ------------------- | ------------------------------------------ |
| `Deny`              | Hard blocker — adapt plan to comply        |
| `Audit`             | Warning — document, proceed                |
| `DeployIfNotExists` | Azure auto-remediates — note in plan       |
| `Modify`            | Azure auto-modifies — verify compatibility |
| `Disabled`          | Ignore                                     |

## Code Generator Action (Steps 5/06b/06t)

| Effect              | Code Generator Action                                   |
| ------------------- | ------------------------------------------------------- |
| `Deny`              | MUST set property to compliant value                    |
| `Modify`            | Document expected modification — do NOT set conflicting |
| `DeployIfNotExists` | Document auto-deployed resource in implementation ref   |
| `Audit`             | Set compliant value where feasible (best effort)        |
| `Disabled`          | No action required                                      |

> [!NOTE]
> For Terraform, `Deny` means set the **translated Terraform argument**
> (not the Azure property path) to the required value.
> Check `04-governance-constraints.json` for both `azurePropertyPath`
> and `bicepPropertyPath` / Terraform argument mappings.
