<!-- ref:hard-checkpoints-v1 -->

# Hard Token Checkpoints (Per-Model)

Percentages are advisory; absolute input-token counts override them for the
models below. When any LLM round-trip would ship more than the threshold,
the agent MUST emit a context-compaction checkpoint **before** the next
tool call and prefer the `minimal` artifact tier. These repository trip-wires
are not verified API limits. Use the active harness limit when available;
unknown model limits remain unknown. Never truncate required safety evidence.

| Model             | Vendor API window | Hard checkpoint at | Action                                                                                    |
| ----------------- | ----------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `gpt-6-sol`       | 1,050,000         | **≥300K input**    | Prefer current recall summaries; recover missing required source and reference sections. |
| `gpt-6-luna`      | 1,050,000         | ≥300K input        | Same protocol.                                                                            |
| `gpt-5.6-terra`   | 1,050,000         | ≥300K input        | Same protocol.                                                                            |
| `claude-opus-5.5` | 1M                | ≥160K input        | Same protocol; prefer `references/` lookups over re-reading source artifacts.             |
| `mai-code`        | unknown           | ≥160K input        | Same protocol; limit unknown, so use the most conservative trip-wire.                     |

Vendor windows come from the OpenAI and Anthropic model pages (2026-09-24) and describe the API, not the
Copilot harness. The checkpoints are carried over from the previous 400K/200K planning budgets; raise them
only after measuring the active harness headroom.

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
that prevents recurrence, set against the 400K budget in use at the time.
