# APEX Workflow Optimization

## Status

**State**: Stabilization implemented and verified offline; native acceptance and FreshConnect owner gate remain open
**Owner**: Jonathan Vella with GitHub Copilot
**Created**: 2026-09-10
**Branch**: `perf/apex-workflow-optimization`
**Original APEX revision**: `836966355354946d9fc3b78606bebbd9d08dc7d4`
**Curated AKS reference**: `bb7ae9021a0fc59d10d129710a8a260b573d9dcc`

### Current Authority Summary (2026-09-21)

Use this summary for the current proposal; historical authorizations below retain their original scope only.

| Area                             | Current authority                                                             | Next permitted action                                                               |
| -------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Roadmap and second opinion       | Tracking approved; user supplied Rubber Duck feedback                         | Preserve the bounded acceptance matrix                                              |
| ST-01 through ST-06 and ST-08    | Implementation, tests and independent reviews approved; acceptance unverified | Execute in dependency order; repair within scope without repeated approval          |
| FC-02 broad body migration       | Deferred                                                                      | No fleet rewrite during current recovery                                            |
| FC-04 wider interaction policies | Deferred except approved ST-06 bounded batching                               | Implement checked CodeGen batches; retain unrelated human gates                     |
| Dependency vulnerabilities       | Separately authorized remediation; local checks passed                        | Keep its diff/evidence distinct from stabilization approval                         |
| FreshConnect / ST-07             | Scoped deploy/delete authorized; required owner and preview gates retained    | Planner correction blocks retry; no Azure writes during maintenance                 |
| Publication                      | Commit, push and open/update PR approved after agreed checks pass             | Include dependency/roadmap changes; exclude private project evidence; no main merge |

Reference repository: <https://github.com/jonathan-vella/aks-basic>.
The pinned reference is a qualitative output reference, not a deployment prerequisite for this phase.
Any authorized commits and pushes are limited to the feature branch. Never merge into main or enable auto-merge.
No Azure resources were created by the original maintenance campaign. The later user-run FreshConnect deployment
partially provisioned resources before failing; recovery or an explicitly approved cost/cleanup disposition remains open.
Local guidance improvements use risk-based verification;
measured end-to-end token savings and final generated-output quality are not claimed.

## Master Roadmap And Tracking

**2026-09-21 execution approval:** The user approved implementing and testing the bounded stabilization scope,
checked CodeGen batches, in-scope repairs, automated tests and independent reviews. Commit/push/PR is approved
after agreed checks pass. These explicit decisions supersede tracking-only deferral for the selected
[stabilization work](#bounded-stabilization-and-main-promotion-2026-09-21), not the full deferred backlog.
FreshConnect scoped deploy/delete was subsequently authorized; current owner/review/preview gates still apply.
Scope expansion, directory privileges and main merge remain human-gated.

**2026-09-21 deferral:** Finish the current FreshConnect workflow before starting the
[fleet procedure and body consolidation backlog](#deferred-fleet-procedure-and-body-consolidation-2026-09-21).
The user authorized recording this future work, not implementing it during project completion.

**2026-09-16 program proposal:** [End-to-end reliability plan](#end-to-end-reliability-plan-2026-09-16)
governs the next proposed reliability work. Its planning and second-opinion review are authorized; implementation,
contract migrations and rollout require approval of that plan. Earlier permissions do not implicitly approve its
schema or workflow changes. Historical completion claims below remain evidence for their original batches only.

**2026-09-15 scope update:** Agent Host is excluded by user decision. Historical Host findings below
do not block this Local-only effort and do not authorize further Host investigation or issue filing.
Current priorities and bounded results are in the
[Local acceptance matrix](skill-remediation.md#active-local-acceptance-scope-2026-09-15).

The [manual-testing lesson audit](skill-remediation.md#manual-testing-lesson-audit-2026-09-15) reconciles later
FreshConnect execution with the earlier probes. Governance completion exposed a presence-only recall gate and
a contradictory revision reference; current maintenance fixes enforce review validity and correct operation-property
extraction. The production Governance discrepancy still requires owner reconciliation; no live deployment is implied.

Updated 2026-09-15. Start here for the overall program status. This section supersedes older whole-program
completion language; completed batches remain complete, but do not close newly discovered defects.
The user first authorized tracking, then approved autonomous remediation, and requested recovery after skipped
tool calls. The current [recovery checkpoint](skill-remediation.md#recovery-checkpoint) supersedes the initial
tracking-only state. Preserve the distinction between current test evidence, full finding completion and publication.

| Workstream                                           | Current Status                                                                                          | Authoritative Detail / Evidence                                                                                                                        | Next Action                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Workflow correctness and initial skill consolidation | Published; manual acceptance pending                                                                    | A01-D03 below; commits `ea6db336`, `d41507cc`, `c3246ea1`, `d6d3614f`, closeout `05d694ce`                                                             | Retain delivered history; address new findings separately                                    |
| Devcontainer and extension optimization              | Rebuild and dotfiles/Git persistence verified; comparative timing unmeasured                            | [Local acceptance](skill-remediation.md#local-picker-and-rebuild-acceptance-2026-09-14)                                                                | Retain verified setup; no startup-performance claim                                          |
| Agent modernization and E2E retirement               | Local discovery/picker confirmed; Agent Host excluded by user decision                                  | [Local acceptance matrix](skill-remediation.md#active-local-acceptance-scope-2026-09-15) and [modernization plan](agent-modernization.md)              | Verify Local workflow execution; no further Host work                                        |
| Deep skill and agent-contract remediation            | Local verification checkpoint `2c819743` published; bounded decision probes and offline checks recorded | [Current disposition](apex-workflow-audit.md#post-checkpoint-per-id-disposition) and [acceptance procedure](skill-remediation.md#acceptance-procedure) | Prioritize native recovery; keep optional SDK coverage gated without blocking unrelated work |
| Broader role and workflow redesign                   | Proposed; separate approval required                                                                    | [Redesign proposals](agent-modernization.md#separately-approval-gated-proposals)                                                                       | Do not mix into contract-preserving remediation                                              |
| Final quality acceptance                             | Pending user testing and remediation                                                                    | Manual matrices in both execution plans                                                                                                                | Never infer signoff from lint, compilation, or publication                                   |

## Bounded Stabilization And Main Promotion (2026-09-21)

Status: **Implemented in working tree; offline verification passed; native acceptance and operational closure pending**.
Owner: Jonathan Vella with GitHub Copilot.
Goal: close known reliability blockers in one coordinated maintenance task and prepare a reviewable release PR,
without another feature expansion or supervisor chat composing routine continuation prompts.
This is the current promotion proposal, not a declaration that the repository or FreshConnect is release-ready.

### Recorded Human Decisions (2026-09-21)

The user selected these answers in one consolidated decision panel:

1. Implement and test the agreed ST-01 through ST-06 scope and available ST-08 checks without per-file approval.
2. Replace mandatory per-file CodeGen stops with bounded dependency-ordered batches and validation after each edit.
3. Fix defects inside the agreed scope automatically; ask before scope expansion. Stop and explain a repeated
   ineffective repair or exhausted allowance instead of silently looping or resetting counters.
4. Run local tests and independent reviewer agents with available tools/models. Do not create cloud test resources
   or substitute unavailable models. Main-agent selection and required real human gates remain human-controlled.
5. Prepare to finish FreshConnect through its owners. The user subsequently authorized scoped Azure deployment and
   deletion, not directory privilege changes. This does not bypass required owner selection, current review/preview
   gates or scope-bound apply approval. No Azure writes occurred during this maintenance pass.
6. After agreed checks pass, commit, push and open/update a feature-branch PR, including dependency fixes and roadmap
   updates. Exclude local project artifacts, generated infrastructure, raw logs, secrets and scratch. Do not merge.

These decisions authorize work, not successful completion. Reuse them across resume without asking again unless
scope or assumptions change. Broad FC-02 migration and other FC-04 interaction changes remain deferred.

### Second Opinion And Causal Hypothesis

On 2026-09-21 the user supplied a Rubber Duck plan-level second opinion supporting the direction but requesting
finite scenarios, execution dependencies, measurable oracles, separate operational disposition and clear authority.
This is a user-supplied review report, not an independently reproduced agent invocation or source/runtime verification.
The changes below address that feedback; they do not imply approval by the reviewer of the revised plan.

Primary hypothesis: inconsistent consumption of existing contracts causes repeated recovery loops. Body size and
duplicate reads are contributing factors, not the success criterion. Test actual callers on equivalent state:
an explicitly selected replacement review with valid supporting inputs permits only the caller's authorized next
action, without reviving superseded failures or granting deployment approval. A stale-input near-neighbour must block.
Referencing a canonical procedure is necessary but does not demonstrate this behavior.

### Operating Boundaries

- Freeze new features during an approved stabilization pass. Maintain the blocker list below; new findings join
  it through explicit triage as release-blocking or deferred rather than starting another open-ended workflow.
- One maintenance task may reconcile repository agent bodies, shared procedures, utilities and tests together.
  Production agents retain their artifact ownership; maintenance cannot rewrite project approvals or deploy resources.
- Preserve policy enforcement, authentication, least privilege, independent reviews, immutable historical evidence,
  explicit main-agent selection and approval for deployment, destructive actions and privileged directory mutations.
- Routine work continues within approved scope. The ST-06 batching decision is approved above; implement and
  validate the updated procedure before production agents use it. Existing unrelated approval gates remain intact.
- Reuse successful evidence only while its relevant inputs and freshness remain valid. Do not repeat successful
  provider calls merely for timing or presentation. Never restamp old reviews or invent missing command evidence.
- Runtime tests do not authorize live resources or spending. FreshConnect recovery and cleanup remain separately
  controlled by its owners and the user's explicit approvals.

### Consolidated Release Blockers

Promotion acceptance remains open; implementation and offline results are recorded separately below.

| ID    | Work                                                       | Required exit evidence                                                               |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| ST-01 | Current review selection and lifecycle consistency (FC-01) | Both IaC tracks and callers honor current selected reviews, not superseded failures  |
| ST-02 | Durable input reuse across handoffs (FC-05)                | Approved tags/IDs survive resume; no repeat questions for resolved inputs            |
| ST-03 | Structured preview and policy evidence                     | Unparsed previews block; change counts and policy details match retained evidence    |
| ST-04 | Provider-semantic regression coverage                      | S2 size and ordinary serverfarm network defects detected before apply                |
| ST-05 | Canonical evidence utilities and artifact sequencing       | No guessed hashes/flags; support artifacts precede their dependent gates             |
| ST-06 | Routine continuation decision (FC-04 subset)               | Explicit policy decision, then tested bounded batches or accepted residual pauses    |
| ST-07 | FreshConnect partial-deployment disposition                | Verified recovery or explicit stop with resource inventory and cost/cleanup decision |
| ST-08 | Controlled runtime and release acceptance (FC-03)          | Fresh/resume evidence and independent release review; limitations acknowledged       |

### Stabilization Delivery Record (2026-09-21)

Starting source revision: `c77c6fcad7912087df341b40542d0989b80c7e41`. Existing dirty changes were dependency fixes,
their changelog entry and roadmap refinements; private FreshConnect output/IaC directories were untracked and preserved.
The bounded matrix below governed implementation. Synthetic executable scenarios live in
`tools/tests/scripts/test_stabilization.mjs`; existing recall and agent fixtures retain their original valid controls.
No schema migration, production main-agent invocation or automatic approval was introduced.

| Item  | Implementation and evidence                                                                                                                       | Remaining acceptance                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ST-01 | Canonical review lifecycle; both CodeGen historical-review rules corrected; Planner/Orchestrator linked; recall reliability/transition tests pass | Native caller fresh/resume exercise                                                                   |
| ST-02 | Pure input resolver with source provenance, tenant/principal/group checks, placeholder/email rejection; consuming guidance updated                | Native input handoff; helper trusts caller-supplied approval/discovery provenance                     |
| ST-03 | Structured CLI/REST/Terraform preview parser; explicit identity coverage; count/detail checks and unknown-action handling                         | Native preview capture and expected-ID preparation                                                    |
| ST-04 | Known S2/default and ordinary serverfarm-network regression checker with valid controls                                                           | Wider provider coverage excluded; actual deployment acceptance unverified                             |
| ST-05 | Canonical hash CLI; invalid path/root/target checks; distinct provider evidence; corrected redaction/sequencing guidance                          | Native support-artifact execution; evidence semantics cannot prove a command really ran               |
| ST-06 | Checked batches of up to three new source files; redundant per-file stops removed from both tracks and shared callers                             | Native batching/resume run; source/probe tests are not harness enforcement                            |
| ST-07 | Read-only recall/handoff inspection confirms outstanding frozen Plan VNet-integration conflict                                                    | Human-selected 05-IaC Planner correction, then CodeGen/current preview and scope-bound recovery gates |
| ST-08 | Independent source reviews, controlled read-only decision probe and offline suites completed                                                      | Native Local acceptance and final human release acceptance; no token-savings claim                    |

Verified commands/results:

- `node --test --test-reporter=tap tools/tests/scripts/*.mjs`: 450 tests, 448 passed, 2 skipped, no failures.
- `npm run test:validator-runner`: 55 passed. Recall reliability/transition pytest selection: 161 passed.
- `npm run validate:agents`, `validate:skills`, `validate:instruction-checks`, `lint:md`: passed.
- `npm run docs:build`: passed, with internal links valid. `npm run lint:docs-freshness`: passed.
- Dependency remediation: root/site npm audits reported zero vulnerabilities; patched version checks covered the
  reported advisories. Site build and sharp native AVIF encode/decode passed. No persistent npm policy was changed.
- Independent Explore reviewers identified exit-status, path-boundary, preview-shape and missing-detail issues;
  these were repaired and corresponding focused tests passed. This is repository review, not project Challenger evidence.
- A read-only Explore decision probe returned the intended selected-review, stale-input, approved-input reuse,
  batching, exhausted-retry and frozen-owner decisions. Its numerical question estimates are not observed UI metrics.

Local verification logs are scratch evidence under `/tmp/apex-st-*`; they are not committed or durable CI records.
The PR/commit identifies the reproducible test sources. The installed Copilot CLI reports 1.0.83, which does not
prove production model eligibility or authorize invoking human-selected main agents. No native fresh project,
Terraform deployment or production-equivalent Local acceptance was performed. Do not turn these limits into pass claims.
Do not run the broad `validate:all` against private partial-project artifacts as a substitute for owner validation;
the scoped repository gates above and standard publication hooks remain the release evidence for this batch.

FreshConnect's recorded repaired code still conflicts with the frozen Plan/manifest VNet-integration binding.
Its handoff points toward Deploy while also retaining that Planner blocker. Maintenance did not rewrite those
owner artifacts or use generic agents to bypass production main-agent selection. ST-07 and promotion remain blocked
until the owner path resolves this inconsistency. A draft PR may publish verified source work without claiming readiness.

Initial publication attempt (2026-09-21): **blocked before commit**. The normal pre-commit
artifact-validation hook, triggered by the shared artifact-skill change, scanned local untracked FreshConnect output
and rejected `06-deployment-summary.md` for missing required template headings. The handoff also has heading warnings.
These are private production-owner artifacts, not publication scope; maintenance did not rewrite them or bypass hooks.
The hook's Markdown command separately reported `markdownlint-cli2: No such file or directory` despite marking its
wrapper successful; explicit `npm run lint:md` had passed. The user subsequently authorized the narrow hook correction,
regression tests, independent review and normal publication retries. No private artifact repair or hook bypass was used.

Publication-hook follow-up: `check-publication-scope.mjs` validates an isolated Git-index snapshot. Template/guidance
changes retain tracked template/artifact and reviewer-presence coverage; unrelated untracked projects are absent.
Markdown resolves the installed local executable and propagates its exit status. Partial staging, paths with spaces,
template-only changes over invalid tracked artifacts, staged deletion of review evidence, missing tools and index
immutability have executable coverage. Both real Lefthook jobs passed using `--job markdown-lint --job artifact-validation`.
Independent read-only review found no blockers. Latest tooling run: 453 tests, 451 passed, 2 skipped; all 29 Bats
hook tests passed. Site build and Markdown lint passed. Native acceptance, ST-07 and main promotion remain open.

Published source checkpoint: `d8afd551` on `perf/apex-workflow-optimization`, with normal commit and pre-push
hooks passing. [Draft PR #696](https://github.com/jonathan-vella/apex/pull/696) includes the dependency fixes,
stabilization work and hook repair. Private FreshConnect artifacts/IaC and raw logs remain excluded. No main merge
or auto-merge is authorized. Native acceptance and FreshConnect recovery are explicitly pending in the PR.

Initial PR CI exposed roadmap Prettier drift and missing diagram dependencies in the Python tooling job.
The follow-up formats the roadmap and installs existing pinned `requirements.txt` dependencies plus system Graphviz
before the unchanged tests. A workflow-order regression test passed; local Python tooling tests passed
(194 passed, 5 skipped). Remote CI acceptance must be checked on the follow-up revision, not inferred from local success.
The next remote run confirmed Python and formatting success, then exposed missing Terraform in the Node job and
a missing explicit `publicNetworkAccess` review anchor. The follow-up installs the native Terraform CLI before
executable tool tests and restores the property-level policy check without changing the Azure Monitor allowance.
The exact governance guardrail and affected Terraform test suites pass locally; no tests were disabled.
Remote CI run `35628667209` passed both main and external-Python jobs on `b2d98d6e`. CodeQL then reported
two test-fixture expressions: an unescaped hostname regex and one-pass HTML-tag stripping. Literal string matching
and the existing DOM parser replace those expressions; 48 focused tests passed. Alerts were not dismissed;
remote code-scanning results remain authoritative for the follow-up revision.

### Native Acceptance Run Cards

These prepared runs remain **pending**, not replaced by source tests or the read-only decision probe. Use isolated
synthetic project copies, not FreshConnect. Do not copy secrets/real identities, invoke main agents as workers, or run
Azure mutations. Record source revision, model/tool availability, inputs and hashes, questions, writes and outcomes.

1. Human selects `06b-Bicep CodeGen` for a Bicep fixture, then `06t-Terraform CodeGen` for an equivalent Terraform
   fixture. Prompt: "Exercise the approved stabilization scenarios on the isolated fixture only. Start from a complete
   approved Plan with an explicit current replacement review; preserve the old failed review. Generate the next approved
   dependency batch with per-edit validation, checkpoint and continue without routine next-file questions. No Azure calls
   or deployment. Report unavailable gates as unperformed." Expected: selected current review controls readiness;
   no historical-failure revival, no implicit apply permission, no unapproved writes and no per-file question.
2. Resume each fixture with approved normalized runtime inputs and verified mock discovery evidence, but unset shell
   variables. Prompt: "Resolve the recorded approved inputs using the shared helper; do not ask again for known values.
   Use only supplied synthetic discovery evidence. Stop before live provider checks." Expected: zero redundant input
   questions. Repeat with one missing tag/group decision, then a tenant conflict; only the unresolved decision is asked,
   and a scope conflict blocks rather than switching context.
3. Use a fresh fixture copy with a changed supporting review input, then an exhausted review retry and a generated
   module defect. Prompt: "Resume from current evidence without resetting allowances. Repair owned local defects only;
   stop before dependent work while checks fail and route frozen-input defects to their owner." Expected: stale review
   and exhausted allowances block, a successful in-scope repair resumes its batch, and no reviewer output is fabricated.
4. Human selects the appropriate Deploy owner on a preview fixture. Prompt: "Validate the supplied structured preview,
   independently approved expected identities and policy result; do not contact Azure or apply. Report unknown actions,
   missing identities and incomplete coverage explicitly." Expected: valid control passes the evidence checks without
   granting apply; formatted text, inconsistent details and unknown coverage never become zero-change success.

FreshConnect's separate next human gate is `05-IaC Planner`: reconcile only the recorded ordinary App Service Plan
network-binding conflict and capability-backed S2 size, preserve resource names/SKUs/partial state, review affected
owned artifacts and return to CodeGen. Expected result: current approved contracts match repaired source before a
fresh deployment preview. This operational recovery is not one of the synthetic native acceptance runs above.

ST-01 reconciles bodies, shared protocols and recall completion semantics. Separate transient worker retries,
empty-output retries, repairs and separately authorized reviews. Preserve ownership and required lenses; a selected
review is not deployment authorization. Test accepted repair, stale supporting inputs and exhausted allowances.

ST-02 implements the FC-05 resolution order and reuses the actual recall schema, including approved decision-log
records rather than guessed fields. Verify placeholder/redacted values, principal types and tenant alignment.
Validate plain email recipients from actual rendered inputs, not chat formatting. Inspect tag-policy rules before
treating an exception tag as required; never infer bypass authorization from assignment parameter names.

ST-03 uses Bicep what-if `--no-pretty-print --output json`, validates the actual response shape and derives
counts/diagnostics from structured records. Preserve unknown or incomplete coverage; never substitute formatted
text parsing for the gate. Reconcile logical resources with named child resources, not type-count equality alone.
Policy-state observations, especially capped queries, are not complete effective-assignment discovery. Populate
reported missing-policy details and qualify unavailable definition freshness. Preserve Terraform's structured plan path.

ST-04 checks exact pinned AVM defaults and generated provider payloads against approved SKU capabilities.
Cover the SQL Standard S2 invalid 32-GiB default and the verified explicit byte-size override; do not generalize
one region/SKU observation to every database. Cover ordinary App Service Plans rejecting subnet/network properties
without custom mode; do not introduce an ASE, Web App or custom mode as a workaround. Verify identity separately.
Include repair-preservation coverage from FC-03. Frozen-plan conflicts return to their owner as one consolidated
correction before release to Deploy. Compilation, provider validate and what-if remain distinct from apply success.

ST-05 reuses or narrowly exposes canonical tree-hash, validator invocation and evidence-capture helpers instead of
copying algorithms into shell snippets. Keep parameter-build and provider-validation exit codes/output hashes distinct.
Avoid generated parameter artifacts leaking resolved inputs or unexpectedly changing source hashes. Preserve user logs;
do not silently delete them to satisfy hashes. Test shell-safe PowerShell parsing and scratch-file handling.
Ensure parameter/deployment-support artifacts exist before final CodeGen gates; do not classify unfinished generation
as an external prerequisite failure. Consolidate repairs and rerun only meaningfully affected checks.

ST-06 proposes dependency-ordered CodeGen batches with focused validation after each edit and bounded recovery.
Pause for genuine blockers, decisions, scope changes and required approval, not routine next-module permission.
If batching is declined, record that per-file interaction remains intentional and do not claim low-touch completion.
Diagnose per-command approvals and global session-break policy remain separate deferred decisions under FC-04.

### Execution Dependencies

Initial triage freezes scenario IDs, actual entrypoints, expected results and allowed paths before implementation.
An unlisted defect or improvement requires explicit triage and scope approval; it does not expand an ST item silently.
New evidence of a mandatory safety blocker stops the affected action without authorizing unrelated implementation.

| Work package                  | Prerequisite                                      | Concurrency and exit                                                         |
| ----------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| Triage and ST-06 decision     | Explicit stabilization execution authorization    | Freeze the matrix and choose batching or retained pauses                     |
| ST-01 lifecycle contract      | Frozen scenarios and current caller inventory     | May proceed alongside ST-04 evidence fixtures                                |
| ST-02 input resolution        | ST-01 ownership and approval semantics agreed     | Coordinate runtime-input interface with ST-05 before editing callers         |
| ST-05 evidence/sequencing     | ST-01 contract and ST-02 interface agreed         | Shared helpers first; avoid parallel edits to the same consumers             |
| ST-04 provider semantics      | Captured provider evidence and frozen fixtures    | Independent fixtures; integrate after ST-05 payload/evidence path stabilizes |
| ST-03 preview evidence        | ST-02 resolved inputs and ST-05 capture interface | Integrate structured preview and policy result checks                        |
| ST-06 batching implementation | Batching approved; ST-01/ST-05 gates stable       | Otherwise record retained pauses and omit low-touch claims                   |
| ST-07 operational disposition | Separate project-owner authority                  | Independent operational track; no dependency for repository unit tests       |
| ST-08 acceptance              | Repository items integrated; chosen ST-06 outcome | Runtime acceptance then final release review; promotion also checks ST-07    |

### Bounded Acceptance Matrix

Each scenario record must contain fixture/input hashes, concrete public command or agent entrypoint, expected
result/action, allowed writes, expected questions and retained evidence. Bind these fields during initial triage;
unbound fields mean the scenario is not executable, not passed. The finite scenario sets below define the scope.
Shared oracle: no extra questions for approved unchanged inputs, no unlisted writes, no invented success evidence.
Mutation tests use isolated fixtures; runtime logs and fixture results remain distinct evidence types.

| Item  | Finite inputs and valid control                                                                                                                                  | Public consumer and expected oracle                                                                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ST-01 | Valid selected replacement with failed history; stale supporting input; exhausted retry; accepted but unresolved repair                                          | Recall completion/transition and Orchestrator/Planner/CodeGen: valid case advances only to permitted action; stale/unresolved/exhausted cases block without state advancement |
| ST-02 | Fully approved inputs after resume; placeholder inputs; tenant mismatch; query denied; existing/new SQL group; missing tag value; malformed email                | Planner, both CodeGen/Deploy callers: valid case asks nothing; unresolved decisions are batched; failed discovery never invents values or silently switches tenant            |
| ST-03 | Valid structured Bicep/Terraform previews; formatted text; malformed/unknown shape; diagnostics/potential changes; child-ID mismatch; capped policy observations | Deploy and policy/preview workers: derive actual changes; reject invalid evidence; disclose incomplete coverage; missing-policy records agree with counts                     |
| ST-04 | Captured invalid/valid S2 sizes; ordinary Plan with/without network binding; independently checked identity; Bastion repair with/without invented subnet         | Planner/CodeGen/validation workers: reject known invalid payloads, accept matched supported controls; frozen contract change routes to owner without extra resources          |
| ST-05 | Complete support files; missing parameter artifact; changed source hash; separate successful/failed/unrun command records; PowerShell parsing; existing user log | CodeGen, canonical helpers and handoff validator: valid case passes; incomplete/stale cases fail for the right reason; no borrowed exit codes or deleted user evidence        |
| ST-06 | Approved batch completes; local defect repaired; unresolved defect; scope-changing fix; retained single-file policy                                              | Both CodeGen callers: chosen cadence enforced; validate before dependent work; stop only at specified boundaries; no second-chat continuation for batching control            |
| ST-07 | Verified recovery; explicit operational stop; stale approval or unverified partial inventory                                                                     | Production owners: only authorized operation proceeds; unresolved disposition remains open; neither outcome establishes fresh-run reliability                                 |
| ST-08 | Fresh and interrupted-resume paths in both tracks; representative repair/review/input handoffs; unavailable runtime capability                                   | Actual selected callers: satisfy frozen oracles without supervisor-chat prompts; unavailable capability is unperformed/blocked, never counted as pass                         |

Per-item write, question and evidence contracts:

- ST-01: isolated state/index and declared review outputs only; questions only for missing owner decisions or new
  authority. Retain before/after state hashes, selected review identity, exit codes and caller next-action traces.
- ST-02: runtime environment and explicitly owned resolution records only; no Azure/Entra mutations. Group creation
  remains an authorized-owner request. Retain redacted provenance, missing-input reasons and actual question counts.
- ST-03: preview/policy outputs and scratch only, never apply. Approval is asked only after a valid preview is presented;
  invalid evidence reports its blocker. Retain raw structured response, scope/input binding, diagnostics and result hash.
- ST-04: owned source or synthetic fixtures only; no silent frozen-artifact rewrite. Ask only for a real owner/scope
  decision, not to verify a documented provider fact. Retain capability source, exact generated payload and verdict.
- ST-05: declared support/evidence artifacts and invocation-owned scratch only. Ask only for unresolved inputs or
  ownership. Retain command, exit status, output hash and inclusion rules; successful timing alone is not an oracle.
- ST-06: approved CodeGen files/checkpoints only. Known safe local repair needs no repeated approval; scope changes do.
  Retain per-edit validation, dependency order, stop reason and interaction count for the selected cadence.
- ST-07: only separately authorized production operations and owner artifacts. Recovery/cleanup requires its own
  current approval. Retain failed-operation history, resource-specific inventory, remaining costs and disposition.
- ST-08: authorized test outputs/report only. No forced runtime fallback or live resource creation. Retain frozen
  inputs, caller/model/tool availability, exact outcomes and redacted traces; measure tokens only when observable.

Every negative scenario needs its named valid control; failure-only tests cannot establish usable behavior.
ST-01/ST-02/ST-03/ST-05 exclude schema redesign, new frameworks and unrelated policy changes. ST-04 excludes
SKU changes, regional generalization and mandatory live proofs. ST-06 excludes other agents' interaction policies.
ST-07 excludes treating the recovery run as a clean baseline. ST-08 excludes Host, model comparisons and a new
benchmark platform. Wider work stays in FC backlog and is not pulled into stabilization by test failures.

### Separate Readiness Tracks

- **Repository verification**: ST-01 through ST-06 and ST-08 evidence, with unavailable checks stated explicitly.
  Repository tests and controlled caller checks may proceed while FreshConnect disposition remains open.
- **FreshConnect operations**: ST-07 owner-managed recovery or explicit stop with inventory and cost/cleanup decision.
  A stopped project is not a successful deployment; a recovered project is not fresh-run repository acceptance.
- **Promotion**: the proposed gate requires repository acceptance plus an explicit ST-07 disposition. This coupling
  prevents silently abandoning chargeable partial resources; it does not make Azure recovery a unit-test prerequisite.
  Changing that promotion prerequisite requires a human release decision, not a rewritten completion claim.

### Delivery And Promotion Checklist

1. Confirm scope and batching decision; snapshot the starting revision, dirty worktree and known failures. Freeze the
   bounded scenario records and dependency interfaces before implementation; numeric ST order is not execution order.
2. Implement the approved packages in dependency order with focused validation immediately after edits. Independent
   work may proceed concurrently only when it does not change shared inputs or the same files.
3. Track ST-07 separately through production owners. Retain failure evidence; do not retry under stale approval.
4. Run required repository checks and controlled fresh/resume scenarios across both IaC tracks and representative
   author/reviewer/input-resolution paths. Record actual interventions, duplicate reads and tokens where observable.
5. Run one final independent repository release review over the finalized diff and evidence. This does not replace
   required project reviews. Any subsequent repair invalidates the affected part of release acceptance.
6. Prepare a public-safe feature-branch PR only when authorized. Exclude `agent-output/`, generated `infra/`,
   `.github/skills/sensei/`, raw logs, secrets and ignored scratch. Inspect staged paths and content before publication.
7. Present blocker dispositions, actual test/runtime outcomes, unperformed checks, accepted limitations and exact
   commit evidence for human acceptance. Merge to main requires separate explicit authorization; no auto-merge.

Promotion requires every blocker closed with evidence or an explicit, documented human release-risk decision.
Mandatory policy, security, review and deployment-approval gates cannot be waived as release risks.
Do not claim fresh-run reliability from static tests, body-line reductions or the current recovery run alone.
Routine approved execution should not require a second chat to interpret each result or supply continuation prompts.

Full fleet body migration, broad token optimization, cosmetic consolidation, model changes, Agent Host work and
new frameworks remain deferred. Only contradictions and procedural duplication needed for the blockers are in scope.
The earlier FC-01/FC-02 estimate does not cover this expanded release plan; re-estimate after the initial triage.

## Deferred Fleet Procedure And Body Consolidation (2026-09-21)

Status: **Deferred; tracking approved, implementation not started**.
Owner: Jonathan Vella with GitHub Copilot.
Revisit after FreshConnect completion or an explicit user decision to pause it for maintenance.
The execution approval above activates the selected ST subsets, including FC-05 input resolution, but not this entire
backlog. Full body consolidation remains deferred and is not a prerequisite for targeted release fixes.
Older broad maintenance authorization does not activate remaining deferred work. Current project gates remain intact;
the recorded publication approval does not authorize deployment or main merge.

### Problem And Evidence

The fleet-wide read-only source audit found duplicated review mechanics, conflicting current-versus-historical
review selection rules, and large bodies supplemented by mandatory shared references. Static agent validation
passed, but that does not prove efficient execution or semantic consistency. Runtime token savings remain unmeasured.

- Both CodeGen bodies retain an every-Plan-pass approval rule while the shared workflow recognizes selected
  superseding evidence. Planner also repeats Plan-status and review mechanics.
- Requirements, Architect, Governance, Planner and Challenger carry review/repair procedures alongside the shared
  protocol. Incident fixes expanded references without consistently reconciling every consuming body.
- Recent private-network hardening caused the Azure Monitor detour; the local baseline now explicitly allows
  authenticated public monitoring when effective policy and approved requirements permit it.
- Orchestrator session breaks, CodeGen per-file stops and Diagnose per-command approvals are deliberate existing
  interaction policies, not all consequences of the recent changes. Changing them is a separate scope decision.

Source anchors: `.github/agents/`, `.github/agents/_subagents/`,
`.github/skills/apex-azure-defaults/references/adversarial-review-protocol.md`,
`.github/skills/apex-iac-common/references/codegen-shared-workflow.md`, and
`.github/instructions/context-optimization.instructions.md`.

### Backlog Scope

| ID    | Priority          | Deliverable                                                     | Acceptance                                                                         |
| ----- | ----------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| FC-01 | High              | Authoritative review lifecycle procedure                        | Callers and runtime agree on selection, retries, repairs and completion            |
| FC-02 | High              | Phase-loaded procedural guidance across main agents and workers | Essential boundaries remain in bodies; duplicate mechanics removed                 |
| FC-03 | High              | Regression and controlled workflow evidence                     | Correct recovery without lost approvals, invented facts or supervisor-chat routing |
| FC-04 | Separate decision | Routine-continuation policy proposal                            | No cadence or approval change without explicit scope approval                      |
| FC-05 | High              | Shared deployment-input resolution                              | Reuse approved/discoverable values; ask only for unresolved decisions or conflicts |

FC-01 reuses the existing protocol, workflow graph and recall implementation; it does not introduce a new framework.
Distinguish transient execution retries, empty-output retries, repair iterations and separately authorized reviews.
Preserve historical evidence while selecting current evidence explicitly. Accepted findings are not verified closure.
Define final input preparation, repair, dependent validation, re-review and completion without contradictory copies.
Assess compatibility before any runtime/schema change; do not silently migrate existing project state.

FC-02 covers the entire main-agent and worker fleet, both IaC tracks, within the current Local-only program scope.
Keep role, permitted writes/tools, ownership, required inputs/outputs, security, approval and essential stop rules
directly in each body. Move repeated command recipes, payload examples, presentation formats and detailed recovery
procedures into existing phase-specific references. Load those before use, not all at startup. Do not assume
authoring instruction globs attach at runtime, or claim context savings merely because text moved between files.
Do not chase a line target at the expense of an executable role contract.

FC-03 tests normal completion, accepted repairs, selected replacement reviews, stale supporting evidence,
worker failures, exhausted allowances and interrupted resume. Include the Bastion Developer incident: adding
topology detail must not invent a required AzureBastionSubnet or relocate approved AMPLS/operator subnets.
Reviewer recommendations require evidence; a proof establishes tested behavior, not blanket redesign authority.
Use executable contract tests plus controlled author/reviewer runs, not text-presence assertions alone.
Exercise both IaC tracks and representative non-CodeGen roles. Record tool/model availability, actual outcomes,
duplicate reads, user interventions and observed tokens where available; leave missing runtime measurements unknown.
No live Azure resources or production artifact changes are implied by this future acceptance work.

FC-04 separately considers dependency-ordered CodeGen batches with per-file validation, bounded read-only
diagnostic approval and session-break ergonomics. FC-01/FC-02 alone do not change the one-file-per-turn rule,
Diagnose's per-command approvals, main-agent human selection, deployment approval or destructive-operation gates.

### FC-05: Deployment-Input Resolution

Status: **Implemented through ST-02; offline fixtures pass; native handoff acceptance pending**.
The FreshConnect parameter-build incident treated unset `APEX_*` variables as missing user decisions and requested
subscription, deployer, SQL authentication and tag inputs together. Manifest field presence does not establish a
usable value: zero GUIDs, redaction markers and placeholders must be classified as unresolved, not passed to validation.

Use one shared resolution procedure across Planner, both CodeGen agents and both Deploy agents:

1. Reuse valid approved project values from the environment manifest and recall decisions.
2. Resolve discoverable values with read-only Azure/Entra queries and verify their approved scope.
3. Apply defaults only where effective policy and approved requirements permit them.
4. Present one consolidated question for genuinely unresolved decisions, missing values or conflicts.

Required behavior:

- Discover the active Azure CLI subscription and tenant; compare them with approved governance scope. A match
  needs no repeated manual entry. A mismatch or ambiguity requires resolution, not silent subscription switching.
- Resolve the authenticated deployer principal's object ID, distinguishing users, service principals and managed
  identities. Do not confuse an application/client ID with an object ID or assume the principal is a human user.
- Enforce Entra-only SQL authentication automatically. Administrator principal type is a separate field; use
  `Group` for the approved group-based administrator path, not a question about SQL-password authentication.
- Offer an existing SQL administrator Entra group ID or creation of a dedicated group with the user's identity
  as a member. Verify existing groups in the target tenant and resolve display name/type. If the authenticated
  principal is not a user, clarify the intended human member rather than silently granting the automation identity access.
- Group creation and membership changes require explicit authorization and an owner permitted to perform directory
  mutations. CodeGen performs read-only resolution only; group membership is privileged access, not a harmless default.
- Reuse approved tag values against the discovered policy contract. Apply fallback tag keys only when applicable;
  do not invent owner, cost-centre or other business values. Ask only for missing required values or conflicts.
- Populate process-local runtime inputs without printing secrets or committing sensitive values. An unset environment
  variable alone is not an unresolved requirement. Keep parameter-build evidence separate from provider-validation
  evidence; neither successful compilation nor discovery grants deployment permission.

Implementation should reuse existing identity/environment guidance and tooling. Add a small shared deterministic
resolver only where existing utilities are insufficient; preserve the environment-manifest contract unless a
demonstrated gap requires an explicitly reviewed compatibility change. Keep policies consistent with FC-01/FC-02,
but do not require the entire fleet refactor before a separately approved focused implementation.

Acceptance coverage: active-subscription reuse, tenant/governance mismatch, user/service-principal/managed-identity
resolution, directory-query permission failure, placeholder/redacted IDs, existing/new SQL-group choices, approved
tag reuse and missing tag values. Verify that discovery never mutates directories/resources and never leaks secrets.
Exercise both IaC tracks with executable fixtures and a controlled agent run. Fully resolved inputs produce no
redundant questions; unresolved SQL-group choice and genuinely missing values are batched without bypassing approval.

### Delivery And Exit Criteria

1. Refresh the source inventory and preserve concurrent edits; agree the canonical procedure and compatibility scope.
2. Implement FC-01 with focused regression tests; migrate Requirements, Architect, Planner and Challenger first.
3. Migrate remaining main agents and workers in small validated batches; keep essential runtime constraints local.
4. Run static validation and controlled fresh/resume scenarios. Report failures and unperformed checks explicitly.
5. Obtain human acceptance before claiming low-touch reliability; do not substitute lint success for runtime evidence.

Planning estimate for FC-01/FC-02 with FC-03 verification: **4-7 focused engineering days**, not a fixed commitment.
Allow roughly half to one day for inventory, one to two for procedure consolidation, one to two for body migration,
and one and a half to two for verification. Re-estimate after scope confirmation;
FC-04, FC-05 implementation and live testing are excluded from that estimate.
Success means consistent decisions and fewer redundant operations without weakened safeguards, not smaller files alone.

## Tracking Ownership

The latest [agent-body findings](apex-workflow-audit.md#agent-body-audit-backlog), AB-01 through AB-22,
are now linked to the same [execution roadmap](skill-remediation.md#agent-body-remediation) as SK-01 through SK-47.
The step-1 planning checkpoint is committed as `3b034112`. Subsequent autonomous approval permits the recorded
source work and consolidation within protected contracts; current recovery evidence is linked above.

The skill roadmap also includes [invocation and context policy](skill-remediation.md#skill-invocation-and-context-policy)
under SK-46/SK-47: internal menu visibility, manual Host commands, metadata validation and a gated fork assessment.
The visibility policy is approved and current edits require verification; fork experiments remain deferred.
The offline-only evaluation boundary is unchanged.

- This document owns workstream status, ordering, dependencies and links, not copies of every finding.
- [The audit ledger](apex-workflow-audit.md#deep-skill-audit-backlog) owns stable finding IDs, evidence,
  rationale, proposed dispositions and verification criteria. Later evidence amends a finding without reusing its ID.
- [The skill plan](skill-remediation.md) owns execution batches, dependencies, decisions and completion evidence.
  The modernization plan retains its own delivered contract and acceptance history.
- `CHANGELOG.md` summarizes delivered changes; Git commits identify exact implementation snapshots.
- Chat todos mirror the current work slice only. Session memory, temporary logs and delegated review output
  aid recovery but are not the durable source of truth. Summarize important evidence in these tracked documents.

### Status And Approval Rules

Track implementation status separately from scope approval and manual acceptance:

| Status              | Required Meaning                                                                   |
| ------------------- | ---------------------------------------------------------------------------------- |
| Proposed            | Recorded finding or candidate; no implementation claim                             |
| Approved            | User-approved scope with recorded constraints and decision date                    |
| In progress         | Named batch is being changed; tests/evidence not complete                          |
| Blocked             | Exact dependency or access barrier recorded; not completed                         |
| Implemented         | Source changed; verification may still be pending                                  |
| Verified            | Applicable focused/full checks and review completed; commands and results recorded |
| Published           | Verified commit pushed and remote branch equality confirmed                        |
| Deferred / Rejected | Reason, owner and revisit condition recorded; not a fixed defect                   |

Manual acceptance remains a separate pending/accepted result. Approval to investigate is not approval to merge
skills or change public entrypoints. A reported defect becomes confirmed only through a current source check or
reproduction; disproven hypotheses retain an evidence-backed rejected disposition. Do not weaken a test to close an item.

For each verified batch, update finding statuses, the batch record, this roadmap and the chat tracker together.
Record affected IDs, decision/rationale, tests, review findings, commit SHA, publication and residual limitations.
Only update the changelog after implementation. Preserve user edits, historical artifacts and existing approval gates.

<a id="authoritative-remaining-work"></a>

## End-to-End Reliability Plan (2026-09-16)

Status: **offline reliability implementation verified; native acceptance pending**.
Owner: Jonathan Vella with GitHub Copilot.
Scope: Local Copilot, both Bicep and Terraform, Requirements through As-Built and Lessons. This is a repository
reliability program, not authorization to resume FreshConnect production work or alter its approved artifacts.
Evidence: [manual testing and follow-up records](skill-remediation.md#manual-testing-lesson-audit-2026-09-15).
Source checkpoints `456cba76` and `abcb908b` are published; later working-tree corrections are not automatically
accepted or published by this proposal. Inventory the exact starting revision and dirty worktree in RY0.

### Problem And Success Definition

Execution authorization update (2026-09-16): the user authorized all remaining repository reliability work with the
recommended RY1 decisions, and requested a source commit/push before implementation. Checkpoint `5028b659` and
publication-hook repair `a7fb51ed` are pushed. FreshConnect artifacts/infra remain local; protected boundaries below
remain in force. No more routine per-batch approval requests are needed. Native acceptance requiring the user's
Local picker or live Azure operations remains separately scoped and must not be fabricated.

RY1 first-slice contract: retain session schema 3.0 and public selector flags; add a versioned `review_selections`
map keyed by step with `review-selection-v1` records (path, review byte hash, lens, pass and selection timestamp).
It is evidence selection, not approval. Readers revalidate on consumption; absent legacy selections use established
defaults or explicit owner flags, never parse rationale prose. Writers use revision-aware state dictionaries,
per-project nonblocking writer locks, unique temporary files and compare-before-replace. Unsupported selection
versions fail closed. Primary corruption is recovery-required; normal reads never restore backups. Repeat completion
of unchanged inputs returns already-applied without changing timestamps or destination progress. Index failure after
replacement reports committed-but-index-stale and the committed hash; explicit reindex repairs it. The primary-state
backup recovery command requires an explicit reason and retains corrupt input. These changes introduce no new
review budget or permission to deploy, and no automatic production migration.

Local checks validate shapes and hashes more consistently than cross-stage usability. Requirements can omit an
operator path; Architecture can leave a dependency unresolved; Planner can omit provider constraints; CodeGen can
introduce settings not established by the plan. Review, completion and handoff consumers can interpret the same
evidence differently. This produces repeated correction cycles despite locally passing checks.

Examples include original-only review filenames, false zero-file validation passes, lowercase Deny omissions,
anomaly scope/schedule constraints, malformed handoffs, root dependencies and private-monitoring access. Existing
fixes are useful inputs, not evidence that the whole workflow is reliable. A compiled module is not an operational
service, a current hash is not semantic completeness, and an accepted finding is not verified closure.

The incident records support related but distinct causes: deterministic validation gaps, inconsistent evidence
consumption, and missing operational requirements or overstated evidence. RY0 separates repaired defects needing
regression coverage from remaining work. Stopping on genuinely stale evidence, exhausted repair allowances or absent
approved modules is correct behavior, not avoidable churn. Source assertions do not establish native compliance.

Success means known deterministic defects fail before a scarce independent review, every stage consumes the same
selected evidence and approved decisions, and the next owner receives complete inputs or a specific unresolved item.
New legitimate findings still block; zero findings or an arbitrary low review count is not a release objective.

### Protected Boundaries

- Preserve current human-selected roles/models, tool allowlists, one-new-source-file cadence and both IaC tracks.
- Preserve security/governance precedence, mandatory independent reviews, separate Step 2 cost-feasibility review,
  explicit deep-review opt-in and existing repair ceilings. Do not reduce safety to improve throughput metrics.
- Keep reviewed artifacts immutable. No restamping, copying clean findings over history, inferred latest-review
  selection, automatic approval or silently reopening an approved stage. Use only apex-recall for project state.
- No Azure changes, deployment, SQL grants, tenant-wide discovery, model changes, paid evaluation or new Agent Host
  work is authorized. Do not revive the retired E2E launch subsystem or introduce another orchestrator framework.
- FreshConnect artifacts, logs and infrastructure remain local. Publish sanitized fixtures and source only under
  separate commit/push approval; preserve all user changes and make rollback possible without resetting their work.

### Contract Ownership

Extend existing schemas and owning APIs only where a concrete consumer needs a field. Do not introduce a universal
mega-manifest, duplicate approvals across documents or build a new policy/rules engine.

| Concern                                      | Canonical owner                                             | Consumer obligation                                                                          |
| -------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Required capabilities and accepted deferrals | Requirements owner; existing requirements artifact/contract | Distinguish user statements, defaults, assumptions and unresolved questions                  |
| Capability dependency closure                | Architect; existing assessment, SKU and cost artifacts      | Bind client/producer paths, identities, DNS, ownership and cost to required capabilities     |
| Effective policy facts                       | Governance; generated envelope and discovery provenance     | Separate policy from project choices; incomplete evidence stays unknown                      |
| Implementable bindings and constraints       | Planner; versioned IaC/environment/policy-map contracts     | Cover resource identities, dependency edges, scope, required inputs and provider constraints |
| Selected reviews and operation approvals     | Shared apex-recall APIs and existing audit/state structures | Every reader uses the same selection, validity and operation-scope rules                     |
| Generated code and validation evidence       | CodeGen/Deploy and existing IaC handoff                     | Prove conformance to frozen inputs; scope validation to the current phase                    |
| Resume presentation                          | Handoff renderer and canonical headings registry            | Derive status and owner from validated state; retain blockers and evidence paths             |

Proposal: use a compact dependency checklist with references in the Architecture artifact first, not a new mandatory
standalone file. Add stable capability IDs or structured fields only when a concrete downstream consumer demonstrates
the need. Defer universal capability registries and generalized service-rule catalogues. RY1 version-documents the
minimal additions; it does not authorize a cross-stage schema redesign.

### Approval, Readiness And Invalidation

Keep historical completion/approval, current evidence validity, effective decisions and permission for the requested
operation distinct. A completed step is not current readiness; a valid review neither grants approval nor extends
preview permission to apply. Effective decisions reference their authoritative source and any superseding correction.
Historical recall assertions never override corrected policy evidence. Store this in existing owner contracts and
state/audit structures, not a second approval ledger.

| Change                                                            | Evidence and approval treatment                                               | Recovery boundary                                                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Primary or consumed supporting bytes change                       | Preserve historical approval; exact-byte review reuse fails                   | Block affected consumption; owner-authorized revision and applicable review/approval                |
| Recall-only correction to match unchanged authoritative inputs    | Audit supersession; do not rewrite reviewed bytes or renew completion         | Owner reconciles through recall; reuse unchanged valid approval without repeating it                |
| Policy/discovery/capacity evidence expires or lacks scope         | Matching hashes do not establish operational validity                         | Block the operation needing that evidence; request scoped refresh or an allowed capability decision |
| Protocol, checklist, reviewer/model or validator contract changes | Evaluate compatibility explicitly; never suppress existing freshness failures | Follow the approved migration matrix before consequential consumption                               |
| Handoff presentation changes only                                 | Preserve reviewed inputs, approval and timestamps                             | Repair and validate the handoff; do not rerun completion                                            |
| Requested operation or accepted design scope changes              | Prior permission remains historical and limited to its original scope         | Obtain the relevant human decision before the new operation                                         |

RY1 must define the consumed-input boundary without hash cycles: mutable approval records remain outside reviewed
bytes. Enumerate affected consumers and justify which remain unaffected; do not reopen unrelated stages. Defining
this matrix is not permission to mutate approved artifacts or reconcile FreshConnect state.

### Ordered Implementation Batches

| Batch | Deliverable and owner surface                                                                              | Dependency                                                            | Exit check                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| RY0   | Inventory current fixes, reproduce representative failures, sanitize fixtures; existing test/lesson owners | Plan approval                                                         | Baseline paths, hashes, native evidence, dirty changes and missing evidence recorded                          |
| RY1   | Define slice-specific contracts and migration rules; existing schemas, workflow graph where needed, recall | RY0                                                                   | Human approves ownership, invalidation, compatibility and recovery matrix before changed consumers/writers    |
| RY2   | Extend existing shared review selection and state semantics; recall completion/transition/show             | Approved RY1 slice                                                    | Selection agrees across consumers; retries preserve history; conflict/commit outcomes are explicit            |
| RY3   | Add capability/dependency closure; Requirements, Architect, cost, Governance                               | Approved RY1 capability contract                                      | Incomplete required designs block readiness; authorized review of alternatives remains possible               |
| RY4   | Complete deterministic feasibility and command interfaces; existing validators and contract emitters       | RY0 and each affected input contract                                  | Known defects fail offline; valid near-neighbours pass; no zero-file false successes                          |
| RY5   | Make review/revision convergence explicit; parent agents, reviewer contract, review audit                  | RY2 attempt/input contract and relevant RY4 checks                    | Bounded repair/resume retains attempt history, closure and allowances                                         |
| RY6   | Render/validate handoffs and shrink duplicated runtime guidance; recall views, heading registry, agents    | RY2 validated view for renderer; existing registry for isolated fixes | Exact headings, bounded length, selected evidence and operation limits                                        |
| RY7   | Verify CodeGen through Deploy and As-Built boundaries; existing validation/handoff/drift contracts         | RY3-RY6                                                               | Both tracks preserve dependencies, permissions and plan conformance through non-deploying completion fixtures |
| RY8   | Independent source review, Local acceptance and staged publication                                         | RY0-RY7                                                               | Required safety/compatibility gates and bounded native scenarios pass; residual limits acknowledged           |

RY2 and RY3 may use separate implementation branches only if explicitly approved; default is small serial changes
on the existing feature branch. No concurrent writes to fixtures, state or the Git index. Start with one failing
test, make the smallest owning change, run it immediately, then expand only to required integration gates.
Batch labels group outcomes, not blanket dependencies. Isolated deterministic checks and handoff fixes need not wait
for capability modelling or review-convergence work. The implementation-session no-concurrent-write rule does not
replace RY2's runtime concurrency contract for separate Local sessions.

### Batch Specifications

**RY0: Baseline and evidence.** Reuse the supplied incident records; do not ask the user to repeat successful
module turns. Catalogue applied/published/uncommitted fixes separately, distinguishing retained regressions from
remaining defects and unverified hypotheses. Capture current review-selection APIs,
validator CLI signatures and schema versions. Create synthetic scenarios from observed failures without personal
data, subscription IDs, private policy definitions or raw chat logs. Include a clean successful path as a control.

**RY1: Contract design.** Specify each stage's required inputs, producer, validator, approval action, hash scope,
unknown/deferred states, permitted mutation and return owner. Distinguish completion from approval and deployment
from preview, code generation, discovery and read-only review. Identify the monitoring issue's originating decision:
whether Architecture omitted a required dependency or CodeGen introduced unapproved access flags. Do not assume
every Azure Monitor workload needs AMPLS. First classify the required producer/query paths and approved posture.
Contract changes require an explicit schema/version decision and test migration before consumer edits.
The relevant contract, compatibility matrix and owner recovery path require human approval before that slice's
consumer/writer changes or stricter gates. Resolve only that slice's decisions; do not require all-stage design first.

**RY2: Shared evidence/state semantics.** Extend the existing shared Governance/Plan replacement-selection helper
while retaining public flags. Store explicit selection per step/lens in the existing state/audit model;
resume readers consume that selection rather than parsing free-text rationale or guessing filenames. Bind reviews
to the exact consumed input set, including supporting contracts/evidence, not only the primary Markdown file.
Track approval scope separately from review validity. Design for changed files during validation, atomic writes,
duplicate completion calls, retries after interruption and preservation of original completion timestamps. Test
deep-lens completeness, historical invalid reviews, current blockers and selected-review drift independently.
Selection resolves the required review set, not one global "clean" file: independent Step 2 cost review and every
required deep lens remain mandatory. Previously selected evidence is revalidated on consumption.

Define `not committed`, `committed but index stale`, `already applied` and `conflict` outcomes. A failed precondition
leaves authoritative state and evidence unchanged; an index failure after commit must report the committed revision
and recovery action, never imply no write occurred. Repeated identical completion preserves timestamps and does not
reset the destination step. Specify a bounded concurrency strategy across participating writers, unique temporary
files and state/input revision checks through commit. Read-only validation must not silently restore a backup.
Index repair and primary-state recovery are explicit, separately scoped actions.

The current implementation separates state replacement from index updates, can restore backup state while reading,
and overwrites timestamps on repeat completion. These are source-verified properties, not reproduced concurrency
incidents. Test interruption and competing writers rather than claiming atomic rename solves the whole transaction.

**RY3: Dependency closure.** At Requirements, capture who needs each capability now: workload clients, operators,
telemetry producers, query users, deploy runners and identity administrators. Do not repeat known answers. Architect
must identify dependencies, owner and evidence for required capabilities: private access includes endpoints, DNS,
routes/client origin, authorization, subnet/IP capacity and cost. Shared resources require scoped discovery and
owner confirmation; a missing result is not tenant-wide absence. Deferrals require explicit capability acceptance,
not a network-security exception. Governance reconciles live rules without converting user preferences into policy.
Cost owner provides complete incremental scenarios, units, timestamp and FX; feasibility feedback returns before
Architecture approval. Security obligations and scope/budget conflicts go to the human, not automatic public fallback.
Evidence for discovery, access, capacity and cost includes scope, observation time, source, assumptions, owner and
verification status in the existing contracts. Byte freshness and operational evidence validity are separate results.
Design completeness gates approval/code generation; runtime reachability or observed ingestion may remain explicitly
unverified until separately authorized execution. A known missing required design path cannot use that distinction
to pass readiness. Permit specifically authorized read-only review of alternatives without implying approval.
Capability deferrals identify affected consumers, accepting owner and revisit condition; mandatory security obligations
cannot be deferred.

**RY4: Deterministic feasibility.** Reuse existing validators for name budgets across environments, scope compatibility,
dependency graphs, policy normalization, required provider constraints, exact module interfaces and parameter inputs.
Version service-specific rules with their source/API assumptions; avoid scraping prose for a generic proof of cloud
correctness. Add explicit CLI help and common path handling only where needed, preserving aliases and intentional
no-project behavior. Every targeted invocation returns checked inputs, PASS/FAIL/DEFERRED and actual diagnostics;
nonexistent explicit targets cannot pass. Provide an owner-invoked structured hash-sync operation restricted to
authorized draft bindings; it must not rewrite findings or approved artifacts. Validate all references afterward.
Use phase-scoped governance checks rather than ignoring future-stage failures from a full-chain validator.

**RY5: Review convergence.** Freeze content, formatting and supporting inputs before dispatch. Supply one compact
brief with consumed paths, validated constraints, prior IDs/dispositions and exact commands. The first comprehensive
review covers coupled prerequisites together; deterministic tool passes do not excuse semantic omissions. Persist
immutable per-invocation findings and explicit closure links without inflating pass numbers into invocation counts.
Batch authorized compatible repairs and rerun affected checks before a confirmation only within the applicable
remaining allowance or separately recorded explicit authorization. This proposal grants no new confirmation allowance.
Preserve ceilings across new chats and interruptions. New substantiated findings remain valid; no "confirm only"
instruction may hide regressions. Review-only requests cannot mutate artifacts or offer edit panels unless the user
expands scope.
Define durable attempt identity, input digest and interrupted/unknown outcomes in existing audit structures.
Distinguish reviewer invocations, artifact-repair allowances and identical-input empty-output retries. Unknown attempt
outcomes require conservative human reconciliation, not an automatic retry or inferred unused allowance. A selected
clean review must explicitly close or supersede prior blocking findings; their omission is not closure.
Do not introduce a scheduler. Document what Local Copilot can enforce and what remains human-controlled; source-text
ceiling checks and post-action log analysis are not runtime enforcement.

**RY6: Handoffs and runtime guidance.** Add an owner-invoked renderer/updater based on the existing heading registry
and validated recall view. Required content: completed/current steps, effective decisions, selected review paths,
open blockers, next human-selected owner and operation limits. Enforce the line bound without dropping safety facts;
if required content cannot fit, fail with a precise diagnostic rather than silently truncating. Preserve user-authored
content under an explicit ownership policy; do not rewrite files automatically on every state read. Generate command
reference snippets from actual parser contracts where practical. Keep essential stop/approval rules in agent bodies;
replace duplicate detailed procedures with one required phase-specific reference and tests of actual execution paths.

**RY7: Code to operations.** Preserve one-new-source-file cadence. Compile each eligible module, classify missing
scaffold dependencies accurately and test the full emitted graph when complete. Compare code with frozen contracts:
names, SKUs, scope, conditions, DNS, diagnostics, security and output bindings. A clean compiler cannot establish
service usability. The deployment gate consumes a validated IaC handoff plus resolved environment identities, current
policy evidence and explicit preview/apply permission; it never repairs upstream plans itself. As-Built compares
authorized observed state with intended contracts in both directions and reports unverified operations honestly.
No live deployment is part of the automatic program; any live acceptance needs separate user authorization.

### First Implementation Slice: Selected-Review Continuity

After approved RY0 inventory and a selector-specific RY1 decision, extend existing selection for Governance and
default-mode Plan only. Expose a structured effective-selection result for completion and validated resume
presentation. Retain public flags, historical audits, approvals and evidence. Legacy free-text audit entries require
explicit owner selection, never guessed parsing, filename ordering or automatic read-time backfill.

Reuse current freshness checks. Report unsupported legacy supporting-input coverage honestly; do not claim complete
binding or waive a required downstream check. Defer global review-hash changes, other review-mode extensions, capability
schemas and automatic handoff rewriting. Existing deep-mode restrictions and independent review requirements remain.
Implement only the approved slice's necessary writer/retry safeguards; wider runtime work stays in RY2.

Acceptance tests exercise the actual commands and consumers in isolated synthetic projects:

- Valid explicit Governance/Plan confirmations resolve identically for completion and resume; original evidence stays
  byte-identical. Revalidate stored selection rather than trusting its previous acceptance.
- No selection is inferred from names, timestamps or free-text rationale. Legacy insufficient evidence returns an
  actionable owner-migration requirement without mutating the project.
- Wrong project/lens/pass, stale inputs, missing files, unresolved blockers and unauthorized replacement fail closed.
  Preserve existing deep-mode replacement rejection and independent Step 2 cost-review requirements.
- Review validity creates no approval or operation permission; unchanged valid approval is not requested redundantly.
- Repeated identical completion preserves timestamps and destination progress. Input/state conflicts reject before
  commit; post-commit index failure reports the committed revision and does not repeat advancement on recovery.
- Bicep and Terraform consumers use the same selection semantics. Tests distinguish existing verified hash coverage
  from unsupported coverage; a matching primary hash alone cannot satisfy missing required evidence.

### Compatibility And Rollout

For every changed schema/selector, implement readers before writers and migrate synthetic fixtures before projects.
Existing approved projects remain byte-preserved. Compatibility readers may support old shapes only with sufficient
evidence for the same safety checks; otherwise return an actionable owner-migration requirement, never infer approval.
New mandatory fields are opt-in on fixture/pilot schema versions first, then enabled for new projects after approval.
Do not silently enforce an incompatible schema on a current approved project or silently grandfather an unsafe state.
Document the affected projects and explicit owner recovery path before enabling stricter gates.

| Legacy condition                                           | Required treatment                                                           |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Sufficient evidence under an explicitly supported contract | Continue only through its documented compatibility path                      |
| Newly required evidence absent or insufficient             | Preserve history; block the affected operation with an owner recovery action |
| Known unsafe condition                                     | Explicit blocker; no grandfathering                                          |
| Unsupported schema or rollback tool version                | Reject consequential writes; preserve readable evidence                      |

RY1 names supported contract/validator versions and the operation triggering migration. Checklist, protocol,
reviewer/model and validator changes need an explicit impact decision: existing review hashes include tooling inputs,
so unchanged project bytes alone do not guarantee reuse. Compatibility is not permission to ignore freshness failure.
Owner-authorized successor revisions or another approved versioned preservation mechanism must retain original bytes,
review links and approvals. Never edit old findings, restamp evidence or silently rewrite approved inputs to migrate.
Test rollback readers against newer fixtures before rollout; a source revert alone does not establish compatibility.

Roll out each batch as a separately reviewable change, retaining public CLI aliases and protected invariants.
Do not combine unrelated AVM cache churn with semantic changes. Publish only after focused tests and required hooks
pass, with local/remote SHA confirmation. Roll back through ordinary reviewed reverts and compatible readers;
preserve all project evidence and decision history, and never use force-push or destructive worktree reset.

### Human Decisions And Remaining Evidence

Before the affected slice, obtain explicit decisions on supported legacy contract versions and migration triggers,
the versioned preservation mechanism for approved-artifact revisions, and Local runtime concurrency policy
(single authorized writer or supported competing writers). Also approve treatment of ambiguous reviewer attempts
without automatic allowance renewal, and pilot acceptance scope: offline-ready versus Local end-to-end accepted.
Recording these as open decisions does not select an implementation or authorize production recovery.

Still unverified: native recurrence after the latest source fixes, Terraform runtime parity for the Bicep incidents,
the full emitted Bicep graph and wrapper interfaces, shared monitoring connectivity/capacity/complete incremental cost,
and the frequency of competing Local sessions or enforceability of attempt accounting. Reuse supplied evidence;
do not launch Azure discovery, new reviews or native production runs merely to fill this inventory.

### Verification And Release Criteria

- Behavioral tests, not only regex assertions: lowercase Deny omission, explicit zero-match target, invalid names,
  anomaly scope/date constraints, scope-function collision, missing dependency edges and missing client-path evidence.
- State tests on both completion commands: stale primary/supporting hashes, wrong artifact/lens/pass, missing approval,
  selected historical review, deep mode, interrupted/duplicate transition, concurrent change and no-write failure.
- Test oracles invoke public commands and actual consumers, assert exit status and output meaning, and compare
  before/after state/evidence bytes. Preloaded success flags or regex-only instruction checks do not prove transitions.
  Pair seeded failures with valid near-neighbours that must pass; test both IaC tracks.
- Additional negative cases: corrected policy facts versus obsolete recall assertions; insufficient discovery,
  conditional capacity and incomplete pricing; missing versus expired supporting evidence; interrupted attempts and
  exhausted allowances; index failure after commit; preview-only history rejected as deployment evidence.
- Lifecycle fixtures: clean Requirements-to-Lessons path for each track; one owner correction; one approved deferral;
  one resumed preserved review; one unavailable reviewer; one read-only discovery with incomplete scope. Use existing
  test harnesses, not a reintroduced E2E launcher. Fixtures must not manufacture production approval or Azure outputs.
  Offline As-Built tests use clearly labelled synthetic observed state and test intended/observed drift both ways;
  they are not deployment acceptance. Include Lessons output and retention of unresolved limitations.
- Current required suites: recall CLI/package tests in separate processes, script tests, agent/model/instruction
  checks, schema/Markdown/template checks through their designated owners, and relevant docs/link checks. Run Bicep
  and Terraform compiler/provider checks only with their actual prerequisites; skipped checks remain explicitly skipped.
- Independent source review must find no unresolved security, ownership, evidence-loss or compatibility blocker.
  Rubberduck is the requested second opinion on this plan, not the production Challenger approval for user artifacts.
- Local acceptance: one user-run end-to-end code-generation path per track and one bounded resume/failure case,
  grouped at stage boundaries. Avoid asking for logs after each successful module. Deployment acceptance remains
  separately opt-in. If runtime testing is unavailable, call the result offline-ready, not end-to-end accepted.

Measure before/after on comparable sanitized workloads and identical stage scope: avoidable user interventions,
failed commands from syntax/path mistakes, repeated reads, first-review detection of seeded defects, reopenings,
review invocations, elapsed time and recorded input/cache tokens. Do not turn token totals into billing or compare
partial tasks as full-workflow savings. Release requires zero unauthorized mutation/approval/bypass, all seeded
deterministic defects caught before approval-seeking review, and clean paths without redundant approval requests for
unchanged scope/inputs or failed command guesses. Distinct mandatory human gates remain required. Valid near-neighbours
must pass, and authorized read-only reviews of alternatives remain available. Correct stops for stale evidence,
exhausted allowances or incomplete modules are not avoidable-intervention failures.
Any remaining intervention must identify a genuine missing decision, unavailable dependency or new valid finding.

### FreshConnect Recovery And Next Action

Keep FreshConnect at its current monitoring reconciliation boundary. Do not widen access or fabricate shared-path
evidence to finish testing. The Architect must first present options matching current capability requirements and
qualified inventory/cost evidence; user approval precedes plan/contract changes and the required reviews. Preserve
already-built modules and revalidate only affected consumers after the owner-approved revision. This production
decision proceeds separately from implementing this repository plan.

Next repository action after explicit implementation approval: RY0, then the selector-specific RY1 approval gate and
the selected-review continuity slice in RY2. Amending this document does not authorize those actions. Review the smallest
contract proposal before adding new fields. If RY1 reveals a role/model/cadence/security change is necessary, stop for explicit
approval rather than expanding this plan's execution authority. Estimate implementation effort after the RY0 inventory;
do not promise a calendar completion date or quantified savings from incomplete baseline evidence.

### Authorized Delivery Record (2026-09-16)

The user authorized the remaining repository program and directed a source commit/push first. Checkpoints
`5028b659` and `a7fb51ed` were pushed before runtime implementation. The initial pre-push failure was caused by
scanning unpublished local Bicep drafts; the scoped fix validates all tracked entrypoints and preserves any project
failure. Its behavioral tests verify that an untracked draft does not suppress or contaminate tracked checks.

The following table supersedes earlier pending implementation language for the explicitly delivered offline scope;
it does not mark native/live acceptance, FreshConnect recovery, global capability modelling or unsupported review
mode migrations complete. All project artifacts, generated Bicep, approval history and current monitoring decisions
were left untouched by this implementation effort.

| Batch | Delivered offline outcome                                                                                                                                                       | Remaining acceptance or deliberate limit                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| RY0   | Entry revision/dirty hashes, isolated reproductions and retained regression inventory                                                                                           | Native concurrency frequency remains unknown                                                                           |
| RY1   | Additive selection/attempt and opt-in capability contracts; documented owner/migration and recovery semantics                                                                   | No automatic migration of approved projects; older writers must not be used on new contracts                           |
| RY2   | Shared explicit/stored selection; revalidated read-only show; revision/lock safeguards; idempotent completion and next-step transitions; explicit backup recovery/index outcome | Legacy primary-only coverage is labeled; no general approval engine, cross-file or power-loss transaction              |
| RY3   | Architecture capability dependency matrix and opt-in readiness validation, transitive declared dependency checks and approved non-security deferral handling                    | Evidence truth, capability completeness and operational observations remain owner/reviewer duties                      |
| RY4   | Exact help and invalid-target behavior, explicit L1-only trace, strict discovery timestamp/TTL checks, stdout-only draft hash synchronization                                   | Not a general Azure provider rules engine; service-specific deployment validation remains required                     |
| RY5   | Immutable attempt identities/outcomes, no cross-step/chained retry renewal, optional supporting-input hashes and membership snapshots                                           | Attempt logging is not a scheduler or authorization; legacy histories are not inferred or backfilled                   |
| RY6   | Canonical owner-invoked renderer with all open findings, no truncation, exact owner checks and guarded atomic handoff replacement                                               | State and handoff are separate commits; uncooperative editors are not serialized                                       |
| RY7   | Two-track synthetic lifecycle, review/operation preservation, existing compiler and deployment-boundary regressions                                                             | Synthetic completion is not generated-code end-to-end acceptance or observed deployed/As-Built correctness             |
| RY8   | Independent source reviews and repaired findings; required offline regression/lint/docs gates                                                                                   | Native Local acceptance, Windows locking, real Terraform/Bicep lifecycle and live operational checks remain unverified |

**Canonical interfaces:** see `tools/apex-recall/docs/show-schema.md` for effective selections, metadata, attempts,
commit outcomes and recovery. New tools are `tools/scripts/render-session-handoff.mjs` and
`tools/scripts/sync-draft-contract-hashes.mjs`; both default to read-only output. The handoff renderer writes only
under explicit `--write` plus an expected current SHA for replacement. The hash-sync preview never writes; owners
apply its full digests to an explicitly reopened, unapproved draft and validate before review. Capability readiness
is opt-in with `validate-iac-contract --readiness`; ordinary legacy validation does not claim capability coverage.

**Independent review closure:** the first state review found create-only initialization races, inconsistent selected
hash snapshots, unchecked no-op paths, replay resets, omitted existence watches, stale/index-backed views and weak
recovery validation. These were repaired and tested. The combined review then found dropped handoff findings,
supporting-directory additions, dangling symlinks, retry chains, malformed backups and unresolved transitive capability
dependencies. These were repaired with behavioral regressions. A follow-up isolated one stored-selection transition
bug; the correction was independently **APPROVED** after source inspection. This is source review, not Rubberduck
identity or a production Challenger verdict. One review accidentally wrote an ignored scratch diff; it changed no
source/project state, was disclosed, and is excluded from publication.

**Verification:** final regression run reported 166 recall package tests and 78 CLI tests passed in separate processes;
440 script tests passed, two optional tests skipped. New reliability tests include actual cross-process lock conflict,
public CLI stored selection on both tracks, input/directory drift during validation, duplicate and conflicting replay,
post-commit index failure, explicit recovery with damaged-byte preservation, renderer CLI replacement, retry-chain
rejection and a clearly synthetic Requirements-to-Lessons state lifecycle. Required Python/JavaScript lint, agent,
instruction, safe-shell, Markdown and documentation link checks passed. The supporting-input tests were rerun after
the final identical-branch simplification. No production state command or Azure operation was used for this evidence.

**Rollback/migration:** retain public flags and legacy read paths only where their evidence is sufficient. Structured
selection has no automatic rationale parser; absent legacy coverage requires explicit owner selection or a scoped
successor-contract decision. Do not roll back to an older writer that ignores new fields and concurrency rules.
Keep all reviewed bytes/audits. Reindex is explicit after exit 3; primary recovery requires its own reason and refuses
healthy state. Participating writes are serialized, but arbitrary editors, process termination and storage power loss
are outside the guarantee. Renderer locks abandoned by process termination require explicit investigation/removal.

**Release boundary:** this is an offline-ready source deliverable, not full end-to-end acceptance. The remaining
manual checks are grouped at stage boundaries: a Local clean path and bounded resume/failure on each IaC track,
with user-approved model/runtime access; platform-specific lock tests on Windows; and separately authorized live
preview/deploy/As-Built checks only if desired. Do not ask for logs after every successful module. No further Azure
or production review activity is authorized merely by the repository work. FreshConnect stays at monitoring design
reconciliation until its owner presents options and the user approves the required scope/cost/capability decision.

### RY0 Baseline And Findings (2026-09-16)

Authorization: the user approved the immediately preceding proposal to execute RY0 baseline inventory only.
This record does not approve RY1 contracts, runtime implementation, schema migration, publication or project recovery.
No FreshConnect state commands, Azure requests, production reviews, code generation or Git mutations ran in RY0.

**Source baseline:** `abcb908b7c35be06449730faa55da036cd8abee4` on `perf/apex-workflow-optimization`.
The index was empty. Dirty tracked sources at entry are recorded below; untracked project artifacts and infrastructure
under `agent-output/freshconnect-mini/` and `infra/bicep/freshconnect-mini/` are protected, excluded from fixtures and
publication, and were not read as production session state. Existing AVM cache changes remain separate user/generated work.
Hashes describe entry bytes before this RY0 documentation update, not a clean checkout or final publication snapshot.

| Dirty tracked path                                                           | Entry SHA-256                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `.github/agents/05-iac-planner.agent.md`                                     | `09e0825e023a06dacd0cd7dd3a28ad244f91d6d45ef90713d5fe8bf18478b67c` |
| `.github/instructions/iac-bicep-best-practices.instructions.md`              | `dd5dce769982cac83e69d3d6e2843f9a85f4cbbf3bccb34bf219f53e94107546` |
| `.github/skills/apex-iac-common/references/codegen-shared-workflow.md`       | `4d77e935f595bfe70019770d7c7d525e8bf40de32987c7c7f582ca88c34ffa06` |
| `.github/skills/apex-iac-common/references/contract-emission-and-handoff.md` | `a07dd13d71979233bc54e1332a753c0fdad965b3f75ac9ff77518f72f0fecf1e` |
| `.github/skills/apex-iac-common/references/iac-planner-approval-gate.md`     | `4740f0d05d692f7563db0600c5d8cceb1d2acf1687b4f4092f5cffc8c3c4778a` |
| `AGENTS.md`                                                                  | `f8e95d9a6e428374866b33c25de786e27845fa60045576ba88c48ad67ce31e1c` |
| `CHANGELOG.md`                                                               | `95747cbcdc3308996a513f8dbb400e7681ebc5183d206df36af23ab62bb8496d` |
| `site/src/content/docs/concepts/workflow.md`                                 | `8108a17ecdfb48a683eb49e70556a3be1d29ccb6dd30426d86a5eb47fb5e9d67` |
| `tools/apex-recall/src/apex_recall/__main__.py`                              | `8006a814688a276d466bd0b2264dca6163b91575a1c966bf2c4c7ea50ccec2a2` |
| `tools/apex-recall/src/apex_recall/commands/complete_step.py`                | `34fa969e2931a76d393f9af3aa5d6f5c7852e395477195797c299bcbc28b17d4` |
| `tools/apex-recall/src/apex_recall/commands/transition.py`                   | `746c784e209fe87401aed2ef2cfc2891e76e4a7ca395a56ce1210b78bed749fc` |
| `tools/apex-recall/tests/test_transition.py`                                 | `71685f611856066084d5f80c28333240415c871e1277f815bd704612f10ce59e` |
| `tools/scripts/_data/avm-module-cache.json`                                  | `3f8b4eaf152d4cf4acee2c6bf622ab53a126a2db9f4deb789889de24b982e7b5` |
| `tools/tests/exec-plans/active/apex-workflow-optimization.md`                | `73ace99f607db610993ddd5b4f997193501afa3aad04fb9d9fb5aff4e75cf192` |
| `tools/tests/exec-plans/active/skill-remediation.md`                         | `0c1e43832b373aea5b87a832309707b90e59d6c7f8d979994e8879a5ef769c67` |
| `tools/tests/scripts/test_guidance_remediation.mjs`                          | `923ed4a76e1a9c9b711168abd4c4a00c461d7f62639e0b3b77c877ab64434bda` |

Additional read-only anchors at the baseline revision: `state_writer.py`, `commands/show.py` and
`tools/scripts/validate-challenger-findings.mjs` were unchanged from HEAD. Toolchain: Node 24.21.0, Python 3.14.7,
Bicep 0.47.16 and Terraform 1.16.2 on Linux ARM64. Runtime model eligibility and production concurrency remain untested.

#### Current Contract Inventory

- State writer emits `schema_version: "3.0"`; existing fixtures also exercise legacy migration. There is no new
  schema/version introduced by RY0. `show --json` reads the index and exposes `.session.steps`, `.session.decisions`,
  `.session.open_findings` and `.session.decision_log`, not a structured effective-review selection or validity result.
- `complete-step` and `transition --complete` share `_select_replacement_review`: explicit Governance and default-Plan
  paths/reasons are accepted; Plan deep-mode substitution and mixed selectors are rejected. Selection is stored as
  filename/pass/hash text inside an audit rationale, not a structured value read by `show` or future completion calls.
- The strict findings validator binds primary artifact/directory bytes, checklist, protocol, reviewer source/model
  and combined hash. It does not bind a declared complete set of separately consumed supporting files. This is a
  coverage limit, not proof those files changed. IaC contract references independently bind plan/policy-map content.
- Reviewed contract generations in the current workflow include `iac-contract-v0/v1`, `policy-property-map-v1`,
  `environment-manifest-v1` and findings `1.0`; supporting-input migration must not silently mutate approved examples.
- Orchestrator and both CodeGen bodies consume recall/artifact evidence through instructions. They do not receive a
  common machine-computed effective-selection view. Existing shared guidance already recognizes explicit confirmations;
  RY2 must connect actual readers to that view, not merely add another reminder.
- Existing commands remain authoritative: artifact-path contract/consistency/map/environment checks; `--verify-cache`
  belongs to the findings validator; recall `show <project>` and `decisions --project <project>` have different syntax.

#### Reproduction Results And Disposition

| ID     | Observation                                                                                          | Evidence class                                             | Disposition                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| RY0-01 | Explicit Governance/Plan replacement, wrong bindings, missing reason, bypass and deep-mode rejection | Existing isolated command fixtures pass                    | Retain current safety checks; extend continuity, do not rebuild selectors     |
| RY0-02 | Selection remains free-text audit data; show has no effective-selection result                       | Current source inspected                                   | Remaining RY1/RY2 contract gap                                                |
| RY0-03 | Repeating valid completion changes the original completion timestamp                                 | Synthetic CLI reproduction with controlled clock           | Remaining idempotency defect                                                  |
| RY0-04 | Injected index failure returns CLI exit 1 after primary state already says complete                  | Synthetic CLI reproduction with index fault                | Remaining ambiguous commit outcome; not a precondition failure                |
| RY0-05 | Review validation on corrupt primary state restores its valid backup                                 | Synthetic validation-path reproduction                     | Remaining read-side mutation; needs explicit recovery contract                |
| RY0-06 | Primary review hash excludes separately consumed supporting artifacts                                | Current validator source inspected                         | Explicit legacy coverage limit; migration decision required                   |
| RY0-07 | Concurrent writers can contend over shared temp path and read/write windows                          | Current source inspected only                              | Race frequency/outcome unverified; no claim of reproduced lost updates        |
| RY0-08 | Lowercase Deny, zero-target CLI and anomaly deployment constraints                                   | Existing behavioral fixtures pass with valid controls      | Retain implemented fixes; do not count as remaining defects                   |
| RY0-09 | Scope-function collision reproduces and role-specific symbol compiles                                | Existing real Bicep compiler fixture passes                | Retain regression; no need for repeated native probe                          |
| RY0-10 | Handoff and monitoring-path guidance assertions pass                                                 | Source-contract tests and supplied native incident records | Native recurrence prevention and general semantic detection remain unverified |

Existing regression runs: recall package **143 passed**, separate recall CLI **78 passed**, guidance suite **28 passed**.
The guidance suite contains both behavioral/compiler checks and regex assertions; its total is not a count of runtime
guarantees. No full deployment, native user-agent replay, network discovery or new independent review was performed.

Scratch-only probe `tmp/ry0_baseline_test.py` reused synthetic-project helpers from `test_transition.py`, set
`APEX_ROOT` to pytest temporary roots, and ran actual CLI entrypoints for RY0-03/04 and the current review-validation
function for RY0-05. **Three observation tests passed** after correcting an initial probe assumption: the CLI catches
the injected index exception and returns 1 rather than propagating it. These tests assert current undesirable behavior
for inventory; they are not regression gates declaring that behavior correct. Probe SHA-256:
`b24745fe3f9d59810d08945e0f9ec52dc3ceae3b74f7cfb63c5d29a6b6182519`.

Reproduction recipes retained here if ignored scratch files are unavailable:

1. Seed a synthetic project plus a valid Plan review using existing metadata fixtures; invoke `complete-step` twice
   with different controlled `_iso_now` values. Both return 0; the completed timestamp changes.
2. Seed the same valid project; inject failure in `state_writer._reindex_file`; invoke the public CLI completion.
   It returns 1 with an index error, while the primary JSON has already committed complete status.
3. Seed valid state and review; retain a valid `.json.bak`, corrupt only the synthetic primary, and invoke
   `_challenger_findings_invalid` for Step 4. The review passes and the primary is restored during the read path.

#### RY1 Decision Packet: Proposed, Not Authorized

Recommended first contract decisions, to be approved before implementing changed readers/writers:

| Decision             | Recommendation                                                                                                | Boundary                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Selection storage    | Add a versioned structured per-step/lens selection to the existing state contract; audit remains append-only  | Governance/default Plan only; no global hash or deep-mode redesign in first slice                 |
| Legacy compatibility | Preserve existing supported review validation; legacy audit text requires explicit owner selection            | No rationale parsing, latest-file inference or read-time backfill                                 |
| Read semantics       | Show/validation never repair primary state; report recovery-required and expose committed/index status        | Backup restore and reindex are explicit owner actions                                             |
| Repeat calls         | Revalidate evidence, then return already-applied for identical completion without timestamp/destination reset | Changed inputs or requested operation require a distinct decision, not idempotent success         |
| Writer conflicts     | Per-project serialization for participating writers plus revision/input rechecks and unique temporary files   | No claim of protection from uncooperative external editors; mutation during validation must block |
| Approval handling    | Preserve historical approval and require the owner to establish current operation scope                       | Review selection alone cannot mint approval; old free-text history is not silently migrated       |
| Pilot                | Isolated fixtures and offline-ready consumer tests first, then separately authorized Local acceptance         | FreshConnect migration/design recovery and deployment remain excluded                             |

No option above is implemented or selected by recording it. Before RY2 work, RY1 must specify exact fields/version,
failure outcomes, affected writers/readers, backward/rollback behavior and acceptance tests for the approved choices.
RY0 is complete as an inventory/reproduction batch, not as a repaired runtime or whole-program approval. The next
human gate is authorization of the selector-specific RY1 design and its decisions; no further RY0 log collection is needed.

### Second Opinion

Requested reviewer: **GitHub Copilot Rubberduck**. Review only after this draft is complete. Ask for failures in the
root-cause diagnosis, overlooked authority/compatibility risks, unnecessary abstractions, weak success metrics,
missing negative tests, sequencing flaws and a smaller viable first implementation batch. Require prioritized
findings and concrete amendments; do not treat reviewer preference as permission to change scope. Record the actual
invocation/result below and reconcile findings before calling the plan reviewed. If unavailable, retain the draft
and report the limitation; do not substitute another agent and label it Rubberduck.

**Attempt recorded 2026-09-16:** Tool discovery did not expose a Rubberduck capability. After completing and
validating this draft, the named invocation `github copilot rubberduck` returned `Requested agent ... not found`.
No second-opinion findings were produced by that invocation and no fallback reviewer was substituted.

**Direct second opinion recorded 2026-09-16:** The user subsequently requested a direct review with `/rubber-duck`,
prohibiting additional agents. The current assistant reviewed this section, linked incident records and relevant
local implementation without edits, project-state operations, tests or Azure operations. Verdict: **NEEDS REVISION**.
This was a direct second opinion, not a successful invocation of the unavailable standalone Rubberduck capability
and not a production Challenger review. Native observations came from supplied audit records; current source checks
supported the stated implementation properties, not new runtime reproductions.

The user then authorized amendment of this plan only. Findings are incorporated as follows:

| Finding                                            | Priority | Amendment                                                                        |
| -------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| Historical approval versus current readiness       | High     | Approval/readiness/invalidation matrix and decision provenance                   |
| Executable compatibility, not only preserved bytes | High     | Versioned migration matrix and explicit RY1 human gate                           |
| Narrow transaction guarantees                      | High     | Commit/index/conflict outcomes, idempotency, recovery and concurrency tests      |
| Review convergence and durable allowances          | High     | Attempt identity/outcomes, distinct budgets and explicit prior-finding closure   |
| Hash freshness versus operational validity         | High     | Scoped evidence qualifiers and design/runtime readiness distinction              |
| Over-broad sequencing                              | Medium   | Output-specific dependencies and selected-review continuity first slice          |
| Weak or ambiguous test oracles                     | Medium   | Real command assertions, valid controls, synthetic As-Built and Lessons coverage |

Disposition: addressed in the proposed design, not implemented or independently reverified. Open human decisions
remain listed above. The earlier verdict is retained as history; no new READY verdict, implementation approval,
production approval, review allowance, commit or publication is implied by this amendment.

## Delivered Workflow Batch (A01-D05)

The checklist below governs the earlier published workstream only. Its authorizations and completed statuses
do not automatically approve or close the later [deep skill remediation](skill-remediation.md).

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
- [x] A15 Run relevant regressions, reconcile the ledger, and publish the verified backlog-closeout batch.

Phase A implementation and review are published in commit `ea6db336`; full validation passed.
The earlier HTTP 403 was a Git/CLI credential mismatch. On 2026-09-11 the user explicitly authorized
the existing `jonathan-vella` CLI credentials for publication. An invocation-local credential helper
pushed the feature branch with normal hooks; no persistent Git configuration changed.

### Phase B: Skill Merger And Retirement Plan

Begin after Phase A is resolved. Manual acceptance does not block this planning stage.
Do not treat the previous inventory's Keep labels as a completed merger/retirement analysis.

- [x] B01 Refresh the active skill inventory and map discovery triggers, capabilities, consumers, references,
      scripts/templates, provenance, and upstream update mechanisms.
- [x] B02 Compare semantic overlap and choose per skill: keep, share procedure, merge, or retire.
      Distinguish shared implementation from genuinely equivalent discovery/decision responsibilities.
- [x] B03 For each proposed merge/retirement, identify the surviving owner/replacement, unique rules to preserve,
      consumer migrations, quality risks, regression scenarios, and rollback procedure.
- [x] B04 Produce the decision-oriented plan, including justified retentions, unresolved evidence, execution batches,
      and an old-to-surviving-name map that will feed the later prefix migration.
- [x] B05 Apply the pre-authorized decision policy: select merges/retirements with preserved capabilities and review
      evidence; retain inconclusive candidates. Do not introduce protected behavioral/schema changes
      or pause for routine approval.
- [x] B06 Implement qualifying merges/retirements and update all live consumers, tests, documentation and generated views.
- [x] B07 Validate capability/discovery preservation and freeze the surviving skill set before renaming it.

The audit's Skill Merger And Retirement Plan records every survivor and rationale. All entrypoints survive;
two proven-equivalent reference procedures are shared. Focused equivalence/reachability tests and independent
review pass; discovery descriptions are unchanged. This is not native discovery or output-quality acceptance.

### Phase C: Rename Surviving Skills With apex-

The user requests this phase after the skill merger/retirement work. Prefix every surviving active repository-owned
skill exactly once: for example, `azure-defaults` becomes `apex-azure-defaults`.
This is a naming migration, not permission to change skill behavior, models, review frequency, or output contracts.
External/user-profile/plugin skills outside this repository are not renamed. Preserve imported attribution and licenses.

- [x] C01 Build the final old-to-new map from Phase B's survivors; check collisions, existing prefixes,
      directory/frontmatter name equality, kebab-case, and the supported skill-name length limit.
- [x] C02 Inventory name/path consumers before moving files: agents, prompts, skills/references/templates,
      instructions, root/subtree guidance, scripts, tests/fixtures, hooks, CI, setup/export/sync tooling,
      registries, schemas/mappings, context snapshots, and published documentation/downloads where applicable.
- [x] C03 Apply the clean-rename decision: document breaking skill-name/path changes, the migration map, and upstream
      refresh mappings. Remove old names after migrating live repository consumers; no duplicate discoverable wrappers.
- [x] C04 Rename surviving skill directories and matching SKILL.md frontmatter names; avoid double-prefixing.
      Preserve scripts, templates, examples, attribution, and relative-reference behavior.
- [x] C05 Update live references and literal skill invocations, parser/validator assumptions, path globs,
      fixtures, setup/sync consumers, and public documentation to the new names and paths.
- [x] C06 Regenerate affected inventories/catalogs/Explorer views through their owners. Preserve immutable archives,
      prior execution artifacts, historical changelog entries, and baseline hashes;
      document legacy names rather than rewriting history.
- [x] C07 Search old names/paths and classify every remaining match as intentional historical/external/compatibility
      evidence or a missed migration. Verify no current required consumer points to a removed path.
- [x] C08 Run skill discovery, name-directory, reference, model, workflow, schema and tooling tests;
      include fresh/resume/revision cases for both IaC tracks without changing their approval/security contracts.
- [x] C09 Publish the validated migration and concise old-to-new map with rollback instructions on the feature branch.

### Phase D: Final Verification And User Testing

- [x] D01 Run the complete automated validation suite and focused negative/recovery tests after all implementation.
- [x] D02 Obtain independent review of remaining changes; fix findings and rerun affected checks.
- [x] D03 Reconcile A01-D03 and deliver one manual-test checklist covering native skill discovery,
      fresh/resume/revision workflows, required reviews, both IaC tracks, and validation-only/preview-only boundaries.
- [ ] D04 USER STAGE: user performs manual UI and full generated-output testing after autonomous implementation is complete.
- [ ] D05 POST-TEST STAGE: remediate reported findings, repeat relevant checks, and obtain the user's final quality signoff.

### Final Local Verification And Handoff

Published commits: `ea6db336` (Phase A), `d41507cc` (procedure sharing and survivor decisions),
`c3246ea1` (naming migration), and `d6d3614f` (preserved tracking for moved vendor snapshots).
The authorized owner-credential push advanced the remote feature branch from `36f3962c` to `d6d3614f`;
all pre-push checks passed. A01-D03 are complete. No force-push, hook bypass, main merge or Azure write occurred.

Later editor/formatter activity recreated old-name skill files. Independent comparison found no unique
semantic changes to port. All originals were moved out of discovery, without content changes, to ignored
`tmp/apex-optimization/restored-skills-preserved/`; its `manifest.json` records verified SHA-256 hashes.
Current prefixed skill validation passes. User formatting edits to this plan and the audit are preserved.

The full final `npm run validate:all` passed, including Node validators, Python/recall checks and built-site
link checks. Focused checks cover naming failures, native aggregate syntax, template-only hooks, historical
inventory/trace compatibility, current discovery redirects, real Bicep compiled evidence and Terraform local
module initialization. Independent final review found no confirmed migration regression.

Every surviving skill has exactly one prefix and aligned directory/frontmatter. The audit's tracked map
is the migration and upstream-refresh guide. Public npm aliases, dependency contracts, models, agent identities,
instruction filenames and schema bytes are unchanged. Historical demo/archive/snapshot evidence is preserved;
only new Unreleased changelog entries were added. Explorer nodes/edges remain equivalent after name normalization.
Original discovery redirect identifiers were subsequently migrated, not treated as immutable provenance metadata.

Bounded named Orchestrator, Bicep/Terraform Deploy and CodeGen probes resolved renamed guidance and retained
required stop/ownership boundaries. These are decision probes, not full native UI conversations or generated
workload comparisons. Partial-file recovery and full artifact completeness still require manual acceptance.
No live Azure operation, native slash-menu acceptance, end-to-end token saving or full output equivalence is claimed.

### Manual Validation Checklist

- [ ] Reload the VS Code window; confirm each repository skill appears once under its `apex-` name, with no
      old-name wrappers. Verify external/user-profile skills remain unchanged.
- [ ] Invoke representative imported and local skills by name and natural-language trigger. Check cross-skill
      redirects, linked references, templates and scripts load without missing-path errors.
- [ ] Start fresh Bicep and Terraform projects: required elicitation precedes artifact work; Phase 3 runbook
      access does not fabricate user answers; track/review choices persist without redundant questions.
- [ ] Resume each track after compaction and with partial generated files. Verify existing user edits survive,
      partial agent output is repaired rather than discarded, and one-file generation cadence remains unchanged.
- [ ] Revise budget, region, SKU and plan inputs; confirm current evidence is reused only when equivalent,
      changed inputs invalidate reviews/previews appropriately, and upstream changes return to their owner.
- [ ] Skip optional Design with missing/stale Governance; confirm discovery/reconciliation and approval still gate planning.
- [ ] Confirm Step 2 requires both architecture and independent cost-feasibility reviews, and unresolved blocking
      findings cannot advance either production or unattended workflows.
- [ ] Request validation-only and preview-only on both tracks. Confirm no preparation, bootstrap, deployment,
      state migration, workspace creation or apply occurs beyond the requested boundary.
- [ ] Inspect generated Bicep ARM evidence and Terraform dependency/backend/workspace checks. Confirm validators
      do not fabricate plan approval, mutate frozen inputs, or upgrade approved pins.
- [ ] Compare complete generated artifacts against approved requirements, SKU manifest and governance constraints;
      verify completeness, naming, security, costs by environment/region/stamp, diagrams and as-built traceability.
- [ ] Run a read-only Context Optimizer audit; verify leaf workers are included and no snapshot/report/state writes occur.
- [ ] Record observed failures, affected files, reproduction prompts and expected behavior for D05 remediation.

Rollback: revert `d6d3614f` then `c3246ea1` together on this feature branch to restore paths and callers.
Revert `d41507cc` separately to undo procedure sharing, or `ea6db336` for Phase A behavior changes after review.
Use new revert commits with normal hooks; do not reset user work or rewrite historical evidence. Restoring only
skill directories without consumers is invalid. Publication is complete; D04-D05 still require user testing,
reported findings, remediation and explicit quality signoff. Do not infer acceptance from automated checks.

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
