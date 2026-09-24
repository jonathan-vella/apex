---
description: Required documentation updates for product changes; published documentation belongs to apex-docs.
applyTo: "**/*.agent.md, **/.github/skills/**/SKILL.md, **/tools/scripts/*.mjs"
---

# Update Documentation on Code Change

Required documentation updates do not depend on loading a skill. Apply these triggers during
routine code work; formatting follows `markdown.instructions.md`. Published documentation is
maintained in `jonathan-vella/apex-docs` (`src/content/docs/` in a separate checkout) — do not
create or edit a local `site/` directory in APEX.

## Trigger Conditions

- New features or capabilities, breaking changes, setup or install changes
- CLI commands or scripts added/modified; dependencies or requirements changed
- Configuration options or environment variables modified; doc code examples outdated
- Agent or skill definitions are added, renamed, or removed
- Model assignments, invocation permissions, or Local / Agent Host entry points change
- Bicep module structure changes (new modules, renamed parameters)

## What to Update

| Target | Update when | Notes |
| ------ | ----------- | ----- |
| [README.md (root)](../../README.md) | Agent/skill inventory, project structure or capabilities change | Derive counts from `count-manifest.json` |
| Release notes | Any user-facing change | Record in the PR and apex-docs; section by conventional-commit type |
| apex-docs | Agents or skills added, renamed, removed or significantly changed; new doc files | Separate repository |
| Runtime references | Instruction files added/removed; agent or skill inventory changes; entry points retired; harness behavior changes | Update callers and tests; regenerate the Explorer registry; keep historical evidence; distinguish Local prompt adapters from shared skills on Agent Host without cost-tier inference |

## Verification

After updating documentation:

1. Run `npm run lint:md` — zero errors required
2. Run `npm run lint:docs-freshness` — zero findings required
3. Verify all relative links resolve to existing files
