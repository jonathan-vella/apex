<!-- ref:codegen-shared-workflow-v1 -->

# Codegen Shared Workflow

Shared workflow phases for both Bicep and Terraform code generation agents.
Each agent reads this reference and substitutes its IaC-specific tools.

## Phase 1: Preflight Check

For each resource in `04-implementation-plan.md`:

1. Query AVM availability using the IaC-specific tool
   - Bicep: `mcp_bicep_list_avm_metadata` → `mcp_bicep_resolve_avm_module`
   - Terraform: `terraform/search_modules` → `terraform/get_module_details` → `terraform/get_latest_module_version`
2. Cross-check planned parameters against the module schema; flag type mismatches
3. Check region limitations
4. Save results to `agent-output/{project}/04-preflight-check.md`
5. If blockers found, use `askQuestions` to present them and collect the user's decision
   (fix and re-run, or abort and return to Planner)

## Phase 1.5: Governance Compliance Mapping

Gate: do not proceed to code generation with unresolved Deny policy violations.

1. Read `04-governance-constraints.json` — extract all `Deny` policies
2. Map policy property paths to IaC-specific arguments:
   - Bicep: use `azurePropertyPath` (fall back to `bicepPropertyPath`), drop leading resource-type segment
   - Terraform: use `azurePropertyPath`, translate via the resource type mapping table in `.github/instructions/references/iac-policy-compliance.md`
3. Build compliance map: resource type → IaC property → required value
4. Merge governance tags with baseline defaults (governance wins)
5. Validate every planned resource can comply
6. If any Deny policy is unsatisfiable, use `askQuestions` to present the unresolved
   policies and collect user decision (return to Planner or override)

Policy Effect Reference: `azure-defaults/references/policy-effect-decision-tree.md`

## Phase 1.6: Context Compaction

Context reaches ~80% after preflight and governance mapping. Compact before code generation:

1. Summarize prior phases in a single concise message (preflight result, governance map,
   deployment strategy, resource list with module paths/sources)
2. Switch to `SKILL.minimal.md` variants for further skill reads
3. Do not re-read predecessor artifacts — rely on the summary and saved files on disk
4. Update session state: `sub_step: "phase_1.6_compacted"`

## Phase 4.5: Adversarial Code Review

Read `azure-defaults/references/adversarial-review-protocol.md` for lens table and invocation template.
Check `00-session-state.json` `decisions.complexity` for pass count.

Complexity routing:

- `simple`: 1 pass (comprehensive lens) — skip passes 2 and 3
- `standard`: up to 3 passes (early exit rules apply)
- `complex`: up to 3 passes (use batch subagent for passes 2+3 if triggered)

Invoke challenger subagents with `artifact_type = "iac-code"`, rotating `review_focus` per protocol.
Read `azure-defaults/references/challenger-selection-rules.md` for pass routing and model selection.

Write results to `challenge-findings-iac-code-pass{N}.json`.
Fix any `must_fix` items, re-validate, re-run failing pass.
Save validation status in `05-implementation-reference.md`.
Run `npm run lint:artifact-templates`.
