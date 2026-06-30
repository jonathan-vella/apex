<!-- ref:claude-best-practices-v1 -->

# Anthropic Claude — Prompting Best Practices (Normalized)

> Sources: [platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
> (cross-model best practices) and
> [platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5)
> (Sonnet 5 model-specific deltas) — live web docs; refresh via
> `npm run audit:vendor-prompting`.

This file normalizes Anthropic's published guidance into rules
consumable by `validate-agents.mjs`. Each rule references its ID in
[rules.json](../rules.json). Only patterns directly enforced by this
repo are documented; full vendor guidance lives at the source URL.

## Applicable models

Claude Opus 4.8 (current top), Claude Opus 4.7, Claude Opus 4.6, Claude
Sonnet 5, Claude Sonnet 4.6, Claude Haiku 4.5. Earlier Claude generations are out of scope.

## Rule R-CL-1 — XML structuring for complex prompts

> Source: section "Structure prompts with XML tags" + "Use examples
> effectively"

**Rule**: When a prompt mixes instructions, context, examples, and
variable inputs, wrap each content type in its own descriptive XML
tag (`<instructions>`, `<context>`, `<input>`, `<example>`,
`<examples>`, `<thinking>`).

**Repo enforcement**: Encouraged for all Claude agents; not
auto-validated (reviewer judgement). Existing repo patterns:
`<investigate_before_answering>`, `<context_awareness>`,
`<scope_fencing>`, `<empty_result_recovery>`, `<subagent_budget>`,
`<output_contract>`.

## Rule R-CL-2 — Investigate-before-answering for research agents

> Source: section "Minimizing hallucinations in agentic coding"
> (Anthropic publishes the exact `<investigate_before_answering>`
> snippet).

**Rule** (`legacy-004`): Claude Opus / Sonnet agents whose role is to
research before deciding (Architect, IaC Planner, Context Optimizer)
should include `<investigate_before_answering>`.

**Counter-rule** (`claude-oneshot-001`): ONE-SHOT agents
(Requirements, Challenger subagent — agents whose contract is "do it
in a single round, then exit") MUST NOT include this block. The
investigate block adds latency that conflicts with their bounded
contract.

## Rule R-CL-3 — Context awareness on large prompts

> Source: section "Context awareness and multi-window workflows".
> Anthropic explicitly recommends adding context-budget guidance to
> long system prompts.

**Rule** (`legacy-003`): Claude agents whose body exceeds 350 lines
should include `<context_awareness>` to opt into the
[context-management skill](../../context-management/SKILL.md) tier
selection.

## Rule R-CL-4 — Migrate away from prefilled responses

> Source: section "Migrating away from prefilled responses".
> Verbatim from Anthropic doc:
> "Starting with Claude 4.6 models and Claude Mythos Preview,
> prefilled responses on the last assistant turn are no longer
> supported. On Mythos Preview, requests with prefilled assistant
> messages return a 400 error."

**Rule** (`claude-no-prefill-001`): Claude agents and prompts MUST
NOT contain instructions to prefill the assistant turn. The
validator regex looks for phrases like:

- "prefill the assistant"
- "assistant prefill"
- "prefilled response"
- `assistant: { content: "<` (code-pattern)

**Migration**: Anthropic publishes alternatives in the same section
("Controlling output formatting", "Eliminating preambles", "Avoiding
bad refusals", "Continuations", "Context hydration and role
consistency"). For most repo agents, the answer is XML output
contracts (`<output_contract>`) instead of prefill.

## Rule R-CL-5 — Output contract for artifact-producing agents

> Source: section "Structure prompts with XML tags" + "Control the
> format of responses".

**Rule** (`claude-output-contract-001`): Claude agents that produce
a formal artifact (handoff prompts contain `agent-output/{project}/...md`
OR the agent's name maps to a known artifact-producing role)
MUST include an `<output_contract>` block defining the artifact
structure.

**Heuristic**: validator detects artifact-producing agents by:

1. `frontmatter.handoffs[].prompt` contains `agent-output/`
2. `frontmatter.name` matches a known artifact role (Architect,
   Requirements, IaC Planner, IaC CodeGen, As-Built, Governance).

## Rule R-CL-6 — Calibrated absolute language

> Source: section "Overthinking and excessive thoroughness". Anthropic
> notes Opus 4.5/4.6/4.7 over-react to aggressive language ("CRITICAL:
> You MUST ..."). The doc recommends "more normal prompting like 'Use
> this tool when ...'".

**Rule** (`cross-language-density-001`, cross-vendor): absolute words
("ALWAYS", "NEVER", "MUST", "HARD RULE") density should not exceed
0.05 outside permitted prose contexts (security baseline, governance,
approval gate, non-negotiable). Permitted contexts are detected by
paragraph keywords (no synthetic fenced markers required).

## Rule R-CL-7 — Few-shot examples in `<example>` tags

> Source: section "Use examples effectively".

**Rule**: Claude agents adding few-shot examples should wrap them in
`<example>` tags (multiple in `<examples>`). Anthropic recommends 3-5
examples for best results.

**Repo enforcement**: Not auto-validated; reviewer checklist item
in [checklists.md](checklists.md).

## Rule R-CL-8 — Scope-explicit instructions for Opus 4.7+

> Source: section "More literal instruction following" — Opus 4.7+
> "will not silently generalize an instruction from one item to
> another." Opus 4.8 carries the same literal-following behavior and
> further reduces skipped tool calls.

**Reviewer hint**: When updating a Claude Opus 4.7/4.8 agent, prefer
explicit scope ("Apply this to every section, not just the first")
over generic instruction. Not auto-validated.

## Rule R-CL-9 — Effort + adaptive thinking guidance

> Source: section "Calibrating effort and thinking depth" + "Leverage
> thinking & interleaved thinking capabilities".

**Reviewer hint**: For Opus 4.7/4.8 agents, prefer `xhigh` for coding /
agentic; minimum `high` for intelligence-sensitive use; `medium`/`low`
only for cost-sensitive scoped tasks. On Opus 4.8 the effort default is
`high` on all surfaces (was lower on 4.7), and adaptive thinking
(`thinking: { type: "adaptive" }`) decides per turn whether to reason —
`budget_tokens` remains deprecated.

This is configured at the runtime layer (Copilot integration), not in
the agent body — listed here for awareness.

## Rule R-CL-10 — Claude Sonnet 5 migration deltas

> Source: [prompting-claude-sonnet-5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5).
> Applies to the `claude-sonnet` family once an agent's `model:` reads
> `Claude Sonnet 5` (the repo's Sonnet 4.6 cohort migrated 2026-06).

**Reviewer hints** (not auto-validated — manual checklist items):

- **Adaptive thinking is ON by default** (a change from 4.6, where
  non-thinking requests ran without thinking). Manual extended thinking
  (`thinking: { type: "enabled", budget_tokens: N }`) is removed and
  returns a 400 error — use the `effort` parameter instead.
- **`effort` still defaults to `high`**, same as 4.6. Raise to `xhigh`
  only for the hardest coding/agentic tasks; this repo's CodeGen agents
  (06b/06t) keep `high` — AVM generation is structured execution, not
  deep reasoning, so `xhigh` buys no measurable lift.
- **New tokenizer produces ~30% more tokens** for the same text vs.
  4.6. Re-check `max_tokens` headroom and any per-turn context budgets
  tuned against 4.6 (see
  [context-management/references/token-estimation.md](../../context-management/references/token-estimation.md)).
- **More literal instruction following**: Sonnet 5 does not silently
  generalize an instruction from one item to another. State scope
  explicitly ("apply to every section, not just the first") rather than
  relying on implied breadth.
- **More agentic / readier tool use**: scaffolding that forces
  intermediate status updates or nudges tool calls (e.g. "after every 3
  tool calls, summarize progress") is usually unnecessary — Sonnet 5
  produces these on its own and over-specifying can conflict with its
  default behavior.
- **Code-review / validation harnesses**: conservative framing
  ("only report high-severity", "be conservative", "don't nitpick") is
  followed more strictly than on 4.6 and can silently suppress findings.
  Prompts for the validate/whatif/plan subagents should ask for
  full-coverage findings (report every issue with a confidence +
  severity tag) rather than asking the model to self-filter in a single
  pass.
- Sampling params (`temperature`/`top_p`/`top_k`) remain unsupported —
  unchanged from 4.6.

## Anti-patterns flagged by the repo

These are XML blocks the repo uses for Claude that MUST NOT appear in
GPT-family agents (rule `gpt-no-claude-xml-001`):

- `<investigate_before_answering>`
- `<context_awareness>`
- `<scope_fencing>`
- `<empty_result_recovery>`
- `<subagent_budget>`
- `<output_contract>`

GPT-5.5 reads markdown sections natively; Claude-only XML is noise in
GPT prompts.

## Cross-references

- [gpt-5-prompting.md](gpt-5-prompting.md) — when an agent uses
  GPT-5.5, the skeleton replaces XML structuring.
- [cross-model-rules.md](cross-model-rules.md) — handoff and
  prompt-sync rules apply regardless of vendor.
- [audit-procedure.md](audit-procedure.md) — execute the full audit.
