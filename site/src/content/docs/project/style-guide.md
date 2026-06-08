---
title: "Docs Style Guide"
description: "Authoring conventions for the APEX documentation site — H1 source, terminology, code blocks, and image rules."
sidebar:
  order: 3
---

This is the source of truth for **how** to write APEX docs. For **what** to
write when (which trigger updates docs), see
[`docs-trigger.instructions.md`](https://github.com/jonathan-vella/apex/blob/main/.github/instructions/docs-trigger.instructions.md).

## H1 source of truth

- Every page has frontmatter `title:` — Starlight renders that as the H1.
  Do not add a second `# Heading` in the body.
- The first body heading is always `##`.
- Frontmatter `description:` is mandatory; it powers the OG card, sidebar
  tooltip, and Pagefind snippet.

## Terminology

Follow the [Microsoft Writing Style Guide](https://learn.microsoft.com/style-guide/welcome/).
Non-negotiables in this repo:

| Wrong               | Right                                       |
| ------------------- | ------------------------------------------- |
| `Azure AD`, `AAD`   | `Microsoft Entra ID`                        |
| `click`             | `select` (UI verb)                          |
| `log in` (verb)     | `sign in`                                   |
| `login` (noun)      | `sign-in`                                   |
| `Powershell`        | `PowerShell`                                |
| `github`            | `GitHub` (config keys exempt)               |

**Code identifiers stay verbatim** — `azureADOnlyAuthentication`,
`azuread_authentication_only`, `AZURE_TENANT_ID`, `az login`,
`azd auth login`, `gh auth login` are stable API surfaces.

## `Step N` vs `Phase`

- **`Step N`** is the workflow spine — `N ∈ {1, 2, 3, 3.5, 4, 5, 6, 7, Post}`.
  Always use this form when referring to the cross-agent workflow.
- **`Phase`** is a sub-stage **inside an agent**. Only use `Phase N` when
  the same sentence names the parent agent (e.g. `Architect Phase 6b`,
  `IaC Planner Phase 3.6`, `CodeGen Phase 4`).
- If a `Phase N` reference has no parent agent in the sentence, rewrite
  it as `Step N (<group>)`.

## Code blocks

Use [Expressive Code](https://expressive-code.com/) attributes when a
filename or call-out adds clarity:

````md
```bicep title="main.bicep" frame="code"
resource sa 'Microsoft.Storage/storageAccounts@2023-05-01' = { ... }
```
````

Long examples (> 30 lines) **must** include a `title=` attribute so the
copy-button surfaces the right filename.

## Images and diagrams

- Every `![]()` reference needs descriptive alt text. `![](foo.png)` is
  a lint error (MD045).
- Add a caption immediately after the image, either as `<figcaption>`
  inside an MDX `<figure>` or a plain `> _Figure N — …_` blockquote.
- For Azure architecture diagrams, prefer Draw.io exports rendered as
  PNG plus a Mermaid fallback for accessibility. Use the
  [`drawio`](https://github.com/jonathan-vella/apex/blob/main/.github/skills/drawio/SKILL.md)
  skill to author them.
- For sequence / state / Gantt diagrams, use inline `mermaid` fenced
  blocks. The site auto-themes them for light + dark.

## Links

- Internal links use trailing slashes (`/concepts/workflow/`, not
  `/concepts/workflow`).
- Cross-doc links use root-relative paths (`/…/`)
  rather than `../../` chains.
- External links must include `rel="noopener"` when they set
  `target="_blank"`.

## Hard-coded counts

Never hard-code numeric counts for repo entities (agents, skills,
instructions). Either reference [`count-manifest.json`](https://github.com/jonathan-vella/apex/blob/main/tools/registry/count-manifest.json)
or use descriptive language (“many”, “a handful”, “the full set”).
Enforced by `lint:no-hardcoded-counts`.

## Tooling

- `npm run lint:md` — markdownlint across the docs.
- `npm run lint:docs-frontmatter` — frontmatter completeness (description present, etc.).
- `node site/check-links.mjs` — internal-link audit (stricter than the
  Astro build-time validator).
- `cd site && npm run build` — full Astro build.

Run all four before opening a docs PR.
