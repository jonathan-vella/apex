---
description: "Documentation and content creation standards for markdown files"
applyTo: "**/*.md"
---

# Markdown Documentation Standards

Standards for creating consistent, accessible, and well-structured markdown documentation.
Follow these guidelines to ensure documentation quality across the repository.

## General Instructions

- ATX-style headings (`##`, `###`) — never H1 in content
- **CRITICAL: 120-char line limit** (CI + pre-commit enforced)
- Break at natural points; LF line endings
- Meaningful alt text for images; validate with `npm run lint:md`

## Line Length

120 chars max (CI enforced). Break after punctuation, before `[`, code block for long spans.

## Content Structure

| Element     | Rule                                     | Example                                                    |
| ----------- | ---------------------------------------- | ---------------------------------------------------------- |
| Headings    | Use `##` for H2, `###` for H3, avoid H4+ | `## Section Title`                                         |
| Lists       | Use `-` for unordered, `1.` for ordered  | `- Item one`                                               |
| Code blocks | Use fenced blocks with language          | ` ```bicep `                                               |
| Links       | Descriptive text, valid URLs             | `[Azure docs](https://...)`                                |
| Images      | Include alt text                         | `![Architecture diagram](https://example.com/diagram.png)` |
| Tables      | Align columns, include headers           | See examples below                                         |

## Code Blocks

Specify language after backticks. Never bare fences.

## Diagram Embeds

Use the appropriate diagram skill for each output type:

- **Architecture diagrams** → `drawio` skill (`.drawio`)
- **WAF/cost/compliance charts** → `python-diagrams` skill (`.py` + `.png`)
- **Inline markdown diagrams** → `mermaid` skill (fenced code blocks)
- **Draw.io diagrams** → `drawio` skill (`.drawio`)

## Template-First Approach

Agents MUST follow `azure-artifacts/templates/`.
See `azure-artifacts.instructions.md` for the complete heading reference.

1. Preserve H2 heading order (invariant sections)
2. No embedded skeletons — link to templates
3. Optional sections after last required H2
4. Validated by `scripts/validate-artifacts.mjs`

Enforcement: Lefthook pre-commit + CI + `npm run fix:artifact-h2`.

## Visual Styling

See `azure-artifacts/SKILL.md` for styling standards, emoji, callouts, formatting.

## Patterns to Avoid

| Anti-Pattern            | Problem                      | Solution                   |
| ----------------------- | ---------------------------- | -------------------------- |
| H1 in content           | Conflicts with title         | Use H2 (`##`) as top level |
| Deep nesting (H4+)      | Hard to navigate             | Restructure content        |
| Long lines (>120 chars) | Poor readability, lint fails | Break at natural clauses   |
| Missing code language   | No syntax highlighting       | Specify language           |
| "Click here" links      | Poor accessibility           | Use descriptive text       |
| Excessive whitespace    | Inconsistent appearance      | Single blank lines         |

## Validation

```bash
npm run lint:md
```

## Reference

Full examples and formatting guide:
`.github/instructions/references/markdown-formatting-guide.md`
