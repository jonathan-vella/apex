---
description: "Prevents hard-coded numeric counts for project entities (agents, skills, instructions, validators). Enforces descriptive language and count-manifest.json as single source of truth."
applyTo: ".github/**/*.{md,json}, tools/scripts/**/*.mjs, AGENTS.md, README.md, CHANGELOG.md, QUALITY_SCORE.md, VERSION.md"
---

# No Hard-Coded Counts

Hard-coded entity counts drift silently.

## Rule

**NEVER** hard-code counts of agents, subagents, skills, instructions, validators,
workflow steps, VS Code extensions, or MCP tools in prose, tables, or comments.

## What to Do Instead

Use **descriptive language** that stays true regardless of count changes:

| Instead of                             | Write                                                |
| -------------------------------------- | ---------------------------------------------------- |
| "16 top-level agents and 11 subagents" | "a set of specialized agents and subagents"          |
| "25 instruction files"                 | "instruction files with glob-based auto-application" |
| "7-step workflow" or "8-step workflow" | "the multi-step workflow"                            |

Apply the same pattern to skills, validators, pricing tools and extensions.

## When Exact Counts ARE Needed

Reference `tools/registry/count-manifest.json` as the single source of truth. Validators
auto-compute actual values from filesystem globs defined in that file.

Files **allowed** to contain counts (the allowlist):

- `tools/registry/count-manifest.json` — the manifest itself
- `CHANGELOG.md` — historical entries describe what changed at a point in time
- `QUALITY_SCORE.md` Change Log column — historical records of state changes
- Validator script output — computed dynamically, not hard-coded

## Workflow Steps

Step 3.5 (Governance) makes "7 steps" and "8 steps" both defensible, so always say
**"multi-step workflow"** — never count steps.
