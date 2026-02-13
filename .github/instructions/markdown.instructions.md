---
description: "Documentation and content creation standards for markdown files"
applyTo: "**/*.md"
---

# Markdown Documentation Standards

Standards for creating consistent, accessible, and well-structured markdown documentation.
Follow these guidelines to ensure documentation quality across the repository.

## General Instructions

- Use ATX-style headings (`##`, `###`) - never use H1 (`#`) in content (reserved for document title)
- **CRITICAL: Limit line length to 120 characters** - this is enforced by CI/CD and pre-commit hooks
- Break long lines at natural points (after punctuation, before conjunctions)
- Use LF line endings (enforced by `.gitattributes`)
- Include meaningful alt text for all images
- Validate with `markdownlint` before committing
- These standards serve as the canonical style reference for all markdown in this repository

## Line Length Guidelines

The 120-character limit is strictly enforced. When lines exceed this limit:

1. **Sentences**: Break after punctuation (period, comma, em-dash)
2. **Lists**: Break after the list marker or continue on next line with indentation
3. **Links**: Break before `[` or use reference-style links for long URLs
4. **Code spans**: If unavoidable, use a code block instead

**Example - Breaking long lines:**

```markdown
<!-- BAD: 130+ characters -->

This is a very long line that contains important information about Azure resources and best practices that exceeds the limit.

<!-- GOOD: Natural break after punctuation -->

This is a very long line that contains important information about Azure resources
and best practices that stays within the limit.
```

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

Specify the language after opening backticks for syntax highlighting:

### Good Example - Language-specified code block

````markdown
```bicep
param location string = 'swedencentral'
```
````

### Bad Example - No language specified

````markdown
```
param location string = 'swedencentral'
```
````

## Diagram Embeds

For Azure architecture artifacts, prefer **non-Mermaid** diagram files generated via
Python diagrams (`.png`/`.svg`) and embed with Markdown images.

### Good Example - External diagram embed

```markdown
![Design Architecture](./03-des-diagram.png)

Source: [03-des-diagram.py](./03-des-diagram.py)
```

### Mermaid Usage

Mermaid is allowed only when explicitly required by template/instruction.
If Mermaid is used, include a neutral theme directive for dark mode compatibility.

## Template-First Approach for Workflow Artifacts

**MANDATORY for all workflow artifacts:**

When generating workflow artifacts, agents **MUST** follow the canonical templates in
`.github/skills/azure-artifacts/templates/`. Key examples:

| Artifact                        | Template                                 | Producing Agent |
| ------------------------------- | ---------------------------------------- | --------------- |
| `01-requirements.md`            | `01-requirements.template.md`            | requirements    |
| `02-architecture-assessment.md` | `02-architecture-assessment.template.md` | architect       |
| `04-implementation-plan.md`     | `04-implementation-plan.template.md`     | bicep-plan      |
| `06-deployment-summary.md`      | `06-deployment-summary.template.md`      | deploy          |

All 15 artifact types have corresponding templates. See `artifact-h2-reference.instructions.md`
for the complete heading reference.

**Requirements:**

1. **Preserve H2 heading order**: Templates define invariant H2 sections that MUST appear in order
2. **No embedded skeletons**: Agents must link to templates, never embed structure inline
3. **Optional sections**: May appear after the last required H2 (anchor), with warnings if before
4. **Validation**: All artifacts are validated by `scripts/validate-artifact-templates.mjs`

**Enforcement:**

- Pre-commit hooks via Lefthook run validation on every commit
- CI validates on PR/push via GitHub Actions
- Auto-fix available: `npm run fix:artifact-h2`

## Visual Styling Standards

**MANDATORY**: All agent-generated documentation MUST follow the styling standards defined in:

📚 **[Azure Artifacts Skill](../skills/azure-artifacts/SKILL.md)**

### Quick Reference

| Element        | Usage               | Example                                        |
| -------------- | ------------------- | ---------------------------------------------- |
| Callouts       | Emphasis & warnings | `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`        |
| Status Emoji   | Progress indicators | ✅ ⚠️ ❌ 💡                                    |
| Category Icons | Resource sections   | 💻 💾 🌐 🔐 📊                                 |
| Collapsible    | Long content        | `<details><summary>...</summary>...</details>` |
| References     | Evidence links      | Microsoft Learn URLs at document bottom        |

### Callout Types

```markdown
> [!NOTE]
> Informational - background context

> [!TIP]
> Best practice recommendation

> [!IMPORTANT]
> Critical requirement

> [!WARNING]
> Security/reliability concern

> [!CAUTION]
> Data loss risk or irreversible action
```

### Collapsible Sections

Use for lengthy content (tables >10 rows, code examples, appendix material):

```markdown
<details>
<summary>📋 Detailed Configuration</summary>

| Setting | Value |
| ------- | ----- |
| ...     | ...   |

</details>
```

### References Section

Every documentation artifact SHOULD include a `## References` section at the bottom:

```markdown
---

## References

> [!NOTE]
> 📚 The following Microsoft Learn resources provide additional guidance.

| Topic      | Link                                            |
| ---------- | ----------------------------------------------- |
| Topic Name | [Display Text](https://learn.microsoft.com/...) |
```

## Lists and Formatting

- Use `-` for bullet points (not `*` or `+`)
- Use `1.` for numbered lists (auto-increment)
- Indent nested lists with 2 spaces
- Add blank lines before and after lists

### Good Example - Proper list formatting

```markdown
Prerequisites:

- Azure CLI 2.50+
- Bicep CLI 0.20+
- PowerShell 7+

Steps:

1. Clone the repository
2. Run the setup script
3. Verify installation
```

### Bad Example - Inconsistent list markers

```markdown
Prerequisites:

- Azure CLI 2.50+

* Bicep CLI 0.20+

- PowerShell 7+
```

## Tables

- Include header row with alignment
- Keep columns aligned for readability
- Use tables for structured comparisons

```markdown
| Resource  | Purpose            | Example          |
| --------- | ------------------ | ---------------- |
| Key Vault | Secrets management | `kv-contoso-dev` |
| Storage   | Blob storage       | `stcontosodev`   |
```

## Links and References

- Use descriptive link text (not "click here")
- Verify all links are valid and accessible
- Prefer relative paths for internal links

### Good Example - Descriptive links

```markdown
See the [getting started guide](../../docs/quickstart.md) for setup instructions.
Refer to [Azure Bicep documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/) for syntax details.
```

### Bad Example - Non-descriptive links

```markdown
Click [here](../../docs/quickstart.md) for more info.
```

## Front Matter (Optional)

For blog posts or published content, include YAML front matter:

```yaml
---
post_title: "Article Title"
author1: "Author Name"
post_slug: "url-friendly-slug"
post_date: "2025-01-15"
summary: "Brief description of the content"
categories: ["Azure", "Infrastructure"]
tags: ["bicep", "iac", "azure"]
---
```

**Note**: Front matter fields are project-specific. General documentation files may not require all fields.

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

Run these commands before committing markdown:

```bash
# Lint all markdown files
markdownlint '**/*.md' --ignore node_modules --config .markdownlint.json

# Check for broken links (if using markdown-link-check)
markdown-link-check ../../README.md
```

## Maintenance

- Review documentation when code changes
- Update examples to reflect current patterns
- Remove references to deprecated features
- Verify all links remain valid
