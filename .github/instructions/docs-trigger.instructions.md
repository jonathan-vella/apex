---
description: Trigger conditions for updating documentation when code changes. Defines WHEN docs need updating — not HOW to write them (see docs.instructions.md and markdown.instructions.md for formatting).
applyTo: "**/*.agent.md, **/.github/skills/**/SKILL.md, **/tools/scripts/*.mjs"
---

# Update Documentation on Code Change

## Purpose

Detect when code changes require documentation updates. This instruction
complements the existing documentation standards:

- **docs.instructions.md** — content principles, architecture tables
- **markdown.instructions.md** — formatting, line limits, validation
- **apex-docs-writer skill** — full doc maintenance workflows

## Trigger Conditions

Check if documentation updates are needed when any of these occur:

### Always Trigger

- New features or capabilities are added
- Breaking changes are introduced
- Installation or setup procedures change
- CLI commands or scripts are added/modified
- Dependencies or requirements change

### Check and Update If Applicable

- API endpoints, methods, or interfaces change
- Configuration options or environment variables are modified
- Code examples in documentation become outdated
- Agent or skill definitions are added, renamed, or removed
- Model assignments, invocation permissions, or Local / Agent Host entry points change
- Bicep module structure changes (new modules, renamed parameters)

## What to Update

### [README.md (root)](../../README.md)

Update when:

- Agents or skills change (update inventory references; derive counts from `count-manifest.json`)
- Project structure changes (update tree diagram)
- New capabilities are introduced (update feature list)

### [CHANGELOG.md](../../CHANGELOG.md)

Update when:

- Any user-facing change is made (follow Keep a Changelog format)
- Use conventional commit type to determine section (Added, Changed,
  Fixed, Removed, Deprecated, Security)

### Site docs (`site/src/content/docs/`)

Update when:

- Agents or skills are added, renamed, or removed
- Agent capabilities change significantly
- New documentation files are added

### apex-docs-writer References

Update when:

- Instruction files are added or removed
  (`references/repo-architecture.md` — instruction inventory)
- Agent or skill inventory changes
  (`references/freshness-checklist.md` — inventory checks against `count-manifest.json`)
- Retired entry points or commands disappear; remove live launch guidance but
  preserve historical evidence and schema compatibility records
- Harness behavior changes; distinguish Local prompt adapters from shared skills
  on Agent Host, and document unverified model availability without cost-tier inference

## Verification

After updating documentation:

1. Run `npm run lint:md` — zero errors required
2. Run `npm run lint:docs-freshness` — zero findings required
3. Verify all relative links resolve to existing files
