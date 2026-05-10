# Stage B — GEPA-mode audit report (read-only)

> **Source plan**: [`plan-skillsAuditOptimize.prompt.md`](../../prompts/plan-skillsAuditOptimize.prompt.md)
> **Branch**: `feat/skills-sensei`
> **Run date**: 2026-05-10
> **Scope**: 33 active skills under `.github/skills/` (excluding `sensei` submodule and `archived_skills/`).
> **Tool**: `npm run audit:skills:gepa` → `python3 .github/skills/sensei/scripts/src/gepa/auto_evaluator.py score-all` (deterministic, no LLM, no test harness).

**TL;DR** — Single read-only global GEPA `score-all` pass after Stage A's batch updates. Stage A's frontmatter targets (`WHEN:` / `USE FOR:` / `DO NOT USE FOR:` / `INVOKES:` / skill-type prefix / 1024-char description bound) hold across all 33 skills. The remaining gap is **GEPA's body-section signals**: `## Rules` (28× missing) and `## Steps` (25× missing) — explicitly out-of-scope per the source plan. Two skills drifted vs Stage A: `azure-artifacts` improved (0.50 → 0.67, +0.17), `azure-compute` regressed (0.83 → 0.67, −0.16). Aggregate average is unchanged at 0.74. **No skill files were modified by this audit.**

## 1. Aggregate

| Metric | Stage A (post-update baseline) | Stage B (current) | Δ |
| --- | ---: | ---: | ---: |
| Average GEPA `quality_score` | 0.73 | 0.73 | +0.00 |
| Skills at score = 1.00 | 3 / 33 | 3 / 33 | +0 |
| Skills at score ≥ 0.83 (`Skills passing GEPA ≥ 0.8` in Stage A) | 11 / 33 | 10 / 33 | -1 |
| Skills at score ≥ 0.67 (Stage A's inclusive `≥ 0.7` rounding) | 32 / 33 | 33 / 33 | +1 |
| Skills at score ≥ 0.70 (strict) | n/a (Stage A used inclusive rounding) | 10 / 33 | n/a |

Stage A reports rounded `0.67` as "passing GEPA ≥ 0.7" because GEPA returns 6 quality dimensions on a 0/1 scale (4/6 = 0.6667). Stage B uses strict comparisons. Distributions are otherwise consistent.

## 2. Drift since Stage A

2 skill(s) drifted vs the Stage A post-update baseline. Average drift across all 33 skills is **+0.00** (zero).

| Skill | Batch | Stage A after | Stage B | Δ | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| `azure-artifacts` | 1 | 0.50 | 0.67 | +0.17 | Stage A score appears to have under-counted; current state has 4/6 quality signals (frontmatter complete, body sections still missing). |
| `azure-compute` | 1 | 0.83 | 0.67 | -0.16 | Stage A scored a body section as present; current state shows both `## Rules` and `## Steps` missing. Investigate whether `SKILL.md` body was edited after the Stage A audit. |

## 3. Recurring GEPA feedback

| Count | Feedback string | In-scope per source plan? |
| ---: | --- | --- |
| 28 | `Missing '## Rules' section` | **No** — body section, out of frontmatter-only scope |
| 25 | `Missing '## Steps' section` | **No** — body section, out of frontmatter-only scope |

**Interpretation**: GEPA's content scorer rewards `## Rules` and `## Steps` body sections. Per the source plan ("Out of scope: Skill body content rewrites"), neither stage adds body content. With both signals at `0.0`, the ceiling for affected skills is `4/6 = 0.67`.

GEPA weighs six dimensions equally: `description_length`, `has_when`, `has_use_for`, `has_rules`, `has_steps`, `no_bad_patterns`. Stage A drove all five non-body dimensions to 1.0 across all 33 skills.

## 4. Score distribution

### 4.1 Score = 1.00 (3 skills)

_Frontmatter complete AND both `## Rules` and `## Steps` body sections present._

- `azure-cloud-migrate` (batch 1; Δ +0.00)
- `azure-deploy` (batch 2; Δ +0.00)
- `azure-validate` (batch 3; Δ +0.00)

### 4.2 Score 0.80 – 0.99 (7 skills)

_Frontmatter complete; one body section present, the other missing. One body addition closes the gap to 1.00._

- `azure-cost-optimization` (0.83, batch 1; Δ +0.00) — missing: `## Rules`
- `azure-diagnostics` (0.83, batch 2; Δ +0.00) — missing: `## Steps`
- `azure-prepare` (0.83, batch 2; Δ +0.00) — missing: `## Steps`
- `azure-resources` (0.83, batch 3; Δ +0.00) — missing: `## Rules`
- `docs-writer` (0.83, batch 3; Δ +0.00) — missing: `## Rules`
- `entra-app-registration` (0.83, batch 4; Δ +0.00) — missing: `## Rules`
- `terraform-search-import` (0.83, batch 5; Δ +0.00) — missing: `## Rules`

### 4.3 Score < 0.80 (23 skills)

_Frontmatter complete; **both** body sections missing. By design — body rewrites are out of scope per the source plan._

- `azure-adr` (0.67, batch 1; Δ +0.00)
- `azure-artifacts` (0.67, batch 1; Δ +0.17)
- `azure-bicep-patterns` (0.67, batch 1; Δ +0.00)
- `azure-compliance` (0.67, batch 1; Δ +0.00)
- `azure-compute` (0.67, batch 1; Δ -0.16)
- `azure-defaults` (0.67, batch 2; Δ +0.00)
- `azure-governance-discovery` (0.67, batch 2; Δ +0.00)
- `azure-kusto` (0.67, batch 2; Δ +0.00)
- `azure-quotas` (0.67, batch 2; Δ +0.00)
- `azure-rbac` (0.67, batch 3; Δ +0.00)
- `azure-storage` (0.67, batch 3; Δ +0.00)
- `context-management` (0.67, batch 3; Δ +0.00)
- `drawio` (0.67, batch 3; Δ +0.00)
- `github-operations` (0.67, batch 4; Δ +0.00)
- `golden-principles` (0.67, batch 4; Δ +0.00)
- `iac-common` (0.67, batch 4; Δ +0.00)
- `mermaid` (0.67, batch 4; Δ +0.00)
- `microsoft-docs` (0.67, batch 4; Δ +0.00)
- `python-diagrams` (0.67, batch 5; Δ +0.00)
- `terraform-patterns` (0.67, batch 5; Δ +0.00)
- `terraform-test` (0.67, batch 5; Δ +0.00)
- `vendor-prompting` (0.67, batch 5; Δ +0.00)
- `workflow-engine` (0.67, batch 5; Δ +0.00)

## 5. Per-skill Stage A vs Stage B

| Batch | Skill | Stage A after | Stage B | Δ | desc len | Top feedback |
| ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | `azure-adr` | 0.67 | 0.67 | +0.00 | 486 | Missing '## Rules' section |
| 1 | `azure-artifacts` | 0.50 | 0.67 | +0.17 | 432 | Missing '## Rules' section |
| 1 | `azure-bicep-patterns` | 0.67 | 0.67 | +0.00 | 451 | Missing '## Rules' section |
| 1 | `azure-cloud-migrate` | 1.00 | 1.00 | +0.00 | 527 | — |
| 1 | `azure-compliance` | 0.67 | 0.67 | +0.00 | 453 | Missing '## Rules' section |
| 1 | `azure-compute` | 0.83 | 0.67 | -0.16 | 470 | Missing '## Rules' section |
| 1 | `azure-cost-optimization` | 0.83 | 0.83 | +0.00 | 478 | Missing '## Rules' section |
| 2 | `azure-defaults` | 0.67 | 0.67 | +0.00 | 449 | Missing '## Rules' section |
| 2 | `azure-deploy` | 1.00 | 1.00 | +0.00 | 550 | — |
| 2 | `azure-diagnostics` | 0.83 | 0.83 | +0.00 | 492 | Missing '## Steps' section |
| 2 | `azure-governance-discovery` | 0.67 | 0.67 | +0.00 | 566 | Missing '## Rules' section |
| 2 | `azure-kusto` | 0.67 | 0.67 | +0.00 | 494 | Missing '## Rules' section |
| 2 | `azure-prepare` | 0.83 | 0.83 | +0.00 | 669 | Missing '## Steps' section |
| 2 | `azure-quotas` | 0.67 | 0.67 | +0.00 | 529 | Missing '## Rules' section |
| 3 | `azure-rbac` | 0.67 | 0.67 | +0.00 | 459 | Missing '## Rules' section |
| 3 | `azure-resources` | 0.83 | 0.83 | +0.00 | 560 | Missing '## Rules' section |
| 3 | `azure-storage` | 0.67 | 0.67 | +0.00 | 695 | Missing '## Rules' section |
| 3 | `azure-validate` | 1.00 | 1.00 | +0.00 | 574 | — |
| 3 | `context-management` | 0.67 | 0.67 | +0.00 | 687 | Missing '## Rules' section |
| 3 | `docs-writer` | 0.83 | 0.83 | +0.00 | 524 | Missing '## Rules' section |
| 3 | `drawio` | 0.67 | 0.67 | +0.00 | 615 | Missing '## Rules' section |
| 4 | `entra-app-registration` | 0.83 | 0.83 | +0.00 | 553 | Missing '## Rules' section |
| 4 | `github-operations` | 0.67 | 0.67 | +0.00 | 435 | Missing '## Rules' section |
| 4 | `golden-principles` | 0.67 | 0.67 | +0.00 | 407 | Missing '## Rules' section |
| 4 | `iac-common` | 0.67 | 0.67 | +0.00 | 456 | Missing '## Rules' section |
| 4 | `mermaid` | 0.67 | 0.67 | +0.00 | 474 | Missing '## Rules' section |
| 4 | `microsoft-docs` | 0.67 | 0.67 | +0.00 | 565 | Missing '## Rules' section |
| 5 | `python-diagrams` | 0.67 | 0.67 | +0.00 | 595 | Missing '## Rules' section |
| 5 | `terraform-patterns` | 0.67 | 0.67 | +0.00 | 474 | Missing '## Rules' section |
| 5 | `terraform-search-import` | 0.83 | 0.83 | +0.00 | 480 | Missing '## Rules' section |
| 5 | `terraform-test` | 0.67 | 0.67 | +0.00 | 395 | Missing '## Rules' section |
| 5 | `vendor-prompting` | 0.67 | 0.67 | +0.00 | 562 | Missing '## Rules' section |
| 5 | `workflow-engine` | 0.67 | 0.67 | +0.00 | 429 | Missing '## Rules' section |

## 6. Appendix — `quality_detail` per skill

Each row is GEPA's six-dimension quality breakdown. `1.0` = signal present, `0.0` = absent. `desc len` is the character count of the YAML `description:` field (validator hard cap: 1024 chars).

| Skill | desc len | description_length | has_when | has_use_for | has_rules | has_steps | no_bad_patterns | score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `azure-adr` | 486 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `azure-artifacts` | 432 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `azure-bicep-patterns` | 451 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `azure-cloud-migrate` | 527 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.00 |
| `azure-compliance` | 453 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `azure-compute` | 470 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `azure-cost-optimization` | 478 | 1.0 | 1.0 | 1.0 | 0.0 | 1.0 | 1.0 | 0.83 |
| `azure-defaults` | 449 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `azure-deploy` | 550 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.00 |
| `azure-diagnostics` | 492 | 1.0 | 1.0 | 1.0 | 1.0 | 0.0 | 1.0 | 0.83 |
| `azure-governance-discovery` | 566 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `azure-kusto` | 494 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `azure-prepare` | 669 | 1.0 | 1.0 | 1.0 | 1.0 | 0.0 | 1.0 | 0.83 |
| `azure-quotas` | 529 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `azure-rbac` | 459 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `azure-resources` | 560 | 1.0 | 1.0 | 1.0 | 0.0 | 1.0 | 1.0 | 0.83 |
| `azure-storage` | 695 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `azure-validate` | 574 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.00 |
| `context-management` | 687 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `docs-writer` | 524 | 1.0 | 1.0 | 1.0 | 0.0 | 1.0 | 1.0 | 0.83 |
| `drawio` | 615 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `entra-app-registration` | 553 | 1.0 | 1.0 | 1.0 | 0.0 | 1.0 | 1.0 | 0.83 |
| `github-operations` | 435 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `golden-principles` | 407 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `iac-common` | 456 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `mermaid` | 474 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `microsoft-docs` | 565 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `python-diagrams` | 595 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `terraform-patterns` | 474 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `terraform-search-import` | 480 | 1.0 | 1.0 | 1.0 | 0.0 | 1.0 | 1.0 | 0.83 |
| `terraform-test` | 395 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `vendor-prompting` | 562 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |
| `workflow-engine` | 429 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 | 0.67 |

## 7. Scorer caveats / false-positive flags

- **Body-section gap is by design.** The plan's "Out of scope: Skill body content rewrites" line means GEPA's `has_rules` / `has_steps` signals will remain `0.0` for most skills until a separate body-rewrite programme is approved. This is **not** a regression vs Stage A.
- **`description_length` ceiling.** GEPA's scorer treats descriptions ≥ ~200 chars as `1.0`; longer descriptions (e.g., `azure-prepare` at 693 chars) and minimum-viable ones both score 1.0. The 1024-char hard cap is enforced separately by `validate:skills`.
- **`no_bad_patterns` regex.** GEPA flags `TODO` / `FIXME` / `XXX` literals in `SKILL.md` body. None are present in the in-scope set; `sensei` (out-of-scope submodule) intentionally documents these literals in its quality checklist and is excluded.
- **`sensei` submodule** is out-of-scope per the plan and is reported separately in §9.
- **`_audits/` and `archived_skills/` directories** are flagged as errored entries by GEPA's `score-all` walker (no `SKILL.md` present). They are correctly excluded from the in-scope count.

## 8. Recommended next actions (user-driven, optional)

Per the plan, this report is **read-only**. The user may issue any of the following triggers:

- **`update post-gepa`** — agent will propose body-section additions for the 28 skills missing `## Rules` and 25 missing `## Steps`. **This expands scope** beyond the original frontmatter-only programme; recommended only if the user explicitly wants to lift the GEPA ceiling above 0.67. Validators (`validate:agents`, `validate:agent-registry`, `validate:skills`, `lint:vendor-prompting`) must continue to pass.
- **`update <skill>`** — targeted update for a specific skill. The 7 skills currently at 0.83 (§4.2) are quick-wins: each needs only one missing body section to reach 1.00.
- **Investigate `azure-compute` regression** (§2). The skill dropped from 0.83 to 0.67 since the Stage A batch-1 audit. Suggested checks:
  - `git log -p .github/skills/azure-compute/SKILL.md` since batch 1 commit
  - confirm whether a `## Rules` or `## Steps` section was removed
- **No-op** — accept current Stage A frontmatter compliance as the deliverable. The 33 in-scope skills now consistently carry skill-type prefixes, `WHEN:` / `USE FOR:` / `DO NOT USE FOR:` literals, valid description lengths, and `INVOKES:` annotations where MCP routing applies.

### 8.1 Quick-wins to reach 1.00 (one body section each)

- `azure-cost-optimization` — add: `## Rules`
- `azure-diagnostics` — add: `## Steps`
- `azure-prepare` — add: `## Steps`
- `azure-resources` — add: `## Rules`
- `docs-writer` — add: `## Rules`
- `entra-app-registration` — add: `## Rules`
- `terraform-search-import` — add: `## Rules`

## 9. Reference — `sensei` (out-of-scope submodule)

GEPA score: **1.00**.

- `description_length` = 1.0
- `has_when` = 1.0
- `has_use_for` = 1.0
- `has_rules` = 1.0
- `has_steps` = 1.0
- `no_bad_patterns` = 1.0

Feedback: Has 'DO NOT USE FOR:' — safe for small skill sets, risky for 10+ skills

`sensei` is consumed read-only via the submodule. The plan explicitly excludes edits to it.

## 10. Reproducibility

- Raw scorer output: [`gepa-audit.json`](./gepa-audit.json) (canonicalized, sorted keys).
- Re-run command: `npm run audit:skills:gepa`
- Source plan: [`plan-skillsAuditOptimize.prompt.md`](../../prompts/plan-skillsAuditOptimize.prompt.md)
- Stage A reports: [`batch-1-audit.md`](./batch-1-audit.md) · [`batch-2-audit.md`](./batch-2-audit.md) · [`batch-3-audit.md`](./batch-3-audit.md) · [`batch-4-audit.md`](./batch-4-audit.md) · [`batch-5-audit.md`](./batch-5-audit.md)
- Tracker: [`TODO.md`](./TODO.md)

---

## Post-update — Round 2 (2026-05-10)

User issued `update post-gepa` for the body-section pass (scope expansion). Five batches of hybrid heading edits applied (rename existing equivalent sections to `## Rules` / `## Steps` where clean; author minimal sections otherwise). All edits committed across 5 per-batch commits. Validators (`validate:skills`, `validate:agents`, `validate:agent-registry`, `lint:vendor-prompting`) pass after every batch.

### Final aggregate

| Metric                       | Stage A (post-update) | Stage B (round 1)  | Stage B Round 2 (final) | Δ vs Stage A |
| ---------------------------- | --------------------- | ------------------ | ----------------------- | ------------ |
| Average GEPA `quality_score` | 0.74                  | 0.74               | **1.00**                | **+0.26**    |
| Skills at score = 1.00       | 3 / 33                | 3 / 33             | **33 / 33** ✓           | **+30**      |
| Skills at score ≥ 0.83       | 11 / 33               | 10 / 33            | **33 / 33** ✓           | **+22**      |
| Skills at score ≥ 0.67       | 33 / 33               | 33 / 33            | **33 / 33** ✓           | 0            |
| Skills below 0.67            | 0 / 33                | 0 / 33             | **0 / 33**              | 0            |

### Per-batch scorecard (Round 2)

| Batch | Skills | Round 1 avg | Round 2 avg | Skills hitting 1.00 |
| ----- | ------ | ----------- | ----------- | ------------------- |
| 1     | 7      | 0.71        | **1.00**    | 7 / 7               |
| 2     | 7      | 0.71        | **1.00**    | 7 / 7               |
| 3     | 7      | 0.71        | **1.00**    | 7 / 7               |
| 4     | 6      | 0.69        | **1.00**    | 6 / 6               |
| 5     | 6      | 0.72        | **1.00**    | 6 / 6               |

### Hybrid heading strategy summary

| Strategy           | Skills | Notes                                                                 |
| ------------------ | ------ | --------------------------------------------------------------------- |
| Rename only        | 8      | Both `## Rules` + `## Steps` came from existing equivalent headings   |
| Rename + Author    | 14     | One section renamed from existing; the other authored                 |
| Author only        | 8      | Both sections authored fresh (no clean equivalent)                    |
| _Already complete_ | 3      | `azure-cloud-migrate`, `azure-deploy`, `azure-validate` (Stage A)     |

Most common rename pairs: `## Best Practices` → `## Rules` (5 skills), `## Workflow` / `## Core Workflow` / `## Quick Diagnosis Flow` → `## Steps` (4 skills), `## Guardrails` → `## Rules` (3 skills), `## Generation Workflow` / `## Assessment Workflow` → `## Steps` (2 skills).

### `azure-compute` regression — closed

Stage B round 1 flagged a regression: commit `d960e5f` (refactor: move workflow to `references/`) had stripped the `### Step N` subheadings from `azure-compute/SKILL.md`, dropping the score from 0.83 → 0.67. Round 2 added a `## Steps` heading above the existing 6-item summary list and authored a `## Rules` section. Score: **1.00 ✓**.

### Outstanding considerations

- **`sensei` submodule** continues to score 1.00 with a non-blocking feedback line about `DO NOT USE FOR:` ergonomics for large skill registries. Out of scope for this programme.
- **Hybrid edits preserved semantic content**: no information was deleted; only headings were renamed (or added) and minimal new rule/step sections were authored alongside existing detailed sections.
- **The 0.67 ceiling is now lifted**: GEPA's six quality dimensions all read `1.0` for every in-scope skill. Future regressions would surface as per-skill `Δ` deltas in the next audit run.

### Reproducibility

- Final raw scorer output: [`gepa-audit.json`](./gepa-audit.json) (canonicalized, sorted keys; round 2)
- Round 2 batch reports: [`batch-1-audit.md`](./batch-1-audit.md) · [`batch-2-audit.md`](./batch-2-audit.md) · [`batch-3-audit.md`](./batch-3-audit.md) · [`batch-4-audit.md`](./batch-4-audit.md) · [`batch-5-audit.md`](./batch-5-audit.md) (each has a "Post-update — Round 2" section)
- Re-run command: `npm run audit:skills:gepa`
- Source plan: [`plan-skillsAuditOptimize.prompt.md`](../../prompts/plan-skillsAuditOptimize.prompt.md)
- Tracker: [`TODO.md`](./TODO.md)
