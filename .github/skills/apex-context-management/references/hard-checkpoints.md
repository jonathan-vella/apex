<!-- ref:hard-checkpoints-v1 -->

# Hard Token Checkpoints (Per-Model)

Percentages are advisory; absolute input-token counts override them for the
models below. When any LLM round-trip would ship more than the threshold,
the agent MUST emit a context-compaction checkpoint **before** the next
tool call and prefer the `minimal` artifact tier. These repository trip-wires
are not verified API limits. Use the active harness limit when available;
unknown model limits remain unknown. Never truncate required safety evidence.

| Model               | Context limit | Hard checkpoint at | Action                                                                                                                          |
| ------------------- | ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `gpt-5.6-terra`     | 400K          | **≥300K input**    | Prefer current recall summaries; recover missing required source and reference sections. |
| `gpt-5.6-luna`      | 400K          | ≥300K input        | Same protocol.                                                                                                                  |
| `claude-opus-5`     | 200K          | ≥160K input        | Same protocol; prefer `references/` lookups over re-reading source artifacts.                                                   |
| `claude-sonnet-5`   | 200K assumed  | ≥150K input        | Same protocol; verify tokenizer and active harness headroom rather than assuming a fixed ratio. |

## Checkpoint Procedure

When a hard threshold is hit:

1. Aim for a compact checkpoint message (about 500 tokens) summarising every still-relevant
   artifact (plan resource list, governance Deny map, deployment phase,
   open decisions). This is not a truncation budget: preserve required safety
   evidence losslessly or stop for a fresh context with explicit recovery pointers.
2. Replace any further reads of `04-implementation-plan.md`,
   `04-governance-constraints.md/.json`, or `02-architecture-assessment.md`
   with `apex-recall show <project> --json` (then `apex-recall search
<project> '<term>' --json` for targeted lookups).
   If recall is incomplete or stale, recover the required source sections.
3. Defer optional skills, but reload missing required guidance after compaction,
   edits, or a new chat. Skills are single-tier (`SKILL.md`); reuse current
   available content and load referenced sections needed for the current phase.
4. Record the event: `apex-recall checkpoint <project> <step>
context_compacted_<threshold>K --json`.

## Background

Step 5 CodeGen agents (`06b-Bicep CodeGen`, `06t-Terraform CodeGen`) must
honour this rule — a GPT main agent saturated at very large inputs in
the nordic-foods retro (May 2026); the 300K hard checkpoint is the trip-wire
that prevents recurrence on the 400K GPT-5 family budget.
