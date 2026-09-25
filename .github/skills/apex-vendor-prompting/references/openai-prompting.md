<!-- ref:openai-prompting-v1 -->

# OpenAI GPT-6 And GPT-5.6 — Prompting Guidance And APEX Outcome Contracts

> Sources:
> [Using GPT-6](https://developers.openai.com/api/docs/guides/latest-model/gpt-6-astra) (GPT-6 family),
> [Using GPT-5.6](https://developers.openai.com/api/docs/guides/latest-model/gpt-5.6) and
> [Prompting guidance for GPT-5.6](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6).
> Local snapshots (after a fetch): `.snapshots/openai-gpt-6-model-guide.md`,
> `.snapshots/openai-gpt-5-6-model-guide.md`, `.snapshots/openai-gpt-5-6-prompt-guidance.md`.
> Refresh with `node tools/scripts/fetch-vendor-prompting-guides.mjs` only with authorized network access.

Each rule references its ID in [rules.json](../rules.json). Rules marked **APEX convention** extend vendor
advice with repository policy; the rest restate vendor guidance.

## Applicable models

| Label                     | Family          | Primary source                  |
| ------------------------- | --------------- | ------------------------------- |
| `GPT-6 Sol (copilot)`     | `gpt-6-sol`     | GPT-6 guide + GPT-5.6 structure |
| `GPT-6 Luna (copilot)`    | `gpt-6-luna`    | GPT-6 guide + GPT-5.6 structure |
| `GPT-5.6 Terra (copilot)` | `gpt-5.6-terra` | GPT-5.6 guide + prompt guidance |

The GPT-6 guide's prompting section addresses behavior observed on GPT-6 Astra and is published as the
starting point for the whole family; evaluate on Sol/Luna workloads. The GPT-6 guide publishes no prompt
structure, so APEX applies the GPT-5.6 suggested structure to GPT-6 as a convention.

## Rule R-GPT-1 — Outcome-first skeleton

> Source: GPT-5.6 prompt guidance, "Suggested prompt structure" (Role, Personality, Goal, Success criteria,
> Constraints, Tools, Output, Stop rules) and "Outcome-first prompts and stopping conditions".

**APEX convention** (`gpt-outcome-contract-001`): main agents carry nonempty Role, Goal, Success criteria,
Constraints, Output and Stop rules sections; Personality and Tools are optional. Preserve existing workflow H2
anchors. Leaf workers use Inputs, Outputs and a bounded failure/return rule instead. Keep each section short
and add detail only where it changes behavior.

## Rule R-GPT-2 — Stop rules must be non-empty

> Source: GPT-5.6 prompt guidance, "Outcome-first prompts and stopping conditions".

**Rule** (`gpt-stop-rules-non-empty-001`): the Stop rules section states when to retry, fall back, abstain,
ask or stop, and what to do when required evidence is missing (name the missing fact, use the smallest
useful fallback).

## Rule R-GPT-3 — Decision rules over absolutes

> Source: GPT-5.6 prompt guidance: "Use ALWAYS, NEVER, must, and only for true invariants ... For judgment
> calls ... prefer decision rules." GPT-5-class models follow prompt contracts closely, so conflicting rules
> create more instability than missing detail.

**Rule** (`cross-language-density-001`): absolute-word density ≤ 0.05 outside permitted contexts. True
invariants stay absolute; judgment calls become decision rules.

## Rule R-GPT-4 — No Claude-only XML blocks

**APEX convention** (`gpt-no-claude-xml-001`): replace `<investigate_before_answering>`,
`<context_awareness>`, `<scope_fencing>`, `<empty_result_recovery>`, `<subagent_budget>` and
`<output_contract>` with Markdown sections, keeping their content. OpenAI's own examples use XML tags (for
example `<tool_orchestration>`), so this is a readability choice, not a capability claim.

## Rule R-GPT-5 — Personality scoping

> Source: GPT-5.6 prompt guidance, "Personality, collaboration, and response length".

**Rule** (`personality-scoping-001`, info): define personality and collaboration style for user-facing
agents only; internal pipeline workers omit it. Keep both short; neither replaces goals, success criteria,
tool rules or stop rules.

## Rule R-GPT-6 — Autonomy and approval boundaries

> Sources: GPT-6 guide, "Initiative and follow-through"; GPT-5.6 prompt guidance, "Define autonomy and
> approval boundaries".

GPT-6 is more likely to ask a clarifying or non-blocking question where earlier models assumed; GPT-5.6 is
proactive and needs explicit limits. Both guides recommend a compact policy stated once:

```text
For requests to answer, explain, review, diagnose, or plan, inspect the relevant materials and report the
result. For requests to change, build, or fix, make the in-scope local changes and run non-destructive
validation without asking first. Require confirmation for external writes, destructive actions, purchases,
or a material expansion of scope. Before asking, finish the authorized work so approval is the final step.
```

- **`gpt-initiative-001`** (reviewer-only): the agent names safe local actions, prepares a concrete,
  reviewable result before asking, and treats "can you…" / "help me…" as a request to act.
- **`gpt-approval-repetition-001`** (validator): more than 3 approval phrases ("ask first", "wait for
  approval", "get approval", "do not mutate", "without approval") warns. Repeating them causes unnecessary
  approval requests for safe actions.

**APEX carve-out**: workflow approval gates, deploy confirmations and the security baseline are required
stops, not "unsolicited approval flows". Consolidate their wording into one policy section; do not remove them.

## Rule R-GPT-7 — Skill and instruction precedence

> Source: GPT-6 guide, "Instruction following".

GPT-6 follows long instructions better but is more sensitive to skills and `AGENTS.md`; unclear or
conflicting skill guidance can make it pause and block early.

**Rule** (`gpt-skill-precedence-001`, reviewer-only): agents that load skills state the precedence between
user instructions and skill guidance, and when a skill causes a pause or divergence the agent names the
`SKILL.md`, quotes the instruction and separates explicit requirements from interpretation. **APEX
carve-out**: the security baseline, governance constraints and approval gates are invariants the user cannot
waive through chat; user precedence applies to style and workflow guidance.

## Rule R-GPT-8 — Verification calibrated to the change

> Sources: GPT-5.6 prompt guidance, "Check work before finishing"; GPT-6 guide, "Testing and verification".

**Reviewer hint**: agents that produce code or artifacts name the validation that matters (targeted tests,
lint/type checks, build, smoke test) and what to do when validation cannot run.

**Rule** (`gpt-testing-calibration-001`, reviewer-only, GPT-6): GPT-6 tends to test broadly before finishing.
Run the required checks, then broaden or repeat only when new changes, failures or open concerns justify it;
do not write tests that mirror a reversible, low-impact implementation. APEX-mandated validators and
challenger reviews are required checks.

## Rule R-GPT-9 — Writing style and response length

> Sources: GPT-6 guide, "Personality and writing style"; GPT-5.6 prompt guidance, "Personality, collaboration,
> and response length".

**Rule** (`gpt-writing-style-001`, reviewer-only): user-facing agents and prompts specify the structure they
need and what a short answer must keep. GPT-6 defaults to lists, tables and recurring stock phrases; name
the phrases to avoid and prefer plain paragraphs where parallel structure is not needed. GPT-5.6 is already
more concise than GPT-5.5, so re-check broad "be concise" lines. Describe tone as concrete choices, not
labels such as "friendly".

## Rule R-GPT-10 — Subagent delegation

> Source: GPT-6 guide, "Subagent delegation".

**Rule** (`gpt-subagent-delegation-001`, reviewer-only, GPT-6): agents with a nonempty `agents:` allowlist
state when and how much to delegate (GPT-6 may delegate less than desired) and ask for legible inter-agent
messages. Keep APEX delegation limits: production agents delegate only to their allowlisted workers.

## Rule R-GPT-11 — Lean prompts and retrieval budgets

> Source: GPT-5.6 prompt guidance, "Simplify prompts first", "Tool routing" and "Grounding, citations, and
> retrieval budgets".

**Reviewer hints**:

- State each instruction once; remove repeated rules, examples that do not change behavior and tools
  unrelated to the task. Keep outcome, success criteria, stop rules, safety and permission constraints.
- Retrieval-heavy agents set a budget: one broad search first, another only when a required fact is
  missing; try one or two fallbacks on empty results before concluding nothing exists.
- Parallelize independent reads; keep dependent steps sequential and synthesize before acting.

## Rule R-GPT-12 — Long-running workflows

> Source: GPT-5.6 prompt guidance, "Long-running workflows and state".

**Reviewer hints**: ask for a one- or two-sentence preamble before the first tool call, then updates only at
major phase changes. Preserve assistant `phase` values when replaying history. Define the current layer of
work (research, design, implementation, review) so the model does not silently move between layers.

## Runtime deltas (awareness)

Configured by the Copilot integration, not the agent body:

- Reasoning effort: GPT-6 Sol and Luna accept `none`; Astra does not. GPT-5.6 supports `none` through `max`.
  Preserve the current effort as a baseline, test one level lower, and check the prompt for a missing
  success criterion before raising effort. `configuration_update` changes effort mid-conversation without
  breaking the cache.
- GPT-6 adds async tool calling and mid-turn steering; GPT-5.6 adds Programmatic Tool Calling, pro mode,
  `text.verbosity`, persisted reasoning and explicit prompt caching.
- Migration workflow: switch the model at the same effort, run evals, remove obsolete scaffolding, add only
  the smallest instruction that fixes a measured regression, and re-run evals after each change.

## Cross-references

- [claude-best-practices.md](claude-best-practices.md) — Claude agents use XML structuring instead.
- [cross-model-rules.md](cross-model-rules.md) — handoff and prompt-sync rules.
- [audit-procedure.md](audit-procedure.md) — full audit.
