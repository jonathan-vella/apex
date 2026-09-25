---
name: apex-vendor-prompting
user-invocable: true
disable-model-invocation: true
argument-hint: "agent or prompt path, model family and audit scope"
description: '**ANALYSIS SKILL** — Manual-only audit of Anthropic Claude Opus 5.5 and OpenAI GPT-6 / GPT-5.6 prompting guidance and APEX conventions. WHEN: explicitly invoked as /apex-vendor-prompting for a vendor-specific prompt audit. DO NOT USE FOR: automatic authoring loads, routine edits covered by instructions, generic Markdown style.'
license: MIT
---

# Vendor Prompting Best Practices

Manual-only: use `/apex-vendor-prompting` explicitly for this audit workflow.
Do not load this skill automatically or read its body to bypass the invocation flag.
The thin authoring instructions and required vendor validators remain mandatory without this skill.

Audit-grade reference for the prompting patterns published by Anthropic
(Claude Opus 5.5) and OpenAI (GPT-6, GPT-5.6), plus explicitly identified APEX conventions. Used to author **and** audit
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
│   ├── Claude Opus 5.5            → load references/claude-best-practices.md
│   ├── GPT-6 Sol / Luna (copilot) → load references/openai-prompting.md
│   ├── GPT-5.6 Terra (copilot)    → load references/openai-prompting.md
│   ├── MAI-Code-1.1-Flash         → reviewer-only; structural checks still run
│   └── Missing on prompt          → resolve custom-agent or picker inheritance
│
├── Is this a .prompt.md (single string model:) or .agent.md (array)?
│   ├── prompt → load references/checklists.md "prompt" column
│   └── agent  → load references/checklists.md "agent" column
│
└── Want the full audit procedure (5-15 min, produces written report)?
    → load references/audit-procedure.md and assets/audit-template.md
```

## Model-Family Detection

`classifyModel()` lower-cases the `model:` value and matches it to a family
(`claude-opus-5.5` / `gpt-6-sol` / `gpt-6-luna` / `gpt-5.6-terra` / `mai-code` / `unknown`).
Retired labels classify as `unknown`. Validate every ordered fallback label and distinct family.
Classification does not authorize a label: ordinary labels must exactly match
the catalog. Only handoff overrides allow documented platform qualification.

Full match table, severity status per family (`enforced` / `warn-only` / `reviewer-only` /
`out-of-scope`), and rule subsets per family live in
[`references/family-support.md`](references/family-support.md).

## Reference Index

Load only the references your task needs. Most audits need 1-2.

| Reference                                                       | Load when                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [claude-best-practices.md](references/claude-best-practices.md) | Authoring or auditing a Claude Opus 5.5 agent                          |
| [openai-prompting.md](references/openai-prompting.md)           | Authoring or auditing a GPT-6 Sol/Luna or GPT-5.6 Terra agent          |
| [cross-model-rules.md](references/cross-model-rules.md)         | Handoff design, prompt↔agent sync, language calibration                |
| [family-support.md](references/family-support.md)               | Picking a model family for a new agent                                 |
| [checklists.md](references/checklists.md)                       | Performing a manual pass-through audit                                 |
| [audit-procedure.md](references/audit-procedure.md)             | Executing the full 6-step audit                                        |

## Rules

- **Source of truth is `rules.json`** — every rule has an ID, severity, source citation,
  applies-to, and validator-check binding; this skill prose only references it.
- **Check every fallback** without adding one; see [Model-Family Detection](#model-family-detection).
- **Missing prompt models may be inherited**; unknown explicit labels and unknown custom-agent targets fail validation.
- **Array agent models and string prompt models are APEX conventions**, not YAML limitations.
  Parentheses are valid YAML scalar content.
- **Markdown outcome contracts for GPT are an APEX convention** that mirrors the GPT-5.6
  suggested prompt structure and extends it to GPT-6. Preserve exact catalog labels;
  unknown release/tier metadata stays unknown.
- **Vendor autonomy advice does not remove APEX gates** — approval gates, the security
  baseline and governance constraints stay required stops; consolidate their wording instead.
- **Leaf workers use role contracts**, not mandatory personality or main-agent sections.
  Convert XML wrappers without deleting their safety or workflow content.
- **Do NOT load this skill for routine edits** — the auto-loaded thin instruction
  `vendor-prompting.instructions.md` carries the hard-rule shortlist.
- **Run `npm run lint:vendor-prompting`** before opening a PR; every finding includes
  a `ruleId` that maps to a `rules.json` entry.
- **Verdict thresholds** — APPROVED if zero `error`s and ≤ 5 `warn`s; otherwise NEEDS_REVISION with per-rule remediation
- **Out of scope**: routine prompt edits where rules are already known, generic markdown style (see `markdown.instructions.md`)

## Steps

This is the canonical audit procedure (full version with templates lives
in [audit-procedure.md](references/audit-procedure.md)).

1. **Read frontmatter** of the target `.agent.md` / `.prompt.md`.
   Capture `name`, `model`, `user-invocable`, `agents`, `handoffs[]`.
2. **Classify model family** using the table above. Note the family's
  status for every fallback from [family-support.md](references/family-support.md).
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
`source_id`. All sources are live vendor docs fetched as Markdown (`.md` suffix):

- **Anthropic Claude prompting best practices** —
  [claude-prompting-best-practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices).
- **Anthropic Prompting Claude Opus 5.5** —
  [prompting-claude-opus-5-5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5):
  effort calibration, thinking-disabled migration, unattended runs, pasted text, progress updates.
- **Anthropic Prompting Claude Opus 5** —
  [prompting-claude-opus-5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5):
  baseline the Opus 5.5 guide defers to — over-verification, task scope, subagent spawning, deliverable length.
- **OpenAI Using GPT-6** —
  [latest-model/gpt-6-astra](https://developers.openai.com/api/docs/guides/latest-model/gpt-6-astra):
  family prompting best practices (written for Astra, starting point for Sol and Luna).
- **OpenAI Using GPT-5.6** —
  [latest-model/gpt-5.6](https://developers.openai.com/api/docs/guides/latest-model/gpt-5.6):
  Terra/Sol/Luna tiers, migration quickstart.
- **OpenAI Prompting guidance for GPT-5.6** —
  [prompt-guidance-gpt-5p6](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6):
  suggested prompt structure, autonomy boundaries, lean prompts.

OpenAI sources use model-pinned paths; `latest-model` without a model segment moves to the
next generation silently. Hashes and fetch timestamps live in `rules.json` `sources[]`.

## Freshness

With explicit network authorization, run `node tools/scripts/fetch-vendor-prompting-guides.mjs`
to refresh snapshots and emit a drift report. The fetch script
([fetch-vendor-prompting-guides.mjs](../../../tools/scripts/fetch-vendor-prompting-guides.mjs))
fetches each vendor Markdown page anonymously. Snapshots are a gitignored local cache: when
upstream is unavailable it falls back to a snapshot from an earlier successful run on the same
machine. A clean checkout has no cache, so an offline refresh fails (exit 2) rather than
falling back; `rules.json` hashes are the committed record.

Cached fallback preserves the last successful `fetched_at` and freshness date;
`attempted_at` and the failure reason record the separate refresh attempt.
Missing successful provenance remains unknown. An unchanged successful network
response may advance freshness; cached reuse cannot establish upstream currency.

Review actual source diffs before updating normalized references and rule citations.
There is no digest-generation step. Offline audits reuse cached sources without
changing hashes, fetched timestamps, or claiming refreshed evidence. Source history
does not establish model release, capabilities, cost tiers, or native harness behavior.
