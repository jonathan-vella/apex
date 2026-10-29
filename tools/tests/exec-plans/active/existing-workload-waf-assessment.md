# Existing Workload Well-Architected Assessment

## Plan: Multi-Subscription Existing Workload WAF Assessment (IaC, Diagrams, Q&A, Live ARG)

**Status**: Implemented; automated validation passed, runtime limitations below
**Owner**: @jonathan-vella **Created**: 2026-10-29 **Decisions**:

- Implement via skill augmentation (`apex-azure-defaults/references/existing-workload-intake.md`) plus compact
  progressive-loading hooks in `02-Requirements`, `03-Architect`, and `04g-Governance` (no new `.agent.md`).
- Support multi-modal intake in `02-Requirements`: static IaC files (`.bicep`, `.bicepparam`, `.tf`, `.tfvars`,
  `azure.yaml`), architecture diagrams (`.png`, `.jpg`, `.svg`, `.drawio`, `.py`, `.md`), and optional read-only
  cross-subscription Azure Resource Graph (`az graph query --subscriptions`).
- Preserve `apex-recall` provenance and Step 2 remediation flexibility: store extracted facts in
  `01-discovered-evidence.json` (`provenance`, `confidence`), pre-fill defaults via `--evidence` in
  `requirements-discovery.mjs` for explicit user confirmation before writing `material_inputs`, and record discovered
  SKUs with `source: "observed-current"` and `observed_sku` (reserving `source: "user-pin"` for explicit user locks).
- Extend `sku-manifest.schema.json`, `validate-sku-manifest.mjs`, `cost-estimate.mjs`, and `render-sku-manifest-md.mjs`
  with optional root `subscriptions[]` and per-service/stamp `subscription` attribution alongside `stamps[]`.
- Extend `tools/apex-recall/src/apex_recall/practical.py` policy feasibility validation to support multi-subscription
  `subscription_ids: [...]` in `azure_read_scope.value`.
- Add a thin `.github/prompts/waf-assess-existing.prompt.md` entry shortcut targeting `agent: 01-Orchestrator`.

**Progress**:

- [x] P1 (`update-requirements-discovery`): Extend `tools/scripts/requirements-discovery.mjs` (`Assessment` scenario,
      migration trigger regex, `--evidence` default prefilling) and `tools/apex-recall/src/apex_recall/practical.py`
      (multi-subscription `subscription_ids` policy feasibility validation) + unit tests.
- [x] P2 (`extend-sku-manifest-subscriptions`): Add `observed-current` source, `observed_sku`, optional
      `subscriptions[]`, and `subscription` attribution to `tools/schemas/sku-manifest.schema.json`,
      `tools/scripts/validate-sku-manifest.mjs`, `tools/scripts/cost-estimate.mjs`,
      `tools/scripts/render-sku-manifest-md.mjs`, `.github/instructions/sku-manifest.instructions.md`, and tests.
- [x] P3 (`create-existing-workload-intake-skill-ref`): Create
      `.github/skills/apex-azure-defaults/references/existing-workload-intake.md` (with
      `<!-- ref:existing-workload-intake-v1 -->` canary marker, secret/property allowlist redaction, ARG
      pagination/completeness checks, and 5-pillar cross-subscription WAF matrix) and link in
      `.github/skills/apex-azure-defaults/SKILL.md`.
- [x] P4 (`augment-requirements-and-architect-agents`): Add compact hooks (<15 lines each) to
      `.github/agents/02-requirements.agent.md`, `.github/agents/03-architect.agent.md`, and
      `.github/agents/04g-governance.agent.md`, plus optional H3 subsections in `01-requirements.template.md` and
      `02-architecture-assessment.template.md`.
- [x] P5 (`create-waf-assess-prompt-shortcut`): Create `.github/prompts/waf-assess-existing.prompt.md` targeting
      `agent: 01-Orchestrator`.
- [x] P6 (`run-validation-suite`): Run unit tests and repository validation suite (`validate:agents`,
      `lint:skill-references`, `validate:skill-checks`, `validate:decision-keys`, `validate:artifacts`,
      `lint:safe-shell`, `lint:md`, `lint:json`).

### Execution evidence — 2026-10-29

- Integrated discovery, manifest, renderer, cost, prompt-discovery and review-presence tests: **126 passed**.
- Recall package suite, including multi-subscription feasibility and existing single-subscription behavior:
  **301 passed**. Frontmatter/vendor tests: **60 passed**; downstream SKU consumers: **8 passed**.
- Passed `validate:agents`, `lint:skill-references`, `validate:skill-checks`, `validate:decision-keys`,
  `lint:safe-shell`, `lint:json`, `lint:docs-freshness`, `validate:model-consistency`,
  `validate:explorer-graph`, focused ESLint and worker Ruff/format checks. Patch whitespace checks pass.
- Initial full Markdown lint found 46 MD032 list-spacing errors in `CHANGELOG.md`; fixed them with
  `markdownlint-cli2 --fix CHANGELOG.md`. Targeted changelog lint and final repository `npm run lint:md`
  both pass with zero findings. An initial fixture-directory race was resolved by cleaning worker temporary outputs.
- Direct `validate:artifacts` was not run: repository rules reserve agent-output artifact lint for the
  pre-commit hook/review owner. Verified the modified requirements/architecture templates preserve their
  canonical H2 sequences exactly. The normal upstream pre-commit hook subsequently passed template,
  heading-sync and artifact validation.
- Integration correction: the shared prompt scanner previously ignored all prompts. Enabled only native
  `.github/prompts`, kept archived/test roots excluded, tested frontmatter-target edges and regenerated
  `tools/registry/architecture-explorer-graph.json`. Updated the SKU template, service-menu wording,
  root contributor guidance, README and release notes to preserve consistent observed-vs-locked semantics.
- During initial source implementation, no Azure reads or writes, resource provisioning, dependency installs
  or commits were needed.
  Supplied subscriptions remain available for a separately scoped live smoke assessment; fixtures exercised
  the implementation without costs or changes to existing workloads.
- Published-doc follow-up in `jonathan-vella/apex-docs` (not available in this checkout): document
  `/waf-assess-existing`, `--evidence`, observed-current SKUs and the multi-subscription feasibility index.
  Native VS Code slash-command invocation and live ARG coverage have not been runtime-certified here.
- Assessment-gap follow-up: missing targets, controls, budgets and implementation preferences remain explicit
  unknowns rather than intake blockers. Assessment discovery skips implementation questionnaires; Gate 1
  approves assessment scope and requirements, not compliance, remediation or deployment.
- Upstream-based verification: focused JavaScript suites passed **112 tests**, practical recall passed
  **45 tests**, and agent/skill, JSON/schema, Markdown/JavaScript, question-batching, decision-key, Explorer,
  documentation-freshness and safe-shell checks passed. Normal pre-commit and pre-push hooks passed.
  Published source excludes live workload evidence and assessment state.

---

## 1. Architectural Overview

Today, APEX executes a Well-Architected Framework (WAF) assessment in **Step 2 (`03-Architect`)** after **Step 1
(`02-Requirements`)** captures requirements via a 6-phase interactive interview. To assess an **existing workload
spanning one or more Azure subscriptions** using **IaC**, **architecture diagrams**, and/or **live Azure Resource
Graph** alongside interactive gap-filling Q&A:

1. **Phase 0 Evidence Intake in `02-Requirements`**:
   - Reads supplied IaC (`.bicep`, `.bicepparam`, `.tf`, `.tfvars`, `azure.yaml`), views architecture diagrams
     (`.png`/`.jpg` via multimodal `view`, `.py` `sub()`/`mg()`/`rg()`/`vnet()` boundaries, `.md` Mermaid,
     `.drawio`/`.svg`), and optionally executes read-only cross-subscription
     `az graph query --subscriptions <id1> <id2>` with strict property allowlisting and secret/tag-value redaction.
   - Writes `agent-output/{project}/_meta/01-discovered-evidence.json` recording per-item `provenance`
     (`"iac" | "diagram" | "azure-arg"`), `confidence` (`"observed" | "inferred"`), and per-subscription
     access/completeness status (`"complete" | "partial"`).
   - Feeds `01-discovered-evidence.json` via `--evidence` into `tools/scripts/requirements-discovery.mjs` to present
     discovered facts for explicit user confirmation/adoption in Phase 1. Once confirmed by the user (establishing a
     valid `request_id` and `owner` response in `apex-recall`), confirmed fields are written to `answers` /
     `session.material_inputs` and skipped in subsequent `ask_user` batches—so the user is only asked for missing
     context (business drivers, pain points, SLA/RTO/RPO, compliance frameworks, budget, and unlabelled SKUs).
2. **Observed vs. Locked SKUs & Multi-Subscription Identity (`sku-manifest.json`)**:
   - Step 1 records discovered existing SKUs with `source: "observed-current"`, `source_step: "1"`, and
     `observed_sku: "<current-sku>"`. Unlike `source: "user-pin"` (which remains reserved for explicit user locks),
     `observed-current` entries can be updated by `03-Architect` at Step 2 (`size: "<recommended-sku>"`,
     `source: "architect-derived"`) while preserving `observed_sku` for **Current vs. Recommended** comparison.
   - Root `subscriptions[]` declares logical subscription IDs, display names, optional Azure subscription GUIDs
     (`subscription_id`), and landing-zone roles (`hub`, `spoke`, `shared`, `data`, `management`, `workload`). Services
     deployed to one subscription set `services[].subscription`; services deployed across multiple subscriptions use
     `stamps[]` with `stamps[].subscription`.
   - `tools/scripts/cost-estimate.mjs` (`expandManifestServices`) propagates effective `subscription`
     (`stamp?.subscription ?? service.subscription ?? null`) into each priced resource line item.
3. **Multi-Subscription Policy Feasibility (`practical.py` & `04g-Governance`)**:
   - `azure_read_scope.value` supports either a single `subscription_id` string or `subscription_ids: [...]` array.
   - `_feasibility_validation`, `bind_feasibility`, and `check_feasibility` in
     `tools/apex-recall/src/apex_recall/practical.py` verify every subscription in scope via
     `discover.py --validate-only` and block completion if any subscription snapshot is missing, stale, or failed.
4. **Brownfield & Cross-Subscription WAF Assessment in `03-Architect`**:
   - Evaluates all 5 WAF pillars against observed configuration plus cross-subscription patterns (hub-spoke peering
     across subscriptions, Private DNS zone linking, cross-subscription RBAC/identity boundaries, centralized vs.
     fragmented logging/Defender inheritance, and duplicate shared-service consolidation).
   - Compares `observed_sku` vs. recommended `size` under `## 📦 Resource SKU Recommendations`
     (`### Current vs. Recommended SKU Remediation`) and structures `## 🚀 Implementation Handoff` as a prioritized
     remediation roadmap.
   - At Gate 2, the user can select `approve_and_pause` to conclude with the standalone WAF assessment report or
     `approve_and_continue` to generate remediation IaC in Steps 3.5–5.

---

## 2. Work Breakdown & File Scope

| Step | ID                                          | Target Files                                                                                                                                                                                                                                                                                                         | Key Changes                                                                                                                                                                                                                                                     |
| ---- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1   | `update-requirements-discovery`             | `tools/scripts/requirements-discovery.mjs`, `tools/tests/scripts/test_requirements_discovery.mjs`, `tools/apex-recall/src/apex_recall/practical.py`, `tools/apex-recall/tests/test_practical.py`                                                                                                                     | Add `Assessment — evaluate an existing workload` scenario, extend migration regex with `assess\w*\|existing\|brownfield`, add `--evidence` default prefilling, and support `subscription_ids: [...]` in `practical.py` feasibility checks.                      |
| P2   | `extend-sku-manifest-subscriptions`         | `tools/schemas/sku-manifest.schema.json`, `tools/scripts/validate-sku-manifest.mjs`, `tools/scripts/cost-estimate.mjs`, `tools/scripts/render-sku-manifest-md.mjs`, `.github/instructions/sku-manifest.instructions.md`, `tools/tests/validate-sku-manifest.test.mjs`, `tools/tests/render-sku-manifest-md.test.mjs` | Add `observed-current` source, `observed_sku`, optional `subscriptions[]`, and `subscription` reference; validate uniqueness and stamp/service conflicts; propagate subscription in cost expansion; render `## Subscriptions`, `## Stamps`, and `Observed SKU`. |
| P3   | `create-existing-workload-intake-skill-ref` | `.github/skills/apex-azure-defaults/references/existing-workload-intake.md`, `.github/skills/apex-azure-defaults/SKILL.md`                                                                                                                                                                                           | Author intake procedure (IaC + diagrams + ARG with secret/property allowlist redaction and completeness gating) and 5-pillar cross-subscription WAF checklist; link in `SKILL.md` Reference Index.                                                              |
| P4   | `augment-requirements-and-architect-agents` | `.github/agents/02-requirements.agent.md`, `.github/agents/03-architect.agent.md`, `.github/agents/04g-governance.agent.md`, `.github/skills/apex-azure-artifacts/templates/01-requirements.template.md`, `.github/skills/apex-azure-artifacts/templates/02-architecture-assessment.template.md`                     | Add compact progressive-loading hooks (<15 lines per agent) and H2-compliant H3 template subsections (`### Subscription & Landing Zone Topology`, `### Discovered Evidence Provenance`, `### Current vs. Recommended SKU Remediation`).                         |
| P5   | `create-waf-assess-prompt-shortcut`         | `.github/prompts/waf-assess-existing.prompt.md`                                                                                                                                                                                                                                                                      | Create thin slash-command prompt targeting `agent: 01-Orchestrator` for existing-workload WAF assessments.                                                                                                                                                      |
| P6   | `run-validation-suite`                      | All modified files                                                                                                                                                                                                                                                                                                   | Run unit tests and `validate:agents`, `lint:skill-references`, `validate:skill-checks`, `validate:decision-keys`, `validate:artifacts`, `lint:safe-shell`, `lint:md`, `lint:json`.                                                                              |
