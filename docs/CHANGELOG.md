<a id="top"></a>

# Changelog

All notable changes to **Agentic InfraOps** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] — Unreleased

### Added

- feat(skills): add `workflow-engine` skill with machine-readable DAG (`workflow-graph.json`)
  for graph-based step routing in the Conductor, replacing hardcoded step logic.
- feat(skills): add `context-shredding` skill with 3-tier runtime compression
  (`full`/`summarized`/`minimal`) and per-artifact compression templates.
- feat(session-resume): upgrade session state schema from v1.0 → v2.0 with atomic claim-based
  lock model (`lock.owner_id`, `lock.heartbeat`, `lock.attempt_token`), per-step `claim` objects,
  `stale_threshold_ms`, and `event_log` audit trail. Backwards-compatible with v1.0 files.
- feat(skills): add circuit breaker pattern to `iac-common` skill with failure taxonomy
  (6 categories), anomaly detection thresholds, and mandatory stopping rules for deploy agents.
- feat(skills): add Smart PR Flow to `github-operations` skill with label-based lifecycle
  tracking, auto-label rules, and deploy agent watchdog integration.
- feat(config): add `.github/agent-registry.json` — machine-readable registry mapping agent
  roles to definition files, default models, and required skills.
- feat(config): add `.github/skill-affinity.json` — skill/agent affinity catalog with
  `primary`/`secondary`/`never` weights for context budget optimization.
- feat(scripts): add 5 new validators: `validate-session-lock`, `validate-workflow-graph`,
  `validate-agent-registry`, `validate-skill-affinity`;
  validator count 22 → 25.
- feat(hooks): add `pre-push` hook to `lefthook.yml` with diff-based domain routing;
  only runs validators for changed file types, in parallel.
- feat(scripts): add `diff-based-push-check.sh` helper for pre-push hook domain detection.
- feat(skills): add `terraform-test` skill with run blocks, mock providers (TF 1.7+),
  assertions, CI/CD patterns, and Azure examples (`azurerm_resource_group`,
  `azurerm_virtual_network`, `azurerm_key_vault`).
- feat(skills): add `terraform-search-import` skill with manual discovery workflow,
  20-row ARM↔Terraform mapping table, and bulk import script.
- feat(skills): extend `terraform-patterns` with 2 new references:
  `avm-authoring-requirements.md` (37 AVM certification checks) and
  `refactor-module.md` (monolith-to-module extraction with state migration).
- feat(skills): add `count-registry` skill for agent runtime entity count lookups
  from `count-manifest.json`.
- feat(config): add `.github/count-manifest.json` as single source of truth for entity
  counts (agents, skills, instructions, validators).
- feat(instructions): add `no-hardcoded-counts.instructions.md` to prevent hard-coded
  entity counts across all markdown, JSON, and script files.
- feat(scripts): add `validate-no-hardcoded-counts.mjs` validator.
- feat(agents): add RALPH-style E2E autonomous workflow conductor
  (`e2e-conductor.agent.md`) with pre-validation after every subagent return,
  auto-challenge (1 pass per step), self-correction, benchmark collection, and
  lesson capture — no human gates.
- feat(e2e): add Terraform support to Ralph Loop E2E testing — prompt parameterization
  with IaC tool routing, e2e-conductor dual-track (Bicep + Terraform subagents),
  Terraform validators in `validate-e2e-step.mjs` (`terraform validate`, `terraform fmt -check`),
  and Terraform scoring in `benchmark-e2e.mjs` (`scoreCodeQuality()` with AVM-TF detection).
- feat(e2e): add `e2e:validate` and `e2e:benchmark` npm scripts for E2E testing.
- feat(e2e): register `e2e-conductor` in `agent-registry.json`.
- feat(e2e): add `e2e-validation.yml` CI workflow (manual dispatch + weekly schedule)
  with benchmark report upload. Add structural E2E validation step to `lint.yml`.
- feat(e2e): add configurable benchmark threshold via `E2E_PASS_THRESHOLD` env var.
- feat(e2e): add multi-project benchmark comparison (`--compare` flag) with auto-discovery.
- docs(e2e): add dedicated E2E testing documentation (`docs/e2e-testing.md`) with
  IaC track matrix, benchmark dimensions, and troubleshooting guide.
- docs(e2e): add Ralph Loop, E2E Benchmark, E2E Conductor to glossary.
- docs(e2e): add E2E testing guidance to `AGENTS.md` and `CONTRIBUTING.md`.
- feat(e2e): add E2E evaluation scripts: `benchmark-e2e.mjs` (8-dimension scoring engine
  with complexity-normalized baselines) and `validate-e2e-step.mjs` (per-step validator
  orchestrator composing existing lint/validate commands).
- feat(e2e): add E2E prompts: `e2e-ralph-loop.prompt.md` (RALPH-style 8-phase loop driver),
  `e2e-analyze-lessons.prompt.md` (post-loop lessons analysis), and
  `e2e-contoso-rfp.prompt.md` (full 7-step loop for Contoso Service Hub).
- feat(e2e): complete `e2e-ralph-loop` (Nordic Fresh Foods Lite) end-to-end — all 7 steps
  with design diagrams, ADR, governance constraints, deployment summary, as-built
  documentation suite (7 docs), Bicep templates (main + 6 modules), benchmark score 88/100,
  and lessons-learned artifacts.
- feat(e2e): bootstrap Contoso Service Hub RFP loop (`contoso-service-hub-run-1`) with
  session state, handoff, and benchmark scaffolding.
- feat(docs): add interactive D3 architecture explorer (`docs/architecture-explorer.html`) —
  self-contained HTML visualization of the full system topology (agents, subagents, skills,
  instructions, validators, workflow gates, MCP servers, prompts, CI workflows) with
  force-directed layout, search, filtering, and view presets.

### Changed

- refactor(conductor): replace hardcoded step table with graph-based routing via
  `workflow-graph.json` and agent registry lookups.
- refactor(conductor): add circuit breaker principle — halt on `blocked` step status.
- refactor(agents): add `context-shredding` skill reference to Architect, Bicep CodeGen,
  Terraform CodeGen, and As-Built agents for runtime context compression.
- refactor(agents): add `iac-common/references/circuit-breaker.md` and Smart PR Flow
  references to Bicep Deploy and Terraform Deploy agents.
- refactor(instructions): add runtime compression and skill affinity sections to
  `context-optimization.instructions.md`.
- refactor(agents,skills): agent system consistency pass across all agent files —
  standardize model field to array format, rename 8-step workflow references to
  multi-step, add Fast Path and Governance entries to `skill-affinity.json`,
  add `session-resume` to design/deploy agents in `agent-registry.json`.
- refactor(agents): enhance `10-Challenger` with multi-pass routing via
  `challenger-review-batch-subagent`, lens rotation table
  (security-governance, architecture-reliability, cost-feasibility), and
  pass-number routing (single → subagent, multi → batch).
- refactor(agents): Conductor gate naming (Gates 1–5 + Gate 2.5 Governance)
  and Switch to Fast Path handoff for simple projects.
- refactor(skills): context optimization of 7 skills — extract verbose content to
  reference files, reducing SKILL.md sizes by 40–70%: `azure-cost-optimization`,
  `azure-quotas`, `context-optimizer`, `github-operations`, `azure-adr`,
  `azure-kusto`, `make-skill-template`.
- refactor(agents,scripts,instructions): consolidate instructions (#255) — merge
  bicep/terraform policy compliance into `iac-policy-compliance.instructions.md`,
  merge code-commenting + code-review into `code-quality.instructions.md`, move
  workload-documentation and cost-estimate to skill references.
- refactor(scripts): merge 6 validators into 3: agent-body-size + agent-language →
  `lint-agent-checks`, skill-size + skill-digests → `validate-skill-checks`,
  instruction-frontmatter + instruction-references → `validate-instruction-checks`.
- refactor(scripts): extract shared `_lib/h2-parser.mjs` utility; add `getBody()` export
  to `parse-frontmatter.mjs`; reformat `workspace-index.mjs` for readability.
- refactor(skills): merge `terraform-patterns` style-guide delta into
  `tf-best-practices-examples.md` (code formatting, version control, code review sections).
- refactor(e2e): parameterize E2E scripts for multi-project support — `benchmark-e2e.mjs`
  accepts project name via argv, `validate-e2e-step.mjs` accepts `--project=name` flag.
- refactor(docs,scripts): update D3 explorer and reformat digest generator.
- docs: replace 105 hard-coded entity counts across 45+ files with descriptive language;
  resolve '7-step' vs '8-step' workflow conflict (all refs now say 'multi-step').

### Fixed

- fix(session-state): accept both schema_version `"1.0"` and `"2.0"` in validator
  for backwards compatibility.
- fix(skills): remove 19 duplicate nested skill directories introduced by Azure
  skills plugin integration — each had a redundant self-named subdirectory shadowing
  the canonical content at the parent level.
- fix(agents,skills): resolve tech debt #10, #15, #16 — convert multi-line agents
  frontmatter to inline arrays (8 agents), add Reference Index sections to 19 skills,
  add canary markers to 76 reference files.
- fix(agents,skills): resolve 26 artifact template drift warnings — add collapsible ToC,
  traffic-light indicators, Mermaid diagrams, details blocks; fix H2→H3 demotions;
  add attribution header to deployment-summary template.
- fix(prompts): correct frontmatter key from `mode` to `agent` in e2e-ralph-loop prompt.
- fix(skills): fix trailing spaces and blank lines in SKILL.minimal.md and
  SKILL.digest.md files.

## [0.9.0.1] — 2026-03-15

### Added

- feat(skills): integrate 22 skills from Azure Skills Plugin (`microsoft/azure-skills`):
  `appinsights-instrumentation`, `azure-ai`, `azure-aigateway`, `azure-cloud-migrate`,
  `azure-compliance`, `azure-compute`, `azure-cost-optimization`, `azure-deploy`,
  `azure-diagnostics`, `azure-hosted-copilot-sdk`, `azure-kusto`, `azure-messaging`,
  `azure-prepare`, `azure-quotas`, `azure-rbac`, `azure-resource-lookup`,
  `azure-resource-visualizer`, `azure-storage`, `azure-validate`,
  `copilot-customization`, `entra-app-registration`, `microsoft-foundry`.
- feat(skills): add SKILL.digest.md and SKILL.minimal.md variants for all new skills.
- feat(agents): implement cross-agent decision logging (#250) — add `decision_log[]` field
  to session state schema, `decision-logging.instructions.md`, and propagate to 6 agents
  (Requirements, Architect, Bicep/Terraform Planners, Bicep/Terraform CodeGen) plus
  challenger-review-subagent.
- feat(instructions): add `model-prompt-alignment.instructions.md` — auto-applies to
  `*.agent.md` and `*.prompt.md` with model-specific prompt engineering patterns for
  Claude (selective XML blocks, reasoning_effort, language calibration) and GPT
  (structured markdown, tool-call-first phrasing), plus cross-model rules for handoff
  overrides, prompt-agent model sync, and few-shot guidance.
- feat(scripts): add `lint-model-alignment.mjs` validator with 5 checks: prompt↔agent
  model sync, redundant handoff model overrides, Claude reasoning_effort comments,
  large-agent context_awareness, and investigate block presence; registered in
  `validate:_node` suite and `lefthook.yml` pre-commit hook.
- feat(scripts): add `generate-skill-digests.mjs` for automated digest generation.
- feat(docs): add Azure Skills Plugin migration documentation.

### Changed

- refactor(agents): align 8 Claude Opus/Sonnet agent definitions with Anthropic prompting
  best practices — add selective XML blocks (`investigate_before_answering` to 5 agents,
  `output_contract` to 5, `context_awareness` to 3, `subagent_budget` to Conductor,
  `scope_fencing` to 3, `empty_result_recovery` to Diagnose + 2 subagents), add
  `reasoning_effort` comments to 8 agents, add few-shot examples to Conductor/Architect/Planners.
- refactor(agents): align 6 Claude Sonnet 4.6/GPT-5.3-Codex agent definitions with OpenAI prompting
  best practices — add structured `<output_contract>` blocks, tool-call-first phrasing,
  and explicit phase-numbered workflows.
- refactor(agents): conservative language softening across 8 agents — reduce duplicate
  absolute language (`MANDATORY`, `NEVER`, `CRITICAL`) by ~30% while preserving constraint
  emphasis at security baseline, approval gates, and governance compliance.
- refactor(prompts): enhance 14 prompt files — fix 5 model mismatches (Claude/Sonnet→Claude Sonnet 4.6),
  add prerequisites/variables/session-state-detection to 9 Claude prompt files.
- refactor(agents): update 06b-Bicep CodeGen, 07b-Bicep Deploy agent definitions with
  enhanced deployment patterns and skill references.
- refactor(config): update `agent-registry.json`, `skill-affinity.json`, and
  `copilot-instructions.md` for new skill integrations.

### Fixed

- fix(agents): resolve 19 handoff inconsistencies identified by dual adversarial review
  (Claude Sonnet 4.6 + Claude Sonnet 4.6 reviewers):
  - **Critical**: fix 09-Diagnose model mismatch (registry Sonnet→Opus to match frontmatter),
    remove wrong model override on 04-Design→Governance handoff (Sonnet→removed, target is
    Claude Sonnet 4.6), add missing "Return to Step 2" handoff to 07t-Terraform Deploy (symmetry
    with 07b-Bicep Deploy).
  - **High**: gate 04-Design skip paths with `send: false` and risk warnings (was bypassing
    mandatory governance + planning), redirect 05b/05t "Refresh Governance" to 04g-Governance
    (was self-handoff bypassing governance agent), add `challenger-review-subagent` to
    04g-Governance agents list (was claiming review but couldn't execute it), add 5 missing
    step handoffs to Fast Path conductor, add `10-Challenger` to 02-Requirements agents list,
    change interactive Requirements handoffs to `send: false`.
  - **Cleanup**: wire orphaned `bicep-whatif-subagent` and `terraform-plan-subagent` to their
    deploy agents, redirect Diagnose workload-docs handoff to 08-As-Built, fix governance
    planner prompts to reference both `.md` and `.json` artifacts, remove `05t-Terraform
Planner` from 03-Architect agents list, remove 5 redundant model overrides across
    04-Design/04g-Governance/07b-Deploy.
- fix(agents): remove 12 stale handoff model overrides from Conductor (9), Architect (2),
  and Requirements/Diagnose/Planners (3) — overrides were either redundant (matching target
  model) or pointing to wrong models after prior refactoring.
- fix(hooks): fix VS Code hook scripts — correct API field names (`toolName`→`tool_name`,
  `toolInput`→`tool_input`), update tool name patterns to match actual VS Code tool IDs,
  use `permissionDecision:deny` for dangerous command blocking.
- fix(prompts): fix `diagnose-resource.prompt.md` model field (Sonnet→Opus to match agent).

### Removed

- chore(skills): remove deprecated `azure-diagnostics` legacy skill (replaced by
  `azure-diagnostics` from Azure Skills Plugin).

### Removed

- chore(mcp): remove `microsoft-learn` MCP server from `.vscode/mcp.json` and
  `.devcontainer/post-create.sh` — Learn MCP tools are now bundled with the
  `ms-azuretools.vscode-azure-github-copilot` extension.
- chore(skills): delete `microsoft-docs`, `microsoft-code-reference`, and
  `microsoft-skill-creator` skills — functionality provided natively by extension.
- chore(config): remove skill references from `agent-registry.json` and `skill-affinity.json`.

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.9.0] — Pre-Bosun Baseline

### Added

- feat(terraform): add end-to-end Terraform IaC workflow with Planner (`05t`), Code Generator
  (`06t`), Deploy (`07t`), and supporting lint/review/plan subagents.
- feat(agents): add IaC-track selection in Requirements and Terraform routing in Conductor.
- feat(quality): add Terraform quality gates, CI checks, and IaC-neutral artifact template support.
- feat(instructions): add Terraform best-practices and policy-compliance instruction coverage.
- feat(skills): add `terraform-patterns` skill for AVM-TF composition and common pitfalls.
- feat(conductor): add `00-handoff.md` phase handoff/resume flow and related guidance.
- feat(agents): add `compact_for_parent` summary output for challenger review passes.
- feat(devcontainer): add Terraform toolchain and post-start updates for `checkov`, `ruff`, and
  `diagrams`.
- feat(mcp): add GitHub and Microsoft Learn remote MCP servers.
- feat(pricing-mcp): deliver Azure Pricing MCP v4.0/v4.1.0 improvements.
- feat(scripts): add 5 CI enforcement validators for context-optimization guardrails
  (`lint:agent-body-size`, `lint:glob-audit`, `lint:skill-size`, `lint:skill-references`,
  `lint:orphaned-content`); validator count 15 → 22.
- feat(agents): add fast-path `01-Conductor (Fast Path)` agent for simple 1–3 resource projects
  with combined Plan+Code step and single challenger pass.
- feat(ci): add weekly doc-freshness cron workflow and quarterly context audit checklist in
  `AGENTS.md`.

### Changed

- refactor(agents): simplify challenger review context handoff by switching parent retention to
  compact findings summaries.
- chore(agents): rename/renumber agent files and align subagent orchestration patterns.
- refactor(tf-dev): iterate Terraform phase prompts, routing, and subagent guidance.
- docs: refresh README, prompt docs, and agent metadata for Terraform-first multi-track workflow.
- chore(docs): remove legacy Terraform planning docs (`docs/tf-support/`, roadmap) after
  integration.
- refactor(azure-mcp): migrate extension references to `vscode-azure-mcp-server`.
- ci: tighten policy/compliance validation and branch merge-gate enforcement for Terraform rollout.
- style: apply broad formatting and consistency cleanup across docs/instructions/scripts.
- refactor(skills): split 10 large skills into core `SKILL.md` + on-demand `references/` files;
  60 reference files total; skill context load reduced by 46% vs M1 baseline.
- refactor(agents): trim all agent bodies to ≤350 lines with explicit tool-boundary declarations;
  deduplicate cross-agent content via shared instruction globs; agent context reduced by 18%.
- refactor(instructions): split 5 large instruction files into `references/` sub-documents and
  enforce narrow glob patterns; instruction context reduced by 32%.
- refactor(agents): overhaul subagent delegation patterns and introduce `iac-common` skill to
  consolidate shared Bicep/Terraform deploy logic across agents 07b and 07t.
- feat(agents): upgrade `challenger-review-subagent` from GPT-4o to Claude Sonnet 4.6.
- fix(frontmatter): convert YAML block scalar descriptions to single-line inline strings across
  all agent and skill frontmatter.

### Fixed

- fix(devcontainer): correct Terraform MCP server runtime path and move from Docker-based startup
  to Go binary execution.
- fix(mcp): suppress Terraform Enterprise token noise on startup and correct MCP healthcheck
  behavior.
- fix(agents): repair challenger/agent tool declarations and enforce subagent delegation rules.
- fix(actions): move deprecation tracker automation to PR flow.
- fix(validation): resolve validation drift for stable `npm run validate:all` execution.
- fix(azure-pricing-mcp): align bulk estimate formatter with the indices response shape.
- fix(scripts): add remediation messages to all context-optimization validator failure outputs.
- fix(scripts): prevent YAML block scalar descriptions from recurring after frontmatter cleanup.
- fix(agents): remove deprecated `agent`/`runSubagent` tool declarations from all 13 agents.
- build(devcontainer): replace `tfsec` with `checkov`; pin `tflint` to v0.61.0.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.9.0] - 2026-02-12

### Changed

- chore(version): reset project version from `0.0.45` to `0.9.0` for pre-production semantics.
- chore(version): align `VERSION.md`, `package.json`, and `pyproject.toml`.
- docs(version): make `VERSION.md` the documentation source of truth for version display.
- build(version): simplify `validate-version-sync.mjs` checks to version-bearing files.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">

> **Note:** Versions below (`0.0.45` and earlier) are pre-release development milestones.

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.45] - 2026-02-05

### Added

- docs(agents): document model selection guidance in `agent-definitions.instructions.md`.

### Changed

- docs(readme): restructure README with collapsible sections and accessibility fixes.
- docs(diagram): correct workflow sequence to show all five approval gates.

### Fixed

- fix(lint-yml): simplify markdown-lint trigger paths.
- fix(skills): correct template paths in deployment preflight skill docs.
- fix(templates): restore missing header text in governance constraints template.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.44] - 2026-02-04

### Added

- docs(styling): add callouts and references sections across documentation.
- chore(devcontainer-extensions): add `mutantdino.resourcemonitor`.
- docs(terraform): add `docs/terraform-roadmap.md` and tracking issue #85.

### Changed

- ci(link-check): move to nightly schedule with issue auto-creation on failures.
- chore(versioning): simplify manual release flow and remove auto-version workflow.

### Fixed

- docs(links): repair broad internal-link drift across docs and artifacts.
- ci(workflows): fix `workflow_dispatch` input typing and increase link-check timeout.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.43] - 2026-02-03

### Added

- feat(validation): add 9-category validation framework and `validate:all` workflow.
- feat(skills): complete agent-to-skill migration with new ADR/workload docs capabilities.
- ci(links): add external link checker workflow using lychee.

### Changed

- refactor(agents): reduce agent count by converting `diagram`, `adr`, and `docs` to skills.
- docs(counts): remove hardcoded agent/skill totals in documentation.

### Breaking Changes

- chore(agents): remove `@diagram`, `@adr`, and `@docs`; replace with skill-based workflows.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.42] - 2026-02-03

### Changed

- refactor(diagrams): standardize on Python diagrams library generation only.
- build(diagrams): add `diagrams`, `matplotlib`, and `pillow` requirements.

### Removed

- chore(drawio): remove Draw.io MCP server, templates, scripts, and extension integration.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.41] - 2026-02-02

### Added

- docs(plan): add agent-to-skill migration plan (`plan-agentToSkillMigration.prompt.md`).

### Changed

- docs(readme): overhaul README layout, navigation, and badge presentation.

### Fixed

- fix(skills): resolve markdown lint issues in deployment preflight and skill template files.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.40] - 2026-01-23

### Changed

- feat(workflow): implement automated versioning and branch protection (#40).
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.39] - 2026-01-22

### Added

- feat(agent-testing): introduce complete agent validation framework.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.38] - 2026-01-22

### Changed

- feat(agents): rename `@plan` to `@requirements` to avoid collision with VS Code built-in Plan.
- refactor(agents): rename `plan.agent.md` to `requirements.agent.md` and update references.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.37] - 2026-01-21

### Added

- feat(testing): add comprehensive agent testing plan prompt.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.36] - 2026-01-21

### Fixed

- fix(devcontainer): resolve post-create permission issues.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.35] - 2026-01-21

### Fixed

- fix(devcontainer): remove invalid `PATH` override that blocked container startup.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.34] - 2026-01-21

### Fixed

- fix(docs): update remaining legacy agent references in embedded docs.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.33] - 2026-01-21

### Breaking Changes

- feat(agents)!: rename agents to shorter verb-based names.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.32] - 2026-01-21

### Added

- feat(agents): integrate deploy agent into the workflow.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.31] - 2026-01-21

### Breaking Changes

- chore(terraform): remove Terraform support and move repository to Bicep-only operation.

### Added

- feat(git-hooks): replace Husky with lefthook.
- docs(terraform): add Terraform re-enable guide at `docs/guides/terraform-extension-guide.md`.
- chore(devcontainer-python): enable basic Pylance type checking.

### Changed

- fix(markdownlint): improve markdownlint detection in post-create checks.
- chore(config): consolidate markdownlint config to `.markdownlint-cli2.jsonc`.
- fix(mcp): replace unreliable stdio healthcheck with Python import verification.
- docs(terraform): update repository docs to remove Terraform assumptions.

### Removed

- chore(husky): remove Husky directory and dependency.
- chore(terraform): remove Terraform tooling, references, and related config entries.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.30] - 2026-01-20

### Added

- feat(diagnose): add Azure Resource Health Diagnostician agent.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.29] - 2026-01-19

### Fixed

- fix(ci): correct version auto-update extraction logic.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.28] - 2026-01-19

### Added

- feat(deploy-agent): activate deploy agent for Step 6 workflows.
- docs(deploy-agent): add dual-path deployment guidance and troubleshooting notes.

### Changed

- docs(workflow): update diagrams and references to use Deploy Agent terminology.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.27] - 2026-01-19

### Added

- feat(presenter): add dark-themed workflow diagram for presentations.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.26] - 2026-01-19

### Changed

- chore(release): prepare release transition to `0.0.25` baseline.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.25] - 2026-01-19

### Breaking Changes

- refactor(scenarios): renumber and reduce scenarios from 11 to 8.

### Changed

- docs(workflow): consolidate workflow docs to `docs/reference/workflow.md`.
- docs(cleanup): remove duplicate guides and standardize budget terminology.
- chore(paths): update scenario references and paths across the repo.

### Removed

- chore(legacy): remove `scenarios/scenario-output/` and legacy docs folders.
- chore(example): remove `infra/bicep/contoso-patient-portal/`.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.24] - 2026-01-14

### Added

- feat(demo): add prompt for 30-minute live workflow demo.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.23] - 2026-01-14

### Fixed

- fix(prompts): convert plan-requirements to proper prompt-file format.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.22] - 2026-01-14

### Added

- feat(artifacts): complete artifact template compliance rollout.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.21] - 2026-01-14

### Added

- feat(artifacts): reach standard strictness across all 12 artifact types.

### Changed

- refactor(wave2): align all `07-*` artifacts with template structure.
- refactor(legacy): align ecommerce legacy artifacts with current templates.
- chore(strictness): raise validation strictness from relaxed to standard.
- chore(validation): expand allowed optional sections for common additions.

### Fixed

- fix(package): remove duplicate version line.
- fix(docs): remove outdated design document TOC sections.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.20] - 2026-01-14

### Added

- feat(templates): add 8 new artifact templates for governance, implementation, and as-built outputs.
- feat(validation): add per-artifact strictness configuration.

### Changed

- refactor(validation): generalize Wave 1 validation to all 12 artifact types.
- docs(readme): redesign workflow tables and legend.
- chore(artifacts): rename ecommerce artifacts to standard naming convention.
- ci(workflows): expand trigger paths for templates and agent changes.

### Fixed

- fix(docs): correct renamed artifact references in ecommerce documentation index.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.19] - 2026-01-14

### Added

- feat(deploy): add Step 6 deploy agent.
- feat(skills): add GitHub issues skill and template drift guards.
- feat(docs): introduce `docs/reference/`, `docs/getting-started/`, and merged presenter docs.
- feat(validation): add Wave 1 artifact and cost estimate template validation pipelines.

### Changed

- refactor(project-planner): align planner workflow/tooling with modern custom agent patterns.
- chore(agents): standardize shared defaults and relative template links across agents.
- chore(validation): increase Wave 1 strictness to standard.

### Fixed

- fix(tools): update deprecated tool-name references in agent docs.
- fix(links): resolve markdown lint and broken-link issues across instruction and artifact files.

### Removed

- chore(terraform-doc): remove obsolete `terraform-azure.instructions.md`.
- chore(docs): merge and remove `docs/presenter-toolkit/` and `docs/value-proposition/`.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.18] - 2026-01-13

### Changed

- refactor(agents): rename `@plan` display references to Project Planner across docs.
- docs(usage): correct invocation guidance and regenerate workflow diagrams.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.17] - 2025-12-18

### Fixed

- fix(pricing): update Azure Pricing Calculator URLs with locale-aware links.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.16] - 2025-12-18

### Fixed

- fix(paths): correct relative paths in `azure-principal-architect.agent.md`.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.15] - 2025-12-18

### Fixed

- fix(paths): correct shared foundation link path in all agents.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.14] - 2025-12-18

### Fixed

- fix(readme): correct table link paths.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.13] - 2025-12-18

### Fixed

- fix(readme): remove non-functional Mermaid click links and add link table.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.12] - 2025-12-18

### Fixed

- fix(readme): switch Mermaid click links to absolute GitHub URLs.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.11] - 2025-12-18

### Fixed

- fix(readme): correct Mermaid click links.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.10] - 2025-12-18

### Fixed

- fix(docs): clean up docs rebuild path/link breakage.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.9] - 2025-12-17

### Added

- feat(validation): add `static-webapp-test` workflow validation example.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.8] - 2025-12-17

### Changed

- feat(workflow): integrate requirements template into the workflow.
- refactor(workflow): restructure to 7-step lifecycle with Deploy as Step 6.
- chore(artifacts): standardize `-des` and `-ab` artifact suffixes.
- refactor(costing): move cost estimates to Step 3 design artifacts.
- docs(pricing): add Azure Pricing MCP fallback chain guidance.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.7] - 2025-12-17

### Added

- feat(diagrams): add workflow diagram generator setup.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.6] - 2025-12-17

### Added

- feat(docs-agent): add workload documentation generator agent for optional Step 7.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.5] - 2025-12-17

### Added

- feat(outputs): centralize agent outputs and automate versioning.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.4] - 2025-12-07

### Added

- feat(personas): add character reference card for all personas.
- ci(actions): add GitHub Actions workflow with five validation jobs.
- feat(shared): add `_shared/defaults.md` configuration.
- feat(scenarios): add healthcare, analytics, and static website demo scenarios.
- docs(adr): add ADR-001 through ADR-004.
- docs(roadmap): add project improvements plan.

### Changed

- refactor(scenarios): renumber scenarios S01-S11.
- refactor(personas): resolve character naming collisions.
- feat(pricing-mcp): improve caching, timeouts, and session handling.

### Fixed

- fix(scenarios): remove duplicate S04 folders.
- fix(personas): fix character-name collisions across scenarios.
- fix(mcp): resolve "Connector is closed" server errors.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.3] - 2025-12-03

### Changed

- refactor(docs): reorganize docs into workflow, getting-started, guides, value-proposition,
  and cost-estimates subfolders.
- refactor(scenarios): reorganize scenarios with `quick-demos` subfolder.

### Breaking Changes (File Paths)

- chore(paths): move `docs/WORKFLOW.md` to `docs/workflow/WORKFLOW.md`.
- chore(paths): move `docs/QUICKSTART.md` to `docs/getting-started/QUICKSTART.md`.
- chore(paths): move `docs/troubleshooting.md` to `docs/guides/troubleshooting.md`.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.2] - 2025-12-01

### Changed

- refactor(repo): restructure repository around the 7-step agent workflow.
- chore(structure): simplify folder layout by removing legacy scenario structure.

### Added

- feat(agents): add custom agents for Azure infrastructure workflow.
- docs(workflow): add comprehensive workflow documentation.
- feat(prompts): add e-commerce scenario prompts.
- feat(pricing-mcp): add Azure Pricing MCP server.
- feat(devcontainer): add pre-configured development container.

### Removed

- chore(legacy): remove legacy scenarios/resources folders.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## [0.0.1] - 2024-06-01

### Added

- feat(init): add initial repository structure.
- feat(bicep): add basic Bicep templates.
- feat(deploy): add PowerShell deployment scripts.
- docs(copilot): add initial Copilot instructions.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Version Numbering

This project uses [Semantic Versioning](https://semver.org/):

- **0.x.y**: pre-production development (current).
- **1.0.0**: first stable production release (upcoming).
- **MAJOR**: breaking changes to workflow or agent interfaces.
- **MINOR**: new agents, demos, or significant feature additions.
- **PATCH**: bug fixes, documentation improvements, and minor enhancements.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Links

- [VERSION.md](VERSION.md) - Detailed version history
- [GitHub Releases](https://github.com/jonathan-vella/azure-agentic-infraops/releases)

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>
