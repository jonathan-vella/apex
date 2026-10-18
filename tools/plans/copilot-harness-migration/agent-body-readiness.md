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
