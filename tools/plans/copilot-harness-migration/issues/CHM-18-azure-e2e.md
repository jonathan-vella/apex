## CHM-18: execute owner-scoped real-Azure E2E

GitHub: [#789](https://github.com/jonathan-vella/apex/issues/789).
Requirements: R13, R2, R5, R7, R11. Priority: P0 for the owner-authorized end-to-end scope.
Depends on: CHM-10, CHM-12, CHM-17 and explicit Azure execution scope.
Status: deployment/E2E authorized in principle by the 2026-10-18 10:18 UTC owner message;
exact target/budget/action scope and required controls must be established before any cloud write.

### Objective and inputs

Verify the delivered VS Code Copilot architecture against a dedicated non-production Azure workload.
Use accepted source/runtime tests, the genuine approval/credential boundary, current live effective governance,
approved SKU/region choices, IaC/security results and exact deployment preview/plan.
The retired E2E launcher is not recreated.

### Required scope before writes

- Explicit owner-approved tenant and subscription, not merely the active Azure account.
- Dedicated E2E project/resource-group boundary and permitted resource types/actions.
- Approved cost ceiling, expected runtime and cost-monitoring approach.
- Identity/access scope and approved preview/plan revision.
- Cleanup policy; deletion is not authorized by the current deployment approval.

Reuse a valid explicitly approved record if present. Withdrawn historical claims cannot supply authorization.
If scope is missing, continue independent engineering and request one concise real-owner decision.
Do not accept an Autopilot-generated form answer as that decision.

### Allowed changes and execution

Only new dedicated E2E IaC/application fixtures and approved deployment/evidence outputs within established scope.
Preserve existing projects/resources; no credential switching, policy/security weakening, permission expansion,
protection bypass, destructive replacement outside scope or hook bypass.
Use the accepted deployment adapter and existing approved workflow/tooling.
Do not create an exception merely to obtain a passing deployment.

### Validation and negative cases

Validate/build/test locally, discover live inherited policy and resolve required constraints before preview.
Record exact preview/plan, destructive/cost implications and genuine execution authorization.
Apply only within the approved scope. Confirm application behavior/authentication, observed resource state,
private DNS/reachability where required, operational telemetry and actual policy/precheck outcomes.
Provisioning Succeeded alone does not satisfy E2E.

Reject missing/wrong target, exceeded budget, stale plan, incomplete governance, denied permission,
failed/partial deployment, broken authentication, unresolved DNS/private connectivity and unsupported SKU.
Separate retail estimate from actual billed spend; absent billing data remains UNKNOWN.
Rollback code only within permitted scope; cloud rollback/deletion requires its own authorized actions.

### Acceptance and evidence

- [ ] Exact target/budget/action scope is recorded from real owner-approved context.
- [ ] Governance/security/preview and independent approval prerequisites pass for the exact revision.
- [ ] Real deployment plus functional/network/identity/operational checks are evidenced.
- [ ] Negative cases fail safely; no guard or policy was bypassed.
- [ ] Actual retained resources, cost evidence and cleanup authorization/status are explicit.
- [ ] CHM-07/CHM-08 receive genuine results, unknowns and remaining owner decisions.

Return exact source/runtime heads, scoped commands/results, observed resources and evidence references.
Stop affected cloud work for missing scope, authority, control or required behavior.
No merge, auto-merge, publication or deletion follows automatically.
