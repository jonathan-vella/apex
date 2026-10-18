## Agent-body migration and readiness

Owner request: 2026-10-18, inspect every agent body for the Copilot harness inside VS Code,
test handoffs and preserve direct questioning in Requirements, Architect, Design and Governance.
This work changes the bodies and their runtime guidance, not merely invocation flags.

### Runtime evidence and design

The owner explicitly selected Copilot and Probe Source in a tool-free synthetic UI fixture.
`SOURCE_READY_20261018` appeared but no handoff controls appeared.
The supplied transcript included Read/search despite `tools: []`; actual restrictions were not established.
This is user-observed behavior of the tested client, not proof that every future VS Code build lacks handoffs.

The [GitHub configuration reference](https://docs.github.com/en/copilot/reference/custom-agents-configuration)
explicitly scopes ignored handoffs to the cloud agent.
The [VS Code harness guide](https://code.visualstudio.com/docs/agents/run/agent-harnesses) and
[custom agents guide](https://code.visualstudio.com/docs/agent-customization/custom-agents)
distinguish harnesses and runtime-dependent controls. Accessed 2026-10-18.
APEX now avoids an unobserved UI dependency: no active `handoffs` metadata.
Native bounded tasks/actual results or explicit user role selection determine the next action.
`00-handoff.md` is retained as domain recovery data, not a native control.

### Per-agent disposition

All paths below are under `.github/agents/`. Names/paths are preserved for discovery and compatibility.
No model/effort pins or replacement runtime hooks are introduced.

| File                                              | Body outcome and preserved responsibility                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `01-orchestrator.agent.md`                        | Compact interactive coordination, native tasks/forms, real reviews/gates, atomic recall recovery and lessons     |
| `02-requirements.agent.md`                        | Direct discovery questions before writing; user-pins-only SKU manifest; actual review and Gate 1                 |
| `03-architect.agent.md`                           | Direct material clarifications, WAF/live SKU/price evidence, separate architecture and cost reviews              |
| `04-design.agent.md`                              | Direct scope/ambiguity questions; approved-design-only diagrams/ADRs with actual paired renders                  |
| `04g-governance.agent.md`                         | Direct confirmed scope/resolution questions; inherited deterministic discovery, TTL/signature and reconciliation |
| `05-iac-planner.agent.md`                         | Typed/frozen contracts, AVM/policy/diagram feasibility and real current plan approval                            |
| `06b-bicep-codegen.agent.md`                      | Approved frozen inputs, Bicep incremental generation/validation, security and actual code handoff                |
| `06t-terraform-codegen.agent.md`                  | Terraform/provider/backend constraints, incremental checks, no apply or upstream self-repair                     |
| `07b-bicep-deploy.agent.md`                       | Exact target/phase/preview/L3/approval, locked source and verified observed results                              |
| `07t-terraform-deploy.agent.md`                   | Backend/workspace/saved-plan freshness, mismatch recovery, L3 and phase-bound apply approval                     |
| `08-as-built.agent.md`                            | Actual deployed inventory/SKU drift, full or partial docs, pricing evidence and paired charts/diagrams           |
| `09-diagnose.agent.md`                            | Scope-first direct questions, read-only evidence, explicit telemetry gaps and separately approved remediation    |
| `10-challenger.agent.md`                          | Optional manual independent review, actual single/batch output, accepted edits/freshness and no assumed rollback |
| `11-context-optimizer.agent.md`                   | Scoped measured/source-only diagnostics; no source mutation, unrelated-session scan or invented savings          |
| `_subagents/bicep-validate-subagent.agent.md`     | Actual compiler/static L2 checks and exact FAILED/NEEDS_REVISION/APPROVED text contract                          |
| `_subagents/terraform-validate-subagent.agent.md` | Isolated backend-disabled validation, security/RBAC/L2 and explicit skipped/failed checks                        |
| `_subagents/bicep-whatif-subagent.agent.md`       | Exact approved subscription/scope preview; no active-account authorization default or deployment                 |
| `_subagents/terraform-plan-subagent.agent.md`     | Explicit subscription, current backend/workspace and saved plan; destroys/replacements surfaced, never applied   |
| `_subagents/policy-precheck-subagent.agent.md`    | Existing policy-precheck-v2 truth table/schema, actual coverage and explicit BLOCK on missing evidence           |
| `_subagents/cost-estimate-subagent.agent.md`      | Real meter/usage/provenance, constrained fallback, atomic output and explicit unresolved FAILED                  |
| `_subagents/challenger-review-subagent.agent.md`  | Bounded independent lenses, unchanged findings schema, atomic unique draft and actual single/batch result        |

### Interaction contract

Every main explicitly declares native `ask_user` and describes direct and delegated interaction.
Direct selection asks material missing questions, batches independent fields, validates freeform answers,
reuses current choices and stops on unavailable questioning instead of inventing answers.
Requirements, Architect, Design and Governance are not forced into a leaf-only or Orchestrator-only question path.

Delegated mains return `USER_INPUT_REQUIRED` with stable request ID, phase, native form and missing inputs.
The interactive parent normalizes to the actual native form surface and validates returned values.
Leaves have no user-question/delegation/parent-todo tools and retain their exact missing-input failure shape.
Same-task continuation is conditional; one-shot tasks do not require unsupported resumption.
Autopilot answers, an agent's name or a tool declaration are not independent owner approval.

### Source checks and independent review

Source census checks every active definition for valid YAML, direct question capability on mains,
no leaf question/delegation tools, no active handoffs and no old worker handshake/execution markers.
The before/after source measurement was 9,889 to 4,151 lines across the active definition files.
This is source-size measurement only: token, cost, latency and native quality savings remain unmeasured.

An independent native reviewer compared all bodies against the prior revision and found no blocking
domain loss. Its Terraform mismatch-recovery and partial-review-edit rollback clarifications were applied.
An arbitrary diagram score was not reinstated as platform authority; observable render checks remain.
Domain graph requirements, live security/governance, current mandatory reviews and reviewer receipt/freshness
rules remain. Historical UI/telemetry fixtures are not restored into active runtime instructions.

### Actual harmless native probes

| Role/capability                                             | Actual result                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Requirements, Architect, Design, Governance delegated input | Returned structured missing-input forms without a readiness exchange                    |
| Bicep/Terraform validation missing inputs                   | Returned declared failed/skipped-check text results without claiming compiler execution |
| Manual Challenger missing inputs                            | Returned CHALLENGE FAILED / not_written / BLOCKED, no fabricated findings               |
| Bicep what-if and Terraform plan in the current session     | Returned bare `blocked`, not their current declared text shape                          |
| Cost leaf in the current session                            | FAILED but explicitly demanded an obsolete worker handshake/execution envelope          |

The last results contradict the current on-disk bodies, which contain no such prerequisite.
Cached/attached runtime guidance or definition loading is unresolved; the exact cause is not asserted.
Do not restore the removed protocol or prompt around it to manufacture a pass.
A fresh Copilot session/reload was requested to repeat those probes against the pushed revision.
The owner's subsequent results are recorded below; they supersede the unresolved status for those
specific missing-input probes without deleting the earlier observations or asserting their cause.

### Owner-reported fresh-session retest

The owner supplied the following native tool/result transcripts in this conversation on 2026-10-18
while following the fresh Copilot/direct-picker instructions. These are user-reported observations,
not a newly collected raw capture, independently inspected UI session or pinned SDK-version attestation.
The supplied snippets do not independently establish that no other tool calls occurred.

| Probe                                  | Supplied result                                                                                | Bounded conclusion                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Requirements, 16:23 UTC                | Native Ask User project-name form; answer `test`                                               | Direct questioning PASS                                                      |
| Architect, 16:24 UTC                   | Native Ask User WAF-pillar choices; answer Security                                            | Direct questioning PASS                                                      |
| Design, 16:26 UTC                      | Native Ask User artifact choices; answer Both                                                  | Direct questioning PASS                                                      |
| Governance, 16:27 UTC                  | Native Ask User fictional target-label form; answer `test`                                     | Direct questioning PASS                                                      |
| Orchestrator, 16:39 UTC                | Native Ask User synthetic intent; answer Resume an existing project                            | Direct questioning PASS; no project action claimed                           |
| IaC Planner, 16:41 UTC                 | Native Ask User synthetic strategy; answer Phased deployment                                   | Direct questioning PASS; no plan or approval implied                         |
| Diagnose, 16:43 UTC                    | Native Ask User synthetic symptom; answer Errors                                               | Direct questioning PASS; no investigation/remediation claimed                |
| Challenger, 16:44 UTC                  | Native Ask User synthetic review mode; answer Review only                                      | Direct questioning PASS; no review or edits claimed                          |
| Bicep and Terraform CodeGen, 16:47 UTC | Two supplied native environment-label forms; Sandbox A in each                                 | Direct questioning PASS in the requested agent order                         |
| Bicep and Terraform Deploy, 16:49 UTC  | Two supplied native test-mode forms; Inspect only in each                                      | Direct questioning PASS in the requested agent order; no operation authority |
| As-Built, 16:51 UTC                    | Native Ask User synthetic documentation scope; answer Inventory only                           | Direct questioning PASS; no documentation work claimed                       |
| Context Optimizer, 16:51 UTC           | Native Ask User synthetic audit scope; answer Source only                                      | Direct questioning PASS; no evidence access/audit claimed                    |
| Bicep what-if, 16:30 UTC               | WHAT-IF ANALYSIS RESULT / FAIL; four missing inputs; explicitly no preview ran                 | Missing-input contract PASS; no obsolete handshake requested                 |
| Terraform plan, 16:33 UTC              | TERRAFORM PLAN RESULT / FAIL; missing module/subscription; no plan or file created             | Missing-input contract PASS; no obsolete handshake requested                 |
| Cost estimate, 16:34 UTC               | COST ESTIMATE FAILED / not_written; missing input mode/project/region/path; totals unavailable | Missing-input contract PASS; no obsolete handshake requested                 |

Bicep's zero change counts are explicitly placeholders, not an empty-diff observation;
its four reported violations identify missing inputs, not actual Azure Policy denials.
Terraform's zero counts and destructive `None` mean not evaluated, not a safe plan.
Cost's displayed USD is not a queried price or owner-approved currency/budget; no totals were calculated.
These results resolve the earlier missing-input behavior mismatch in the tested fresh-session path.

Every current user-facing main now has an owner-reported passing native question-channel observation.
The paired CodeGen and Deploy snippets were unlabeled individually; role attribution follows the
explicitly requested test order rather than independently inspected session metadata.
The synthetic answers confer no project, review, deployment, data-access or remediation authorization.
This does not prove that normal workflows ask all necessary questions or correctly reuse real decisions.

Cancellation/restart recovery, tool restriction enforcement,
successful compiler/preview/pricing execution and full Azure behavior remain unverified by these probes.
Actual Azure scope/budget remain absent.
No cloud actions, authority exceptions, review resets or historical evidence repairs are part of this task.

### Validation results

- Native agent/frontmatter/body, domain graph/registry, model, skill and instruction checks passed.
- Full tooling contracts: 832 passed, 2 skipped, no failures.
- Native interaction/question Python tests: 38 passed.
- Preserved diagnostic event-reader, actual review-recording and risk-integrity tests: 272 passed.
- Source-only independent review: no blocking domain loss; identified recovery clarifications were repaired.
- Changed live-document links resolve; an untouched illustrative `run-tests.js` example is not a live missing file.
- Full `npm run validate:all` passed in an isolated source-only checkout of the final staged candidate:
  53 Node validation entries passed, no failures, and external Python suites passed.
  Existing untracked project/state artifacts were not copied, edited or waived.
- The full run exposed stale ordinal/prose assumptions in governance and review-ceiling checks.
  Required policy/property/blocking behavior and explicit review accounting were preserved;
  the native body structure no longer depends on an old numbered review heading or cosmetic HARD GATE phrase.
- These source checks do not alone resolve native runtime behavior. Subsequent owner-reported probes
  establish the bounded question/missing-input results above, not tool-enforcement or full E2E acceptance.

### Selected-Orchestrator startup regression

At 16:56 UTC the owner reported `start a new project called cp-harness-01` with
`01-Orchestrator` already selected. The supplied transcript initialized recall state and then
asked the user to select that same role instead of beginning Requirements.
That is not a passing integrated startup. The precise runtime-loading cause is unproven;
entry guidance did contain unconditional role-selection language.

The source now makes selection conditional and distinguishes initialization-only requests from
start/new-project requests. The active Orchestrator continues into the native Requirements task
and parent-mediated discovery; an existing Step 1 pending record is resumed without reinitialization.
Regression checks cover that source contract, not a fabricated successful workflow run.
The existing cp-harness-01 state is untouched. Its template region is not a confirmed user requirement,
and creation of session state is a filesystem write, not "no artifacts created".

### Completion boundary

Remote CI exposed a separate legacy shell caller that exited on grep's no-match result after all UI
handoffs were removed. The caller now accepts an empty reference set while still failing unknown literal
targets, empty agent inventories and read errors. Regression fixtures cover no UI refs, both legacy list
forms, nonexistent targets and regex-like names. This repairs the caller, not restores UI metadata.

This is a comprehensive source-body migration with bounded actual runtime observations,
not an unconditional claim that every agent is fully exercised in the installed client.
Source/test/docs/PR validation is recorded with the actual delivered revision.
Owner-reported native questions pass for all current main agents, and the three previously mismatched
leaf missing-input probes pass. Remaining interaction/permission/domain execution gaps stay visible.

### Requirements discovery UX regression and repair candidate

The owner's supplied Requirements transcript for `cp-harness-01` contradicts any inference that
passing question-channel probes established normal discovery quality. It shows duplicate employee-size
and separate Other fields, vague freeform business/timeline questions, migration-only questions after
Greenfield, repeated technical ownership intake and an explicit admission that earlier answers were
omitted from a replacement task. No protected project state or answers were edited during this repair.

Comparison with `origin/main` at `3602dea8` confirms the previous Requirements body contained richer
industry/scenario/sizing menus and conditional migration rounds. Some excessive implementation-binding
intake predated the harness change; the regression is not attributed entirely to migration.

The candidate restores guided discovery through
[`requirements-discovery.mjs`](../../scripts/requirements-discovery.mjs):
inline freeform choices without Other companions, conditional migration/sizing/access fields,
understandable outcome/timeline/budget menus and reusable captured answers. A missing migration
scenario fails explicitly instead of treating a dropped ledger as a completed stage.
Unambiguous selected workloads are not asked again. Unknown access/ownership details are recorded
for their consuming Architecture/Planning gate rather than forcing account contacts, principal IDs
or runtime details out of a non-expert in Step 1. Baselines and later implementation gates are unchanged.

Every Requirements continuation now requires the full answer ledger. The Orchestrator can perform
the same automatic native independent review as a sibling when a delegated producer cannot nest tasks.
`REVIEW_REQUIRED` does not authorize self-review, findings fabrication, budget resets or relaxed recording.
Actual reviewer failure and missing recording evidence remain distinct blocking outcomes.

The supplied transcript ends with "reviewer unavailable" and a manual Challenger instruction, but
contains no visible actual reviewer call/error. The owner reports debug logging is not working;
no separate usable log was supplied and the exact referenced temporary outputs no longer exist.
The original runtime failure cause is therefore unknown, not proved to be nested-task unavailability.

Actual bounded observations during the repair:

- A delegated native Requirements probe with a synthetic Greenfield ledger returned only the missing
  guided industry/timeline fields, preserving earlier answers and excluding migration/Other/contact fields.
- A no-nesting role-contract probe returned the requested `REVIEW_REQUIRED` scope to its parent.
  This proves response shape under an explicit synthetic constraint, not automatic production recording.
- A real independent native `rubber-duck` source review identified missed freeform migration wording,
  duplicated workload confirmation and missing-ledger handling. Those cases were repaired and covered
  by behavioral tests; no `cp-harness-01` review receipt or project approval was manufactured.
- Guided form, parent/agent policy and native rich-field tests pass locally. Full validation is reported
  against the delivered candidate; an integrated owner retry remains necessary for normal discovery
  and automatic review-recording acceptance.

Repair validation: focused guided-form/agent-policy tests passed (65); native rich-form Python tests
passed (30); tooling aggregate passed (849, with 2 skipped). JavaScript/Ruff/Markdown, agent/skill,
documentation freshness and regenerated Explorer checks passed.
`npm run validate:all` passed in an isolated source-only candidate checkout:
53 Node validation entries, no failures, with the external Python suites also passing.
Protected untracked projects were excluded, not repaired or waived. Subsequent evidence prose does
not change the tested implementation. Documentation companion `8946267447e667fd52c5d759b03a9135a1b7b077`
is pushed on `jonathan-vella/apex-docs#43`, with build/content/link and editorial tests passing.

### Requirements retry: reviewer dispatched, recording rejected

The owner's next transcript reports answer reuse and Greenfield reconciliation without new questions.
It shows the delegated Requirements worker returning `REVIEW_REQUIRED` and the interactive parent
invoking native `rubber-duck`. This confirms sibling dispatch for that retry, not fresh guided-intake
quality or a completed review. The project worker reconciled its own artifacts during that run;
this separate source repair did not modify project artifacts, state, attempt accounting or findings.

Unlike the earlier unavailable-review claim, the supplied retry explicitly identifies its native
session log. Targeted read-only inspection confirms the root dispatch at 19:05:36 UTC and a
reviewer shell safety block at 19:06:41 UTC on 2026-10-18. The reviewer later returned findings JSON,
but read-only `extractReview` reproduces `Worker tool calls must complete successfully`.
No review sidecar or gate approval resulted. The recorder correctly rejected the failed interaction.

The current review guidance required code-based draft finalization with complete findings text
inside a command even though the recorder already derives IDs/counts. The reviewer put freeform
findings into shell code, then attempted a scratch heredoc despite the no-write contract.
The repair removes this unnecessary executable-draft step across automatic callers.
Reviewers return substantive JSON directly; the unchanged recorder supplies only deterministic
normalization and retains all schema, failed-operation, metadata, freshness and attribution checks.
No safety exception, generic failed-command recovery or historical hash refresh is introduced.

Returned recommendations also crossed stage boundaries: known caller/runtime unknowns became
new pre-Architecture demands, arbitrary operational targets were proposed, and a budget target
was confused with automatic enforcement. Requirements checklists now distinguish actual Step 1
defects from documented later-stage work and prohibit invented approved targets or permissions.
This guidance does not delete or reclassify any historical findings.

Focused direct-JSON/recorder/agent tests passed (109); tooling aggregate passed (851, with 2 skipped).
A bounded native synthetic reviewer probe returned independent findings without executable draft
finalization. Its JSON was fenced rather than raw; existing unambiguous-fence normalization covers
that format. The probe had no production metadata or recording and establishes neither a project
receipt nor a new review allowance. Production retry authorization and integrated recording remain open.

The staged implementation also passes full source-only `npm run validate:all`: 53 Node validation
entries, no failures, plus external Python suites. The supplied project/session artifacts were not
copied, edited or waived. This engineering validation does not make the failed production review valid.

### Zero-credit unattended validation

The owner authorized a bounded unattended validate/fix/publish pass with a total Copilot CLI
AI-credit budget of zero. The baseline was the newer instruction-audit commit `a96c6a31`;
its changes were preserved. Copilot CLI `1.0.98` was identified through version/help only.
No model-backed CLI sessions or new native reviewer calls ran under this authorization.

The exact source-only baseline passed full validation and its current remote checks, including
container comparisons. Additional Git-hook, full JavaScript/format and documentation compatibility
checks passed. Extra discovery probes nevertheless exposed incorrect handling of explicit negation:
`not greenfield` suppressed valid migration intake, and `no migration or modernization` still asked
migration questions. The helper now removes the complete explicitly negated scenario list before
deciding which branch applies. Seven regression cases failed before the fix and pass after it.
Captured answers, stage completion semantics and domain/approval gates are unchanged.

The focused discovery/recorder/Orchestrator suite passed 128 tests. Four complete synthetic discovery
ledgers also passed the actual native-form Python validator with no duplicate/captured-answer questions.
Existing synthetic review-retry, revision-conflict, freshness and risk-boundary tests passed 84 cases.
These fixtures exercise deterministic code only; their seeded review/approval data is not runtime
review evidence, owner signoff, Azure permission or proof of VS Code/CLI equivalence.
Final candidate validation and pushed CI are reported with the delivered revision.
The final staged repair passed full source-only `npm run validate:all`: 53 Node validation entries
and external Python suites, with no failures. Existing project inputs were excluded, not waived.

No real project state, artifacts, review findings, attempt budgets or credentials were changed.
No Azure action, deployment, merge or auto-merge was performed. Normal model-backed Requirements
discovery, independent review recording, UI cancellation/restart and consequential approval remain
acceptance gaps, not a successful overnight E2E claim.
