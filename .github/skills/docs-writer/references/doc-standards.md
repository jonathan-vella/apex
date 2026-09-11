<!-- ref:doc-standards-v1 -->

# Documentation Standards Reference

> For use by the `docs-writer` skill. Consolidates rules from
> `markdown.instructions.md` and `docs.instructions.md`.

## File Header Pattern

For `site/src/content/docs/**`, use YAML `title` and `description` frontmatter.
Starlight renders the H1; begin body sections at H2. Do not add a version banner.
Site-specific rules are owned by `docs.instructions.md`; the repository pattern below is not a site template.

Every doc in `docs/` must start with:

```markdown
# {Title}

> [Current Version](../VERSION.md) | {One-line description}
```

- Version number: always read from `VERSION.md` (single source of truth)
- Description: one sentence summarizing the document's purpose

## Heading Rules

| Rule      | Detail                                                |
| --------- | ----------------------------------------------------- |
| Single H1 | Only the document title uses `#`                      |
| ATX style | Always `##`, `###` — never underline style            |
| No H4+    | Avoid `####` and deeper; restructure content instead  |
| Numbering | Template artifacts use numbered H2s (`## 1. Section`) |

## Line Length

**120 characters maximum** — enforced by CI and pre-commit hooks.

Breaking strategies:

1. **Sentences**: break after punctuation (period, comma, em-dash)
2. **Lists**: continue on next line with matching indentation
3. **Links**: break before `[` or use reference-style links
4. **Tables**: allowed to exceed when column content requires it

## Link Conventions

| Type          | Format                                                                               |
| ------------- | ------------------------------------------------------------------------------------ |
| Internal docs | `[Quickstart](quickstart.md)` — relative paths                                       |
| Cross-folder  | `[Workflow](../docs/workflow.md)` — relative from source                             |
| External URLs | Reference-style: `[Azure docs][azure-waf]` with `[azure-waf]: https://...` at bottom |
| Anchors       | `[Section](#section-name)` — lowercase, hyphenated                                   |

## Mermaid Diagrams

Every Mermaid block must include the neutral theme directive:

````markdown
```mermaid
%%{init: {'theme':'neutral'}}%%
graph LR
    A --> B
```
````

## Callout Syntax

Use GitHub-flavored callouts:

```markdown
> [!NOTE]
> Informational highlight.

> [!TIP]
> Helpful advice for the reader.

> [!WARNING]
> Something that could cause issues.
```

## Code Blocks

Always specify language after opening backticks:

- Bicep: ` ```bicep `
- PowerShell: ` ```powershell `
- Bash: ` ```bash `
- JSON: ` ```json `
- YAML: ` ```yaml `
- Markdown: ` ```markdown `
- Plain text: ` ```text `

## Tables

| Standard     | Rule                                                |
| ------------ | --------------------------------------------------- |
| Header row   | Always include                                      |
| Alignment    | Left-align by default (use `\| --- \|`)             |
| Pipe spacing | Space after opening pipe, space before closing pipe |
| Column width | Keep readable; align pipes vertically               |

## Prohibited References

These agents were removed and converted to skills. Never reference them:

| Removed Agent      | Replacement Skill                   |
| ------------------ | ----------------------------------- |
| Architecture diagrams | `python-diagrams` skill |
| `adr.agent.md`     | `azure-adr` skill                   |
| `docs.agent.md`    | `azure-artifacts` skill             |

Also avoid references to removed paths:

- `docs/guides/` — removed
- `docs/reference/` — removed
- `docs/getting-started.md` — superseded by `docs/quickstart.md`

## Content Principles

| Principle                  | Application                                             |
| -------------------------- | ------------------------------------------------------- |
| **DRY**                    | Single source of truth per topic                        |
| **Current state**          | No historical context in main docs                      |
| **Action-oriented**        | Every section answers "how do I...?"                    |
| **Minimal**                | If it doesn't help users today, remove it               |
| **Prompt guide for depth** | Point to the prompt guide section in the published site |

## Validation Commands

```bash
# Markdown lint (all files)
npm run lint:md

# Link validation
npm run lint:links

# Skill format validation
npm run validate:skills
```

Artifact Markdown is outside docs-writer scope; lefthook and Challenger own its validation.

## Version Number Propagation

When `VERSION.md` is updated, check these files for version references:

- `site/src/content/docs/**/*.{md,mdx}` — explicit release references, not generated title banners
- `CHANGELOG.md` — new version entry needed

## Emoji Conventions in Agent/Skill Tables

Codenames use consistent emoji in documentation:

| Codename     | Emoji | Agent        |
| ------------ | ----- | ------------ |
| Orchestrator | 🧠    | Orchestrator |
| Scribe       | 📜    | Requirements |
| Oracle       | 🏛️    | Architect    |
| Artisan      | 🎨    | Design       |
| Strategist   | 📐    | Bicep Plan   |
| Forge        | ⚒️    | Bicep Code   |
| Envoy        | 🚀    | Deploy       |
| Sentinel     | 🔍    | Diagnose     |

When adding a new agent, choose a unique emoji + codename.
