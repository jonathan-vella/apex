<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Count Registry (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Source of Truth

All counts live in `.github/count-manifest.json`. Validators auto-compute actual
values from filesystem globs. No other file should hard-code these numbers.

## How to Reference Counts

When generating documentation or artifacts that mention entity quantities:

1. **Prefer descriptive language** — "a set of specialized agents and subagents",
   "the full skill catalog", "the multi-step workflow"
2. **When exact numbers are needed**, read `.github/count-manifest.json` and state
   the number with a parenthetical source: "16 primary agents (per count-manifest.json)"

> _See SKILL.md for full content._

## Canonical Phrasing Patterns

| Entity             | Canonical phrase                                                                    |
| ------------------ | ----------------------------------------------------------------------------------- |
| Agents             | "specialized agents and subagents"                                                  |
| Skills             | "the skill catalog" or "available skills"                                           |
| Instructions       | "instruction files"                                                                 |
| Validators         | "the validation suite"                                                              |

> _See SKILL.md for full content._
