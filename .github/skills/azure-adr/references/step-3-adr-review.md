<!-- ref:step-3-adr-review-v1 -->

# Step 3 ADR Review (opt-in, default-skip)

Detailed prose for the 04-Design Phase 5 ADR review. The agent
references this file rather than inlining the full text.

## Trigger

Phase 5 fires only when **both** conditions hold:

1. The current Step 3 run produced one or more `03-des-adr-*.md` ADR
   files.
2. `decisions.review_depth == "deep"` (read via
   `apex-recall show <project> --json`; default `"default"`).

Otherwise skip Phase 5 entirely. Zero cost in the common path. Workflow
graph entry: `step-3.challenger = { default_passes: 0, opt_in: true,
artifact_scope: "design-adr" }`.

## Per-ADR invocation

For each ADR, invoke `challenger-review-subagent` via `#runSubagent`:

- `artifact_path` = `agent-output/{project}/03-des-adr-<n>.md`
- `project_name` = `{project}`
- `artifact_type` = `design-adr`
- `review_focus` = `comprehensive`
- `pass_number` = `1`
- `prior_findings` = `null`
- `output_path` = `agent-output/{project}/challenge-findings-design-adr-<n>.json`
- `overwrite` = `false`

## Presentation

The subagent writes the JSON file at `output_path` and returns a compact
summary (≤ 15 lines). Read the file from disk only if you need full
finding details for the user.

The design step does **not** gate on findings — present them
informationally alongside the ADR. If a finding carries
`requires_step == "step-2"`, surface it explicitly so the user can
decide whether to re-open the architecture (the workflow graph supports
this via the `step-4 → step-2` return_edge for plan-stage findings; ADR
findings of the same shape route through the user, not the gate).
