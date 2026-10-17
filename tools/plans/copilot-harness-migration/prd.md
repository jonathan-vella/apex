## Product requirements: Copilot SDK harness cutover

### Product outcome

Complete the migration of APEX to the GitHub Copilot SDK harness inside VS Code, preserving specialist-owned
models, human approval gates, independent reviews, artifact ownership, and reliable recovery.
Finish and verify the existing implementation in [PR #767](https://github.com/jonathan-vella/apex/pull/767);
do not rebuild it from the historical plan.

The source is the [recovered plan](../../../.archive/pre-cpharness/migration-plan-2026-10-16.md).
Recovery provenance and delegation rules are in the [delivery index](README.md).

### Users and scenarios

- An operator starts or resumes a project through the canonical manual entry skills in VS Code.
- A human-selected Orchestrator dispatches an authorized specialist only after the relevant approval and
  attributed readiness evidence.
- A directly selected step agent remains interactive; a delegated step returns input requests to its parent.
- A maintainer diagnoses the resulting native SDK session without mixing unrelated projects or double-counting usage.
- A replacement agent recovers this migration from durable requirements, dependencies, issues, and evidence.

### Scope

In scope:

- Canonical entry skills and historical Local prompt archival.
- VS Code MCP projection, configuration, supplementary hooks, and runtime tool binding.
- Native forms, parent-mediated input, continuation, cancellation, and approval stops.
- Definition-owned routing, isolated worker context, and main/leaf delegation boundaries.
- `apex-recall` recovery, mandatory review integrity, and unchanged artifact ownership.
- Native SDK profiling, scoped export, smoke verification, and evidence attribution.
- Regression validation, published documentation, and an explicit release recommendation.

Out of scope:

- Restoring old live worker memory or assuming historical approvals remain valid.
- Reimplementing source changes already present in the baseline.
- A runnable retired E2E launcher, other IDEs, or a new multi-harness compatibility layer.
- Infrastructure deployment, existing project-state repair, credential changes, or automatic approval.
- Automatic merge, automatic model fallback, or reauthoring the immutable recovered plan.

### Functional requirements and traceability

| ID  | Requirement                                                                                               | Historical plan | Verification owner   |
| --- | --------------------------------------------------------------------------------------------------------- | --------------- | -------------------- |
| R1  | Archive Local-only entrypoints; retain canonical manual, permission-neutral skills and active references. | Phase 1         | CHM-02, CHM-03       |
| R2  | Bind required MCP tools in VS Code without duplicate registrations; treat hooks as supplementary.         | Phase 2         | CHM-02, CHM-05       |
| R3  | Render native typed input and preserve accept, reject, defer, edit, decline, and cancellation semantics.  | Phase 3         | CHM-04               |
| R4  | Discover intended definitions and verify actual definition-owned model, effort, tools, and continuation.  | Phase 4         | CHM-03, CHM-04       |
| R5  | Preserve human gates, exact artifact ownership, `apex-recall` recovery, and independent review validity.  | Phases 3-4      | CHM-02, CHM-04       |
| R6  | Attribute native events correctly, scope capture to the selected workspace, and fail closed on gaps.      | Phase 5         | CHM-06               |
| R7  | Reconcile validators, registries, source tests, formatting, and baseline failures for the candidate.      | Phase 6         | CHM-01, CHM-02       |
| R8  | Publish accurate migration guidance and release notes in the separate documentation repository.           | Phase 6         | CHM-07               |
| R9  | Preserve an auditable recovery package and base release readiness on current evidence, not assertions.    | Cross-cutting   | This package, CHM-08 |

### Current implementation versus acceptance

| Area                          | Observed baseline                                                       | Remaining acceptance                                            |
| ----------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| Branch baseline               | Feature branch and migration commit exist after merged #764.            | Do not replay branch-creation commands.                         |
| Entry skills and archive      | Archive, canonical entry skills, and entrypoint contract tests exist.   | Fresh contracts plus live discovery.                            |
| MCP and hooks                 | Configuration code, supplementary guards, and tests exist.              | Actual VS Code projection and permitted hook observations.      |
| Interaction and orchestration | Native interaction guidance, allowlists, and readiness procedure exist. | Live forms, routing, continuation, reviews, and approval stops. |
| Observability                 | Native-event, smoke, export, and readiness tests exist.                 | Strict verification against an approved real capture.           |
| Validation and documentation  | PR reports source validation; main CI stopped on formatting.            | Fresh baseline reconciliation and published docs.               |

No row above establishes runtime acceptance. The authoritative baseline revision and initial failures are
recorded in the [delivery index](README.md).

### Historical-plan corrections

The historical plan is retained verbatim. The following are current constraints, not edits to that history:

- Do not assume SDK source inspection, frontmatter labels, or built-in probes prove custom-agent routing.
  Require per-worker attributed readiness and a continuation round trip before execution.
- `01-Orchestrator` stays human-selected. Only it dispatches allowlisted main workers;
  steps call their authorized leaves. `create_session` is not an interchangeable, verified return channel.
- A delegated worker cannot own the interactive user's forms or approval; its parent mediates them.
- Do not add a root `.mcp.json` or duplicate `.vscode/mcp.json` registrations merely to satisfy historical parity
  wording. Verify the installed VS Code projection and change configuration only for a demonstrated gap.
- File-based `SubagentStop` is not a guaranteed enforcement surface in this runtime.
  Mandatory review and approval checks remain runtime contracts.
- Never select the newest global session or infer a model from a label. Use exact workspace and call attribution.
- An unattended setting, skipped form, accepted mitigation, or historical deadline does not approve a gate.
  Use current approval evidence and operator constraints.

### Acceptance criteria

Source and environment:

- Required source checks pass at the candidate revision; the known formatting failure is resolved.
- Candidate failures are classified against the baseline in clean isolated worktrees or equivalent safe snapshots.
  Existing user work and project state remain unchanged.
- Regression attribution distinguishes pre-migration `05c2ac85`, initial migration `ee2712cc`, and the candidate,
  with equivalent input snapshots. If equivalent project inputs are unavailable, the classification stays unknown.
- Required runtime tools and definition-owned routing are observed, not inferred from a registry.
- Any required runtime capability that is unavailable remains blocking; no substitute model or fabricated evidence.

Workflow:

- The human-selected Orchestrator and directly selected step-agent modes are both exercised.
- Delegated input requests resume the same worker without duplicating answered questions or losing request identity.
- Decline does not approve; cancellation stops; worker completion does not authorize the next step.
- An explicitly resumed execution first successfully recovers through `apex-recall show`.
- Requirements has its mandatory independent review. Architecture has comprehensive and separate cost-feasibility
  reviews; stale evidence and unresolved must-fix findings cannot approve a gate.
- A dedicated approved smoke project stops at Gate 2. There is no Governance, CodeGen, or deployment execution.

Telemetry, using the current [smoke contract](../../tests/integration/smoke-run.md):

- Capture is native SDK and explicitly scoped; the root capture is closed after any later resume.
- Every observed call has input/output usage; authoritative usage is counted once.
- Incomplete operations, unknown actual models, unattributed usage, and non-benign errors are non-passing.
- At most 20 `ask_user` calls occur in the captured scope.
- Every attributed worker's first execution input is at most 45,000 tokens.
- At most two attributed default-mode Challenger execution requests occur per step.
- Resume evidence includes successful first-tool recall recovery.
- Automated telemetry passes and manual runtime observations both exist; neither substitutes for the other.

Delivery:

- `apex-docs` changes are linked and validated in that repository.
- Release evidence covers every requirement and issue, is revision-bound, and lists any explicit blockers.
- A human owns the final merge decision. No issue or document grants deployment permission.

### Risks and decisions

| Risk                                                       | Required treatment                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Custom definitions unavailable or model routed incorrectly | Stop and retain diagnostic evidence; no fallback.                                |
| Environment or credentials prevent MCP access              | Return the missing prerequisite; operator resolves it explicitly.                |
| Historical plan conflicts with current runtime contracts   | Preserve history; follow current instructions and record the difference.         |
| Existing Eventdesk or link failures obscure regressions    | Compare baseline and candidate without mutating project state.                   |
| Logs disclose sensitive data                               | Keep raw capture local; publish only approved redacted summaries.                |
| Planning files not yet pushed                              | Keep GitHub issues self-contained and do not publish nonexistent artifact links. |

Scheduling is dependency-based, not a promise of dates or cost.
Live smoke work requires fresh operator scope, budget, project, and cutoff approval.
