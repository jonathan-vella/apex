# Plan: Token-reduction sweep (Tier 1 + caveman-shrink A/B)

**Scope** — Tier 1 items #1, #2, #4, #5 from the May 15 token-reduction
options list, plus Tier 3 #15 (MCP middleware compression). All work
isolated on a new branch.

## Update log

- **v4 (May 15 — pre-E2E-run pin)**: Project pinned to **`test01`** for
  the upcoming end-to-end APEX run. Material changes vs v3:
  1. **Phase 0 fixture promoted.** The `test01` E2E session log replaces
     the historical `logs/copilot/` two-fixture pick. One full E2E run
     beats two partials for apples-to-apples re-measure at Phase 7.
  2. **Risk-check fixture re-pinned.** Committed Decision #4 now runs
     `apex-recall show test01 --json` instead of `nordic-foods`. The
     `nordic*/` artifact-folder sizes are still captured as historical
     reference points in `tmp/baseline-tokens.json`, but `test01` is the
     decision driver.
  3. **Baseline comparison frame locked to `test/agentic-workflow-validation`
     as-is** (option A from pre-run discussion). The E2E run is captured
     on the current branch (pre-merge to `main`, with AVM gate stack and
     in-flight retrospective fixes present). Phase 7 re-measure runs on
     the same branch lineage; merge-to-main happens _after_ the perf
     work stacks on top. The original v3 prerequisite ("branch off `main`
     after 3 merges land") still applies to the **perf branch cut**, but
     the baseline measurement is taken **now**.
  4. **Pre-E2E instrument check added.** New Phase 0 prerequisite:
     confirm `tmp/agent-debug-log-*.json` and `logs/copilot/*.jsonl`
     are both being written during the run; without both, the
     `11-Context Optimizer` audit at Phase 0 is incomplete.
  5. **Baseline skeleton pre-created.** `tmp/baseline-tokens.json`
     scaffold lives in the repo (gitignored under `tmp/**`) with empty
     keys for per-agent totals, top-10 offenders, redundant-read count,
     `apex_recall_show.test01.tokens`, and the Phase 3 body-budget
     snapshot. Fill-in is mechanical post-run.
  6. **Phase 3 absorbs existing-twin reader-switch (near-free).** New
     sub-item under Phase 3 "Required edits per target agent". Switches
     downstream `.md` reads of `04-governance-constraints` to the
     existing `.json` twin in 05/bicep+terraform validate/whatif/plan
     subagents. Verified: `sku-manifest.{md,json}` and
     `09-lessons-learned.{md,json}` already use `.json` everywhere —
     no work needed. Estimated additional **+5–8%** on top of Phase 3,
     no new schemas, no new templates, fits in the existing
     `validate-compression-discipline.mjs` validator.
- **v3 (May 15 — post-retrospective rebase)**: Plan rebased onto the new
  pre-merge state of `test/agentic-workflow-validation`. Material changes:
  1. **Prerequisite stack expanded.** Plan now branches off `main` after
     **three** pending merges, not one:
     (a) PR #385 (SKILL tier retirement) — user-confirmed
     (b) AVM latest-version gate stack (already on the branch)
     (c) Retrospective fixes from `tmp/plan-nordic-retrospective-fixes.md`
     (in active execution at v3-write time)
  2. **Codegen model migration.** 06b/06t now run **Claude Sonnet 4.6**
     (commit `e073b4d5`); IaC subagents follow. 02-Requirements has a
     GPT-5.5 sibling (`02-Requirements GPT`). Phase 0.5 expanded to
     cover both rule families.
  3. **Phase 3 body-budget constraint.** 05/06b/06t are within ~1 line of
     `MAX_BODY_LINES = 520` ([tools/scripts/\_lib/paths.mjs](tools/scripts/_lib/paths.mjs)).
     Phase 3 MUST trim before it appends, or extract tier-preamble
     content to a shared `references/` file. 08-as-built has ~80 lines
     of headroom — its Path B is already half-done (the "Context budget"
     line exists). See revised Phase 3.
  4. **Phase 2 redundancy retired.** [tools/scripts/validate-glob-audit.mjs](tools/scripts/validate-glob-audit.mjs)
     already implements the wide-`applyTo`-plus-large-body check. Phase 2
     now _extends_ its thresholds rather than introducing a duplicate
     validator.
  5. **Phase 4 re-baselined.** Commit `7a3dafc6 refactor(agents)!: simplify
challenger reviews` already shrank the lens-set surface. Audit becomes
     a smaller verification pass instead of a remediation pass.
  6. **New validators to thread through Phase 6.**
     `validate-avm-module-versions`, `validate-model-consistency`,
     `validate-model-catalog`, `validate-deprecated-models`,
     `validate-iac-handoff`, `validate-governance-trace`,
     `validate-policy-property-map`, `validate-session-state`,
     `lint:workflow-handoffs` — all landed since v2 was drafted.

**Hard prerequisite (revised)**: All three pending merge groups land on
`main` before any phase runs:

1. PR #385 (SKILL tier retirement + CAF defaults + CI hardening) —
   user confirmed.
2. AVM latest-version gate stack (the freeze validator,
   `iac-contract.schema.json` `pin_policy` field, Phase 5 attestation
   wiring in 05-iac-planner). Already on `test/agentic-workflow-validation`
   per commits `a048828`, `7294cdf`.
3. Nordic-retrospective fixes per
   [`tmp/plan-nordic-retrospective-fixes.md`](plan-nordic-retrospective-fixes.md)
   — currently executing. Critical overlap is **its Phase 2 (vendor-prompting
   re-audit of Sonnet-switched agents)** which mostly subsumes this plan's
   Phase 0.5 for Sonnet-side rules. Wait for it.

If any of the three slips, Phase 1 can run as paper-only audit, but
no commits land on the perf branch until all three are merged.

## Branch

`perf/context-token-reduction-tier1` cut from `main` **after the three
prerequisite merges complete**. Original v2 plan said "branch off
`test/agentic-workflow-validation`" — flipped during adversarial review
because PR #385 rewrites every skill description, and flipped _again_ in
v3 because the retrospective + AVM stack edit the same agent bodies
Phase 3 targets.

## Phases

### Phase 0 — Baseline + branch (blocks all later phases)

- Confirm **all three** prerequisite merge groups have landed on `main`;
  rebase / cut branch from latest `main`.
- **Prerequisite checks** (each must exit 0 before proceeding):
  - `apex-recall --help` — the dev container `post-create.sh` installs it,
    but a clean clone without `npm run setup` will not have it.
  - `npm view caveman-shrink version` — confirms the npm package referenced
    in Phase 5 exists. If missing, drop Phase 5 to "design-only" sub-task.
  - `gh pr view 385 --json mergedAt -q .mergedAt` — non-null confirms #385
    has merged.
  - **NEW**: `git log --oneline main -- .github/agents/05-iac-planner.agent.md
| grep -E "(AVM|attestation)"` — non-empty confirms the AVM gate stack
    landed on `main` (look for commits referencing AVM module-version
    freeze, attestation block).
  - **NEW**: `git log --oneline main -- .github/instructions/no-heredoc.instructions.md
.github/instructions/no-interactive-shell.instructions.md
.github/agents/05-iac-planner.agent.md
.github/agents/07b-bicep-deploy.agent.md` — should show the
    retrospective fixes from
    [`tmp/plan-nordic-retrospective-fixes.md`](plan-nordic-retrospective-fixes.md)
    (Fixes 1, 2, 8, 11, 12, 14). If any target file is still unchanged
    on `main`, the retrospective hasn't fully landed yet — wait.
  - **NEW**: Snapshot **current body line counts** for the four Phase 3
    target agents and save to `tmp/phase3-body-budget.json`:
    `wc -l .github/agents/{05-iac-planner,06b-bicep-codegen,06t-terraform-codegen,08-as-built}.agent.md`.
    This is the headroom budget Phase 3 has to work within (cap is
    `MAX_BODY_LINES = 520` per [tools/scripts/\_lib/paths.mjs](../tools/scripts/_lib/paths.mjs)).
  - **NEW (v4)**: Confirm the `test01` E2E run has produced **both**
    log surfaces: at least one `tmp/agent-debug-log-*.json` AND at least
    one `logs/copilot/*.jsonl` newer than the run start time. If either
    is missing, the Phase 0 audit is incomplete — re-run with logging
    confirmed before continuing.
  - **NEW (v4)**: Confirm `apex-recall show test01 --json` returns
    non-empty session state (decisions, findings, artifact paths
    populated). Empty state means the run didn't checkpoint correctly
    and the Phase 3 risk-check (Committed Decision #4) has no data.
- Create branch `perf/context-token-reduction-tier1` from `main`
  **only after the 3 prerequisite merge groups land**. Baseline
  measurement itself runs against the current `test/agentic-workflow-validation`
  state (v4 lock — no need to wait on merges for the _measurement_).
- **Primary session-log fixture (v4)**: the **`test01` E2E run** captured
  on the current branch. Pin its filename(s) in
  `tmp/baseline-tokens.json` under key `fixtures.test01.debug_log_path`
  and `fixtures.test01.copilot_log_path`. This is the **only** fixture
  required for Phase 0 — historical `logs/copilot/` runs are supplementary,
  not required.
- **Spot-check artifact fixtures** in `agent-output/`:
  `nordic/`, `nordic-foods/`, AND the new `test01/` (post-run) all exist
  on the current branch. Capture all three `apex-recall show --json`
  payload sizes in `tmp/baseline-tokens.json` — but **`test01` is the
  decision driver** for the Phase 3 risk-check (Committed Decision #4).
  The `nordic*/` numbers are historical reference points only.
- Invoke `11-Context Optimizer` ([.github/agents/11-context-optimizer.agent.md](../.github/agents/11-context-optimizer.agent.md))
  against the `test01` debug log. Save its ranked-waste report to
  `tmp/baseline-optimizer-test01.md` (gitignored already via `tmp/**`).
  Optional: also run against the largest historical `logs/copilot/`
  fixture for cross-validation, save as `tmp/baseline-optimizer-<run>.md`.
- Capture quantitative baseline: per-agent input-token totals, top-10 file-read
  offenders, redundant-read count, hand-off gap count. Persist to
  `tmp/baseline-tokens.json` (gitignored).
- This baseline is the comparison point for Phases 6 + 7. Do NOT skip.

### Phase 0.5 — Vendor-prompting compatibility check (blocks Phase 1)

Before any description rewrite, verify that the proposed Phase 1 trim
won't fail `npm run lint:vendor-prompting` once the warn-only window
expires.

**Model mix to cover (rebased per v3)**:

The codebase is now a **multi-model mix** after `e073b4d5` (06b/06t →
Sonnet 4.6) and `ccccd6f0` (added 02-Requirements GPT-5.5 sibling).
Description-trim must satisfy **both** rule families:

| Agent / Subagent                                                                                                                          | Vendor rules to satisfy                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `01-orchestrator`, `02-requirements`, `03-architect`, `05-iac-planner`, `08-as-built`, `11-context-optimizer`                             | Claude Opus 4.7 — `anthropic-prompting-best-practices`, `claude-oneshot-001` |
| `06b-bicep-codegen`, `06t-terraform-codegen`, `bicep-validate`, `bicep-whatif`, `terraform-validate`, `terraform-plan`, `policy-precheck` | Claude Sonnet 4.6 — same anthropic family                                    |
| `02-Requirements GPT`, `challenger-review-subagent`                                                                                       | GPT-5.5 — outcome-first / `legacy-003` / `legacy-004`                        |
| `cost-estimate-subagent`                                                                                                                  | GPT-5.3-Codex — GPT family                                                   |

Source of truth for the matrix:
`/memories/repo/subagent-model-routing.md` +
the per-agent `model:` frontmatter.

**Critical overlap with retrospective**: The Nordic retrospective plan's
**Phase 2 Add A** ("vendor-prompting re-audit of Sonnet-switched agents")
runs `lint:vendor-prompting` on every Sonnet-migrated agent and patches
findings. If that work has landed on `main` per the Phase 0 check, the
Sonnet-side of this Phase 0.5 reduces to a re-verification pass. Do NOT
re-do the rule patches.

- Read [.github/skills/vendor-prompting/SKILL.md](../.github/skills/vendor-prompting/SKILL.md) +
  the rules registry it points to (`rules.json` under `references/`).
  (Note: vendor-prompting was hardened in `ccccd6f0` — re-read fresh,
  don't trust v2's assumptions about rule shape.)
- Confirm whether any rule constrains `description:` field shape across
  any of the four rule sets above (e.g., GPT-5.5 outcome-first preamble,
  Claude XML wrapper).
- If a rule applies:
  - Run a dry-run trim on **3 representative skill descriptions and 2
    agent descriptions** (one from each major model family — at least
    one Claude-side and one GPT-side) and re-run
    `npm run lint:vendor-prompting` locally.
  - If lint fails: either narrow Phase 1 scope (e.g. trim only the
    "WHEN/USE FOR" prose, preserve preamble) **or** propose a
    vendor-prompting rule amendment in a separate PR first.
- Document the decision per model family in `tmp/phase-0.5-vendor-prompting-check.md`.
- This is the gate-keeper that prevents the warn→error promotion
  (Committed Decision #2) from breaking CI at week 3.

### Phase 1 — Description tightening (Tier 1 #4) _(parallel with Phase 2)_

- Audit all `description:` frontmatter strings under `.github/agents/**/*.agent.md`
  and `.github/skills/**/SKILL.md`. **Important caveat (v3)**: PR #385
  already rewrote every skill description to drop the `**TIER** —` prefix.
  So pre-trim baselines from before #385 overstate the available shrink
  budget. Re-measure post-#385 before locking targets.
- **Recount target counts at execution time** (do NOT trust v2's "~30 skills"
  estimate). Several skills were consolidated/archived in `150a5951`
  (e.g. context + resource skills). Run
  `find .github/skills -name SKILL.md -type f | wc -l` and
  `find .github/agents -name "*.agent.md" -type f -not -path "*/_subagents/*" | wc -l`
  to set the cost-model denominator.
- **New agent to include**: `.github/agents/02-requirements-gpt.agent.md`
  (added in `ccccd6f0`). Both Requirements agents (Opus + GPT) get the
  description-trim treatment; their routing keywords should remain
  aligned so the picker can swap freely.
- Add a new upper-bound check to [tools/scripts/validate-skills.mjs](../tools/scripts/validate-skills.mjs)
  (currently only flags `< 10` char descriptions). Proposed limits:
  - **Skills**: ≤350 chars (target ~250). Skill descriptions post-#385 are
    closer to ~400–500 chars (down from ~600) — re-measure before fixing
    the target.
  - **Agents**: ≤300 chars (target ~200). Primary agents in
    `.github/agents/*.agent.md`.
  - **Subagents**: ≤250 chars (warn-only per Committed Decision #1; subagent
    descriptions are contract-bound and not rewritten by this PR).
- Add the same upper-bound check to [tools/scripts/validate-agents.mjs](../tools/scripts/validate-agents.mjs)
  (extend Part 1 frontmatter section).
- Mirror the existing `KNOWN_OVERSIZED` exception pattern from
  [tools/scripts/validate-skills.mjs](../tools/scripts/validate-skills.mjs)
  line 45 (current set: `azure-adr`, `github-operations`, `make-skill-template`).
  Default empty for the new agent-side check.
- Rewrite over-budget descriptions for **skills + primary agents only**
  (Committed Decision #1). Routing accuracy comes from keyword overlap, not
  prose length — preserve trigger phrases.
- **Cost model** (revised v3): post-#385 the per-skill shrink budget is
  smaller (PR #385 already extracted the tier-prefix savings). Realistic
  re-estimate: ~150 chars saved per over-budget description × ~20 actually
  over-budget skills × 0.25 tokens/char ≈ **~750 tokens saved per turn**
  (the catalog auto-loads every turn). Lower than v2's 2.6K estimate —
  publish the actual delta from Phase 7 re-measure, don't argue the model.

### Phase 2 — `applyTo` scope audit (Tier 1 #5) _(parallel with Phase 1)_

**Critical sequencing (v3)**: This phase edits
`no-heredoc.instructions.md`, `no-interactive-shell.instructions.md`,
and `azure-artifacts.instructions.md`. The Nordic retrospective plan's
**Fixes 10, 11, 12, 14** _also_ edit these three files (adding new
forbidden patterns + the `az` output-budget cookbook). Phase 2 must run
**after** those retrospective fixes land on `main` — Phase 0's check
verifies this. Then Phase 2 is "trim the now-larger body", not "edit a
stable body".

**Validator redundancy retired (v3)**: v2 proposed a new
"wide-`applyTo` + body-line" check. That overlaps with the existing
[tools/scripts/validate-glob-audit.mjs](../tools/scripts/validate-glob-audit.mjs)
(`lint:glob-audit`), which already flags:

- `applyTo: "**"` at any size,
- `applyTo: "**/*.md"`-family with body >200 lines,
- `applyTo: "**"` with body >`MAX_LINES_WITH_WILDCARD` (50).

Phase 2 now **extends `lint:glob-audit`** with a third rule rather than
introducing a duplicate validator:

- Add `MAX_LINES_FOR_HIGH_FREQUENCY_GLOB = 100` (new constant in
  [tools/scripts/\_lib/paths.mjs](../tools/scripts/_lib/paths.mjs)).
- New rule: if `applyTo` contains a **multi-extension brace expansion**
  (e.g. `**/*.{md,mdx}`, `**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}`)
  AND body >100 lines, warn.
- This covers the three Phase 2 worst-offender shapes that the current
  rule set does _not_ catch.

Audit every `applyTo:` line under `.github/instructions/*.instructions.md`.
Inventory below; sort by load-multiplier.

Worst offenders to address:

1. [.github/instructions/markdown.instructions.md](../.github/instructions/markdown.instructions.md):
   17 globs incl. `agent-output/**/*.md`, `infra/**/*.md`,
   `tools/mcp-servers/**/*.md`, plus root files. Body is ~85 lines.
   **Fix**: split into two files with an **explicit destination map** —
   a one-time mapping doc in the PR description records where every
   section lands:
   - `docs.instructions.md` ← site/docs scope (`site/src/content/docs/**`,
     root docs `AGENTS.md`/`README.md`/`CHANGELOG.md` etc.). Keeps:
     full 120-char rule, voice + tone, diagram-embed routing, MDX-specific
     guidance.
   - `azure-artifacts.instructions.md` ← `agent-output/**/*.md` scope
     only. Keeps: template-first approach reminder, link to
     `azure-artifacts.instructions.md` for H2 invariants, patterns-to-avoid
     (trimmed). Drops anything that doesn't change artifact behavior.
   - Verify the H2-structure rules referenced
     (`.github/instructions/azure-artifacts.instructions.md` is the actual
     cover) are sufficient for artifacts; if a section in the original
     markdown.instructions.md lacks a home in either target, **stop and
     reassess** rather than dropping it silently.
   - Add the new file paths to [tools/registry/count-manifest.json](../tools/registry/count-manifest.json)
     (`counts.instructions` is `computed_from`, so auto-derives — but
     run `npm run validate:no-hardcoded-counts` after to confirm).
2. [.github/instructions/code-quality.instructions.md](../.github/instructions/code-quality.instructions.md):
   5 directories × 11 extensions. **Fix**: scope to
   `.github/**` + `tools/**` only; remove `site/**/*.{ts,mjs,js}` (covered
   by `astro.instructions.md` + `javascript.instructions.md`).
3. [.github/instructions/no-heredoc.instructions.md](../.github/instructions/no-heredoc.instructions.md):
   `**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}` — fires on basically
   every source file edit. **Fix**: keep the glob; shrink the body. The
   rule is one paragraph wrapped in examples — move examples to
   `references/heredoc-examples.md` and trim body to ≤40 lines.
   **Sequencing**: do this AFTER retrospective Fix 12 (heredoc + `node -e`
   anti-pattern) lands so the body to shrink includes the new content.
4. [.github/instructions/agent-authoring.instructions.md](../.github/instructions/agent-authoring.instructions.md)
   - [.github/instructions/vendor-prompting.instructions.md](../.github/instructions/vendor-prompting.instructions.md):
     Both `**/*.agent.md, **/*.prompt.md` — they stack on every agent edit.
     **Fix**: keep both, but verify neither exceeds 150 lines per
     [.github/instructions/context-optimization.instructions.md](../.github/instructions/context-optimization.instructions.md)
     (anchor: "150-line budget"). Split bodies into `references/` if over.
     (Note: `vendor-prompting.instructions.md` was hardened in `ccccd6f0`
     — re-measure its body length before deciding split-vs-keep.)

**Cost model**: trimming markdown.instructions.md alone saves ~85 lines ×
~12 tokens/line ≈ **1K tokens per match**, and it matches on every
`agent-output/**/*.md` artifact edit (the entire Step 1–7 hot path).

### Phase 3 — Force artifact compression in late-stage agents (Tier 1 #1)

This is the highest-leverage change. The infrastructure already exists
([.github/skills/context-management/SKILL.md](../.github/skills/context-management/SKILL.md)
Mode A — `full`/`summarized`/`minimal` tiers, hard checkpoints per model)
but enforcement is soft.

**Body-cap blocker (v3 — must address before Phase 3 starts)**:

The four target agents' current total line counts (as of v3 write):

| Agent                                                                                             | Total lines | Body lines (est.) | Headroom vs cap (520) |
| ------------------------------------------------------------------------------------------------- | ----------- | ----------------- | --------------------- |
| [.github/agents/05-iac-planner.agent.md](../.github/agents/05-iac-planner.agent.md)               | ~577        | ~519              | **~1 line**           |
| [.github/agents/06b-bicep-codegen.agent.md](../.github/agents/06b-bicep-codegen.agent.md)         | ~570        | ~515              | **~5 lines**          |
| [.github/agents/06t-terraform-codegen.agent.md](../.github/agents/06t-terraform-codegen.agent.md) | ~567        | ~512              | **~8 lines**          |
| [.github/agents/08-as-built.agent.md](../.github/agents/08-as-built.agent.md)                     | ~439        | ~385              | **~135 lines**        |

Phase 3 originally proposed adding a **tier-selection preamble**
(~20–30 lines) + a **hard-checkpoint cross-reference** per agent.
That fits in 08-as-built but **does NOT fit** in 05/06b/06t. New rule:

- **For 05, 06b, 06t**: the tier preamble lives in a **new shared
  references file** — e.g.
  `.github/skills/context-management/references/agent-boot-preamble.md`
  — which the target agent body cites in **one line** (e.g.
  "Boot order: follow `agent-boot-preamble.md` then proceed below.").
  Net body-line delta: +1 to +3 lines per agent.
- **For 08-as-built**: in-body preamble is fine. Path B (see below)
  is already half-done for this agent — the line
  `**Context budget**: Read \`06-deployment-summary.md\` +
  \`01-requirements.md\` at startup` exists at ~line 222. The only
  remaining work is the "should → MUST" wording change in Phase 1.5.
- The body lines for the rewrite must be re-measured by Phase 0's
  `tmp/phase3-body-budget.json` snapshot. If any target's body is
  already at 520, **trim first** (find dead prose) before adding.
  Document the trim in the PR body.

**Model-checkpoint coverage (v3 update)**:

The hard-checkpoint table referenced in
[.github/skills/context-management/SKILL.md](../.github/skills/context-management/SKILL.md)
must contain rows for **all three** active models, not just two:

- Claude Opus 4.7 — 200K context, hard checkpoint ~160K
- Claude Sonnet 4.6 — 200K context, hard checkpoint ~160K (revised
  from v2's "150K" assumption; verify against
  `/memories/repo/model-catalog.md`
  at execution time)
- GPT-5.5 — 400K context, hard checkpoint ~320K

If any row is missing, add it in Phase 3 as a **dependent edit** to the
context-management skill (still under `MAX_SKILL_LINES_WITHOUT_REFS = 200`;
current body is 182 lines — only 18 lines of headroom). If adding rows
overflows, move the table to `references/hard-checkpoints.md` and cite.

**Already-done check**: commit `19498a80 feat(agents,skills,tools):
simplify APEX Steps 4-6 workflow for all workloads` reworked the
boot-read order in 05/06b/06t. Before doing the rewrite in Phase 3,
`git log --oneline -p .github/agents/05-iac-planner.agent.md
.github/agents/06b-bicep-codegen.agent.md
.github/agents/06t-terraform-codegen.agent.md | grep -A20 "Read"` —
if the bullet already says "Use `apex-recall show` for inventory" (or
equivalent), drop sub-task #2 below and confirm sub-task #1 is the
only delta.

**Branching by Phase 0 risk-check (Committed Decision #4)**:

- **Path A (small projects, `apex-recall show --json` < 5K tokens)** —
  full Phase 3 as specified below.
- **Path B (≥ 5K)** — file a follow-up for `apex-recall show --summary`,
  ship a **scaled-down Phase 3**: keep the current per-agent
  "Read prior artifacts" boot order, but promote the existing Phase 1.5
  compaction in 08-as-built from "should" to **MUST**, and ship the
  compression-discipline validator. Expected savings drop from
  ~30–50% to ~15–25% on Steps 5–7 — admit this in the PR body.

**Phase 3 also must not bypass the skill's own tier framework.** The
runtime tier is **conditional on measured context usage** per
context-management Mode A (`<60%` → full, `60–80%` → summarized,
`>80%` → minimal). Phase 3 edits MUST express compaction in the tier
vocabulary, not as an unconditional "always compact" rule.

- Target agents (in dependency order):
  - [.github/agents/05-iac-planner.agent.md](../.github/agents/05-iac-planner.agent.md) —
    loads Steps 1, 2, 3.5 — Sonnet/Opus mix per current frontmatter
  - [.github/agents/06b-bicep-codegen.agent.md](../.github/agents/06b-bicep-codegen.agent.md) —
    loads Steps 1–4 — **Claude Sonnet 4.6** (since `e073b4d5`)
  - [.github/agents/06t-terraform-codegen.agent.md](../.github/agents/06t-terraform-codegen.agent.md) —
    loads Steps 1–4 — **Claude Sonnet 4.6** (since `e073b4d5`)
  - [.github/agents/08-as-built.agent.md](../.github/agents/08-as-built.agent.md) —
    loads Steps 1–6 (worst offender; already has Phase 1.5 compaction
    documented but described as "soft" — see anchor "Context budget" at
    ~line 222 and "Context usage reaches ~80%" near the Phase 1.5 H3)
  - Note on exclusions: `03-architect.agent.md` is excluded because it
    only loads Step 1 (bounded). `04g-governance.agent.md` is excluded
    because its load surface is bounded by Azure Policy payload size and
    its review already runs in a subagent (separate context window).
- Required edits per target agent (Path A only — see Path B above):
  1. **Add a tier-selection preamble at boot.** For 05/06b/06t, this
     lives in `.github/skills/context-management/references/agent-boot-preamble.md`
     (citation only in the agent body). For 08-as-built, lives in-body.
     Content:
     - Call `apex-recall show <project> --json` first. Treat its output
       as canonical inventory.
     - Estimate current context usage; pick `full` / `summarized` /
       `minimal` per Mode A rules.
     - Read full artifact bodies **only** at `full` tier; at `summarized`
       use `apex-recall show` + section headings; at `minimal` use
       checkpoint deltas only.
  2. **Reword artifact-load bullets** (anchor: the "Read ALL prior
     artifacts" / "Read all prior artifacts (01-06)" lines in
     08-as-built; equivalent boot-load lines in 05/06b/06t). **Verify
     first** that `19498a80` hasn't already reworded these — if it has,
     skip this sub-task. Otherwise new wording: "Use `apex-recall show`
     for inventory + decisions; load full artifacts only when generating
     a section that directly mirrors them; release older bodies before
     loading newer ones."
  3. **Make Phase 1.5 compaction a MUST** in 08-as-built. Tie it to
     `apex-recall checkpoint <project> 7 phase_1.5_compacted` as a
     precondition for entering Phase 2. (In Path B this rule applies
     unconditionally; in Path A it's the tier preamble that drives it.)
     Note: 08-as-built already documents `phase_1.5_compacted` as a
     sub-step checkpoint in its frontmatter — the change is wording, not
     mechanism.
  4. **Reference the hard-checkpoint protocol** from the
     context-management skill (anchor: "Hard Token Checkpoints
     (model-specific)" H2) in each target agent's body. Currently only
     07t references it explicitly. For 05/06b/06t this is one citation
     line in the references file, not in the agent body.
  5. **Existing-twin reader-switch (v4 addition — near-free)**.
     Three artifacts in `agent-output/{project}/` already have JSON
     twins; downstream agents currently mix `.md`/`.json` reads or
     read only the `.md`. Verified scope on `test/agentic-workflow-validation`:

     | Twin                                  | Current state                                                                                         | Action                                                          |
     | ------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
     | `sku-manifest.{md,json}`              | All readers already use `.json` (06b/06t codegen, 07t deploy, 08 as-built, `cost-estimate-subagent`). | **No work**. Confirm via grep at execution time.                |
     | `09-lessons-learned.{md,json}`        | Only producers (`01-orchestrator`, `e2e-orchestrator`) reference; no downstream `.md` reads.          | **No work**. Confirm via grep at execution time.                |
     | `04-governance-constraints.{md,json}` | Mixed: `.json` is read by some, `.md` is still read by 05/bicep subagents.                            | **Switch downstream `.md` reads to `.json`** (see table below). |

     **Verified `.md` read sites to switch** (anchor lines from
     post-`test/agentic-workflow-validation` grep — re-verify at edit
     time because Nordic retrospective fixes may shift line numbers):

     | Agent / Subagent                                                                                                                     | Read sites                                                                        |
     | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
     | [.github/agents/05-iac-planner.agent.md](../.github/agents/05-iac-planner.agent.md)                                                  | ~3 sites: prerequisite/boot-read block at lines ~129, ~148, ~188                  |
     | [.github/agents/\_subagents/bicep-validate-subagent.agent.md](../.github/agents/_subagents/bicep-validate-subagent.agent.md)         | ~3 sites: lines ~52, ~151, ~257                                                   |
     | [.github/agents/\_subagents/bicep-whatif-subagent.agent.md](../.github/agents/_subagents/bicep-whatif-subagent.agent.md)             | 1 site: line ~46                                                                  |
     | [.github/agents/\_subagents/terraform-validate-subagent.agent.md](../.github/agents/_subagents/terraform-validate-subagent.agent.md) | TBD — `grep -nE "04-governance-constraints\\.md"` to confirm parallel reads exist |
     | [.github/agents/\_subagents/terraform-plan-subagent.agent.md](../.github/agents/_subagents/terraform-plan-subagent.agent.md)         | TBD — same grep                                                                   |

     **Out of scope for the switch** (keep `.md` reads):
     - `04g-Governance` itself — it's the producer of both twins.
     - `08-as-built` (line ~205) — its as-built doc legitimately
       embeds narrative governance findings, not just machine-readable
       constraints.

     **Why this is near-free**:
     - All edits are word substitutions (`.md` → `.json`, or
       `.md/.json` → `.json`). Net body-line delta: ~0 per agent.
       Fits trivially in the body-cap blocker.
     - No new schemas, no new templates, no new validators.
     - The existing Phase 3 `validate-compression-discipline.mjs`
       gets ONE extra allowlist rule (sub-bullet under "New validator"
       below): target agents must reference
       `04-governance-constraints.json` in any "Read" clause, not
       `.md`. Soft-warn level per Committed Decision #2.

     **Cost-model contribution**: governance constraints in `.md` render
     to ~5–8K tokens (policy table per Deny rule is verbose). The `.json`
     equivalent is ~1.5–3K. Per read saves ~3–5K tokens. Across the 7+
     verified `.md` read sites in Bicep + Terraform IaC tracks, with
     Step 4–6 invocation count of ~2–3× per workflow → **~30–50K tokens
     saved per E2E run**. Estimated **+5–8% on top of Phase 3** —
     honest range, NOT the "+10%" hand-wave from the original
     suggestion. Publish the measured delta in the PR body.

     **Verification step (Phase 0 add-on)**: before locking the v4
     sku-manifest / lessons-learned "no work" claim, run:
     `grep -rnE "sku-manifest\\.md|09-lessons-learned\\.md" .github/agents/`.
     If any `Read` / `loads` clause references the `.md` (vs producer
     references like "render" or "writes"), expand this sub-section.

- New validator `tools/scripts/validate-compression-discipline.mjs`:
  - Operates on a **closed allowlist** — exactly the four target agents
    above. Does not iterate the rest of `.github/agents/`. This keeps
    the validator from misfiring on agents that legitimately don't load
    predecessor artifacts.
  - **Soft semantic check** (warn-level per Committed Decision #2):
    asserts the agent body OR its cited boot-preamble reference file
    contains all three anchors — `apex-recall show`, `context-management`
    skill reference, and at least one of `summarized` / `minimal`.
    Acknowledged limitation: this is a pattern-match, not a behavioral
    guarantee. Treat as a smoke-test, not a correctness check.
  - **Twin-switch allowlist rule (v4 addition)**: for each agent in the
    closed allowlist (plus the IaC-track subagents listed in sub-item 5
    above), assert no `Read` / `loads` / `Read \``-prefixed clause in the
agent body references `04-governance-constraints.md`. The `.json`twin must be cited instead.`08-as-built`is exempted (legitimate
narrative consumer);`04g-Governance` is exempted (producer).
    Warn-level per Committed Decision #2.
  - Wire into `validate:_node` script chain in
    [package.json](../package.json) (anchor: the `validate:_node` script
    key, which already chains the other `validate-*.mjs` scripts).
- **Apex-recall surface check** — ensure
  [tools/apex-recall/docs/show-schema.md](../tools/apex-recall/docs/show-schema.md)
  documents every field the rewritten agents will pull (decisions, findings,
  artifact_paths, sub_step). If a field is missing, file a follow-up; do not
  block the plan on it (out of scope for this PR).
- **Cost model**:
  - Path A: late-stage agents accumulate 50–100K tokens from prior-artifact
    reloads. Replacing with `apex-recall show` summaries (typically <3K) is
    **the dominant lever** — expected **30–50% reduction** on Steps 5–7
    sessions.
  - Path B: expected **15–25% reduction** (the per-agent Phase 1.5
    promotion alone). The validator still ships; the boot-order rewrite
    is deferred until the `--summary` flag exists.
  - **Twin-switch contribution (v4)**: additional **~5–8% reduction**
    on top of either path, from switching ~7+ governance-constraints
    `.md` read sites to `.json`. Roughly 30–50K tokens saved per E2E run
    on Steps 4–6 (Bicep + Terraform IaC tracks). Stacks additively with
    Path A/B because it targets a _different_ read surface (subagent
    reads vs. parent-agent prior-artifact reads).

### Phase 4 — Subagent thoroughness defaults + challenger-lens hygiene (Tier 1 #2)

**v3 re-baseline**: commit `7a3dafc6 refactor(agents)!: simplify
challenger reviews` shipped before v3. It collapsed the multi-pass
default to single-pass `comprehensive` and removed several lens variants.
That work is **mostly what this phase intended to deliver**. Phase 4
becomes a **verification + soft-lint** pass rather than a remediation
pass:

- Re-read [.github/agents/\_subagents/challenger-review-subagent.agent.md](../.github/agents/_subagents/challenger-review-subagent.agent.md)
  fresh. Identify which (if any) parent agents still send oversized
  `batch_lenses` arrays in their handoff prompts. If none, Phase 4's
  challenger-lens work is "publish a finding: already done in `7a3dafc6`".
- The Explore-thoroughness soft lint (forward-looking guidance) is
  unchanged from v2.

**Scope correction** (carried from v2 adversarial review): grep of
`.github/agents/**` shows **no current agent file invokes `Explore` from
inside its body** — Explore is called by the user-facing chat / plan agent,
not by step agents. So this phase produces no immediate per-turn savings;
it is **forward-looking guidance + a soft lint** that pays off when
agent authors start citing Explore explicitly.

- **Challenger-lens minimization (verification pass)**:
  - Audit `challenger-review-subagent` invocations in current
    `.github/agents/**/*.agent.md` (use `grep -nE "batch_lenses|review_depth"`).
  - Confirm parent agents send the **minimum lens set** required for the
    step per
    [.github/skills/azure-defaults/references/adversarial-review-protocol.md](../.github/skills/azure-defaults/references/adversarial-review-protocol.md)
    (or the equivalent reference under `azure-defaults/references/`).
  - Verify `decisions.review_depth == "default"` is honored — no agent
    silently runs deep batches.
  - If the audit is clean (per `7a3dafc6`), the PR body says so. Don't
    invent regressions.
- **Explore thoroughness guidance (forward-looking)**:
  - Document the taxonomy in
    [.github/copilot-instructions.md](../.github/copilot-instructions.md)
    (anchor: "Explore Subagent Thoroughness" H3, currently in
    the `## Chat Triggers` section).
  - Set default rule for agent authors:
    - Single-file lookup, config check → `quick`
    - Multi-file comparison, pattern search → `medium`
    - Audit, full dependency walk → `thorough`
  - Add a soft lint (warn-level per Committed Decision #2) to
    [tools/scripts/validate-agents.mjs](../tools/scripts/validate-agents.mjs):
    flag any agent body that contains the literal token `Explore`
    without an adjacent `thoroughness`/`quick`/`medium`/`thorough` token
    in the same paragraph.
- **Cost model** (v3 revised):
  - Challenger lens audit: **likely 0 immediate savings** — the
    simplification already shipped. If the audit finds residual oversize
    `batch_lenses` arrays, those drops are the only savings. Publish the
    measured number (zero is fine).
  - Explore-thoroughness lint: **0 immediate savings**, gains realize as
    new agent files adopt the convention. Documented honestly so the PR
    body doesn't overclaim.

### Phase 5 — caveman-shrink MCP middleware A/B on azure-pricing (Tier 3 #15)

**v3 baseline-shift note**: commit `47adc669 feat(skills+mcp): skills
audit programme + azure-pricing disk cache` added a disk cache to the
azure-pricing MCP. The pre-shrink baseline measured in Phase 0 already
reflects that cache, so caveman-shrink's measured delta will be on top
of cache savings — likely smaller absolute than if the cache wasn't
there. The accept threshold (≥30% reduction) still applies, but against
the **post-cache** baseline, not the original-original. State this in
the PR body so future readers know the comparison frame.

**Why azure-pricing as the A/B target**:

- We own the source ([tools/mcp-servers/azure-pricing/](../tools/mcp-servers/azure-pricing/))
- We have a benchmark harness (`bench:azure-pricing` script + pytest
  `test:azure-pricing-mcp`)
- Wrong tool selection on pricing is non-critical (fallbacks exist in the
  `cost-estimate-subagent` flow)
- The drawio MCP at [tools/mcp-servers/drawio/](../tools/mcp-servers/drawio/)
  is a vendored fork and explicitly excluded from markdownlint
  ([.markdownlint-cli2.jsonc](../.markdownlint-cli2.jsonc); anchor: the
  `drawio` exclude entry near the file's `ignores` block) —
  modifying it is out of scope

**Prerequisite (Phase 0 verified)**: `npm view caveman-shrink version`
returned a real version. If Phase 0 found no such package, this whole
phase becomes "design-only" — produce a `tmp/phase5-caveman-shrink-design.md`
sketch and stop. Do NOT invent a substitute middleware in the same PR.

Implementation steps:

1. Add caveman-shrink as a dev-only dependency (npm package). Do NOT add to
   the canonical MCP launch config in `.vscode/mcp.json` or
   `tools/mcp-servers/azure-pricing/.../mcp.json` — keep it behind a feature
   flag `CAVEMAN_SHRINK=1`.
2. Create a thin wrapper script `tools/scripts/run-azure-pricing-with-shrink.mjs`
   that proxies the python-launched azure-pricing MCP through caveman-shrink.
3. Capture **baseline** tool-description sizes: run
   `cd tools/mcp-servers/azure-pricing && python3 tests/fixtures/compact_bench.py`
   and save token-counted output of all `description=` strings in
   `tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/**/tools.py` to
   `tmp/azure-pricing-baseline.json`.
4. Capture **shrink** sizes: run the same bench through the wrapper, save
   to `tmp/azure-pricing-shrink.json`.
5. Run a **tool-selection accuracy A/B**: drive `cost-estimate-subagent`
   against a fixed set of cost-estimate prompts (use the `test01` E2E
   fixture captured at Phase 0 as the prompt source; supplement with
   any historical `agent-output/nordic*/` prompts if more variety is
   needed) once with baseline, once with shrink. Compare the
   chosen tools per prompt. Pass criterion: ≥95% identical tool selections
   (Committed Decision #3).
6. **Decision gate** (Committed Decision #3):
   - Token reduction ≥30% AND accuracy ≥95% → keep the wrapper behind
     the `CAVEMAN_SHRINK=1` flag, document in
     `tools/mcp-servers/azure-pricing/README.md`.
   - Else → revert. Caveman-shrink dependency removed, wrapper deleted.
   - **Publish both numbers in the PR body regardless of outcome.**
7. **Do not enable globally**. The flag stays opt-in until measured on at
   least 2 more end-to-end sessions in a follow-up PR.

### Phase 6 — Run `validate:all` (gate)

Single command: `npm run validate:all`. Must be green before Phase 7.

Critical sub-validators that this work touches (v3 — table refreshed
against current package.json):

| Validator                      | Phase that may break it               |
| ------------------------------ | ------------------------------------- |
| `validate:agents`              | Phase 1, 3, 4 (frontmatter + body)    |
| `validate:skills`              | Phase 1 (description size)            |
| `lint:vendor-prompting`        | Phase 1, 3 (description-as-prompt)    |
| `lint:glob-audit`              | Phase 2 (extends this validator)      |
| `lint:workflow-handoffs`       | Phase 3 (boot-order rewrites)         |
| `validate:no-hardcoded-counts` | Phase 2 (instruction count change)    |
| `validate:model-consistency`   | Phase 1, 3 (any model: edits)         |
| `validate:model-catalog`       | Phase 1, 3 (referenced models)        |
| `validate:deprecated-models`   | Phase 1, 3 (referenced models)        |
| `validate:session-state`       | Phase 3 (apex-recall checkpoint refs) |
| `lint:md`                      | Phase 2 (markdown.instructions split) |
| `validate:instruction-checks`  | Phase 2 (applyTo splits)              |
| `test:azure-pricing-mcp`       | Phase 5 (MCP wrapper)                 |
| `bench:azure-pricing`          | Phase 5 (token + accuracy A/B)        |

If counts change (Phase 2 splits markdown into two instruction files),
update [tools/registry/count-manifest.json](../tools/registry/count-manifest.json) —
`counts.instructions` is `computed_from` so no manual edit needed, but
verify validator output.

### Phase 7 — Re-measure + PR

- Re-run the **same** `11-Context Optimizer` audit from Phase 0 against the
  same fixture session-log. Save to `tmp/post-optimizer-<run>.md`.
- Compute deltas: input-token totals per agent, redundant-read count, top-10
  offenders. Save to `tmp/post-tokens.json`.
- Open PR. **Title** (revised from adversarial review):
  - Without instruction-file split: `perf(agents): cut auto-loaded context + force runtime compression`
  - With Phase 2 markdown.instructions split: `perf(agents)!: cut auto-loaded context + force runtime compression` — the `!` is justified because the file split is a real consumer break (any external repo with `.github/instructions/markdown.instructions.md` references must update). Description rewording alone does **not** justify `!`.
- Use `gh pr create` per [.github/skills/github-operations/SKILL.md](../.github/skills/github-operations/SKILL.md)
  (`gh` CLI-first; see `.github/copilot-instructions.md` anchor
  "GitHub Tool Priority (Mandatory)").
- PR body must include:
  - Baseline vs post-token table (per fixture).
  - List of validators added/modified, each annotated with its
    `WARN_UNTIL` date (Committed Decision #2).
  - Phase 3 path taken (A or B) per Committed Decision #4, plus the
    `apex-recall show test01` token count that drove the choice
    (nordic\* numbers as historical reference, if captured).
  - Phase 5 decision (kept or reverted) with measured reduction-% AND
    accuracy-% numbers (Committed Decision #3 — published regardless).
  - Phase 0.5 vendor-prompting compatibility finding.
  - Note that this **stacks on the three prerequisite merge groups** —
    PR #385, the AVM gate stack, and the Nordic retrospective fixes
    (assumed all merged per plan prerequisite); rebase from latest
    `main` before opening.
- **Phase 7 done state**:
  - PR opened, CI green at warn-level for the new checks.
  - All baseline/post artifacts in `tmp/` referenced from PR body.
  - Follow-up issues filed for: (a) warn→error promotion at +14 days,
    (b) `apex-recall show --summary` flag (only if Path B was taken),
    (c) caveman-shrink rollout to a second MCP (only if Phase 5 kept).

### Phase 7.5 — Routing-accuracy canary (post-merge, +7 days)

Validators don't catch **agent-routing degradation** — i.e., Copilot
picking the wrong agent because Phase 1's description rewording removed
a trigger keyword. Add a one-week canary.

**Prerequisite (separate issue, blocks PR-5 only)**: Build a routing-accuracy
fixture set. File this as **its own issue** at Phase 0 time, labeled
`infra: routing-accuracy-fixture` and linked from PR-1's body. Spec:

- 20–30 prompts, each tagged with the _expected_ agent the picker
  should select (oracle annotation).
- Stored under `tools/tests/prompts/routing-accuracy/` so it sits
  alongside the existing prompt sources picked up by
  `PROMPT_SOURCE_DIRS` in [tools/scripts/\_lib/paths.mjs](../tools/scripts/_lib/paths.mjs).
- A scoring script that compares a sampled session log's agent picks
  against the oracle and reports per-agent precision/recall.

PR-2, PR-3, PR-4 can merge **without** the fixture (their behavioral
changes are narrower). PR-5 must NOT merge until the fixture exists,
because Phase 7.5's rollback rule depends on it.

**Canary execution**:

- For one week post-PR-5-merge, sample 10 real session logs from
  `logs/copilot/` per day and run the scoring script.
- Compare with the **pre-merge baseline** captured the week before PR-5
  lands (using the same fixture against the pre-PR-1 commit on `main`).
- **Rollback rule**: if misrouting rate increases >10% absolute vs.
  the pre-merge week, revert Phase 1 description rewrites in a hot-fix
  PR. Phase 2/3/4/5 changes stay (they don't touch routing keywords).

If the fixture issue is still open at Phase 6 of PR-5, fall back to
"merge PR-5 without canary, file a follow-up to retro-build the fixture
and run the canary against the next-week sample" — but flag this as a
**known weakening of the rollback story** in PR-5's body.

## Scope boundaries

**In scope** — exactly the items below:

- Description-length validator + rewrites for skills + primary agents (Tier 1 #4)
- `applyTo` audit + split for `markdown.instructions.md` (Tier 1 #5)
- Compression-discipline validator + agent body edits for 05/06b/06t/08
  (Tier 1 #1) — either Path A or Path B per Committed Decision #4
- **Existing-twin reader-switch (v4 addition, sub-item of Phase 3)** —
  switch downstream `.md` reads of `04-governance-constraints` to the
  existing `.json` twin in 05-iac-planner + Bicep/Terraform validate /
  whatif / plan subagents. `sku-manifest` and `09-lessons-learned`
  already use `.json` (verified, no action).
- Challenger-lens-set audit + Explore-thoroughness soft lint (Tier 1 #2)
- caveman-shrink A/B on azure-pricing only, conditional on package
  existing (Tier 3 #15)
- Vendor-prompting compatibility pre-check (Phase 0.5)
- Routing-accuracy canary follow-up (Phase 7.5)

**Out of scope** — explicitly excluded:

- Tier 1 #3 (disable unused MCP servers per session) — per user direction
- Tier 2 + Tier 3 items other than #15
- Caveman in any form **other** than the MCP middleware on azure-pricing
- Modifying the drawio MCP (vendored fork)
- Modifying `apex-recall` itself (schema changes are follow-up issues)
- Touching `agent-output/**` artifact bodies (we change _agent definitions_,
  not historical artifacts)
- Splitting `.github/skills/context-management/SKILL.md` further. The
  skill has a `references/` directory, so the `MAX_SKILL_LINES_WITHOUT_REFS`
  constant in [tools/scripts/\_lib/paths.mjs](../tools/scripts/_lib/paths.mjs)
  doesn't constrain it — exclusion rationale: further splitting would
  fragment Mode A's discoverability, not "we hit a limit".
- Subagent description rewriting (Committed Decision #1 — they're
  contract-bound)

## Decisions

- **Strategy: 5-PR stack, not a single PR** (flipped from original
  recommendation during adversarial review). The original "one PR" plan
  produced a 40+ file change-set that reviewers couldn't reasonably
  inspect. New stack:
  1. **PR-1**: Phase 0 baseline + Phase 0.5 vendor-prompting check.
     Lands as a **single non-draft PR** carrying only the Phase 0.5
     report (`tmp/phase-0.5-vendor-prompting-check.md`) plus a
     short `tmp/README.md` index pointing at the gitignored baseline
     artifacts. **v3 additions to PR-1's verification scope**:
     - Confirm the three prerequisite merge groups have landed on `main`
       (PR #385, AVM gate stack, retrospective fixes).
     - Recount skills + agents post-consolidation; record in PR-1 body.
     - Capture the `tmp/phase3-body-budget.json` snapshot showing
       current 05/06b/06t/08 body lines vs. `MAX_BODY_LINES = 520`.
     - Re-baseline the model-mix coverage table (Opus 4.7 + Sonnet 4.6
       - GPT-5.5) against `/memories/repo/subagent-model-routing.md`.
         The baseline JSON/MD files themselves stay
         gitignored under `tmp/**` — they're attached to PR-2's
         description rather than committed (no review noise on machine-generated
         numbers, but the existence + path is documented in PR-1).
  2. **PR-2**: Phase 1 (descriptions) + Phase 2 (applyTo). Rebases on PR-1.
  3. **PR-3**: Phase 3 (compression discipline, Path A or B). Rebases on PR-2.
  4. **PR-4**: Phase 4 (challenger lens audit + Explore lint).
  5. **PR-5**: Phase 5 (caveman-shrink A/B) + Phase 7 (final re-measure)
     - Phase 7.5 canary setup. **Blocked by** the routing-accuracy
       fixture prerequisite issue (see Phase 7.5).
  - Stack lets earlier PRs merge if later ones stall and keeps each
    review under ~10 files.
- **Branch off `main` after three prerequisite groups merge** (v3
  revision): PR #385 (SKILL tier retirement), the AVM gate stack,
  and the Nordic retrospective fixes per
  [`tmp/plan-nordic-retrospective-fixes.md`](plan-nordic-retrospective-fixes.md).
  Verified by Phase 0's prerequisite checks. User confirmed #385 will
  merge first; retrospective is mid-execution at v3-write time.
- **caveman-shrink is opt-in only.** Even if Phase 5 succeeds, the wrapper
  ships behind a `CAVEMAN_SHRINK=1` env flag until two more full
  end-to-end runs validate it. This PR captures the apparatus and the
  measurement, not the rollout.
- **No edits to `apex-recall` schema.** If Phase 3 surfaces missing fields
  in `apex-recall show --json`, we file a follow-up issue and route around
  it — schema work is out of scope.
- **Multi-model context-tier coverage** (v3 — flips v2 assumption): the
  compression-tier thresholds in
  [.github/skills/context-management/SKILL.md](../.github/skills/context-management/SKILL.md)
  must cover **Claude Opus 4.7, Claude Sonnet 4.6, and GPT-5.5** since
  the codebase is now a mixed-model deployment (`e073b4d5`, `ccccd6f0`).
  Verify the hard-checkpoint table includes all three before Phase 3
  edits land; add a Sonnet 4.6 row if missing.

## Committed Decisions (resolved from Further Considerations)

1. **Phase 1 scope = skills + primary agents.** Subagent
   (`.github/agents/_subagents/*.agent.md`) descriptions are contract-bound
   and stay untouched. The Phase 1 upper-bound validator still applies to
   subagents (≤250 char limit) but is added as **warn-only** for them in
   v1; any subagent already over-budget joins `KNOWN_OVERSIZED`.
2. **All new validators land warn-level for two weeks, then promote to
   error.** Applies to:
   - Phase 1 description-length upper bounds (in `validate-skills.mjs` +
     `validate-agents.mjs`).
   - Phase 2 wide-`applyTo` + body-line check (in `validate-agents.mjs`).
   - Phase 3 compression-discipline validator
     (`validate-compression-discipline.mjs`).
   - Phase 4 Explore-thoroughness soft lint.
     Each new check ships with a `WARN_UNTIL: YYYY-MM-DD` constant (date =
     PR-merge date + 14 days) and a promotion follow-up issue is filed at
     merge. Matches the `KNOWN_OVERSIZED` pattern at
     [tools/scripts/validate-skills.mjs](../tools/scripts/validate-skills.mjs)
     line 46.
3. **Phase 5 caveman-shrink accept criteria = ≥30% token reduction AND
   ≥95% identical tool selections.** Numbers (baseline + shrink) are
   published in the PR body **regardless of keep/revert decision**, so
   future revisits inherit measured data rather than guessing.
4. **Phase 3 risk-check is a Phase 0 gate.** Before any Phase 3 agent body
   edit, run `apex-recall show test01 --json` against the post-E2E-run
   fixture at [agent-output/test01/](../agent-output/test01/) and
   record the token count in `tmp/baseline-tokens.json` under key
   `apex_recall_show.test01.tokens`. (v4: pinned to `test01`; the
   historical `nordic-foods` number is recorded as
   `apex_recall_show.nordic_foods.tokens` for cross-comparison but is
   no longer the decision driver.) Decision rule:
   - **< 5K tokens** → proceed with Phase 3 as planned (Path A).
   - **≥ 5K tokens** → file a follow-up issue requesting an
     `apex-recall show --summary` flag and proceed with a **modified
     Phase 3** (Path B): use `apex-recall show <project> --json` for
     _small_ projects only; for large projects, keep the current per-agent
     context-budget line ("Context budget: Read X + Y at startup") but
     make Phase 1.5 compaction MUST (vs current "should"). The
     compression-discipline validator from Phase 3 still ships either way.
