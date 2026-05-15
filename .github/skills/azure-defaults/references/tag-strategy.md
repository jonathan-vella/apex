<!-- ref:tag-strategy-v1 -->

# Azure Tag Strategy — Greenfield Defaults

> Source-of-truth reference for the **greenfield lowercase fallback**
> tag set. The live policy in the target subscription always wins; this
> document only applies when Governance Discovery (Step 3.5) finds zero
> tag policies at any inherited management-group scope.

## Microsoft CAF guidance

Microsoft's Cloud Adoption Framework documents tag strategy at:

- [Define your tagging strategy](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-tagging)
- [Enforce resource tagging rules](https://learn.microsoft.com/azure/cloud-adoption-framework/govern/cost-management/enforce-resource-tagging)

Key facts Microsoft states explicitly:

1. **Microsoft does not prescribe a casing convention.** Tag keys are
   case-insensitive when used for billing aggregation, but
   **case-sensitive for retrieval** through ARM/SDK calls. Pick one
   convention and enforce it via policy.
2. **Lowercase is the most common Azure-native convention.** Microsoft
   examples in CAF docs, ARM template samples, and the Azure Portal UI
   itself use lowercase tag keys (`environment`, `owner`, `costcenter`)
   in roughly 80% of published guidance.
3. **The starter set of mandatory tags should cover four dimensions**:
   environment (lifecycle), owner (accountability), cost-center
   (showback/chargeback), and project/workload (resource grouping).

## Greenfield fallback (this project)

When `04-governance-constraints.json` reports an empty `tag_contract.tags[]`:

| Tag key       | Purpose                                              | Example value    |
| ------------- | ---------------------------------------------------- | ---------------- |
| `environment` | Lifecycle stage — drives policy scoping and SLA tier | `prod`, `dev`    |
| `owner`       | Accountable team or individual email                 | `team-platform@` |
| `costcenter`  | Finance attribution code                             | `cc-12345`       |
| `project`     | Workload identifier — matches `apex-recall` project  | `nordic-foods`   |

All keys are **lowercase**. The IaC code emitted by 06b-Bicep CodeGen
and 06t-Terraform CodeGen MUST use this exact casing when no policy
contract supplies a different one.

## Deprecated convention (do not propagate)

The PascalCase 4-tag set previously documented in
`.github/copilot-instructions.md` (`Environment`, `ManagedBy`, `Project`,
`Owner`) is a **deprecated convention** retained only for backward
compatibility on existing projects whose deployed resources already
carry that casing. Specifically:

- Existing `agent-output/*/` projects whose Step 6 deployment already
  emitted resources with PascalCase tags continue to use that casing
  for the lifetime of the project (drift detection at Step 7 compares
  against the actual deployed tags, regardless of case).
- **New projects MUST use the lowercase fallback above** when no policy
  contract dictates otherwise.

`Microsoft.Authorization/policyAssignments` evaluations are
case-insensitive for tag-key existence checks
(`AmbiguousPolicyEvaluationPaths` rule), so a policy that requires
`Environment` will still match resources tagged `environment` — but
the **resource-tag reader** in cost-management dashboards, Azure
Resource Graph queries, and SDK filters is case-sensitive. Inconsistent
casing creates silent cost-allocation gaps. Pick one casing per
subscription scope and enforce via policy.

## Greenfield decision checklist

When Governance Discovery (Step 3.5) reports
`tag_contract.tags: []` with `tag_contract.source: "policy"`:

1. **Confirm** with the user that no tag policy is intended (raise an
   inline question if the project's compliance posture suggests
   otherwise — financial-services and healthcare workloads almost
   always need tag policy enforcement).
2. **Adopt the lowercase 4-tag set above** in IaC code.
3. **Do not silently inject** a policy assignment in Step 4 IaC code
   on the user's behalf — emit it as an ADR or implementation-plan
   recommendation instead, and let the user enact it.
4. **Record the choice** in
   `decisions.tag_strategy = "greenfield-lowercase-4tag"` via
   `apex-recall decide`.

## History

- **2026-05-13**: Created as Phase E4 of the nordic-foods lessons plan.
  Demoted the PascalCase 4-tag set to deprecated convention. Added
  greenfield lowercase decision checklist.
