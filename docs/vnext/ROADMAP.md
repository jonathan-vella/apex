## APEX vNext Roadmap

This roadmap orders outcomes and dependencies. GitHub Issues own executable status; this file does not track daily work.
The historical phase plan is retained for traceability, but current delivery follows dependency-complete workstreams.

## Dependency Order

```text
Project controls
  -> exact-head stabilization
  -> release-control completion
  -> live qualification preparation
  -> modernization inventory and baselines
  -> dependency-complete modernization slices
  -> bounded improvement proof of concept
  -> final exact-head qualification
  -> maintainer cutover decision
```

No downstream milestone can satisfy an upstream release gate through documentation alone.

## Milestone A: Project Controls

**Outcome:** Product intent, decisions, risks, dependencies, checkpoints, and work status have one durable owner.

**Requirements:** All requirement families through governance and lifecycle management.

**Deliverables:**

- Project hub, checkpoint, PRD, roadmap, register, and decision index.
- Reconciled mapping from the historical plan and frozen Phase 0A evidence.
- vNext work-item intake and regression provenance in the existing bug form.
- Minimal GitHub taxonomy, milestone, issues, and `APEX vNext` planning view.
- Repository-only control validation with no mutable GitHub-state dependency.

**Exit gate:** Documents and issue forms validate; every active concern links to one authoritative issue; PR #533 remains
draft; the exact integration head and failed checks are recorded.

**Historical traceability:** Governance completion plan Phase 1; build plan Phase 0A evidence and project decisions.

## Milestone B: Exact-Head Stabilization

**Outcome:** The integration head is green before feature expansion.

**Requirements:** `REQ-SECURITY-001`, `REQ-DETERMINISM-001`, `REQ-DOCS-001`.

**Dependency-complete slices:**

1. Remove the polynomial-ReDoS path and add a bounded regression test.
2. Build required vNext packages before CI lint resolves generated imports.
3. Correct vNext documentation links and add link regression coverage.
4. Make package clean-install tests terminate children on timeout and diagnose the blocked install.
5. Re-run required checks on the exact updated integration head.

**Exit gate:** Every current product failure has a reproducer and fix; external failures have an owner and evidence; all
required checks pass on the exact head.

**Historical traceability:** Governance completion plan Phase 2; build plan Phase 0B feasibility and Phase 10 release
control prerequisites.

## Milestone C: Release-Control Completion

**Outcome:** Deterministic behavior already present in the runtime is connected to complete release evidence.

**Requirements:** `REQ-DIST-001`, `REQ-STATE-001`, `REQ-CONTRACT-001`, `REQ-WORKFLOW-001`, `REQ-QUALITY-001`,
`REQ-CAPABILITY-001`, `REQ-DETERMINISM-001`.

**Dependency-complete slices:**

1. Resolve every workflow validator ID to an executable registry implementation.
2. Reconcile the declared lessons quality output with a persisted contract or explicit replacement.
3. Verify grants, no-self-approval, no-model-deploy, bundle drift, pack digests, metadata, hashes, and inventories.
4. Produce scorecard measurements from mutation, fault, restart, context, cache, and dual-track tests.
5. Enforce sample thresholds and split automated qualification from final release qualification.
6. Prove byte-reproducible tarballs, release manifest, SBOM, provenance, clean install, and package dry run.
7. Exercise capability-pack install, status, verify, update, rollback, uninstall, and absent-pack behavior.
8. Pin and reuse CI build outputs without weakening checks or changing required check names.

**Exit gate:** Automated qualification is reproducible and green; all remaining unavailable evidence is explicitly manual
or live and has a prepared procedure.

**Historical traceability:** Build plan foundation through packaging phases; governance completion plan Phase 2.

## Milestone D: Live Qualification

**Outcome:** User-owned and cloud-backed behaviors are proven against the exact candidate dependency hashes.

**Requirements:** `REQ-CUSTOMIZATION-001`, `REQ-BICEP-001`, `REQ-TERRAFORM-001`, `REQ-APPROVAL-001`,
`REQ-OPS-001`, `REQ-DOCS-001`.

**Scenarios:**

- Fresh supported VS Code discovery, direct handoffs, questions, hidden workers, and MCP startup.
- Restart and cross-device resume with one-writer and transfer enforcement.
- GitHub Environment reviewer approval, OIDC, and local-to-CI ownership transfer.
- Bicep deployment-stack preview, apply, inventory, diagnosis, destroy, and recovery.
- Terraform backend, protected exact plan, approval, apply, inventory, diagnosis, destroy, and recovery.
- Promotion to a linked environment with Gate 4 refresh.

**Exit gate:** Evidence is bound to the candidate head and dependency hashes. Production Terraform CI apply remains
blocked if encrypted recipient-bound transport is not proven.

**Historical traceability:** Build plan platform spikes, dual-track proof, deployment, and qualification phases.

## Milestone E: Modernization Inventory

**Outcome:** Every repository guidance, validation, hook, workflow, generation, and compatibility surface has an owner,
consumer map, classification, proof test, and removal gate before consolidation begins.

**Requirements:** `REQ-DETERMINISM-001`, `REQ-CUSTOMIZATION-001`, `REQ-DOCS-001`.

**Inventory scope:**

- Instructions and `applyTo` intersections, skills and consumers, root and scoped `AGENTS.md` files.
- Repository-authoring guidance versus shipped consumer guidance.
- Scripts, libraries, package commands, generated files, workflows, actions, hooks, and event triggers.
- Lint and validator ownership across JavaScript, Markdown, JSON/YAML, Python, IaC, and custom rules.
- Required check names, context bytes, dependency edges, diagnostics, hook time, CI critical path, and drift frequency.

**Exit gate:** Every item is classified `keep`, `consolidate`, `rewrite`, `retire`, or `investigate`; unresolved ownership
choices are decisions; characterization and mutation tests protect selected boundaries.

**Historical traceability:** Governance completion plan Phase 3.

## Milestone F: Modernization Slices

**Outcome:** Duplicate ownership is removed without changing behavior, diagnostics, release gates, or public commands.

**Requirements:** `REQ-DETERMINISM-001`, `REQ-CUSTOMIZATION-001`, `REQ-DOCS-001`.

Each issue follows characterize, decide owner, test, migrate, retain compatibility where needed, validate, measure,
document, and retire. The ordered slices are:

1. Validation command graph.
2. Generated metadata sources.
3. Repository and consumer guidance.
4. Skills, agents, invocation graph, and context budgets.
5. Hook authority versus convenience.
6. Scripts, workflows, permissions, pins, and compatibility aliases.

**Exit gate:** Each slice is independently revertible and does not worsen CI time, hook time, context size, duplication,
test coverage, diagnostics, or a release gate unless an owner accepts the regression with an expiry.

**Historical traceability:** Governance completion plan Phase 4.

## Milestone G: Bounded Improvement

**Outcome:** APEX can observe deterministic evidence and propose improvements without gaining mutation authority.

**Requirements:** `REQ-IMPROVE-001`, `REQ-QUALITY-001`, `REQ-SECURITY-001`.

**Dependency-complete slices:**

1. Record an ADR comparing the referenced upstream design after license and exact-source verification.
2. Define observation, recurrence, proposal, human-decision, and improvement-policy contracts.
3. Implement redacted bounded observation and deterministic recurrence across distinct runs.
4. Add trusted CLI read, observe, scan, proposal, and human-decision operations.
5. Prove prompt-injection inertness, authorization boundaries, retention, deletion, deduplication, and rejection.
6. Run observe-and-propose mode during modernization and evaluate precision and triage outcomes.

**Exit gate:** Proposals remain inert; no MCP or proposal path can decide, apply, edit, approve, deploy, publish, or inject
context. Automated issue creation requires a later explicit decision.

**Historical traceability:** Governance completion plan Phase 5.

## Milestone H: Final Qualification And Cutover Decision

**Outcome:** The exact candidate head has complete deterministic and live evidence, rollback ownership, and an explicit
release decision.

**Requirements:** All requirements in [PRD.md](PRD.md).

**Final gate:**

- Repeat deterministic and live qualification after the final dependency hash change.
- Complete independent security review and resolve every critical or high finding.
- Rehearse package publication, capability packs, upgrade, downgrade, uninstall, release, and rollback.
- Complete v1 critical-fix sync, documentation audit, scorecard samples, and `npm run validate:all`.
- Account for every requirement, metric, risk, limitation, evidence hash, and rollback owner.
- Obtain explicit maintainer authorization before tags, publication, cutover artifacts, or merge to `main`.

**Historical traceability:** Build plan release and cutover phases; governance completion plan Phase 6.
