# Tooling Assessment & Simplification Plan — 2026-05-17

> Read-only analysis of `tools/scripts/`, npm-script aliases, lint
> configs, and CI/lefthook callers. Identifies orphan scripts, alias
> redundancy, and validator-consolidation opportunities. No file
> changes are made by this document — execution is opt-in per the
> priority table (§7) and the hard execution gate (§8).
>
> **Companion to**: [docs/skills-assessment-2026-05-17.md](skills-assessment-2026-05-17.md).
> This doc covers the *tooling layer*; the sibling covers the *skills
> layer*. Different surfaces, same simplification posture.
>
> **Revision history**: 2026-05-17 v1 — autopilot run (plan v4).
> Evidence captured under
> [`tmp/phase1-evidence/`](../tmp/phase1-evidence/) so a reviewer can
> rerun every claim.

## TL;DR

- **Surface**: 74 `.mjs` scripts + 9 top-level Python scripts +
  9 Python files in `markdown-prettifiers/` (= 17 Python total) under
  [`tools/scripts/`](../tools/scripts/); 139 npm scripts in
  [`package.json`](../package.json); 28 lefthook hooks in
  [`lefthook.yml`](../lefthook.yml). Headline counts cited from
  [`tmp/phase1-evidence/count-*.txt`](../tmp/phase1-evidence/).
- **Framing**: *simplification is the win, perf is a bonus*. The
  primary justification for §1–§3 is fewer files, fewer aliases, less
  surface area to maintain. §4 (performance) is treated as a possible
  secondary bonus, not the load-bearing claim.
- **§1 Retire** — 4 orphan candidates confirmed (markdown-prettifiers
  dir + 3 single files). Action: `git rm`.
- **§2 Dedupe aliases** — `validate-artifacts.mjs` has 5 npm aliases
  (2 distinct effects) → reduce to 2. `validate-agents.mjs` has 2
  plain aliases retire-able without losing coverage.
- **§3 Consolidate** — skill validators 2→1 (P2);
  model validators 3→1 (P2). Workflow-graph + IaC-contract validators
  considered and explicitly **kept separate**.
- **§4 Performance** — `validate:_node` runs 45 distinct validators
  via `run-p` (npm-run-all2 v8.0.4, `maxParallel` default = 0 =
  unlimited concurrency, one Node.js process per validator).
  Recommendations stated as **design proposals — implementation
  deferred**.
- **§5 Lint configs** — 5 of 6 configs read end-to-end; no
  contradictions found in those 5. `.markdownlint-cli2.jsonc` at
  209 lines downgraded to "inventory only".
- **§6 CI vs lefthook** — two-pass model is intentional. No action.
- **§7 Priority table** — P1: §1 retires + §2 dedupes. P2: §3
  consolidations. P3: §4 design proposals + `check:h2-order`
  npm-script retirement.
- **§8 Execution trigger** — `chore/retire-orphan-scripts` PR opens
  within **7 days** of this doc's commit date. **Trigger date:
  2026-05-24**. No "exploratory only" escape hatch — the sibling
  `skills-assessment-2026-05-17.md` used that escape hatch and is
  now process theater.

## Inventory

### Scripts under `tools/scripts/`

| Class                                        | Count | Source                                                          |
| -------------------------------------------- | ----: | --------------------------------------------------------------- |
| Node `.mjs` (top-level)                      |    74 | [`count-mjs.txt`](../tmp/phase1-evidence/count-mjs.txt)         |
| Python (top-level)                           |     9 | [`count-py.txt`](../tmp/phase1-evidence/count-py.txt)           |
| Python (incl. `markdown-prettifiers/`)       |    17 | [`python-validators.txt`](../tmp/phase1-evidence/python-validators.txt) |
| npm scripts in `package.json`                |   139 | [`count-npm-scripts.txt`](../tmp/phase1-evidence/count-npm-scripts.txt) |
| lefthook hooks in `lefthook.yml`             |    28 | [`count-lefthook-hooks.txt`](../tmp/phase1-evidence/count-lefthook-hooks.txt) |

### Python validators (in scope, **inventory only**)

The 5 Python validators listed below are treated as **inventory only**
in §3. Full retire/consolidate analysis is deferred to a sibling plan
because Python and Node validators have different invocation patterns
(no shared `_lib/workspace-index.mjs`-style cache).

- [`tools/scripts/validate_orchestrator_handoff.py`](../tools/scripts/validate_orchestrator_handoff.py)
- [`tools/scripts/validate_question_batching.py`](../tools/scripts/validate_question_batching.py)
- [`tools/scripts/validate_review_ceiling.py`](../tools/scripts/validate_review_ceiling.py)
- [`tools/scripts/smoke_verify.py`](../tools/scripts/smoke_verify.py)
- [`tools/scripts/profile_debug_log.py`](../tools/scripts/profile_debug_log.py)

The 9 Python files under
[`tools/scripts/markdown-prettifiers/`](../tools/scripts/markdown-prettifiers/)
are retire candidates — see §1.

### Lint configs

| Config                                                                                       | Lines | Decision rule (Phase 1.7) |
| -------------------------------------------------------------------------------------------- | ----: | ------------------------- |
| [`.markdownlint-cli2.jsonc`](../.markdownlint-cli2.jsonc)                                    |   209 | **Inventory only** (>200) |
| [`eslint.config.mjs`](../eslint.config.mjs)                                                  |    96 | Non-contradiction assertable |
| [`.prettierrc.json`](../.prettierrc.json)                                                    |    26 | Non-contradiction assertable |
| [`.prettierignore`](../.prettierignore)                                                      |    32 | Non-contradiction assertable |
| [`.yamllint.yml`](../.yamllint.yml)                                                          |    37 | Non-contradiction assertable |
| [`commitlint.config.js`](../commitlint.config.js)                                            |    50 | Non-contradiction assertable |

Full reads captured in
[`tmp/phase1-evidence/lint-configs.txt`](../tmp/phase1-evidence/lint-configs.txt)
(468 lines total).

### `validate:_node` umbrella

`validate:_node` runs **45 distinct sub-validators** via
`run-p` ([`validator-names.txt`](../tmp/phase1-evidence/validator-names.txt)).
The runner is `npm-run-all2` **v8.0.4** with default `maxParallel = 0`
(unlimited concurrency, one Node.js process per validator).

Phase 1.1 captured a baseline:
[`baseline-timing.txt`](../tmp/phase1-evidence/baseline-timing.txt).
Three runs at wall-clock ~1.0s / ~1.0s / ~1.25s — but `validate:_node`
itself currently **exits early on `validate:session-state` failure**
(`run-p` aborts the parallel group on first non-zero exit), so the
wall-clock numbers are not full-suite numbers. Treated as an
informational snapshot only; §4 does not depend on these values.

## 1. Retire — orphan scripts

All 4 candidates survived the Phase 1.5 final grep
([`orphan-grep.txt`](../tmp/phase1-evidence/orphan-grep.txt))
under the plan's decision rule (references in `package.json`,
`lefthook.yml`, `*.yml` workflows, or `import`/`require`/`spawn` calls
disqualify; README, CHANGELOG, self-comments, and historical chat logs
do not).

| Target                                                                                   | Type      | Real references (post-rule)                                  | Action                                       |
| ---------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------ | -------------------------------------------- |
| [`tools/scripts/markdown-prettifiers/`](../tools/scripts/markdown-prettifiers/)          | Directory | `.markdownlint-cli2.jsonc#L174` ignore entry + own `README.md` only | `git rm -r` + remove ignore entry            |
| [`tools/scripts/validate-context-budget.mjs`](../tools/scripts/validate-context-budget.mjs) | File      | None (self-docs only)                                        | `git rm`                                     |
| [`tools/scripts/strip-handoff-kind.py`](../tools/scripts/strip-handoff-kind.py)          | File      | None (chat-log mentions only)                                | `git rm`                                     |
| [`tools/scripts/migrate-legacy-findings.mjs`](../tools/scripts/migrate-legacy-findings.mjs) | File      | `CHANGELOG.md#L148` + one comment in [`validate-challenger-findings.mjs#L16`](../tools/scripts/validate-challenger-findings.mjs) | `git rm` + scrub the comment in `validate-challenger-findings.mjs` |

**Paired cleanup** for the `markdown-prettifiers/` retire: also remove
the ignore entry at
[`.markdownlint-cli2.jsonc#L174`](../.markdownlint-cli2.jsonc) that
exempts the directory from markdown linting.

**Considered but rejected**: none. All 4 candidates passed.

## 2. Dedupe npm-script aliases

### 2a. Artifacts: 5 → 2

[`tools/scripts/validate-artifacts.mjs`](../tools/scripts/validate-artifacts.mjs)
accepts only `--fix` (no `--only=` parser). Verified by
[`alias-clusters.txt`](../tmp/phase1-evidence/alias-clusters.txt) +
direct read of `main()`. The 5 current aliases collapse to **2
distinct effects**:

| Current alias               | Effect      | Keep / drop          |
| --------------------------- | ----------- | -------------------- |
| `validate:artifacts`        | no-args run | **Keep (canonical)** |
| `lint:artifact-templates`   | no-args run | Drop (alias of above) |
| `lint:h2-sync`              | no-args run | Drop (alias of above) |
| `fix:artifacts`             | `--fix`     | **Keep (canonical)** |
| `fix:artifact-h2`           | `--fix`     | Drop (alias of above) |

Lefthook hooks `h2-sync` and `artifact-validation` currently route to
`lint:artifact-templates` / `validate:artifacts` — re-point both to
`validate:artifacts`.

### 2b. Agents: retire 2 plain aliases

[`tools/scripts/validate-agents.mjs`](../tools/scripts/validate-agents.mjs)
has a real `--only=` parser
([`alias-clusters.txt`](../tmp/phase1-evidence/alias-clusters.txt)
lines 1674–1759) with distinct sub-parts (`vendor-prompting`,
`workflow-handoffs`). The plain (no-args) aliases all run the full
validation:

| Current alias              | Effect                  | Decision             |
| -------------------------- | ----------------------- | -------------------- |
| `validate:agents`          | no-args full run        | **Keep (canonical)** |
| `lint:agent-frontmatter`   | no-args full run        | Keep (documented role: pre-commit hook) |
| `lint:agent-checks`        | no-args full run        | **Drop** (pure alias of `validate:agents`) |
| `lint:model-alignment`     | no-args full run        | **Drop** (pure alias of `validate:agents`) |
| `lint:vendor-prompting`    | `--only=vendor-prompting` | **Keep** (distinct subset) |
| `lint:workflow-handoffs`   | `--only=workflow-handoffs` | **Keep** (distinct subset) |

`lint:agent-checks` and `lint:model-alignment` add no coverage `validate:agents`
doesn't already run. Drop both.

### 2c. P3: retire public `check:h2-order` npm script

`check:h2-order` is a thin wrapper around `validate-artifacts.mjs`
that adds nothing distinct (artifacts validator already includes H2
order checks). Move to internal-only or `git rm` per §2a hygiene
sweep.

## 3. Consolidate validators

### 3a. Skill validators (P2) — 2 → 1

Merge
[`tools/scripts/validate-skill-checks.mjs`](../tools/scripts/validate-skill-checks.mjs)
(canary markers + size checks) into
[`tools/scripts/validate-skills.mjs`](../tools/scripts/validate-skills.mjs)
as `--only=skill-checks`. The lefthook `skill-references` hook
continues calling `npm run validate:skill-checks` (becomes alias to
the filtered call). **Risk: low** — the two scripts have no shared
state and identical walk semantics; merging removes a duplicate
`fs.readdirSync` traversal of `.github/skills/`.

### 3b. Model validators (P2) — 3 → 1

Merge three model validators into a single
`validate-model.mjs --only=consistency|catalog|deprecation`:

- [`validate-model-consistency.mjs`](../tools/scripts/validate-model-consistency.mjs)
- [`validate-model-catalog.mjs`](../tools/scripts/validate-model-catalog.mjs)
- [`validate-deprecated-models.mjs`](../tools/scripts/validate-deprecated-models.mjs)

All three walk the agents tree independently — Phase 1.6 confirmed
`validate-deprecated-models.mjs` does its own `fs.readdirSync` at
[lines 50, 53, 55, 64](../tmp/phase1-evidence/deprecated-models-walker.txt)
rather than using
[`_lib/workspace-index.mjs`](../tools/scripts/_lib/workspace-index.mjs).

**Risk: medium** — three scripts have distinct error codes and
output formats; merged script must preserve per-part exit semantics
so CI failure attribution stays clean.

### 3c. Considered but rejected

| Cluster                                                  | Why kept separate |
| -------------------------------------------------------- | ----------------- |
| Workflow-graph validators                                | Separate gates (DAG schema vs handoff parity vs table sync). Each gate's failure mode is distinct enough that merging would obscure attribution. |
| IaC contract validators (`validate-iac-*.mjs`)           | Schema-shape checks vs prose checks vs handoff checks — different walk semantics, no shared `_lib/` module. |
| H2 / heading cluster (`check-h2-order.mjs`, `validate-headings-summary.mjs`, `render-headings-summary.mjs`, `validate-artifacts.mjs`) | Already partially consolidated under `validate-artifacts.mjs`. Refactor risk > benefit; `check:h2-order` retirement (§2c) is the only safe trim. |
| `validate-orphaned-content.mjs` vs `validate-glob-audit.mjs` | Different walk semantics (orphan-detection vs glob-coverage). Merging would lose attribution. |

## 4. Performance (secondary)

> **Framing**: the §3 consolidations are justified by simplification
> alone. The performance work below is treated as a possible bonus
> *after* §3 lands, not the reason for §3. Both approaches below are
> labelled **design proposal — implementation deferred**.

### 4a. Root cause

`validate:_node` runs **45 distinct sub-validators** via `run-p`
(`npm-run-all2` v8.0.4). With default `maxParallel = 0` the runner
spawns one Node.js process per validator. The module-level cache in
[`tools/scripts/_lib/workspace-index.mjs`](../tools/scripts/_lib/workspace-index.mjs)
is **per-process**, so every validator that calls it re-walks the
target tree. Phase 1.6 confirmed at least one validator
(`validate-deprecated-models.mjs`) walks its own tree without using
`workspace-index.mjs` at all
([`deprecated-models-walker.txt`](../tmp/phase1-evidence/deprecated-models-walker.txt)).

This is a **code-shape observation**, not a perf complaint. With OS
page cache absorbing the file reads after the first walk, the
observed wall-clock impact may be small.

### 4b. Approach A — single-process mega-validator

One Node entry-point that `require`s all validators as modules and
shares one in-memory `workspace-index` across them. Trade-off:
validators lose independent runnability (you can no longer run just
`validate:agents`). Refactor cost: **medium**.

### 4c. Approach B — shared on-disk cache

Pre-step writes `tools/scripts/_cache/workspace-index.json` (agents +
skills + instructions + parsed frontmatter). Each validator gains a
`--use-cache` mode that loads from the JSON when its mtime ≥ the
newest scanned file. CI `validate:_node` runs a `prevalidate:cache-warm`
step once before `run-p`, then deletes the cache after. Refactor
cost: **small per-validator change, larger pre-step**.

### 4d. Cache invalidation algorithm — **design proposal only**

- mtime check against the newest file across all scanned dirs
  (`.github/agents/`, `.github/skills/`, `.github/instructions/`).
- Atomic write via `fs.writeFileSync(tmp); fs.renameSync(tmp, final)`.
- CI cache invalidated per workflow run unless `actions/cache` is
  wired to a content-addressed key:

  ```text
  hashFiles('.github/agents/**', '.github/skills/**', '.github/instructions/**')
  ```

**Implementation deferred and explicitly optional** — the §3
consolidations are justified without it.

### 4e. Reframe

The load-bearing claim is *"after §3 lands, this perf work becomes
substantially cheaper to do later"* (one shared in-memory index per
process, fewer redundant walks). Not *"do §3 because perf"*.
The Phase 1.1 baseline is published only as a snapshot; any
post-cleanup re-measurement is deferred to the follow-up PR.

## 5. Lint configs — inventory + observations

Non-contradiction asserted **only** for configs that passed the
Phase 1.7 decision rule (full read + ≤200 lines).

| Config                                                  | Non-contradiction asserted? | Observation |
| ------------------------------------------------------- | --------------------------- | ----------- |
| [`.markdownlint-cli2.jsonc`](../.markdownlint-cli2.jsonc) | **No** (209 lines)        | Inventory only. Full read deferred. Note: contains the `markdown-prettifiers/**` ignore entry that pairs with the §1 retire. |
| [`eslint.config.mjs`](../eslint.config.mjs)             | **Yes**                     | Scoped to `tools/scripts/`, `tools/tests/`, `site/`. `site/` ignored deliberately (deferred). |
| [`.prettierrc.json`](../.prettierrc.json)               | **Yes**                     | Format-only rules; no overlap with eslint. |
| [`.prettierignore`](../.prettierignore)                 | **Yes**                     | Ignore list; no rules. |
| [`.yamllint.yml`](../.yamllint.yml)                     | **Yes**                     | YAML-only; doesn't overlap with `lint:json`/`lint:json-schemas`. |
| [`commitlint.config.js`](../commitlint.config.js)       | **Yes**                     | Conventional-commits scoped; pre-commit-only. |

No contradictions found in the 5 configs that qualify.

## 6. CI vs lefthook duplication map

The two-pass model (lefthook on dev workstation + CI on PR) is
**intentional**. Lefthook gives the developer a fast pre-commit
check; CI gives the repo a hard gate that survives `--no-verify` or
fresh-clone contributors who don't run `npm run prepare`.

No action recommended. The single observation worth noting:
`Validate handoff references` (a bash step in CI) duplicates nothing
else and could potentially fold into the Node validator suite, but
that's out of scope for this doc.

## 7. Priority table

| Item                                              | Priority | Effort | Risk   | Section |
| ------------------------------------------------- | -------- | ------ | ------ | ------- |
| Retire 4 orphan candidates + `.markdownlint-cli2.jsonc#L174` ignore entry | **P1** | XS     | Low    | §1      |
| Dedupe artifacts npm aliases (5→2)                | **P1**   | XS     | Low    | §2a     |
| Drop `lint:agent-checks` + `lint:model-alignment` | **P1**   | XS     | Low    | §2b     |
| Merge skill validators (2→1)                      | **P2**   | S      | Low    | §3a     |
| Merge model validators (3→1)                      | **P2**   | M      | Medium | §3b     |
| Retire public `check:h2-order` npm script         | **P3**   | XS     | Low    | §2c     |
| §4 mega-validator / shared-cache (design only)    | **P3**   | M / L  | Medium | §4      |

P1 items together: remove 1 directory, 3 files, 4 npm-script aliases,
1 ignore entry. Net: −1 dir, −12 files-equivalent of surface area.

## 8. Execution trigger

**Hard 7-day gate.** This doc is *input to a follow-up PR*, not the
end state.

- **PR**: `chore/retire-orphan-scripts`
- **Trigger date**: **2026-05-24** (this doc's commit date + 7 days)
- **Escape hatches**: none

If the PR is not open on `main` by 2026-05-24, the next maintainer
touching this file re-opens the autopilot plan
([`tmp/plan-scriptsValidatorsAssessment.prompt.md`](../tmp/plan-scriptsValidatorsAssessment.prompt.md))
to renegotiate scope. The sibling
[`docs/skills-assessment-2026-05-17.md`](skills-assessment-2026-05-17.md)
used an "exploratory only" escape hatch and is now process theater;
this doc does not.

## Sources

Every numeric claim and inventory row in this document is anchored
to a file in [`tmp/phase1-evidence/`](../tmp/phase1-evidence/). A
reviewer can rerun the underlying commands (documented in plan v4 at
[`tmp/plan-scriptsValidatorsAssessment.prompt.md`](../tmp/plan-scriptsValidatorsAssessment.prompt.md))
to regenerate them.

| Evidence file                                                                                          | Anchors |
| ------------------------------------------------------------------------------------------------------ | ------- |
| [`baseline-timing.txt`](../tmp/phase1-evidence/baseline-timing.txt)                                    | §Inventory baseline, §4a |
| [`validator-count.txt`](../tmp/phase1-evidence/validator-count.txt) / [`validator-names.txt`](../tmp/phase1-evidence/validator-names.txt) | §Inventory, §4a |
| [`validate-node-script.txt`](../tmp/phase1-evidence/validate-node-script.txt)                          | §4a (raw `validate:_node` script body) |
| [`run-p-version.txt`](../tmp/phase1-evidence/run-p-version.txt) / [`run-p-parallel-default.txt`](../tmp/phase1-evidence/run-p-parallel-default.txt) | §4a (npm-run-all2 version + maxParallel default) |
| [`alias-clusters.txt`](../tmp/phase1-evidence/alias-clusters.txt)                                      | §2a, §2b (argv handling) |
| [`orphan-grep.txt`](../tmp/phase1-evidence/orphan-grep.txt)                                            | §1 (every orphan-candidate grep) |
| [`deprecated-models-walker.txt`](../tmp/phase1-evidence/deprecated-models-walker.txt)                  | §3b, §4a (self-walk confirmation) |
| [`lint-configs.txt`](../tmp/phase1-evidence/lint-configs.txt)                                          | §5 (full reads, 468 lines) |
| [`python-validators.txt`](../tmp/phase1-evidence/python-validators.txt)                                | §Inventory (Python list) |
| [`count-mjs.txt`](../tmp/phase1-evidence/count-mjs.txt) / [`count-py.txt`](../tmp/phase1-evidence/count-py.txt) / [`count-npm-scripts.txt`](../tmp/phase1-evidence/count-npm-scripts.txt) / [`count-lefthook-hooks.txt`](../tmp/phase1-evidence/count-lefthook-hooks.txt) | §TL;DR, §Inventory |

**Sources of truth referenced** (not re-included here): [`package.json`](../package.json),
[`lefthook.yml`](../lefthook.yml), [`.github/workflows/ci.yml`](../.github/workflows/ci.yml),
[`.github/workflows/weekly-maintenance.yml`](../.github/workflows/weekly-maintenance.yml),
[`.github/workflows/e2e-validation.yml`](../.github/workflows/e2e-validation.yml),
[`tools/scripts/_lib/workspace-index.mjs`](../tools/scripts/_lib/workspace-index.mjs).
