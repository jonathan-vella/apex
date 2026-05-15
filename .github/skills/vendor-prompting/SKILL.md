---
name: vendor-prompting
description: '**ANALYSIS SKILL** — Audit-grade reference for Anthropic Claude and OpenAI GPT-5.5 prompting best practices. WHEN: "claude prompting", "gpt-5.5 prompting", "audit agent", "review prompt", "vendor best practices", "anthropic best practices", "openai prompting". DO NOT USE FOR: routine prompt edits where rules are already known, generic markdown style (markdown.instructions.md).'
license: MIT
---

# Vendor Prompting Best Practices

Audit-grade reference for the prompting patterns published by Anthropic
(Claude family) and OpenAI (GPT-5.5 family). Used to author **and** audit
`.agent.md` and `.prompt.md` files in this repository.

The machine-readable source of truth is
[rules.json](rules.json) — every rule has an ID, source citation,
severity, applies-to, and validator-check binding. The skill prose, the
thin enforcement instruction
[vendor-prompting.instructions.md](../../instructions/vendor-prompting.instructions.md),
and `validate-agents.mjs` all reference rule IDs from that file.

---

## When to Use This Skill

- Authoring a new `.agent.md` or `.prompt.md` and wanting the right
  vendor patterns up front.
- Auditing an existing agent against vendor best practices (the
  audit procedure is in [audit-procedure.md](references/audit-procedure.md)).
- Investigating a finding from `npm run lint:vendor-prompting` —
  every finding includes a `ruleId` that maps to a rule in
  [rules.json](rules.json) and back to a reference here.
- Choosing the right model family for a new agent (decision rules in
  [family-support.md](references/family-support.md)).

**Do NOT load this skill** for routine edits where the format is
already known. The thin instruction
[vendor-prompting.instructions.md](../../instructions/vendor-prompting.instructions.md)
auto-loads on `*.agent.md` / `*.prompt.md` edits and carries the
hard-rule shortlist.

## Decision Tree

```text
I am editing or reviewing a *.agent.md / *.prompt.md ...
├── Which model is in the frontmatter?
│   ├── Claude Opus / Claude Sonnet → load references/claude-best-practices.md
│   ├── Claude Haiku                → load references/claude-best-practices.md (warn-only)
│   ├── GPT-5.5                     → load references/gpt-5-prompting.md
│   ├── GPT-5.4                     → deprecated 2026-05; see references/gpt-5-upgrade.md (historical)
│   ├── GPT-Codex / GPT-4o          → reviewer-only; minimal automated rules
│   └── Unknown / missing           → ERROR: force explicit model: in frontmatter
│
├── Is this a .prompt.md (single string model:) or .agent.md (array)?
│   ├── prompt → load references/checklists.md "prompt" column
│   └── agent  → load references/checklists.md "agent" column
│
└── Want the full audit procedure (5-15 min, produces written report)?
    → load references/audit-procedure.md and assets/audit-template.md
```

## Model-Family Detection

`classifyModel()` lower-cases the `model:` value and matches substrings in priority order
to assign a family (`claude-opus` / `claude-sonnet` / `claude-haiku` / `claude` / `gpt-5.5`
/ `gpt-5.4` / `gpt-codex` / `gpt-4o` / `unknown`). For agents with `model:` as an array,
the first entry decides the family; bareword qualifiers (`Claude Foo (suffix)`) are
forbidden — see rule `frontmatter-model-style-001` in [`rules.json`](rules.json).

Full match table, severity status per family (`enforced` / `warn-only` / `reviewer-only` /
`out-of-scope`), and rule subsets per family live in
[`references/family-support.md`](references/family-support.md).

## Reference Index

Load only the references your task needs. Most audits need 1-2.

| Reference                                                       | Load when                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [claude-best-practices.md](references/claude-best-practices.md) | Authoring or auditing a Claude agent                                   |
| [gpt-5-prompting.md](references/gpt-5-prompting.md)             | Authoring or auditing a GPT-5.5 agent                                  |
| [gpt-5-upgrade.md](references/gpt-5-upgrade.md)                 | Historical: GPT-5.4 → GPT-5.5 migration notes (cohort retired 2026-05) |
| [cross-model-rules.md](references/cross-model-rules.md)         | Handoff design, prompt↔agent sync, language calibration                |
| [family-support.md](references/family-support.md)               | Picking a model family for a new agent                                 |
| [checklists.md](references/checklists.md)                       | Performing a manual pass-through audit                                 |
| [audit-procedure.md](references/audit-procedure.md)             | Executing the full 6-step audit                                        |

## Rules

- **Source of truth is `rules.json`** — every rule has an ID, severity, source citation, applies-to, and validator-check binding; this skill prose only references it
- **Model family is decided by the FIRST entry** in a model array (agents); the table in [Model-Family Detection](#model-family-detection-mirrors-validate-agentsmjs-classifymodel) is canonical
- **`unknown` family = ERROR** — always require an explicit `model:` value that the validator can classify
- **Bareword YAML for parenthetical model labels is forbidden** (`model: Claude Foo (suffix)` — see rule `frontmatter-model-style-001`)
- **Do NOT load this skill for routine edits** — the auto-loaded thin instruction `vendor-prompting.instructions.md` carries the hard-rule shortlist
- **Run `npm run lint:vendor-prompting`** before opening a PR; every finding includes a `ruleId` that maps to a `rules.json` entry
- **Verdict thresholds** — APPROVED if zero `error`s and ≤ 5 `warn`s; otherwise NEEDS_REVISION with per-rule remediation
- **Out of scope**: routine prompt edits where rules are already known, generic markdown style (see `markdown.instructions.md`)

## Steps

This is the canonical audit procedure (full version with templates lives
in [audit-procedure.md](references/audit-procedure.md)).

1. **Read frontmatter** of the target `.agent.md` / `.prompt.md`.
   Capture `name`, `model`, `user-invocable`, `agents`, `handoffs[]`.
2. **Classify model family** using the table above. Note the family's
   v1 status from [family-support.md](references/family-support.md).
3. **Load the matching checklist** from
   [checklists.md](references/checklists.md): pick the agent or prompt
   column, then the family-specific section.
4. **Run the validator**:
   `node tools/scripts/validate-agents.mjs --only=vendor-prompting --format=json`
   and filter by file path. Capture rule IDs + severities.
5. **Manual pass**: walk the checklist. Each Yes/No carries a rule ID
   and a verification hint (grep pattern, command, or visual cue).
6. **Produce a report** using
   [assets/audit-template.md](assets/audit-template.md). Combine
   automated findings (step 4) + manual findings (step 5). Verdict =
   APPROVED if zero `error`s and ≤ 5 `warn`s; otherwise NEEDS_REVISION
   with per-rule remediation.

## Source Citations

Every rule in [rules.json](rules.json) cites the upstream source by
`source_id`. The current source set:

- **Anthropic Claude prompting best practices** — live web doc at
  [platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices).
  Refresh via `npm run audit:vendor-prompting`.
- **OpenAI GPT-5.5 prompting guide** — pinned to
  `openai/skills@724cd511c96593f642bddf13187217aa155d2554`,
  `prompting-guide.md`, sha256
  `ecdf49b4a824a87367c7a6ec3c0218e2c5783dff951b30a101c3b6a95152aafa`.
- **OpenAI upgrade guide** — same pin, `upgrade-guide.md`, sha256
  `563784eb13ad1b44c3a592f940aa7ac2086ebeb97df3f4a09ba038b2f1564d39`.

## Freshness

Run `npm run audit:vendor-prompting` to refresh snapshots and emit a
drift report. The fetch script
([fetch-vendor-prompting-guides.mjs](../../../tools/scripts/fetch-vendor-prompting-guides.mjs))
falls back from `gh api` (auth) → anonymous raw → cached committed
prose if upstream is unavailable.

When upstream changes, regenerate this skill via
`node tools/scripts/generate-skill-digests.mjs` and update the cited
sha256 values in [rules.json](rules.json).
