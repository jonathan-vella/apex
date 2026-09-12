<!-- ref:workflow-entry-v1 -->
# Workflow Entry Procedure

## Owner Selection

Local adapters bind the named agent in prompt frontmatter. Agent Host does not
load Local prompt files or legacy configured prompt locations. A skill inherits
the active session's model and tools; it cannot bind or switch an agent.

Before any consequential action, require the user to select the exact named
owner below and its model from that agent's current frontmatter. If the owner,
model, or required tools cannot be verified, **STOP** and request manual owner
selection in a new session. Do not continue under an inherited picker model.
Do not add tools to compensate for missing access. Prompt tool overrides may
only narrow the owning agent's permissions.

MAI must not invoke Sol agents as subagents or perform their work inline.
The Orchestrator presents a human handoff and stops. Do not enable experimental
nesting or `context: fork`; do not infer model-tier eligibility or add fallbacks.
An explicit caller allowlist controls worker invocation, regardless of a
recipient's model-invocation flag. Workers return missing inputs to the parent
without user questions, parent todo management, or nested dispatch.

## Entry Contract

Input: requested operation, project, and any supplied scope or revision request.
If no operation is supplied, ask which operation; do not infer authorization.
For a fresh workflow, select `01-Orchestrator`. For a direct step start, select
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
| fresh or resume | `01-Orchestrator` | Project or project candidates; existing handoff/state evidence | Status and applicable approval gate or exact human handoff |
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

## Activities And Stop Rules

- Requirements uses the owner's structured discovery, preserves partial answers
  on resume, and records user SKU pins without inventing sizing decisions.
- Architecture requires both comprehensive and independent cost-feasibility
  review. Complexity alone never enables deep review; use explicit opt-in only.
- Design remains optional. Review runs only when ADRs were produced and
  `decisions.review_depth == "deep"`; it is informational and does not block Step 3.
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

Require `01-Orchestrator`, then follow its
[Resuming a Project](../../../agents/01-orchestrator.agent.md#resuming-a-project)
procedure. Use an explicit project without reconfirmation; otherwise discover
candidates and ask only when ambiguous. Empty recall is not permission to start
fresh. Reconcile handoff, checkpoints, reviews and approvals before advancing.
Present recovered status and the applicable gate or handoff, then stop. Do not
ask the user to choose the next step when the graph determines it.

## Harness Acceptance

Native Agent Host support is manual and unverified. Static tests prove source
contracts and names, not discovery, exact model availability, tool enforcement,
or runtime handoff behavior. Test Local and Host fresh/resume/revision on both
IaC tracks, unavailable owners/models, approval stops, and missing review/input
recovery manually. Do not claim successful native execution from these files.
