# APEX Workflow Optimization

## Status

**State**: Autonomous execution authorized through implementation, skill consolidation, prefix migration and verification
**Owner**: Jonathan Vella with GitHub Copilot
**Created**: 2026-09-10
**Branch**: `perf/apex-workflow-optimization`
**Original APEX revision**: `836966355354946d9fc3b78606bebbd9d08dc7d4`
**Curated AKS reference**: `bb7ae9021a0fc59d10d129710a8a260b573d9dcc`

Reference repository: <https://github.com/jonathan-vella/aks-basic>.
The pinned reference is a qualitative output reference, not a deployment prerequisite for this phase.
Commits and pushes are authorized only on the feature branch. Never merge into main or enable auto-merge.
No Azure resources have been created. Local guidance improvements use risk-based verification;
measured end-to-end token savings and final generated-output quality are not claimed.

## Authoritative Remaining Work

Updated 2026-09-11 following the user's sequencing clarification and skill-prefix request.
This checklist supersedes older pending/proposal statuses below and in the audit ledger.
Completed batch records remain historical evidence; they do not mark these remaining tasks complete.
Manual testing and resulting remediation occur at the very end, not as prerequisites for implementation or planning.
Continue focused automated validation and independent review during implementation.

Execution order: remaining fixes -> skill merger/retirement plan -> evidence-backed autonomous consolidation ->
`apex-` skill-prefix migration -> final automated verification -> user manual testing -> remediation and signoff.
The authorization below replaces intermediate user-decision gates for work within its boundaries.

### Autonomous Execution Authorization

The user answered all planned decision questions on 2026-09-11. Proceed through A01-D03 without requesting
routine confirmation, another execution instruction, or user approval between batches or phases.
The skill merger/retirement plan is a recorded decision artifact, not a pause for approval.

- **Merger/retirement authority**: choose and implement keep/share/merge/retire decisions autonomously after recording
  capability preservation, consumer migration, focused tests, and independent review. Preserve all supported capabilities.
  If equivalence cannot be established, retain the skill and record why; low usage alone never justifies deletion.
- **Behavior corrections**: implement the listed backlog's routing, freshness, initialization, evidence-reuse,
  and equivalent CI/validation corrections without further questions. Keep model assignments, agent roles,
  mandatory review floors, security/governance gates, and artifact schemas unchanged.
- **Rename scope**: prefix all surviving repository skills, including imported Microsoft/community skills,
  exactly once with `apex-`. Preserve attribution, licenses, original upstream identity, and refresh mappings.
  Do not rename externally installed, user-profile, or plugin-owned skills outside this repository.
- **Compatibility decision**: perform a clean rename after migrating repository consumers. Old skill names/paths
  may be removed without duplicate discoverable wrappers. Deliver an old-to-new migration map and breaking-name notice.
  Preserve immutable historical evidence and public npm command aliases; do not create compatibility wrappers by default.
- **Inconclusive candidates**: retain current safe behavior, document a rejected/deferred optimization, and continue.
  That disposition closes the investigation, not a known required defect. Never mark unresolved defects fixed.
- **Execution**: local tests, bounded agent probes, independent subagent reviews, and public dependency/documentation
  access are authorized. Reuse existing tooling/evidence; no paid evaluation service or privileged installation.
  Commit and push verified batches to the existing feature branch with normal hooks. No Azure writes or live deployment.
- **Protected boundaries**: never merge into main, enable auto-merge, force-push, bypass security/permission policy,
  discard user edits, or weaken a required gate to obtain a passing check. Broader optional redesign stays out of scope.

No planned human decisions remain before D04. Continue independently when a candidate can be retained safely or
a local failure can be repaired within scope. If an essential operation is denied/unavailable, requires a secret,
would violate a protected boundary, or user edits make safe progress impossible, preserve work and report the exact
blocker. Complete unrelated unblocked tasks first. This authorization cannot suppress tool/platform permission prompts,
grant credentials, or justify a policy bypass. Do not claim a blocked requirement is complete.

### Autonomous Completion And Tracking

- Maintain A/B/C/D item status and the audit ledger after each verified batch; record evidence-backed retentions.
- Run focused validation immediately after substantive edits, then required full-suite gates and independent review.
  Repair findings within scope and rerun affected checks; do not substitute static tests for runtime evidence claims.
- Continue from Phase A through skill planning, consolidation, renaming, and final checks in the same execution effort.
  A commit, passing batch, completed plan, or progress report is not a reason to stop before A01-D03 are resolved.
- At completion, deliver changed-file/skill summaries, merger/retirement decisions, old-to-new names, validation results,
  any unresolved blockers or accepted limitations, rollback guidance, and the manual-test checklist.
- The autonomous finish state is **ready for user manual testing**, not final output-quality acceptance.
  D04-D05 remain open until the user tests and supplies findings; no invented signoff or automatic production deployment.

### Phase A: Close The Implementation Backlog

Each item ends with a tested fix or an evidence-backed retain/reject decision. Investigations are not presumed bugs.
Use the existing audit ledger for source evidence, decisions, validation results, and any genuine blockers.

- [x] A01 Reconcile old pending entries with completed batches; maintain this as the single current checklist.
- [x] A02 Resolve Requirements' early read prohibition versus its required Phase 3 runbook; preserve elicitation.
- [x] A03 Correct Design skip routing so unmet Governance prerequisites cannot be bypassed.
- [x] A04 Remove Bicep Deploy's remaining script-generation directive; return missing generated output to CodeGen.
- [x] A05 Verify Terraform initialization after provider/module/backend/workspace changes and align validator plan authority.
- [x] A06 Retain compiled Bicep/ARM evidence needed for property and security inspection; do not assume discarded output.
- [x] A07 Verify pricing quantities across environments/regions and reuse only current, equivalent pricing evidence.
- [x] A08 Correct skill research routing: Log Analytics versus ADX, unavailable external skills, and greenfield pricing.
- [x] A09 Reuse unchanged confirmed Azure subscription/region; re-ask on missing or invalidated evidence, not by default.
- [x] A10 Verify Context Optimizer subagent coverage and avoid forced writes/snapshots during read-only audits.
- [x] A11 Correct instruction inaccuracies: provider ranges, Python configuration, Bash/POSIX startup,
      recall-mediated lessons, shared-parser guidance, and actual validator enforcement boundaries.
- [x] A12 Fix artifact-hook template-only coverage and consolidate only demonstrably equivalent overlapping execution.
- [x] A13 Map documentation CI events/paths; remove duplicate work only with required checks and build provenance preserved.
- [x] A14 Reject unknown aggregate validation members without breaking supported script syntax.
- [ ] A15 Run relevant regressions, reconcile the ledger, and publish the verified backlog-closeout batch.

### Phase B: Skill Merger And Retirement Plan

Begin after Phase A is resolved. Manual acceptance does not block this planning stage.
Do not treat the previous inventory's Keep labels as a completed merger/retirement analysis.

- [ ] B01 Refresh the active skill inventory and map discovery triggers, capabilities, consumers, references,
      scripts/templates, provenance, and upstream update mechanisms.
- [ ] B02 Compare semantic overlap and choose per skill: keep, share procedure, merge, or retire.
      Distinguish shared implementation from genuinely equivalent discovery/decision responsibilities.
- [ ] B03 For each proposed merge/retirement, identify the surviving owner/replacement, unique rules to preserve,
      consumer migrations, quality risks, regression scenarios, and rollback procedure.
- [ ] B04 Produce the decision-oriented plan, including justified retentions, unresolved evidence, execution batches,
      and an old-to-surviving-name map that will feed the later prefix migration.
- [ ] B05 Apply the pre-authorized decision policy: select merges/retirements with preserved capabilities and review
  evidence; retain inconclusive candidates. Do not introduce protected behavioral/schema changes
  or pause for routine approval.
- [ ] B06 Implement qualifying merges/retirements and update all live consumers, tests, documentation and generated views.
- [ ] B07 Validate capability/discovery preservation and freeze the surviving skill set before renaming it.

### Phase C: Rename Surviving Skills With apex-

The user requests this phase after the skill merger/retirement work. Prefix every surviving active repository-owned
skill exactly once: for example, `azure-defaults` becomes `apex-azure-defaults`.
This is a naming migration, not permission to change skill behavior, models, review frequency, or output contracts.
External/user-profile/plugin skills outside this repository are not renamed. Preserve imported attribution and licenses.

- [ ] C01 Build the final old-to-new map from Phase B's survivors; check collisions, existing prefixes,
      directory/frontmatter name equality, kebab-case, and the supported skill-name length limit.
- [ ] C02 Inventory name/path consumers before moving files: agents, prompts, skills/references/templates,
      instructions, root/subtree guidance, scripts, tests/fixtures, hooks, CI, setup/export/sync tooling,
      registries, schemas/mappings, context snapshots, and published documentation/downloads where applicable.
- [ ] C03 Apply the clean-rename decision: document breaking skill-name/path changes, the migration map, and upstream
      refresh mappings. Remove old names after migrating live repository consumers; no duplicate discoverable wrappers.
- [ ] C04 Rename surviving skill directories and matching SKILL.md frontmatter names; avoid double-prefixing.
      Preserve scripts, templates, examples, attribution, and relative-reference behavior.
- [ ] C05 Update live references and literal skill invocations, parser/validator assumptions, path globs,
      fixtures, setup/sync consumers, and public documentation to the new names and paths.
- [ ] C06 Regenerate affected inventories/catalogs/Explorer views through their owners. Preserve immutable archives,
      prior execution artifacts, historical changelog entries, and baseline hashes;
      document legacy names rather than rewriting history.
- [ ] C07 Search old names/paths and classify every remaining match as intentional historical/external/compatibility
      evidence or a missed migration. Verify no current required consumer points to a removed path.
- [ ] C08 Run skill discovery, name-directory, reference, model, workflow, schema and tooling tests;
      include fresh/resume/revision cases for both IaC tracks without changing their approval/security contracts.
- [ ] C09 Publish the validated migration and concise old-to-new map with rollback instructions on the feature branch.

### Phase D: Final Verification And User Testing

- [ ] D01 Run the complete automated validation suite and focused negative/recovery tests after all implementation.
- [ ] D02 Obtain independent review of remaining changes; fix findings and rerun affected checks.
- [ ] D03 Reconcile A01-D03 and deliver one manual-test checklist covering native skill discovery,
      fresh/resume/revision workflows, required reviews, both IaC tracks, and validation-only/preview-only boundaries.
- [ ] D04 USER STAGE: user performs manual UI and full generated-output testing after autonomous implementation is complete.
- [ ] D05 POST-TEST STAGE: remediate reported findings, repeat relevant checks, and obtain the user's final quality signoff.

### Boundaries And Non-Goals

All work stays on `perf/apex-workflow-optimization`; never merge into main, auto-merge, or force-push.
Preserve user edits, mandatory independent reviews, policy/security gates, artifact schemas, and both IaC tracks.
Production batching remains rejected on current evidence. Model/role changes, broader tool restrictions,
preview-producer consolidation, and non-safety delegation-policy changes remain separate proposals requiring decisions.
Do not turn optional redesign experiments into silent prerequisites for closeout.
Actual token-savings claims need recorded telemetry; live Azure testing requires a separately resumed authorized phase.

## Scope Correction And Decisions

Historical sections below retain the decisions and evidence available when each batch was recorded.
Their pending/approval wording is superseded by A01-D05 and Autonomous Execution Authorization above.
Published entry separation, caller contracts and tools/root repairs are complete; production batching is rejected.
The remaining implementation investigations are A02-A14, not a restart of those published batches.

On 2026-09-11 the user rejected treating the initial fixes and fleet inventory as completion of the full request.
The workstreams below are the current completion criteria. Earlier completed checkboxes describe delivered batches,
not completion of the semantic audit. Human UI acceptance is not the only remaining task.

Clarification answers:

- Implement proven-equivalent skill/instruction consolidation, including retirement and consumer updates.
  Preserve discovery, applicable scopes, safety rules, and output contracts. Unproven equivalence is not permission.
- Develop concrete proposals for agent roles/handoffs, models/tools, review/validation cadence,
  and CodeGen batching/artifact structure. Behavioral or contract changes still require explicit approval.
- Include workflow-support validators, hooks, registries, and evaluation tooling in the overengineering audit.
  Unrelated application code remains outside scope.
- Prioritize repeated questions/reads/research, long or conflicting instructions, and input-token consumption.
- Retain the feature branch, no-merge rule, security/governance and approval boundaries, and both IaC tracks.
  Live Azure remains deferred; unavailable runtime telemetry does not block local semantic analysis.

### Required Workstreams

1. **Duplication of work and broken workflows**
   Trace questions, research, pricing/module discovery, reads, validation, reviews, and artifact regeneration
   across fresh, resumed, revised, and failure-recovery paths. Identify the producer, consumer, and validity
   conditions for each repeated operation. Separate redundant work from independent assurance and freshness checks.
   Deliver an evidence-backed operation map and fixes that preserve invalidation and ownership boundaries.

2. **Duplicate skills and instructions**
   Compare semantic responsibilities and conflicting rules, not just exact paragraphs or descriptions.
   Inspect referenced procedures/templates and actual consumers. Start with defaults/common/IaC-pattern guidance,
   prepare/validate/deploy responsibilities, and overlapping documentation instructions.
   Deliver keep/trim/merge/retire decisions with scope and discovery examples, preserved unique requirements,
   consumer updates, and focused equivalence checks. Similar names alone do not establish duplication.

3. **Agent optimizations**
   Review every active main agent and subagent for role clarity, repeated reasoning, tool requirements,
   mandatory context, handoff payloads, recovery, and unnecessary procedural constraints.
   Deliver file-specific findings and implemented low-risk improvements, plus concrete approval-gated
   alternatives for roles, handoffs, model assignments, tool exposure, review cadence, and CodeGen batching.

4. **Skill optimizations**
   Review every active skill's discovery description, trigger boundaries, workflow, required reads,
   reference depth, examples, and overlap with agent decisions or file-authoring instructions.
   Deliver a reasoned disposition per skill and focused changes that reduce unnecessary loading or ambiguity
   without making required guidance unreachable. Preserve imported provenance/update paths where applicable.

5. **Instruction and root-guidance optimizations**
   Review every instruction's applicable scope, contradictions, duplicated rules, and appropriate owner.
   Explicitly assess `AGENTS.md`, `.github/copilot-instructions.md`, and relevant nested `AGENTS.md` files.
   Deliver a rule-ownership map separating universal runtime guidance, repository guidance, file-authoring rules,
   and on-demand workflows. Preserve canonical Azure defaults and reachable safety anchors.
   Test representative scope matches; do not infer runtime attachment from authoring `applyTo` patterns.

6. **Overengineering**
   Assess wrappers, indirection, mirrored metadata, sidecars, validation layers, hooks, and evaluation tooling
   by the distinct failure they prevent and the consumers they serve. Include tooling added during this effort.
   Deliver simplification/removal candidates with maintenance benefit, lost-capability analysis, and rollback.
   Do not add a new framework or registry merely to perform this audit, or remove independent checks as duplicates.

7. **Additional improvements and output quality**
   Produce ranked recommendations beyond text reduction: clearer ownership, more actionable errors,
   change-aware reuse, bounded retries, fewer unnecessary interactions, and better artifact consistency.
   Each recommendation needs repository evidence, expected benefit, quality risk, verification, and approval status.
   Distinguish hypotheses from proven fixes, source-size changes from observed context, and tokens from elapsed time.
   Reject changes that lose requirements, security, traceability, artifact completeness, or recovery behavior.

### Execution And Evidence

Use the existing fleet audit as the findings ledger; do not create another inventory or benchmarking framework.
Its historical `Keep` rows establish inventory/ownership only and must not count as completed semantic assessments.
For each reviewed component or related group, record source anchors, consumers, problem or retention rationale,
recommended disposition, expected benefit, risk, focused check, and outcome.
Any unassessed component stays explicitly open; a group decision must justify coverage of each member.

Implement in small related batches, beginning with repeated work and rule ownership, then skill/instruction
consolidation, remaining agent improvements, and support-tool simplification. Obtain approval before implementing
broader behavioral changes. Do not postpone all implementation until the entire audit is finished.

Use scoped tests for equivalent consolidation and local fixes. Substantive prompt changes also require bounded
behavioral/output comparisons for relevant fresh/resume/revision/failure cases and both IaC tracks where affected.
Preserve required reviews and independent quality assessment. Missing evidence stays inconclusive; neither a
passing text test nor a shorter prompt proves unchanged generated-output quality or measured token savings.

Current audit completion gates:

- [x] Complete the operation-duplication map and investigate broken/redundant workflow paths.
- [x] Complete semantic skill/instruction overlap and rule-ownership assessments, including root guidance.
- [x] Give every active agent, skill, and instruction an evidence-backed disposition.
- [x] Complete workflow-support tooling and overengineering assessment.
- [x] Implement and validate scoped improvements; document justified retentions and remaining candidates.
- [x] Deliver ranked broader proposals with concrete alternatives, risks, checks, and user decisions.
- [ ] Review output-quality evidence and record remaining UI/runtime limitations before final signoff.

### Execution Results (2026-09-11)

The [semantic audit ledger](apex-workflow-audit.md#semantic-audit-2026-09-11) contains per-component dispositions,
operation/rule ownership, supporting-tool analysis, rejected draft claims, and ranked proposals.
Coverage includes all active entry-point bodies and targeted controlling references, not every transitive SDK/template.
The user authorized independent read-only subagents; unsupported draft findings were rejected and replacement
reviews were checked against source. No delegated reviewer edited files or performed Azure operations.

Implemented batches:

- Consolidated same-scope site instructions; retained unique template/style/MDX rules and separate source-edit triggers.
  Aligned review prompt and docs-writer references with Starlight title ownership; retained imported skill paths.
- Corrected combined CodeGen validation, obsolete skill digest references, policy-first tags, canonical root/subtree
  ownership, path-only handoff context, and output-scoped As-Built reads while preserving full completion requirements.
- Corrected Terraform test CLI examples, cleanup guidance, external-only ignore_changes, and Storage Entra examples.
- Removed duplicate E2E artifact-validator calls within scoring/affected steps, preserving fields/weights/public aliases.
  Unknown root/delegated npm suites fail closed; missing policy-envelope evidence fails closed in code and guidance.
- Fixed Terraform azd gate bypass, Bicep unknown-change classification, Governance review-cache reuse and early-resume
  routing. Fresh discovery may be reused; stale review evidence still requires reconciliation review.
- Removed latency-derived token claims, fixed create-file overwrite instructions, and deduplicated deployment comparison
  prose. No new orchestration framework, cache key, artifact schema, or production model assignment was introduced.

Additional user decisions during execution:

- **Unattended blockers: approved, implemented.** Production and benchmark runs stop on unresolved must-fix;
  auto-defer, prior accept, and test auto-approval do not prove remediation or authorize forward handoff.
- **CodeGen batching: experiment authorized, adoption withheld.** Resource-free Terraform/Bicep samples generated by
  named agents compiled locally. Existing-file recovery was probed. Baseline was a source-level cadence comparison,
  not a matched generated-output run. Conflicting build checkpoints and over-requested review in one response make
  production adoption inconclusive. Current one-file cadence remains unchanged.
- **Generic/APEX entry separation: recommendation requested, not approval.** Recommended design preserves generic
  preparation proofs while routing APEX through its approved handoffs; validation-only requests stop at validation.
  This behavioral change remains unimplemented pending explicit approval.

Verification evidence:

- Guidance/review suites: 36 passing tests, including actual isolated policy-envelope and review-presence validators.
- Runner graph/CLI suite: 7 passing tests; missing, inherited, empty and delegated-missing suite names fail.
- E2E helpers: 13 passing tests; stubbed execution proves preserved weights and one artifact call per score calculation.
- Named-agent read-only probes: unattended blocker decisions, Terraform azd gate path, Governance cache/freshness,
  and both batching candidates. These are bounded synthetic conformance checks, not graphical/UI or full-output proof.
- Terraform sample: init (no providers/backend), fmt check and validate pass.
  Bicep sample: build, build-params and lint pass.
- Independent changed-file review found stale policy pseudocode, early-resume review bypass, and a retired-file link;
  all were repaired and focused tests rerun.
- Initial full gate: 54 passed, one stale tag-count text assertion failed. Updated to require keys/values/casing;
  focused governance guardrails then passed. Final `npm run validate:all`: **55 passed, zero failed**,
  including external checks and the site build/link check. Log: `tmp/apex-optimization/reopened-full-validation-final.log`.
- Independent re-review confirmed all three findings resolved. Offline added-link checks found no missing targets;
  selected regression tests passed. Runtime UI and external-link/anchor behavior were not certified by that review.

This first batch was published as `5375b7bb`. Subsequent user approval and implementation are recorded below.
No measured token savings or complete generated-output quality equivalence is claimed.

### Second Batch (Approved Items 1, 2, 3)

The user explicitly approved local defect/duplication fixes, generic/APEX entry separation, and the stronger
batching experiment. See the [second-batch evidence](apex-workflow-audit.md#second-batch-local-fixes-entry-separation-and-matched-trial).

- [x] Remove duplicate aggregate handoff validation while retaining full and standalone checks.
- [x] Fix the pre-commit block test and normalize the blocking shell test setup line endings.
- [x] Align Diagnose report writing and Challenger type/path/field/return contracts with current producers and schemas.
- [x] Consolidate CodeGen build checkpoints and clarify incomplete-scaffold/partial-write recovery.
- [x] Separate APEX handoffs from generic plan/proof workflows, including recipe and recovery consumers.
- [x] Stop validation-only and preview-only without preparing, deploying, or claiming Step 6 completion.
- [x] Execute matched AVM-backed baseline/candidate samples, mocked plans, and injected validation failures.
- [x] Reject batching adoption on inconsistent cadence/recovery evidence; production cadence remains unchanged.
- [x] Repair independent-review findings and rerun focused checks.
- [x] Finish final full validation; publish through normal feature-branch hooks.

Final gate: `npm run validate:all` passed with **54 checks, zero failures**, including external validation
and site build/link checks. The lower count removes the redundant handoff subset; the full agent validator
still runs those rules. Log: `tmp/apex-optimization/second-full-final.log`.
Independent focused re-review found no unresolved introduced defects after repairs; it did not certify
live agent behavior or deployment. Hook configuration tests passed separately (three tests).

The matched trial is stronger than the earlier resource-free probe but still bounded: actual model output with
frozen AVM versions, local compilation and mocked plans, not full artifacts or deployed behavior.
Baseline Bicep violated single-file cadence, and candidate recovery prose recommended discarding partial files.
Both modes compiled, needed Terraform formatting, and rejected identical injected output errors. Parent performed
minimal repairs and verified passing builds. These results do not justify production batching or savings claims.

Remaining beyond this batch: human UI/full-output acceptance, model/tool experiments and other explicitly ranked
audit follow-ups. Entry separation is no longer awaiting approval. Batching experimentation is complete for this
bounded trial, with adoption rejected pending different evidence rather than more favorable reruns.

## Revised Scope And Verification

### Tools And Root Extension

User approved the full tools/root lifecycle check and confirmed local residue cleanup. Public npm aliases,
native prompt entrypoints, active environments, security configuration, legal/history files, and artifact contracts remain.
The [tools/root ledger](apex-workflow-audit.md#tools-and-root-lifecycle-audit) records folder, registry, schema and
every tracked root-file disposition. No tracked root/schema/registry file was proven dead; no speculative deletion occurred.

- Removed approximately 142 MB of ignored retired pricing-server environment/cache residue after a dry run and process check.
- Repaired JSONC string/prototype handling using a directly declared parser; strict JSON stays strict.
- Corrected lint failures, ignored-aware link selection with checked Git status, and fail-closed version validation.
- Included both recall test roots in isolated processes and corrected retirement ownership/test classification.
- Consolidated resume entrypoints into Orchestrator recovery; expanded native/nested prompt validation, Explorer,
  registry and snapshot coverage, including collision and historical-incomplete-baseline guards.
- Corrected root workflow, historical quality and version-automation claims without rewriting historical records.
- Preserved the existing jsonc-parser public URL/SHA-512 entry; offline dependency registration avoided relaxing
  a remote package-source restriction. No remote package policy was bypassed.

Independent-review findings were repaired. Final `npm run validate:all` passed: **54 checks, zero failures**,
including expanded prompt coverage, both isolated recall suites, and site build/internal-link checks.
Log: `tmp/apex-optimization/root-final-gate.log`. Focused fixtures cover parser security, lint/selector failures,
registry/version failures, prompt identity collisions, and historical snapshot completeness.
External URL availability and graphical slash-menu behavior were not validated; local added links were checked offline.
Publish through normal commit/pre-push hooks on the existing feature branch only.
The committed-source inventory is pinned to `9128ea94`; it does not pretend to include this uncommitted batch.

The user replaced the earlier benchmark-led campaign with workflow-first improvement:

- Optimize normal VS Code Orchestrator use and handoff buttons, including fresh and resumed chats.
- Retain the validated correctness fixes and continue on the existing feature branch.
- Accept low-risk deduplication and local corrections through focused contract tests and review.
- Reserve measured workflow trials for reasoning, model, or substantive behavioral changes.
- Defer live Azure validation to a separate phase. Old infrastructure blockers below are historical context.
- Recommend broader changes to review frequency, agent roles, or artifact contracts only for explicit approval.
- Keep the full semantic audit in scope; an inventory alone does not prove workflow effectiveness.

### Local implementation closeout

The initial batches made targeted changes across these surfaces but did not finish the requested semantic audit.
The table records delivered improvements, not exhaustive coverage or proof that remaining components need no changes.
No runtime tool-schema savings or generated-output quality equivalence is claimed.

| Area                    | Implemented outcome                                                                                       | Verification / retained boundary                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Duplication of work     | Reuse current reviews, recovered answers, and phase inputs; batch independent finding questions           | Distinct per-finding choices, rerun stale reviews, approval remains explicit              |
| Broken workflows        | Shared Step 4 routing, correct resume fields, cost review ordering, deep Plan filenames                   | Graph/handoff tests and actual recall transition tests                                    |
| Agent tools             | Remove unrelated explicit notebook entries; remove explicit refactoring from non-code roles               | Relevant execution/read/edit/discovery tools retained; broad group expansion not measured |
| Terraform discovery     | Replace retired MCP calls with Registry metadata and pinned provider schema checks                        | Exact approved module pins retained by CodeGen; failed lookup is not proof of no AVM      |
| Skills                  | One routing procedure, correct DAG references, phase-scoped loading                                       | Single-tier discovery and required references retained                                    |
| Instructions/root files | Current-phase prerequisites, safe cache invalidation, clear canonical ownership                           | Security, review, and artifact contracts unchanged                                        |
| Overengineering         | Remove unnecessary tool entries, repeated routing/rationale, and non-owned template reads                 | No new orchestration framework, new model policy, or new artifact schema                  |
| Input context           | Avoid forced question restart and missing-input bulk reads; compaction permits required deferred guidance | Source changes and intended call reductions only; no measured token claim                 |
| As-Built resume         | Re-query IDs/state/SKUs on new-chat resume; compare current handoff/source before reusing inventory       | Live drift checks retained; missing evidence cannot mark inventory current                |

### Approval-dependent proposals

These initial candidates need concrete evidence-backed proposals, not just a deferred label.
Proven-equivalent consolidation is now authorized; broader behavioral changes remain approval-gated:

| Proposal                                                               | Reason / evidence                                                    | Decision needed                                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Make unattended review dispositions fail closed on unresolved blockers | Canonical adversarial-review protocol auto-defers and auto-proceeds  | Agree benchmark-only versus production semantics before changing that protocol          |
| Reconsider forced one-file-per-turn CodeGen cadence                    | Both CodeGen agents mandate it independently of file size            | Approve a bounded batching experiment with build/repair evidence                        |
| Consolidate overlapping documentation style instructions               | Site formatting and doc-maintenance triggers have different scopes   | Prove scope equivalence before retiring files; keep triggers active on code/agent edits |
| Narrow broad Azure/Bicep/VS Code tool groups                           | Explicit irrelevant tools removed, but groups may expand dynamically | Observe actual schema attachment and tool use before removing required capability       |
| Revisit models, roles, or review frequency                             | Potential efficiency gain is not proven by a static inventory        | Separate approval and matched reasoning/output evaluation                               |

The final human acceptance review should observe fresh capture, resumed questioning,
missing predecessor, Design skip, revision, deep review, both IaC tracks, and changed-input recovery.
Do not replace this observation with the current development-session transcript or label fixture results as model behavior.

### First batch: routing, reviews, and phase-aware inputs

- **Fixed**: workflow skill and DAG reference now match the unified planner, separate refinement returns,
  actual recall response fields, and Design/Governance resume disambiguation.
- **Fixed**: remove the duplicated routing procedure; preserve its existing heading as an anchor.
- **Fixed**: orchestrator uses handoffs rather than contradictory direct-execution instructions.
  Depth is opt-in, Plan review stays mandatory, separate cost review stays required,
  and valid specialist reviews are not repeated solely on return to the orchestrator.
- **Fixed**: preserve mandatory accepted-gate `/clear` behavior; remove conflicting context-percentage exemptions.
  Artifact numbering cannot establish completion or human approval on recovery.
- **Fixed**: shared guidance reads only current-phase prerequisites, refreshes changed or lost context,
  and does not claim that file-authoring `applyTo` proves runtime attachment.
- **Fixed**: root instructions distinguish recalled inventory from artifact content and clarify both Step 2 reviews.
- **Intentional repetition retained**: validation cheat sheet, critical stop rules, handoff buttons,
  output contracts, and human approval boundaries remain accessible without optional reference chains.
- **Deferred for approval/evidence**: review-count changes, agent mergers, model changes, and artifact redesign.

Focused tests protect these prompt contracts and reference the real graph. They are static/structural checks,
not a simulated claim that the VS Code model followed every instruction.
The next manual/runtime walkthrough covers new project, optional Design skip, both IaC tracks,
return for revision, missing/stale review, and resumed chat with incomplete state.

Before/after source bytes relative to `fd443339` (not runtime token counts):

| Source                 | Before | After | Removed |
| ---------------------- | -----: | ----: | ------: |
| Orchestrator           |  37542 | 35013 |    2529 |
| Workflow skill         |   6095 |  5961 |     134 |
| Shared operating frame |   5391 |  4773 |     618 |
| Copilot instructions   |   8146 |  8373 |    -227 |
| AGENTS.md              |   7517 |  7460 |      57 |

The small root-guidance increase preserves freshness and approval safeguards.
No files or roles were retired and the workflow graph, models, and output schemas are unchanged in this batch.

Verification on 2026-09-10: focused routing/review and phase-reading contracts passed,
as did `validate:agents`, `validate:skills`, `validate:instruction-checks`, vendor/model/handoff checks,
the tooling contract suite, relative-link checks, and the full `npm run validate:all` gate.
Logs are under `tmp/apex-optimization/revised-*.log`. The documented VS Code walkthrough remains pending.

### Second batch: specialist gate ownership and loading

- **Fixed**: the Architect's gate reference no longer skips cost review below a budget threshold.
  Both default/deep modes retain the independent cost-estimate review; old skip decisions are not exemptions.
- **Fixed**: Architect checkpoint guidance puts generated artifacts before reviews and final approval.
  Legacy checkpoint names remain recoverable hints, not proof of completion. SKU/budget approval alone is insufficient.
- **Fixed**: Architect finding decisions use the existing canonical batched panel, one question per finding,
  preserving action choices, rationales, panel cap, decisions sidecar, and final proceed/revise gate.
  This removes the conflicting separate-tool-call-per-finding instruction, not independent user decisions.
- **Fixed**: Planner checks inputs before bulk reading and no longer loads Governance's output template.
  Diagrams, consistency checks, design questions, and drift routing load when their phases require them.
  Cost controls, policy/security constraints, and AVM pin checks remain mandatory before plan authoring.
- **Fixed**: both CodeGen tracks check predecessor existence first and obtain SKUs from the manifest.
  Architecture rationale is read selectively when missing from approved inputs; readiness/L0 checks remain mandatory.
- **Intentional**: Governance's freshness/signature resume checks and Deploy's hash checks are preserved.
  No blanket cache shortcut is added to deployment or security validation.

### Source-level scenario walkthrough

This table records inspected prompt paths and executable structural tests, not live model observations.

| Scenario                | Source path / expected behavior                                                              | Evidence level              |
| ----------------------- | -------------------------------------------------------------------------------------------- | --------------------------- |
| New project             | Requirements retains initial questioning and its limited session-state exception             | Source inspection           |
| Missing predecessor     | Architect/Planner/CodeGen return to the owner before bulk skill reads                        | Contract regressions        |
| Optional Design         | Diagram and ADR skills load only for selected scope; governance routing remains in graph     | Source/graph checks         |
| Resume Architecture     | Check artifacts and both reviews; checkpoint is not approval and current pricing is reusable | Contract regressions        |
| Revise findings         | Canonical separate questions, persisted dispositions, relevant re-review before proceeding   | Contract regressions        |
| Default/deep review     | Independent cost review always required; architecture deep cascade remains separate          | Contract/runtime gate tests |
| Bicep/Terraform CodeGen | Same input-first and manifest policy, with track-specific validation retained                | Paired contract regressions |
| Resume Governance       | Signature/TTL/status checks control reuse; explicit refresh disables shortcut                | Source inspection           |
| Deploy changed code     | Recomputed tree hash and fresh preview prevent stale approval reuse                          | Source inspection           |
| As-Built resume         | Phase checkpoint and live SKU drift checks remain; inventory is loaded on demand             | Source inspection           |

Remaining runtime task: observe these paths in actual VS Code fresh/resume/revision conversations.
No Azure deployment, model switch, new benchmark framework, or output-schema change was needed for this batch.
Structural tests cannot prove whether a model follows the instruction or quantify token savings.

Second-batch verification on 2026-09-10: focused specialist contracts, the tooling test suite,
agent/skill/vendor/model checks, Markdown lint, relative-link checks, and `npm run validate:all` passed.
The gate reference's decision-key link was also corrected. Logs: `tmp/apex-optimization/specialist-*.log`.

### Follow-up findings requiring separate decisions

- The canonical decision protocol's unattended mode auto-defers findings and auto-proceeds.
  That is not proof of resolved security/governance blockers. Reconcile test-mode policy explicitly before unattended trials.
- Requirements' one-shot workflow and fresh-start handoff are deliberately strict; changes to questioning frequency
  need a scenario walkthrough and approval rather than merely deleting the mandatory phases.
- As-Built's wording about completed inventory should be checked against changed deployed state on resume.
  Do not infer freshness from a checkpoint alone or remove its live drift checks.

## Objective

Audit duplication of work, broken workflows, agents, skills, instructions,
root Copilot guidance, overengineering, and input-token consumption.
Prioritize reliability and output quality, then tokens/cost and active runtime,
then maintenance simplicity. Retain the complete audit scope while limiting
the first implementation wave to confirmed fixes and a small measured candidate batch.

## Fixed Contracts

- Preserve production human approval gates, governance/security, required reviews, and both IaC tracks.
- For isolated benchmarks only, the user authorizes explicitly logged automated test approvals.
  These do not approve unresolved blockers, changed requirements, or final generated-output quality.
- Preserve generated artifact filenames, required schemas, completeness, and operational usefulness.
- Keep architecture and independent cost-estimate reviews mandatory at Step 2.
- Reuse existing generic review sidecars; do not add a cost-specific artifact schema.
- Preserve historical session records. On resume, missing current review evidence blocks advancement.
- Keep canonical Azure defaults in the existing Copilot instruction source.
- Do not merge agents, change models, or introduce a new orchestration/caching framework in the first wave.

## Runtime Comparison Design (When Needed)

- **A**: original workflow, diagnostic only where known defects make live use unsafe.
- **B**: correctness-fixed, unoptimized control. Report A-to-B correctness overhead separately.
- **C**: B plus one optimization, with separately attributable candidate revisions.
- Use identical collectors, frozen inputs, actual model/tool/runtime metadata, and matched review policies.
- Counterbalance pair order where possible. Never pool tracks to hide a regressed track.
- Do not seed evaluated agents with completed reference outputs or tune against held-out results.
- For substantive behavior changes, agree the pilot and confirmation volume before execution.
- Include an untuned non-AKS holdout and deterministic resume, compaction, revision, stale-review,
  changed-policy, failed-validation, and recovery cases.
- The former universal 15% threshold is retired. Local fixes do not require live token measurements.
  Report any measured savings with complete scope, including subagents and retries, and uncertainty.
- Treat noisy or incomplete comparisons as inconclusive. Do not rerun indefinitely for a favorable result.
- Escalate measured cost or active-runtime regressions beyond trial noise for explicit user approval.
- Independent evidence-backed review and user signoff are required before accepting optimization results.

## Quality Rubric

Freeze scenario-specific expected decisions and evidence before candidate generation.
The user authorized autonomous freezing of these criteria before candidate testing.
Reference reconciliation and the held-out scenario are recorded below; unresolved contradictions fail closed.

| Dimension           | Required evidence                                                                     |
| ------------------- | ------------------------------------------------------------------------------------- |
| Requirements        | Explicit requirements and exclusions trace through approved decisions into code       |
| Governance/security | Current constraints and security checks pass; no unresolved blocking findings         |
| Reviews/approvals   | Required artifact-specific reviews, dispositions, and human gates are present         |
| Pricing/SKUs        | Verifiable source, assumptions, budget comparison, and manifest-to-code consistency   |
| IaC behavior        | Compile/validate, deployment evidence where authorized, smoke checks, and idempotence |
| Documentation       | Complete artifacts, consistent final state, actionable operations and DR procedures   |

Existing benchmark keyword and file-presence scores are coverage diagnostics only.
A composite score cannot compensate for a failed hard check or quality dimension.
Presence/parseability checks in `complete-step` do not replace schema, freshness,
finding-disposition validation, or human approval. Deep-review pass 1 is the
presence floor; conditional later-pass requirements remain owned by the review protocol.

## Deferred Azure Boundaries

These limits apply only if the separate live-validation phase is resumed; no Azure work is needed for this batch.

- Subscription alias: `apex-shared`; verify the exact subscription ID before live operations.
- Create `rg-apex-test`; allow only the dedicated AKS-managed `rg-apex-test-aks-nodes` exception.
- AKS creates its node RG. Do not pre-create or adopt an existing managed RG.
- Stop if either RG unexpectedly exists. Run clusters sequentially and verify cleanup before reuse.
- Other RG writes and subscription-level configuration changes remain prohibited.
- Subscription-level prerequisites incompatible with this boundary block live parity; do not omit them silently.
- USD700 planned trial consumption plus USD300 uncertainty/cleanup reserve; USD1,000 total ceiling.
- Count both RGs, all trials/retries, prior accrued usage, delayed charges, and cleanup overhead.
- The user explicitly replaced the attended-only, 12-hour, and independent-watchdog requirements with manual cleanup.
- Jonathan Vella will delete the RG when available. The agent may create/delete test resources within approved RGs.
- Delete disposable resources after each run when possible; record leftovers and accrued cost for manual cleanup.
- Resource-group-scoped cleanup role assignments are allowed when required; no subscription-wide permissions.
- Azure billing and deletion are asynchronous; budget alerts and chat reminders do not guarantee a hard cap.
- Unattended runs are authorized; scope and cost preflight remain mandatory. No automatic expansion of scope.

## Progress

- [x] Verify clean worktree and create the dedicated implementation branch.
- [x] Pin original source and curated AKS reference revisions.
- [x] Fix and test snapshot/diff root, source coverage, hashes, provenance, and missing-input failures.
- [x] Archive original A source and capture verified context before workflow behavior changes.
- [x] Correct null-aware aggregation, phase coverage, path resolution, and per-metric sample sizes.
- [x] Propagate Terraform validation failures and test multi-project outcomes without real providers.
- [x] Enforce both Step 2 review sidecars in runtime and CI, including deep-review filenames.
- [x] Align graph/handoff contracts and make exhausted governance retries block E2E continuation.
- [x] Pass focused regressions and the full `npm run validate:all` repository gate.
- [x] Finish static fleet ownership/duplication inventory using existing tools; retain runtime judgments as unverified.
- [x] Repair range/context-aware duplicate-read analysis and expose incomplete profiler token coverage.
- [x] Inspect pinned reference requirements/code/handoff, freeze criteria, and select the untuned holdout.
- [x] Apply the first routing, review-reuse, phase-input, and root-guidance improvement batch.
- [x] Validate focused prompt contracts without altering workflow topology, review frequency, or artifact schemas.
- [x] Complete source-level scenario walkthrough and executable recall/handoff regression checks.
- [x] Audit remaining phase loads, duplicated decisions, tool declarations, and retired discovery calls.
- [x] Present broader simplifications with evidence and approval boundaries before implementation.
- [x] Align default/deep Plan sidecar presence in runtime and CI without rewriting legacy history.
- [x] Execute bounded custom-agent fresh/resume/revision and failure-decision probes; fix and retest exposed defects.
- [ ] Human acceptance: observe VS Code handoff UI and full generated-output quality; headless probes do not certify these.
- [ ] Collect production-equivalent traces for future performance claims; not a local-fix prerequisite.
- [ ] Run live comparisons only in a separately resumed deployment-validation phase.
- [ ] Obtain final quality signoff; document accepted, rejected, and inconclusive experiments.

## Evidence Locations

- Original source archive: `tmp/apex-optimization/A-source-8369663.tar`.
- Archive SHA-256: `092e23a888fb7ad2525d0c4d0e3e43ec7901b9882d56780641812bc85dfe34a8`.
- Context snapshot: `agent-output/_baselines/apex-opt-A-8369663/`.
- Snapshot `SHA256SUMS` covers copied context files; manifest records full base SHA and working-tree provenance.
- The A context snapshot follows capture-tool repair but precedes agent/runtime behavior edits.
- `worktree.patch` records tracked changes, while context copies include new files within declared targets.
- Full-source archives are needed to preserve untracked files outside those targets; snapshots are not full backups.
- Check logs: `tmp/apex-optimization/`; measurement report: `tmp/workflow-baseline.{json,md}`.
- Initial B source checkpoint: `tmp/apex-optimization/B-source-initial.tar` and adjacent SHA-256 checksum file.
- B context checkpoint: `agent-output/_baselines/apex-opt-B-initial/`.
- These B checkpoints preserve initial correctness changes, not measured quality or performance equivalence.
- Local archives/logs are ignored operational evidence, not committed generated artifacts.

## Verification

Focused executable checks:

```bash
node --test tools/tests/scripts/test_context_baseline.mjs
node --test tools/tests/scripts/test_workflow_measurement.mjs
node --test tools/tests/scripts/test_terraform_validation.mjs
node --test tools/tests/scripts/test_review_presence.mjs
node --test tools/tests/scripts/test_context_redundancy.mjs
python3 -m pytest tools/tests/scripts/test_profile_debug_log.py -q -p no:cacheprovider
python3 -m pytest tools/apex-recall/tests/test_transition.py tools/apex-recall/tests/test_complete_step_hint.py -q
npm run validate:workflow-graph
npm run lint:workflow-handoffs
npm run test:workflow-handoffs
npm run validate:agents
npm run lint:vendor-prompting
npm run validate:model-consistency
```

Use the existing full validation suite and hooks before integration; record unrelated baseline failures separately.
Artifact Markdown validation remains owned by the existing hooks/challenger workflow.
No savings, live equivalence, or production-readiness claim follows merely from these local checks passing.

## Initial Verification Results

On 2026-09-10, `npm run validate:all` passed, including the Node and external suites.
Focused snapshot, telemetry, Terraform-command, review-presence, graph/handoff,
agent, model, formatting, and syntax checks passed. Each recall test root also passed
in its own Python process. Combining those roots in one process exposes existing
module/environment isolation assumptions, so use separate invocations.

Full validation initially detected generated pytest-cache READMEs because the
Markdown ignore matched only the repository-root cache. The ignore now covers
nested standard caches; the unchanged documentation rules pass.

The independent source review questioned blocking cost-only Step 2 completion.
That suggestion was rejected: the approved contract requires both architecture
and cost reviews, and regression tests intentionally enforce this invariant.
The stricter dry-run harness remains diagnostic; it must not supply unmatched
production-equivalence measurements.

No real workflow token records were available to the measurement collector.
No candidate optimization, Azure resource creation, or live-baseline run has been accepted or performed.

## Final Local Verification

### Bounded custom-agent runtime evidence

After static verification, the installed named custom agents were invoked through
`runSubagent` in isolated read-only probes. These are actual model executions,
not regex tests. They do not reproduce the VS Code handoff-button UI or certify
complete generated artifacts. Synthetic decision snapshots are labeled below;
no snapshot was written as real session state and no cloud deployment was performed.
Requested agent definitions were selected by name; effective model tier and input-token
usage were not independently attested, so no cross-runtime performance claim is made.

| Agent / probe                                                                 | Observed outcome                                                                            | Corrective action and retest                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Architect, missing requirements                                               | Stopped before skill/template stack or pricing, identified Requirements owner               | No correction needed; read-only missing-path search                                                                   |
| Planner, missing predecessors                                                 | Initially chose Governance before absent Architecture                                       | Exact owning handoff precedence added; rerun selected `03-Architect` first                                            |
| Bicep/Terraform CodeGen, missing plan                                         | Stopped safely but used filename-style Planner name; Terraform blurred governance ownership | Exact `05-IaC Planner` target and `04g-Governance` ownership added; both reruns correct                               |
| Orchestrator, Design skipped                                                  | Selected Governance next; no Plan advancement before governance approval                    | Synthetic routing response; no state mutation                                                                         |
| Orchestrator, approved Terraform Plan                                         | Selected Terraform CodeGen without repeating valid Plan review                              | Synthetic approved-input response; no actual handoff-button execution                                                 |
| Orchestrator, missing cost review / changed SKU                               | Blocked approval and required missing or refreshed cost evidence                            | Synthetic default/revision responses; cost review remains independent                                                 |
| Requirements, fresh / incomplete resume                                       | Preserved fresh questioning, asked only missing SLA/RTO/RPO on resume                       | No user prompts executed; next-action reasoning probe                                                                 |
| Requirements, budget-only revision                                            | Initially proposed a manifest budget edit                                                   | Explicit schema/pin preservation added; rerun left manifest unchanged and required re-review                          |
| Governance, valid cache / explicit refresh                                    | Reused eligible evidence only before approval; explicit refresh disabled reuse              | Synthetic decision probe                                                                                              |
| Governance, expired envelope                                                  | Identified conflict between mandatory TTL freshness and cache-first instructions            | Script now rejects expired/missing/invalid TTL metadata; all agent/reference paths force live refresh on expiry/drift |
| Governance expiry retest                                                      | Selected Phase 1 with `--refresh`, bypassed baseline/cache, rejected stale confirmations    | Final probe read agent and resume reference; no Azure calls                                                           |
| Terraform Deploy, changed hash / destruction / stale policy / exhausted retry | Refused apply and named remediation/approval evidence                                       | Synthetic negative deployment decisions, not provider validation                                                      |
| As-Built, stale inventory / changed SKU / missing summary / lost rationale    | Required live evidence, blocked unsupported completion, recovered rationale from source     | Synthetic decision probe; no inventory or manifest writes                                                             |

The negative prerequisite probes used only read-only path/state lookups and reported no
writes or external calls. Workspace checks found no `opt-probe-*` project directories.
Probe findings were fixed in the owning instructions and regression tests, then re-probed.
The full artifact-generation workflow and the graphical agent picker were not exercised.
Those remain explicit checks for human UI/output acceptance, not inferred passes.

The governance expiry fix is covered by mocked script tests for fresh cache reuse,
explicit refresh, stale/missing/invalid/future-dated metadata, and invalid TTL values.
No live Azure calls occur in these tests. Existing unrelated Ruff findings in the
discovery files were compared against the committed baseline; no new findings were introduced.

After the probe-driven repairs, all governance script tests passed and the full
`npm run validate:all` gate passed. The Governance body was shortened without removing
refresh rules to satisfy its existing context budget. Evidence logs:
`tmp/apex-optimization/probe-governance-suite.log`, `probe-discovery-tests.log`, and
`probe-validate-all-final.log`; model responses are recorded in this chat's named-agent tool results.

The broader proposals above remain recommendations requiring approval; no reviewer-count,
model, artifact-schema, or output-cadence change is implied by these tests.

The final local scenario suite passed: tooling contracts, workflow handoff fixtures,
and separate package/public recall tests. New tests cover Requirements fresh/resume
guidance, exact Terraform pins, tool declarations, compaction guidance availability,
As-Built inventory recovery, and default/deep Plan completion with no partial state writes.
On 2026-09-10, `npm run validate:all` passed (Node and external suites).
The local tooling suite passed, as did handoff fixtures and both recall test roots
run in separate processes. ESLint, Ruff, Markdown, and changed-file diagnostics were clean.
Logs: `tmp/apex-optimization/closure-*.log`.

This final correctness pass adds explicit recovery/pinning safeguards as well as removing
unrelated tool entries. The edited agent sources are 1,650 bytes larger in aggregate
than the preceding commit; no aggregate source reduction or token saving is claimed.
The value is fewer contradictory paths and unnecessary operations, verified only to the stated test level.

The independent reviewer correctly identified that prompt tests do not prove live model behavior.
That limitation is retained. As-Built checks were made explicit, while the Requirements
recovery path already named bounded artifact reads. No fictitious tool execution or savings evidence is added.

Local implementation is not blocked by the old Azure campaign limits. Bounded headless
custom-agent probes now provide the runtime evidence above. Production-equivalent UI
observation and full artifact-quality acceptance remain unperformed. The blocked CLI
installation was not retried or bypassed; probes used the already available subagent tool.

## Autonomous Continuation Results

The latest user decisions supersede the original attendance/timeout rules: unattended resource creation is allowed,
manual RG cleanup replaces the watchdog and 12-hour cap, benchmark-only test approvals are allowed,
the rubric may be frozen autonomously, and rejected/noisy candidates are deferred without extra trials.
Commit and push only this feature branch. Never merge into main, enable auto-merge, or force-push.

The [fleet audit](apex-workflow-audit.md) covers active agents, skills, instructions, and root guidance.
It records exact paragraph overlaps and per-file dispositions; it does not infer runtime savings from bytes.
The existing baseline retirement census also completed with full tracked-file coverage.
Unsupported independent audit suggestions were rejected, including oversized operating-frame claims,
assumed runtime attachment, removal of documentation triggers, and dropping live preview cost-change analysis.

The redundancy analyzer now traverses all resource/scope groups, recognizes qualified read-tool names,
deduplicates repeated span exports, and treats missing context/range/timing/result evidence as advisory.
Only same-range, same-result reads under a known chat request with observed ordering can fail the heavy-read check.
Intervening writes and session/compaction events invalidate comparisons. External edits or omitted events remain limits.
The profiler separately reports observed token coverage and excludes absent usage from averages.
Repeated exported spans no longer inflate token totals; unobserved child calls and billing data are not invented.

## Frozen Scenario Criteria

- **AKS reference case**: preserve the pinned final platform's security and operational capability,
  including Defender, private data services, identity/RBAC, manifests, pricing, and as-built consistency.
  Do not give evaluated agents the finished IaC. Verify requirements against approved revisions before generation.
- **Small comparison case**: a single application with managed-identity access to private Blob storage,
  centralized diagnostics, no public data-plane access, and explicit low-cost development requirements.
  Instantiate equivalent functional inputs for Bicep and Terraform, not identical module names.
- **Untuned holdout**: a queued document-processing service with separate ingest/worker identities,
  private storage, poison-message handling, explicit retry limits, recovery procedures, and no AKS requirement.
  Do not use holdout output to revise candidate prompts. Regeneration after seeing failures is a new experiment.
- **Failure cases**: missing/invalid cost review, explicit deep review, interrupted transition,
  changed input after review, incomplete governance, failed init/validate, and stale cached evidence.
- Freeze full input payloads and hashes before executing matched trials. These scenario definitions
  do not claim that generation runs, live checks, or statistical confirmation have happened.

## Reference And Environment Blockers

Read-only preflight verified `apex-shared` is enabled and both approved RG names were absent.
The approved subscription identifier was verified locally; no credentials are persisted in this report.
Azure MCP startup failed with exit code 1, so read-only CLI checks were used instead.

At pinned reference commit `bb7ae9021a0fc59d10d129710a8a260b573d9dcc`:

- `infra/bicep/apex-aks/main.bicep` is subscription-scoped and calls subscription-level security/cost modules.
- `modules/security.bicep` configures Standard Defender for Containers, Storage, and relational databases.
- Live read-only preflight found `Containers`, `StorageAccounts`, and `OpenSourceRelationalDatabases` at `Free`.
- Enabling those reference-required plans violates the retained subscription-write prohibition.
  Merely omitting the modules would not meet the minimum curated quality floor. Live parity is blocked.
- Requirements explicitly exclude App Gateway and call for Traefik, while final IaC invokes an edge/App Gateway module.
  The handoff retains historical failure entries alongside final success. These are reconciliation test cases,
  not evidence that current requirements can silently be overridden or that the final deployment failed.
- The pinned reference contains Bicep, not a Terraform oracle. Terraform comparison must use functional requirements.

Local log search found this development session's debug data, not completed production-equivalent baseline runs.
The installed Copilot launcher reports that GitHub Copilot CLI cannot be found.
The environment explicitly blocked temporary execution of the official CLI package; the action was not retried.
Current CLI access therefore cannot establish fresh matched production-agent runs or measured token savings.
Static estimates and this audit session are not substitutes. Candidate trimming, model changes, and agent mergers
remain unaccepted rather than being applied without the agreed evidence.

No campaign resources were created, so there is no campaign-generated Azure consumption or cleanup inventory.
The existing subscription budget is not this campaign's ledger and was not modified.
Full completion is not claimed: live parity requires a scope decision, and token experiments require a usable
comparable execution/telemetry path. These are concrete blockers in addition to final human quality signoff.
