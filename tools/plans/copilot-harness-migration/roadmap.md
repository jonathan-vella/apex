## Roadmap: evidence-led Copilot harness acceptance

Use the [backlog](backlog.md) for issue packets and the [PRD](prd.md) for requirements.
This roadmap orders work; it does not authorize runtime actions, set a deadline, or promise autonomous completion.

### Wave 0: recover and preserve

- Preserve the exact historical plan and its provenance.
- Record the existing implementation revision and known acceptance gaps.
- Save the PRD, backlog, roadmap, and self-contained issue packets.
- Publish linked GitHub issues without claiming the local planning files are already committed or pushed.

Exit: durable recovery package and a verified issue register exist.

### Wave 1: establish source readiness

1. CHM-01 fixes only the known formatting failure.
2. CHM-02 validates source contracts and reconciles all remaining check failures against the baseline.

Exit: revision-bound validation evidence exists; no migration-introduced failure is unexplained.
Historical PR test totals do not satisfy this gate.

### Wave 2: verify runtime prerequisites in parallel

- CHM-03 verifies discovery, definition-owned routing, tool metadata, and same-worker continuation.
- CHM-05 verifies required VS Code MCP projection and supplementary hook behavior.

Exit: every required prerequisite is verified for the proposed smoke scope.
Unsupported routing, missing tools, unknown capability, or absent operator approval stops progression.
Collect evidence in disjoint locations; coordinate any fixes touching shared runtime configuration.

### Wave 3: exercise the bounded workflow

- CHM-04 uses a fresh approved smoke project.
- The operator selects `01-Orchestrator`; the agent follows current readiness and approval contracts.
- Exercise native forms, parent-mediated input, direct step selection, explicit resume, independent reviews,
  decline, cancellation, and separate human gate decisions.
- Stop at Gate 2 without Governance, CodeGen, or deployment.

Exit: manual observations and an explicitly scoped native capture exist.
Checkpoint and preserve approved smoke state; do not reset Eventdesk or Nordic Foods.

### Wave 4: accept telemetry

- CHM-06 checks closed-capture handling, later resume, attribution, usage, redaction, and strict smoke thresholds.
- Any code fix invalidates the affected evidence until the relevant validation is rerun.

Exit: strict automated results and manual observations agree; missing evidence remains non-passing.

### Wave 5: document and decide

1. CHM-07 publishes verified guidance and release notes through a separate `apex-docs` change.
2. CHM-08 produces a requirement-to-evidence matrix and a READY or BLOCKED recommendation for #767.
3. The human owner decides whether to merge, defer, or request more work.

Exit: linked documentation and a human-reviewed release disposition.
A positive recommendation is not merge authorization or deployment permission.

### Critical path and replanning

The critical path is CHM-01, CHM-02, both CHM-03 and CHM-05, CHM-04, CHM-06, CHM-07, then CHM-08.
CHM-03 and CHM-05 are the only planned parallel prerequisite lane.

If a gate fails, retain the result, open a bounded corrective task, and return to the earliest affected wave.
Do not broaden a worker's permissions or switch models to keep the schedule moving.
Before live work, obtain fresh operator approval of project, scope, budget, and cutoff;
yesterday's stop time is historical.
