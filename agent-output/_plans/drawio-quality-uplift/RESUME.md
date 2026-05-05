# RESUME — Draw.io Quality Uplift

> Paste this entire file as the **first message** in a new Copilot Chat on the
> other device, then say `proceed`. The assistant has all the artifacts it
> needs in the repo; this file just rebuilds working memory.

## What we are doing

Implementing Phase 2 of [`plan.md`](plan.md) (the Draw.io Diagram Quality
Uplift programme). Phases 0 and 1 are approved and complete. Backward
compatibility is waived per user gate decision (D-BC). Three open questions
were resolved (D-OQ1, D-OQ2, D-OQ3) — see the Resolved Decisions table in
[`plan.md`](plan.md).

## What is already done

| Task | Status | Key files |
| ---- | ------ | --------- |
| T-001 — Quality rubric | DONE | [`.github/skills/drawio/references/quality-rubric.md`](../../../.github/skills/drawio/references/quality-rubric.md) |
| T-002 — Golden fixture pack (7 scenarios + schema) | DONE | [`tools/tests/drawio-golden/`](../../../tools/tests/drawio-golden/), [`tools/schemas/drawio-golden-scenario.schema.json`](../../../tools/schemas/drawio-golden-scenario.schema.json) |
| T-011 — Iteration-log schema + benchmark scoring | DONE | [`tools/schemas/iteration-log.schema.json`](../../../tools/schemas/iteration-log.schema.json), [`tools/scripts/benchmark-e2e.mjs`](../../../tools/scripts/benchmark-e2e.mjs) `scoreRegenerationRate()` |
| T-012 — Baseline capture (Option C: retries + friction) | **IN PROGRESS — 1/7 captured (G1)** | [`tools/tests/drawio-baseline/_baseline-runs.json`](../../../tools/tests/drawio-baseline/_baseline-runs.json), [`tools/scripts/capture-drawio-baseline.mjs`](../../../tools/scripts/capture-drawio-baseline.mjs) |

## T-012 measurement rule (Option C — adopted)

We capture **two** signals per scenario:

- **`retries`** (strict): after the first complete `add-cells` batch, count
  any of `clear-diagram`, full re-`add-cells`, or ≥3 corrective
  `edit-cells` / `delete-cell-by-id` / `set-cell-shape` calls in a row.
- **`friction_count`** (broader): each failed/erroring MCP call chain
  (collapsed by cause = +1), each redundant successful MCP call
  (e.g., `finish-diagram` preview + final = +1), each out-of-band
  file-level correction (sed/manual edit on saved `.drawio` = +1).

The benchmark scorer uses **`cost = retries + friction`** as the divisor.
Pass mark = ≥40% reduction = score ≥60.

## G1 result (already in baseline file)

- `retries = 0`, `friction_count = 3`, `rubric_mean = 2.86/4`
- Captured from Copilot Chat session `50996f96-3b0e-4056-a15d-df67ceba7fe5`
- Five quality issues recorded — `SqlHTTPS` label collision, missing
  Managed Identity edges, floating App Insights/LA, no trust boundary,
  edge fan-out crossings.

## Resume the loop with G2

Next scenario: **G2 — Hub-Spoke Landing Zone**.

1. Open VS Code Copilot Chat on the new device.
2. Select the **`04-Design`** agent.
3. Paste the contents of
   [`tools/tests/drawio-golden/g2-hub-spoke-landing-zone/prompt.md`](../../../tools/tests/drawio-golden/g2-hub-spoke-landing-zone/prompt.md)
   into the chat.
4. Let the agent run end-to-end.
5. Come back to **this** chat (the resumed one) and say:
   _"G2 done"_ — optionally attach the rendered diagram image.

The assistant will then:

- mine the newest debug log under
  `~/.vscode-server/data/User/workspaceStorage/<workspace-hash>/GitHub.copilot-chat/debug-logs/`,
- apply the Option C counting rule,
- update `_baseline-runs.json`,
- run `node tools/scripts/capture-drawio-baseline.mjs`,
- score the rubric from the rendered diagram if shared.

After G2, repeat for G3–G7. When all 7 are captured,
`capture-drawio-baseline.mjs --check` exits 0 and we move to T-033 (orchestrator)
or T-006/T-009/T-010 (validator extensions) — whichever the user prioritises.

## Useful commands at session start

```bash
# Resume context from apex-recall
apex-recall show drawio-quality-uplift --json

# Where in capture are we
node tools/scripts/capture-drawio-baseline.mjs --status

# What does the plan say
cat agent-output/_plans/drawio-quality-uplift/plan.md | head -50

# Sanity-check the repo
npm run lint:json
```

## Hard constraints (still binding)

- Agent body ≤350 lines guideline; push detail to skill references.
- MCP server is pure-Deno; no new runtimes; deno.json deps + std library only.
- See [`.github/instructions/context-optimization.instructions.md`](../../../.github/instructions/context-optimization.instructions.md).

## Files NOT to edit by hand

- `.github/skills/drawio/SKILL.digest.md`
- `.github/skills/drawio/SKILL.minimal.md`

Both are auto-generated. After editing `SKILL.md`, run:

```bash
node tools/scripts/generate-skill-digests.mjs drawio
```
