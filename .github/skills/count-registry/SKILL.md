---
name: count-registry
description: "Provides canonical entity counts from count-manifest.json. Use when agents need to reference how many agents, skills, instructions, or validators exist. Prevents hard-coded counts. WHEN: agent count, skill count, how many agents, how many skills, entity inventory, project statistics."
---

# Count Registry

Single source of truth for project entity counts.

## Source of Truth

All counts live in `.github/count-manifest.json`. Validators auto-compute actual
values from filesystem globs. No other file should hard-code these numbers.

## How to Reference Counts

When generating documentation or artifacts that mention entity quantities:

1. **Prefer descriptive language** — "a set of specialized agents and subagents",
   "the full skill catalog", "the multi-step workflow"
2. **When exact numbers are needed**, read `.github/count-manifest.json` and state
   the number with a parenthetical source: "16 primary agents (per count-manifest.json)"
3. **Never hard-code** a count into prose that will be committed to the repo

## Canonical Phrasing Patterns

| Entity             | Canonical phrase                                                                    |
| ------------------ | ----------------------------------------------------------------------------------- |
| Agents             | "specialized agents and subagents"                                                  |
| Skills             | "the skill catalog" or "available skills"                                           |
| Instructions       | "instruction files"                                                                 |
| Validators         | "the validation suite"                                                              |
| Workflow steps     | "the multi-step workflow" (never count steps — Step 3.5 makes any number ambiguous) |
| MCP tools          | "pricing query tools"                                                               |
| VS Code extensions | "pre-installed extensions"                                                          |

## Computed Entities

The manifest defines `computed_from` globs for each entity. The
`validate-no-hardcoded-counts.mjs` validator resolves these globs against
the filesystem and reports any drift between documented and actual counts.

Entities with a static `value` field (e.g., golden principles = 10) are
genuinely fixed and exempt from the no-hard-coding rule.
