<!-- ref:markdown-formatting-guide-v1 -->

# Markdown Formatting — Detailed Guide

Examples and detailed formatting rules for `markdown.instructions.md`.
Core rules and enforcement live in the instruction file.

## Line Length Guidelines

The 120-character limit is strictly enforced. When lines exceed this limit:

1. **Sentences**: Break after punctuation (period, comma, em-dash)
2. **Lists**: Break after the list marker or continue on next line with indentation
3. **Links**: Break before `[` or use reference-style links for long URLs
4. **Code spans**: If unavoidable, use a code block instead

**Example — Breaking long lines:**

```markdown
<!-- BAD: 130+ characters -->

This is a very long line that contains important information about Azure resources and best practices that exceeds the limit.

<!-- GOOD: Natural break after punctuation -->

This is a very long line that contains important information about Azure resources
and best practices that stays within the limit.
```

## Code Blocks

Specify the language after opening backticks for syntax highlighting:

### Good Example

````markdown
```bicep
param location string = 'swedencentral'
```
````

### Bad Example

````markdown
```
param location string = 'swedencentral'
```
````

## Diagram Embeds

For Azure architecture artifacts, prefer **non-Mermaid** diagram files generated via
Python diagrams (`.png`/`.svg`) and embed with Markdown images.

### Good Example

```markdown
![Design Architecture](./03-des-diagram.drawio.svg)

Source: `03-des-diagram.drawio`
```

### Mermaid Usage

Mermaid is allowed only when explicitly required by template/instruction.
If Mermaid is used, include a neutral theme directive for dark mode compatibility.

## Visual Styling Standards

### Quick Reference

| Element        | Usage               | Example                                        |
| -------------- | ------------------- | ---------------------------------------------- |
| Callouts       | Emphasis & warnings | `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`        |
| Status Emoji   | Progress indicators | ✅ ⚠️ ❌ 💡                                    |
| Category Icons | Resource sections   | 💻 💾 🌐 🔐 📊                                 |
| Collapsible    | Long content        | `<details><summary>...</summary>...</details>` |
| References     | Evidence links      | Microsoft Learn URLs at document bottom        |

### Callout Types

Supported: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`.
Full examples and emoji tables are in the azure-artifacts SKILL.md.

## Lists and Formatting

- Use `-` for bullet points (not `*` or `+`)
- Use `1.` for numbered lists (auto-increment)
- Indent nested lists with 2 spaces
- Add blank lines before and after lists

### Good Example

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

### Bad Example

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

### Good Example

```markdown
See the [getting started guide](../../getting-started/quickstart/) for setup.
Refer to [Azure Bicep docs](https://learn.microsoft.com/azure/
azure-resource-manager/bicep/) for syntax details.
```

### Bad Example

```markdown
Click [here](../../getting-started/quickstart/) for more info.
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

**Note**: Front matter fields are project-specific.
General documentation files may not require all fields.

## Maintenance

- Review documentation when code changes
- Update examples to reflect current patterns
- Remove references to deprecated features
- Verify all links remain valid
