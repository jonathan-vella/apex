## Product requirements: VS Code Copilot-only migration

**Revision:** 2026-10-18 assessment-led replanning.
**Delivery:** [APEX #779](https://github.com/jonathan-vella/apex/pull/779) and
[jonathan-vella/apex-docs#43](https://github.com/jonathan-vella/apex-docs/pull/43).
**Gate:** OWNER PLAN APPROVED; execution authorized by the 2026-10-18 10:18 UTC owner message.
Evidence-based engineering progression is delegated; see [execution status](execution-status.md).
Neither repository may merge into `main`, enable auto-merge, or bypass protection.

### Product outcome

Run APEX in the **Copilot session target inside VS Code**, using the Copilot SDK/Agent Host.
Make routine engineering reliable in native Autopilot, with human interaction reserved for material
requirements, permissions, risk decisions and consequential approvals.

The existing branch is an implementation candidate, not a framework that must be preserved.
Agents, instructions, skills, orchestration, registries, validators and tests may be adapted,
consolidated, replaced or retired when their useful outcomes and callers are accounted for.
Source already implemented should not be replayed merely because the historical plan lists it.

This PRD supersedes the earlier delivery requirements, not the live production instructions.
Current security, review and approval controls remain effective until an approved replacement is tested.
The explicit owner decision to retire repository agent runtime hooks is an exception for those mechanisms:
do not restore them; preserve underlying Azure and authorization outcomes without claiming native equivalence.
The [assessment adoption](assessment-adoption.md), [execution contract](execution-contract.md),
[backlog](backlog.md) and [roadmap](roadmap.md) define the proposed changes.
The [recovery assessment](recovery-assessment.md) remains historical evidence; withdrawn claims stay withdrawn.

### Target runtime and non-goals

The supported execution target is VS Code Copilot only.
VS Code Local, standalone Copilot CLI, cloud coding agents, other IDEs and a multi-harness compatibility
layer are not product execution targets. CLI command-line utilities remain usable as engineering tools.
SDK/CLI documentation applies only where official VS Code documentation establishes the relevant equivalence.
Preserve archived Local material and historical readers without rediscovering them as active entry points.

The owner now authorizes Azure deployment/E2E through CHM-18, subject to an explicit approved tenant,
subscription, resource boundary, budget and permitted actions before cloud writes.
Deletion/cleanup, credential switching, project-state repair, findings/review-counter resets,
historical-evidence restamping and site publication remain unauthorized.

### Proposed customization architecture

- Native Agent for routine repository work, or an optional short interactive APEX engineering lead.
- On-demand requirements, architecture, design, governance, IaC, diagnostics and documentation skills.
- Native bounded workers/reviewers only for meaningful independent context or restricted capabilities.
- Tested deterministic tooling for policy discovery, compilation, previews, security checks and cost math.
- A separately permissioned deployment operator with Bicep/Terraform command adapters.
- A small durable project decision/review/approval record, initially behind the `apex-recall` facade.
  Native session SQL/todos own session task tracking, not cross-project authorization.

The existing numbered role roster, per-worker readiness handshake, raw-log replay and duplicate review
paths are not target requirements. Their retirement depends on pilot results, caller closure and owner
approval; it must not remove Azure security, live governance, review integrity or historical compatibility.
The owner subsequently requested full body modernization and direct questioning independently of cloud scope.
That source slice preserves current role names while removing active UI handoff/readiness dependencies;
it does not claim roster consolidation, runtime permission enforcement or completed Azure E2E.

### Autopilot operating model

Autopilot should execute most scoped engineering: reads, edits, tests, bounded repairs, feature-branch
commits/pushes, issue/PR updates and relevant review fixes. Do not ask permission again for every
already-approved technical step.

Selecting native Autopilot is a runtime action; `APEX_UNATTENDED=1`, an `"autopilot"` prompt or an
agent's self-description does not prove that mode is active.
Official VS Code documentation says Autopilot can answer blocking questions automatically.
Consequently, successful `ask_user`, a persisted approval field, worker completion or reviewer approval
does not establish independent human authorization.

CHM-10 must choose and test a genuine consequential boundary: for example, protected execution with an
independent approval, or an explicitly controlled non-Autopilot operator context.
Agent frontmatter alone is not credential isolation when the parent can run the same write-capable shell.
No production action may depend solely on an agent-authored approval.

### Requirements and traceability

| ID  | Required outcome                                                                                                 | Delivery packets       |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------------------- |
| R1  | VS Code Copilot-only active entry points; historical Local compatibility stays inactive.                         | CHM-03, CHM-11, CHM-16 |
| R2  | Actual MCP projection is verified; deleted runtime hooks/callers retire without false native-equivalence claims. | CHM-05, CHM-10, CHM-17 |
| R3  | Interaction, freeform input, decline, cancellation and missing-input behavior are distinct and tested.           | CHM-03, CHM-04, CHM-10 |
| R4  | Bounded delegation uses actual native lifecycle/continuation, not a compulsory bespoke handshake.                | CHM-03, CHM-04, CHM-11 |
| R5  | Independent review, unresolved findings, durable decisions and historical readers remain valid.                  | CHM-13, CHM-14         |
| R6  | Evidence is genuine and scoped; missing usage is UNKNOWN, never invented zero or approval.                       | CHM-06, CHM-17         |
| R7  | Current candidate source checks, negative tests and baseline failures are revision-bound.                        | CHM-12, CHM-15, CHM-17 |
| R8  | Both repositories describe the same proposed/verified state; docs build/review is evidenced.                     | CHM-07, CHM-08         |
| R9  | Historical provenance and withdrawn claims are preserved; readiness is evidence-led.                             | CHM-08, CHM-16         |
| R10 | The simpler architecture accounts for all affected assets and valuable domain outcomes.                          | CHM-09, CHM-11, CHM-12 |
| R11 | Autopilot cannot manufacture consequential authorization or bypass the chosen execution boundary.                | CHM-10, CHM-17         |
| R12 | Retirement closes callers, tests, registries, hooks, docs and historical compatibility.                          | CHM-15, CHM-16         |
| R13 | Authorized real-Azure E2E proves application, identity, networking and operational outcomes in exact scope.      | CHM-18, CHM-08         |

CHM-01/#769 and CHM-02/#771 remain completed historical work, not fresh candidate validation.
Revised open issues and new implementation packets form the current backlog; do not reopen completed work
or treat old checks as acceptance of this proposed architecture.

### Acceptance gates

1. **Plan approval:** owner approves scope, target direction and Autopilot delegation contract.
   Passed by the actual owner message, not inferred from this document or a tool result.
2. **Representative no-cloud pilot:** actual VS Code Copilot target, one bounded workflow,
   independent review, genuine no-op approval boundary, negative cases and recovery.
3. **Replacement and retirement:** role/skill/tooling changes pass targeted tests and preserve useful outcomes;
   retire no unread asset on a filename, reference count or framework convention alone.
4. **Final VS Code E2E:** authoring, validation, review, interaction, cancellation and recovery work on the
   final candidate, with no Azure writes and no fabricated telemetry.
5. **Real-Azure E2E:** CHM-18 establishes scope and controls before deployment, then verifies real behavior.
   Missing scope or a blocked control stops cloud writes, not unrelated engineering.
6. **Cross-repository evidence:** documentation and remote checks match the tested revisions.
   CHM-08 returns READY_FOR_OWNER_REVIEW or BLOCKED, never permission to merge or deploy.

A native discovery list, source validator, green fixture or ARM provisioning result is not runtime E2E.
There are no unmeasured token, cost or latency savings targets. Measure only with attributable real usage.
Existing smoke numeric thresholds and exact event sequences are historical APEX conventions:
CHM-06 must justify, adapt or retire each without manufacturing support for missing runtime fields.

### Evidence and compatibility

The 2026-10-18 assessment was not a clean-room run. Repository guidance was already attached.
Its full file ledger has explicit content gaps; close only the gaps material to each packet before editing,
not an unbounded whole-repository re-audit before the pilot.
Official capabilities, session tool contracts, inspected source, historical claims and unknowns stay separate.

Current source planning baseline is `ea8cb3821f6f6d435dacf967d38263a04d438d41`.
Historical comparisons include `05c2ac85` and `ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`.
Equivalent input snapshots are required for regression attribution; unavailable inputs mean UNKNOWN.
Preserve all untracked project artifacts and existing `agent-output/` and project IaC.

### Owner decisions and stop conditions

- Plan/implementation/deployment approval is recorded; it is not merge, deletion or unspecified Azure-scope authority.
- Choose the consequential approval/credential boundary during CHM-10.
- Decide whether the generic prepare/validate/deploy skill pack is core or optional before retiring it.
- Approve any change to the currently mandatory separate architecture cost-feasibility review.
- Retain current signed-exception trust semantics unless a separately approved change replaces them.
- Stop only the affected packet for missing capability, permission, conflicting edits, ambiguous authority,
  unresolved blocking findings, exhausted bounded repair or required owner decision.

No deadline or cost saving is promised. Execute dependency-ready packets; report actual failures and unknowns.
