# Skills Assessment & Slimming Plan — 2026-05-17

> Read-only analysis of the `.github/skills/` ecosystem. Identifies
> retirement candidates, merge opportunities, and `SKILL.md` slimming
> targets. No file changes are made by this document — execution is
> opt-in per the priority table at the end.
>
> **Revision history**: 2026-05-17 v2 — applied adversarial-review
> corrections (must-fix M1-M5, should-fix S1-S5, suggestions G1-G4).
> Headline token math removed; load model corrected; inventory deduped;
> priorities re-ranked against actual Step-4 load telemetry.

## TL;DR

- **34 skills** (excluding `README.md`), of which **13 are referenced by
  ≥1 agent** (core) and **21 are user-invokable / plugin-style** (0 agent
  refs).
- **No skill recommended for outright retirement.**
- **Slimming `SKILL.md` does NOT reduce baseline context** — only the
  skill *descriptions* block (≈3,557 tokens total across all 34 skills)
  is baseline-loaded. `SKILL.md` bodies load on demand per
  [`copilot-instructions.md`](../.github/copilot-instructions.md).
  Savings apply only on turns where a skill is actually invoked.
- **Highest-ROI slim targets** are the 4 `SKILL.md` files actually read
  in the Step-4 trace: `azure-defaults`, `azure-governance-discovery`,
  `azure-artifacts`, `python-diagrams`. The 8 other "size-ranked" slim
  candidates (mermaid, context-management, etc.) save tokens only when
  separately invoked.
- **One maintainability-only merge**: extract a shared
  `azure-resource-graph-primer.md` (~64 removable lines across 3
  derivative refs — `references/` are on-demand, so this is a
  code-hygiene win, not a token win).
- **`sensei` is out of scope** for this plan (maintainer choice).

## Token / load model — measured, not assumed

| Layer                       | What loads                                       | Measured size                                        | Loaded per turn? |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------- | ---------------- |
| Skill **descriptions**      | All 34 skills' YAML `description:` fields        | 14,229 chars ≈ **3,557 tokens** total (avg 104/skill) | **Yes — baseline** |
| Skill **`SKILL.md`** body   | Only when an agent calls the skill               | 53-247 lines per file                                | **No — on demand** |
| Skill **`references/*.md`** | Only when `SKILL.md` body explicitly points to one | varies                                               | **No — on demand** |

**Token conversion used below**: markdown ≈ **10 tokens / line** (sampled
range 8-14 tokens/line for these files). Earlier draft used ~22
tokens/line — corrected.

**Trace evidence** ([`logs/iac-plan.json`](../logs/iac-plan.json),
Step-4 session, 1040 spans): the file contains **zero** `input_tokens` /
`prompt_tokens` fields. Only 4 `SKILL.md` files were opened during the
session:

| Skill                        | Reads in trace | SKILL.md lines |
| ---------------------------- | -------------- | -------------- |
| `azure-governance-discovery` | 3              | 180            |
| `azure-artifacts`            | 2              | 138            |
| `python-diagrams`            | 2              | 143            |
| `azure-defaults`             | 2              | 247            |

All other skills' `SKILL.md` bodies were never loaded in this trace.
Any "savings" claim for them must come from a different workload.

## Inventory

| Class                                | Count | Examples                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core (≥3 agent refs)                 | 7     | `azure-defaults` (18 agents), `azure-artifacts` (13), `iac-common` (9), `context-management` (7), `python-diagrams` (4), `golden-principles` (3), `azure-bicep-patterns` (3)                                                                                                                                                          |
| Supporting (1-2 agent refs)          | 6     | `workflow-engine`, `terraform-patterns`, `drawio`, `azure-governance-discovery`, `azure-diagnostics`, `azure-adr`                                                                                                                                                                                                                     |
| Plugin / user-invokable (0 agent refs) | 21  | `azure-prepare`, `azure-deploy`, `azure-validate`, `azure-cost-optimization`, `azure-compute`, `azure-rbac`, `azure-resources`, `azure-storage`, `azure-kusto`, `azure-quotas`, `azure-compliance`, `azure-cloud-migrate`, `entra-app-registration`, `github-operations`, `microsoft-docs`, `mermaid`, `docs-writer`, `terraform-test`, `terraform-search-import`, `vendor-prompting`, `sensei` |

Sum: 7 + 6 + 21 = 34. `sensei` is in inventory but out of scope for
slim recommendations.

## 1. Retire — outright

**None.**

Earlier draft proposed a "30-day usage watch" on `azure-cloud-migrate`
and `microsoft-docs`. **Dropped** — the repo has no per-skill invocation
telemetry pipeline today, so the watch criterion is non-operational.
Decisions:

| Skill                 | Lines | Decision                                                                                                                          |
| --------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| `azure-cloud-migrate` | 56    | **Keep.** Already minimal; distinct user intent (AWS/GCP→Azure) vs `azure-prepare`. No savings available — already at floor.       |
| `microsoft-docs`      | 130   | **Keep but slim** (see §3 Tier B). MS Learn MCP is broadly available, but the skill's discovery rules + caveats are worth keeping. |

## 2. Merge — maintainability win only

### 2a. Resource Graph query primer — code hygiene, not baseline tokens

Three skills carry near-identical `references/azure-resource-graph.md`
head sections:

| Skill                     | Reference file              | Total lines | Shared-head lines |
| ------------------------- | --------------------------- | ----------- | ----------------- |
| `azure-cost-optimization` | `azure-resource-graph.md`   | 104         | 32                |
| `azure-compliance`        | `azure-resource-graph.md`   | 99          | 33                |
| `azure-diagnostics`       | `azure-resource-graph.md`   | 95          | 33                |
| `azure-resources`         | `azure-resource-graph.md`   | 204         | (structurally different — exclude) |

**Measured overlap**: `diff` of the "How to Query" section across the 3
small files differs by **one word per file** (audit / find / diagnose).
Real removable duplication: **~64 lines** (keep one canonical, strip
~32 lines from each of the other two).

**Caveat**: these are `references/` files, **loaded on demand**, so
this is a **maintainability win, not a token-budget win**. Listed for
code hygiene only.

**Action** (P3, optional): extract canonical head to
`iac-common/references/azure-resource-graph-primer.md`; leave each
skill's workload-specific patterns in place + add a pointer.

### 2b. Pipeline trio — already lean

`azure-prepare` (106) + `azure-validate` (97) + `azure-deploy` (89) =
292 lines, all under 200, already cross-reference each other. **No
action.** Just confirm all three point to existing
[`iac-common/references/azd-vs-deploy-guide.md`](../.github/skills/iac-common/references/azd-vs-deploy-guide.md).

## 3. Slim — re-ranked by actual load frequency

**Ranking rule**: target `SKILL.md` files that the OTEL trace actually
loads, since slimming an unloaded skill saves no tokens for this
workload. Within each tier, sort by `lines × loads`.

### 3.1 Trim skill **descriptions** (true baseline — loaded every turn)

The skill descriptions YAML block totals **3,557 tokens** baseline. The
10 largest descriptions are 460-485 chars; trimming the verbose "WHEN /
USE FOR / DO NOT USE FOR" pattern by ~30% yields a deterministic
per-turn saving.

| Skill                        | Description chars | Target chars |
| ---------------------------- | ----------------- | ------------ |
| `github-operations`          | 485               | ~340         |
| `terraform-patterns`         | 474               | ~330         |
| `mermaid`                    | 474               | ~330         |
| `azure-prepare`              | 474               | ~330         |
| `azure-deploy`               | 471               | ~330         |
| `azure-compute`              | 470               | ~330         |
| `azure-governance-discovery` | 464               | ~330         |
| `azure-validate`             | 463               | ~330         |
| `azure-resources`            | 460               | ~330         |
| `iac-common`                 | 456               | ~320         |

**Conservative estimate**: ~1,400 chars trimmed across 10 skills =
**≈350 tokens saved every turn, every session**. Smaller than the
earlier (incorrect) per-turn claim, but deterministic and baseline.

### 3.2 `SKILL.md` slim — tier ordered by trace evidence

**Tier A — verified loaded in the Step-4 trace** (high ROI):

| Skill                        | Now | Target | Largest sections to extract                                                                                                                                                                                                                                                                                                       | Δ saved (lines / tokens)               |
| ---------------------------- | --- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **azure-defaults**           | 247 | ~150   | `## CAF Naming Conventions` (23) — verify SKILL.md does not duplicate existing [`references/naming-full-examples.md`](../.github/skills/azure-defaults/references/naming-full-examples.md) before extracting · `## Azure Verified Modules (AVM)` (35) — diff against existing [`references/avm-modules.md`](../.github/skills/azure-defaults/references/avm-modules.md) first · `## Gotchas` (14) → new `references/gotchas.md` | **−95 lines / ~950 tokens per invocation** (TBD pending diff) |
| **azure-governance-discovery** | 180 | ~120 | Audit-mode H2s (`Capabilities`, `Methodology`, `Report Template`) → existing refs                                                                                                                                                                                                                                               | **−60 lines / ~600 tokens per invocation**                  |
| **python-diagrams**          | 143 | ~100   | Quick-ref tables for phase colours / icon paths → existing refs (12 already)                                                                                                                                                                                                                                                       | **−45 lines / ~450 tokens per invocation**                  |
| **azure-artifacts**          | 138 | ~100   | H2 compliance tables → existing refs (10 already)                                                                                                                                                                                                                                                                                  | **−40 lines / ~400 tokens per invocation**                  |

**Tier B — only when these skills are explicitly invoked** (defer until
usage justifies it):

| Skill                    | Now | Target | Notes                                                                                                                                                                                                                                                                                            | Δ saved (lines) |
| ------------------------ | --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `mermaid`                | 186 | ~50    | Has **zero `references/`** today — best technical-debt candidate, but zero loads in IaC trace. Defer.                                                                                                                                                                                            | −135            |
| `context-management`     | 182 | ~100   | Some content useful for orchestrator runtime; verify before extracting.                                                                                                                                                                                                                          | −80             |
| `github-operations`      | 176 | ~90    | `## Branch Naming` (21) → existing [`references/branch-strategy.md`](../.github/skills/github-operations/references/branch-strategy.md) · `## Conventional Commits` (20) → existing [`references/commit-conventions.md`](../.github/skills/github-operations/references/commit-conventions.md) · keep these SEPARATE (corrected from earlier draft). | −85             |
| `azure-adr`              | 167 | ~70    | 4 new refs needed (`example-prompts`, `workflow-integration`, `quality-checklist`, `adr-output-format`).                                                                                                                                                                                          | −95             |
| `entra-app-registration` | 159 | ~80    | 10 refs already; diff SKILL.md against refs before extracting.                                                                                                                                                                                                                                    | −75             |
| `azure-quotas`           | 152 | ~70    | 14 short H2s — consolidate.                                                                                                                                                                                                                                                                       | −80             |
| `azure-kusto`            | 147 | ~50    | Extract to existing `references/query-patterns.md` (verify size first).                                                                                                                                                                                                                           | −90             |
| `microsoft-docs`         | 130 | ~60    | MCP discovery rules → keep top-level; trim examples.                                                                                                                                                                                                                                              | −70             |

**No Tier C** — `drawio` (190 lines, 12 refs, 2 agent refs) was Tier B
in the earlier draft but is already well-factored; ~30 lines of cosmetic
trim possible, not worth touching.

### Conversion / honesty footnote

- 10 tokens/line is the assumed conversion; observed range 8-14 for
  these files.
- Per-invocation savings are **only** realised on turns where that
  skill's `SKILL.md` is read. The Step-4 trace shows that fraction
  varies wildly (4/34 skills loaded in a 104-turn IaC session).
- No claim of "session-wide %" or "% of session cost" is made — those
  numbers require per-skill invocation telemetry the repo does not yet
  emit.

## 4. Exemplary — informational only

Subjective category — included for reference, not a target.

| Skill                     | Lines | Note                                                  |
| ------------------------- | ----- | ----------------------------------------------------- |
| `iac-common`              | 80    | 17 references; SKILL.md is a pure dispatch table.     |
| `golden-principles`       | 53    | Single source of truth, tight.                        |
| `terraform-search-import` | 97    | Lean and scoped.                                      |

Earlier draft also listed `azure-validate` and `azure-cloud-migrate`
here. Removed — `azure-validate` is unremarkable; `azure-cloud-migrate`
is discussed in §1.

## 5. Other observations

- **`vendor-prompting/.snapshots/anthropic-prompting-best-practices.md`**
  is **1.1 MB**, the largest file in the skill tree. The earlier draft
  asserted ".snapshots/ is excluded from agent context (it appears to
  be)" — **unverified**. `.snapshots/` is not in `.gitignore`, not in
  the workspace's chat-context exclusion list, and dot-prefix paths are
  not universally skipped by Copilot file scanners. **Action**: grep
  the agent-loader code (or attach the file deliberately and observe
  context size) before claiming exemption. If it does load, exclude in
  the loader.
- **42 duplicate `README.md` files** under `references/` across skills
  — normal (one README per skill's references folder). Not actionable.
- **Language SDK quick-refs** (`python.md`, `bicep.md`, `javascript.md`,
  …) appear across `references/sdk/` directories. Skill-scoped, not
  duplicates. Not actionable.

## 6. Recommended execution order

| Priority | Action                                                                                                                              | Files touched              | Verification gate                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------- |
| **P1**   | Trim 10 largest skill **descriptions** (§3.1) — true baseline saving                                                                 | 10 SKILL.md frontmatters   | `npm run validate:agents` + `npm run lint:md`                  |
| **P2**   | Slim **azure-defaults** (Tier A) after diffing SKILL.md vs existing `references/`                                                    | 1 SKILL.md + ≤2 new refs   | All 18 dependent agents pass `validate:agents`                 |
| **P2**   | Slim **azure-governance-discovery**, **python-diagrams**, **azure-artifacts** (Tier A)                                               | 3 SKILL.md + ≤6 new refs   | Smoke-test artifact rebuilds (e.g., re-run Step 3.5 governance) |
| **P3**   | Slim Tier B skills (mermaid, context-management, github-operations, azure-adr, entra-app-registration, azure-quotas, azure-kusto, microsoft-docs) | 8 SKILL.md + new refs      | Skill-specific smoke (e.g., regenerate one mermaid diagram)    |
| **P3**   | Extract `azure-resource-graph-primer.md` (§2a) — maintainability only, ~64 lines                                                     | 4 files                    | `lint:md`                                                      |

### Exit criteria (per slim)

1. `npm run validate:agents` — all agent references still resolve.
2. `npm run lint:md` — 0 markdownlint errors on touched `SKILL.md`.
3. At least one **functional smoke** per Tier A slim: re-execute the
   workflow step that actually uses the skill (Step 3.5 for governance,
   Step 1/2 artifact generation for `azure-artifacts`, etc.) and
   confirm the output matches the previous run modulo whitespace.

## 7. Changes vs the 2026-05-17 v1 draft

| Tag | Section                    | Change                                                                                                                                                |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | TL;DR / §3                 | Removed "60 k → 44 k baseline" framing. SKILL.md is not in baseline; only descriptions are. New §3.1 added with measured descriptions cost (3,557 tk). |
| M2  | TL;DR / §Sources           | Removed "104 turns, 85 k tokens/turn, 16% session cost" claims. `logs/iac-plan.json` has zero token-count fields.                                     |
| M3  | TL;DR / Inventory          | "35 skills" → 34. "22 plugins" → 21. Removed duplicate `azure-storage`.                                                                               |
| M4  | §3 / §6                    | Re-ranked slim targets by trace evidence. Tier A = the 4 skills actually loaded; Tier B = the rest.                                                   |
| M5  | §3 (github-operations row) | Split Branch Naming → `branch-strategy.md` (existing) and Conventional Commits → `commit-conventions.md` (existing). Kept separate.                   |
| S1  | §2a                        | Dedup volume corrected: ~64 removable lines (was 120). Re-labelled as maintainability-only (references/ are on-demand).                               |
| S2  | §3 (azure-defaults row)    | Added "TBD pending diff" qualifier; the existing `avm-modules.md` may already hold the content.                                                       |
| S3  | §3 / §6                    | Demoted `mermaid` from P1 to Tier B / P3 — zero loads in the cited trace.                                                                             |
| S4  | §1                         | Dropped "30-day watch" — no telemetry pipeline today; replaced with concrete keep/slim decisions.                                                     |
| S5  | §5                         | Marked `.snapshots/` exclusion claim as unverified; explicit action item to grep loader.                                                              |
| G1  | §3.1                       | Added — trim 10 largest descriptions (the only block that is true baseline).                                                                          |
| G2  | §3                         | Token conversion (10 tokens/line, 8-14 range) stated explicitly. Halves earlier savings figures.                                                      |
| G3  | §4                         | Removed `azure-validate` and `azure-cloud-migrate` from "Exemplary"; flagged as subjective/informational.                                              |
| G4  | §6                         | Added "Exit criteria" sub-section with verification gates per slim.                                                                                   |

## Sources

- Skill inventory: `find .github/skills -maxdepth 2 -name SKILL.md` (n=34).
- Agent-reference count: `grep -rl "skills/{skill}\b\|skills/{skill}/" .github/agents/`.
- Section sizes: `awk` row-count between `##` headers.
- Description sizes: PyYAML parse of frontmatter; total 14,229 chars / 3,557 tokens.
- Trace skill loads: `grep -oE '[\w/.\-]+SKILL\.md' logs/iac-plan.json` then dedupe (4 unique).
- Site catalog: [`site/src/content/docs/concepts/how-it-works/skills-and-instructions.md`](../site/src/content/docs/concepts/how-it-works/skills-and-instructions.md)
