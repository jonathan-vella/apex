# Changelog

All notable changes to **Agentic InfraOps** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.5.0] - 2026-02-02

### Added

- **Agent-to-Skill Migration Plan** - Comprehensive plan to reduce agents from 9 to 6
  - Convert `diagram`, `adr`, `docs` agents to skills
  - Create new `azure-adr` and `azure-workload-docs` skills
  - Enhance `azure-diagrams` skill with agent patterns
  - Enhance `make-skill-template` as interactive skill-creator
  - Plan saved to `plan-agentToSkillMigration.prompt.md`

### Changed

- **README.md** - Complete format overhaul to match SMB-LZ polished style
  - Added centered robot logo from Fluent UI emoji
  - Added project shields with reference-style markdown links
  - Added table of contents in collapsible details block
  - Added emoji section headers and back-to-top navigation
  - Added Built With tech stack badges

### Fixed

- **Skills Lint Fixes** - Resolved 7 markdown lint errors in skill files
  - `.github/skills/azure-deployment-preflight/SKILL.md`
  - `.github/skills/make-skill-template/SKILL.md`
  - `.github/skills/azure-deployment-preflight/references/ERROR-HANDLING.md`

## [7.4.0] - 2026-01-23

- feat(workflow): Implement automated versioning and branch protection (#40)

## [7.3.0] - 2026-01-22

- feat(agent-testing): add complete agent validation framework

## [7.2.0] - 2026-01-22

- feat(agents): rename @plan agent to @requirements

## [7.2.0] - 2026-01-22

### Changed

- **Renamed `@plan` agent to `@requirements`** - Avoids conflict with VS Code's built-in `@plan` agent
  - Renamed `.github/agents/plan.agent.md` → `.github/agents/requirements.agent.md`
  - Updated all documentation and workflow references
  - Custom agent now accessible as `@requirements` in VS Code agent picker
  - No functional changes to the agent's behavior

## [7.1.0] - 2026-01-21

- feat: add comprehensive agent testing plan prompt

## [7.0.3] - 2026-01-21

- fix: resolve permission issues in dev container post-create script

## [7.0.2] - 2026-01-21

- fix: remove invalid PATH from containerEnv that broke container startup

## [7.0.1] - 2026-01-21

- fix: update remaining old agent references in embedded docs

## [7.0.0] - 2026-01-21

- feat(agents)!: rename agents to shorter verb-based names

## [6.1.0] - 2026-01-21

- feat(agents): integrate deploy agent into workflow

## [6.0.0] - 2026-01-21

- feat: remove Terraform and replace Husky with lefthook

## [6.0.0] - 2026-01-21

### BREAKING CHANGES

- **Terraform support removed** - Project is now Bicep-only
  - Removed Terraform, tfsec, Terragrunt from dev container
  - Removed Go tooling (was used for Terratest)
  - Removed HashiCorp.terraform and Azure Terraform VS Code extensions
  - Removed all Terraform references from documentation and agents
  - See `docs/guides/terraform-extension-guide.md` for adding Terraform support back

### Added

- **lefthook** - Replaced deprecated Husky with lefthook for Git hooks
  - Faster, dependency-free Go binary
  - Same functionality: pre-commit (markdownlint) and commit-msg (commitlint)
- **Terraform Extension Guide** - New guide documenting how to add Terraform support
  - Located at `docs/guides/terraform-extension-guide.md`
  - Covers dev container, agents, instructions, and CI/CD setup
- **Pylance type checking** - Added `python.analysis.typeCheckingMode: basic` to dev container

### Changed

- **Markdownlint verification** - Fixed false negative in post-create.sh
  - Now uses `npm list -g` instead of `command -v` for reliable detection
- **Markdownlint config** - Consolidated to single `.markdownlint-cli2.jsonc` file
  - Removed duplicate `.markdownlint.json`
- **MCP health check** - Fixed unreliable stdio-based check
  - Now uses Python import verification
- **Documentation** - Updated 40+ files to remove Terraform references
  - All agents, guides, scenarios, and presenter materials updated

### Removed

- `.husky/` directory and husky dependency
- `.markdownlint.json` (duplicate config)
- Terraform, tfsec, Go version checks from post-create.sh and update-tools.sh
- Terraform entries from .gitignore and .gitattributes
- Terraform from package.json keywords

## [5.3.0] - 2026-01-20

- feat: add Azure Resource Health Diagnostician agent

## [5.2.1] - 2026-01-19

- fix(ci): Fix version auto-update workflow to correctly extract version

## [5.2.0] - 2026-01-19

### Added

- **Deploy Agent activated** - Step 6 now has a fully operational custom agent
  - Enhanced deployment workflow with Option 1 (PowerShell) and Option 2 (Azure CLI) paths
  - Added known issues section for common deployment troubleshooting
  - Added "Generate As-Built Cost Estimate" handoff option

### Changed

- Updated all workflow diagrams to reference "Deploy Agent" instead of "Azure CLI/PowerShell"
- Updated agents-overview.md with Deploy Agent section and Quick Reference entry
- Updated template and instruction references from "Deployment tooling/manual" to "Deploy Agent"

## [5.1.0] - 2026-01-19

- feat: Add dark-themed workflow diagram for presentations

## [5.0.0] - 2026-01-19

- chore: bump version to 4.0.0

## [4.0.0] - 2026-01-19

### BREAKING CHANGES

- **Scenario renumbering** - All scenario numbers have changed (11 → 8 scenarios)
  - S02-terraform-baseline: DELETED
  - S04-ecommerce-platform: DELETED
  - S11-quick-demos: DELETED
  - S03-agentic-workflow → S02-agentic-workflow
  - S05-documentation-generation → S03-documentation-generation
  - S06-service-validation → S04-service-validation
  - S07-troubleshooting → S05-troubleshooting
  - S08-sbom-generator → S06-sbom-generator
  - S09-diagrams-as-code → S07-diagrams-as-code
  - S10-coding-agent → S08-coding-agent

### Changed

- **Docs consolidation** - `docs/workflow/WORKFLOW.md` → `docs/reference/workflow.md`
- **Removed duplicate guides** - Cleaned up redundant documentation files
- **Budget terminology** - Changed "Cost Constraints" to "Budget" throughout
- **Updated ~50 files** with new scenario numbers and paths

### Removed

- `scenarios/scenario-output/` - Replaced by `agent-output/`
- `docs/workflow/` folder - Merged into `docs/reference/`
- `docs/audit-checklists/` folder
- `docs/cost-estimates/` folder
- `infra/bicep/contoso-patient-portal/` - Legacy example

## [3.11.0] - 2026-01-14

- feat: add demo prompt for 30-min live workflow demo

## [3.10.1] - 2026-01-14

- fix: convert plan-requirements to proper prompt file format

## [3.10.0] - 2026-01-14

- feat: v3.9.0 - complete artifact template compliance

## [3.9.0] - 2026-01-14

### Added

- **All 12 artifacts now at standard strictness** - Complete template compliance across the repository

### Changed

- **Restructured all Wave 2 artifacts** (07-\*) to match template standards:
  - `07-documentation-index.md` - Added numbered section prefixes
  - `07-design-document.md` - Removed Table of Contents sections
  - `07-operations-runbook.md` - Reordered sections to match template sequence
  - `07-backup-dr-plan.md` - Added Recovery Objectives, renamed sections
  - `07-compliance-matrix.md` - Restructured with numbered sections
- **Restructured legacy artifacts** to match current templates:
  - `02-architecture-assessment.md` (ecommerce) - Complete rewrite with all required sections
  - `05-implementation-reference.md` (ecommerce) - Restructured to template format
- **Ratcheted strictness** from relaxed to standard for all artifact types
- **Expanded optional sections** allowed in validation for common extra content

### Fixed

- Duplicate version line in package.json
- Removed outdated TOC sections from design documents

## [3.8.1] - 2026-01-14

### Added

- **8 new artifact templates** for comprehensive workflow coverage:
  - `04-governance-constraints.template.md` - Azure policy and governance constraints
  - `05-implementation-reference.template.md` - Bicep code location and deployment instructions
  - `07-design-document.template.md` - 10-section architecture design document
  - `07-operations-runbook.template.md` - 6-section day-2 operations guide
  - `07-resource-inventory.template.md` - Complete resource listing from IaC
  - `07-backup-dr-plan.template.md` - 9-section backup and DR procedures
  - `07-compliance-matrix.template.md` - 6-section security controls mapping
  - `07-documentation-index.template.md` - 5-section documentation package index
- **Per-artifact strictness configuration** in validation script (core=standard, wave2=relaxed)

### Changed

- **Generalized artifact template validation** from Wave 1 to all 12 artifact types:
  - Renamed `validate-wave1-artifacts.mjs` → `validate-artifact-templates.mjs`
  - Renamed `wave1-artifact-drift-guard.yml` → `artifact-template-drift-guard.yml`
  - Renamed `lint:wave1-artifacts` → `lint:artifact-templates` in package.json
- **Redesigned README.md workflow tables**:
  - Updated Mermaid diagram with display names (Project Planner, Azure Architect, etc.)
  - New 4-column Step table (Step, Phase, Agent, Output)
  - Simplified Legend table (Phase-focused with color + description)
- **Renamed ecommerce artifacts** to match standard naming convention:
  - `01-architecture-assessment.md` → `02-architecture-assessment.md`
  - `01-cost-estimate.md` → `03-des-cost-estimate.md`
- Updated husky pre-commit to use new script name and add `04-governance-constraints`
- Expanded workflow trigger paths to include all 12 templates and 6 agents

### Fixed

- Ecommerce `07-documentation-index.md` references to renamed artifacts

## [3.8.0] - 2026-01-14

- feat: refactor agents and add deploy agent (v3.8.0)

## [3.8.0] - 2026-01-14

### Added

- **Deploy agent** (`.github/agents/deploy.agent.md`) - New Step 6 agent for deployment workflows
- **GitHub issues skill** with MCP tools: `.github/skills/github-issues/`
- **Wave 1 artifact template validation system**:
  - `scripts/validate-wave1-artifacts.mjs` - Validates 01-requirements, 02-architecture-assessment, 04-implementation-plan
  - `.github/workflows/wave1-artifact-drift-guard.yml` - CI workflow for template compliance
  - `.github/templates/01-requirements.template.md`
  - `.github/templates/02-architecture-assessment.template.md`
  - `.github/templates/04-implementation-plan.template.md`
- **Golden cost estimate templates**:
  - `.github/templates/03-des-cost-estimate.template.md`
  - `.github/templates/07-ab-cost-estimate.template.md`
- **Drift guard for cost estimate templates**:
  - `scripts/validate-cost-estimate-templates.mjs`
  - `.github/workflows/cost-estimate-template-drift-guard.yml`
- **docs/reference/** - Single-source-of-truth folder:
  - `defaults.md` - Regions, CAF naming, tags, SKUs, security baseline
  - `agents-overview.md` - All 7 agents comparison table with examples
  - `workflow.md` - Canonical 7-step workflow diagram
  - `bicep-patterns.md` - Unique suffix, diagnostic settings, policy workarounds
- **docs/getting-started/** - Consolidated getting-started folder:
  - `quickstart.md` - Merged quickstart + prerequisites (10-min guide)
  - `first-scenario.md` - Detailed S01 Bicep Baseline walkthrough
  - `learning-paths.md` - Complete learning journey paths
- **docs/presenter/** - Merged presenter folder (from presenter-toolkit + value-proposition)
- **Persona-based navigation** in docs/README.md with Mermaid diagram
- **Emoji difficulty tags** in scenarios/README.md (🟢 Beginner, 🟡 Intermediate, 🔴 Advanced)
- Strictness ratcheting tracker: `docs/guides/strictness-ratcheting-tracker.md`
- Agent definitions instruction file: `.github/instructions/agents-definitions.instructions.md`

### Changed

- **Refactored Project Planner agent** to follow built-in Plan agent pattern:
  - Updated tools list with correct names (`agent`, `search/usages`, `read/problems`, etc.)
  - Added iterative `<workflow>` with research → draft → feedback loop
  - Added `<requirements_style_guide>` for consistent output format
- **Added edit tool clarification** to `azure-principal-architect` and `bicep-plan` agents (markdown only, not code)
- **Standardized shared defaults links** across all 8 agents (hyperlinks to `_shared/defaults.md`)
- **Updated handoff documentation** in `agents-definitions.instructions.md` to require display names
- Upgraded Wave 1 validation strictness from `relaxed` to `standard`
- Renamed `static-webapp-test` to `static-webapp` for consistency
- Updated all agent files to use relative template paths
- Fixed version references in documentation

### Fixed

- **Agent tool names** - Updated deprecated tool names (`runSubagent`→`agent`, `fetch`→`web/fetch`, etc.)
- **YAML frontmatter** in `github-actions.instructions.md` - Fixed multiline description format
- **Example links** in instruction files - Escaped brackets/parentheses to prevent path validation errors
- **Broken terraform reference** - Removed deleted `terraform-azure.instructions.md` from authoritative standards
- **Backslash escaping** in `bicep-implement.agent.md` - Fixed `\icep` → `bicep` and `\ar` → `var`
- Resolved 165 markdown linting violations in instruction files
- Fixed ecommerce `04-implementation-plan.md` to match Wave 1 template structure
- Fixed 30+ broken links to old folder paths

### Removed

- `terraform-azure.instructions.md` - No Terraform agent exists (removed unused file)
- `docs/presenter-toolkit/` - Merged into `docs/presenter/`
- `docs/value-proposition/` - Merged into `docs/presenter/`

## [3.7.9] - 2026-01-13

### Changed

- **Renamed @plan agent to Project Planner** - Updated 100+ files to use custom agent naming
  - All documentation now references "Project Planner" instead of "@plan"
  - Fixed agent invocation instructions: `Ctrl+Alt+I` → agent picker (not `Ctrl+Shift+A`)
  - Added clarification note distinguishing from VS Code's built-in "Plan" agent
  - Regenerated workflow diagrams (SVG/PNG) with updated agent naming

## [3.7.8] - 2025-12-18

### Fixed

- Update Azure Pricing Calculator URLs with locale

## [3.7.7] - 2025-12-18

### Fixed

- Correct broken relative paths in `azure-principal-architect.agent.md`

## [3.7.6] - 2025-12-18

### Fixed

- Correct shared foundation link path in all agents

## [3.7.5] - 2025-12-18

### Fixed

- Correct link paths in README table

## [3.7.4] - 2025-12-18

### Fixed

- Remove non-functional Mermaid click links, add link table

## [3.7.3] - 2025-12-18

### Fixed

- Use absolute GitHub URLs for Mermaid click links

## [3.7.2] - 2025-12-18

### Fixed

- Correct Mermaid click links in README

## [3.7.1] - 2025-12-18

### Fixed

- Complete docs rebuild cleanup - fix broken links and old path references

## [3.7.0] - 2025-12-17

### Added

- Static-webapp-test workflow validation example

## [3.6.0] - 2025-12-17

### Changed

- Integrate requirements template into workflow
- **Restructure to 7-step workflow** with Deploy as new Step 6:
  - Step 1: @plan → `01-requirements.md`
  - Step 2: azure-principal-architect → `02-*` files
  - Step 3: Design Artifacts → `03-des-*` files (optional)
  - Step 4: bicep-plan → `04-*` files
  - Step 5: bicep-implement → `05-*` + Bicep code
  - Step 6: Deploy → `06-deployment-summary.md` (NEW)
  - Step 7: As-Built Artifacts → `07-*` files (optional)
- Standardized artifact suffixes: `-des` (design), `-ab` (as-built)
- Cost estimates moved to Step 3 as design artifacts
- Added Azure Pricing MCP fallback chain to copilot-instructions.md

## [3.5.0] - 2025-12-17

### Added

- Workflow diagram generator initial setup

## [3.4.0] - 2025-12-17

### Added

- Workload documentation generator agent (optional Step 7)

## [3.3.0] - 2025-12-17

### Added

- Centralized agent outputs and automated versioning

## [3.2.0] - 2025-12-07

### Added

- **Character Reference Card** with all 11 personas
- GitHub Actions CI workflow with 5 validation jobs
- Shared agent configuration (`_shared/defaults.md`)
- Healthcare, analytics, and static website demo scenarios
- Architecture Decision Records (ADR-001 through ADR-004)
- Project improvements plan

### Changed

- Scenario restructure: Renumbered S01-S11
- Character collision resolution (Jennifer Chen, Maya Patel, David Kim)
- Azure Pricing MCP server improvements (caching, timeouts, session handling)

### Fixed

- Duplicate S04 folders
- Character name collisions across scenarios
- MCP server "Connector is closed" errors

## [3.1.0] - 2025-12-03

### Changed

- **Reorganized docs/ folder structure** with new subfolders:
  - `docs/workflow/` - Workflow documentation
  - `docs/getting-started/` - Quick start and prerequisites
  - `docs/guides/` - Troubleshooting and how-tos
  - `docs/value-proposition/` - ROI, time savings, executive pitch
  - `docs/cost-estimates/` - Azure pricing examples
- **Reorganized scenarios/ folder** with quick-demos subfolder

### Breaking Changes (File Paths)

- `docs/WORKFLOW.md` → `docs/workflow/WORKFLOW.md`
- `docs/QUICKSTART.md` → `docs/getting-started/QUICKSTART.md`
- `docs/troubleshooting.md` → `docs/guides/troubleshooting.md`

## [2.0.0] - 2025-12-01

### Changed

- **Breaking**: Repository restructured to focus on 7-step agent workflow
- Simplified folder structure (removed legacy scenarios folder)

### Added

- 6 custom agents for Azure infrastructure workflow
- Comprehensive workflow documentation
- E-commerce platform scenario prompts
- Azure Pricing MCP server
- Dev container with pre-configured tooling

### Removed

- Legacy scenarios and resources folders

## [1.0.0] - 2024-06-01

### Added

- Initial repository structure
- Basic Bicep templates
- PowerShell deployment scripts
- GitHub Copilot instructions file

---

## Version Numbering

This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes to workflow or agent interfaces
- **MINOR**: New agents, demos, or significant feature additions
- **PATCH**: Bug fixes, documentation improvements, minor enhancements

## Links

- [VERSION.md](VERSION.md) - Detailed version history
- [GitHub Releases](https://github.com/jonathan-vella/azure-agentic-infraops/releases)
