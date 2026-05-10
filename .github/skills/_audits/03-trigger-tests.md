# Stage 4 — Waza trigger-test scaffolding

> **Plan**: [`plan-gepa-pipeline.prompt.md`](../../prompts/sensei/plan-gepa-pipeline.prompt.md) — Stage 4
> **Generated**: 2026-05-10
> **Branch**: `feat/skills-sensei`
> **Trigger**: `tests batch <N>`

Each skill in scope (33 total under `.github/skills/`, excluding `sensei/` and
`archived_skills/`) gets a generated test scaffold under `tests/{skill}/`:

- `trigger_tests.yaml` — Waza native format, source of truth, hand-editable.
- `triggers.test.ts` — minimal TypeScript shim regenerated from the YAML.
  The shim exists so the sensei GEPA auto-evaluator
  (`.github/skills/sensei/scripts/src/gepa/auto_evaluator.py`) can discover
  trigger arrays via its regex-based parser. Editing the YAML and re-running
  the scaffolder keeps the two in lockstep.

## Scaffolder

[`tools/scripts/scaffold-trigger-tests.mjs`](../../../tools/scripts/scaffold-trigger-tests.mjs)
parses each skill's `description:` frontmatter, extracts `WHEN:`, `USE FOR:`,
and `DO NOT USE FOR:` clauses, then expands each phrase into 4 affirmative
variants (exact, question, command, context) and 2 anti-trigger variants
(exact, question). Generic anti-trigger probes ("What is the weather today?",
"Help me write a poem") are appended unconditionally to prevent over-fitting.

Run modes:

```bash
node tools/scripts/scaffold-trigger-tests.mjs --skills azure-adr azure-artifacts ...
node tools/scripts/scaffold-trigger-tests.mjs --batch 1
node tools/scripts/scaffold-trigger-tests.mjs --all
```

The scaffolder is idempotent — re-running on a skill overwrites its YAML +
TS shim from the current frontmatter. To customize a skill's tests, edit the
YAML and run the scaffolder with that skill on the command line; the YAML
edits drive the regenerated shim.

## Stage 4 — Trigger tests (batch 1)

**Trigger**: `tests batch 1` (2026-05-10).
**Skills**: `azure-adr`, `azure-artifacts`, `azure-bicep-patterns`,
`azure-cloud-migrate`, `azure-compliance`, `azure-compute`, `azure-cost-optimization`.

### Per-skill counts

| Skill | shouldTriggerPrompts | shouldNotTriggerPrompts | trigger_accuracy | quality_score |
| --- | ---: | ---: | ---: | ---: |
| `azure-adr` | 36 | 12 | 0.88 | 1.00 |
| `azure-artifacts` | 24 | 10 | 0.71 | 1.00 |
| `azure-bicep-patterns` | 32 | 16 | 0.79 | 1.00 |
| `azure-cloud-migrate` | 32 | 8 | 0.80 | 1.00 |
| `azure-compliance` | 32 | 10 | 0.90 | 1.00 |
| `azure-compute` | 36 | 10 | 0.65 | 1.00 |
| `azure-cost-optimization` | 36 | 14 | 0.96 | 0.83 |

All seven skills exceed the plan's 10/5 minimum. Only `azure-artifacts` and
`azure-cloud-migrate` come close to the floor for anti-triggers (10 and 8
respectively); both have just 2 `DO NOT USE FOR:` phrases in their frontmatter,
so the generated coverage is proportional to source signal.

> **Note on `azure-cost-optimization` `quality_score: 0.83`**: this is a
> Stage-2-squeeze artifact, not a Stage 4 regression. Plan 1 closed with all
> 33 skills at 1.00; Stage 2 relocated 766 tokens from this skill (Steps 0–3
> of the Instructions section) to `references/workflow-steps.md` and the
> reorganization shifted the GEPA content-quality scorer's signal. Out of
> scope for Stage 4; addressed by Stage 5 GEPA optimize.

### Validators

| Validator | Status |
| --- | --- |
| `npm run validate:skills` | ✅ pass (34 skills, 0 errors, 0 warnings) |
| `npm run validate:agents` | ✅ pass |
| `npm run lint:vendor-prompting` | ✅ pass |
| `npm run lint:safe-shell` | ✅ pass (227 files, 0 violations) |

Stage 4 / batch 1 complete. Awaiting `tests batch 2` to continue.

## Stage 4 — Trigger tests (batch 2)

**Trigger**: `tests batch 2` (2026-05-10).
**Skills**: `azure-defaults`, `azure-deploy`, `azure-diagnostics`,
`azure-governance-discovery`, `azure-kusto`, `azure-prepare`, `azure-quotas`.

| Skill | shouldTriggerPrompts | shouldNotTriggerPrompts | trigger_accuracy | quality_score |
| --- | ---: | ---: | ---: | ---: |
| `azure-defaults` | 28 | 8 | 0.56 | 1.00 |
| `azure-deploy` | 32 | 12 | 0.39 | 1.00 |
| `azure-diagnostics` | 36 | 10 | 0.91 | 1.00 |
| `azure-governance-discovery` | 28 | 10 | 0.67 | 1.00 |
| `azure-kusto` | 40 | 10 | 0.60 | 1.00 |
| `azure-prepare` | 60 | 14 | 0.32 | 1.00 |
| `azure-quotas` | 40 | 10 | 0.84 | 1.00 |

`azure-prepare` has 12 `WHEN:` phrases (the most of any skill), which produces 60
shouldTriggerPrompts. Its 0.32 accuracy reflects how poorly plain-English
phrases like "create app" / "build web app" / "function app" match the GEPA
keyword stemmer — Stage 5 GEPA optimize is designed to lift these.

`azure-deploy` 0.39 same root cause.

All 7 skills exceed the plan's 10/5 minimum and trigger_accuracy is non-null.

Awaiting `tests batch 3` to continue.
