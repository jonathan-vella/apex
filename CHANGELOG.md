# Changelog

All notable changes to **Agentic InfraOps** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- feat(pricing-mcp): release Azure Pricing MCP v4.0 improvements.
- feat(azure-pricing-mcp): release v4.1.0 with error boundaries, bulk concurrency, cache stats,
  and lint cleanup (#150).
- feat(step-4): enforce dependency and runtime diagram outputs.
- feat(devcontainer): add visible post-create progress steps.

### Changed

- refactor(azure-mcp): migrate from `vscode-azure-github-copilot` to
  `vscode-azure-mcp-server` (#143).
- refactor(conductor): update InfraOps Conductor prompts and tool usage (#146, #147).
- chore(agents): enforce subagent-only pricing for Steps 2 and 7.
- chore(agents): update deploy and Bicep subagent definitions.
- docs(readme): add top banner and remove workflow SVG embed.
- chore(governance): normalize instruction links and skill frontmatter.
- chore(ci): tighten VS Code extension drift policy and MCP setup checks.
- chore(sync): sync source-of-truth and pricing delegation updates.

### Fixed

- fix(azure-pricing-mcp): align bulk estimate formatter with indices response shape (#151).
- fix(actions): switch deprecation tracker automation to PR flow (#155).
- fix(mcp): correct healthcheck behavior and remove unused dependencies.

## [0.9.0] - 2026-02-12

### Changed

- chore(version): reset project version from `8.2.0` to `0.9.0` for pre-production semantics.
- chore(version): align `VERSION.md`, `package.json`, and `pyproject.toml`.
- docs(version): make `VERSION.md` the documentation source of truth for version display.
- build(version): simplify `validate-version-sync.mjs` checks to version-bearing files.

---

> **Note:** Versions below (`8.2.0` and earlier) are pre-release development milestones.

## [8.2.0] - 2026-02-05

### Added

- docs(agents): document model selection guidance in `agents-definitions.instructions.md`.

### Changed

- docs(readme): restructure README with collapsible sections and accessibility fixes.
- docs(diagram): correct workflow sequence to show all five approval gates.

### Fixed

- fix(lint-yml): simplify markdown-lint trigger paths.
- fix(skills): correct template paths in deployment preflight skill docs.
- fix(templates): restore missing header text in governance constraints template.

## [8.1.0] - 2026-02-04

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

## [8.0.0] - 2026-02-03

### Added

- feat(validation): add 9-category validation framework and `validate:all` workflow.
- feat(skills): complete agent-to-skill migration with new ADR/workload docs capabilities.
- ci(links): add external link checker workflow using lychee.

### Changed

- refactor(agents): reduce agent count by converting `diagram`, `adr`, and `docs` to skills.
- docs(counts): remove hardcoded agent/skill totals in documentation.

### Breaking Changes

- chore(agents): remove `@diagram`, `@adr`, and `@docs`; replace with skill-based workflows.

## [7.6.0] - 2026-02-03

### Changed

- refactor(diagrams): standardize on Python diagrams library generation only.
- build(diagrams): add `diagrams`, `matplotlib`, and `pillow` requirements.

### Removed

- chore(drawio): remove Draw.io MCP server, templates, scripts, and extension integration.

## [7.5.0] - 2026-02-02

### Added

- docs(plan): add agent-to-skill migration plan (`plan-agentToSkillMigration.prompt.md`).

### Changed

- docs(readme): overhaul README layout, navigation, and badge presentation.

### Fixed

- fix(skills): resolve markdown lint issues in deployment preflight and skill template files.

## [7.4.0] - 2026-01-23

### Changed

- feat(workflow): implement automated versioning and branch protection (#40).

## [7.3.0] - 2026-01-22

### Added

- feat(agent-testing): introduce complete agent validation framework.

## [7.2.0] - 2026-01-22

### Changed

- feat(agents): rename `@plan` to `@requirements` to avoid collision with VS Code built-in Plan.
- refactor(agents): rename `plan.agent.md` to `requirements.agent.md` and update references.

## [7.1.0] - 2026-01-21

### Added

- feat(testing): add comprehensive agent testing plan prompt.

## [7.0.3] - 2026-01-21

### Fixed

- fix(devcontainer): resolve post-create permission issues.

## [7.0.2] - 2026-01-21

### Fixed

- fix(devcontainer): remove invalid `PATH` override that blocked container startup.

## [7.0.1] - 2026-01-21

### Fixed

- fix(docs): update remaining legacy agent references in embedded docs.

## [7.0.0] - 2026-01-21

### Breaking Changes

- feat(agents)!: rename agents to shorter verb-based names.

## [6.1.0] - 2026-01-21

### Added

- feat(agents): integrate deploy agent into the workflow.

## [6.0.0] - 2026-01-21

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

## [5.3.0] - 2026-01-20

### Added

- feat(diagnose): add Azure Resource Health Diagnostician agent.

## [5.2.1] - 2026-01-19

### Fixed

- fix(ci): correct version auto-update extraction logic.

## [5.2.0] - 2026-01-19

### Added

- feat(deploy-agent): activate deploy agent for Step 6 workflows.
- docs(deploy-agent): add dual-path deployment guidance and troubleshooting notes.

### Changed

- docs(workflow): update diagrams and references to use Deploy Agent terminology.

## [5.1.0] - 2026-01-19

### Added

- feat(presenter): add dark-themed workflow diagram for presentations.

## [5.0.0] - 2026-01-19

### Changed

- chore(release): prepare release transition to `4.0.0` baseline.

## [4.0.0] - 2026-01-19

### Breaking Changes

- refactor(scenarios): renumber and reduce scenarios from 11 to 8.

### Changed

- docs(workflow): consolidate workflow docs to `docs/reference/workflow.md`.
- docs(cleanup): remove duplicate guides and standardize budget terminology.
- chore(paths): update scenario references and paths across the repo.

### Removed

- chore(legacy): remove `scenarios/scenario-output/` and legacy docs folders.
- chore(example): remove `infra/bicep/contoso-patient-portal/`.

## [3.11.0] - 2026-01-14

### Added

- feat(demo): add prompt for 30-minute live workflow demo.

## [3.10.1] - 2026-01-14

### Fixed

- fix(prompts): convert plan-requirements to proper prompt-file format.

## [3.10.0] - 2026-01-14

### Added

- feat(artifacts): complete artifact template compliance rollout.

## [3.9.0] - 2026-01-14

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

## [3.8.1] - 2026-01-14

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

## [3.8.0] - 2026-01-14

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

## [3.7.9] - 2026-01-13

### Changed

- refactor(agents): rename `@plan` display references to Project Planner across docs.
- docs(usage): correct invocation guidance and regenerate workflow diagrams.

## [3.7.8] - 2025-12-18

### Fixed

- fix(pricing): update Azure Pricing Calculator URLs with locale-aware links.

## [3.7.7] - 2025-12-18

### Fixed

- fix(paths): correct relative paths in `azure-principal-architect.agent.md`.

## [3.7.6] - 2025-12-18

### Fixed

- fix(paths): correct shared foundation link path in all agents.

## [3.7.5] - 2025-12-18

### Fixed

- fix(readme): correct table link paths.

## [3.7.4] - 2025-12-18

### Fixed

- fix(readme): remove non-functional Mermaid click links and add link table.

## [3.7.3] - 2025-12-18

### Fixed

- fix(readme): switch Mermaid click links to absolute GitHub URLs.

## [3.7.2] - 2025-12-18

### Fixed

- fix(readme): correct Mermaid click links.

## [3.7.1] - 2025-12-18

### Fixed

- fix(docs): clean up docs rebuild path/link breakage.

## [3.7.0] - 2025-12-17

### Added

- feat(validation): add `static-webapp-test` workflow validation example.

## [3.6.0] - 2025-12-17

### Changed

- feat(workflow): integrate requirements template into the workflow.
- refactor(workflow): restructure to 7-step lifecycle with Deploy as Step 6.
- chore(artifacts): standardize `-des` and `-ab` artifact suffixes.
- refactor(costing): move cost estimates to Step 3 design artifacts.
- docs(pricing): add Azure Pricing MCP fallback chain guidance.

## [3.5.0] - 2025-12-17

### Added

- feat(diagrams): add workflow diagram generator setup.

## [3.4.0] - 2025-12-17

### Added

- feat(docs-agent): add workload documentation generator agent for optional Step 7.

## [3.3.0] - 2025-12-17

### Added

- feat(outputs): centralize agent outputs and automate versioning.

## [3.2.0] - 2025-12-07

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

## [3.1.0] - 2025-12-03

### Changed

- refactor(docs): reorganize docs into workflow, getting-started, guides, value-proposition,
  and cost-estimates subfolders.
- refactor(scenarios): reorganize scenarios with `quick-demos` subfolder.

### Breaking Changes (File Paths)

- chore(paths): move `docs/WORKFLOW.md` to `docs/workflow/WORKFLOW.md`.
- chore(paths): move `docs/QUICKSTART.md` to `docs/getting-started/QUICKSTART.md`.
- chore(paths): move `docs/troubleshooting.md` to `docs/guides/troubleshooting.md`.

## [2.0.0] - 2025-12-01

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

## [1.0.0] - 2024-06-01

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
