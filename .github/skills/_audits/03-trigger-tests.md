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

## Stage 4 — Trigger tests (batch 3)

**Trigger**: `tests batch 3` (2026-05-10).
**Skills**: `azure-rbac`, `azure-resources`, `azure-storage`, `azure-validate`,
`context-management`, `docs-writer`, `drawio`.

| Skill | shouldTriggerPrompts | shouldNotTriggerPrompts | trigger_accuracy | quality_score |
| --- | ---: | ---: | ---: | ---: |
| `azure-rbac` | 36 | 10 | 0.91 | 1.00 |
| `azure-resources` | 40 | 18 | 0.76 | 0.83 |
| `azure-storage` | 40 | 10 | 0.68 | 1.00 |
| `azure-validate` | 40 | 10 | 0.72 | 1.00 |
| `context-management` | 20 | 10 | 0.47 | 1.00 |
| `docs-writer` | 44 | 8 | 0.62 | 1.00 |
| `drawio` | 32 | 10 | 0.62 | 1.00 |

`azure-resources` `quality_score: 0.83` is a Stage-2-squeeze artifact from the
44-line Lookup Workflow relocation; will be addressed by Stage 5.
`context-management` `trigger_accuracy: 0.47` is the lowest in this batch —
the WHEN phrases ("context optimization", "token budget management", etc.) are
pure prose without strong Azure keyword stems.

All 7 trigger_accuracy non-null. Awaiting `tests batch 4` to continue.

## Stage 4 — Trigger tests (batch 4)

**Trigger**: `tests batch 4` (2026-05-10).
**Skills**: `entra-app-registration`, `github-operations`, `golden-principles`,
`iac-common`, `mermaid`, `microsoft-docs`.

| Skill | shouldTriggerPrompts | shouldNotTriggerPrompts | trigger_accuracy | quality_score |
| --- | ---: | ---: | ---: | ---: |
| `entra-app-registration` | 40 | 12 | 0.62 | 0.83 |
| `github-operations` | 52 | 8 | 0.53 | 1.00 |
| `golden-principles` | 20 | 10 | 0.80 | 1.00 |
| `iac-common` | 28 | 10 | 0.84 | 1.00 |
| `mermaid` | 48 | 10 | 0.86 | 1.00 |
| `microsoft-docs` | 48 | 6 | 0.33 | 1.00 |

`entra-app-registration` `quality_score: 0.83` is a Stage-2-squeeze artifact
(64-line Core Workflow relocation). `microsoft-docs` `trigger_accuracy: 0.33`
reflects the prose-heavy WHEN phrases (`Microsoft Learn`, `Azure docs`,
`quickstart guide`) — most don't tokenize to Azure keyword stems.
`github-operations` only has 8 anti-triggers because it has 0 competing-skill
hints; still meets the 5-minimum.

All 6 trigger_accuracy non-null. Awaiting `tests batch 5` to continue.

## Stage 4 — Trigger tests (batch 5)

**Trigger**: `tests batch 5` (2026-05-10).
**Skills**: `python-diagrams`, `terraform-patterns`, `terraform-search-import`,
`terraform-test`, `vendor-prompting`, `workflow-engine`.

| Skill | shouldTriggerPrompts | shouldNotTriggerPrompts | trigger_accuracy | quality_score |
| --- | ---: | ---: | ---: | ---: |
| `python-diagrams` | 60 | 10 | 0.74 | 1.00 |
| `terraform-patterns` | 32 | 16 | 0.62 | 1.00 |
| `terraform-search-import` | 36 | 14 | 0.72 | 0.83 |
| `terraform-test` | 52 | 10 | 0.94 | 1.00 |
| `vendor-prompting` | 32 | 6 | 0.84 | 1.00 |
| `workflow-engine` | 28 | 8 | 0.83 | 1.00 |

`terraform-search-import` `quality_score: 0.83` is a Stage-2-squeeze artifact
(38-line Manual Discovery Workflow collapse).

All 6 trigger_accuracy non-null.

## Stage 4 grand totals (all 33 skills)

| Metric | Value |
| --- | ---: |
| Total `shouldTriggerPrompts` across 33 skills | **1,220** |
| Total `shouldNotTriggerPrompts` across 33 skills | **350** |
| Mean shouldTrigger per skill | 37 |
| Mean shouldNotTrigger per skill | 11 |
| `trigger_accuracy` minimum | 0.32 (`azure-prepare`) |
| `trigger_accuracy` maximum | 0.96 (`azure-cost-optimization`) |
| `trigger_accuracy` mean | 0.71 |
| Skills with `trigger_accuracy ≥ 0.70` | 19 / 33 |
| Skills with `trigger_accuracy ≥ 0.50` | 28 / 33 |
| Skills with `quality_score < 1.00` (Stage-2 artifacts) | 4 / 33 |

The 4 skills at `quality_score: 0.83` (`azure-cost-optimization`,
`azure-resources`, `entra-app-registration`, `terraform-search-import`) are
all Stage-2-squeeze artifacts where the relocation moved enough body content
to references that the GEPA content-quality scorer dropped them. Plan 1 closed
with all 33 at 1.00; Stage 5 GEPA optimize is designed to lift them back.

The plan's success criterion ("`trigger_accuracy` is non-null") is met for
all 33 skills. The 14 skills below 0.70 (`azure-defaults`, `azure-deploy`,
`azure-kusto`, `azure-prepare`, `azure-resources`, `azure-storage`,
`context-management`, `docs-writer`, `drawio`, `entra-app-registration`,
`github-operations`, `microsoft-docs`, `terraform-patterns`, `terraform-search-import`)
are the prime candidates for Stage 5 LLM-driven optimization — most have
prose-heavy WHEN phrases that don't tokenize to Azure keyword stems.

Stage 4 fully complete; awaiting Stage 5 trigger
(`optimize batch <N>` or `optimize <skill>`).
