# Stage 1 — Token-budget baseline

> **Plan**: [`plan-gepa-pipeline.prompt.md`](../../prompts/sensei/plan-gepa-pipeline.prompt.md) — Stage 1
> **Generated**: 2026-05-10T14:50:13.439Z
> **Branch**: `feat/skills-sensei`
> **Scope**: 33 in-scope skills under `.github/skills/`, excluding `sensei/` (submodule) and `archived_skills/`.

## Summary

- **Total tokens (SKILL.md only)**: **60,351** across **33** files
- **Mean tokens per SKILL.md**: **1,829**
- **Soft-limit breaches (> 500 tokens)**: **33 / 33** (every in-scope skill is over the soft limit)
- **Hard-limit breaches (> 5000 tokens)**: **0 / 33** ✓

Round 2 of Plan 1 (body-section pass) added structural headings (`## Rules`, `## Steps`) and tightened
anti-trigger frontmatter across all 33 skills. The net effect on SKILL.md size is documented in the
[Round 2 delta](#round-2-delta-main--head) section below.

## Distribution

| Bucket (tokens) | Count |
| --- | ---: |
| ≤500 | 0 |
| 501-1000 | 2 |
| 1001-2000 | 20 |
| 2001-3000 | 11 |
| >3000 | 0 |

All 33 skills exceed the sensei default 500-token soft limit. The `## Squeeze candidates` table below
ranks them for Stage 2 prioritization.

## Top 10 highest-token SKILL.md

| Rank | Skill | Tokens | Characters | Lines |
| ---: | --- | ---: | ---: | ---: |
| 1 | `drawio` | 2,806 | 11,221 | 184 |
| 2 | `azure-defaults` | 2,591 | 10,363 | 199 |
| 3 | `azure-prepare` | 2,482 | 9,928 | 142 |
| 4 | `entra-app-registration` | 2,431 | 9,722 | 209 |
| 5 | `vendor-prompting` | 2,334 | 9,336 | 156 |
| 6 | `docs-writer` | 2,276 | 9,101 | 174 |
| 7 | `github-operations` | 2,245 | 8,978 | 216 |
| 8 | `iac-common` | 2,215 | 8,859 | 149 |
| 9 | `azure-resources` | 2,204 | 8,815 | 161 |
| 10 | `azure-cost-optimization` | 2,183 | 8,730 | 198 |

## Squeeze candidates (all 33 skills, ranked)

Sorted by token count descending. Stage 2 (`tokens squeeze batch <N>`) targets the top of this list
first. Skills > 2,000 tokens are the highest priority; skills 501–1,000 tokens may be left as-is if
they have minimal repeatable content.

| Rank | Skill | Tokens | Lines | vs `main` |
| ---: | --- | ---: | ---: | ---: |
| 1 | `drawio` | 2,806 | 184 | +90 |
| 2 | `azure-defaults` | 2,591 | 199 | +547 |
| 3 | `azure-prepare` | 2,482 | 142 | -129 |
| 4 | `entra-app-registration` | 2,431 | 209 | +235 |
| 5 | `vendor-prompting` | 2,334 | 156 | +233 |
| 6 | `docs-writer` | 2,276 | 174 | +345 |
| 7 | `github-operations` | 2,245 | 216 | +102 |
| 8 | `iac-common` | 2,215 | 149 | +460 |
| 9 | `azure-resources` | 2,204 | 161 | -1222 |
| 10 | `azure-cost-optimization` | 2,183 | 198 | +261 |
| 11 | `azure-deploy` | 2,034 | 90 | -341 |
| 12 | `context-management` | 1,973 | 173 | +30 |
| 13 | `azure-quotas` | 1,906 | 126 | -787 |
| 14 | `terraform-patterns` | 1,882 | 119 | +302 |
| 15 | `azure-kusto` | 1,835 | 164 | +52 |
| 16 | `azure-governance-discovery` | 1,822 | 141 | +295 |
| 17 | `azure-storage` | 1,817 | 131 | +579 |
| 18 | `workflow-engine` | 1,802 | 129 | +507 |
| 19 | `azure-adr` | 1,795 | 168 | +49 |
| 20 | `python-diagrams` | 1,789 | 144 | +38 |
| 21 | `azure-artifacts` | 1,763 | 159 | +247 |
| 22 | `azure-bicep-patterns` | 1,726 | 106 | +292 |
| 23 | `golden-principles` | 1,707 | 177 | +389 |
| 24 | `azure-compliance` | 1,677 | 122 | +340 |
| 25 | `terraform-search-import` | 1,560 | 123 | +267 |
| 26 | `terraform-test` | 1,519 | 130 | +1 |
| 27 | `mermaid` | 1,422 | 187 | +187 |
| 28 | `azure-compute` | 1,355 | 75 | -1287 |
| 29 | `azure-diagnostics` | 1,323 | 155 | +18 |
| 30 | `microsoft-docs` | 1,206 | 106 | +374 |
| 31 | `azure-validate` | 1,166 | 82 | +78 |
| 32 | `azure-rbac` | 863 | 38 | +448 |
| 33 | `azure-cloud-migrate` | 642 | 52 | +95 |

## Round 2 delta (main → HEAD)

Compared `main` to `HEAD` (commit `615de24`) using `npm run tokens compare main HEAD`. Filtered to
the 33 in-scope `SKILL.md` files; the full repo-wide compare is in
[`tokens-compare-main-head.json`](./tokens-compare-main-head.json).

- **In-scope SKILL.md files modified**: 33 / 33
- **Increased**: 28 (mostly Round 2 body-section additions: `## Rules`, `## Steps`, hybrid heading renames)
- **Decreased**: 5 (Round 1 trims that survived Round 2)
- **Unchanged**: 0
- **Net token delta across 33 SKILL.md files**: **+3,095 tokens**

Per-skill delta table (sorted by absolute delta, descending):

| Skill | Before | After | Δ |
| --- | ---: | ---: | ---: |
| `azure-compute` | 2,642 | 1,355 | -1,287 |
| `azure-resources` | 3,426 | 2,204 | -1,222 |
| `azure-quotas` | 2,693 | 1,906 | -787 |
| `azure-storage` | 1,238 | 1,817 | +579 |
| `azure-defaults` | 2,044 | 2,591 | +547 |
| `workflow-engine` | 1,295 | 1,802 | +507 |
| `iac-common` | 1,755 | 2,215 | +460 |
| `azure-rbac` | 415 | 863 | +448 |
| `golden-principles` | 1,318 | 1,707 | +389 |
| `microsoft-docs` | 832 | 1,206 | +374 |
| `docs-writer` | 1,931 | 2,276 | +345 |
| `azure-deploy` | 2,375 | 2,034 | -341 |
| `azure-compliance` | 1,337 | 1,677 | +340 |
| `terraform-patterns` | 1,580 | 1,882 | +302 |
| `azure-governance-discovery` | 1,527 | 1,822 | +295 |
| `azure-bicep-patterns` | 1,434 | 1,726 | +292 |
| `terraform-search-import` | 1,293 | 1,560 | +267 |
| `azure-cost-optimization` | 1,922 | 2,183 | +261 |
| `azure-artifacts` | 1,516 | 1,763 | +247 |
| `entra-app-registration` | 2,196 | 2,431 | +235 |
| `vendor-prompting` | 2,101 | 2,334 | +233 |
| `mermaid` | 1,235 | 1,422 | +187 |
| `azure-prepare` | 2,611 | 2,482 | -129 |
| `github-operations` | 2,143 | 2,245 | +102 |
| `azure-cloud-migrate` | 547 | 642 | +95 |
| `drawio` | 2,716 | 2,806 | +90 |
| `azure-validate` | 1,088 | 1,166 | +78 |
| `azure-kusto` | 1,783 | 1,835 | +52 |
| `azure-adr` | 1,746 | 1,795 | +49 |
| `python-diagrams` | 1,751 | 1,789 | +38 |
| `context-management` | 1,943 | 1,973 | +30 |
| `azure-diagnostics` | 1,305 | 1,323 | +18 |
| `terraform-test` | 1,518 | 1,519 | +1 |

## Reference-file impact

Round 2 also touched **509** files under `.github/skills/{skill}/references/` (added: 2, modified: 0,
removed: 0). Net token delta across reference files: **+3,343**.

Reference files are out-of-scope for Stage 2 squeezing (only the SKILL.md surface counts toward the
500-token soft limit), but Stage 2 may move bulk content into new reference files, which will
increase this surface.

## Stage 2 entry criteria

Each `tokens squeeze batch <N>` invocation should target one of the alphabetical batches defined in
Plan 2 / `TODO.md`. For each skill in the batch:

1. Run `cd .github/skills/sensei && npm run tokens suggest -- ../{skill}/SKILL.md` to surface relocation candidates.
2. Move bulk content (large tables, decision trees, multi-section workflows, examples) to
   `.github/skills/{skill}/references/{topic}.md` and replace with a one-line pointer in `SKILL.md`.
3. Re-run `tokens count` per skill; aim for **< 500 tokens** unless a `.token-limits.json` override is justified.
4. Run validators (`validate:skills`, `validate:agents`, `lint:vendor-prompting`).
5. Append a per-batch "Stage 2 — Token squeeze (batch N)" section to this file.
6. Commit `feat(skills): Squeeze SKILL.md token budget (batch N, stage 2)`.

## Raw data

- [`tokens-baseline.json`](./tokens-baseline.json) — `tokens count` JSON for all 33 SKILL.md files (canonical-sorted)
- [`tokens-compare-main-head.json`](./tokens-compare-main-head.json) — `tokens compare main HEAD`
  filtered to the in-scope tree
