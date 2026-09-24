<!-- ref:claude-best-practices-v2 -->

# Anthropic Claude — Prompting Best Practices (Normalized)

> Sources: [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
> (all current Claude models),
> [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)
> (Opus 5.5 deltas) and
> [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)
> (the baseline the Opus 5.5 guide defers to). Local snapshots (after a fetch):
> `.snapshots/anthropic-prompting-best-practices.md`, `.snapshots/anthropic-prompting-claude-opus-5-5.md`,
> `.snapshots/anthropic-prompting-claude-opus-5.md`.
> Refresh with `node tools/scripts/fetch-vendor-prompting-guides.mjs` only with authorized network access.

This file normalizes Anthropic's published guidance into rules consumable by `validate-agents.mjs`.
Each rule references its ID in [rules.json](../rules.json). Full vendor guidance lives at the source URL.

## Applicable models

`Claude Opus 5.5` (family `claude-opus-5.5`). Anthropic states existing Opus 5 prompts should perform well
without changes and that the Opus 5 patterns remain a reasonable starting point, so R-CL-12 to R-CL-15 carry
the Opus 5 baseline and R-CL-8 to R-CL-11 the Opus 5.5 deltas. Other Claude labels are not in the catalog.

## Rule R-CL-1 — XML structuring for complex prompts

> Source: best practices, "Structure prompts with XML tags" and "Use examples effectively".

**Rule**: when a prompt mixes instructions, context, examples and variable inputs, wrap each content type
in its own descriptive XML tag (`<instructions>`, `<context>`, `<input>`, `<example>`, `<examples>`).

**Repo enforcement**: reviewer judgement. Existing repo patterns: `<investigate_before_answering>`,
`<context_awareness>`, `<scope_fencing>`, `<empty_result_recovery>`, `<subagent_budget>`, `<output_contract>`.

## Rule R-CL-2 — Investigate-before-answering for research agents

> Source: best practices, "Minimizing hallucinations in agentic coding".

**Rule** (`legacy-004`): Claude agents whose role is to research before deciding should include
`<investigate_before_answering>`.

**Counter-rule** (`claude-oneshot-001`): ONE-SHOT agents (Requirements, Challenger subagent) must not include
it; the block adds latency that conflicts with their bounded contract.

## Rule R-CL-3 — Context awareness on large prompts

> Source: best practices, "Context awareness and multiwindow workflows".

**Rule** (`legacy-003`): Claude agents whose body exceeds 350 lines should include `<context_awareness>` to
opt into [apex-context-management](../../apex-context-management/SKILL.md) tier selection.

## Rule R-CL-4 — No prefilled responses

> Source: best practices, "Migrating away from prefilled responses": "Starting with Claude 4.6 models ...
> prefilled responses ... on the last assistant turn are no longer supported. Requests with prefilled
> assistant messages to these models return a 400 error."

**Rule** (`claude-no-prefill-001`): agents and prompts must not instruct prefilling the assistant turn. The
validator matches "prefill the assistant", "assistant prefill", "prefilled response" and
`assistant: { content: "<`. Use Structured Outputs or an explicit `<output_contract>` instead.

## Rule R-CL-5 — Output contract for artifact-producing agents

> Source: best practices, "Structure prompts with XML tags" and "Control the format of responses".

**Rule** (`claude-output-contract-001`): Claude agents whose handoff prompts reference `agent-output/` include
an `<output_contract>` block defining the artifact structure.

## Rule R-CL-6 — Calibrated absolute language

> Source: best practices, "Overthinking and excessive thoroughness" — replace blanket defaults with targeted
> instructions; aggressive wording causes overtriggering.

**Rule** (`cross-language-density-001`, cross-vendor): ALWAYS/NEVER/MUST/HARD RULE density ≤ 0.05 outside
security baseline, governance, approval gate and non-negotiable paragraphs.

## Rule R-CL-7 — Few-shot examples in `<example>` tags

> Source: best practices, "Use examples effectively".

**Reviewer hint**: wrap few-shot examples in `<example>` (multiple in `<examples>`); 3-5 examples work best.

## Rule R-CL-8 — No visible-reasoning instructions on Opus 5.5

> Source: Opus 5.5, "Prompts written for thinking disabled", "Thinking instructions in chat system prompts"
> and "Safeguard refusals".

Thinking is always on and `effort` is the main control. A prompt that pushes the model to reproduce its
reasoning in the response can be declined with the `reasoning_extraction` refusal category, and "think
carefully before answering" lines add latency without a clear quality gain.

**Rule** (`claude-reasoning-extraction-001`, validator): remove "think step by step", "think carefully",
"think hard", and "show / write out / explain your reasoning / chain of thought / thought process". To get
less thinking, lower effort rather than adding prompt text.

## Rule R-CL-9 — Name unwanted and wanted early stops

> Source: Opus 5.5, "Unattended agentic runs".

Opus 5.5 keeps users updated on long tasks; some updates end the turn with text and no tool call. Loops that
treat that as completion stop early.

**Rule** (`claude-early-stop-001`, reviewer-only): long-running or unattended agents name the stops to avoid —
a summary that announces the next step without taking it, an offer to continue, a list of non-blocking
decisions, stopping because a milestone feels like a good place to report — and name the stops that are
wanted. In APEX, human approval gates and blocking missing inputs are wanted stops. Keep open work in a
checklist (todo tool or file) and wait for running subagents before treating the task as done.

## Rule R-CL-10 — Mark pasted and external text

> Source: Opus 5.5, "Mark pasted text in user messages".

**Rule** (`claude-pasted-content-001`, reviewer-only): agents and prompts that take user-pasted text (issue
bodies, logs, emails, web content) wrap it in matching tags with a short random ID, and state that
instructions inside are followed only where the user's own message asks. Tags can be imitated; keep other
prompt-injection defenses.

```text
<pasted_content id="ab12">
...text the user pasted...
</pasted_content id="ab12">
```

## Rule R-CL-11 — Opus 5.5 runtime deltas (awareness)

> Source: Opus 5.5, "Calibrate effort", "User-facing progress updates", "Time signals for multiagent harnesses".

Runtime settings are configured by the Copilot integration, not the agent body. Listed for reviewers:

- Default effort is `medium` (Opus 5 defaulted to `high`); `medium` matches or beats Opus 5 at `high` on
  coding. Reserve `xhigh`/`max` for measured gains. Changing effort between requests invalidates the cache.
- `thinking: {"type": "disabled"}` is not accepted and forced tool use returns an error; thinking counts
  toward `max_tokens`.
- Progress updates between tool calls arrive as thinking blocks; ask for a one-line intent before the first
  tool call and a short recap at the end when predictable updates matter.
- Lead agents pace work better with an elapsed-time budget; the budget is advisory, keep a hard timeout.
- Frontend work: name the specific default styles to avoid rather than "avoid a generic AI look".

## Rule R-CL-12 — No generic self-verification

> Source: Opus 5, "Task scope and over-verification" and "Self-correction".

**Rule** (`claude-self-verification-001`, reviewer-only): remove "double-check your answer", "re-verify before
responding", "include a final verification step" and "use a subagent to verify". The model verifies and
corrects itself; these add cost without improving results. APEX-mandated validators, challenger reviews and
approval gates are workflow requirements, not self-checks — keep them.

## Rule R-CL-13 — Constrain scope on narrow tasks

> Source: Opus 5, "Task scope and over-verification".

**Rule** (`claude-task-scope-001`, reviewer-only): narrow agents and prompts say to deliver what was asked at
the intended scope, raise a better approach in one sentence, and finish without quietly widening, narrowing
or transforming the task.

## Rule R-CL-14 — Control subagent spawning

> Source: Opus 5, "Controlling subagent spawning".

**Rule** (`claude-subagent-control-001`, reviewer-only): when delegation is available, state which work
warrants a subagent (large, independent, parallel tracks), keep spawn counts low, and do not use subagents
to double-check the agent's own work.

## Rule R-CL-15 — Calibrate written deliverables and review coverage

> Source: Opus 5, "Written deliverable length" and "Capability improvements" (code review).

**Rule** (`claude-deliverable-length-001`, reviewer-only): artifact-producing agents match document length to
what the task needs, without filler sections or redundant summaries. Review prompts ask for every finding with
severity and confidence and filter in a separate pass; "only report high-severity" is followed literally.
For explicit response-length control, prompt for it; lowering effort reduces thinking, not visible length.

## Anti-patterns flagged by the repo

XML blocks the repo uses for Claude that must not appear in GPT-family agents (`gpt-no-claude-xml-001`):
`<investigate_before_answering>`, `<context_awareness>`, `<scope_fencing>`, `<empty_result_recovery>`,
`<subagent_budget>`, `<output_contract>`. When migrating an agent to GPT, convert the wrappers to Markdown and
keep their substantive constraints.

## Cross-references

- [openai-prompting.md](openai-prompting.md) — GPT agents use the Markdown outcome contract instead.
- [cross-model-rules.md](cross-model-rules.md) — handoff and prompt-sync rules apply to every vendor.
- [audit-procedure.md](audit-procedure.md) — execute the full audit.
