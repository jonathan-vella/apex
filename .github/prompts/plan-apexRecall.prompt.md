---
name: 'Plan: apex-recall'
description: 'Implementation plan for the apex-recall progressive session recall CLI'
agent: 'agent'
---

# Plan: Add apex-recall to APEX

## TL;DR

Build `apex-recall` as a pip-installable Python CLI under `tools/apex-recall/`. It indexes
`agent-output/` into a local SQLite + FTS5 database and gives agents a low-token way to
recover recent project context.

Integration is two-layered:

1. **Skill layer** — the `session-resume` skill (SKILL.md, digest, minimal) documents the
   progressive disclosure protocol. Already done.
2. **Agent body layer** — each agent that resumes sessions gets a 2-line instruction in its
   `.agent.md` body to run `apex-recall` before reading raw artifact files. This is required
   because agents read their own body first and may never load the skill.

## Working Decisions

- **CLI, not MCP**: avoid tool-schema overhead for a utility that is only useful at specific
  workflow moments.
- **Single canonical name**: use `apex-recall` everywhere. Reserve `session-resume` for the
  existing skill. Do not introduce `session-recall` in this repo.
- **No broad instruction file**: do not add `.github/instructions/*.instructions.md` with
  `applyTo: "**"` or similar catch-all scope for this behavior.
- **Integrate via skill + agent bodies**: the skill documents the protocol; agent bodies
  trigger the actual invocation. Both are needed.
- **No manual count/registry churn**: do not touch `.github/count-manifest.json` or
  `.github/agent-registry.json` unless a real new skill is added.
- **Read-only behavior**: `apex-recall` reads indexed artifacts and emits summaries; it does
  not mutate project artifacts.
- **Index scope**: start with `agent-output/` only. Do not index `/memories/repo/` because it
  is a virtual Copilot memory path, not a filesystem path available to ordinary tooling.

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | CLI Core (`tools/apex-recall/`) | DONE |
| 2 | Dev Container Auto-Install | DONE |
| 3a | Session Resume Skill Integration | DONE |
| 3b | Copilot Instructions Integration | DONE |
| 4 | Validation (lint, tests, CI wiring) | DONE |
| 5 | Documentation | DONE |
| — | Digest/Minimal Fix | DONE |
| — | Future: Tooling Consolidation | NOT STARTED (separate workstream) |

---

## Phase 1 — CLI Core (DONE)

Created `tools/apex-recall/` with:
- `pyproject.toml` (pip-installable, zero dependencies)
- `src/apex_recall/` package: `__init__.py`, `__main__.py`, `config.py`, `types.py`,
  `indexer.py`
- `src/apex_recall/commands/`: `files.py`, `sessions.py`, `search.py`, `show.py`,
  `decisions.py`, `reindex.py`, `health.py`

SQLite + FTS5 indexing with auto-staleness detection. Parses session-state JSON, handoff
markdown, step artifact markdown, lessons-learned JSON/markdown, governance JSON.

Indexes: project, step, file_path, artifact_type, modified_time, searchable content.

Progressive disclosure:
- **Tier 1** (~50 tokens): `files --json`, `sessions --json`
- **Tier 2** (~200 tokens): `search`, `decisions`
- **Tier 3** (~500 tokens): `show <project>`

Empty results return structured JSON with exit code 0 (agents fall back to normal reads).

## Phase 2 — Dev Container Auto-Install (DONE)

- `post-create.sh`: Step 11 of 13, installs via `uv pip install --system -e` with pip3
  fallback, smoke-checks `apex-recall --version`
- `post-start.sh`: lightweight refresh via `uv pip install --system --quiet --upgrade -e`
- Index stored at `tmp/.apex-recall.db` (git-ignored via existing `tmp/` rule)

## Phase 3a — Session Resume Skill Integration (DONE)

Updated all three tiers of `.github/skills/session-resume/`:
- `SKILL.md` — full "Fast Recall with apex-recall (Tier 0)" section
- `SKILL.digest.md` — condensed progressive disclosure commands
- `SKILL.minimal.md` — one-liner hint

### Why this alone is insufficient

Debug log analysis proved that agents read their own body and act on it **before** loading
skills. The Orchestrator reads `00-session-state.json` directly from its body's resume logic,
then optionally loads `SKILL.digest.md` as a protocol reference. By the time the skill is
read, the agent has already consumed 3+ file reads of raw artifacts.

## Phase 3b — Copilot Instructions Integration (DONE)

### Problem

13 agents reference `session-resume` in the agent-registry, but skills are loaded on-demand
after the agent has already started acting. Debug logs proved agents read `00-session-state.json`
directly before loading any skill.

### Solution

Added a "Progressive Session Recall — RUN FIRST on Start/Resume" section to
`.github/copilot-instructions.md`. This file is loaded into **every** agent's context
automatically — no need to touch individual agent bodies.

The section follows the same pattern as
[auto-memory's copilot-instructions-template](https://github.com/dezgit2025/auto-memory/blob/main/copilot-instructions-template.md):
a concise block with the exact commands to run and clear fallback behavior.

### Why copilot-instructions.md instead of agent bodies

| Approach | Files touched | Context cost | Covers all agents |
|----------|--------------|-------------|-------------------|
| Edit 13 agent bodies | 13 files | ~30 tokens × 13 | Yes, but brittle (new agents need manual update) |
| copilot-instructions.md | 1 file | ~120 tokens (once, shared) | Yes, automatically for all current and future agents |
| Broad instruction file (`applyTo: "**"`) | 1 file | ~120 tokens | Yes, but plan explicitly ruled this out |

`copilot-instructions.md` is the right middle ground: it's loaded globally but it's the
project's own orchestration config file, not a catch-all instruction file.

### Two scenarios covered

**Scenario A: Orchestrator-driven workflow** — The Orchestrator sees the apex-recall
instructions before it reads `00-session-state.json` or hands off to step agents.

**Scenario B: Direct agent invocation** — Users invoking `@03-Architect` directly also
get the apex-recall instructions because `copilot-instructions.md` is prepended to all agents.

## Phase 4 — Validation (DONE)

- `lint:python` extended to cover `tools/apex-recall/src/`
- `test:apex-recall` wired into `validate:_external` (43 tests)
- `validate:all` passes
- `lint:md` and `lint:docs-freshness` pass
- `apex-recall health --json` is NOT a CI gate (requires runtime data)

## Phase 5 — Documentation (DONE)

Updated: `AGENTS.md`, `README.md`, `CHANGELOG.md`, `.github/copilot-instructions.md`,
`site/src/content/docs/getting-started/dev-containers.md`,
`site/src/content/docs/getting-started/quickstart.md`

## Explicit Non-Goals

- No MCP server for recall
- No broad `applyTo: "**"` instruction file
- No indexing of `/memories/repo/` in the initial implementation
- No registry changes unless a separate real `apex-recall` skill is introduced later
- No manual count edits in `.github/count-manifest.json`
- No bundling of the future tooling-consolidation migration into the apex-recall delivery PR

## Verification Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | `apex-recall` installs automatically in rebuilt devcontainer | PASS |
| 2 | `apex-recall --version` succeeds | PASS |
| 3 | `apex-recall --help` succeeds | PASS |
| 4 | `apex-recall health --json` works as smoke check | PASS |
| 5 | Tier 1 recall returns small structured output | PASS |
| 6 | Tier 2 search finds expected artifacts | PASS |
| 7 | Tier 3 project detail output coherent for real project | PASS |
| 8 | Python lint passes for new package | PASS |
| 9 | Tests pass for new package (43/43) | PASS |
| 10 | Local + CI validation wiring updated | PASS |
| 11 | `npm run validate:all` passes | PASS |
| 12 | `npm run lint:md` passes | PASS |
| 13 | `npm run lint:docs-freshness` passes | PASS |
| 14 | Changed docs have valid relative links | PASS |
| 15 | Session-resume skill describes progressive disclosure | PASS |
| 16 | Skill digest/minimal include apex-recall | PASS |
| 17 | copilot-instructions.md has apex-recall section | PASS |
| 18 | Covers both Orchestrator and direct-invocation agents | PASS (via copilot-instructions.md) |
| 19 | Debug log shows apex-recall terminal invocation | TODO (next session test) |

## Future Phase — Tooling Consolidation

After `apex-recall` ships cleanly, a separate migration can consolidate tooling under `tools/`.
That later effort should remain a separate workstream with its own validation and documentation
plan because it has a large path-reference blast radius across `scripts/`, `mcp/`, `schemas/`,
`.github/agent-registry.json`, and `.github/count-manifest.json`.
