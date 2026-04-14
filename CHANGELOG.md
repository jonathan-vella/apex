<a id="top"></a>

# Changelog

All notable changes to **APEX** are documented in this file.

For the full release history, see:

- [Published Changelog](https://jonathan-vella.github.io/azure-agentic-infraops/project/changelog/)
- [GitHub Releases](https://github.com/jonathan-vella/azure-agentic-infraops/releases)
- [VERSION.md](VERSION.md)

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] — Unreleased

See the [published changelog](https://jonathan-vella.github.io/azure-agentic-infraops/project/changelog/)
for full details on this and all prior releases.

### Changed

- feat(azd): per-project azd multi-project support — `azure.yaml` and `.azure/` now live
  inside `infra/{iac}/{project}/` (co-located with `infra.path: .`), replacing the
  repo-root convention that broke multi-project isolation. Environment naming uses
  `{project}-{env}` (e.g., `hub-spoke-dev`). All `.azure/plan.md` references across
  50+ files updated to project-scoped paths.
- feat(azd): add azd support to the Terraform path — 06t-terraform-codegen now generates
  `azure.yaml` (with `infra.provider: terraform`) and `main.tfvars.json` parameter mapping;
  07t-terraform-deploy gains azd detection with fallback to pure `terraform apply`.
- feat(skills): new `iac-common/references/azd-vs-deploy-guide.md` — consolidated reference
  comparing azd vs deploy.ps1 (comparison table, per-project conventions, workflow, hooks,
  azure.yaml schema, detection logic, troubleshooting). Cross-linked from azure-deploy,
  recipe-selection, and azd-deployment SDK reference.
- feat(docs): new `site/src/content/docs/guides/azd-deployment.mdx` — Astro Starlight docs
  site guide covering azd vs deploy.ps1, per-project layout, workflow, hooks, schema, and
  troubleshooting.
- feat(security): expand IaC security baseline with 6 new rules — `allowSharedKeyAccess`,
  App Service HTTP/2, MySQL SSL, Container Registry admin user (all blocking), plus
  `defaultToOAuthAuthentication` (warning). WAF pillar tagging (SE:05/06/07) and MCSB links
  added to docs site. Updated AGENTS.md security section.
- refactor(scripts): migrate 6 validators to shared Reporter pattern — validate-governance-refs,
  validate-hooks, validate-instruction-checks, validate-drawio-files, validate-excalidraw-files,
  validate-iac-security-baseline. New `_lib/regex-helpers.mjs` (`findAllMatches`) eliminates
  fragile manual `lastIndex` resets. New `_lib/glob-helpers.mjs` (`walkFiles`) provides
  consistent file-walking with symlink detection.
- fix(scripts): remove unnecessary `/g` flag from per-line `.test()` patterns in
  `check-docs-freshness.mjs` (root cause of `lastIndex` fragility).
- refactor(agents): reduce prompt-body duplication by trimming the largest deploy, architect,
  and E2E agents; extract shared deploy, codegen, placeholder-scan, and direct-execution
  protocols into reusable skill references; and raise the advisory large-agent context target
  from 300 to 350 body lines in repo guidance and validators.
- refactor(instructions): replace the monolithic IaC guidance with split Bicep, Terraform,
  and implementation-plan instruction files plus shared policy, security, and cost-monitoring
  references.
- refactor(docs): align repository docs and site docs with `.github/agents`,
  `.github/instructions`, and `.github/skills` as the single source of truth, including
  current subagent names and instruction filenames.
- feat(skills): update the `azure-deploy` skill so a missing `.azure/plan.md` automatically
  triggers the `azure-prepare` then `azure-validate` flow before deployment proceeds.
