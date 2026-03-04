# Changelog

All notable changes to **Agentic InfraOps** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

## [0.9.0] - 2026-02-12

### Changed

- chore(version): reset project version from `0.0.45` to `0.9.0` for pre-production semantics.
- chore(version): align `VERSION.md`, `package.json`, and `pyproject.toml`.
- docs(version): make `VERSION.md` the documentation source of truth for version display.
- build(version): simplify `validate-version-sync.mjs` checks to version-bearing files.

---

> **Note:** Versions below (`0.0.45` and earlier) are pre-release development milestones.

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

## [0.0.42] - 2026-02-03

### Changed

- refactor(diagrams): standardize on Python diagrams library generation only.
- build(diagrams): add `diagrams`, `matplotlib`, and `pillow` requirements.

### Removed

- chore(drawio): remove Draw.io MCP server, templates, scripts, and extension integration.

## [0.0.41] - 2026-02-02

### Added

- docs(plan): add agent-to-skill migration plan (`plan-agentToSkillMigration.prompt.md`).

### Changed

- docs(readme): overhaul README layout, navigation, and badge presentation.

### Fixed

- fix(skills): resolve markdown lint issues in deployment preflight and skill template files.

## [0.0.40] - 2026-01-23

### Changed

- feat(workflow): implement automated versioning and branch protection (#40).

## [0.0.39] - 2026-01-22

### Added

- feat(agent-testing): introduce complete agent validation framework.

## [0.0.38] - 2026-01-22

### Changed

- feat(agents): rename `@plan` to `@requirements` to avoid collision with VS Code built-in Plan.
- refactor(agents): rename `plan.agent.md` to `requirements.agent.md` and update references.

## [0.0.37] - 2026-01-21

### Added

- feat(testing): add comprehensive agent testing plan prompt.

## [0.0.36] - 2026-01-21

### Fixed

- fix(devcontainer): resolve post-create permission issues.

## [0.0.35] - 2026-01-21

### Fixed

- fix(devcontainer): remove invalid `PATH` override that blocked container startup.

## [0.0.34] - 2026-01-21

### Fixed

- fix(docs): update remaining legacy agent references in embedded docs.

## [0.0.33] - 2026-01-21

### Breaking Changes

- feat(agents)!: rename agents to shorter verb-based names.

## [0.0.32] - 2026-01-21

### Added

- feat(agents): integrate deploy agent into the workflow.

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

## [0.0.30] - 2026-01-20

### Added

- feat(diagnose): add Azure Resource Health Diagnostician agent.

## [0.0.29] - 2026-01-19

### Fixed

- fix(ci): correct version auto-update extraction logic.

## [0.0.28] - 2026-01-19

### Added

- feat(deploy-agent): activate deploy agent for Step 6 workflows.
- docs(deploy-agent): add dual-path deployment guidance and troubleshooting notes.

### Changed

- docs(workflow): update diagrams and references to use Deploy Agent terminology.

## [0.0.27] - 2026-01-19

### Added

- feat(presenter): add dark-themed workflow diagram for presentations.

## [0.0.26] - 2026-01-19

### Changed

- chore(release): prepare release transition to `0.0.25` baseline.

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

## [0.0.24] - 2026-01-14

### Added

- feat(demo): add prompt for 30-minute live workflow demo.

## [0.0.23] - 2026-01-14

### Fixed

- fix(prompts): convert plan-requirements to proper prompt-file format.

## [0.0.22] - 2026-01-14

### Added

- feat(artifacts): complete artifact template compliance rollout.

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

## [0.0.18] - 2026-01-13

### Changed

- refactor(agents): rename `@plan` display references to Project Planner across docs.
- docs(usage): correct invocation guidance and regenerate workflow diagrams.

## [0.0.17] - 2025-12-18

### Fixed

- fix(pricing): update Azure Pricing Calculator URLs with locale-aware links.

## [0.0.16] - 2025-12-18

### Fixed

- fix(paths): correct relative paths in `azure-principal-architect.agent.md`.

## [0.0.15] - 2025-12-18

### Fixed

- fix(paths): correct shared foundation link path in all agents.

## [0.0.14] - 2025-12-18

### Fixed

- fix(readme): correct table link paths.

## [0.0.13] - 2025-12-18

### Fixed

- fix(readme): remove non-functional Mermaid click links and add link table.

## [0.0.12] - 2025-12-18

### Fixed

- fix(readme): switch Mermaid click links to absolute GitHub URLs.

## [0.0.11] - 2025-12-18

### Fixed

- fix(readme): correct Mermaid click links.

## [0.0.10] - 2025-12-18

### Fixed

- fix(docs): clean up docs rebuild path/link breakage.

## [0.0.9] - 2025-12-17

### Added

- feat(validation): add `static-webapp-test` workflow validation example.

## [0.0.8] - 2025-12-17

### Changed

- feat(workflow): integrate requirements template into the workflow.
- refactor(workflow): restructure to 7-step lifecycle with Deploy as Step 6.
- chore(artifacts): standardize `-des` and `-ab` artifact suffixes.
- refactor(costing): move cost estimates to Step 3 design artifacts.
- docs(pricing): add Azure Pricing MCP fallback chain guidance.

## [0.0.7] - 2025-12-17

### Added

- feat(diagrams): add workflow diagram generator setup.

## [0.0.6] - 2025-12-17

### Added

- feat(docs-agent): add workload documentation generator agent for optional Step 7.

## [0.0.5] - 2025-12-17

### Added

- feat(outputs): centralize agent outputs and automate versioning.

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

## [0.0.3] - 2025-12-03

### Changed

- refactor(docs): reorganize docs into workflow, getting-started, guides, value-proposition,
  and cost-estimates subfolders.
- refactor(scenarios): reorganize scenarios with `quick-demos` subfolder.

### Breaking Changes (File Paths)

- chore(paths): move `docs/WORKFLOW.md` to `docs/workflow/WORKFLOW.md`.
- chore(paths): move `docs/QUICKSTART.md` to `docs/getting-started/QUICKSTART.md`.
- chore(paths): move `docs/troubleshooting.md` to `docs/guides/troubleshooting.md`.

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

## [0.0.1] - 2024-06-01

### Added

- feat(init): add initial repository structure.
- feat(bicep): add basic Bicep templates.
- feat(deploy): add PowerShell deployment scripts.
- docs(copilot): add initial Copilot instructions.

---

## Version Numbering

This project uses [Semantic Versioning](https://semver.org/):

- **0.x.y**: pre-production development (current).
- **1.0.0**: first stable production release (upcoming).
- **MAJOR**: breaking changes to workflow or agent interfaces.
- **MINOR**: new agents, demos, or significant feature additions.
- **PATCH**: bug fixes, documentation improvements, and minor enhancements.

## Links

- [VERSION.md](VERSION.md) - Detailed version history
- [GitHub Releases](https://github.com/jonathan-vella/azure-agentic-infraops/releases)
