## Plan: Govern and Complete APEX vNext

Manage vNext as a durable product project while preserving the current draft-integration model. Stable product intent,
decisions, risks, regression policy, and release gates live in version-controlled documents. GitHub Issues own granular
work status, a GitHub Project supplies planning views, and a concise repository checkpoint supports offline and
cross-device resume. Complete the existing rewrite and release controls first, then modernize the repository through
measured vertical slices that consider all dependencies without rewriting every surface at once. Add self-improvement as
an observe-and-propose extension of the existing vNext quality/evidence system, never as an autonomous prompt-injection
or self-modification loop.

**Operating model**

| Concern | Source of truth | Rule |
| --- | --- | --- |
| Product scope and acceptance | `docs/vnext/PRD.md` | Stable requirements with IDs; changes require a decision entry |
| Architecture and delivery sequence | `docs/vnext/ROADMAP.md` | Outcome-based workstreams and dependencies, not daily status |
| Daily work state | GitHub Issues | One issue per executable slice, regression, spike, or decision |
| Prioritization and views | GitHub Project `APEX vNext` | A view over issues and PRs; never a second backlog |
| Risks, assumptions, defects, regressions, dependencies | `docs/vnext/REGISTER.md` | High-signal release/project concerns only; actionable work links an issue |
| Decisions | `docs/vnext/DECISIONS.md` plus ADRs when warranted | Append-only index; consequential decisions get individual ADRs |
| Resume/checkpoint | `docs/vnext/PROJECT.md` | Current milestone, integration head/PR, blockers, next issues, and last verified checks |
| Historical v1 baseline | `docs/vnext/phase-0a/**` | Frozen evidence; do not repurpose it as the live tracker |
| Runtime project state | `.apex/**` and its contracts | Product-run state only; it does not manage vNext engineering work |
| Chat/session memory | `/memories/session/**` | Convenience only; never authoritative across devices |

**Steps**

<!-- markdownlint-disable MD013 MD029 -->

### Phase 1: Establish Project Controls

1. Reconcile the project baseline before writing status. Record the current branch/head, dirty files, commits after
   `7fc27966`, PR #533 draft state, exact-head check conclusions, known security findings, and whether each older pending
   item is completed, partial, blocked, superseded, or still open. Do not trust the checkpoint summary when current files
   or CI disagree.
2. Create the internal project document set:
   - `docs/vnext/README.md`: navigation, source-of-truth policy, contribution flow, and resume entry point.
   - `docs/vnext/PROJECT.md`: short checkpoint with current milestone, integration branch/PR, verified head, active
     blockers, next issue links, validation state, and a timestamp. Update only at checkpoints or milestone transitions.
   - `docs/vnext/PRD.md`: product goals, users, functional/non-functional requirements, exclusions, release metrics,
     compatibility commitments, and cutover acceptance criteria.
   - `docs/vnext/ROADMAP.md`: the workstreams and dependency order in this plan, mapped to the old phase plan only for
     traceability.
   - `docs/vnext/REGISTER.md`: typed `RISK`, `ASSUMPTION`, `ISSUE`, `DEPENDENCY`, `DEFECT`, and `REGRESSION` entries with
     owner, impact, evidence, related issue, mitigation, state, and closure proof.
   - `docs/vnext/DECISIONS.md`: decision index with context, options, choice, rationale, consequences, date, owner, and
     linked ADR/issue/PR.
3. Reconcile `.github/prompts/plan-buildApexVnext.prompt.md` against the implemented system. Preserve it as historical
   design input until every still-valid commitment is represented in the PRD or roadmap; then mark it superseded rather
   than maintaining two active plans. Keep `docs/vnext/phase-0a/**` immutable.
4. Define the work-item lifecycle and templates. Add `.github/ISSUE_TEMPLATE/vnext-work-item.yml` with workstream,
   problem/outcome, PRD IDs, dependencies, compatibility disposition, security impact, test/evidence plan, manual/live
   requirements, and definition of done. Reuse the existing bug template for ordinary defects; add vNext-specific fields
   or a regression template only if the existing form cannot capture head SHA, failed check, reproduction, expected
   behavior, and regression test.
5. Inventory existing labels and milestones before creating new ones. Reuse existing type/priority labels and add only a
   small vNext scope taxonomy. Create the `APEX vNext` GitHub Project with fields for Status, Workstream, Milestone/Gate,
   Priority, Risk, Evidence, Manual/Automated, and Blocked By. Add views for Now, Roadmap, Blocked, Regressions, Manual
   Qualification, Modernization, and Release Readiness.
6. Seed Issues from approved roadmap slices and the current pending list. Issue state and assignee are authoritative;
   `PROJECT.md` contains only a dated checkpoint and links. Every active issue receives a resumable checkpoint comment
   containing branch/head, completed work, next action, blockers, tests run, and uncommitted changes before pausing.
7. Preserve the integration safety boundary: PR #533 remains draft, `feat/apex-vnext-rewrite` remains the integration
   branch, short-lived issue branches may target that integration branch, and no merge to `main`, auto-merge, release
   tag, package publication, or cutover branch is allowed without explicit maintainer approval after final acceptance.
8. Validate the project controls with existing Markdown, links, JSON/YAML, and docs checks. Add a narrow project-doc
   validator only for invariants that existing tools cannot enforce, such as unique register IDs, valid PRD references,
   frozen Phase 0A paths, and required issue/evidence links. Avoid a network-dependent CI check against mutable GitHub
   state.

### Phase 2: Stabilize and Finish Existing vNext Work

9. Make the exact current head green before opening new feature slices. Triage every current CI/CodeQL/docs/devcontainer
   result, distinguish historical failures from current failures, add a regression test for each product defect, and
   record unresolved external/platform failures in the register with evidence and an owner.
10. Correct the vNext docs to match the hardened implementation: remove retired MCP mutation tools, document trusted CLI
    ceremonies, typed review resolution, customization rollback/uninstall, capability-pack operations, quality,
    writer/evidence/telemetry/cache commands, and distinguish package tests from fake-provider and live qualification.
11. Close validator blind spots before relying on release claims:
    - Resolve every validator ID in `config/workflow.v1.json` to an executable registry implementation.
    - Reconcile the declared `run-lessons-v1` quality output with an actual contract or explicitly replace it.
    - Verify role-required tool grants and the no-self-approval/no-model-deploy boundary.
    - Verify bundled asset drift, capability-pack digests, package metadata, runtime-bundle hashes, and documented CLI/MCP
      inventories.
12. Complete scorecard integration. Produce deterministic measurements from mutation, fault, restart/resume, context,
    and cache tests; keep manual VS Code and live Azure metrics unavailable until measured; enforce minimum samples and
    unavailable-data dispositions from `config/quality-scorecard.v1.json`; split automated qualification from final
    release qualification.
13. Complete release packaging controls. Extend pack tests for byte reproducibility of package tarballs, release
    manifest, CycloneDX SBOM, and provenance; verify clean install and `npm pack --dry-run`; reserve registry names only
    after approval and do not publish.
14. Improve CI without weakening checks. Pin Actions and tool inputs immutably, build vNext once per job, reuse outputs
    across validate/test/pack, preserve the clean-install test, retain stable required-check names, and measure runtime
    before/after. Keep network freshness separate from deterministic CI.
15. Exercise capability-pack install/status/verify/update/rollback/uninstall in a clean consumer and document absent-pack
    behavior. Validate pricing, governance, and Draw.io startup from embedded, exact-locked assets without making optional
    packs core prerequisites.
16. Prepare executable evidence templates and scripts for live qualification, then perform or hand off the user-owned
    runs: fresh supported VS Code discovery, MCP startup, direct handoffs, `askQuestions`, hidden worker tiers,
    restart/resume, GitHub Environment/OIDC approval, local-to-CI writer transfer, Bicep deployment-stack scopes and
    teardown, Terraform backend/exact-plan lifecycle, diagnosis, promotion, and destroy. Production Terraform CI apply
    remains blocked until encrypted recipient-bound plan transport is proven.

### Phase 3: Map the Whole Modernization Surface

17. Before consolidating anything, generate a dependency and ownership inventory covering:
    - `.github/instructions/**` and all `applyTo` intersections.
    - `.github/skills/**`, trigger tests, references, agent consumers, and progressive-loading boundaries.
    - Root and scoped `AGENTS.md` files.
    - `.github/copilot-instructions.md`, distinguishing repository-authoring guidance from shipped consumer guidance.
    - `tools/scripts/**`, shared libraries, package scripts, generated files, and compatibility aliases.
    - `.github/workflows/**`, composite actions, required checks, schedules, permissions, and external dependencies.
    - ESLint, Markdown, JSON/YAML, Python, IaC, and custom validator ownership.
    - Lefthook pre-commit/pre-push/commit-msg behavior and index-mutating commands.
    - Checked-in `.github/hooks/**` plus workflow event triggers. External repository/organization webhooks are inventory
      only unless separately authorized.
18. Capture behavior and cost baselines before changes: effective instruction/context bytes, duplicate rule clusters,
    agent/skill dependency edges, validator coverage and diagnostics, local hook duration, CI critical path, generated
    drift frequency, false positives, and the exact required status-check contract.
19. Classify every item `keep`, `consolidate`, `rewrite`, `retire`, or `investigate`, with a canonical owner, consumers,
    migration order, compatibility risk, proof test, and removal gate. Record unresolved ownership choices in
    `DECISIONS.md`; do not edit production surfaces during this inventory slice.
20. Decide a single canonical source for each duplicated concern before implementation. Priority candidates include
    workflow/agent registries, artifact heading definitions, model assignments, counts, skill wiring, Azure/security
    defaults, tool versions, docs rules, and generated customization metadata. Treat the current implementation as
    evidence, not as a predetermined winner.
21. Add characterization and mutation tests around the selected boundaries so consolidation can prove equivalent
    behavior and equivalent diagnostics. Include malformed frontmatter, broken skill links, stale generated files,
    invalid workflow edges, hook failure propagation, context-budget changes, and required-check name drift.

### Phase 4: Modernize Through Vertical Slices

22. Execute one dependency-complete issue at a time using the same sequence: characterize, choose canonical ownership,
    add/adjust tests, migrate consumers, retain a compatibility alias where needed, validate, measure, document, and only
    then retire the old path. Each slice must be independently revertible and may not combine unrelated cleanup.
23. Slice A, validation command graph: consolidate repeated workspace discovery and orchestration while preserving
    granular check IDs, focused local commands, machine-readable diagnostics, and failure semantics. Align package
    scripts, CI, and hooks around the same implementations rather than copying command lists.
24. Slice B, generated metadata: remove parallel editable sources for workflow/agent registries, model catalog, artifact
    headings, counts, and customization metadata one concern at a time. Use structured generators and check-only drift
    validation; never generate hand-authored rationale blindly from code.
25. Slice C, repository guidance: reduce `AGENTS.md`, `.github/copilot-instructions.md`, and instruction overlap. Keep
    stable repo-wide facts in one canonical location, path-specific rules in narrowly scoped instructions, detailed
    procedures in skills/references, and consumer vNext guidance in the managed customization bundle. Measure effective
    context and run semantic rule-presence tests before retiring duplicates.
26. Slice D, skills and agents: replace fragile text-only wiring with structured dependencies where VS Code contracts
    permit, retain a migration fallback, merge overlapping responsibilities, retire unused entities, and update trigger,
    invocation-graph, model-tier, handoff, context-budget, and customization tests in the same slice.
27. Slice E, hooks: separate authority from convenience. CI/kernel enforcement remains authoritative; Lefthook provides
    fast local feedback; GitHub Copilot hooks may log or observe but never authorize, inject untrusted context, approve,
    deploy, or self-modify. Remove duplicate checks only after parity tests prove the authoritative lane covers them.
28. Slice F, scripts and workflows: retire obsolete wrappers, centralize safe process/file utilities, preserve public
    command aliases through an announced deprecation window, minimize workflow permissions, pin dependencies, apply
    path filters safely, and keep scheduled/networked checks separate from deterministic PR validation.
29. After each slice, update the register, decision log, linked issue, docs, and `PROJECT.md` checkpoint; compare CI time,
    hook time, context bytes, duplication, test coverage, and failure quality against the baseline. A slice that worsens a
    release gate is reverted or explicitly accepted with owner and expiry.

### Phase 5: Add Bounded Self-Improvement

30. Write a decision record comparing the referenced pskoett self-improvement design with APEX. Adopt concepts only
    unless its license and exact-source provenance are verified; do not copy scripts/templates from an unlicensed or
    ambiguously licensed source. Record the examined upstream commit/URL and perform a clean APEX implementation.
31. Extend the existing deterministic `quality` node and evidence lifecycle instead of adding `.learnings/` or a second
    mutable tracker. Define schema-first contracts for improvement observation, recurrence pattern, proposal, and human
    decision. Add `config/improvement-policy.v1.json` for allowed sources/categories, recurrence window/threshold,
    redaction, retention, proposal targets, and human-approval rules; treat the upstream recurrence rule as a candidate,
    not an unreviewed hard-coded default.
32. Capture bounded structured observations from task completion, deterministic tests, validation failures, capability
    execution, cache checks, and explicit user/agent correction submissions. Redact and classify before storage, retain
    evidence hashes rather than raw command output, quarantine uncertain content, and never scrape or replay chat history.
33. Implement deterministic recurrence detection across distinct runs/tasks, stable pattern keys, deduplication,
    first/last-seen evidence, confidence derived from explicit rules, and proposals for documentation, validator,
    instruction, skill, architecture, or backlog changes. Proposals are inert text/data and cannot alter runtime policy.
34. Add trusted CLI operations such as `apex quality observe`, `scan`, `proposals`, and `decide`. MCP may submit a bounded
    observation or read proposals, but may not decide, apply, edit instructions/skills/agents, create a PR, approve a
    gate, or deploy. An accepted proposal enters the normal GitHub issue/PR workflow with provenance links.
35. Test secret and PII redaction, prompt-injection inertness, malformed/oversized observations, deterministic output,
    idempotent deduplication, recurrence-window boundaries, deletion/retention, false-positive handling, proposal
    rejection, and proof that no proposal can cause a state-changing capability. Measure precision, duplicate rate,
    triage time, acceptance rate, and post-fix recurrence before considering automated issue creation.
36. Run the proof of concept in observe-and-propose mode during modernization. Review results at a milestone gate. Only a
    later explicit decision may allow deduplicated issue creation; autonomous code changes, prompt changes, draft PRs,
    merges, tags, publications, or context injection remain out of scope.

### Phase 6: Final Qualification and Cutover Gate

37. Re-run all deterministic qualification after the last modernization/self-improvement change, then repeat the live
    VS Code, GitHub approval, Bicep, and Terraform scenarios on the exact candidate head. Earlier evidence is invalid when
    its bound dependency hashes changed.
38. Complete an independent security review, package publication dry run, capability-pack rehearsal, v1 critical-fix
    sync report, upgrade/downgrade/uninstall test, release/rollback rehearsal, documentation audit, and full
    `npm run validate:all` plus exact-head required checks.
39. Produce the final `PROJECT.md` checkpoint and release-readiness decision with every PRD requirement, quality metric,
    open risk, accepted limitation, manual test, evidence hash, and rollback owner accounted for. Any unavailable blocking
    metric or unresolved critical/high risk blocks cutover.
40. Only after explicit maintainer approval may the implementation prepare cutover artifacts, the v1 maintenance line,
    final tags/publication, and merge to `main`. These actions are deliberately excluded from autonomous execution.

<!-- markdownlint-enable MD013 MD029 -->

**Relevant files**

- `/workspaces/apex/docs/vnext/README.md` — internal project hub and resume protocol.
- `/workspaces/apex/docs/vnext/PROJECT.md` — concise dated checkpoint, not the granular backlog.
- `/workspaces/apex/docs/vnext/PRD.md` — product requirements and final acceptance contract.
- `/workspaces/apex/docs/vnext/ROADMAP.md` — outcome-based workstreams and dependency map.
- `/workspaces/apex/docs/vnext/REGISTER.md` — risks, issues, dependencies, defects, and regressions.
- `/workspaces/apex/docs/vnext/DECISIONS.md` — decision index and ADR links.
- `/workspaces/apex/docs/vnext/phase-0a/**` — frozen baseline; read-only input.
- `/workspaces/apex/.github/prompts/plan-buildApexVnext.prompt.md` — old phase plan to reconcile and eventually mark
  superseded.
- `/workspaces/apex/.github/ISSUE_TEMPLATE/vnext-work-item.yml` — consistent executable issue intake.
- `/workspaces/apex/.github/workflows/*.yml` and `/workspaces/apex/.github/actions/**` — CI, scheduled checks, exact pins,
  permissions, and build reuse.
- `/workspaces/apex/lefthook.yml` and `/workspaces/apex/.github/hooks/**` — local and Copilot hook boundaries.
- `/workspaces/apex/package.json`, `/workspaces/apex/eslint.config.mjs`, and `/workspaces/apex/tools/scripts/**` — command,
  lint, validation, generation, and modernization surfaces.
- `/workspaces/apex/.github/instructions/**`, `/workspaces/apex/.github/skills/**`, `/workspaces/apex/AGENTS.md`, and
  `/workspaces/apex/.github/copilot-instructions.md` — guidance and context-consolidation surfaces.
- `/workspaces/apex/config/workflow.v1.json` — quality node, validator IDs, workflow dependencies, and release behavior.
- `/workspaces/apex/config/quality-scorecard.v1.json` — release metric source of truth.
- `/workspaces/apex/config/runtime-bundle.v1.json`, `toolchain.v1.json`, and `capability-packs.v1.json` — compatibility,
  exact pins, and package boundaries.
- `/workspaces/apex/packages/contracts/src/**` — self-improvement and missing persisted-contract definitions.
- `/workspaces/apex/packages/kernel/src/**` — evidence, journal, deterministic recurrence, validation, and policy runtime.
- `/workspaces/apex/packages/cli/src/{cli,mcp,service}.ts` — trusted CLI, bounded MCP, and service integration.
- `/workspaces/apex/packages/renderers/src/**` and `/workspaces/apex/packages/testkit/src/**` — deterministic views and
  qualification scenarios.
- `/workspaces/apex/customizations/**` — shipped VS Code agents/skills/MCP configuration and invocation graph.
- `/workspaces/apex/site/src/content/docs/vnext/**` — public product documentation, updated only for user-facing behavior.

**Verification**

1. Project controls: `npm run lint:md`, `npm run lint:links`, JSON/YAML validation, issue-form validation, and a manual
   source-of-truth audit proving no item has two mutable status owners.
2. Baseline/current head: clean worktree inventory, exact branch/PR SHA match, all current required checks classified,
   and every product failure represented by a reproducer or explicit external-risk record.
3. vNext deterministic surface: `npm run lint:vnext`, `npm run validate:vnext`, `npm run test:vnext`,
   `npm run test:vnext-validator`, `npm run test:vnext-pack`, scorecard qualification, package dry-run, audit, and
   reproducibility comparisons.
4. Modernization: characterization/mutation suites, `validate:agents`, `validate:skills`, instruction checks, workflow and
   registry checks, hook tests, context-budget checks, safe-shell checks, docs checks, required-status-name checks, and
   before/after CI and hook timing.
5. Self-improvement: contract/schema tests, redaction and injection tests, deterministic recurrence fixtures, proposal
   authorization tests, retention/deletion tests, and a proof that MCP cannot decide or apply a proposal.
6. Live/manual: clean supported VS Code, direct handoffs and `askQuestions`, hidden worker tiers, MCP startup,
   restart/cross-device resume, GitHub Environment/OIDC and writer transfer, both Azure IaC tracks through apply,
   inventory, diagnosis, destroy, and rollback/recovery scenarios.
7. Final gate: independent security review, complete scorecard sample requirements, full `npm run validate:all`, package
   and rollback rehearsal, docs/link build, and all required checks green on the exact candidate head.

**Decisions**

- Use the hybrid GitHub/repository model. GitHub Issues own daily state; repository Markdown owns durable intent and
  governance; the Project board is a view.
- Use a small document set rather than one monolithic plan or a large dossier.
- Modernize through vertical, dependency-complete slices after a holistic inventory; do not organize the rewrite as one
  repository area at a time and do not perform a mass rewrite.
- Keep self-improvement observe-and-propose only. No prompt injection, autonomous issue creation, repository edits,
  policy changes, approvals, deployment, PR creation, or merge authority in the first implementation.
- Remain VS Code-only for vNext. GitHub Copilot CLI and other agent runtimes are out of scope.
- Preserve the existing no-merge policy: PR #533 stays draft and `main` stays on v1 until exact-head end-to-end
  acceptance and explicit maintainer authorization.
- Treat external repository/organization webhooks as inventory-only in this project unless separately authorized;
  checked-in Copilot hooks and Actions triggers are in scope.
- The user was unavailable for the clarification prompts, so these recommended defaults remain reviewable before
  implementation: hybrid tracking, small document set, vertical slices, observe-and-propose self-improvement, and
  creation of GitHub Project/labels/issues after the repository governance documents are established.
