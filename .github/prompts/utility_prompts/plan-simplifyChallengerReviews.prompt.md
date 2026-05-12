# Plan: Simplify Challenger Reviews

**TL;DR** — Switch Step 4 (IaC Plan) default lens from `security-governance` → `comprehensive` (step-4 is already mandatory single-pass; this swaps the lens). Demote the three-lens rotation (security-governance / architecture-reliability / cost-feasibility) plus multi-pass routing to an **explicit opt-in deep review** for Step 2, Step 4, and Step 5. Step 2 keeps its separate cost audit (produced by the existing `cost-feasibility` lens of `challenger-review-subagent` — `cost-estimate-subagent` is **not** touched; see Phase 8). No validator offload. **Phases 7–12** close adjacent gaps: missing reviews at Steps 3 / 3.5, findings-JSON schema upgrades, project-scoped opt-in capture, artifact-hash caching, lessons-learned feedback loop, lens-definition consolidation, and validator-surface hygiene.

## Target end-state (Review column in AGENTS.md)

| Step                | New default                                                                                    | Opt-in upgrade                      |
| ------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1 Requirements      | 1× comprehensive (mandatory) — _unchanged (already comprehensive)_                             | —                                   |
| 2 Architecture      | **1× comprehensive (mandatory) + 1 cost audit (unified schema — see Phase 8)**                 | Multi-lens deep review              |
| 3 Design (when run) | none                                                                                           | **1× ADR review** ← _new (Phase 7)_ |
| 3.5 Governance      | **1× reconciliation review (mandatory when discovery yields ≥1 constraint)** ← _new (Phase 7)_ | —                                   |
| 4 IaC Plan          | **1× comprehensive (mandatory)** ← _lens swap: was `security-governance`_                      | Multi-lens deep review              |
| 5b/5t IaC Code      | none (opt-in default-skip — _unchanged_)                                                       | Multi-lens deep review              |
| 6 Deploy            | none — `## Policy precheck summary` folded into deployment artifact (informational, Phase 7)   | —                                   |
| 7 As-Built          | none                                                                                           | —                                   |

## Steps

1. **Phase 1 — Workflow-graph normalization** _(parallel with Phase 2)_.
   - **Lens swap.** In [.github/skills/workflow-engine/templates/workflow-graph.json](.github/skills/workflow-engine/templates/workflow-graph.json): change `step-4.challenger.default_lenses` from `["security-governance"]` → `["comprehensive"]`.
   - **Hard rename.** Rename per-step `complexity_matrix` → `opt_in_matrix` to make "never auto-fires by tier" explicit. Touchpoints in the same PR (full enumeration — no implicit grep required):
     - [.github/skills/workflow-engine/templates/workflow-graph.json](.github/skills/workflow-engine/templates/workflow-graph.json) (4 occurrences: step-2, step-4, step-5b, step-5t).
     - [tools/schemas/workflow-graph.schema.json](tools/schemas/workflow-graph.schema.json) (line 68): rename property and **drop the `required: ["simple","standard","complex"]` array** under it (opt-in matrix MAY contain a subset of tiers). Keep the `$ref: "#/$defs/challengerTier"` shape under each tier.
     - [.github/skills/workflow-engine/references/orchestrator-handoff-guide.md](.github/skills/workflow-engine/references/orchestrator-handoff-guide.md) (line 36).
     - [.github/skills/workflow-engine/references/orchestrator-handoff-guide.digest.md](.github/skills/workflow-engine/references/orchestrator-handoff-guide.digest.md) (line 33).
   - **New return edges (anti-livelock).** Add to `return_edges[]` in `workflow-graph.json`:
     - `{ from: "step-4", to: "step-2", condition: "on_architecture_must_fix" }` — escape hatch when a Step 4 comprehensive finding requires architecture-level resolution (closes the gate-3 `all-passes-APPROVED` livelock; see Phase 4 routing rule).
     - `{ from: "step-3_5", to: "step-2", condition: "on_must_fix_governance_conflict" }` — escape hatch when reconciliation finds an approved-architecture-vs-newly-discovered-constraint conflict (see Phase 7).
   - **Gate amendments.** `gate-2_5.preconditions` allow re-open when `governance_trace.reconciliation_status == "escalated_to_step-2"`. `gate-3.preconditions` allow re-open when any step-4 finding has `requires_step == "step-2"`.
   - **Lens-vocabulary update.** Add `governance-reconciliation` to `VALID_LENSES` in [tools/scripts/validate-workflow-graph.mjs](tools/scripts/validate-workflow-graph.mjs) (line 108) so Phase 7's step-3_5 reference passes validation in this same PR.

2. **Phase 2 — Comprehensive-lens checklists** _(parallel with Phase 1)_. In [.github/skills/azure-defaults/references/adversarial-checklists.md](.github/skills/azure-defaults/references/adversarial-checklists.md), enrich the `comprehensive` lens for `architecture` and `implementation-plan` artifact types by merging top items from the three per-lens lists so single-pass reviews preserve coverage. Keep per-lens checklists for opt-in deep review.
   - **Coverage bar.** Comprehensive checklist must cover **≥ 80% of per-lens must_fix line items** per artifact_type. Specifically retain (do not drop): cost-feasibility's RI / Savings-Plan math and `02-cost-estimate.json` baseline reconciliation; security-governance's private-endpoint subnet sizing + PE DNS-zone wiring; architecture-reliability's RTO/RPO arithmetic against backup-retention sizing.
   - **Evidence artifact.** Produce a snapshot-diff table at `docs/challenger-coverage-evidence.md` (per-lens line vs comprehensive entry, ✓/✗ per artifact_type). Phase 2 cannot close until this file is checked in (Verification #13).
   - **New checklist section.** Add `## Lens: governance-reconciliation` H2 under artifact_type `governance-constraints` with 5–10 patterns: constraint-vs-architecture drift, exemption gaps, scope mismatch (sub vs RG vs resource), Defender auto-assignments treated as in-scope, conflicting policy effects across MG inheritance, audit-vs-deny mismatch, missing parameter values, exempt scope leaks, region-restricted policies vs chosen region, identity-policy gaps (managed identity required vs custom role).

3. **Phase 3 — Protocol doc rewrite** _(depends on Phase 2)_. Rewrite [.github/skills/azure-defaults/references/adversarial-review-protocol.md](.github/skills/azure-defaults/references/adversarial-review-protocol.md): default flow becomes "1 pass, comprehensive, no early-exit logic"; current multi-pass + early-exit routing moves into a fenced `## Opt-in: Deep adversarial review` section; complexity tiers become recommendations, not auto-triggers. Fold and delete [.github/skills/azure-defaults/references/challenger-selection-rules.md](.github/skills/azure-defaults/references/challenger-selection-rules.md) (subject to Further Consideration #3).

4. **Phase 4 — Parent-agent text** _(depends on Phase 3)_. Replace bespoke routing prose with a single ~3-line invocation block in each agent:
   - [.github/agents/03-architect.agent.md](.github/agents/03-architect.agent.md) — strip the "complex → ask user → multi-pass" prose; replace with single-pass + opt-in pointer.
   - [.github/agents/05-iac-planner.agent.md](.github/agents/05-iac-planner.agent.md) — collapse "Phase 4.3–4.4 (2 lenses max)" into single Phase 4.3 with `review_focus = "comprehensive"`; move pass-2 prose to an opt-in subsection. Update L246, L322 cross-refs.
   - **Architecture-escalation rule (anti-livelock).** Add to 05-iac-planner Phase 4.3: "If any finding has `requires_step == \"step-2\"`, halt and return to Architect via the `step-4 → step-2` return_edge — do not mask or self-edit the plan. Max **2 attempts** per pass; after the second NEEDS_REVISION on the same finding, present the user with REVISE / OVERRIDE-WITH-RATIONALE / ABORT. OVERRIDE captures `decisions.accepted_risks[].finding_id` via apex-recall."
   - [.github/agents/06b-bicep-codegen.agent.md](.github/agents/06b-bicep-codegen.agent.md) + [.github/agents/06t-terraform-codegen.agent.md](.github/agents/06t-terraform-codegen.agent.md) — trim complexity-matrix routing; keep default-skip + single opt-in block.
   - [.github/agents/10-challenger.agent.md](.github/agents/10-challenger.agent.md) — default to comprehensive; keep multi-pass + batch mode as the opt-in entry point.
   - [.github/agents/\_subagents/challenger-review-subagent.agent.md](.github/agents/_subagents/challenger-review-subagent.agent.md) — confirm `comprehensive` is accepted for `implementation-plan` + `architecture` artifact types; add `governance-reconciliation` to the `review_focus` enum (line ~289).

5. **Phase 5 — Documentation alignment** _(parallel with Phase 4)_. Update the review column in [AGENTS.md](AGENTS.md), tighten the 1-line philosophy in [.github/copilot-instructions.md](.github/copilot-instructions.md), and add a **`refactor(agents)!:`** (breaking) entry to [CHANGELOG.md](CHANGELOG.md). The `!` flags the breaking schema-shape rename for in-repo consumers; commit body must enumerate: `complexity_matrix → opt_in_matrix` (workflow-graph.json + schema + handoff guides) and the new `requires_step`, `traces_to`, `suggested_fix`, `schema_version`, `artifact_hash` finding fields.

6. **Phase 6 — Validators + tests** _(depends on Phases 1, 3, 4; blocks Phase 8)_.
   - Update `validateChallenger()` in [tools/scripts/validate-workflow-graph.mjs](tools/scripts/validate-workflow-graph.mjs) (line ~123) to accept `opt_in_matrix` (drop the strict tier-required check; allow partial-tier objects).
   - Confirm `governance-reconciliation` is in `VALID_LENSES` (added in Phase 1).
   - Add a stub `tools/scripts/validate-challenger-findings.mjs` with an `npm run validate:challenger-findings` script entry (the validator body is filled in by Phase 8).
   - Update test fixtures and tests touching the old shape (explicit enumeration — no implicit grep required):
     - `tests/workflow-engine/` fixtures referencing `security-governance` as step-4 default or tier-driven multi-pass.
     - `tests/azure-defaults/`, `tests/azure-artifacts/` fixtures with the same shape.
     - [tools/tests/subagent-file-contract.test.mjs](tools/tests/subagent-file-contract.test.mjs) — assertions on `findings` shape (already uses `must_fix_count` etc., but `schema_version` and `requires_step` must be tolerated by the simulator).
     - [tools/tests/fixtures/subagent-file-contract/challenger-review.findings.json](tools/tests/fixtures/subagent-file-contract/challenger-review.findings.json) — add `schema_version: "1.0"` and any other new required fields to the fixture.
     - [tools/tests/fixtures/subagent-file-contract/challenger-review.summary.txt](tools/tests/fixtures/subagent-file-contract/challenger-review.summary.txt) — no shape change expected, but confirm the byte/line budgets still pass.
     - [tools/tests/bats/subagent-validation.bats](tools/tests/bats/subagent-validation.bats) — assertions accept the new `findings[]` schema.

7. **Phase 7 — Close workflow-gap reviews** _(parallel with Phase 4)_.
   - **Step 3 ADR opt-in review.** In [.github/agents/04-design.agent.md](.github/agents/04-design.agent.md), add a final phase that _offers_ a single-pass `comprehensive` review of each generated ADR. Skipped automatically when Step 3 is skipped (zero cost in the common path). Workflow-graph entry: `step-3.challenger = { default_passes: 0, opt_in: true, artifact_scope: "design-adr" }`.
   - **Step 3.5 reconciliation review.** Add a mandatory single-pass in [.github/agents/04g-governance.agent.md](.github/agents/04g-governance.agent.md): "Does the approved architecture still satisfy newly discovered constraints?" Uses the new `governance-reconciliation` lens (vocabulary added in Phase 1, checklist added in Phase 2, definition registered in Phase 11). Workflow-graph entry: `step-3_5.challenger = { default_passes: 1, default_lenses: ["governance-reconciliation"], skip_condition: "constraints.count == 0" }`.
   - **Reconciliation disposition rule (anti-ambiguity).** Add to 04g-governance.agent.md: "If any reconciliation finding is `must_fix` and references an approved architecture decision, do NOT self-edit `02-architecture-assessment.md`. Instead: (a) record the conflict via `apex-recall decide <project> --key governance_trace.reconciliation_status --value escalated_to_step-2`; (b) emit a typed handoff to `03-Architect` with the constraint citation and the must_fix finding ID; (c) follow the `step-3_5 → step-2` return_edge (added in Phase 1). Gate-2_5 stays closed until Architect re-approves and reconciliation re-runs APPROVED."
   - **Step 6 governance drift summary (informational).** [.github/agents/07b-bicep-deploy.agent.md](.github/agents/07b-bicep-deploy.agent.md) + [.github/agents/07t-terraform-deploy.agent.md](.github/agents/07t-terraform-deploy.agent.md) fold `policy-precheck-subagent` output into `06-deployment-summary.md` as a `## Policy precheck summary` section. Not adversarial — purely traceability for deploy-time drift.

8. **Phase 8 — Findings JSON schema upgrades** _(depends on Phase 4 AND Phase 6)_.
   - Add `schema_version: "1.0"` to every findings JSON document.
   - Fill in `tools/scripts/validate-challenger-findings.mjs` (stub created in Phase 6). Validator accepts both v1.0 and legacy shape via the compatibility table below.
   - Add `traces_to: string[]` per finding (upstream finding IDs). Parent agents pass prior sidecar paths to the subagent so it can deduplicate root causes already flagged upstream.
   - Add `suggested_fix: { artifact_path, line_range?, proposed_edit }` to `must_fix` items (optional on `should_fix`, `suggestion`). Makes REVISE/PROCEED a single click.
   - Add `requires_step: string` (optional) per finding — the lowest workflow-graph step ID required to resolve the finding. Used by Phase 4 routing (step-4 → step-2 return_edge) and Phase 7 reconciliation disposition.
   - **Cost audit clarification (no subagent change).** `cost-estimate-subagent` is **not** modified. It continues to emit the cost-breakdown JSON (`02-cost-estimate.json`) consumed by 03-Architect. The unified cost-audit findings shape is produced by the **existing** `cost-feasibility` lens of `challenger-review-subagent` (already routed at 03-architect.agent.md L289 for pass 3). Phase 8's only Architect-facing change is confirming that lens emits the v1.0 schema; no contract change at all to `cost-estimate-subagent` and no change to `tools/tests/fixtures/subagent-file-contract/cost-estimate.findings.json`.
   - Update [.github/agents/\_subagents/challenger-review-subagent.agent.md](.github/agents/_subagents/challenger-review-subagent.agent.md) output contract accordingly.
   - **Legacy sidecar handling (explicit migration path).** Existing sidecars under `agent-output/nordic-foods/challenge-findings-*.json` (9 files) use a different shape (`issues[]` + `title/description/failure_scenario/suggested_mitigation`) AND reference a non-existent `$schema` (`../schemas/challenge-findings-decisions.schema.json`). Resolution — **pick path A (one-time migration)**:
     - Add `tools/scripts/migrate-legacy-findings.mjs`. Field map: `issues→findings`, `title→claim`, `description→evidence`, `failure_scenario→impact`, `suggested_mitigation→suggested_fix.proposed_edit`. Removes the dangling `$schema` pointer; adds `schema_version: "1.0"`.
     - Runs once during the PR; committed sidecars conform to v1.0 thereafter.
     - `validate-challenger-findings.mjs` rejects any post-migration sidecar missing `schema_version`. CI green after the migration commit, not before.

9. **Phase 9 — Project-scoped opt-in + findings caching** _(depends on Phase 4)_.
   - **`decisions.review_depth`.** Single owner: [.github/agents/01-orchestrator.agent.md](.github/agents/01-orchestrator.agent.md) captures the value once at boot via `apex-recall decide <project> --key review_depth --value default|deep`. [.github/agents/02-requirements.agent.md](.github/agents/02-requirements.agent.md) **reads only**, never writes. Default value: `default`.
   - **Parent-agent read mechanism (every parent agent — survives resumed sessions).** Each parent agent below gains a `<context_awareness>` instruction: `Read decisions.review_depth via apex-recall show <project> --json before invoking the challenger; default to "default" if absent. "deep" enters the opt-in multi-pass path without re-prompting.`
     - [.github/agents/03-architect.agent.md](.github/agents/03-architect.agent.md)
     - [.github/agents/05-iac-planner.agent.md](.github/agents/05-iac-planner.agent.md)
     - [.github/agents/06b-bicep-codegen.agent.md](.github/agents/06b-bicep-codegen.agent.md)
     - [.github/agents/06t-terraform-codegen.agent.md](.github/agents/06t-terraform-codegen.agent.md)
     - [.github/agents/04-design.agent.md](.github/agents/04-design.agent.md) (for Step 3 ADR opt-in)
   - **Session-state validation.** Extend [tools/scripts/validate-session-state.mjs](tools/scripts/validate-session-state.mjs) to accept `decisions.review_depth ∈ {"default", "deep"}` (mirroring the existing `decisions.complexity` validator at line 131).
   - **Artifact-hash findings cache.** Subagent computes the cache key as `SHA-256(artifact_bytes ‖ "\n---\n" ‖ adversarial-checklists.md bytes ‖ "\n---\n" ‖ adversarial-review-protocol.md bytes ‖ "\n---\n" ‖ challenger-review-subagent.agent.md bytes ‖ "\n---\n" ‖ model_identifier_string)` and writes the components individually plus the combined `artifact_hash` into the findings JSON (`cache_inputs: { artifact_sha, checklists_sha, protocol_sha, subagent_sha, model }`). Cache hits require ALL component hashes to match — protects against stale findings when only the protocol doc, subagent prompt, or model rolls.
   - On retry / REVISE loop, parent agent compares current cache_inputs to cached cache_inputs; full match = reuse prior findings, skip subagent invocation. Any single component mismatch = re-invoke. Saves tokens during human-in-loop iteration when only downstream artifacts change.

10. **Phase 10 — Closed-loop quality (deferred-ready, can ship later)** _(independent workstream)_.
    - **Lessons → checklist reconciliation.** Add `tools/scripts/lessons-to-checklists.mjs` that scans all `09-lessons-learned.json` under `agent-output/*/`, diffs lessons against per-lens checklists in [.github/skills/azure-defaults/references/adversarial-checklists.md](.github/skills/azure-defaults/references/adversarial-checklists.md), emits a markdown report of "lessons our challengers missed". Human-reviewed; never auto-applied. Expose as `npm run report:challenger-gaps`.
    - **Effectiveness telemetry rollup.** Add `tools/scripts/challenger-telemetry.mjs` that walks all `challenge-findings-*.json` sidecars and rolls up: must_fix rate per pass, pass 2/3 finds vs pass 1 finds (deep-review projects only), artifact_type × must_fix counts. Output: `tools/registry/challenger-telemetry.json` + a periodic markdown report at `docs/challenger-effectiveness.md`. Informs future decisions on retiring lenses or passes.

11. **Phase 11 — Single source of truth for lens definitions** _(depends on Phase 3)_.
    - Move all lens definitions into a `## Lenses` map at the top of [.github/skills/azure-defaults/references/adversarial-review-protocol.md](.github/skills/azure-defaults/references/adversarial-review-protocol.md). Each entry: `{ name, applies_to: [artifact_types], description, checklist_anchor }`. Includes new `governance-reconciliation` lens from Phase 7.
    - Remove per-lens prose from agent files; agents reference the protocol map only.
    - **Lint host (explicit).** Add [tools/scripts/validate-lens-references.mjs](tools/scripts/validate-lens-references.mjs). Behavior:
      - Parses the `## Lenses` H2 block in `adversarial-review-protocol.md` into a `Set<string>` of registered lens names.
      - Scans `.github/agents/**/*.agent.md` for `review_focus:` / `lenses:` / `default_lenses:` tokens.
      - Scans `.github/skills/workflow-engine/templates/workflow-graph.json` for any `lenses[]` array.
      - Fails if any reference is not in the registered set.
      - Wired into `validate:all` and run by `npm run validate:lens-references`.

12. **Phase 12 — Validator surface hygiene** _(parallel with Phase 6)_.
    - **Document `CHALLENGER_DISPATCHER_ALLOWLIST`** in [tools/scripts/validate-agents.mjs](tools/scripts/validate-agents.mjs) with inline comments per entry explaining why each non-orchestrator agent is allowed to dispatch the challenger.
    - **Audit `ONE_SHOT_AGENT_NAMES` for batch mode.** If batch mode runs multiple lenses in one invocation, the "one-shot" semantic no longer fits cleanly. Decision: either (a) keep strict one-shot and require batch mode to chain N single-shot calls, or (b) extend the validator with a `multi-shot batch` exception. Document the chosen path in the validator's header comment.
    - **Measurable retirement trigger for `10-challenger.agent.md`.** Once the wrapper defaults to `comprehensive` and `challenger-selection-rules.md` is deleted, the wrapper does little beyond artifact-type lookup. **Trigger to revisit retirement decision** (whichever fires first): (a) `tools/registry/challenger-telemetry.json` records ≥ 20 invocations of `10-Challenger`, OR (b) 30 calendar days elapsed since this PR's merge date. Phase 12 closes by creating a tracking GitHub issue (`tracking: 10-Challenger retirement review`) with that trigger and a checkbox for each path. Capture the decision outcome in [tools/registry/agent-registry.json](tools/registry/agent-registry.json) when the issue closes.

## Verification

1. `npm run validate:workflow-graph` — new `opt_in_matrix` field passes; default lenses are `comprehensive`; `governance-reconciliation` accepted in `VALID_LENSES`.
2. `npm run validate:agents` + `npm run validate:agent-registry` — challenger + subagent still pass one-shot, handoff, vendor-prompting checks.
3. `npm run lint:md` — no broken cross-refs in `adversarial-*.md`, `orchestrator-handoff-guide.{md,digest.md}`, or `docs/challenger-coverage-evidence.md`.
4. Manual dry-run on a small project: confirm Step 4 now runs challenger automatically with comprehensive lens; Step 2 no longer auto-suggests multi-pass for "complex" — user must explicitly opt in.
5. Snapshot test in `tests/workflow-engine/` — assert mandatory-floor steps + default lens names; Step 3.5 reconciliation lens present; Step 3 ADR review opt-in entry present; `return_edges` include `step-4→step-2` and `step-3_5→step-2`.
6. Token-budget sanity: compare token counts in checkpoint logs for one representative project pre/post change.
7. `npm run validate:challenger-findings` (new) passes on the migrated `nordic-foods` sidecars; refuses any post-migration sidecar that omits `schema_version` or new required fields.
8. `npm run report:challenger-gaps` and `npm run challenger-telemetry` execute without errors on the current `agent-output/` corpus.
9. **Step 3.5 reconciliation gate**: dry-run a project with ≥1 discovered constraint → reconciliation review fires; dry-run a project with zero constraints → review is auto-skipped; dry-run that emits a `must_fix` follows the `step-3_5→step-2` return_edge and stops gate-2_5.
10. **Caching**: REVISE-PROCEED loop without artifact changes reuses sidecar findings (verified by absence of duplicate `apex-recall checkpoint` entries and matching `cache_inputs` component hashes). Mutating the subagent prompt, the protocol doc, the checklists, or the model id forces re-invocation (one targeted test per component).
11. **`decisions.review_depth = deep`**: dry-run confirms all parent agents auto-enter the opt-in path without re-prompting; same project resumed in a fresh chat session still enters the opt-in path (validates the read-on-each-agent-boot mechanism).
12. **Lens-map lint** (Phase 11): `npm run validate:lens-references` finds zero undefined-lens references across agents and workflow-graph.
13. **Coverage evidence** (Phase 2): `docs/challenger-coverage-evidence.md` exists and shows ≥ 80% per-lens-line coverage by the `comprehensive` lens for `architecture` and `implementation-plan` artifact types.
14. **Anti-livelock dry-run** (Phase 4): a synthetic step-4 finding with `requires_step: "step-2"` returns control to 03-Architect via the new return_edge; on second consecutive NEEDS_REVISION the user is presented REVISE / OVERRIDE / ABORT options; OVERRIDE writes `decisions.accepted_risks[].finding_id` to apex-recall.
15. **Legacy sidecar migration** (Phase 8): `tools/scripts/migrate-legacy-findings.mjs` converts the 9 `agent-output/nordic-foods/challenge-findings-*.json` files in one run; second run is a no-op; `npm run validate:challenger-findings` green post-migration.
16. **CHANGELOG marker** (Phase 5): committed entry is `refactor(agents)!:` (with `!`) and body lists every renamed field and every new finding-shape field.

## Decisions captured

- Mandatory floor: Steps 1, 2 (arch + cost), 3.5 (when constraints>0), 4. Step 5 stays opt-in default-skip.
- Default lens: single `comprehensive` across mandatory steps 1, 2, 4. Step 3.5 uses `governance-reconciliation`.
- Three-lens rotation + early-exit routing: kept, but only fires on explicit user opt-in (never auto-triggered by complexity tier).
- Validator offload: explicitly out of scope.
- Cost audit at Step 2: kept as a separate pass — produced by the **existing** `cost-feasibility` lens of `challenger-review-subagent`. `cost-estimate-subagent` is **not** modified; it remains the cost-BREAKDOWN emitter consumed by 03-Architect.
- **Schema cutover**: hard rename `complexity_matrix` → `opt_in_matrix` in a single PR — no alias, no deprecation window (single monorepo, no external consumers). Touchpoints fully enumerated in Phase 1 and Phase 6 (workflow-graph.json, workflow-graph.schema.json, validate-workflow-graph.mjs, orchestrator-handoff-guide.{md,digest.md}, subagent-file-contract test + fixtures, subagent-validation bats). All land in the same PR. Schema's `required: ["simple","standard","complex"]` array is **dropped** to reflect opt-in semantics.
- **CHANGELOG type**: `refactor(agents)!:` (breaking marker `!`) — the schema rename breaks any in-tree consumer of `complexity_matrix`.
- **10-Challenger standalone wrapper**: defaults to `comprehensive` to match the orchestrated path; multi-lens + batch mode remain the explicit opt-in entry point for deep reviews.
- **`challenger-selection-rules.md`**: deleted. Its routing tables are folded into the new `## Opt-in: Deep adversarial review` section of `adversarial-review-protocol.md`. All inbound references (CodeGen agents 06b/06t, any skill manifests) are repointed to the protocol doc in Phase 4.
- **Step 3 ADR review**: opt-in (Step 3 itself is optional). Zero cost when Step 3 is skipped.
- **Step 3.5 reconciliation review**: mandatory whenever governance discovery yields ≥1 constraint; auto-skipped when discovery returns zero. On `must_fix` against approved architecture, escalates via the `step-3_5 → step-2` return_edge (added in Phase 1) — 04g-Governance never self-edits `02-architecture-assessment.md`.
- **Step 4 anti-livelock**: gate-3 may re-open when a step-4 finding carries `requires_step: "step-2"`; control returns to 03-Architect via `step-4 → step-2` return_edge. Max **2 attempts** per pass before surfacing REVISE / OVERRIDE-WITH-RATIONALE / ABORT. OVERRIDE writes `decisions.accepted_risks[].finding_id` via apex-recall.
- **Step 6 deployment artifact**: gains a non-adversarial `## Policy precheck summary` section for drift traceability. Not a review.
- **Findings JSON `schema_version`**: introduced at `"1.0"`. Legacy sidecars are **migrated once** by `tools/scripts/migrate-legacy-findings.mjs` (Phase 8) — no soft deprecation path; the dangling `$schema` pointer is removed by the migration.
- **New finding fields**: `traces_to: string[]`, `suggested_fix: { artifact_path, line_range?, proposed_edit }`, `requires_step: string` (optional).
- **`decisions.review_depth`**: captured once per project by **01-Orchestrator only** (02-Requirements reads, never writes). Each parent agent reads it via `apex-recall show` at every invocation (survives resumed sessions). Default value: `default`. Validated by `validate-session-state.mjs`.
- **Artifact-hash caching**: `SHA-256(artifact ‖ checklists ‖ protocol ‖ subagent ‖ model_id)` with all component hashes stored individually; any single component mismatch invalidates the cache.
- **Lessons → checklist + effectiveness telemetry**: read-only reports; never auto-modify checklists.
- **Lens definitions**: live exclusively in `adversarial-review-protocol.md`; agents and workflow-graph reference, never redefine. `governance-reconciliation` is added to `VALID_LENSES` in `validate-workflow-graph.mjs` (Phase 1) and to `review_focus` in the subagent enum (Phase 4) in the same PR. Lint host: `tools/scripts/validate-lens-references.mjs` (Phase 11).
- **`CHALLENGER_DISPATCHER_ALLOWLIST` + `ONE_SHOT_AGENT_NAMES`**: documented in-line in `validate-agents.mjs`; batch-mode semantic explicitly resolved (Option a or b — to be selected during Phase 12).
- **10-Challenger wrapper retirement**: revisited when telemetry records ≥ 20 wrapper invocations OR 30 days post-merge (whichever first). Tracked via a GitHub issue created at Phase 12 close.

## Findings index

This revision incorporates all 15 findings from
[agent-output/\_meta/challenge-findings-plan-simplifyChallengerReviews.json](../../agent-output/_meta/challenge-findings-plan-simplifyChallengerReviews.json)
(pass 1, comprehensive — verdict NEEDS_REVISION). Mapping:

| Finding | Severity   | Resolved in                                                       |
| ------- | ---------- | ----------------------------------------------------------------- |
| F-001   | must_fix   | Phase 1 (touchpoint enumeration), Phase 6 (test fixtures)         |
| F-002   | must_fix   | Phase 8 (cost-estimate-subagent untouched)                        |
| F-003   | must_fix   | Phase 1 (return_edge 3_5→2), Phase 7 (disposition rule)           |
| F-004   | must_fix   | Phase 1 (return_edge 4→2), Phase 4 (routing + retry)              |
| F-005   | must_fix   | Phase 9 (5-component cache key)                                   |
| F-006   | must_fix   | Phase 8 (migrate-legacy-findings.mjs path A)                      |
| F-007   | must_fix   | Phase 1 (VALID_LENSES), Phase 2 (checklist), Phase 11 (lint host) |
| F-008   | should_fix | Phase 2 (≥80% coverage bar + evidence file)                       |
| F-009   | should_fix | Phase 4 (retry budget + accepted_risks)                           |
| F-010   | should_fix | Phase 9 (per-agent read mechanism + session-state validator)      |
| F-011   | should_fix | Phase 12 (measurable trigger + tracking issue)                    |
| F-012   | should_fix | Phase 6 (stub validator) + Phase 8 (depends-on Phase 6)           |
| F-013   | should_fix | Phase 5 (`refactor(agents)!:`)                                    |
| F-014   | suggestion | Target end-state table (Step 1 annotation) + TL;DR rewrite        |
| F-015   | suggestion | Phase 9 (01-Orchestrator sole writer)                             |
