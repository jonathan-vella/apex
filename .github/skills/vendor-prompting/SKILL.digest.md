<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Vendor Prompting Best Practices (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use This Skill

- Authoring a new `.agent.md` or `.prompt.md` and wanting the right
  vendor patterns up front.
- Auditing an existing agent against vendor best practices (the
  audit procedure is in [audit-procedure.md](references/audit-procedure.md)).
- Investigating a finding from `npm run lint:vendor-prompting` —
  every finding includes a `ruleId` that maps to a rule in
  [rules.json](rules.json) and back to a reference here.
  > _See SKILL.md for full content._

## Decision Tree

> _See SKILL.md for full content._

## Model-Family Detection (mirrors validate-agents.mjs `classifyModel`)

The validator and this skill agree on family classification by lower-casing
the `model:` value and matching substrings in this order:

| Match (case-insensitive) | Family          | Notes                              |
| ------------------------ | --------------- | ---------------------------------- |
| `claude opus`            | `claude-opus`   | Highest reasoning Anthropic models |
| `claude sonnet`          | `claude-sonnet` | Balanced Anthropic models          |

> _See SKILL.md for full content._

## Reference Index

Load only the references your task needs. Most audits need 1-2.

| Reference                                                       | Load when                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [claude-best-practices.md](references/claude-best-practices.md) | Authoring or auditing a Claude agent                                   |
| [gpt-5-prompting.md](references/gpt-5-prompting.md)             | Authoring or auditing a GPT-5.5 agent                                  |
| [gpt-5-upgrade.md](references/gpt-5-upgrade.md)                 | Historical: GPT-5.4 → GPT-5.5 migration notes (cohort retired 2026-05) |

> _See SKILL.md for full content._

## How to Use This Skill for an Audit

This is the canonical audit procedure (full version with templates lives
in [audit-procedure.md](references/audit-procedure.md)).

1. **Read frontmatter** of the target `.agent.md` / `.prompt.md`.
   Capture `name`, `model`, `user-invocable`, `agents`, `handoffs[]`.
2. **Classify model family** using the table above. Note the family's
   v1 status from [family-support.md](references/family-support.md).
   > _See SKILL.md for full content._

## Source Citations

Every rule in [rules.json](rules.json) cites the upstream source by
`source_id`. The current source set:

- **Anthropic Claude prompting best practices** — live web doc at
  [platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices).
  Refresh via `npm run audit:vendor-prompting`.
- **OpenAI GPT-5.5 prompting guide** — pinned to
  > _See SKILL.md for full content._

## Freshness

Run `npm run audit:vendor-prompting` to refresh snapshots and emit a
drift report. The fetch script
([fetch-vendor-prompting-guides.mjs](../../../tools/scripts/fetch-vendor-prompting-guides.mjs))
falls back from `gh api` (auth) → anonymous raw → cached committed
prose if upstream is unavailable.

When upstream changes, regenerate this skill via

> _See SKILL.md for full content._
