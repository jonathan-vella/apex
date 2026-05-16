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
2. Stop loading additional skills after this point; rely on what's already in context.
   Do not re-read any `SKILL.md` you have already consumed this session
   (skills are single-tier — there are no digest/minimal variants to switch to).
3. Do not re-read predecessor artifacts — rely on the summary and saved files on disk
4. Update session state: `sub_step: "phase_1.6_compacted"`

## Phase 2: Output Cadence (MANDATORY — ONE FILE PER TURN)

Generate **exactly one file per response turn** throughout Phase 2.
Bundling multiple file bodies in a single response exceeds VS Code's
per-response output-token ceiling and aborts the turn with
*"Sorry, the response hit the length limit. Please rephrase your
prompt."* — wasting the entire 200K+ output of the aborted turn and
forcing the user to recover manually.

The per-tool file-order tables in `06b-bicep-codegen.agent.md` /
`06t-terraform-codegen.agent.md` define **dependency ordering only**.
Each listed file is a separate response turn — never collapse a row
into one response.

### Cadence per file

1. Announce on one short line: `Generating: <path> (n/total)`.
2. Call the file-creation tool with the full file body.
3. End the turn. Wait for the runtime to return control before the next file.

### Build cadence (early-warning, not full validation)

After every **3 files written**, invoke the toolchain build via
`execution_subagent` to catch wiring errors early:

- Bicep: `bicep build infra/bicep/{project}/main.bicep`
- Terraform: `terraform -chdir=infra/terraform/{project} validate`

This is in addition to — not a replacement for — the full
`bicep-validate-subagent` / `terraform-validate-subagent` runs in Phase 4.

### Resume after a length-limit abort

If a prior turn aborted with the length-limit error:

- Resume by emitting **only the next single file** that is not on disk.
- Do **not** re-emit any file already on disk.
- Do **not** summarise what was lost — continue the per-file cadence.
- If state is unclear, list `infra/{tool}/{project}/` first to confirm
  which files exist, then resume from the first missing entry in the
  file-order table.

### Anti-patterns (root causes of length-limit aborts)

- Emitting `main.bicep` plus 5 modules plus `azure.yaml` plus `deploy.ps1`
  in one response.
- Treating a numbered "Round" in the file-order table as a single turn —
  rounds are dependency groupings, not response units.
- Calling `create_file` more than once in the same response turn.
- Bundling file creation with verbose narration of all files at once
  ("Here are all the modules: ...").

## Phase 4.5: Adversarial Code Review (opt-in, default-skip)

Read `azure-defaults/references/adversarial-review-protocol.md` for the
lens table and invocation template.

**Default**: Phase 4.5 is skipped (`step-5b/5t.challenger.default_passes = 0`).
Opt-in triggers: `decisions.review_depth == "deep"` OR an explicit
`10-Challenger` invocation.

When opted in, follow the recommended shape from
`step-5b.opt_in_matrix` / `step-5t.opt_in_matrix` in `workflow-graph.json`
for the current `decisions.complexity`:

- `simple` → 1× `comprehensive`
- `standard` → 2 passes (`security-governance` → `architecture-reliability`)
- `complex` → 3 passes (`security-governance` → `architecture-reliability` → `cost-feasibility`)

Apply the cascade early-exit rules from
`adversarial-review-protocol.md → ## Opt-in: Deep adversarial review`.

Invoke challenger subagents with `artifact_type = "iac-code"`, rotating `review_focus` per protocol.

Write results to `challenge-findings-iac-code-pass{N}.json`.
Fix any `must_fix` items, re-validate, re-run failing pass.
Save validation status in `05-implementation-reference.md`. Artifact lint is
owned by the lefthook `artifact-validation` pre-commit hook and the
`10-Challenger` review — do not invoke `npm run lint:artifact-templates` here
(see
[`agent-authoring.instructions.md`](../../../instructions/agent-authoring.instructions.md#no-direct-markdownlint-on-agent-output-rule)).

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

### Preflight Blocker Form

When Phase 1 preflight finds blockers (AVM schema mismatch, region
limitation, version pin conflict), surface them via a single
`askQuestions` call:

- **header**: `Preflight Blockers Found`
- **question**: 1-line summary referencing `04-preflight-check.md` for
  details (e.g. "2 AVM schema mismatches, 1 region limitation. See
  04-preflight-check.md for details.")
- **options**:
  - `Fix and re-run preflight` (recommended) — agent revises the plan
    inputs or substitutes an alternative module, then re-enters Phase 1.
  - `Abort — return to Planner` — STOP, present the Return to Step 4
    handoff, leave session state at Step 5 awaiting Planner rev.

Never enumerate the blockers in chat prose and ask the user to reply;
always use the form so a single-shot answer captures intent.

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
