# Agent Modernization And E2E Retirement

## Status And Authorization

Implementation started 2026-09-11 on `perf/apex-workflow-optimization`.
Pre-migration checkpoint `5fbfebd4` preserves existing devcontainer edits and is published with normal hooks.
Implementation and offline verification completed 2026-09-12; migration commit `5dac72bb` is published.
Native Local/Host execution and model eligibility remain manual acceptance gates, not claimed complete.
No PR, main merge, force push, or hook bypass is authorized. Preserve user edits and historical evidence.
Verification is offline only: no model behavior probes, Azure operations, or generated-output evaluations.
Independent source review and deterministic local tests are authorized. Native harness acceptance remains manual.

## Model Contract

| Agents                                                                   | Requested Model                     |
| ------------------------------------------------------------------------ | ----------------------------------- |
| 01-Orchestrator                                                          | MAI-Code-1.1-Flash                  |
| 02-Requirements, 03-Architect, 05-IaC Planner, 11-Context Optimizer      | gpt-5.6-sol                         |
| 04-Design, 06b/06t CodeGen, 08-As-Built, 09-Diagnose, 10-Challenger      | GPT-5.6-Terra                       |
| 04g-Governance, 07b/07t Deploy                                           | GPT-5.6-Luna                        |
| Bicep/Terraform validate, what-if/plan, policy-precheck and cost workers | GPT-5.6-Luna                        |
| Challenger-review worker                                                 | GPT-5.6-Terra                       |
| E2E Orchestrator                                                         | Retire with its exclusive subsystem |

Sol's label is user-confirmed; unknown release/cost metadata must remain unknown.
Capability labels do not establish runtime cost tiers. No automatic model fallback is authorized.

## Execution Checklist

- [x] P0 Validate, commit and publish existing changes before agent edits.
- [x] P1 Freeze production contracts, prompt dispositions and harness compatibility assumptions.
- [x] P2 Repair frontmatter parsing, model classification/catalog and vendor guidance.
- [x] P3 Retire E2E-exclusive agent, prompts, scripts, CI, tests and npm commands; preserve shared production assets.
- [x] P4 Rewrite all surviving agents and workers around their contracts and apply the approved model map.
- [x] P5 Implement shared procedures with thin Local prompt adapters and Agent Host skill entry points.
- [x] P6 Align instructions, hooks, documentation, registry mirrors and generated views.
- [x] P7 Run focused and full offline checks; independently review, repair, commit and publish.
- [x] P8 Deliver manual acceptance matrix, rollback and separately approval-gated redesign proposals.

## Preserved Boundaries

Keep production roles, artifact schemas, approval gates, separate Step 2 cost review, governance ownership,
SKU manifest authority, read-only upstream contracts, bounded retries and one-file CodeGen cadence.
Remove E2E-exclusive public commands only after checking consumers. Keep production lesson schemas and recall,
artifact/security/policy validators, hook tests and unrelated devcontainer validation. Preserve prior outputs,
archives, snapshots and historical changelog bytes. Retain iteration-log schema as historical compatibility evidence.

## Authoring And Harness Design

Repair `apex-vendor-prompting` rather than deleting it. Keep source citations, distinguish vendor advice from
APEX conventions and platform constraints, and do not introduce mandatory runtime vendor-skill reads.
Bodies retain role, inputs/freshness, allowed writes, decisions, outputs, checks and stop/return rules.
Detailed reusable procedures belong in existing skill references; do not create duplicate workflow authorities.

Local and Agent Host share canonical agents and skills. Local prompts are thin adapters; Host does not load
prompt files or honor legacy configured locations. Skill metadata does not substitute for agent model/tool routing.
Require selection of the correct owning agent before consequential actions; unsupported transitions stop explicitly.
Keep required gates independent of preview scoped hooks. Explicit caller allowlists override model-invocation flags.
Workers cannot ask user questions or manage parent todos. Missing tool/model/input evidence returns to the parent.

## Verification And Rollback

Run focused parser, classifier, model, vendor, handoff, file-contract, discovery, recall and hook tests after edits.
Run `npm run validate:all` after integration. Retired E2E-only checks must disappear, not return fake success.
Negative cases cover malformed permissions, unknown models, stale/missing review evidence, retired E2E callers,
and preserved production lessons. No static check proves native discovery, model eligibility or output quality.

Manual acceptance covers Local and Host discovery, exact Sol label resolution, Luna-to-Terra eligibility,
prompt/skill model and tool boundaries, fresh/resume/revision paths on both IaC tracks, approvals and recovery.
Revert phase commits in reverse order with normal hooks; restore coupled entry points/consumers together.
Never reset user work. Broader role splits and deterministic gate/pricing extraction remain proposals requiring approval.

## Implementation Evidence

Checkpoint: shell syntax and devcontainer build/setup/verdict fixtures passed; normal commit and push hooks passed.
No agent changes were included in the checkpoint.

### Contract And Entry Coverage

This matrix describes preserved ownership, not new runtime authority. Agent bodies and the existing workflow
graph remain authoritative; an entry adapter never supplies missing review evidence or approval.

| Owner | Inputs / Freshness | Permitted Outputs | Gate / Recovery |
| --- | --- | --- | --- |
| 01-Orchestrator | Project, recall and current handoff/reviews | Recall state and handoff summaries | Human handoffs only; recover existing work before fresh initialization |
| 02-Requirements | User constraints and recorded answers | Requirements and initial SKU manifest | Elicitation, required review and human approval; preserve revision scope |
| 03-Architect | Approved requirements, manifest and budget | Architecture, pricing and manifest decisions | Comprehensive plus separate cost-feasibility review |
| 04-Design | Approved architecture and requested optional scope | Diagrams, charts and ADRs | Optional/deep review follows graph; skip never bypasses Governance |
| 04g-Governance | Target subscription, architecture, current policy evidence | Governance constraints and reconciliation evidence | Expired/incomplete evidence refreshes at owner; downstream consumers do not edit it |
| 05-IaC Planner | Approved architecture, governance, SKU manifest and track | Frozen plan, diagrams and planning contracts | Required review and approval before CodeGen |
| 06b/06t CodeGen | Frozen plan, exact pins and current governance | Track-specific code, implementation reference and JSON handoff | One-file cadence; build/validation gates; return upstream changes to owner |
| 07b/07t Deploy | Current handoff/hash, target, policy and preview evidence | Preview/deploy evidence and deployment summary | Validation-only/preview-only stop; explicit apply/destructive approval |
| 08-As-Built | Deployment evidence and predecessor artifacts | Complete as-built suite and reconciled inventory | No invented live evidence; retain SKU drift and provenance checks |
| 09-Diagnose | Confirmed symptom, target and authorization | Health report and findings | Read-only diagnosis; remediation separately approved |
| 10-Challenger | Artifact, type and current review context | Decisions and authorized accepted edits; worker owns findings | Frozen artifacts return to owner; unavailable worker requires human handoff |
| 11-Context Optimizer | Explicit audit scope and available logs | Requested report or read-only chat findings | No writes in read-only mode; missing telemetry remains unknown |
| Validate workers | Current code, pins and governance inputs | Bounded lint/review results | No source repair, plan approval or deployment authority |
| Preview workers | Approved target/inputs and initialization evidence | Exact preview evidence and change classification | No apply, state migration or user approval fabrication |
| Policy worker | Current envelope, mapping and live-check inputs | Policy result with deterministic gate | Missing/stale evidence fails closed; no discovery ownership transfer |
| Cost worker | Explicit input mode, scope/usage and authorized output | Meter-backed estimate and authorized manifest cost fields | Ambiguous/missing meters fail; no cloud writes or guessed prices |
| Challenger worker | Explicit artifact/lenses and output path | Findings JSON and compact summary | No challenged-source edits, questions, nested calls or fabricated pass |

Production main agents are human-selected, including Challenger. Workers are hidden, callable leaf agents.
The Orchestrator has no subagent dispatch. Generic platform allowlist behavior does not authorize production
callers to override these boundaries. Broad terminal permission is not described as inherently read-only.

| Entry Class | Local Surface | Shared Owner / Host Surface | Permission Boundary |
| --- | --- | --- | --- |
| Resume | Native and tools resume prompt adapters | Workflow engine; `apex-host-resume-workflow` | Select 01 before state changes; evidence-based recovery |
| Git commit | Native commit adapter | GitHub operations commit reference; `apex-host-git-commit` | Explicit repository action; preserve credentials and branch restrictions |
| Debug export | Native export adapter | Context-management export reference; `apex-host-debug-log-export` | Confirm actual Host paths and capture choices; no Local-variable assumption |
| Named workflow steps | Workflow prompt adapters from Requirements through Challenger | Workflow entry reference; `apex-host-workflow-start` | Explicit operation and exact owner/model/tools; no inherited-model substitute |
| Assessment utilities | Thin assessment/context adapters | Context-management references | Requested read/write scope and bounded audit evidence |
| Maintenance/review utilities | Thin tools prompt adapters | Workflow-engine or GitHub-operations references | Original task permissions, explicit consequential operations |
| Execution contracts | Local reference adapters | Shared execution-subagent reference | Explicit worker input/output/failure contract; no nested wrapper fallback |
| E2E launch and analysis | Retired | No replacement Host skill | No automatic approvals or runnable E2E entry point |

Host skills inherit the caller and never bind model/tool metadata. Local-only location settings remain
compatibility aids, not security controls. No experimental nesting or forked skill context is enabled.
Shared export fixtures exercise confirmed Host paths, active-session opt-in, older-session selection,
redaction, archive failure preservation and idempotent adapter boundaries without using actual private logs.

### Retirement And Preservation

Removed the E2E agent, dedicated launch/analysis prompts and inputs, benchmark/step/combination scripts,
exclusive helpers/tests, workflow and npm commands. Updated live documentation and generated discovery.
The synchronization exclusion prevents the retired CI workflow from being restored by upstream sync.
Production artifact/security/governance/challenger validators, recall, lesson collection and hook tests remain.
Historical iteration/lesson schema compatibility and prior outputs/archives/snapshots are retained unchanged.
Unknown retired command requests fail rather than acting as success-returning compatibility wrappers.

### Review And Validation Record

Resumed integration on 2026-09-12 from the published checkpoint, without rerunning completed implementation.
Independent source reviews found and repaired stale registry/catalog views, missing reference markers,
mixed-case reference names, nested Challenger fallback prose and Host export input/archive defects.
Focused Host adapter tests pass; model consistency, catalog and strict vendor-rule schema checks pass.
Worker Markdown failures were repaired without changing their contracts or relaxing body limits.
No model behavior probes, live Azure requests, or generated-output model evaluations were run.
Final full-suite, commit and publication results are recorded at closeout below.

### Final Offline Verification

On 2026-09-12, `npm run validate:all` passed: all Node tasks and the external checks, including
Python/recall and built-site links, completed successfully. Additional vendor, workflow-handoff, file-contract,
discovery, context-budget, model, governance-discovery, hook and strict JavaScript suites passed.
Host adapter fixtures pass with synthetic logs; no private-log export or live model execution was performed.
Final source re-review found no blocking issue after restoring worker output alternatives, enforcing the
production invocation policy separately from generic platform semantics, and clarifying preflight owner returns.

Historical outputs/archives, vendor snapshots, production recall and lesson/iteration/session schemas have
no diff against checkpoint `5fbfebd4`. All production model assignments match the approved table exactly.
Advisory leaf-contract heading warnings remain; workers retain their existing output contracts and tested
failure boundaries. These warnings do not establish a runtime failure or justify changing output schemas.
Published migration commit `5dac72bb` with normal commit and pre-push hooks; local and remote feature refs
matched and the worktree was clean. Protected `main` remains `836966355354946d9fc3b78606bebbd9d08dc7d4`.
The final adapter/execution/vendor-policy rerun passed all cases after formatting. No PR, merge, runtime
model probe or Azure operation occurred. Network access was used only for the authorized Git publication.

To roll back this migration, revert `5dac72bb` as a unit with normal hooks so agent models, shared procedures,
Local adapters, E2E removals and generated views stay aligned. Do not reset to the checkpoint or discard
subsequent user edits. Re-enable the retired E2E subsystem only through an explicitly approved rollback.

## Manual Acceptance Matrix

These checks remain user-owned. Offline tests do not establish runtime support or model quality.

- [ ] Local: discover all production agents and leaf workers; no E2E agent or duplicate skill entry.
- [ ] Host: discover canonical agents and each Host entry skill without relying on Local prompt files/settings.
- [ ] Resolve exact `gpt-5.6-sol` label; verify every selected agent uses the requested model.
- [ ] Verify Luna-to-Terra reviewer eligibility; unsupported routing must stop without fallback or skipped review.
- [ ] Resume a project in both harnesses; preserve existing artifacts, answers, approvals and user edits.
- [ ] Exercise fresh and revised Bicep and Terraform workflows with missing/stale evidence and failed tools.
- [ ] Confirm separate architecture/cost reviews, governance freshness and mandatory approval stops.
- [ ] Confirm validation-only and preview-only requests never prepare, bootstrap or apply infrastructure.
- [ ] Confirm worker questions/todos/nesting are unavailable and missing inputs return to the parent.
- [ ] Check partial-file recovery and exact pins; frozen upstream changes return to the owning step.
- [ ] Exercise read-only audit and selected log export with explicit capture consent; inspect privacy boundaries.
- [ ] Confirm required checks remain effective when preview hooks are unavailable in a harness.
- [ ] Review complete generated outputs and report reproducible findings before final quality signoff.

## Separately Approval-Gated Proposals

| Proposal | Expected Benefit | Risk / Required Evidence | Rollback |
| --- | --- | --- | --- |
| Deterministic gate-evidence evaluation | Reduce repeated interpretation of hashes, reviews and freshness | Must preserve every refusal/approval case in both tracks; no new approval authority | Revert extractor/caller integration together |
| Deterministic pricing arithmetic | Reproducible quantities, tiers and totals from selected meters | Meter selection remains specialist-owned; test units, environment/stamp expansion and ambiguous meters | Restore existing calculation procedure and consumers |
| Separate review decisions from applying fixes | Clearer read-only reviewer boundary | Changes role/ownership; requires revised handoffs and proof of accepted-edit/re-review behavior | Restore wrapper and its caller contract together |
| Separate read-only audit from report writing | Reduce audit write exposure | Extra entrypoints can add complexity; demonstrate actual permission benefit in both harnesses | Restore combined agent with explicit write modes |

None of these redesigns is implemented by this contract-preserving migration. E2E retirement is approved
and implemented, not an optional proposal. Production CodeGen cadence and mandatory review floors are unchanged.
