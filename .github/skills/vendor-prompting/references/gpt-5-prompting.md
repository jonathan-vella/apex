<!-- ref:gpt-5-prompting-v1 -->

# OpenAI GPT-5.5 — Prompting Best Practices (Normalized)

> Source: [openai/skills @ 724cd511c96593f642bddf13187217aa155d2554/prompting-guide.md](https://github.com/openai/skills/blob/724cd511c96593f642bddf13187217aa155d2554/skills/.curated/openai-docs/references/prompting-guide.md)
> sha256 `ecdf49b4a824a87367c7a6ec3c0218e2c5783dff951b30a101c3b6a95152aafa`.
> Snapshot: [.snapshots/openai-prompting-guide.md](.snapshots/openai-prompting-guide.md).

This file normalizes OpenAI's GPT-5.5 prompting guidance into rules
consumable by `validate-agents.mjs`. Each rule references its ID in
[rules.json](../rules.json).

## Applicable models

GPT-5.5 (preferred OpenAI default for the APEX OpenAI cohort) and GPT-5.4
(active standard-tier sibling — same prompting style; see
[gpt-5-upgrade.md](gpt-5-upgrade.md) for voluntary GPT-5.4 → GPT-5.5 upgrade
patterns). GPT-5.3-Codex and GPT-4o are reviewer-only.

## Rule R-GPT-1 — Outcome-first skeleton

> Source: section "Suggested prompt structure".

**Rule** (`gpt55-skeleton-001`): GPT-5.5 agents must contain these
H1 sections (order flexible, presence required):

```text
Role: [1-2 sentences defining function, context, job]

# Personality        ← only required for user-facing agents
[tone, demeanor, collaboration style]

# Goal
[user-visible outcome]

# Success criteria
[what must be true before final answer]

# Constraints
[policy, safety, business, evidence, side-effect limits]

# Output
[sections, length, tone]

# Stop rules
[when to retry, fallback, abstain, ask, or stop]
```

`# Personality` is **only required** when the agent is user-facing
(`frontmatter.user-invocable: true` AND `frontmatter.name` matches
`/Orchestrator/i`). Internal pipeline agents (CodeGen, Governance,
Challenger, subagents) MUST OMIT personality (rule
`personality-scoping-001`) — OpenAI guide: "For customer-facing
assistants, support workflows, coaching experiences, and other
conversational products, define both personality and collaboration
style."

**Severity**: warn until 2026-09-01, then error (encoded in
`promotion_date`).

## Rule R-GPT-2 — Stop rules must be non-empty

> Source: section "Outcome-first prompts and stopping conditions" —
> "Add explicit stopping conditions ... Define missing-evidence
> behavior".

**Rule** (`gpt55-stop-rules-non-empty-001`): the body under
`# Stop rules` must contain ≥1 non-blank, non-comment line before the
next H1. An empty section is misleading scaffolding.

## Rule R-GPT-3 — Decision rules over absolutes

> Source: section "Outcome-first prompts and stopping conditions" —
> "Avoid unnecessary absolute rules. Older prompts often use strict
> instructions like ALWAYS, NEVER, must, and only ... Use those words
> for true invariants."

**Rule** (`cross-language-density-001`, cross-vendor): density of
absolute words ("ALWAYS", "NEVER", "MUST", "HARD RULE") must not
exceed 0.05 outside permitted prose contexts (security baseline,
governance, approval gate, non-negotiable). True invariants stay
absolute; judgment calls become decision rules.

**Severity**: info first release, warn after 2026-09-01.

## Rule R-GPT-4 — No Claude-only XML blocks

> Source: section "Personality and behavior" + "Formatting" — GPT-5.5
> is steered with markdown sections. The guide does not use
> Anthropic-style XML structuring.

**Rule** (`gpt-no-claude-xml-001`): GPT-family agents MUST NOT
contain Claude-specific XML blocks
(`<investigate_before_answering>`, `<context_awareness>`,
`<scope_fencing>`, `<empty_result_recovery>`, `<subagent_budget>`,
`<output_contract>`).

## Rule R-GPT-5 — Personality scoping

> Source: section "Personality and behavior" — "For customer-facing
> assistants, support workflows, coaching experiences, and other
> conversational products, define both personality and collaboration
> style."

**Rule** (`personality-scoping-001`): `# Personality` block
permitted only on user-facing agents (Orchestrator family). Internal
pipeline subagents should omit. Severity: info (advisory) — moved to
warn if the repo standardizes the pattern.

## Rule R-GPT-6 — Retrieval budgets and stopping rules

> Source: section "Grounding, citations, and retrieval budgets".

**Reviewer hint**: agents that perform retrieval (Architect querying
Microsoft Learn, Governance querying Azure Policy) should embed an
explicit retrieval budget in their `# Constraints` or `# Stop rules`.
Pattern from the OpenAI guide:

```text
For ordinary Q&A, start with one broad search using short, discriminative
keywords. If the top results contain enough citable support, answer.
Make another retrieval call only when:
- The top results do not answer the core question.
- A required fact, parameter, owner, date, ID, or source is missing.
...
Do not search again to improve phrasing or add nonessential details.
```

Not auto-validated; reviewer checklist item.

## Rule R-GPT-7 — Preamble for streaming user-facing agents

> Source: section "Improve time to first visible token with a
> preamble".

**Reviewer hint**: streaming agents (interactive Orchestrator) should
emit a 1-2 sentence preamble before tool calls. Not auto-validated.

## Rule R-GPT-8 — Verification and self-check

> Source: section "Prompt the model to check its work".

**Reviewer hint**: agents that produce code or visual artifacts
should embed a validation step ("After making changes, run the most
relevant validation available: targeted unit tests for changed
behavior, type checks or lint checks, build checks, smoke tests").
Repo IaC agents already follow this via `validate:all` invocations
in `# Stop rules`.

## Rule R-GPT-9 — Phase parameter preservation

> Source: section "Phase parameter".

**Reviewer hint**: long-running Responses agents that replay
assistant items must preserve `phase` values (`commentary` for
intermediate, `final_answer` for completed). Repo subagents do not
hit this case today — listed for awareness.

## Anti-patterns

- Carrying over every instruction from a GPT-5.4 prompt stack —
  GPT-5.5 prefers shorter, outcome-oriented prompts.
- Over-specifying step-by-step procedures for tasks that should
  describe the destination instead.
- Using `<personality>`, `<role>`, `<goal>` XML tags — GPT-5.5
  reads `# Personality`, `Role:`, `# Goal` markdown natively.

## Cross-references

- [gpt-5-upgrade.md](gpt-5-upgrade.md) — migrating from GPT-5.4.
- [claude-best-practices.md](claude-best-practices.md) — when an
  agent uses Claude, XML structuring replaces the skeleton.
- [cross-model-rules.md](cross-model-rules.md) — handoff and
  prompt-sync rules.
- [audit-procedure.md](audit-procedure.md) — full audit.
