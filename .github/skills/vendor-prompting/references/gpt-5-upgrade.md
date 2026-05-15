<!-- ref:gpt-5-upgrade-v1 -->

# OpenAI GPT-5.5 — Upgrade Guide (Normalized)

> Source: [openai/skills @ 724cd511c96593f642bddf13187217aa155d2554/upgrade-guide.md](https://github.com/openai/skills/blob/724cd511c96593f642bddf13187217aa155d2554/skills/.curated/openai-docs/references/upgrade-guide.md)
> sha256 `563784eb13ad1b44c3a592f940aa7ac2086ebeb97df3f4a09ba038b2f1564d39`.
> Snapshot: [.snapshots/openai-upgrade-guide.md](.snapshots/openai-upgrade-guide.md).

> **Status: HISTORICAL.** GPT-5.4 was retired 2026-05; the APEX cohort migration
> is complete. New agents must use `GPT-5.5` directly. This file is preserved
> for audit history and to document the migration patterns that were applied.

This file normalizes the OpenAI GPT-5.5 upgrade guide for use when
migrating repo agents from GPT-5.4 → GPT-5.5.

## Upgrade posture (verbatim from source)

> Upgrade with the narrowest safe change set:
>
> - replace the model string first
> - update only the prompts that are directly tied to that model usage
> - do not automatically upgrade older or ambiguous model usages that
>   may be intentionally pinned
> - prefer prompt-only upgrades when possible
> - if the upgrade would require API-surface changes, parameter
>   rewrites, tool rewiring, provider migration, or broader code
>   edits, mark it as blocked

## Three upgrade outcomes

OpenAI defines three classes; this repo maps them to actions:

| Outcome                               | Repo action                                                              |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `model string only`                   | Update `model:` in frontmatter + agent registry. No body changes.        |
| `model string + light prompt rewrite` | Plus add the GPT-5.5 outcome-first skeleton (rule `gpt55-skeleton-001`). |
| `blocked`                             | Open an issue documenting the blocker; do not edit the agent.            |

## Upgrade workflow (mapped to repo)

1. **Inventory** — `grep -rn "model:" .github/agents/ .github/prompts/`
   plus `.github/model-catalog.json`.
2. **Pair model usage with prompt surface** — for each `.agent.md`
   the prompt surface is the file body itself.
3. **Classify source family** — use `classifyModel()` from
   [validate-agents.mjs](../../../../tools/scripts/validate-agents.mjs).
4. **Decide upgrade class** per the table above.
5. **Compatibility gate**:
   - VS Code Copilot accepts `GPT-5.5` model string. ✅
   - Repo subagents do not use `phase` (no replay). ✅
   - Tool definitions are agent-frontmatter `tools:` lists — no
     schema rewrites needed. ✅
6. **Apply upgrade** — for `model string + light prompt rewrite`,
   verify the GPT-5.5 skeleton is present (validator catches missing
   sections via `gpt55-skeleton-001`).
7. **Summarize** — record decision in `00-session-state.json`
   `decision_log` per
   [agent-authoring.instructions.md](../../../instructions/agent-authoring.instructions.md).

## Compatibility checklist (verbatim, with repo annotations)

1. Can the current host accept the `gpt-5.5` model string? ✅ VS Code
   Copilot.
2. Are the related prompts identifiable and editable? ✅
   `.github/agents/*.agent.md`.
3. Does the host depend on behavior that needs API-surface changes?
   ❌ Agent definitions are markdown only.
4. Would the likely fix be prompt-only? ✅
5. Is the prompt surface close to the model usage? ✅ Same file.
6. Do strict structured outputs still have an explicit contract?
   ⚠️ Only Claude agents have `<output_contract>` blocks today;
   GPT-5.5 agents rely on the `# Output` section of the skeleton.
7. For long-running Responses or tool-heavy agents, is `phase`
   preserved? ✅ Repo does not use `phase`.
8. Are latency/token/price assumptions validated? ⚠️ Tracked in
   `agent-authoring.instructions.md` model-assignment rationale.

## Repo-specific upgrade history

The current GPT-5.5 cohort migrated under
[chore/migrate-claude-opus-4-7](https://github.com/jonathan-vella/azure-agentic-infraops/tree/chore/migrate-claude-opus-4-7)
and [chore/post-opus-47-followups](https://github.com/jonathan-vella/azure-agentic-infraops/tree/chore/post-opus-47-followups)
branches. Until those land on `main`, do not modify GPT-5.5
agent bodies in this branch.

Current GPT-5.5 agents (per agent-authoring model assignment table):

- `01-Orchestrator`
- `04-Design`, `04g-Governance`
- `06b-Bicep CodeGen`, `06t-Terraform CodeGen`
- `10-Challenger` wrapper, `challenger-review-subagent`

## Out-of-scope for this skill (per OpenAI guide)

- Moving Chat Completions code to Responses
- Migrating SDKs, IDE configuration, shell hooks, plugins
- Rewriting parameter shapes
- Changing tool definitions or tool-call handling
- Editing business logic / orchestration logic

If a GPT-5.5 upgrade requires any of the above, mark the path as
blocked and open a separate issue.

## Cross-references

- [gpt-5-prompting.md](gpt-5-prompting.md) — what to do _after_ the
  upgrade (apply the outcome-first skeleton).
- [audit-procedure.md](audit-procedure.md) — verify compliance after
  upgrade.
