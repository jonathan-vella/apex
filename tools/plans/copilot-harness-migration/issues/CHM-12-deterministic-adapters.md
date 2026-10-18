## CHM-12: replace deterministic leaf work with tested adapters

GitHub: [#783](https://github.com/jonathan-vella/apex/issues/783).
Requirements: R7, R10. Priority: P1. Depends on: CHM-11 and accepted pilot.
Status: proposed implementation; no Azure apply or live preview permission is included.

### Objective and inputs

Use deterministic commands/results for compilation, validation, preview normalization and policy gates,
leaving ambiguous design/pricing interpretation to bounded reasoning.
Use current Bicep/Terraform validate/what-if/plan/policy-precheck/cost leaves, their shared contracts and
already-tested scripts as evidence. Reuse working logic instead of rebuilding it.

### Allowed scope and behavior

One adapter family per slice: affected leaf definition/callers, domain/shared skill references,
existing command/parser tools and their tests. Keep Bicep and Terraform execution semantics distinct.
Keep Azure governance, TLS/identity/network security, AVM/SKU consistency and price provenance.
No new cloud permissions, backend mutation, state migration or deployment.
Routine command execution/repair may run autonomously inside approved fixture scope.

### Validation

Use fixture Bicep build/lint and Terraform fmt/validate with safe local/mock providers as applicable.
Run `node --test tools/tests/scripts/test_stabilization.mjs
tools/tests/scripts/test_parent_validator_integration.mjs tools/tests/scripts/test_policy_map_status.mjs
tools/tests/scripts/test_terraform_validation.mjs tools/tests/scripts/test_cost_estimate.mjs`.
Run existing IaC security/schema tests scoped to affected fixture inputs.
No live plan/what-if is assumed read-only enough to bypass permission scope.

Negative cases: compiler error, security violation, missing provider/backend, malformed/failed preview,
destructive change, stale plan, incomplete policy input, ambiguous meter, failed price lookup and denied tool.
Failures return explicit categories/nonzero results; no success-shaped fallback.

### Acceptance and evidence

- [ ] Useful leaf outcomes have tested command/result adapters without unnecessary LLM command wrappers.
- [ ] Creative review remains distinct from compiler/plan success and consequential approval.
- [ ] No unsupported generic skill route or duplicated pricing calculation is introduced.
- [ ] Adapter callers, result schemas and relevant tests are migrated in the same slice.

Return exact commands/exit codes, outputs/negative results, caller map and compatibility/rollback boundary.
Stop for required network/backend/credential operations outside fixture approval.
No merge, auto-merge, Azure writes or history repair.
