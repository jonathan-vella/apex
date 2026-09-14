# Skill And Agent Contract Remediation

## Status And Authority

Created 2026-09-14. Status: **proposed roadmap; implementation not started**.
The user authorized fixing tracking before starting the changes. No new remediation, deletion, public-command
change, model change or cloud operation is approved solely by this plan.
Program index: [master roadmap](apex-workflow-optimization.md#master-roadmap-and-tracking).
Stable findings, evidence and per-skill rationale: [SK ledger](apex-workflow-audit.md#deep-skill-audit-backlog).
Earlier delivered migration: [agent modernization](agent-modernization.md). Preserve its completed history.
On 2026-09-14 the user authorized step 1 only: record the latest body findings, cross-link the backlog,
validate tracking and commit the planning documents. This does not start R1 or approve pending implementation choices.

## Completion Rules

The audit owns finding definitions and per-ID status. This plan owns batch order and dependencies.
Use the master's status vocabulary; track approval separately from implementation, publication and manual acceptance.
All batches below start `proposed`, approval `pending`, implementation commit `none`.
SK-01 through SK-47 must each end in a verified fix or an explicit evidence-backed disposition, never silent omission.
The same rule applies to AB-01 through AB-22 in the [agent-body ledger](apex-workflow-audit.md#agent-body-audit-backlog).
An inconclusive consolidation can be retained; an unresolved correctness defect cannot be marked fixed that way.

## Ordered Roadmap

| Batch | Scope / Finding IDs                                                                                                                                | Dependencies                                                       | Exit Criteria                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| R0    | Approve scope, preserve current edits, reproduce findings and record decisions                                                                     | None                                                               | Current baseline, protected-file inventory, scope decisions and reproduction results recorded; no assumed fixes    |
| R1    | Governance correctness: SK-01, SK-02, SK-03, SK-04, SK-05, SK-06                                                                                   | R0                                                                 | Offline assignment/exemption/cache/pagination/signature fixtures preserve blockers and provenance                  |
| R2    | Destructive/security boundaries: SK-07, SK-08, SK-09, SK-15, SK-16, SK-17, SK-18                                                                   | R0                                                                 | Negative fixtures preserve user files, credentials, state and secrets; no unauthorized execution                   |
| R3    | Workflow and preparation contracts: SK-10, SK-11, SK-12, SK-13, SK-14, SK-24, SK-25                                                                | R1, R2                                                             | Lower-level recipes honor owner/gate boundaries; composition/protocol fixtures verify output contracts             |
| R4    | Pricing, policy examples and service correctness: SK-19, SK-20, SK-21, SK-22, SK-23, SK-26, SK-27, SK-28, SK-29, SK-30, SK-31, SK-36, SK-37, SK-38 | R1-R3                                                              | Canonical examples pass semantic checks; identity, units, bounded queries, command failures and links are covered  |
| R5    | Evidence and policy consistency: SK-32, SK-33, SK-34                                                                                               | R0                                                                 | Missing evidence recovery preserved; cache timestamps truthful; canonical principles explicitly selected           |
| R6    | Entry-point, reference and invocation policy: SK-39, SK-40, SK-41, SK-42, SK-43, SK-44, SK-45, SK-46, SK-47                                        | Applicable fixes R1-R5; explicit merge/delete/visibility decisions | Preserve triggers, output, permissions and recovery; fork remains deferred unless separately approved and verified |
| R7    | Catalogs and integration: SK-35; all changed callers/tests/generators                                                                              | R1-R6                                                              | Current inventory and links match source; full offline suite and independent review pass                           |
| R8    | Publish, hand off and remediate acceptance findings                                                                                                | R7                                                                 | Verified feature commits and rollback recorded; manual acceptance remains open until user results/signoff          |

R1 and R2 are independent slices if separately assigned; do not run fixtures concurrently when they stage into
shared source paths. R5 may be investigated early but policy selection must not be guessed. R6 work is eligible
only after its own source defects and permission decisions are resolved; do not consolidate broken examples first.
Within every batch, use small edits and immediate focused checks instead of waiting for final integration.

## Agent Body Remediation

This extends the existing roadmap; it is not a second implementation queue. Related SK and AB IDs share
one reproduction/fix when they describe the same contract. Approval remains pending for source changes.

| Batch | Additional Body IDs | Acceptance / Ordering |
| --- | --- | --- |
| R0 | All AB items | Record current body and canonical consumer before implementation; preserve user changes and models |
| R1 | AB-06, AB-07, AB-16 | Reconcile governance freshness, confirmations and policy truth tables alongside SK-01-SK-06 |
| R2 | AB-17, AB-19, AB-20 | Bind preview scope, preserve replacement order and isolate scratch evidence alongside state/file safety fixes |
| R3 | AB-02, AB-03, AB-04, AB-05, AB-08, AB-09, AB-10, AB-11, AB-12, AB-13, AB-18, AB-21, AB-22 | Resolve ordering, ownership, outputs and failure channels before cosmetic normalization; review any policy choice explicitly |
| R5 | AB-14 | Align source-only auditing and measured evidence requirements alongside SK-32 |
| R6 | AB-01, AB-15 | Normalize headings and remove redundant authoring prose only after the applicable semantic fixes pass |
| R7 | All affected AB items | Cross-agent/skill contract tests, independent source review and complete integration suite |
| R8 | All verified AB items | Commit/publication evidence and separate manual acceptance; no static claim of native behavior |

The body audit found no remaining XML operating wrappers. Do not perform blanket angle-bracket removal:
command placeholders, fenced schemas and intentional HTML/XML examples are content. Use one H1 and consistent
peer H2s for runtime instructions; preserve worker-specific output modes and all machine-consumed labels.
Do not solve mismatched outputs by silently changing artifact schemas or broadening worker authority.
The next implementation candidate is R0 approval/reproduction followed by R1, not another broad audit.

## Decisions Before Implementation

| Decision                               | Recommended Default                                                                                   | State                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Remediation scope                      | Correct reported defects after current reproduction; retain protected production contracts            | Pending user authorization                                                            |
| Host merge                             | Merge resume into workflow-start with explicit resume mode; retain commit and export separately       | Proposed, not approved                                                                |
| Public slash compatibility             | Record old-to-new command map and deliberate alias/clean-retirement choice                            | Pending; do not infer consent from earlier skill-prefix migration                     |
| Skill menu visibility                  | Hide internal guidance only; retain model loading and public task skills                              | Proposed in SK-46; review slash consumers before changing visibility                  |
| Forked skill context                   | Keep current skills inline; evaluate only bounded standalone read-only candidates                     | SK-47 proposed; experimental feature and runtime evaluation require separate approval |
| Canonical principles and retry choices | Preserve unique safety requirements; present contradictory alternatives for explicit policy selection | Pending                                                                               |
| Recreated duplicate files              | Recompare current content and preserve originals before any approved removal                          | Pending; user/editor changes remain untouched                                         |
| Evaluation                             | Start with offline fixtures/local compilation; report unavailable SDKs and unresolved external claims | No live Azure/model evaluations authorized by tracking work                           |
| Publishing                             | Existing feature branch, normal hooks, no PR/main merge/force push                                    | Confirm batch execution/publication scope at start                                    |

Model assignments, agent roles, production artifact schemas, mandatory reviews, separate Step 2 cost review,
governance precedence, frozen-plan ownership, one-file cadence and human approvals remain unchanged unless
the user separately authorizes a specific contract change. No E2E subsystem is restored for testing.
Documentation/examples imported from elsewhere retain licenses, attribution and upstream identity.

## Skill Invocation And Context Policy

Added 2026-09-14 at the user's request, based on the
[VS Code Agent Skills documentation](https://code.visualstudio.com/docs/agent-customization/agent-skills).
This section is a proposed implementation policy, not a change to current SKILL.md files.
The current inventory defaults to visible, model-loadable, inline skills, except the Host adapters, which
already explicitly use `user-invocable: true` and `disable-model-invocation: true`. No current skill uses fork.

### Field Semantics And Limits

| Field                      | Documented Meaning                                                                                   | APEX Treatment                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`                     | Required; lowercase letters, numbers and hyphens; directory match; maximum 64 characters             | Retain exactly one `apex-` prefix as an ordinary hyphenated name. `apex/foo`, `apex:foo` and dots are invalid; plugin command namespaces are supplied by the platform.                     |
| `description`              | Required; what and when; maximum 1024 characters                                                     | Describe distinct discovery intent. Identify the existing stricter repository length policy as local policy, not a VS Code limit; do not expand descriptions merely to fill the allowance. |
| `argument-hint`            | Optional slash-command input hint                                                                    | Add concise task-specific arguments for visible commands; hints do not validate input or grant approval.                                                                                   |
| `user-invocable`           | Defaults true; false hides slash-menu entry without disabling automatic loading                      | Use false for internal guidance, after checking explicit slash callers. This reduces menu clutter, not necessarily discovery tokens.                                                       |
| `disable-model-invocation` | Defaults false; true prevents relevance-based automatic loading and requires manual slash invocation | Retain true for explicit Host operations. Do not disable shared guidance relied on by agents to perform required checks.                                                                   |
| `context`                  | Defaults inline; fork runs in a dedicated subagent context and returns its final result              | Omit the field for the inline default. No current blanket fork rollout is proposed.                                                                                                        |

The two boolean fields control different axes. False/false means hidden but automatically loadable;
true/false means visible and automatically loadable; true/true means visible and manual-only.
False/true disables both normal discovery routes and must not be used for active required skills.
These are skill invocation semantics, not the custom-agent caller-allowlist rules. None of the fields grants
tools, selects a model, supplies consent, makes terminal access read-only or overrides production ownership.

### Proposed Per-Skill Assignment

This table accounts for the current catalog. Both boolean values are shown explicitly for review; implementation
may omit fields whose defaults are intended. Reassess merged survivors rather than maintaining duplicate policies.

| Skills                                                                                                                | user-invocable | disable-model-invocation | Context / Rationale                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apex-azure-defaults, apex-azure-artifacts, apex-azure-bicep-patterns, apex-terraform-patterns                         | false          | false                    | Inline; policy, artifact and language guidance must influence the calling agent's work                                                                              |
| apex-iac-common, apex-golden-principles, apex-workflow-engine                                                         | false          | false                    | Inline; shared execution/recovery and operating rules, not separate user tasks                                                                                      |
| apex-host-workflow-start, apex-host-resume-workflow                                                                   | true           | true                     | Inline; explicit owner selection and approval gates. Apply the same policy to the SK-39 merged survivor if approved                                                 |
| apex-host-git-commit, apex-host-debug-log-export                                                                      | true           | true                     | Inline; retain distinct write/privacy consent and user interaction. Do not fork or grant combined tool permissions                                                  |
| apex-agent-authoring, apex-docs-writer, apex-vendor-prompting                                                         | true           | false                    | Inline; useful explicit tasks and automatic specialist guidance. Read-only audit variants alone may qualify for a future isolated experiment                        |
| apex-context-management                                                                                               | true           | false                    | Inline; mixed runtime compression, audit and export scope. Forking the whole skill would withhold operating guidance from the parent                                |
| apex-microsoft-docs, apex-azure-compute                                                                               | true           | false                    | Inline by default; strongest conditional fork candidates only for fully specified read-only lookup/recommendation tasks                                             |
| apex-azure-compliance, apex-azure-cost-optimization, apex-azure-resources, apex-azure-diagnostics, apex-azure-kusto   | true           | false                    | Inline; preserve discovery, evidence and optional reporting/remediation boundaries. Assess read-only subsets separately, not whole-skill fork conversion            |
| apex-azure-prepare, apex-azure-validate, apex-azure-deploy, apex-azure-cloud-migrate, apex-azure-governance-discovery | true           | false                    | Inline; current agent and generic-workflow callers need these skills. Explicit request, owner and approval checks still precede consequential actions               |
| apex-azure-quotas, apex-azure-rbac, apex-azure-storage, apex-entra-app-registration                                   | true           | false                    | Inline; shared knowledge and user tasks coexist with potentially mutating operations. Metadata does not authorize requests, assignments, data writes or credentials |
| apex-github-operations                                                                                                | true           | false                    | Inline; existing agents need Git guidance. Manual commit entry remains a separate Host adapter rather than making all Git knowledge manual-only                     |
| apex-mermaid, apex-python-diagrams, apex-azure-adr                                                                    | true           | false                    | Inline; preserve user-visible creation tasks and selected output/decision contracts                                                                                 |
| apex-terraform-search-import, apex-terraform-test                                                                     | true           | false                    | Inline; preserve import/test discovery and existing caller use. Require explicit state/apply/cleanup authorization; do not infer safety from a fork                 |

For visible commands, propose hints such as `operation project` for workflow entry, `query or documentation URL`
for research, `artifact path and scope` for audits, and `test path and plan/mock mode` for Terraform tests.
Never put tokens, passwords or other secret values in suggested arguments. Do not mechanically add hints to hidden guidance.
Hiding internal skills changes direct slash access: update guides, prompts and external-integration notices before rollout.
If a real standalone use case would be lost, retain that skill's visible entry instead of enforcing a cosmetic taxonomy.

### Fork Eligibility And Guardrails

`context: fork` is experimental. The documentation requires `github.copilot.chat.skillTool.enabled` for this
feature; it does not establish equal behavior in every Local/Agent Host version. Test each intended harness
separately before claiming support. Do not enable the setting or add fork metadata as part of this planning update.
The previous no-fork production baseline remains in force until a specific experiment is authorized.

Consider only tasks that have complete explicit inputs, a bounded final result and no need to change the
parent's ongoing instructions. A standalone Microsoft Docs lookup or VM comparison may qualify; a whole
mixed-purpose skill does not qualify merely because it is large. A separate wrapper is justified only if it
removes real complexity and preserves both modes; do not create another fleet of near-duplicate skills.

- No user questions, approval panels, workflow transitions or required parent-context policy may disappear into a fork.
- Treat writes, report export, authentication, secrets and network access as explicit task permissions, not isolation benefits.
- Supply required context and output/failure contracts; test missing inputs and unavailable models/tools/features.
- Never use a fork to bypass the main-agent invocation boundary or the configured review worker and its model.
- Retain pricing, review and policy workers as their existing custom subagents;
  do not nest or replace them with forked skills.
- If the feature is unsupported, return a clear blocker or offer a separately approved inline invocation; do not silently
  change execution mode, drop evidence or invent a result.
- Compare result completeness, source citations, permission behavior and measured context usage before adoption.
  Fewer visible commands or a shorter parent summary is not proof of token savings or output equivalence.

### Implementation Surfaces And Acceptance

SK-46 owns final metadata decisions, description/hint quality and menu changes; SK-47 owns fork feasibility
and its retain/defer decision. Their default state is proposed, with no rollout or experiment approval.
Perform these after the relevant SK-39-SK-44 ownership/merge decisions, so metadata reflects surviving skills.

Update skill frontmatter, authoring instructions, validator rules, discovery/index tests, Local/Host adapters,
published catalogs and Explorer together. Expose effective invocation/context metadata in generated views and
distinguish omitted defaults from explicit policy where useful. Preserve names, models, attribution and public
commands except separately approved visibility or merge changes. No new parallel metadata registry is needed.

Offline checks must cover required names/descriptions, documented character limits, directory equality,
actual boolean types (reject quoted pseudo-booleans), known context values, omitted defaults and deliberate
rejection of active false/true combinations. Test hidden guidance remains reachable by required consumers,
manual operations are not advertised as automatic, merged resume retains the owner contract, and no prompt
or skill adds unsupported model/tool routing metadata. Keep style limits distinct from platform validity.
Native tests must verify actual menu/discovery and invocation behavior on both harnesses; source assertions
cannot prove the router loads a skill. Fork runtime evaluations remain deferred under the current offline-only limit.

## Verification Strategy

- Establish a failing or discriminating check against the current controlling source before claiming a fix.
  Use isolated temporary fixtures, mocked policy responses and local provider/compiler checks; no real apply.
- Extend existing discovery/signature, diagram, skill-consolidation, Host-adapter, post-write, review-presence,
  parser and hook tests. Replace assertions that freeze defective query text with tests of the required semantics.
- For governance, distinguish collection completeness from policy applicability and exemption validity.
  Record representative assignment/initiative/scope input and expected blocker/provenance results.
- For templates, verify application settings and IaC names together across every bundled language/track.
  Compile/handshake tests require declared tool/SDK versions; an unavailable tool leaves that check unverified.
- For merges, test explicit/manual versus automatic discovery, missing operation, wrong owner, ambiguous project,
  read-only/preview-only scope, file preservation and unavailable capability. Skill metadata never grants tools/models.
- Run focused lint after each change and the current full repository suite after integration. Do not run retired
  E2E commands or direct agent-output Markdown lint. Record unrelated preexisting failures without hiding new ones.
- Check new/moved relative links and reference markers offline; distinguish template-output-relative links,
  historical evidence and external URL availability. Do not rewrite history just to satisfy a live-file scanner.
- Obtain independent source review before publication, repair confirmed findings and rerun affected checks.
  Static tests, source size and invocation counts do not establish runtime token savings or full output quality.

## Batch Evidence Record

Append one entry per actual batch; none has been executed yet.

| Field                     | Required Content                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Batch / findings          | R identifier and all affected SK identifiers                                                         |
| Approval / baseline       | User decision/date, limits, baseline SHA and preserved user edits                                    |
| Reproduction              | Current source anchor, fixture/input, expected/observed result; distinguish reported from reproduced |
| Decision / implementation | Remedy or retain/reject rationale, owning files, migrated consumers and contract preservation        |
| Verification              | Commands, versions where relevant, results, failures/repairs and review disposition                  |
| Publication               | Commit SHA, remote equality or exact blocker; do not equate local commit with publication            |
| Residual work             | Unverified cases, manual acceptance, owner and revisit condition                                     |

Update the SK ledger's affected statuses and master workstream row after each verified batch. The chat todo list
mirrors the active slice; it does not replace this record. Durable summaries must survive loss of temporary logs.

## Manual Acceptance And Rollback

- [ ] Local and Agent Host discover the intended surviving skills and command names without duplicates.
- [ ] Hidden internal guidance remains automatically available; manual-only commands do not load by relevance.
- [ ] Visible commands have accurate argument hints and effective invocation/context policy in generated catalogs.
- [ ] Any separately approved fork experiment passes both harnesses' input, result, permission and failure checks;
      otherwise all production skills remain inline and the deferred decision is recorded.
- [ ] Merged resume preserves project selection, current owner/model/tools, reviews, approvals and recovery.
- [ ] Commit/export remain separately consented operations with unchanged write/privacy boundaries.
- [ ] Both IaC tracks preserve earlier phases, exact pins, preview-only stops and explicit destructive approval.
- [ ] Generated artifacts remain complete and consistent with requirements, SKU manifest and current governance.
- [ ] Representative recipe applications and diagrams work with approved runtime/tool versions.
- [ ] User findings are recorded by SK ID or a new stable ID, remediated and rechecked before final signoff.

Use separately reversible commits for correctness fixes and public entry-point migrations. Revert coupled source,
callers/tests and generated views together with normal hooks; never reset user work. Preserve original duplicate
files with hashes before any authorized removal. Keep previous artifacts, archived audit evidence and schemas
needed to interpret historical results. Reverting a consolidation must not silently reintroduce a fixed safety defect.

## Tracking Update Verification

The 2026-09-14 tracking change only records findings, states and roadmap links. It does not modify skill bodies,
scripts, templates or schemas, and it does not mark any new SK item approved, implemented or accepted.
