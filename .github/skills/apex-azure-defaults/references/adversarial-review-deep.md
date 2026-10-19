<!-- ref:adversarial-review-deep-v1 -->
---
name: Adversarial Review — Deep Cascade
description: Opt-in multi-pass independent-review cascade
---

# Opt-in: Deep adversarial review

Sibling of [`adversarial-review-protocol.md`](./adversarial-review-protocol.md).
The default-flow rules (severity guardrails, per-finding decision protocol,
context shredding, approval-gate template, findings cache) stay in the
parent file. This file holds **only the deep-review cascade** so the
default flow doesn't carry it in every system-prompt replay (per
`tmp/plan-input-token-reduction-v3.md` Phase 9).

Load this file only when **any** of these conditions hold:

- `decisions.review_depth == "deep"` (project-scoped, captured by
  01-Orchestrator).
- User explicitly invokes `10-Challenger` with multi-pass arguments.
- User picks the deep-review option at a gate prompt (only offered at
  Step 2, Step 4, Step 5b/5t).

## Rotating-lens passes

| Pass | `review_focus`             | Condition                                                 |
| ---- | -------------------------- | --------------------------------------------------------- |
| 1    | `security-governance`      | Always required when deep review is active                |
| 2    | `architecture-reliability` | Skip if pass 1 returns 0 `must_fix` AND `<2` `should_fix` |
| 3    | `cost-feasibility`         | Skip if pass 2 returns 0 `must_fix`                       |

Pass 1 is always run when deep review is active; passes 2 and 3 cascade
per the early-exit gate above. Log skipped passes via
`apex-recall review-audit <project> <step> --json`.

## Recommended tier shape (read from `opt_in_matrix`)

`workflow-graph.json` carries `opt_in_matrix` per step. **Treat the
matrix as a recommendation**, not a forced shape:

| Tier (`decisions.complexity`) | Recommended deep-review shape                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `simple`                      | 1 pass (`comprehensive`)                                                           |
| `standard`                    | 2 passes (`security-governance` → `architecture-reliability`)                      |
| `complex`                     | 3 passes (`security-governance` → `architecture-reliability` → `cost-feasibility`) |

The orchestrator does **not** auto-fire any of these — they apply only
when deep review is already active. `opt_in_matrix` MAY be partial — a
missing tier means "no recommended multi-pass shape; run the standard
deep-review cascade above".

## Automatic pass persistence

Automatic graph reviews use one synchronous structured-leaf call per required lens,
each recorded to its canonical `challenge-findings-*-pass{N}.json`.
Preserve early exits, prior findings and the existing invocation ceiling.
Architecture's separate cost review still counts independently.
Do not replace these per-pass files with a combined batch file: current completion
gates resolve individual pass paths.

## Manual batch invocation (optional Challenger workflow)

When `decisions.review_depth == "deep"` AND `decisions.complexity ==
"complex"` AND pass 1 returns ≥ 1 `must_fix` (guaranteeing all three
passes), **batch passes 2 + 3** into a single subagent call:

1. Invoke `challenger-review-subagent` with:
   - `lenses`: `[{review_focus: architecture-reliability, pass_number: 2}, {review_focus: cost-feasibility, pass_number: 3}]`
   - `prior_findings`: compact actual-finding array from pass 1, retaining IDs and source paths
2. The subagent runs lenses internally in sequence (pass 3 sees pass 2 findings)
3. Returns `{ "batch_results": [{pass2_json}, {pass3_json}] }`
4. The same read-only leaf returns one consolidated `batch_results` object.
   The manual parent records the actual attributed payload at its single `output_path`.
   Do not assume automatic per-pass files were created; strictly validate the combined receipt.
5. Summarize actual recorded findings for the approval gate without copying full payloads repeatedly.

**When NOT to batch**: for `standard` projects, continue with sequential
single-pass invocations — the early-exit cascade is more valuable than
batching.

## Subagent invocation template (deep review)

For each automatic pass, invoke `challenger-review-subagent` using the shared one-shot
contract. If unavailable, return the failure to the interactive parent under
the parent protocol; never use a nested wrapper fallback. The optional
manual `10-Challenger` invokes the same leaf and may request the consolidated `lenses` batch.
Keep the same per-pass inputs:

- `artifact_path` = `agent-output/{project}/{artifact-filename}`
- `project_name` = `{project}`
- `artifact_type` = per-artifact value
- `review_focus` = per-pass value from the rotating-lens table
- `pass_number` = `1` / `2` / `3`
- `prior_findings` = `null` for pass 1; compact actual-finding array for later passes

Automatic calls record each result to
`agent-output/{project}/challenge-findings-{artifact_type}-pass{N}.json`.
Manual batch calls instead retain the single consolidated output described above.

Default-flow rules (single-pass `comprehensive` invocation, mandatory-floor
gates, subagent-discovery fallback, severity guardrails, per-finding
decision protocol) stay in
[`adversarial-review-protocol.md`](./adversarial-review-protocol.md).
