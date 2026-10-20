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
| User profile              | Copilot-supported personal instruction locations          |
| Custom repository roots   | `instructionDirectories` in `.github/copilot/settings.json` |

APEX authors repository instructions only in `.github/instructions/`.
The Local-harness `chat.instructionsFilesLocations` setting is not a Copilot SDK
configuration contract. See the official
[SDK discovery contract](https://github.com/github/copilot-sdk/blob/main/docs/features/customization-locations.md).
Discovery configuration is not a filesystem grant or proof of runtime attachment.

## Ownership and Conflict Resolution

The harness owns instruction-source precedence; repository prose cannot override it.
Within APEX, `AGENTS.md` owns build/contribution conventions and the workflow table;
`.github/copilot-instructions.md` owns Azure defaults, session-state usage and runtime
boundaries. Nested IaC `AGENTS.md` files own track-specific commands.
Domain instructions own file-specific contracts; references own extended rationale.
Preserve essential safeguards in agent bodies even when a canonical reference exists.

## File Structure

Start with a `#` title and a one-line purpose, then domain sections that prefer tables and
bullets over prose. Use imperative mood, add Good/Bad examples only where a rule is ambiguous,
and use `#tool:<tool-name>` to reference agent tools. Keep only repository-specific rules —
do not restate general language or platform knowledge; link to the owning skill or reference.

## Maintenance

For overlapping authoring rules, see
[the precedence matrix](references/precedence-matrix.md).
These are repository topic-ownership rules, not a replacement for runtime precedence.

- Review when dependencies or frameworks are updated
- Keep glob patterns accurate as project structure evolves
- Follow the advisory size targets in
  [context optimization](context-optimization.instructions.md#instruction-file-rules);
  split optional detail, not essential constraints, into references
- Adding, renaming or removing an instruction file requires updating callers, tests and the
  Explorer registry (`docs-trigger.instructions.md`)

## Resources

- [Custom Instructions docs](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
