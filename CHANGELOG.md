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

- chore(catalog): drop the `(High reasoning)` suffix from the Opus 4.7 label.
  `Claude Opus 4.7 (High reasoning)` and `Claude Opus 4.7` were two distinct
  catalog entries pointing at the same SKU. Reasoning-effort policy is now a
  per-agent decision documented in
  `.github/instructions/agent-authoring.instructions.md` (see the
  "Reasoning-effort policy" subsection), not encoded in the model label.
  Updates: 4 agent frontmatters (Requirements, Architect, IaC Planner,
  Context Optimizer), 4 prompt frontmatters, 5 registry rows, model catalog
  (entries merged + assignments regenerated), vendor-prompting rules and
  fixtures, classify-model test, and supporting docs. Historical changelog
  entries left intact (audit-trail integrity).

### Added

- feat(agents): migrate the three remaining GPT-5.4 main agents
  (`07b-bicep-deploy`, `07t-terraform-deploy`, `08-as-built`) to `GPT-5.5`
  with outcome-first body rewrites (`Role` / `# Goal` / `# Success criteria`
  / `# Constraints` / `# Output` / `# Stop rules`). `08-as-built` gains a
  `## Subagent Budget` H2 for symmetry with the deploy agents. `GPT-5.4`
  flipped to `deprecated: true` in `.github/model-catalog.json` with zero
  remaining active assignments — the GPT-5.4 cohort is fully retired.
  `GPT-5.5` `use_for` adds `deployment-execution` and
  `as-built-documentation`. The cross-family gap between
  `as-built-from-azure.prompt.md` (GPT-5.5) and its target `08-As-Built`
  agent is closed (both same-family). The orphan
  `review-imported-iac.prompt.md` (previously GPT-5.4) is also migrated to
  `GPT-5.5`. `lint-model-alignment.mjs` gains a `gpt-5.5` classifier branch
  (pre-existing blind spot — every existing GPT-5.5 agent previously
  classified as `unknown`). `.github/skills/vendor-prompting/rules.json`
  cleaned of retired GPT-5.4 family registry entry,
  `gpt55-skeleton-001.family_overrides`, and
  `gpt-no-claude-xml-001`/`personality-scoping-001` `model_families` arrays.
  `e2e-orchestrator` (was Claude Opus 4.7 (High reasoning), now `GPT-5.5`)
  also rewritten in the GPT-5.5 outcome-first style. Catalog gains a new
  `Claude Opus 4.7` (no reasoning suffix) entry used by `09-Diagnose`.
- feat(agents): migrate the Orchestrator (was Claude Opus 4.7 (High reasoning))
  and the Sonnet 4.6 cohort (Orchestrator Fast Path, Design, Governance,
  Bicep CodeGen, Terraform CodeGen, Challenger, challenger-review-subagent)
  to `GPT-5.5`. Eight agents + one subagent receive full GPT-5.5 prompt
  rewrites following the OpenAI prompting guide skeleton (Role / Personality
  / Goal / Success / Constraints / Output / Stop), layered around the
  existing required sections (output_contract, security baseline, workflow
  contracts) which stay verbatim. Four prompt files swap accordingly
  (`01-orchestrator.prompt.md`, `resume-workflow.prompt.md`,
  `04-design.prompt.md`, `as-built-from-azure.prompt.md` — the last
  intentionally GPT-5.5 even though it invokes the GPT-5.4 08-As-Built
  agent, to keep the prompt-author UX consistent across the migrated
  cohort). Eight registry rows updated. Orchestrator self-reference body
  table corrected (high-row 'Code Gen' attribution fixed; low-row tier
  retired in favor of a footnote pointing at the registry). The six
  Opus 4.7 agents (Requirements, Architect, IaC Planner, Diagnose, Context
  Optimizer, E2E Orchestrator) and the GPT-5.4 / GPT-5.3-Codex agents and
  subagents are unchanged.
- chore(catalog): redesign `.github/model-catalog.json` as model metadata
  (`models`, hand-maintained label allow-list) plus auto-generated
  `assignments` (mirrored from frontmatter). Adds `governance` block
  documenting the source-of-truth chain. Replaces the retired `floors`
  block. Adds `GPT-5.5` (tier `balanced`) and marks `Claude Sonnet 4.6`
  `deprecated: true`.
- feat(tools): add `generate-model-catalog.mjs` (rebuilds `assignments`
  from frontmatter; `--check` mode for CI drift detection) and
  `validate-model-catalog.mjs` (enforces label allow-list, assignments
  match generator output, deprecated models absent from active
  assignments). Wired into `validate:_node` / `validate:_node-ci`. Adds a
  lefthook pre-commit hook that auto-regenerates `assignments` whenever an
  agent frontmatter file is staged.
- feat(agents): migrate Opus-tier agents from `Claude Opus 4.6` to
  `Claude Opus 4.7 (High reasoning)`. Updates 7 agent frontmatters
  (Orchestrator, Requirements, Architect, IaC Planner, Diagnose,
  Context Optimizer, E2E Orchestrator), 4 prompt frontmatters
  (`01-orchestrator.prompt.md`, `resume-workflow.prompt.md`,
  `doc-gardening.prompt.md`, `tools/tests/prompts/e2e-analyze-lessons.prompt.md`),
  the 7 corresponding rows in `tools/registry/agent-registry.json`, and the
  Orchestrator self-reference body table. The `Claude Opus 4.6` catalog entry
  is retained with `deprecated: true` for audit history. Sonnet 4.6 / Haiku 4.5
  are unchanged.
- feat(tools): replace `validate-model-floors.mjs` + the `KNOWN_MODELS`
  allow-list in `validate-agent-registry.mjs` with a single
  `validate-model-consistency.mjs` check. The agent's YAML frontmatter
  `model` field is now the single source of truth; the registry mirrors it
  and the catalog is documentation only (not enforced). Adds
  `validate:model-consistency` to `validate:_node` and `validate:_node-ci`;
  removes `lint:model-floors`.
- feat(agents): retire workspace-wide `<!-- Recommended reasoning_effort: ... -->`
  HTML annotation. Removed from 15 agent files (Orchestrator, Requirements,
  Architect, Design, Governance, IaC Planner, Bicep CodeGen, Terraform CodeGen,
  As-Built, Diagnose, Challenger, Context Optimizer, E2E Orchestrator,
  Orchestrator Fast Path, challenger-review-subagent) and from
  `agent-authoring.instructions.md`. `validate-agents.mjs` and
  `lint-model-alignment.mjs` Check 3 (reasoning_effort presence) deleted;
  remaining checks renumbered 4 → 3 (large-agent context_awareness) and
  5 → 4 (investigate_before_answering).

### Changed

- chore(audit): Phase 5 of the Opus 4.7 migration audited the 7 Opus agents
  end-to-end against Anthropic's published 4.7 behavioral changes. Strengthened
  the Orchestrator's gate-1 challenger pass language (now declared "**Mandatory:**…
  not optional and must not be skipped") and rewrote `## Resuming a Project`
  to require a 3-signal absence (no apex-recall state, no `00-handoff.md`,
  no numbered artifacts) before treating a project as new — mitigating 4.7's
  stricter literalism on empty `apex-recall show` responses. Audit table
  archived under `tmp/phase5-opus-audit-table.md`.
- docs: update `agent-authoring.instructions.md` § `model` to document the
  new source-of-truth (frontmatter canonical, registry mirrors, catalog is
  documentation), the array/string/JSON-string frontmatter form mandate, and
  the YAML-bareword forbidden form. Update `[claude-guide]:` reference link
  to the current `platform.claude.com` URL.

- refactor(hooks): consolidate agent hooks — merge `governance-audit/` and
  `session-logger/` into single `session-telemetry/` directory. Adds `tool-audit/`
  (PostToolUse metadata logging), gitleaks pre-commit guard, bats-based hook
  test suite, and CI enforcement. Lefthook pre-commit consolidated (5→2 validator
  commands, parallel enabled) and post-commit removed (checks migrated to pre-push).

- refactor(tools): consolidate tests under `tools/tests/`.
  Moves `tests/` → `tools/tests/`. Updates npm test commands,
  markdownlint excludes, and documentation references.

- refactor(tools): consolidate validation scripts under `tools/scripts/`.
  Moves `scripts/` → `tools/scripts/`. Updates 45+ npm scripts, lefthook
  hooks, CI workflows, instruction applyTo globs, and documentation.

- refactor(tools): consolidate registry files under `tools/registry/`.
  Moves `.github/agent-registry.json` and `.github/count-manifest.json`
  to `tools/registry/`. Updates path references across scripts, agents,
  skills, instructions, prompts, workflows, and documentation.

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
