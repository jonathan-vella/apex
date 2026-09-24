---
description: "Guidelines for creating high-quality custom instruction files for GitHub Copilot"
applyTo: "**/*.instructions.md"
---

# Custom Instructions File Guidelines

## Frontmatter

Without `applyTo`, an instructions file is not auto-applied but can still be attached
manually. APEX validators (`validate-instruction-checks.mjs`) require both `description`
and `applyTo` on every file in this folder.

```yaml
---
name: "Python Standards"
description: "Coding conventions for Python files"
applyTo: "**/*.py"
---
```

| Field         | Default   | Constraints                                                             |
| ------------- | --------- | ----------------------------------------------------------------------- |
| `name`        | file name | Display name shown in the UI                                            |
| `description` | —         | 1-500 chars, clearly state purpose and scope                            |
| `applyTo`     | —         | Glob pattern(s): `**/*.ts` or `**/*.ts, **/*.tsx` or `**` for all files |

## File Locations

| Scope                     | Path                                                       |
| ------------------------- | ---------------------------------------------------------- |
| Workspace                 | `.github/instructions/` (searched recursively)             |
| Workspace (Claude format) | `.claude/rules/` (uses `paths` array instead of `applyTo`) |
| User profile              | `~/.copilot/instructions/`, `~/.claude/rules/`             |
| Custom                    | Configured via `chat.instructionsFilesLocations` setting   |

## Priority Order

When multiple instruction sources exist, higher priority wins on conflict:

1. Personal instructions (user-level, highest)
2. Repository instructions (`.github/copilot-instructions.md` or `AGENTS.md`)
3. Organization instructions (lowest)

## File Structure

Start with a `#` title and a one-line purpose, then domain sections that prefer tables and
bullets over prose. Use imperative mood, add Good/Bad examples only where a rule is ambiguous,
and use `#tool:<tool-name>` to reference agent tools. Keep only repository-specific rules —
do not restate general language or platform knowledge; link to the owning skill or reference.

## Maintenance

When multiple instructions apply to the same file via overlapping `applyTo` globs,
see `.github/instructions/references/precedence-matrix.md` for resolution rules.

- Review when dependencies or frameworks are updated
- Keep glob patterns accurate as project structure evolves
- Target under 150 lines; split large content into a companion skill's `references/` folder
- Adding, renaming or removing an instruction file requires updating callers, tests and the
  Explorer registry (`docs-trigger.instructions.md`)

## Resources

- [Custom Instructions docs](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
