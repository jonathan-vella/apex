---
description: Trigger conditions for updating documentation when code changes. Defines WHEN docs need updating — not HOW to write them (see docs.instructions.md and markdown.instructions.md for formatting).
applyTo: "**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}"
---

# Update Documentation on Code Change

## Purpose

Detect when code changes require documentation updates. This instruction
complements the existing documentation standards:

- **docs.instructions.md** — content principles, architecture tables
- **markdown.instructions.md** — formatting, line limits, validation
- **docs-writer skill** — full doc maintenance workflows

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
- Bicep module structure changes (new modules, renamed parameters)

## What to Update

### [README.md (root)](../../README.md)

Update when:

- New agents or skills are added (update tables and counts)
- Project structure changes (update tree diagram)
- New capabilities are introduced (update feature list)

### [docs/README.md](../../docs/README.md)

Update when:

- Agent or skill inventory changes (update tables)
- New documentation files are added (update quick links)

### [docs/prompt-guide/README.md](../../docs/prompt-guide/README.md)

Update when:

- Agents or skills are added, renamed, or removed
- Agent capabilities change significantly

### [CHANGELOG.md](../../CHANGELOG.md)

Update when:

- Any user-facing change is made (follow Keep a Changelog format)
- Use conventional commit type to determine section (Added, Changed,
  Fixed, Removed, Deprecated, Security)

### docs-writer References

Update when:

- Instruction files are added or removed
  (`references/repo-architecture.md` — instruction table and count)
- Agent or skill inventory changes
  (`references/freshness-checklist.md` — expected counts)

## Verification

After updating documentation:

1. Run `npm run lint:md` — zero errors required
2. Run `npm run lint:docs-freshness` — zero findings required
3. Verify all relative links resolve to existing files
