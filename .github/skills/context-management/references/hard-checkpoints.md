<!-- ref:hard-checkpoints-v1 -->

# Hard Token Checkpoints (Per-Model)

Percentages are advisory; absolute input-token counts override them for the
models below. When any LLM round-trip would ship more than the threshold,
the agent MUST emit a context-compaction checkpoint **before** the next
tool call and switch every further read to the `minimal` tier.

| Model               | Context limit | Hard checkpoint at | Action                                                                                                                          |
| ------------------- | ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `gpt-5.5`           | 400K          | **≥300K input**    | Swap full plan + governance artifacts for `apex-recall show <project> --json` summaries; pin further skill reads to `SKILL.md`. |
| `gpt-5.3-codex`     | 400K          | ≥300K input        | Same protocol.                                                                                                                  |
| `claude-opus-4.7`   | 200K          | ≥160K input        | Same protocol; prefer `references/` lookups over re-reading source artifacts.                                                   |
| `claude-sonnet-5`   | 200K          | ≥150K input        | Same protocol. New tokenizer yields ~30% more tokens per same text vs. 4.6 — checkpoint may trigger earlier in practice.        |

## Checkpoint Procedure

When a hard threshold is hit:

1. Emit a single ≤500-token message summarising every still-relevant
   artifact (plan resource list, governance Deny map, deployment phase,
   open decisions).
2. Replace any further reads of `04-implementation-plan.md`,
   `04-governance-constraints.md/.json`, or `02-architecture-assessment.md`
   with `apex-recall show <project> --json` (then `apex-recall search
<project> '<term>' --json` for targeted lookups).
3. Stop loading additional skills. Skills are single-tier (`SKILL.md`); if the
   parent skill is already in context, do not re-read it. Read only specific
   `references/` files when the SKILL.md body explicitly points to one.
4. Record the event: `apex-recall checkpoint <project> <step>
context_compacted_<threshold>K --json`.

## Background

Step 5 CodeGen agents (`06b-Bicep CodeGen`, `06t-Terraform CodeGen`) must
honour this rule — the gpt-5.5 main agent saturated at very large inputs in
the nordic-foods retro (May 2026); the 300K hard checkpoint is the trip-wire
that prevents recurrence on the 400K GPT-5 family budget.
