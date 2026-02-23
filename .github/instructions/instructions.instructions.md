---
description: "Guidelines for creating high-quality custom instruction files for GitHub Copilot"
applyTo: "**/*.instructions.md"
---

# Custom Instructions File Guidelines

## Required Frontmatter

```yaml
---
description: "Brief description of the instruction purpose and scope"
applyTo: "glob pattern for target files (e.g., **/*.ts, **/*.py)"
---
```

| Field         | Constraints                                                             |
| ------------- | ----------------------------------------------------------------------- |
| `description` | Single-quoted string, 1-500 chars, clearly state purpose                |
| `applyTo`     | Glob pattern(s): `**/*.ts` or `**/*.ts, **/*.tsx` or `**` for all files |

## File Structure

1. **Title** (`#`) with brief introduction
2. **Core sections** organized by domain — prefer tables and bullet lists over prose
3. **Examples** with `### Good Example` / `### Bad Example` labels and fenced code blocks
4. **Validation** (optional) — build/lint/test commands

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

- Review when dependencies or frameworks are updated
- Keep glob patterns accurate as project structure evolves
- Target under 150 lines; split large content into a companion skill's `references/` folder

## Resources

- [Custom Instructions Documentation](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
