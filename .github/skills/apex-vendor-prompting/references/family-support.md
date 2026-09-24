<!-- ref:family-support-v1 -->

# Family Support Matrix

> Source: [.github/skills/apex-vendor-prompting/rules.json](../rules.json)
> `families` array. Updated by editing rules.json (this file is a
> human-readable mirror).

The validator's `classifyModel()` maps `model:` strings to families.
Family status determines per-rule severity overrides.

Apply checks to every ordered fallback and every inherited custom-agent fallback.
Classification is not catalog authorization. Preserve exact picker labels; a
user-confirmed label does not prove release metadata or runtime cost eligibility.

## Status definitions

| Status          | Meaning                                                       |
| --------------- | ------------------------------------------------------------- |
| `enforced`      | All rules apply at default severity. Errors block CI.         |
| `warn-only`     | Model advice stays at warn or below; structural errors remain errors. |
| `reviewer-only` | Model advice becomes info; structural and deprecation checks still run. |
| `out-of-scope`  | Family is not covered by this skill.                          |

## Matrix

| Family            | Status        | Rule subset                                                     | Examples                  |
| ----------------- | ------------- | --------------------------------------------------------------- | ------------------------- |
| `claude-opus-5.5` | enforced      | All Claude rules, including Opus 5.5 thinking and stop guidance | `Claude Opus 5.5`         |
| `gpt-6-sol`       | enforced      | GPT-6 family guidance + APEX outcome contract                   | `GPT-6-Sol`               |
| `gpt-6-luna`      | enforced      | GPT-6 family guidance + APEX outcome contract                   | `GPT-6-Luna`              |
| `gpt-5.6-terra`   | enforced      | GPT-5.6 prompt guidance + APEX outcome contract                 | `GPT-5.6 Terra (copilot)` |
| `mai-code`        | reviewer-only | Microsoft model; no MAI-specific prompting rules                | `MAI-Code-1.1-Flash`      |
| `unknown`         | enforced      | Require catalog authorization for explicit labels               | (anything else)           |

Retired labels (earlier Claude Opus/Sonnet/Haiku, GPT-5.6 Sol/Luna, GPT-5.5 and older) classify as `unknown`
and fail catalog authorization.

## How severity is computed

For a given rule + agent:

1. Start with `rule.severity` (the rule's default).
2. Structural errors and `model-deprecation-001` retain their base severity.
3. For other rules, `reviewer-only` downgrades findings to `info`.
4. `warn-only` keeps advice at warn or below; other statuses use defaults.

The current validator has no date-driven promotion or per-rule override engine;
historical `promotion_date` and empty `family_overrides` fields are provenance,
not executable policy. Missing models on valid inherited prompts are not errors.
Rules with `validator_check_id: "reviewer-only"` have no automated check; they are
manual checklist items at their listed severity.

## Adding a new family

1. Add a `classifyModel` branch in
   [validate-agents.mjs](../../../../tools/scripts/validate-agents.mjs).
2. Add a unit test in
   `tools/tests/validate-agents/classify-model.test.mjs`.
3. Add a `families[]` entry in [rules.json](../rules.json).
4. Add a row to the matrix above.
5. (Optional) Add a `family_overrides` entry to specific rules where
   the new family needs different severity.
