# Plan 01 — Phase 4: Agent Body Compression

## TL;DR

**Goal (outcome, not line count)**: reduce p50
`avg_input_per_call` by **≥5%** (target band 8–12%) on the existing
multi-log baseline at
[`agent-output/_baselines/multi-log-baseline.json`](agent-output/_baselines/multi-log-baseline.json),
measured per the procedure in
[`log-profiling.md`](.github/skills/context-management/references/log-profiling.md).
The agent body replays in **every** chat turn, so trimming it has a
linear, measurable cost effect; line counts are only the _means_.

**Method**: remove genuine duplication first (cross-agent overlap,
Phase A), then per-agent narrative compression (Phase B). No
structural refactors beyond extracting content that already lives
verbatim in 2+ files.

**Scope**: 15 main agent bodies in `.github/agents/*.agent.md`
(`_subagents/` excluded). Workspace audit: aggregate body ≈ **6,900
lines**; 12 of 15 exceed the 350-line _guidance_ in
[`context-optimization.instructions.md`](.github/instructions/context-optimization.instructions.md);
**0 of 15 exceed the hard gate** of `MAX_BODY_LINES = 600` in
[`tools/scripts/_lib/paths.mjs`](tools/scripts/_lib/paths.mjs#L41).
We are NOT adding a 350-line hard gate (see [Evidence](#evidence)
below — the number is a project preference, not externally grounded).

**Expected delta (hypothesis, validated by Phase C4)**: ~1,750–2,100
fewer body lines (~25–30% of aggregate) → model-dependent fraction
of an `avg_input_per_call` reduction. The hard pass/fail is the
p50 percentage drop in C4, not the line count.

**Approach tiers** (descending risk):

- **T1 (low risk)** — preamble boilerplate compression, moving long
  inline tables/templates to `references/`, extracting the shared
  06b/06t and 07b/07t overlap into single instruction/reference files,
  consolidating skill-read rationales.
- **T2 (medium risk)** — compressing per-phase narrative prose in
  04g / 05 / 06b / 06t / 07b / 07t Core Workflows that restates what
  the linked references already say (keep terminal commands and
  numbered phase boundaries verbatim).
- **T3 (higher risk)** — structural extraction of 04-Design's ADR
  template + Diagram Contract into `azure-adr/references/` and
  `drawio/references/`; moving 02-Requirements Phase 6 challenger
  panel to the shared adversarial-review protocol; deduping the
  Cost-Estimation delegation contract between 03/08.

Slot: extends `/memories/repo/codegen-model-mix-2026.md` (Plan 01) as
Phase 4. Load-bearing validator contracts
(`validate:orchestrator-handoff`, `validate:review-ceiling`,
`lint:artifact-templates` / `validate:artifacts`,
`validate:iac-security-baseline`, `validate:agents`) cover
frontmatter, handoff line, and security baseline — compression
touches body prose but does not change the contracts those
validators check.

**All work runs on a dedicated branch** —
`chore/plan01-phase4-body-compression` — cut from `main`. Final
delivery is a single PR (one commit per agent in Phase B for
reviewability). The branch is not merged to `main` until Phase C4
(baseline smoke test) passes and a human reviewer signs off.

---

## Evidence

Ground-truth for _why_ this work is worth doing — not internal
repo claims, external sources only.

### What external evidence supports

1. **Token cost is linear and published.** At
   [OpenAI API pricing](https://openai.com/api/pricing/) (May 2026):
   GPT-5.5 = $5/M input, GPT-5.4 = $2.50/M input. Per
   [Anthropic's Claude 3.5 Sonnet announcement](https://www.anthropic.com/news/claude-3-5-sonnet):
   $3/M input. Every line of agent body ≈ 10–15 tokens; a 600-line
   body ≈ 6–9K tokens _replayed on every chat turn_. A 40-turn
   session = ~240–360K tokens of body alone ≈ **$1.20–1.80 per
   agent per session at GPT-5.5 rates**. Multiply by ~10 agents per
   APEX workflow.
2. **Long-context degradation is peer-reviewed.**
   [Liu et al., "Lost in the Middle: How Language Models Use Long
   Contexts" (TACL 2023, arXiv:2307.03172)](https://arxiv.org/abs/2307.03172)
   shows model accuracy degrades when relevant info is mid-context,
   _even for explicitly long-context models_. The body sits at the
   front (protected zone), so this paper does NOT argue for shrinking
   the body directly — it argues that bloating the _front_ pushes
   tool outputs and conversation into the degraded _middle_.
3. **Vendor prompt-engineering guidance favors brevity.** Anthropic's
   ["Be clear and direct"](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct)
   and [OpenAI's prompt-engineering guide](https://platform.openai.com/docs/guides/prompt-engineering)
   consistently recommend concise prompts, without publishing a
   numeric line/token cap.

### What external evidence does NOT support

- **No vendor or paper publishes a specific line threshold** (350,
  400, 500, 600) for agent definitions. The 350-line number in
  `context-optimization.instructions.md` is a project preference
  written by maintainers, not a citation. The 600-line hard gate
  was chosen by maintainer judgment (see the bump-from-520 comment
  in [`paths.mjs`](tools/scripts/_lib/paths.mjs#L30-L41)).
- **The 8–12% `avg_input_per_call` drop is a hypothesis**, not a
  vendor-published benchmark. It is the _target band_; the _gate_
  is the ~5% floor in Phase C4.

### Implication for this plan

The defensible justification is **cost** (citable, linear) and
**indirect accuracy preservation** ("lost in the middle" + cleaner
front context = less attention pressure on tool outputs in the
middle). The 350-line number stays as guidance / target signal,
not as a new hard gate. Success is judged by C4's measured drop,
not by line count.

---

## Branch & PR Strategy

- **Branch name** (informal — the repo has no documented branch-name
  convention): `chore/plan01-phase4-body-compression`. Branch naming
  is _not_ governed by Conventional Commits; only commit messages
  and PR titles are.
- **Commit / PR title convention**: `chore(agents): ...` for the
  cross-agent A1–A5 commits and `refactor(agents): compress
<agent-id> body` for each B-row commit. PR title:
  `chore(agents): Plan 01 — Phase 4 agent body compression`.
- **Base**: `main` at the SHA recorded in Phase 0 (`git rev-parse HEAD`
  written to `tmp/phase4-baseline.json`).
- **Commit cadence**: one logical change per commit — A1, A2, A3, A5
  each get their own commit, **A4 is a foundational commit that B1–B12
  depend on** (see F-004 callout below), then one commit per agent
  for B1–B12. (No C0 / new-validator commit — the 350-line gate is
  _not_ being promoted to a hard fail; see Phase C0 below.)
- **Foundational-commit caveat**: A4 (shared instruction file) is
  _not_ independently revertable once B commits land. Rollback of A4
  requires a group revert of A4 + every later commit that references
  the new instruction file. Document this explicitly in the PR
  description.
- **PR**: opened in _draft_ after Phase A lands so reviewers can see
  the references being extracted before any agent body is trimmed.
  Marked ready-for-review after Phase B + C2 complete green and the
  Phase C4 outcome measurement is recorded in the PR description.
- **Merge gate (single)**: Phase C4 measured **≥5% drop in p50
  `avg_input_per_call`** vs. the existing baseline. Per-agent line
  counts are reported but are not blocking. PR cannot merge if C4
  shows <5%.
- **PR size**: ~20–25 commits is large but the repo has no documented
  PR-size cap. Draft + per-agent commits + visible baseline diff
  mitigate review burden; if reviewer pushback is high, stack into
  Phase-A and Phase-B PRs.
- **CI gates**: `npm run validate:_node` + `npm run lint:md` + (once
  per push) `npm run lint:links` must pass on every push; lefthook
  `pre-push` `diff-based-push-check.sh` runs automatically.
- **Rollback**: A1–A3, A5, B1–B12 commits are independently
  revertable. A4 requires group revert (see above).

---

## Phases

### Phase 0 — Branch + ledger setup (sequential, blocks A)

0a-pre. **Restore the Phase C4 baseline file if it is missing on disk.**
Drift audit (2026-05-17) found
`agent-output/_baselines/multi-log-baseline.json` deleted in the
working tree but still tracked at `HEAD` (uncommitted delete on
`main`). Phase C4 cannot measure without it. Restore as pre-work,
**not** as a Phase 4 commit — it is pre-existing state cleanup, not
part of body compression.

```bash
test -f agent-output/_baselines/multi-log-baseline.json \
  || git restore agent-output/_baselines/multi-log-baseline.json
```

0a. **Cut the branch from current `main`.**

```bash
git fetch origin main
git checkout -b chore/plan01-phase4-body-compression origin/main
git rev-parse HEAD  # record SHA in tmp/phase4-baseline.json
```

0b. **Capture body-line baselines** for all 12 agents in scope (see
Phase C1) into `tmp/phase4-baseline.json` _before_ any edits. This
file is committed alongside the first Phase A commit so the delta
is visible from the PR.

0c. **Open a draft tracking issue** (optional but recommended):
`gh issue create --title "Plan 01 — Phase 4: Agent Body Compression" --body-file untitled:plan-agentBodyCompression.prompt.md`.
Link it from the PR once opened.

### Phase A — Cross-agent consolidation (parallel-safe, low-risk)

The single highest-value, lowest-risk move: extract content that
already lives in 2+ agents verbatim into one canonical source and
replace the body copies with a single-line pointer.

**Extraction checklist (applies to every new `references/*.md` file
created in A1, A3, B4, B5, B9, B10):**

1. Start the file with the canonical `<!-- ref:{slug}-v1 -->` canary
   marker on line 1 to pass `validate:skill-checks`.
2. Add the new file to the owning skill's **Reference Index** in its
   `SKILL.md` so it is not orphaned (`validate:skills` warns on
   orphans). For `agent-operating-frame.instructions.md` (A4) the
   index entry lives in the agent's mandatory-read list, not in a
   SKILL.md.
3. Use **file-relative** links inside the reference, not
   workspace-root paths (the global `.markdown-link-check.json` does
   not ignore relative links).
4. **If moving shell snippets** out of agent bodies into a reference,
   manually scan for `mv -i`, `rm -i`, `cp -i`, `read -p`, interactive
   `bash -c '...'` — `lint:safe-shell` (`safe-shell.mjs`) excludes
   both skill `references/` AND `templates/` directories by design
   (see `safe-shell.mjs` L146-148), so coverage transfers off the
   moved snippet. Either fix the snippet inline before moving it, or
   keep it in the scanned agent body if it's not truly a standalone
   reference.
5. Run `npm run validate:skill-checks` + `npm run validate:skills`
   after each new reference file lands.

A1. **IaC-codegen shared DO/DON'T overlap** (06b + 06t).
[06b-bicep-codegen.agent.md](.github/agents/06b-bicep-codegen.agent.md#L168-L224)
DO/DON'T (lines 168–224) and
[06t-terraform-codegen.agent.md](.github/agents/06t-terraform-codegen.agent.md#L181-L227)
DO/DON'T (lines 181–227) share roughly two-thirds of bullets verbatim
(governance mapping, plan-lock rule, output-cadence rule, challenger
artifact_type rule, hardcode-tags rule, security-baseline rule, IK→
connection-string rule, hyphenated-Storage rule, no-deploy rule,
input-invention rule). Extract the shared bullets to a new file —
[.github/skills/iac-common/references/codegen-do-dont.md](.github/skills/iac-common/references/codegen-do-dont.md)
— and leave only the genuinely Bicep- or Terraform-specific bullets
inline. Each agent then opens its DO section with one "Read" pointer.
_Saves ~30 lines × 2 agents = 60 lines._

A2. **Deploy DO/Pitfalls overlap** (07b + 07t).
[07b-bicep-deploy.agent.md](.github/agents/07b-bicep-deploy.agent.md#L150-L183)
"Shared Deploy Protocol" + DO + Pitfalls and
[07t-terraform-deploy.agent.md](.github/agents/07t-terraform-deploy.agent.md#L154-L186)
mirror each other. The Shared Deploy Protocol block is already a
near-pointer (12 lines); the DO + Pitfalls bullets are the duplication
to pull. Target file:
[.github/skills/iac-common/references/deploy-shared-workflow.md](.github/skills/iac-common/references/deploy-shared-workflow.md)
(already exists per the body links). Move the shared bullets there.
_Saves ~25 lines × 2 agents = 50 lines._

A3. **Cost-Estimation delegation contract** (03 + 08).
[03-architect.agent.md](.github/agents/03-architect.agent.md#L300-L360)
§Cost Estimation (~60 lines) and
[08-as-built.agent.md](.github/agents/08-as-built.agent.md#L322-L386)
§Cost Estimation (07-ab-cost-estimate.md) (~65 lines) both carry the
"Pricing Accuracy Gate" guardrail, the 5-step delegation procedure,
the MCP-tools table, and the "no parametric fallback" rule. The
caller-side contract belongs in the subagent's own reference, not
duplicated in every parent. Target file:
[.github/agents/\_subagents/cost-estimate-subagent.agent.md](.github/agents/_subagents/cost-estimate-subagent.agent.md)
already documents this; add a small `references/cost-estimate-parent-contract.md`
under `azure-defaults` (parent-side delegation rules). Both parents
keep only the artifact-specific bits ("What Goes Where" table for 03;
"07-ab-cost-estimate.md" artifact target for 08).
_Saves ~35 lines × 2 agents = 70 lines._

A4. **Pre-workflow preamble boilerplate** (most agents).
Every IaC + workflow agent (`02`, `03`, `06b`, `06t`, `07b`, `07t`,
`08`) carries near-identical 3–4 line sub-sections: **Context
Awareness**, **Scope Fencing**, **Subagent Budget**, **Investigate
Before Answering**. Compress to a single "Operating frame" H3 in
each agent (4 lines max) that lists the agent's specific subagents +
the one-line scope statement. Move shared rules ("Read each SKILL.md
once", "Use `apex-recall show --json` for cached lookups", "Do not
modify upstream artifacts") to a new instruction file:
[.github/instructions/agent-operating-frame.instructions.md](.github/instructions/agent-operating-frame.instructions.md)
with `applyTo: ".github/agents/*.agent.md"` (single-star — main
agents only; `_subagents/` and `e2e-orchestrator` are out of scope).
⚠️ **A4 is a foundational commit — B1–B12 cannot land if A4 is
reverted in isolation.** PR description must list every dependent
commit; rollback is group-revert. After A4 lands, run
`npm run validate:instruction-checks` to confirm the new
instruction's applyTo glob is well-formed.
_Saves ~10 lines × 7 agents = 70 lines._

A5. **"Completion Handoff" verbatim block** (every agent).
The 12-line trailing block is identical across `02`, `03`, `04`,
`04g`, `05`, `06b`, `06t`, `07b`, `07t`, `08` (and the verbatim
resume line is enforced by `validate_orchestrator_handoff.py`).
Extract the prose explanation and keep only the verbatim 4-line
`text` codeblock in each agent. Add a single sentence pointing to
[`compression-templates.md`](.github/skills/context-management/references/compression-templates.md#gate-boundary-clear-handoff-contract).
⚠️ **Validator gap**: the orchestrator-handoff validator only does
a substring check for `REQUIRED_LINE` — it does not verify the
`## Completion Handoff` section heading, the fenced `text` codeblock,
or the link to `compression-templates.md`. A5 could silently regress
the direct-invocation handoff presentation while still passing CI.
_Mitigation_: add a manual A5 diff checklist to the PR description
(grep each STEP_AGENTS file for `## Completion Handoff` heading +
fenced `text` block + presence of one link to `compression-templates.md`)
before marking the PR ready-for-review.
_Saves ~8 lines × 10 agents = 80 lines._

**Phase A total: ≈ 330 lines saved across 9 agents. Low risk.
Parallel-safe — each sub-task touches a distinct content area.**

---

### Phase B — Per-agent compression (parallel-safe, signal-driven)

Per-agent boilerplate / table / long-prose compression. Each item
below is independent and can be applied in any order or in parallel.

**Targets are hypotheses, not contracts.** The numbers in the
`Body target` column are the editor's best-guess landing zone for
each agent; the _only_ merge gate is the aggregate C4 outcome
(≥5% p50 drop). An agent that lands at 410 lines instead of 395
is not a failure as long as C4 still passes.

> **Re-baseline note (2026-05-17)** — the `Body now` column below
> reflects the audit captured for this plan after the drift sweep.
> Earlier drafts cited numbers that were ~5–50 lines higher per
> agent (prior compression work landed before this plan was
> approved). Per-row `Reduction` deltas are preserved; only `Body
> now` + `Body target` were re-anchored.

Format per agent: **filename | current body | target body | reduction
| risk | what to compress**.

| #   | Agent                                                                             | Body now | Body target | Reduction | Risk         | What to compress                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------- | -------- | ----------- | --------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | [`01-orchestrator.agent.md`](.github/agents/01-orchestrator.agent.md)             | 548      | ~450        | ~100      | LOW          | (a) Collapse "Review Protocol" inputs table (lines 313–320) + capture script to a single 6-line block — protocol details already in `workflow-graph.json` & `decision-keys.md`. (b) Move the "Mid-step compaction" sub-section (lines 600–640) to `compression-templates.md` and keep one paragraph + link. (c) Trim DO/DON'T to ≤ 8 rows × 2 cols (currently 13 rows). ⚠️ DO NOT touch gate language, the verbatim `/clear` codeblock, Subagent Tier Rule, or any `apex-recall checkpoint` line.                                                                                                                                 |
| B2  | [`02-requirements.agent.md`](.github/agents/02-requirements.agent.md)             | 431      | ~345        | ~85       | LOW–MED      | (a) Phase 6 challenger panel (lines 323–420, ~100 lines) restates the per-finding decision protocol. Move to `azure-defaults/references/adversarial-review-protocol.md` (already exists); leave the agent-specific Requirements-step example only. (b) "Required Information" tables (lines 421–447) — collapse from 3 tables to 1 if the values aren't enforced.                                                                                                                                                                                                                                                                 |
| B3  | [`03-architect.agent.md`](.github/agents/03-architect.agent.md)                   | 507      | ~395        | ~110      | LOW–MED      | (a) §Cost Estimation overlap → Phase A3 (~35 lines). (b) §Adversarial Review (lines 361–450): trim per-invocation parameter blocks (7 of them, each ~10 lines); keep the param names but compress repeated `prior_findings = null`, `overwrite = false`, `output_path` boilerplate to a "Common invocation template" preamble + per-pass overrides only. (c) §Approval Gate (lines 451–495) — link to `workflow-gates.md` (already linked in §Adversarial Review).                                                                                                                                                                |
| B4  | [`04-design.agent.md`](.github/agents/04-design.agent.md)                         | 531      | ~385        | ~145      | MED (Tier 3) | (a) §Diagram contract (T-012-baseline informed) (lines 251–350, ~100 lines) → **prefer Option β: extend existing [`drawio/references/validation-checklist.md`](.github/skills/drawio/references/validation-checklist.md) (and/or [`creation-workflows.md`](.github/skills/drawio/references/creation-workflows.md)) instead of creating a new `diagram-contract.md`**. Open them side-by-side first; only fall back to a new file if both existing refs lack >50% of the contract content. Keep a 4-line summary in the agent body. (b) §Style guidance (lines 351–387, ~37 lines) → **prefer Option β: extend existing [`drawio/references/style-reference.md`](.github/skills/drawio/references/style-reference.md)** instead of creating a new `style-guidance.md`. (c) The 4-section ADR skeleton (Status / Context / Decision / Consequences, lines 388–441) → **`adr-template.md` ALREADY EXISTS** at [`.github/skills/azure-adr/references/adr-template.md`](.github/skills/azure-adr/references/adr-template.md); verify it covers all 4 sections, then **replace in-body skeleton with a single "Read" pointer** — do NOT re-author. ✅ Verified safe: `validate-artifacts.mjs` reads H2 contracts from `azure-artifacts/templates/` + skill references, not agent bodies. If a fall-back new file is authored, apply Phase A extraction-checklist (canary marker + SKILL.md index entry); document any deviation in the PR description. |
| B5  | [`04g-governance.agent.md`](.github/agents/04g-governance.agent.md)               | 597      | ~460        | ~135      | MED (Tier 2) | (a) Phase 1 commentary (lines 295–345) restates `discover.py` self-documentation — compress the 6 numbered substeps to 3 by moving stdout-handling rules to [`azure-governance-discovery/references/discover-output.md`](.github/skills/azure-governance-discovery/references/discover-output.md) (create). (b) Phase 0.4 short-circuit checklist (lines 234–263, ~30 lines) → move to a `references/resume-checks.md` and reference. (c) Anti-patterns blockquotes (lines 339–355) — keep but collapse from 3 to 1 paragraph. ⚠️ Keep every `apex-recall` and `discover.py` invocation line verbatim.                            |
| B6  | [`05-iac-planner.agent.md`](.github/agents/05-iac-planner.agent.md)               | 571      | ~440        | ~130      | MED (Tier 2) | (a) Phase 1 L0-envelope checklist (lines 220–250) restates `governance-discovery.md` envelope contract — compress and link. (b) Phase 3.5 askQuestions panel composition (lines ~320–360) — move the 5-question template body to `azure-defaults/references/plan-design-decisions.md` (already linked); keep only the trigger logic in the agent. (c) Phase 3.6 Context Compaction (~30 lines) → `context-management` skill already documents this; reduce to 4 lines + link.                                                                                                                                                     |
| B7  | [`06b-bicep-codegen.agent.md`](.github/agents/06b-bicep-codegen.agent.md)         | 529      | ~395        | ~135      | LOW–MED      | (a) §DO/DON'T overlap → Phase A1 (~30 lines). (b) §Workflow Phases (lines 305–512, ~208 lines): trim per-phase intro prose to ≤ 3 lines each and keep numbered procedural steps + commands intact. (c) §File Structure (lines 513–548) — short tree diagram + link to `azure-bicep-patterns/references/project-structure.md`.                                                                                                                                                                                                                                                                                                     |
| B8  | [`06t-terraform-codegen.agent.md`](.github/agents/06t-terraform-codegen.agent.md) | 529      | ~395        | ~135      | LOW–MED      | Symmetric with B7. (a) DO/DON'T overlap → A1. (b) §Workflow trim (lines 310–516). (c) §Project Structure & Patterns (lines 517–545) → `terraform-patterns/references/project-structure.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| B9  | [`07b-bicep-deploy.agent.md`](.github/agents/07b-bicep-deploy.agent.md)           | 495      | ~385        | ~110      | LOW–MED      | (a) §Pitfalls overlap → Phase A2 (~25 lines). (b) §Preflight Validation Workflow (lines 277–448, ~172 lines): the per-policy mapping table runs long — split per-policy detail into [`iac-common/references/preflight-policy-checks.md`](.github/skills/iac-common/references/preflight-policy-checks.md) (create) and keep an index table + 4-step procedure in the body. (c) §Azure CLI Token Validation (lines 270–276) is OK as-is.                                                                                                                                                                                           |
| B10 | [`07t-terraform-deploy.agent.md`](.github/agents/07t-terraform-deploy.agent.md)   | 487      | ~385        | ~105      | LOW–MED      | Symmetric with B9. (a) DO/Pitfalls overlap → A2. (b) §Deployment Workflow (lines 294–499, ~205 lines): per-phase blocks restate `iac-common` patterns. Compress similarly. (c) Keep `terraform plan` subagent invocation and HCP guardrail verbatim.                                                                                                                                                                                                                                                                                                                                                                              |
| B11 | [`08-as-built.agent.md`](.github/agents/08-as-built.agent.md)                     | 457      | ~350        | ~110      | LOW–MED      | (a) §Cost Estimation overlap → Phase A3 (~35 lines). (b) §Draw.io MCP-Driven Diagram Workflow (lines 176–192) — keep but link to `drawio/SKILL.md` for tool-by-tool details. (c) §Core Workflow (lines 256–321): de-duplicate the "Resource Query Commands" sub-section with §Resource Query Commands (lines 387–399) — they overlap.                                                                                                                                                                                                                                                                                             |
| B12 | [`e2e-orchestrator.agent.md`](.github/agents/e2e-orchestrator.agent.md)           | 417      | ~355        | ~65       | LOW          | (a) §Real-Run Enforcement (lines 201–238) — collapse the 6-item checklist to 4 + link to validator. (b) §Iteration Tracking + §Benchmark Collection (lines 374–408) — already mostly procedural; trim explanatory paragraphs that describe what the validator already checks. (c) §DO/DON'T (lines 433–449) — collapse to 6 rows.                                                                                                                                                                                                                                                                                                 |

Agents intentionally **not touched** (already at or under limit and
specialized):
[`09-diagnose.agent.md`](.github/agents/09-diagnose.agent.md) (255),
[`10-challenger.agent.md`](.github/agents/10-challenger.agent.md) (267),
[`11-context-optimizer.agent.md`](.github/agents/11-context-optimizer.agent.md) (304).

**Phase B total: ≈ 1,360 lines saved (after subtracting the
overlap already credited to Phase A; re-baselined vs. earlier
≈1,365 estimate).**

---

### Phase C — Verification & roll-out (sequential, depends on A + B)

C0. **Body-size signal (advisory, NOT a hard gate).**

- **Decision (Option B)**: do _not_ add a new 350-line hard-fail
  validator. The 350-line number in
  [`context-optimization.instructions.md`](.github/instructions/context-optimization.instructions.md)
  is a project preference without external grounding (see
  [Evidence](#evidence)); promoting it to CI hard fail would
  enshrine a number we cannot defend with a citation.
- **What to do instead**: add a one-line reporter script
  `tools/scripts/report-agent-body-sizes.mjs` that prints a table
  of `agent_id | body_lines | over_350` to stdout. Wire it into the
  PR description (Phase C6) and into `apex-recall` as a free-form
  "finding" — not into `validate:_node`. The existing 600-line hard
  fail in
  [`tools/scripts/_lib/paths.mjs`](tools/scripts/_lib/paths.mjs#L41)
  remains the only enforced body-size gate.
- If we want to lower the hard gate (e.g. 600 → 500) _after_
  Phase 4 lands, that becomes a separate, scoped change to
  `paths.mjs` with its own justification — outside this plan.

C1. **Per-agent baseline capture (before any edits).**

- Generate `tmp/phase4-baseline.json` with columns: `agent_id`,
  `total_lines`, `body_lines`, `over_350` (bool), `over_600` (bool),
  `hypothesis_target_body_lines` (from Phase B table).
- This is also the input to the C4 measurement so the line-count
  delta is visible alongside the token-count delta in the PR.

C2. **Edit-and-validate loop, one agent at a time.**

- Apply A1–A5 first as ordered commits (A4 last in the A group so
  its dependents in B can follow immediately). After every A and
  B commit, run, in this order:
  1. `npm run lint:md` — markdown lint
  2. `npm run lint:links` — link integrity for extracted refs
     (uses global `.markdown-link-check.json`; relative links
     inside `references/*.md` must resolve)
  3. `npm run validate:_node` — omnibus parallel suite which
     includes `validate:agents` (frontmatter + model + 600-line
     gate), `validate:orchestrator-handoff` (verbatim `/clear`
     line), `validate:review-ceiling`, `validate:artifacts`
     (artifact H2 contracts), `validate:agent-registry`,
     `validate:skills`, `validate:skill-checks`,
     `validate:instruction-checks`, `validate:no-hardcoded-counts`,
     `validate:iac-security-baseline`, `validate:model-consistency`,
     `validate:model-catalog`, and `lint:safe-shell`.
  4. `npm run lint:vendor-prompting` — catches vendor-prompting
     regressions specific to `.agent.md` files.
- Do **NOT** rely on `validate:artifact-templates` as a separate
  command (it is just an alias for `lint:artifact-templates` which
  runs the same `validate-artifacts.mjs` already covered by
  `validate:_node`).
- On A4 commit, also confirm the new instruction file's
  `applyTo: ".github/agents/*.agent.md"` glob does not
  accidentally match `_subagents/**` (manual `git ls-files` check).

C3. **(intentionally empty)** — the per-agent body-size budget
validator originally planned here has been demoted to an advisory
reporter (C0). Slot kept to preserve C1–C6 numbering used in
earlier review.

C4. **⭐ PRIMARY ACCEPTANCE GATE — token-cost measurement.**
This is the _only_ merge gate. Falsifiable, externally grounded.

- **Baseline file**: `agent-output/_baselines/multi-log-baseline.json`
  (recorded p50/p90 of `totals.avg_input_per_call` across the
  multi-log corpus).
- **Procedure**: follow [`log-profiling.md`](.github/skills/context-management/references/log-profiling.md):
  `tar -xzf .github/data/token-reduction-logs.tar.gz` to extract
  the corpus, then for each log
  `npm run profile:debug-log -- <log> --json > tmp/phase4-after/<id>.json`,
  then aggregate p50/p90/max with the same aggregator used to
  produce the baseline.
- **Acceptance gate** (hard, blocks merge):
  - p50 `avg_input_per_call` MUST drop by **≥5%** vs. the recorded
    baseline. (5% is the floor; 8–12% is the expected/target band
    attributable to body compression alone, supported by the cost
    arithmetic in [Evidence](#evidence). <5% → PR cannot merge.)
  - p90 MUST NOT regress by more than +2%.
  - No individual agent's body line count may **grow** vs. its
    Phase 0 `body_lines` (informational; checked via C0 reporter
    diff).
- **Recording**: write before/after p50, p90, max, sample count,
  and the per-agent body-line delta table to the PR description
  AND append to [`/memories/repo/log-profile-baselines.md`](/memories/repo/log-profile-baselines.md)
  as a "Phase 4" row.

C5. **Update Plan 01 ledger.**

- Append a "Phase 4" section to
  [`/memories/repo/codegen-model-mix-2026.md`](/memories/repo/codegen-model-mix-2026.md)
  with: branch name, PR link, the measured C4 outcome, rollback
  procedure (independent reverts for A1/A2/A3/A5 + B1–B12; **group
  revert required for A4**), validator coverage (the C2 list), and
  links to the new references/instruction files.

C6. **Open PR + handoff.**

- Mark the draft PR ready-for-review: `gh pr ready`.
- PR description must include: Phase 0 baseline SHA, the
  `tmp/phase4-baseline.json` before/after delta from the C0
  reporter, the **C4 measurement table** (p50/p90/max before+after
  with sample count) as the headline outcome, the A5 manual-diff
  checklist, and a checklist of every validator in C2 with
  green-status confirmation.
- Do **not** self-merge. Human reviewer (or 10-Challenger pass on
  the diff) gates the merge.

---

## Relevant files

**Agent files to compress (12)** — see per-agent rows in Phase B.

**New / expanded reference files (created during Phase A + B):**

- [`.github/instructions/agent-operating-frame.instructions.md`](.github/instructions/agent-operating-frame.instructions.md)
  — shared "Read SKILL.md once / use apex-recall for cached lookups /
  don't edit upstream artifacts" rules (Phase A4 target).
- [`.github/skills/iac-common/references/codegen-do-dont.md`](.github/skills/iac-common/references/codegen-do-dont.md)
  — shared DO/DON'T bullets between 06b + 06t (A1).
- [`.github/skills/iac-common/references/preflight-policy-checks.md`](.github/skills/iac-common/references/preflight-policy-checks.md)
  — per-policy preflight mapping pulled out of 07b/07t bodies (B9/B10).
- [`.github/skills/azure-defaults/references/cost-estimate-parent-contract.md`](.github/skills/azure-defaults/references/cost-estimate-parent-contract.md)
  — caller-side delegation rules for `cost-estimate-subagent` (A3).
- **B4 drawio refs (Option β — prefer extending existing files)**:
  extend [`drawio/references/style-reference.md`](.github/skills/drawio/references/style-reference.md)
  and [`drawio/references/validation-checklist.md`](.github/skills/drawio/references/validation-checklist.md)
  / [`creation-workflows.md`](.github/skills/drawio/references/creation-workflows.md)
  rather than authoring new `diagram-contract.md` + `style-guidance.md`.
  Fall back to new files only if the existing refs lack >50% of the
  extracted content. Document the deviation in the PR description.
- [`.github/skills/azure-adr/references/adr-template.md`](.github/skills/azure-adr/references/adr-template.md)
  — **ALREADY EXISTS**; B4(c) replaces in-body skeleton with a
  pointer rather than creating the file.
- [`.github/skills/azure-governance-discovery/references/discover-output.md`](.github/skills/azure-governance-discovery/references/discover-output.md)
  - [`resume-checks.md`](.github/skills/azure-governance-discovery/references/resume-checks.md)
    — extracted from 04g (B5).

**New reporter (Phase C0):**

- `tools/scripts/report-agent-body-sizes.mjs` — prints an advisory
  table of `agent_id | body_lines | over_350`. **NOT** wired into
  `validate:_node`. Used by the PR description and the C5 ledger
  update only. The 600-line hard fail in
  [`tools/scripts/_lib/paths.mjs`](tools/scripts/_lib/paths.mjs#L41)
  remains the only enforced body-size gate.

**Existing validators relied on (Phase C2):**

- `tools/scripts/validate_orchestrator_handoff.py` (Python — the
  validator is `.py`, not `.mjs`; substring-only check for the
  verbatim `/clear` line)
- `tools/scripts/validate-review-ceiling.mjs`
- `tools/scripts/validate-agents.mjs` (enforces 600-line
  `MAX_BODY_LINES` from `_lib/paths.mjs`)
- `tools/scripts/validate-iac-security-baseline.mjs`
- `tools/scripts/validate-artifacts.mjs` (the real validator; npm
  script names `validate:artifacts` and `lint:artifact-templates`
  both point here)
- `tools/scripts/validate-agent-registry.mjs`
- `tools/scripts/validate-skills.mjs`
- `tools/scripts/validate-skill-checks.mjs`
- `tools/scripts/validate-instruction-checks.mjs`
- `tools/scripts/validate-no-hardcoded-counts.mjs`
- `tools/scripts/safe-shell.mjs` (excludes BOTH skill `references/`
  and `templates/` by design — see Phase A extraction-checklist
  item 4)

---

## Verification

1. **Cross-link integrity** — every `[Read X](path/to/X)` in a
   trimmed agent body must resolve. Use `npm run lint:md` (already
   covers internal links via markdown-link-check) after each edit.
2. **Body size signal** —
   `node tools/scripts/report-agent-body-sizes.mjs` prints the
   per-agent table (advisory, not blocking). Existing
   `validate-agents.mjs` 600-line hard fail still enforced.
3. **No behavioral regression on smoke session** — re-run the
   `smoke-test` project end-to-end and diff `00-handoff.md` snapshots
   against `agent-output/_baselines/smoke-2026-05-17.json`. Any
   missing H2 in a generated artifact = a compression error.
4. **Validator suite** — `npm run validate:all` passes on every
   per-agent commit (Phase C2 list).
5. **⭐ Token-baseline drop (PRIMARY MERGE GATE)** — Phase C4 records
   the new `avg_input_per_call` p50/p90. Must show **≥5% drop** vs.
   the recorded baseline; target band 8–12%. Flag any agent whose
   body grew during the compression.

---

## Decisions

- **Goal shape**: outcome-based (Option B from May 2026 review). The
  merge gate is the C4 measured p50 drop, _not_ the per-agent line
  count. Line counts are signals, not contracts. Rationale: see
  [Evidence](#evidence) — the 350-line number has no external
  grounding; the cost arithmetic does.
- **Tier**: User selected aggressive Tier 1+2+3 (~30%). Plan delivers
  ~25–28% line reduction conservatively, projecting into the 8–12%
  token-cost reduction band. Final pass/fail decided by C4 measurement.
- **Workstream**: Slots in as Plan 01 — Phase 4 (Body Compression).
  Recorded by updating
  [`codegen-model-mix-2026.md`](/memories/repo/codegen-model-mix-2026.md).
  Naming consistent with prior phases (2a / 2b / 2c / 3).
- **Deliverable shape**: per-agent compression hypotheses with line
  signals + one external measurement gate.
- **Hard gates**: ONE — ≥5% p50 `avg_input_per_call` drop measured
  in C4. All other validator checks (`validate:_node`, `lint:md`,
  `lint:links`, `lint:vendor-prompting`) are pre-existing must-pass
  CI; they are not new gates added by this plan.
- **Out of scope**:
  - `_subagents/*.agent.md` (7 files) — excluded per user request.
  - Frontmatter changes (model, handoffs, tools, description) —
    body-only audit. Plan 01 Phase 3 already swapped the model mix.
  - Skill body text (`SKILL.md` files) — compression here is purely
    additive to skills (`references/*.md` get longer, not shorter).
  - 09-Diagnose, 10-Challenger, 11-Context-Optimizer — already at
    or under 350 body lines.
  - Gate enforcement language, verbatim `/clear` codeblocks, every
    `apex-recall …` and `discover.py …` invocation line — these are
    grep-locked by validators and must be preserved verbatim.
  - **Lowering `MAX_BODY_LINES` from 600**. Separate workstream if
    desired — needs its own justification beyond this plan.
  - **Adding a new 350-line hard-fail validator**. See C0 — demoted
    to advisory reporter because the 350-line number lacks external
    grounding.

---

## Further Considerations

1. **Phase B4 (04-Design ADR template extraction) — verified low
   risk against `validate-artifacts.mjs`.** The artifact validator
   reads its H2 contract from
   `.github/skills/azure-artifacts/templates/` and the skill's own
   `references/`, not from agent bodies. **Drift-audit (2026-05-17)
   confirmed `azure-adr/references/adr-template.md` already exists**;
   B4(c) therefore (a) verifies the existing file covers Status /
   Context / Decision / Consequences (and any missing section is
   _added to the existing file_, not a new file), (b) confirms the
   file is linked from `azure-adr/SKILL.md`'s Reference Index, and
   (c) replaces the in-body ADR section in 04-Design with a single
   "Read" pointer. For B4(a)(b), prefer extending existing
   `drawio/references/` files (Option β) over authoring new ones —
   see the B-row note. See Phase A extraction-checklist for
   canary-marker + SKILL.md index rules that still apply if a
   genuinely new reference file is needed.
2. **Phase A4 `applyTo` is narrowed** to `.github/agents/*.agent.md`
   (single-star, main agents only — see updated A4 above). This
   excludes `_subagents/` and any future nested agent directories.
3. **Optional fourth tier** — if the user wants to push below 350
   lines per agent on **every** agent (not just the over-limit ones),
   that requires splitting 04g, 05, and 06b/t into agent + per-phase
   reference modules. That is real refactoring work (changes the
   discovery story for those agents) and was _not_ asked for. Flag it
   as a separate workstream for later. Option A — leave as-is.
   Option B — schedule for Plan 01 Phase 5.
4. **What "success" looks like in the final PR description** (concrete):

   > Plan 01 — Phase 4: Body Compression
   >
   > **Outcome (merge gate)**: p50 `avg_input_per_call` dropped
   > from {baseline} to {new}, a **−X.X%** change.
   > p90 changed from {p90_base} to {p90_new} ({delta}%).
   > Sample size: {n} sessions from the multi-log baseline corpus.
   >
   > **Body-size signal (informational)**: aggregate body lines
   > {before} → {after} ({delta} lines). Per-agent table attached.
   > {N}/15 agents now under the 350-line guidance ({M}/15 before).
   >
   > **Validator status**: all green on every commit. See
   > `tmp/phase4-validation-log.json`.

5. **Open questions surfaced by adversarial review (decide if/when
   needed, not before merge):**
   - Should the repo-wide hard `MAX_BODY_LINES` be lowered from 600
     later? Separate workstream; this plan does not change it.
   - The exact 12 agents in B1–B12 are pinned to the stale audit;
     Phase 0 `tmp/phase4-baseline.json` is the authoritative source
     once generated.
   - Whether moved shell snippets should remain in scanned files
     instead of skill `references/` (currently: case-by-case per the
     Phase A checklist item 4).
