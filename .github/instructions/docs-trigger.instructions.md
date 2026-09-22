---
description: Required documentation updates for product changes; published documentation belongs to apex-docs.
applyTo: "**/*.agent.md, **/.github/skills/**/SKILL.md, **/tools/scripts/*.mjs"
---

# Update Documentation on Code Change

## Purpose

Detect when code changes require documentation updates. This instruction
complements the existing documentation standards:

- **markdown.instructions.md** — formatting, line limits, validation

Required documentation updates do not depend on loading a skill. Apply these triggers and the file's writing
instructions during routine code work. Published documentation is maintained in `jonathan-vella/apex-docs`.

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

### Release Notes

Update when:

- Any user-facing change is made (record it in the PR and the published documentation repository)
- Use conventional commit type to determine section (Added, Changed,
  Fixed, Removed, Deprecated, Security)

### Published Docs (Separate `apex-docs` Repository)

Use `src/content/docs/` in a separate `jonathan-vella/apex-docs` checkout.
Do not create or edit a local `site/` directory in APEX.

Update when:

- Agents or skills are added, renamed, or removed
- Agent capabilities change significantly
- New documentation files are added

### Runtime References

Update when:

- Instruction files are added or removed; update affected callers and tests
- Agent or skill inventory changes; regenerate the product Explorer registry
- Retired entry points or commands disappear; remove live launch guidance but
  preserve historical evidence and schema compatibility records
- Harness behavior changes; distinguish Local prompt adapters from shared skills
  on Agent Host, and document unverified model availability without cost-tier inference

## Verification

After updating documentation:

1. Run `npm run lint:md` — zero errors required
2. Run `npm run lint:docs-freshness` — zero findings required
3. Verify all relative links resolve to existing files
