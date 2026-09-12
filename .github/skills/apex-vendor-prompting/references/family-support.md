<!-- ref:family-support-v1 -->

# Family Support Matrix

> Source: [.github/skills/apex-vendor-prompting/rules.json](../rules.json)
> `families` array. Updated by editing rules.json (this file is a
> human-readable mirror).

The validator's `classifyModel()` maps `model:` strings to families.
Family status determines per-rule severity overrides.

Apply checks to every ordered fallback and every inherited custom-agent fallback.
Classification is not catalog authorization. Preserve exact `gpt-5.6-sol`; its
user-confirmed label does not prove release metadata or runtime cost eligibility.

## Status definitions

| Status          | Meaning                                                       |
| --------------- | ------------------------------------------------------------- |
| `enforced`      | All rules apply at default severity. Errors block CI.         |
| `warn-only`     | Model advice stays at warn or below; structural errors remain errors. |
| `reviewer-only` | Model advice becomes info; structural and deprecation checks still run. |
| `out-of-scope`  | Family is not covered by this skill.                          |

## Matrix

| Family          | v1 status     | Rule subset                                        | Examples            |
| --------------- | ------------- | -------------------------------------------------- | ------------------- |
| `claude-opus`   | enforced      | All Claude rules at default severity               | `Claude Opus 5`     |
| `claude-sonnet` | enforced      | All Claude rules at default severity               | `Claude Sonnet 5`   |
| `claude-haiku`  | warn-only     | XML structuring + few-shot rules; rest downgraded  | `Claude Haiku 4.5`  |
| `claude`        | warn-only     | Generic Claude — flag at warn for explicit version | `Claude`            |
| `gpt-5.6-sol`   | enforced      | APEX Markdown outcome convention; unknown metadata | `gpt-5.6-sol`       |
| `gpt-5.6-terra` | enforced      | APEX Markdown outcome convention                   | `GPT-5.6-Terra`     |
| `gpt-5.6-luna`  | enforced      | APEX Markdown outcome convention                   | `GPT-5.6-Luna`      |
| `gpt-5.5`       | enforced      | Legacy OpenAI outcome-first compatibility          | `GPT-5.5`           |
| `gpt-5.4`       | enforced      | Shared OpenAI outcome-first rules                  | `GPT-5.4`           |
| `gpt-codex`     | reviewer-only | Legacy decision-log compatibility                  | `GPT-5.3-Codex`     |
| `gpt-4o`        | reviewer-only | Legacy; no new enforcement                         | `GPT-4o`            |
| `mai-code`      | reviewer-only | Microsoft model; no MAI-specific prompting rules   | `MAI-Code-1.1-Flash` |
| `unknown`       | enforced      | Require catalog authorization for explicit labels | (anything else)     |

## How severity is computed

For a given rule + agent:

1. Start with `rule.severity` (the rule's default).
2. Structural errors and `model-deprecation-001` retain their base severity.
3. For other rules, `reviewer-only` downgrades findings to `info`.
4. `warn-only` keeps advice at warn or below; other statuses use defaults.

The current validator has no date-driven promotion or per-rule override engine;
historical `promotion_date` and empty `family_overrides` fields are provenance,
not executable policy. Missing models on valid inherited prompts are not errors.
Main outcome sections and leaf role contracts are repository requirements, not
proof of Sol/Terra/Luna-specific vendor guidance or runtime behavior.

## Adding a new family

1. Add a `classifyModel` branch in
   [validate-agents.mjs](../../../../tools/scripts/validate-agents.mjs).
2. Add a unit test in
   `tools/tests/validate-agents/classify-model.test.mjs`.
3. Add a `families[]` entry in [rules.json](../rules.json).
4. Add a row to the matrix above.
5. (Optional) Add a `family_overrides` entry to specific rules where
   the new family needs different severity.
