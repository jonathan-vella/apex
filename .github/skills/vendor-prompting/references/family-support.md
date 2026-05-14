<!-- ref:family-support-v1 -->

# Family Support Matrix

> Source: [.github/skills/vendor-prompting/rules.json](../rules.json)
> `families` array. Updated by editing rules.json (this file is a
> human-readable mirror).

The validator's `classifyModel()` maps `model:` strings to families.
Family status determines per-rule severity overrides.

## Status definitions

| Status          | Meaning                                                       |
| --------------- | ------------------------------------------------------------- |
| `enforced`      | All rules apply at default severity. Errors block CI.         |
| `warn-only`     | All rules downgrade to `warn` (or below). CI does not block.  |
| `reviewer-only` | No automated enforcement; rules surface in manual checklists. |
| `out-of-scope`  | Family is not covered by this skill.                          |

## Matrix

| Family          | v1 status     | Rule subset                                        | Examples            |
| --------------- | ------------- | -------------------------------------------------- | ------------------- |
| `claude-opus`   | enforced      | All Claude rules at default severity               | `Claude Opus 4.7`   |
| `claude-sonnet` | enforced      | All Claude rules at default severity               | `Claude Sonnet 4.6` |
| `claude-haiku`  | warn-only     | XML structuring + few-shot rules; rest downgraded  | `Claude Haiku 4.5`  |
| `claude`        | warn-only     | Generic Claude — flag at warn for explicit version | `Claude`            |
| `gpt-5.5`       | enforced      | All GPT-5.5 rules at default severity              | `GPT-5.5`           |
| `gpt-5.4`       | deprecated    | Retired 2026-05; no active assignments             | `GPT-5.4`           |
| `gpt-codex`     | reviewer-only | Decision-log only; no automated enforcement        | `GPT-5.3-Codex`     |
| `gpt-4o`        | reviewer-only | Legacy; no new enforcement                         | `GPT-4o`            |
| `unknown`       | enforced      | Raises ERROR to force explicit `model:` value      | (anything else)     |

## How severity is computed

For a given rule + agent:

1. Start with `rule.severity` (the rule's default).
2. If `rule.family_overrides[]` contains an entry for the agent's
   classified family, replace severity with the override.
3. If the family's status is `warn-only`, downgrade `error` → `warn`.
4. If the family's status is `reviewer-only`, downgrade to `info`
   (advisory).
5. If the family's status is `out-of-scope`, skip the rule entirely.

## Adding a new family

1. Add a `classifyModel` branch in
   [validate-agents.mjs](../../../../tools/scripts/validate-agents.mjs).
2. Add a unit test in
   `tools/tests/validate-agents/classify-model.test.mjs`.
3. Add a `families[]` entry in [rules.json](../rules.json).
4. Add a row to the matrix above.
5. (Optional) Add a `family_overrides` entry to specific rules where
   the new family needs different severity.
