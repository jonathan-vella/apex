## APEX vNext Decision Index

This index is append-only. Amend a decision with a new entry rather than rewriting its historical context. Add an ADR
when a decision has lasting architectural consequences that need alternatives and trade-off analysis.

## DECISION-001: Use Hybrid Project Governance

- **Date:** 2026-07-14
- **Owner:** `@jonathan-vella`
- **Context:** vNext needs durable intent across devices without duplicating granular work state in repository files.
- **Options:** Repository-only tracking; GitHub-only tracking; hybrid repository and GitHub tracking.
- **Choice:** PRD, roadmap, register, decisions, and checkpoints live in the repository. Issues own executable status. The
  GitHub Project is a view over issues and pull requests.
- **Rationale:** Stable governance benefits from reviewable version history, while assignment and daily state need GitHub
  workflow semantics.
- **Consequences:** `PROJECT.md` stays concise; issue checkpoints are mandatory before pausing; mutable status cannot have
  two owners.
- **ADR:** Not required; this is a delivery-governance choice.
- **Issue/PR:** [#536](https://github.com/jonathan-vella/apex/issues/536); PR pending.

## DECISION-002: Use The Existing Integration Branch

- **Date:** 2026-07-14
- **Owner:** `@jonathan-vella`
- **Context:** Phase 0A deferred a long-lived vNext branch, but implementation now spans repository packages, configuration,
  customizations, tools, and documentation under draft PR #533.
- **Options:** Copy from a temporary repository at the end; work directly on one branch; use an integration branch with
  isolated issue worktrees.
- **Choice:** Keep `feat/apex-vnext-rewrite` as the durable integration branch. Execute slices on short-lived issue branches
  in isolated worktrees and target their pull requests to the integration branch.
- **Rationale:** This preserves history, continuously tests real repository integration, and avoids a second bulk migration
  that would invalidate exact-head evidence.
- **Consequences:** The Phase 0A branch-sequencing assumption is superseded, but its no-tag and no-cutover safety intent
  remains. PR #533 stays draft and `main` stays on v1.
- **ADR:** Not required; repository topology is captured by the project controls.
- **Issue/PR:** [#536](https://github.com/jonathan-vella/apex/issues/536); PR pending.

## DECISION-003: Modernize Through Dependency-Complete Vertical Slices

- **Date:** 2026-07-14
- **Owner:** `@jonathan-vella`
- **Context:** Guidance, validators, scripts, workflows, hooks, generated metadata, packages, and documentation have
  cross-domain dependencies.
- **Options:** Rewrite by repository area; mass rewrite; inventory first and migrate one dependency-complete slice at a
  time.
- **Choice:** Inventory the whole ownership surface, then execute independently revertible vertical slices with
  characterization, migration, compatibility, validation, measurement, and documentation.
- **Rationale:** Cross-domain behavior and diagnostics must remain equivalent while duplicate ownership is retired.
- **Consequences:** Unrelated cleanup cannot be bundled into a slice; a worsened release gate requires revert or explicit
  acceptance with owner and expiry.
- **ADR:** Create ADRs only for consequential canonical-ownership decisions.
- **Issue/PR:** [#545](https://github.com/jonathan-vella/apex/issues/545)

## DECISION-004: Keep Improvement Observe-And-Propose Only

- **Date:** 2026-07-14
- **Owner:** `@jonathan-vella`
- **Context:** Recurring deterministic failures can inform improvements, but untrusted observations must not gain runtime
  or repository authority.
- **Options:** Autonomous self-modification; automated issue and pull-request creation; bounded observation and inert
  proposals with human decisions.
- **Choice:** Extend the existing quality and evidence lifecycle with schema-first observations, recurrence, proposals,
  and human decisions. Proposals remain inert.
- **Rationale:** This captures useful recurrence without creating prompt-injection, approval, deployment, or mutation
  paths.
- **Consequences:** MCP may submit bounded observations or read proposals, but cannot decide, apply, edit, create pull
  requests, approve gates, publish, or deploy. Automated issue creation needs a later decision.
- **ADR:** Required before implementing the improvement subsystem; compare the referenced upstream design and provenance.
- **Issue/PR:** [#546](https://github.com/jonathan-vella/apex/issues/546)

## DECISION-005: Keep VS Code As The Only First-Release Agent Runtime

- **Date:** 2026-07-14
- **Owner:** `@jonathan-vella`
- **Context:** The managed customization architecture and qualification plan target supported VS Code Copilot contracts.
- **Options:** Qualify multiple agent runtimes; support VS Code only for the first release.
- **Choice:** Remain VS Code-only for vNext.
- **Rationale:** Broad runtime support would multiply handoff, tool, model-tier, security, and qualification surfaces before
  the first release is proven.
- **Consequences:** GitHub Copilot CLI and other agent runtimes are out of scope. Runtime expansion requires a new decision
  and qualification plan.
- **ADR:** Not required until runtime expansion is proposed.
- **Issue/PR:** [#543](https://github.com/jonathan-vella/apex/issues/543)

## DECISION-006: Extend The Existing Bug Form For Regressions

- **Date:** 2026-07-14
- **Owner:** Repository maintainers
- **Context:** The existing bug form captures description and reproduction but not integration head, failed check, or
  regression test provenance.
- **Options:** Add a separate regression form; extend the existing form with optional vNext provenance fields.
- **Choice:** Extend the bug form and keep one defect intake path.
- **Rationale:** A second mutable defect intake would fragment triage while adding no distinct lifecycle.
- **Consequences:** Regression issues can bind head, check, expected behavior, and proof test without burdening ordinary
  bug reports.
- **ADR:** Not required.
- **Issue/PR:** [#536](https://github.com/jonathan-vella/apex/issues/536); PR pending.

## DECISION-007: Treat The Historical Build Plan As Superseded Input

- **Date:** 2026-07-14
- **Owner:** Product governance
- **Context:** The historical build plan mixes locked requirements, phase sequencing, and status assumptions that no longer
  match the implemented repository.
- **Options:** Maintain both plans; delete the old plan; preserve it as historical input and move binding content into the
  PRD and roadmap.
- **Choice:** Preserve the old plan, mark it superseded, and use [PRD.md](PRD.md) and [ROADMAP.md](ROADMAP.md) as the
  active product and delivery authorities.
- **Rationale:** This retains design provenance without creating two mutable plans.
- **Consequences:** New scope changes require a decision and PRD update. Historical phase labels are traceability only.
- **ADR:** Not required.
- **Issue/PR:** [#536](https://github.com/jonathan-vella/apex/issues/536); PR pending.
