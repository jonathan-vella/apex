<!-- ref:workflow-entry-v1 -->
# Workflow Entry Procedure

## Owner Selection

Use the GitHub Copilot SDK harness inside VS Code. Archived Local prompts are not
entry points. A skill inherits the active session's model/tools; it cannot switch agents.

Select `01-Orchestrator` for end-to-end work only if that role is not already active.
When it is already selected, continue the requested operation in the same conversation;
do not ask the user to select it again, treat a loaded skill as missing role selection,
or stop after initialization when the request was to start a project.
It confirms graph prerequisites
and human approval, then dispatches the exact allowlisted owner through the
[native worker lifecycle](worker-readiness.md). Active definitions omit model and effort pins.
The operator and runtime manage selection, including Auto and HydraFusion; model
telemetry and picker selection are not readiness gates. Actual required task/tool failures
block the affected execution. Continuation is used only when the tool supports it. Do not perform specialist work
inline or introduce a fixed-model fallback.
Direct step selection remains supported with that owner's prerequisites and tools.
Direct Requirements, Architect, Design and Governance use native `ask_user` for real missing questions;
delegated mode returns the form to its interactive parent. Autopilot answers do not prove human approval.
Delegated steps return `USER_INPUT_REQUIRED` forms for the interactive parent.
Never enable experimental skill `context: fork` or infer eligibility from labels.

## Entry Contract

Input: explicit requested operation, project, and any supplied scope or revision request.
If no operation is supplied, ask which operation; do not infer authorization.
Require a project except for `resume`; if absent for resume, follow [Resume](#resume)
to discover candidates before looking up project state. A supplied project needs
no reconfirmation. Unsupported operations stop for clarification; Git commit and
debug-log export retain their separate manual Host commands.
For a fresh workflow, use the already selected `01-Orchestrator`, or request that selection
only when another role is active and cannot perform the required routing.
For a direct step start, select
that step's owner and validate its graph prerequisites first. Selection is not
approval to skip prior steps or gates.

Read [the workflow engine](../SKILL.md), then use
`apex-recall show <project> --json` for current state. Recover an empty or failed
lookup from existing handoff and artifact evidence; do not reset prior work or
read/write session-state JSON directly. Refresh missing/stale required inputs.
Artifact numbering never proves completion, reviews, or human approval.

Use the [workflow graph](../templates/workflow-graph.json) and current owner body
as the execution authority. The following is an entry/output map, not a second
step-routing graph. Preserve upstream decisions, live governance precedence,
SKU manifest authority, required templates, bounded retries, and approval gates.

| Operation | Exact Owner | Required Inputs | Outputs |
| --- | --- | --- | --- |
| fresh or resume | `01-Orchestrator` | Project required for fresh; optional project/candidates for resume; existing handoff/state evidence | Status and applicable approval gate or exact human handoff |
| requirements | `02-Requirements` | Workload and project; current partial discovery when resuming | `01-requirements.md`, `sku-manifest.{json,md}` revision 1, review evidence |
| architecture | `03-Architect` | Approved `01-requirements.md`, SKU manifest, budget and non-functional targets | `02-architecture-assessment.md`, `03-des-cost-estimate.md`, updated SKU manifest, separate comprehensive and cost-feasibility reviews |
| design | `04-Design` | Approved architecture and explicit optional-step choice | `03-des-diagram.{py,png,svg}`, cost chart, `03-des-adr-*.md`, or recorded skip |
| governance | `04g-Governance` | Subscription, architecture, current SKU manifest | `04-governance-constraints.{md,json}`, governance-reconciliation evidence when applicable |
| plan | `05-IaC Planner` | Approved architecture, governance constraints, SKU manifest, IaC choice | `04-implementation-plan.md`, dependency/runtime diagrams, reconciled SKU manifest, mandatory review |
| bicep-codegen | `06b-Bicep CodeGen` | Approved plan and readiness evidence; Bicep track | `infra/bicep/{project}/`, `05-implementation-reference.md`, required `05-iac-handoff.json` |
| terraform-codegen | `06t-Terraform CodeGen` | Approved plan and readiness evidence; Terraform track | `infra/terraform/{project}/`, `05-implementation-reference.md`, required `05-iac-handoff.json` |
| bicep-deploy | `07b-Bicep Deploy` | Validated Bicep, target/authentication, preview and explicit apply approval | Preview evidence, deployed-state verification, `06-deployment-summary.md` |
| terraform-deploy | `07t-Terraform Deploy` | Validated Terraform/backend, target/authentication, saved plan and explicit apply approval | Applied plan evidence, deployed-state verification, `06-deployment-summary.md` |
| as-built | `08-As-Built` | Deployment summary and required predecessor artifacts; observed deployment state | Full `07-*.md` suite and project README |
| diagnose | `09-Diagnose` | Confirmed target, symptom, subscription, per-command approval | `08-resource-health-report.md`, severity-tagged findings and proposed remediation |
| challenge | `10-Challenger` | Existing artifact path, explicit/detected type, current review context | Canonically resolved `findings_path`, `decisions_path`, user-authorized accepted fixes, and apply summary |

Artifacts without another prefix are under `agent-output/{project}/`. Use the
owner's current file contracts for concrete filenames, schema, and H2 structure.
Update state only through `apex-recall`; a start command never marks a step done.

## Startup continuation

Distinguish initialization-only from start/new-project intent.
An initialization-only request may return after creating/verifying the session record.
An explicit start/new-project request in the selected Orchestrator continues into a bounded native
`02-Requirements` task, then parent-mediated discovery questions, without another role-selection gate.
An existing record with Step 1 pending is resumed, not reinitialized or force-overwritten.
Missing workload details require discovery, not a synthetic completed requirements document.
Report the actual session-state write; template defaults are proposals, not confirmed user decisions.

## Activities And Stop Rules

- Requirements uses the owner's structured discovery, preserves partial answers
  on resume, and records user SKU pins without inventing sizing decisions.
- Architecture requires both comprehensive and independent cost-feasibility
  review. Complexity alone never enables deep review; use explicit opt-in only.
- Design remains optional. Review runs only when ADRs were produced and
  `decisions.review_depth == "deep"` or the user explicitly requested review.
  Review findings are informational for Step 3, not authority to change architecture.
  Log execution failures through `apex-recall finding` and return them to the interactive
  parent. Challenger is optional manual recovery. Missing/empty output permits exactly one identical-input retry; missing
  capability blocks immediately. Never treat an execution failure as completed review findings.
- Governance discovers real effective policy, including inherited assignments;
  do not synthesize policies when authentication or discovery fails. Its SKU
  input is read-only. Unresolved conflicts block planning.
- Planning requires its comprehensive review in every complexity mode.
  Preserve plan-readiness and SKU `requires[]` reconciliation before CodeGen.
- CodeGen follows the one-file generation/validation cadence. Use current policy
  tags and security defaults, not deprecated prompt copies. Do not edit frozen
  upstream inputs. Code review is opt-in; lint/build failures remain blocking.
- Deployment preserves policy precheck, reviewed preview, explicit apply
  approval, separate destructive-change confirmation, and circuit-breaker
  limits. A preview is not an approval. Quota/region/SKU substitutions require
  escalation; never silently rewrite upstream decisions. Verify health before
  completion.
- As-built emits the full template suite, labels any unavailable observed state,
  and performs bidirectional SKU drift checks; never claim unverified deployment.
- Diagnosis is read-only until remediation is separately approved. Missing
  target, RBAC, telemetry, or authentication blocks unsupported conclusions.
- Challenger runs the Per-Finding Decision Protocol and applies only Accepted
  fixes to the challenged artifact on `Revise (apply Accepted findings)`.
  Preserve read-only requests, plan locks, upstream ownership, and required
  re-review after changes; never patch worker-owned findings. Return the resolved
  findings and decisions paths with the apply summary. Missing or stale evidence
  and unresolved `must_fix` findings cannot become an approval.

Return output paths, checks and their actual results, unresolved blockers, and
the applicable human gate or handoff. Use the graph's completion rules and
existing review evidence; never create an inline substitute for an independent
review. A blocked worker uses the [execution contract](execution-subagent.md).

## Resume

Use the active `01-Orchestrator`, requesting selection only if another role is actually active, then follow its
[Recovery and lessons](../../../agents/01-orchestrator.agent.md#recovery-and-lessons)
procedure. Use an explicit project without reconfirmation; otherwise discover
candidates and ask only when ambiguous. Empty recall is not permission to start
fresh. Reconcile handoff, checkpoints, reviews and approvals before advancing.
Present recovered status and the applicable human gate. After approval, use verified
dispatch for the graph-selected owner; do not ask the user to choose a step already determined by the graph.

## Harness Acceptance

Native custom-agent acceptance remains unverified. Static tests prove source
contracts and names, not discovery, worker identity,
tool enforcement, or runtime handoff behavior. Test SDK fresh/resume/revision on both
IaC tracks, unavailable owners/tools, approval stops, and missing review/input
recovery manually. Do not claim successful native execution from these files.
