---
description: "Conduct a phased, dependency-aware review of the entire project. Builds a transient review-index first, then walks every domain in upstream-to-downstream order with explicit blast-radius analysis at each gate."
agent: agent
model: "Claude Opus 4.7 (High reasoning)"
tools:
  - vscode
  - read
  - search
  - execute
  - agent
  - edit
  - todo
  - "azure-mcp/*"
  - "microsoft-learn/*"
argument-hint: "Optional: scope to one domain (validators, registries, agents, prompts, skills, instructions, iac, mcp, site, tests) or 'all'"
---

# Project-Wide Dependency-Aware Review

<investigate_before_answering>
This is a multi-domain audit. Cross-domain edges (prompt→agent, agent→skill,
script→npm-script→hook→CI, instruction→validator→rule registry) are easy to
break silently. Before proposing ANY change, confirm:

- The transient review-index has been built (Phase 0).
- For every finding, both upstream producers AND downstream consumers are listed.
- The user has approved the gate before moving to the next phase.

If review-index is missing or stale, re-build it. Do not infer edges from memory.
</investigate_before_answering>

<context>
This repo is APEX (Azure Agentic Platform Engineering eXperience). It contains:

- Custom agents and subagents under `.github/agents/`
- Skills under `.github/skills/`
- Instructions under `.github/instructions/`
- Prompts under `.github/prompts/` and `tools/tests/prompts/`
- IaC under `infra/bicep/` and `infra/terraform/`
- MCP servers under `tools/mcp-servers/`
- Validators under `tools/scripts/`
- Tests under `tools/tests/`
- Astro docs site under `site/`
- Registries: `tools/registry/agent-registry.json`,
  `tools/registry/count-manifest.json`,
  `.github/model-catalog.json`,
  `.github/skills/vendor-prompting/rules.json`,
  `.github/skills/workflow-engine/templates/workflow-graph.json`
- Pre-commit + pre-push hooks via `lefthook.yml`

The project conventions and validation matrix live in `AGENTS.md`,
`.github/copilot-instructions.md`, and the per-folder `AGENTS.md` files.

Read these orientation files BEFORE Phase 0:

- `AGENTS.md` (root project conventions)
- `.github/copilot-instructions.md` (Copilot orchestration)
- `tools/registry/agent-registry.json` (agent inventory)
- `tools/registry/count-manifest.json` (entity counts; do NOT hard-code)
- `.github/skills/workflow-engine/templates/workflow-graph.json` (DAG)
- `lefthook.yml` (pre-commit / pre-push wiring)
- `package.json` (npm script catalog)

`{project}` for output paths in this prompt is the timestamped review folder
(see Phase 0 for the path).
</context>

<task>
Run the phases below in order. Stop at every gate; require user approval
before advancing. Do NOT batch phases.

## Phase 0 — Build the transient review-index

Goal: produce one JSON file that the rest of the review reads instead of
re-reading every body. This is the "knowledge graph" for this session.

1. Create `agent-output/_baselines/review-{ISO-timestamp}/`. Use that as
   `{project}` for all subsequent outputs.
2. Aggregate into `review-index.json`:
   - `agents[]` — from `tools/registry/agent-registry.json` plus parsed
     frontmatter (name, model, family, body_lines, declared skills,
     handoffs).
   - `subagents[]` — same shape, scoped to `_subagents/`.
   - `skills[]` — directory walk of `.github/skills/`; capture
     `description`, `applyTo`-style usage, and which agents reference
     each skill (via `agent-registry.json` + grep for `Read .github/skills/`).
   - `instructions[]` — directory walk of `.github/instructions/`;
     capture `applyTo` glob and any cross-references to other
     instructions, skills, or scripts.
   - `prompts[]` — both `.github/prompts/` and `tools/tests/prompts/`;
     capture frontmatter (`agent`, `model`, `description`) and the
     resolved effective family.
   - `validators[]` — every `tools/scripts/validate-*.mjs` and
     `lint-*.mjs`; for each, capture the file globs it walks and the
     rule IDs it emits (grep for `ruleId:` strings).
   - `npm_scripts[]` — every entry in `package.json` `scripts`; resolve
     each to the underlying script file and the validators it invokes.
   - `hooks[]` — pre-commit and pre-push entries from `lefthook.yml`,
     each with the npm script(s) it runs.
   - `ci_workflows[]` — every `.github/workflows/*.yml` and the npm
     scripts each job runs.
   - `iac_projects[]` — directories under `infra/bicep/` and
     `infra/terraform/` with their `azure.yaml` (when present) and the
     AVM modules they reference.
   - `mcp_servers[]` — directories under `tools/mcp-servers/` with
     entry points and dependent npm/python packages.
   - `site_pages[]` — files under `site/src/content/docs/` with their
     `astro.config.mjs` sidebar position.
3. Compute cross-domain edges:
   - prompt → agent → skill → instruction
   - validator → rule registry (`vendor-prompting/rules.json`)
   - npm script → script file → validator(s) → hook(s) → CI workflow(s)
   - skill → consuming agents (reverse index)
   - instruction `applyTo` → file globs that match
4. Save `agent-output/_baselines/review-{timestamp}/review-index.json`.
5. Save a one-page human summary at `review-index-summary.md` with
   counts and any orphans detected (skills not read by any agent,
   validators not wired to npm scripts, etc.).
6. **Gate 0**: present counts, top-5 orphans, and ask the user for
   the review scope (full / single domain / specific files).

## Phase 1 — Validators & enforcement infrastructure

Order matters: validators are upstream of every other domain. If a
validator is broken, all downstream findings are unreliable.

For each `tools/scripts/validate-*.mjs` and `lint-*.mjs`:

1. Confirm it is wired into `package.json` and into `lefthook.yml`
   (pre-commit or pre-push) and into a CI workflow. List orphans.
2. Confirm its rule IDs (when applicable) match the registries:
   `vendor-prompting/rules.json`, schemas under `tools/schemas/`.
3. Run it once, capture pass/fail.
4. Identify each validator's blast radius — i.e., which files it
   guards. Save to the domain report.

Domain report: `agent-output/_baselines/review-{timestamp}/01-validators.md`.

**Gate 1**: present orphan/broken-validator findings; ask before fixing.

## Phase 2 — Registries & schemas

Sources of truth:

- `tools/registry/agent-registry.json` (+ schema)
- `tools/registry/count-manifest.json` (+ generator script)
- `tools/registry/source-freshness.json`
- `.github/model-catalog.json` (+ generator)
- `.github/skills/vendor-prompting/rules.json`
- `.github/skills/workflow-engine/templates/workflow-graph.json`
- `tools/schemas/*.schema.json`

For each registry: confirm schema, regenerate (where applicable),
diff against committed version, list dependents that read from it
via the review-index.

Domain report: `02-registries.md`.

**Gate 2**: any drift between regenerated and committed versions
requires user approval before re-staging.

## Phase 3 — Workflow graph + agents + subagents

Order: workflow-graph → agents → subagents (subagents are leaves).

1. Validate the DAG (`validate-workflow-graph.mjs`) and the workflow
   table sync (`lint:workflow-table-sync`).
2. For every agent:
   - Frontmatter health (vendor-prompting rules from prior sweep).
   - Body alignment with vendor (Claude XML idioms / GPT-5.5
     skeleton, per family in the review-index).
   - Handoff coverage: every handoff target exists; every handoff
     prompt has input + output references (`handoff-enrichment-001`).
   - Skill usage: every declared skill exists; every skill the body
     reads is declared.
3. For every subagent: `user-invocable: false`, no leaks of
   personality blocks, body matches family conventions.

Domain report: `03-agents.md`. Include a table of "agents that
share skills" and "agents whose handoffs depend on each other" so
upstream impact is explicit.

**Gate 3**: any rename / deletion proposal must list every dependent
in the review-index before approval.

## Phase 4 — Skills & instructions

Order: skills upstream of agents (skills are libraries); instructions
upstream of skills (instructions define authoring contracts).

1. For every instruction file: `applyTo` glob matches real files;
   description is non-empty; cross-references resolve.
2. For every skill: `SKILL.md` size ≤ MAX_SKILL_LINES_WITHOUT_REFS
   (or has a `references/` directory); `description` triggers
   correctly; `SKILL.digest.md` and `SKILL.minimal.md` exist when
   the agent definition mentions context-shredding.
3. Detect orphan skills (no agent references) and orphan instructions
   (`applyTo` matches no file).

Domain report: `04-skills-instructions.md`.

**Gate 4**: orphan removals require user approval (could be deferred
work, not garbage).

## Phase 5 — Prompts

Per the prior alignment sweep, prompts that target a custom agent
must NOT declare `model:`; generic prompts MUST. Verify and report.

Domain report: `05-prompts.md`.

**Gate 5**: any `model:` rule violations are HARD errors.

## Phase 6 — IaC

For each project under `infra/bicep/` and `infra/terraform/`:

1. Run `bicep build` + `bicep lint` OR `terraform fmt -check` +
   `terraform validate`.
2. Confirm AVM-first compliance (raw resources flagged).
3. Confirm the `azure.yaml` exists and points at the right
   `infra/{tool}/{project}/` path.
4. Run `npm run validate:iac-security-baseline`.

Domain report: `06-iac.md`.

**Gate 6**: any security-baseline violation is a HARD error.

## Phase 7 — MCP servers & ad-hoc tooling

For each `tools/mcp-servers/<server>/`:

1. Confirm tests pass.
2. Confirm wired into `.vscode/mcp.json` (or documented as standalone).
3. Confirm package version matches `pyproject.toml` / `package.json`.

Domain report: `07-mcp.md`.

## Phase 8 — Site (Astro docs)

1. Confirm `astro.config.mjs` sidebar matches `site/src/content/docs/`
   tree.
2. Run `npm run docs:build` to detect broken refs.
3. Confirm count-driven pages (e.g., agent count) read from
   `count-manifest.json` instead of hard-coded numbers.
4. Cross-check key claims against the review-index (number of agents,
   skills, validators).

Domain report: `08-site.md`.

## Phase 9 — Tests & CI hooks

1. List every test under `tools/tests/`. Confirm each is invoked by
   an npm script + by lefthook or a CI workflow.
2. Run the test suites that are scoped to the changes.
3. Verify the `lefthook.yml` `parallel: false` invariant still holds
   (per `tools/registry/model-catalog.md` memory note).

Domain report: `09-tests-ci.md`.

## Phase 10 — Cross-domain consistency

Use the review-index to detect issues no single-domain pass can find:

- A prompt referencing an agent that no longer exists.
- An agent declaring a skill that no agent registry entry includes.
- A validator emitting a rule ID not in any registry.
- An npm script that no hook or workflow runs.
- A site doc page citing a count that drifts from `count-manifest.json`.
- An instruction file with `applyTo` matching files that no other
  domain references.

Domain report: `10-cross-domain.md`.

## Phase 11 — Master report

Aggregate all per-domain reports into:

- `00-master-review.md` — executive summary, top-N blockers,
  recommended action plan with explicit upstream/downstream notes.
- `00-action-plan.md` — every recommended fix with: blast radius,
  dependents from the review-index, severity (blocker / high / medium
  / low / info), estimated effort.

**Final gate**: user reviews master report; chooses which fixes to
implement (or defers everything to follow-up sweeps).
</task>

<rules>
- Do NOT modify any file in Phases 0–10. Phases produce findings and
  domain reports only. Implementation happens after the final gate
  approves an action plan.
- Always use `tools/registry/count-manifest.json` for counts; never
  hard-code.
- Use the review-index as the dependency map. If a phase cannot find
  a dependent in the index, re-run Phase 0 — do NOT guess.
- Stop at every gate. Do not chain phases.
- Use `apex-recall` to checkpoint after each gate so a fresh chat can
  resume without rebuilding the index.
- Defer cosmetic/style issues (e.g., handoff-enrichment baseline,
  density-rule info-level findings) to a separate sweep unless the
  user explicitly opts in.
- For every finding, include: file path with line number, rule or
  invariant violated, upstream producers, downstream consumers,
  severity, suggested fix.
</rules>

<output_contract>
- `agent-output/_baselines/review-{timestamp}/review-index.json` —
  transient dependency map (Phase 0).
- `agent-output/_baselines/review-{timestamp}/review-index-summary.md` —
  human-readable counts + orphans (Phase 0).
- `agent-output/_baselines/review-{timestamp}/0{N}-{domain}.md` — one
  domain report per phase 1–10.
- `agent-output/_baselines/review-{timestamp}/00-master-review.md` —
  executive summary.
- `agent-output/_baselines/review-{timestamp}/00-action-plan.md` —
  prioritized fix list with blast-radius notes.

Final chat output to user: artifact paths + top-5 blockers, no
embedded artifact bodies. Always paths.
</output_contract>
