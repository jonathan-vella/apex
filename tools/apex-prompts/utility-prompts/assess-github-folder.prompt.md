---
description: "Assess the .github folder (agents, skills, instructions, copilot-instructions.md) and produce a prioritized, read-only remediation plan. Plans only — never edits in the same pass."
model: "Claude Opus 4.8"
agent: agent
tools:
  - read
  - search
  - execute
  - todo
argument-hint: "Optional: scope to one domain (agents | skills | instructions | copilot-instructions | all). Defaults to all."
---

# .github Folder Assessment → Remediation Plan

<investigate_before_answering>
This is a static audit of authoring assets. Findings are unreliable if the
inventory is guessed from memory. Before proposing ANY finding, confirm:

- The assessment index (Phase 0) has been built from a real directory walk.
- Each finding cites a concrete rule (file + limit) or a validator failure.
- Both producers and consumers of each asset are listed (reverse index).

Do NOT edit any agent, skill, instruction, or copilot-instructions.md in this
pass. This prompt produces a PLAN; execution is a separate, gated pass.
</investigate_before_answering>

<context>
This repo is APEX (Azure Agentic Platform Engineering eXperience). Scope is
limited to the authoring assets under `.github/`:

- `.github/agents/**/*.agent.md` (+ `_subagents/`)
- `.github/skills/**/SKILL.md` (+ `references/`)
- `.github/instructions/*.instructions.md`
- `.github/copilot-instructions.md`

Authoritative rule sources to check against (read on demand, do not restate):

- `.github/instructions/context-optimization.instructions.md` (hard limits)
- `.github/instructions/agent-authoring.instructions.md`
- `.github/instructions/instructions.instructions.md`
- `.github/instructions/agent-skills.instructions.md`
- `.github/instructions/vendor-prompting.instructions.md`
- `.github/instructions/no-hardcoded-counts.instructions.md`
- `tools/registry/agent-registry.json`, `tools/registry/count-manifest.json`

Do NOT hard-code entity counts — read them from `count-manifest.json`.

This prompt is the lean `.github`-only complement to
`tools/apex-prompts/utility-prompts/project-wide-review.prompt.md` (whole-repo,
dependency-aware sweep) and `context-audit.prompt.md` (token/context audit from
debug logs). Reuse their patterns; do NOT duplicate their phases.

`{ts}` in output paths is a UTC timestamp: `$(date -u +%Y%m%dT%H%M%SZ)`.
</context>

<task>
Run phases in order. Stop at the Gate; require approval before any edit pass.

## Argument-hint scoping

If the user supplied a single-domain hint (`agents`, `skills`, `instructions`,
`copilot-instructions`), still run **Phase 0** (index), then evaluate only the
matching scope in Phases 1–3, then run **Phase 4** scoped to that domain. If
the hint is `all` or absent, evaluate every scope.

## Phase 0 — Build the assessment index (read-only)

Walk the four scopes. For each asset capture: path, family/model (agents),
body line count, tool count, handoff count, declared vs body-referenced
skills, `applyTo` glob (instructions), and cross-references. Compute a
reverse index: skill → consuming agents; instruction prose → files that
duplicate it. Save `agent-output/_baselines/gh-assess-{ts}/index.json` plus a
one-page `index-summary.md` listing counts and orphans (skills no agent reads,
instructions matched by no file glob).

## Phase 1 — Errors & rule violations

- Run: `npm run validate:agents`, `npm run validate:agent-registry`,
  `npm run lint:vendor-prompting`, `npm run lint:md`, `npm run lint:safe-shell`.
  Record every failure as a finding.
- Flag every breach of the context-optimization limits (agent body >350 lines,
  tools >30, skill-reads >5, handoffs >8, instruction file >150 lines,
  SKILL.md >500 lines).

## Phase 2 — Overlap & DRY

- Identify duplicated guidance across instructions/skills/agents that should
  collapse to one file + `applyTo` glob.
- Flag skills no agent reads, instructions with overly broad `applyTo`
  (e.g. `**`), and `copilot-instructions.md` content that restates an
  instruction file instead of linking to it.

## Phase 3 — Workflow simplification & token efficiency

- Trace handoff chains and the workflow DAG
  (`.github/skills/workflow-engine/templates/workflow-graph.json`) for redundant
  hops or unused branches.
- Estimate per-agent context cost and name the top token sinks (largest bodies,
  widest tool lists, bulk skill loads).

## Phase 4 — Synthesize the plan

Produce a ranked remediation plan: each item = finding, affected files, blast
radius, proposed change, expected token/quality impact, effort. Group by
severity (blocker / high / medium / low) and by goal (errors, overlap, tokens,
workflow, quality).

## Gate — Approval before execution

Present the plan. Do NOT edit anything until the user approves and explicitly
starts an execution pass.
</task>

<output_contract>

- `agent-output/_baselines/gh-assess-{ts}/index.json` — inventory + reverse index
- `agent-output/_baselines/gh-assess-{ts}/index-summary.md` — counts + orphans
- `agent-output/_baselines/gh-assess-{ts}/assessment-plan.md` — ranked plan,
  resumable from a fresh chat (findings table + decisions log)
- A chat summary with the top 5 highest-leverage changes
  </output_contract>

<rules>

- Read-only. No edits to `.github/**` in this pass.
- Every finding cites a rule (file + limit) or a validator failure — no vibes.
- Reuse `project-wide-review.prompt.md` patterns; do not duplicate its
  whole-repo phases.
- Obey `no-hardcoded-counts` — counts come from `count-manifest.json`.
  </rules>
