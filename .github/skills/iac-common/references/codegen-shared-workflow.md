<!-- ref:codegen-shared-workflow-v1 -->

# Codegen Shared Workflow

Shared workflow phases for both Bicep and Terraform code generation agents.
Each agent reads this reference and substitutes its IaC-specific tools.

## Plan-Lock Contract (HARD GATE, applies to all phases)

After gate-3 (Plan Approval), these artifacts are **read-only** for the
CodeGen agents (06b / 06t):

- `agent-output/{project}/04-implementation-plan.md`
- `agent-output/{project}/04-governance-constraints.md`
- `agent-output/{project}/04-governance-constraints.json`

Rules:

1. **No self-edit.** CodeGen agents MUST NOT write to any frozen artifact via
   `apply_patch`, `replace_string_in_file`, `multi_replace_string_in_file`, or
   `create_file`. Apex-recall `decide` / `finding` entries are allowed (they
   write to session state, not the artifacts).
2. **No plan-level challenger.** Challenger subagents invoked from Step 5 MUST
   use `artifact_type = "iac-code"` and target `infra/{tool}/{project}/`. Do
   NOT pass `artifact_type = "implementation-plan"` from Step 5.
3. **Plan must_fix → Return to Planner.** If a code-review pass surfaces a
   finding whose root cause is in the plan (missing resource, wrong topology,
   unsatisfiable governance), STOP Step 5 and traverse the `↩ Return to
   Step 4` handoff. Do not patch the plan in place.
4. **Plan readiness precondition.** Before entering Phase 1, confirm
   `apex-recall show <project> --json` shows Step 4 complete AND every
   plan-level challenger pass returned APPROVED. If any plan-level pass is
   open (NEEDS_REVISION / BLOCKED), STOP and return to Planner.

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
Check `decisions.complexity` from `apex-recall show <project> --json` for pass count.

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

### Batched User Decisions

When a challenger pass surfaces findings that require user input, build a
**single** `vscode_askQuestions` invocation with one question per decision —
do NOT issue sequential prompts. Pattern:

1. Group findings into decision buckets (e.g. `must_fix_A`, `must_fix_B`,
   `should_fix_C`, …) and assign each a stable `header` slug for answer
   mapping.
2. Emit one `askQuestions` call with the full list. The user fills the
   inline form once.
3. Persist the answers via `apex-recall decide --key <header> --value <choice>`
   for each non-skipped answer.

Two `askQuestions` calls inside a single Step 5 run is a defect — fold the
second into the first. The 06b/06t agents must batch their preflight,
governance, and code-review prompts the same way.

### Mechanical Auto-Fix Before Exiting (MANDATORY)

Before emitting the Step 5 completion handoff, run a mechanical fix pass on
the IaC tree. NEEDS_REVISION must not exit Step 5 if any MEDIUM finding is
in this set — fix them in place and re-validate:

- **LAW `dependsOn` wiring** — when a module reads from
  `logAnalyticsWorkspaceResourceId` but the module is not in `dependsOn`,
  inject the dependency. Same rule for App Insights → LAW and any
  diagnostic-settings consumer.
- **CIDR parameterization** — replace hardcoded `10.x.x.x/yy` strings in
  module bodies with parameters declared in `main.bicep` /
  `variables.tf`, defaulted to the original value so callers stay
  unchanged.
- **Missing `@description` on parameters** — add a one-line description
  derived from the parameter name.
- **Tag map / object completion** — when a tag key in the baseline (four
  defaults + governance) is missing on a resource, inject it from the
  central `tags` map / variable rather than asking the user.

These fixes are mechanical and do not change the architecture; they DO
NOT trigger a return to Planner. After applying, re-run
`bicep-validate-subagent` / `terraform-validate-subagent`. Re-run the
failing challenger pass only if any non-mechanical finding remains.

Exit-state contract: Step 5 may exit only when the validator returns
`APPROVED`, or when remaining findings are explicitly accepted via an
`apex-recall decide` override entry with `--rationale`.

