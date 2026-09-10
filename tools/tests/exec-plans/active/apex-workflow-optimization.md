# APEX Workflow Optimization

## Status

**State**: Revised workflow plan active; routing and specialist guidance batches implemented
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

## Revised Scope And Verification

The user replaced the earlier benchmark-led campaign with workflow-first improvement:

- Optimize normal VS Code Orchestrator use and handoff buttons, including fresh and resumed chats.
- Retain the validated correctness fixes and continue on the existing feature branch.
- Accept low-risk deduplication and local corrections through focused contract tests and review.
- Reserve measured workflow trials for reasoning, model, or substantive behavioral changes.
- Defer live Azure validation to a separate phase. Old infrastructure blockers below are historical context.
- Recommend broader changes to review frequency, agent roles, or artifact contracts only for explicit approval.
- Keep the full semantic audit in scope; an inventory alone does not prove workflow effectiveness.

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

| Scenario | Source path / expected behavior | Evidence level |
| --- | --- | --- |
| New project | Requirements retains initial questioning and its limited session-state exception | Source inspection |
| Missing predecessor | Architect/Planner/CodeGen return to the owner before bulk skill reads | Contract regressions |
| Optional Design | Diagram and ADR skills load only for selected scope; governance routing remains in graph | Source/graph checks |
| Resume Architecture | Check artifacts and both reviews; checkpoint is not approval and current pricing is reusable | Contract regressions |
| Revise findings | Canonical separate questions, persisted dispositions, relevant re-review before proceeding | Contract regressions |
| Default/deep review | Independent cost review always required; architecture deep cascade remains separate | Contract/runtime gate tests |
| Bicep/Terraform CodeGen | Same input-first and manifest policy, with track-specific validation retained | Paired contract regressions |
| Resume Governance | Signature/TTL/status checks control reuse; explicit refresh disables shortcut | Source inspection |
| Deploy changed code | Recomputed tree hash and fresh preview prevent stale approval reuse | Source inspection |
| As-Built resume | Phase checkpoint and live SKU drift checks remain; inventory is loaded on demand | Source inspection |

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
- [ ] Walk through revised prompts in VS Code for fresh/resume/revision scenarios; report behavioral evidence separately.
- [ ] Continue semantic audit of remaining phase loads and duplicated decisions in specialist agents.
- [ ] Present broader simplifications with evidence and approval boundaries before implementation.
- [ ] Collect production-equivalent traces only where the proposed change requires runtime evidence.
- [ ] Run live comparisons in the separate deployment-validation phase, subject to approved scope.
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
