---
description: "Prevents hard-coded numeric counts for project entities (agents, skills, instructions, validators). Enforces descriptive language and count-manifest.json as single source of truth."
applyTo: "**/*.md, **/*.json, **/*.mjs"
---

# No Hard-Coded Counts

Hard-coded numeric counts for project entities drift silently and create maintenance
nightmares. This instruction eliminates that class of bug.

## Rule

**NEVER** hard-code counts of agents, subagents, skills, instructions, validators,
workflow steps, VS Code extensions, or MCP tools in prose, tables, or comments.

## What to Do Instead

Use **descriptive language** that stays true regardless of count changes:

| Instead of                             | Write                                                |
| -------------------------------------- | ---------------------------------------------------- |
| "16 top-level agents and 11 subagents" | "a set of specialized agents and subagents"          |
| "38 GA skills"                         | "the full skill catalog"                             |
| "25 instruction files"                 | "instruction files with glob-based auto-application" |
| "7-step workflow" or "8-step workflow" | "the multi-step workflow"                            |
| "27 validators"                        | "the validation suite"                               |
| "13 pricing tools"                     | "a suite of pricing query tools"                     |
| "26 pre-installed extensions"          | "pre-installed VS Code extensions"                   |

## When Exact Counts ARE Needed

Reference `.github/count-manifest.json` as the single source of truth. Validators
auto-compute actual values from filesystem globs defined in that file.

Files **allowed** to contain counts (the allowlist):

- `.github/count-manifest.json` — the manifest itself
- `CHANGELOG.md` — historical entries describe what changed at a point in time
- `QUALITY_SCORE.md` Change Log column — historical records of state changes
- Validator script output — computed dynamically, not hard-coded

## Workflow Steps

The workflow includes Step 3.5 (Governance) which makes "7 steps" and "8 steps"
both technically correct depending on counting method. To eliminate this ambiguity:
always say **"multi-step workflow"** — never count steps.
