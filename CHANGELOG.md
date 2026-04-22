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

### Added

- refactor(tools): consolidate MCP servers under `tools/mcp-servers/`.
  Moves `mcp/azure-pricing-mcp/` → `tools/mcp-servers/azure-pricing/` and
  `mcp/drawio-mcp-server/` → `tools/mcp-servers/drawio/`. Updates all path
  references across config, devcontainer, agents, docs, and validation.

- feat(cli): `apex-recall` CLI v0.2.0 for progressive cross-project session recall.
  Indexes `agent-output/` into SQLite + FTS5 for low-token context recovery.
  Owns the full session lifecycle (read + write) via CLI commands; replaces the
  deleted `session-resume` skill.

- refactor(tools): consolidate JSON schemas under `tools/schemas/`.
  Moves `schemas/*.schema.json` → `tools/schemas/`. Updates all `$schema`,
  `$id`, path constants, and documentation references.

### Changed

- feat(governance): `schemas/governance-constraints.schema.json` is now
  enforced at validation time. `scripts/validate-artifacts.mjs` compiles the
  schema with AJV (draft 2020-12) and validates every
  `agent-output/*/04-governance-constraints.json` artifact in Step 5b. Drops
  the schema from advisory-only to hard-gate for the JSON companion.
- feat(governance): structured policy-override pattern — `04g-Governance` now
  emits Deny findings with an optional `override` block (`reason`, `issue_link`,
  `expiry`) instead of silently dropping overridden policies. Codegen agents
  (`06b`/`06t`) treat overrides as informational warnings and inject
  `// OVERRIDE <id> until <date> — see <issue>` banner comments above affected
  resources; missing fields or past expiry fail closed. JSON shape captured in
  new `schemas/governance-constraints.schema.json` (`schema_version:
governance-constraints-v1`) for future AJV enforcement.
- fix(agents): normalise `e2e-orchestrator.agent.md` model frontmatter to the
  standard array form `["Claude Opus 4.6"]` (was the only agent using the
  `"Claude Opus 4.6 (copilot)"` string form).
- feat(orchestrator): document the complexity auto-calc procedure in
  `01-orchestrator.agent.md` — formula read from `workflow-graph.json`
  `metadata.complexity_routing`, inputs sourced from architecture + governance
  artefacts, result persisted at `decisions.complexity` so every downstream
  agent reads the same value.
- docs: admonition taxonomy (`note`/`tip`/`caution`/`danger`) and mandatory
  `## Related` footer pattern documented in `docs.instructions.md`; footers
  added to the 6 guide pages that lacked them.
- feat(drawio): 10-point visual-quality rubric (title, footer, legend, grouping,
  spacing, palette, edge labels, canonical icons, anchor stability, cross-cutting
  container) added to `.github/skills/drawio/references/validation-checklist.md`
  with `automated?`/rationale columns. Formalise APEX palette (compute `#E7F5FF`,
  data `#FFF2CC`, security `#FFE6E6`, networking `#E6F5E6`, governance `#F5F5F5`),
  typography (title 14–16pt, service 11pt, footer 9pt), and spacing (40/80/120 px)
  in `style-reference.md`. `scripts/validate-drawio-files.mjs` adds an advisory
  palette-drift check on `03-des-*`, `04-*-diagram`, `07-ab-*`, and `showcase-*`
  files; promote to blocking with `APEX_DRAWIO_RUBRIC=strict` (default advisory
  until 0.12.0).
- perf(mcp): Azure Pricing MCP — raise HTTP pool ceiling 10→20 (per-host 5→10)
  and dedup cache TTL 30s→300s / capacity 100→512 entries, configurable via
  `AZURE_PRICING_HTTP_POOL_SIZE`, `AZURE_PRICING_HTTP_POOL_PER_HOST`,
  `AZURE_PRICING_DEDUP_TTL`, `AZURE_PRICING_DEDUP_MAX_ENTRIES`. Defaults also
  surfaced in `.vscode/mcp.json`. Cuts repeated-query latency on multi-region
  bulk estimates; retail prices refresh at most hourly so 5-min reuse is safe.
- feat(agents): add `.github/model-catalog.json` (single source of allowed Copilot
  models with vendor, tier, release date, and deprecation flag) plus
  `scripts/validate-model-floors.mjs` wired into `validate:_node` and CI. Extend
  `.github/skills/workflow-engine/templates/workflow-graph.json` with a
  deterministic `complexity_routing` formula (resource count, policy violations,
  IaC-tool weight → passes) so orchestrators auto-route challenger passes from
  session state instead of guessing.
- docs: single-source glossary — `docs/GLOSSARY.md` is now a 9-line stub pointing
  to `site/src/content/docs/reference/glossary.md` (removes 570-line duplicate,
  fixes circular `#orchestrator` self-link, moves Orchestrator to its own `## O`
  section). Clarify `VERSION.md` 0.10.0 status as pre-release/Unreleased.
- chore(instructions): narrow overly-broad `applyTo` globs on `no-heredoc`,
  `no-hardcoded-counts`, `markdown`, and `code-quality` to reclaim context budget
  on every agent load. Merge `agent-research-first.instructions.md` into
  `agent-authoring.instructions.md` (single source). Upgrade
  `scripts/validate-glob-audit.mjs` to flag any `applyTo: "**"` plus oversized
  `**/*.md` globs.
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
