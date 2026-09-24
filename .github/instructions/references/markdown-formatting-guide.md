<!-- ref:markdown-formatting-guide-v1 -->

# Markdown Formatting — Examples

Good/bad examples for the rules in `markdown.instructions.md`, which owns the rules and
their enforcement.

## Line Length

```markdown
<!-- BAD: 130+ characters -->

This is a very long line that contains important information about Azure resources and best practices that exceeds the limit.

<!-- GOOD: Natural break after punctuation -->

This is a very long line that contains important information about Azure resources
and best practices that stays within the limit.
```

## Code Blocks

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
![Design Architecture](./03-des-diagram.svg)

Source: `03-des-diagram.py`
```

### Mermaid Usage

Mermaid is allowed only when explicitly required by template/instruction.
If Mermaid is used, include a neutral theme directive for dark mode compatibility.

## Visual Styling

Callouts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`), status emoji,
category icons and collapsible sections follow the artifacts skill's
[styling standards](../../skills/apex-azure-artifacts/references/styling-standards.md).

## Lists

Indent nested lists with 2 spaces and add blank lines before and after lists.

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

```markdown
| Resource  | Purpose            | Example          |
| --------- | ------------------ | ---------------- |
| Key Vault | Secrets management | `kv-contoso-dev` |
| Storage   | Blob storage       | `stcontosodev`   |
```

## Links

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
