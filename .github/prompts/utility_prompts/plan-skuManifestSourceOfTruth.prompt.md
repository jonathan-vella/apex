# Plan: SKU Manifest as Single Source of Truth (v2 — post-review)

## TL;DR

A single mutable `sku-manifest.json` + `sku-manifest.md` pair per project under `agent-output/{project}/` that models **creative SKU decisions** (App Service, VM, SQL, Cosmos, AKS pools, Redis, APIM, App Gateway, Storage replication) across **environments** (dev/test/prod) and **regions** (primary + failover). Step 1 captures user-pinned constraints only; Step 2 populates the bulk; Step 3.5/4 reconcile against governance; Step 6 blocks on region/quota conflict; Step 7 detects drift. Modeled on `04-governance-constraints.{json,md}` (paired JSON+MD, schema, validators). Revision boundaries are git commits / apex-recall checkpoints — `revisions[]` is metadata about commits, not a free-form changelog. Cost-estimate-subagent retains its `candidate_sets[]` mode so Architect can still price A-vs-B _before_ committing to a SKU.

## Lifecycle

| Step           | Agent             | Action                                                                                                                                                                                                                                                 | apex-recall status        |
| -------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | --- |
| 1 Requirements | `02-requirements` | Creates rev 1 with **user-pinned constraints only** (`source: user-pin`). Empty `services[]` is valid; common case is 0–3 pins                                                                                                                         | `draft`                   |
| 2 Architect    | `03-architect`    | Calls cost-estimate-subagent in `candidate_sets[]` mode to compare options, then writes rev 2 with `source: architect-derived` entries; cost-estimate writes back `cost_estimate_monthly_usd`; Architect computes `sla_achieved` from SKU+zonal+region | `reviewed`                |
| 3.5 Governance | `04g-governance`  | Emits findings if SKU violates discovered policy (read-only against manifest)                                                                                                                                                                          | —                         |
| 4 IaC Plan     | `05-iac-planner`  | Reconciles findings → rev 3; `04-implementation-plan.md` Resource Inventory rendered _from_ manifest; runs `feature-vs-sku` cross-check (`requires[]`)                                                                                                 | `locked`                  |
| 5 CodeGen      | `06b`/`06t`       | Reads JSON programmatically; every `services[].id` MUST map via `iac_logical_names.{bicep                                                                                                                                                              | terraform}` to a resource | —   |
| 6 Deploy       | `07b`/`07t`       | Pre-flight runs `azure-quotas` + region SKU availability per environment. On conflict → block + ask human via orchestrator. Resolution captured in `decisions.sku_overrides[]` (array, not dynamic keys) with explicit `sku_conflict_resolution` enum  | `deploying` → `deployed`  |
| 7 As-Built     | `08-as-built`     | Queries deployed SKUs; bidirectional diff (manifest↔actual); populates `services[].actual_sku` per env/region; emits drift findings                                                                                                                    | `drift` if mismatch       |

## Schema (v1 shape — frozen targets)

Top-level: `schema_version`, `project`, `default_region`, `created_at`, `updated_at`, `current_revision`, `environments[]`, `revisions[]`, `services[]`, `sku_allowlist_snapshot` _(optional, populated by governance reconciliation when normalized projection is available)_.

Per-service entry:

- `id` (unique within project), `service`, `size`
- `iac_logical_names: { bicep, terraform }`
- `capacity: { mode: 'fixed'|'autoscale', min, max, default }`
- `zonal: bool`, `regions: [primary, ...failover]` (inherits `default_region` if omitted)
- `environment_overrides: { dev?: {...}, test?: {...}, prod?: {...} }` — sparse map; only overrides the fields that differ
- `sla_target` (user/architect-required), `sla_achieved` (Architect-computed)
- `commitment: { type: 'on-demand'|'reserved-1yr'|'reserved-3yr'|'savings-plan', term_years? }`
- `requires: [string]` — feature dependencies (e.g., `"vnet-integration"`, `"private-endpoints"`) for cross-check at Step 4
- `notes`, `source: 'user-pin'|'architect-derived'|'deploy-substitute'`, `source_step`, `last_modified_rev`
- `cost_estimate_monthly_usd` _(populated by `cost-estimate-subagent`)_
- `actual_sku: { <env>: { <region>: '...' } }` _(populated by `08-as-built`)_

Per-revision entry: `rev`, `created_at`, `agent`, `step`, `commit_sha` _(populated by post-write hook)_, `apex_recall_checkpoint`, `summary`, `changed_ids: []`.

## Phases

### Phase A — Schema + templates

A1. `tools/schemas/sku-manifest.schema.json` (Draft 2020-12). Enforce `uniqueItems` semantics on `services[].id` via schema-level `uniqueItemProperties` pattern. Mark `commitment.term_years` required only when `type` matches `^reserved-`.
A2. `.github/skills/azure-artifacts/templates/sku-manifest.template.md` — H2 order: Overview, Environments, Services, Revision History, Open Substitutions.
A3. `.github/skills/azure-artifacts/templates/sku-manifest.template.json` — example with one user-pin + one architect-derived entry, multi-env override, one reserved-instance commitment.
A4. Extend `tools/schemas/session-state.schema.json` with: `sku_manifest_status` (enum), `sku_manifest_revision` (int), `sku_overrides` (array of `{ id, old_size, new_size, reason, region, env, resolution }`), `sku_conflict_resolution` (enum: `revert_to_plan | accept_substitute | change_region | abort`).

_(A1–A3 parallel; A4 depends on A1.)_

### Phase B — Workflow + agent wiring

B1. Update `workflow-graph.json`: add `sku-manifest.{json,md}` as Step 1 outputs with mutation edges from steps 2, 4, 6, 7. Validate with `validate:workflow-graph`.
B2. `.github/agents/02-requirements.agent.md`: add "SKU Manifest — User Pins Only" section. Explicit guidance: ask only about _hard constraints_ the user volunteers (region pins, tier requirements driven by compliance, reserved-instance commitments). **Do not exhaustively enumerate.** Empty `services[]` at rev 1 is the common case.
B3. `.github/agents/03-architect.agent.md`: full SKU authoring at Step 2. Workflow: (a) build `candidate_sets[]` of competing SKUs, (b) call `cost-estimate-subagent` in `candidate_sets` mode, (c) pick winners, (d) compute `sla_achieved` from SKU+zonal+region, (e) write rev 2 with `services[].source: architect-derived`. Keep the summary SKU table in `02-architecture-assessment.template.md` (auto-rendered from manifest) so single-pass review remains holistic.
B4. `.github/agents/_subagents/cost-estimate-subagent.agent.md`: **dual input mode** — accept either (a) `manifest_path` for per-service pricing, or (b) `candidate_sets[]` for A-vs-B comparison. Output adds `manifest_writeback[]` so Architect can patch `cost_estimate_monthly_usd` deterministically. Preserve existing `resource_list[]` for one release for back-compat.
B5. `.github/agents/04g-governance.agent.md`: emit findings against manifest entries. **Do not** ship a SKU-allowlist projection in v1 — note as `governance-discovery` follow-up issue. Reference M3.
B6. `.github/agents/05-iac-planner.agent.md`: reconcile findings → rev 3; run `requires[]` feature-vs-SKU cross-check at this step; Resource Inventory rendered from manifest.
B7. `.github/agents/06b-bicep-codegen.agent.md` + `06t-terraform-codegen.agent.md`: read `sku-manifest.json` programmatically; resolve resources via `iac_logical_names.{bicep|terraform}` (the dialect-aware mapping fixes m3); per-env via `environment_overrides`.
B8. `.github/agents/07b-bicep-deploy.agent.md` + `07t-terraform-deploy.agent.md`: pre-flight quota/region per env/region. **Block-with-escalation pattern**: after N orchestrator round-trips with no acceptable substitute, surface `sku_conflict_resolution: abort` as an explicit option (no silent deadlock — fixes M4). On resolution, append to `decisions.sku_overrides[]` (array — fixes M7) and write a new revision.
B9. `.github/agents/08-as-built.agent.md`: bidirectional diff (manifest↔Azure↔IaC code — fixes X3). Per env+region cells in `actual_sku`. Set `sku_manifest_status: drift` if mismatch.
B10. `infra/bicep/AGENTS.md` + `infra/terraform/AGENTS.md`: add "Read `sku-manifest.json` first; never re-derive SKUs from prose" rule (fixes m8).

_(B1 first; B2–B10 parallel after; verify after each.)_

### Phase C — Validators + CI

C1. `tools/scripts/validate-sku-manifest.mjs` → `validate:sku-manifest`. Schema validation only. Warn-only for 30 days, then hard-fail. **Switch date encoded as a constant in the validator** (e.g., `HARD_FAIL_AFTER = '2026-06-11'`) so there's a tracker (fixes m5).
C2. `tools/scripts/validate-sku-iac-coverage.mjs` → `validate:sku-iac-coverage`. Scope: **explicit SKU literals only** in `infra/**` (`sku: { name: '...' }`, `sku_name = "..."`). AVM-default resolution is a documented follow-up issue, not in v1 (fixes M2). Bidirectional check: manifest entries with no IaC match _and_ IaC SKU literals with no manifest match both reported (fixes X3). Diff-aware in pre-push: only re-validates manifests whose JSON or matching `infra/` tree changed (fixes m4). Skip-with-warning for projects predating the manifest for 30 days.
C3. **Defer governance cross-check from CI in v1.** `05-iac-planner` performs the check inline at Step 4 using whatever `04-governance-constraints.json` provides (best-effort, documented limits). A follow-up issue tracks "governance-discovery emits normalized SKU allowlist projection," after which a CI validator can be added (fixes M3).
C4. `package.json` — register `validate:sku-manifest` + `validate:sku-iac-coverage` in `validate:all`.
C5. `lefthook.yml` — pre-push entry, diff-scoped to changed `agent-output/**/sku-manifest.json` or matching `infra/**` files.
C6. **Commit-boundary hook**: extend the existing apex-recall checkpoint pattern. When an agent writes a new revision, the writer (or a thin wrapper script) emits an `apex-recall checkpoint` and stamps `revisions[].apex_recall_checkpoint` and (post-commit) `revisions[].commit_sha` (fixes M1).

_(C1 first; C2 next; C4–C6 parallel; C3 is doc-only in v1.)_

### Phase D — Docs + cross-references

D1. `AGENTS.md` Agent Workflow table: note `sku-manifest.{json,md}` as Step 1 output, mutated through Step 7.
D2. `.github/copilot-instructions.md` Azure Defaults block: one-line pointer to the manifest as SKU source of truth.
D3. `.github/instructions/azure-artifacts.instructions.md`: apply template-compliance rules to the new artifact.
D4. New `.github/instructions/sku-manifest.instructions.md` with `applyTo: **/sku-manifest.{md,json}` — enforces schema, revision-history rules, **explicit exclude list** (bandwidth, Log Analytics, vnet, subnet, NSG, route table, public IP, diagnostics).
D5. Site doc page under `site/src/content/docs/concepts/` explaining the lifecycle, multi-env semantics, and the user-pin vs architect-derived distinction.
D6. Open follow-up GitHub issues for: (a) AVM-default SKU resolution in coverage validator, (b) governance-discovery normalized SKU allowlist projection, (c) post-30-day hard-fail flip.

_(All D in parallel after B/C land.)_

## Relevant files

- `tools/schemas/governance-constraints.schema.json` — pattern model.
- `tools/schemas/sku-manifest.schema.json` _(new)_.
- `tools/schemas/session-state.schema.json` — add new decision keys.
- `.github/skills/azure-artifacts/templates/sku-manifest.template.{md,json}` _(new)_.
- `.github/skills/azure-artifacts/templates/02-architecture-assessment.template.md` — keep summary SKU table, sourced from manifest (do not strip — fixes M6).
- `.github/skills/azure-artifacts/templates/04-implementation-plan.template.md` — Resource Inventory from manifest.
- `.github/skills/azure-artifacts/templates/07-resource-inventory.template.md` — add `actual_sku` per env/region.
- **Do not modify** `03-des-sku-comparison.md` semantics — remains a trade-off matrix (fixes M5).
- `.github/skills/workflow-engine/templates/workflow-graph.json` — manifest as Step 1 output + mutation edges.
- `.github/agents/02-requirements.agent.md` — user-pin authoring only.
- `.github/agents/03-architect.agent.md` — full Step 2 manifest authoring + `sla_achieved` computation.
- `.github/agents/_subagents/cost-estimate-subagent.agent.md` — dual input mode (`manifest_path` + `candidate_sets[]`) + `manifest_writeback[]`.
- `.github/agents/04g-governance.agent.md` — findings against manifest.
- `.github/agents/05-iac-planner.agent.md` — reconcile + feature-vs-SKU cross-check.
- `.github/agents/06b-bicep-codegen.agent.md` + `06t-terraform-codegen.agent.md` — programmatic read; dialect-aware `iac_logical_names`.
- `.github/agents/07b-bicep-deploy.agent.md` + `07t-terraform-deploy.agent.md` — block-with-escalation pattern.
- `.github/agents/08-as-built.agent.md` — bidirectional drift detection.
- `infra/bicep/AGENTS.md` + `infra/terraform/AGENTS.md` — "read manifest first" rule.
- `tools/scripts/validate-sku-manifest.mjs` _(new)_, `validate-sku-iac-coverage.mjs` _(new)_.
- `package.json` — register validators in `validate:all`.
- `lefthook.yml` — diff-scoped pre-push entry.
- `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/sku-manifest.instructions.md` _(new)_, `site/src/content/docs/concepts/how-it-works/` _(new page)_.

## Verification

1. `npm run validate:agents` and `validate:workflow-graph` green after edits.
2. Schema fixture tests under `tests/azure-artifacts/sku-manifest/{valid,invalid}/*.json` — including: multi-env override, autoscale capacity, reserved-instance commitment, duplicate `id` (must fail), missing `commitment.term_years` for `reserved-1yr` (must fail), `requires[]` referencing unsupported feature (must fail at Step 4 cross-check).
3. Coverage validator: positive (manifest+Bicep+Terraform aligned) + negative (missing manifest entry) + negative (orphan IaC SKU literal) + skip-with-warning (project pre-dating manifest).
4. Bidirectional drift simulation: alter `actual_sku` in As-Built fixture; assert `sku_manifest_status: drift` is set and finding is emitted.
5. End-to-end dry run on a small existing project: Architect → cost-estimate `candidate_sets[]` → manifest rev 2 → Planner Resource Inventory rendered. Confirm Architect's `cost_estimate_monthly_usd` writeback lands correctly.
6. Block-with-escalation simulation at Step 6: a quota-blocked SKU with no acceptable substitute reaches `sku_conflict_resolution: abort` cleanly (no deadlock).
7. Commit-boundary check: write a manifest revision via test harness; assert `revisions[].commit_sha` populated post-commit.
8. `npm run validate:all` + `npm run lint:md` clean.

## Decisions captured (from review responses)

| Topic                         | v1 Decision                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Step 1 role                   | **User pins only** (`source: user-pin`); empty `services[]` valid                                |
| Manifest shape                | Single mutable file + `revisions[]` with `commit_sha` + `apex_recall_checkpoint`                 |
| Scope                         | Creative SKUs only; explicit exclude list in instructions file                                   |
| Multi-env                     | First-class via `environment_overrides` sparse map                                               |
| Multi-region                  | First-class via `regions[]` (primary + failover); inherits `default_region`                      |
| Capacity                      | `{ mode, min, max, default }` — autoscale-aware (no bare `instances`)                            |
| SLA                           | `sla_target` user/architect-set; `sla_achieved` Architect-computed                               |
| Commitments                   | `commitment` field models on-demand vs RI vs savings plan                                        |
| Feature gating                | `requires[]` cross-checked at Step 4 by Planner                                                  |
| Deploy conflict               | Block + ask human; escalation enum prevents deadlock; `sku_overrides[]` array (not dynamic keys) |
| Architecture assessment table | **Kept** as summary auto-rendered from manifest (preserves single-pass review)                   |
| `03-des-sku-comparison.md`    | **Unchanged** — remains trade-off matrix                                                         |
| Cost-estimate contract        | Dual mode: `manifest_path` + `candidate_sets[]`; writeback `cost_estimate_monthly_usd`           |
| Coverage validator scope      | Explicit SKU literals only in v1; AVM defaults = follow-up                                       |
| Governance cross-check        | Planner-inline in v1; CI validator deferred until normalized allowlist exists                    |
| Rollout deadline              | Hardcoded `HARD_FAIL_AFTER` constant in each validator                                           |
| Test fixture location         | `tests/azure-artifacts/sku-manifest/` (matches artifact-type convention)                         |
| Investigated, no overlap      | `tools/registry/count-manifest.json` tracks entity counts, not Azure resources                   |

## Out of scope (explicit non-goals for v1)

- Staleness / TTL of manifest contents
- Pricing freshness (>30-day Retail Prices snapshot warnings)
- AVM-default SKU resolution in coverage validator
- CI-level governance allowlist cross-check
- Multi-stamp / multi-deployment manifests (one manifest per project)
