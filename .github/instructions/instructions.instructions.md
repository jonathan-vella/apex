---
description: "Guidelines for creating high-quality custom instruction files for GitHub Copilot"
applyTo: "**/*.instructions.md"
---

# Custom Instructions File Guidelines

For the complete official reference, see
[VS Code Custom Instructions docs](https://code.visualstudio.com/docs/copilot/customization/custom-instructions).

## Frontmatter

All frontmatter fields are optional. Without `applyTo`, the instructions file
is not auto-applied but can still be manually attached to a chat request.

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

1. **Title** (`#`) with brief introduction
2. **Core sections** organized by domain — prefer tables and bullet lists over prose
3. **Examples** with `### Good Example` / `### Bad Example` labels and fenced code blocks
4. **Validation** (optional) — build/lint/test commands

Use `#tool:<tool-name>` to reference agent tools in body text.

## Writing Rules

| Rule                    | Details                                                |
| ----------------------- | ------------------------------------------------------ |
| Imperative mood         | "Use", "Implement", "Avoid" — not "You should"         |
| Specific and actionable | Concrete examples > abstract concepts                  |
| Concise and scannable   | Bullet points, tables; avoid verbose paragraphs        |
| No ambiguity            | Avoid "should", "might", "possibly"                    |
| Show why                | Explain reasoning only when it adds value              |
| Stay current            | Reference current versions; remove deprecated patterns |

## Patterns to Follow

- **Tables** for structured rules, comparisons, parameter lists
- **Code comparisons** with Good/Bad examples in fenced blocks
- **Conditional guidance** for context-dependent rules (e.g., project size)
- **Bullet lists** for sequential rules or checklists

## Patterns to Avoid

- Overly verbose explanations — keep it scannable
- Outdated information or deprecated features
- Missing examples — abstract rules without code
- Contradictory advice within the same file
- Copy-paste from documentation — distill and contextualize

## Maintenance

When multiple instructions apply to the same file via overlapping `applyTo` globs,
see `.github/instructions/references/precedence-matrix.md` for resolution rules.

- Review when dependencies or frameworks are updated
- Keep glob patterns accurate as project structure evolves
- Target under 150 lines; split large content into a companion skill's `references/` folder

## Resources

- [Custom Instructions docs](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
- [Community examples](https://github.com/github/awesome-copilot)
