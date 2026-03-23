# GitHub Pages Documentation Plan

> Publish the `docs/` folder as a searchable documentation site using MkDocs Material.

- **Status**: Draft
- **Created**: 2026-03-08
- **Updated**: 2026-03-08
- **Branch**: `feat/github-pages-docs`
- **Target URL**: `https://jonathan-vella.github.io/azure-agentic-infraops/`

---

## 1. Goal

Publish the `docs/` folder as a clean, searchable documentation site at
`https://jonathan-vella.github.io/azure-agentic-infraops/` using **MkDocs Material**,
deployed automatically from `main` via GitHub Actions.

Phase 1 ships the site as-is. Phase 2 fixes links. **Phase 3** improves
documentation structure, wording, and presentation using MkDocs Material features
(admonitions, content tabs, annotations, grids) informed by the best-practice
research below.

## 2. Why MkDocs Material

| Factor              | Rationale                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Python-native**   | Already in the dev container; no React/Node build chain added                                             |
| **Mermaid support** | Built-in plugin — `workflow.md` and `troubleshooting.md` use Mermaid diagrams that raw Pages won't render |
| **HTML blocks**     | `docs/README.md` uses `<div>`, `<img>`, `<a id>` — Material passes these through correctly                |
| **GFM tables**      | All docs use pipe tables extensively — rendered natively                                                  |
| **Search**          | Built-in full-text search with zero config                                                                |
| **Admonitions**     | Can progressively adopt `!!! note` / `!!! warning` callouts                                               |
| **Instant loading** | SPA-like navigation keeps search index alive across pages                                                 |
| **Code copy**       | One-click copy buttons on all code blocks (many CLI examples in docs)                                     |
| **Content tabs**    | Bicep/Terraform dual-track content can use linked tabs instead of duplicated prose                        |

## 2a. Documentation Improvement Recommendations

Research of MkDocs Material best practices (from
`https://squidfunk.github.io/mkdocs-material/`) and audit of each `docs/` file reveals
specific improvements per file. **`how-it-works.md` is excluded** — no changes.

### Landing Page (`docs/README.md` / `index.md`)

| Issue                    | Current State                                                        | Recommendation                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rainbow dividers**     | `<img>` tags linking to raw GitHub image as section separators       | Remove all rainbow `<img>` dividers. Material's clean typography + heading permalink anchors make them unnecessary and they add visual clutter on the rendered site.         |
| **Back-to-top links**    | Manual `<div align="right">⬆️ Back to Top</div>` after every section | Remove all. Enable Material's built-in `navigation.top` (back-to-top button appears on scroll-up). Much cleaner UX.                                                          |
| **"What's New" section** | Top of page, mixes release notes with landing content                | Move to a standalone `whats-new.md` page or remove in favour of the Changelog. Landing page should be stable, not a "latest release" billboard.                              |
| **Dense table layout**   | Agent, skill, and subagent tables dominate the page                  | Convert to MkDocs Material **grids** (card layout) for a visual overview, or use collapsible `???+ info` admonitions grouped by category. Tables work but are walls of text. |
| **Project Structure**    | ASCII `tree` block                                                   | Keep as-is — ASCII tree is clear and grep-friendly.                                                                                                                          |
| **Project Health links** | Links to internal `exec-plans/`                                      | Remove from published site (exec-plans are excluded) or convert to a brief "health badges" section.                                                                          |

### Quickstart (`docs/quickstart.md`)

| Issue                              | Current State                             | Recommendation                                                                                          |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Rainbow dividers + back-to-top** | Same pattern as README                    | Remove all (same reasoning).                                                                            |
| **Collapsible details**            | `<details><summary>` HTML                 | Convert to Material admonitions: `???+ tip "Optional: ..."`. Renders natively, looks more polished.     |
| **Step numbering**                 | H2 headings `## Step 1`, `## Step 2` etc. | Good as-is. Consider adding a `## TL;DR` admonition at top with a 3-line summary for experienced users. |
| **Keyboard shortcuts**             | Inline text like `Ctrl+Shift+I`           | Wrap in `++ctrl+shift+i++` using `pymdownx.keys` extension for rendered key badges.                     |
| **Prerequisites table**            | Pipe table                                | Convert to an admonition: `!!! abstract "Prerequisites"` with a checklist. More scannable.              |

### Workflow (`docs/workflow.md`)

| Issue                              | Current State                         | Recommendation                                                                                 |
| ---------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Rainbow dividers + back-to-top** | Same pattern                          | Remove all.                                                                                    |
| **Dual-track tables**              | Bicep vs Terraform repeated in tables | Use **content tabs** (`=== "Bicep"` / `=== "Terraform"`) for side-by-side command comparisons. |
| **Mermaid diagrams**               | Multiple flowcharts                   | Keep — verify fences parse correctly outside `<div>` blocks.                                   |
| **Version reference**              | `[Current Version](../VERSION.md)`    | Will be fixed in link remediation step.                                                        |

### Troubleshooting (`docs/troubleshooting.md`)

| Issue                                | Current State              | Recommendation                                                                                    |
| ------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------- |
| **Rainbow dividers + back-to-top**   | Same pattern               | Remove all.                                                                                       |
| **`<details>` collapsible sections** | HTML `<details>/<summary>` | Convert to `???+ warning` / `???+ tip` collapsible admonitions. Same behaviour, native rendering. |
| **Decision tree**                    | Mermaid flowchart — good   | Keep. Verify fence format.                                                                        |
| **Solution code blocks**             | Inline bash                | Add `title="filename"` annotation where the code refers to a specific file.                       |

### Dev Containers (`docs/dev-containers.md`)

| Issue                              | Current State                                | Recommendation                                                                                            |
| ---------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Rainbow dividers + back-to-top** | Same pattern                                 | Remove all.                                                                                               |
| **Platform instructions**          | Separate H3 sections for Windows/macOS/Linux | Convert to **content tabs** (`=== "Windows"` / `=== "macOS"` / `=== "Linux"`). Compact and user-friendly. |
| **Hardware requirements table**    | Pipe table                                   | Convert to admonition: `!!! info "Hardware Requirements"`.                                                |
| **`<details>` blocks**             | HTML collapsible                             | Convert to admonitions.                                                                                   |

### Glossary (`docs/GLOSSARY.md`)

| Issue                              | Current State                      | Recommendation                                                                                                                 |
| ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Rainbow dividers + back-to-top** | Same pattern                       | Remove all.                                                                                                                    |
| **Alphabetical anchors**           | `<a id>` tags                      | Keep — they provide deep-linking. Material's `toc` with `permalink: true` adds parallel anchors for H2/H3.                     |
| **Term formatting**                | H3 per term, description paragraph | Good pattern. Consider adding `📁` and `🔗` emoji prefixes to definitions list style for consistency (already partially used). |

### Prompt Guide (`docs/prompt-guide/README.md` → `index.md`)

| Issue                              | Current State                             | Recommendation                                                           |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| **Rainbow dividers + back-to-top** | Same pattern                              | Remove all.                                                              |
| **`<details>` blocks**             | HTML collapsible for long example prompts | Convert to `???+ example "Example: ..."` admonitions.                    |
| **Code examples**                  | Prompt text in plain `text` fences        | Keep as-is — no syntax highlighting needed for natural language prompts. |

### Cross-Cutting Improvements (all files except `how-it-works.md`)

| Pattern               | Current                                                      | Recommended                                                                                      |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Section dividers      | `<img src="...rainbow.png">`                                 | Remove entirely — Material's heading styles and TOC sidebar provide sufficient visual structure. |
| Back-to-top           | `<div align="right"><a href="#top">⬆️ Back to Top</a></div>` | Remove — enable `navigation.top` feature in `mkdocs.yml` instead.                                |
| `<details>/<summary>` | HTML collapsible blocks                                      | Convert to `??? note "Title"` (collapsed) or `???+ note "Title"` (expanded) admonitions.         |
| Key presses           | Plain text `Ctrl+Shift+I`                                    | Use `pymdownx.keys`: `++ctrl+shift+i++` renders as styled key badges.                            |
| Warning callouts      | `> **⚠️ REQUIRED**: ...` blockquotes                         | Convert to `!!! warning "Required"` admonitions.                                                 |
| Tip callouts          | `> **💡 Tip**: ...` blockquotes                              | Convert to `!!! tip` admonitions.                                                                |

### Not Changing

- **`docs/how-it-works.md`** — Excluded from all improvements per user request.
- **`CONTRIBUTING.md`** / **`CHANGELOG.md`** — Pulled from repo root; keep format as-is.
- **Table-heavy sections** where the table genuinely adds clarity (e.g., agent persona tables) — keep.

---

## 3. File Review — Compatibility Assessment

Before creating the MkDocs site, each in-scope file needs review for compatibility issues.
Findings from this review feed into Steps 4 (link remediation) and 5 (polish).

### Files with Mermaid Diagrams (3 files)

These render via the `pymdownx.superfences` Mermaid fence — verify each diagram parses.

| File                      | Diagram Types       | Review Action                                                  |
| ------------------------- | ------------------- | -------------------------------------------------------------- |
| `docs/workflow.md`        | Flowchart           | Verify fences are ` ```mermaid ` (not indented/nested in HTML) |
| `docs/how-it-works.md`    | Flowchart, sequence | Same — largest file (1,192 lines), check all fences            |
| `docs/troubleshooting.md` | Decision tree       | Same                                                           |

### Files with HTML Blocks (8 in-scope files)

MkDocs Material passes HTML through, but `md_in_html` extension is needed for
mixed markdown+HTML. Review each for compatibility.

| File                          | HTML Patterns              | Review Action                                                 |
| ----------------------------- | -------------------------- | ------------------------------------------------------------- |
| `docs/README.md`              | `<div>`, `<img>`, `<a id>` | Verify back-to-top anchors, section divider images render     |
| `docs/quickstart.md`          | `<details>`, `<summary>`   | Verify collapsible sections work (may convert to admonitions) |
| `docs/dev-containers.md`      | `<details>`                | Same                                                          |
| `docs/workflow.md`            | `<div>`                    | Verify back-to-top links                                      |
| `docs/how-it-works.md`        | `<div>`, `<details>`       | Verify all patterns                                           |
| `docs/troubleshooting.md`     | `<details>`                | Verify collapsible sections                                   |
| `docs/GLOSSARY.md`            | `<div>`                    | Verify anchors                                                |
| `docs/prompt-guide/README.md` | `<details>`                | Verify collapsible sections                                   |

### Files with Parent-Relative Links (10 in-scope files)

Links using `../` that escape the `docs/` folder will break in MkDocs.

| File                          | Broken Link Patterns                                         | Fix Strategy                      |
| ----------------------------- | ------------------------------------------------------------ | --------------------------------- |
| `docs/README.md`              | `../VERSION.md`, `../QUALITY_SCORE.md`, `../.github/agents/` | GitHub source URLs                |
| `docs/GLOSSARY.md`            | `../.github/agents/`, `../.github/skills/`, `../mcp/`        | GitHub source URLs                |
| `docs/workflow.md`            | `../VERSION.md`                                              | GitHub source URL                 |
| `docs/quickstart.md`          | `../VERSION.md`                                              | GitHub source URL                 |
| `docs/how-it-works.md`        | `../VERSION.md` (if present)                                 | GitHub source URL                 |
| `docs/dev-containers.md`      | `../VERSION.md` (if present)                                 | GitHub source URL                 |
| `docs/troubleshooting.md`     | (none expected — verify)                                     | Verify clean                      |
| `docs/prompt-guide/README.md` | `../../VERSION.md`                                           | GitHub source URL                 |
| Root `CONTRIBUTING.md`        | `docs/workflow.md`                                           | Will become `workflow.md` in site |
| Root `CHANGELOG.md`           | (none expected)                                              | Verify clean                      |

### Summary: Review Effort per File

| File                          | Mermaid | HTML | Broken Links | Priority                |
| ----------------------------- | ------- | ---- | ------------ | ----------------------- |
| `docs/README.md` → `index.md` | —       | Yes  | 3 links      | **High** (landing page) |
| `docs/quickstart.md`          | —       | Yes  | 1 link       | High                    |
| `docs/how-it-works.md`        | Yes     | Yes  | 1 link       | High                    |
| `docs/workflow.md`            | Yes     | Yes  | 1 link       | Medium                  |
| `docs/troubleshooting.md`     | Yes     | Yes  | —            | Medium                  |
| `docs/dev-containers.md`      | —       | Yes  | 1 link       | Low                     |
| `docs/GLOSSARY.md`            | —       | Yes  | 5 links      | Medium                  |
| `docs/prompt-guide/README.md` | —       | Yes  | 1 link       | Low                     |
| `CONTRIBUTING.md`             | —       | —    | 1 link       | Low                     |
| `CHANGELOG.md`                | —       | —    | —            | Low                     |

---

## 4. Site Map — What to Publish vs. Exclude

### Publish (public-facing)

| Nav Section         | Source                        | Notes                                                 |
| ------------------- | ----------------------------- | ----------------------------------------------------- |
| **Home**            | `docs/README.md` → `index.md` | Rename or symlink; becomes landing page               |
| **Quickstart**      | `docs/quickstart.md`          | As-is                                                 |
| **How It Works**    | `docs/how-it-works.md`        | Largest page (1,192 lines) — consider splitting later |
| **Workflow**        | `docs/workflow.md`            | Mermaid diagrams render via `superfences` plugin      |
| **Dev Containers**  | `docs/dev-containers.md`      | As-is                                                 |
| **Troubleshooting** | `docs/troubleshooting.md`     | Mermaid decision tree renders correctly               |
| **Glossary**        | `docs/GLOSSARY.md`            | As-is                                                 |
| **Prompt Guide**    | `docs/prompt-guide/README.md` | Single page                                           |
| **Contributing**    | Root `CONTRIBUTING.md`        | Pull into nav via explicit entry                      |
| **Changelog**       | Root `CHANGELOG.md`           | Pull into nav                                         |

### Exclude (internal / presenter toolkit)

| Content                                                       | Reason                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `docs/presenter/`                                             | Internal pitch materials, ROI calculator, .pptx — not user-facing docs |
| `docs/exec-plans/`                                            | Internal project tracking — execution plans, tech-debt tracker         |
| `docs/branch-ruleset-config.md`                               | Internal repo governance config                                        |
| `agent-output/`                                               | Per-project generated artifacts — not static docs                      |
| `.github/agents/`, `.github/skills/`, `.github/instructions/` | Internal agent system — link to GitHub source where needed             |

## 5. Navigation Structure (`mkdocs.yml`)

```yaml
nav:
  - Home: index.md
  - Getting Started:
      - Quickstart: quickstart.md
      - Dev Containers: dev-containers.md
  - Concepts:
      - How It Works: how-it-works.md
      - Workflow: workflow.md
      - Glossary: GLOSSARY.md
  - Guides:
      - Prompt Guide: prompt-guide/index.md
      - Troubleshooting: troubleshooting.md
  - Project:
      - Contributing: CONTRIBUTING.md
      - Changelog: CHANGELOG.md
```

## 6. Files to Create

| File                         | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `mkdocs.yml`                 | Site config (theme, plugins, nav, markdown extensions)      |
| `.github/workflows/docs.yml` | GitHub Actions: build + deploy to `gh-pages` branch         |
| `docs/index.md`              | Either rename `docs/README.md` or create a redirect/symlink |
| `docs/CONTRIBUTING.md`       | Symlink or copy of root `CONTRIBUTING.md`                   |
| `docs/CHANGELOG.md`          | Symlink or copy of root `CHANGELOG.md`                      |
| `requirements-docs.txt`      | Docs-only Python dependencies (mkdocs-material, plugins)    |

## 7. `mkdocs.yml` — Key Configuration

```yaml
site_name: Agentic InfraOps
site_url: https://jonathan-vella.github.io/azure-agentic-infraops/
repo_url: https://github.com/jonathan-vella/azure-agentic-infraops
repo_name: jonathan-vella/azure-agentic-infraops
edit_uri: edit/main/docs/

theme:
  name: material
  palette:
    - scheme: default
      primary: blue
      toggle:
        icon: material/brightness-7
        name: Dark mode
    - scheme: slate
      primary: blue
      toggle:
        icon: material/brightness-4
        name: Light mode
  features:
    # Navigation — SPA-like experience
    - navigation.instant
    - navigation.instant.prefetch
    - navigation.instant.progress
    - navigation.tracking
    - navigation.sections
    - navigation.expand
    - navigation.top
    - navigation.indexes
    - navigation.path
    # Table of contents
    - toc.follow
    # Search
    - search.suggest
    - search.highlight
    # Content
    - content.code.copy
    - content.code.annotate
    - content.tabs.link

markdown_extensions:
  # Python Markdown core
  - admonition
  - tables
  - attr_list
  - md_in_html
  - def_list
  - footnotes
  - toc:
      permalink: true
  # PyMdown Extensions
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_mermaid
  - pymdownx.tabbed:
      alternate_style: true
  - pymdownx.highlight:
      anchor_linenums: true
      line_spans: __span
      pygments_lang_class: true
  - pymdownx.inlinehilite
  - pymdownx.snippets
  - pymdownx.details
  - pymdownx.keys
  - pymdownx.mark
  - pymdownx.emoji:
      emoji_index: !!python/name:material.extensions.emoji.twemoji
      emoji_generator: !!python/name:material.extensions.emoji.to_svg

plugins:
  - search
```

### Key Feature Rationale

| Feature                           | Why                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `navigation.instant` + `prefetch` | SPA-like page transitions; search index survives navigation. `site_url` is **required** for this. |
| `navigation.instant.progress`     | Shows a loading bar on slow connections (only appears after 400ms).                               |
| `navigation.tracking`             | Updates URL hash as user scrolls through anchors.                                                 |
| `navigation.sections`             | Renders top-level nav groups as visual sections in the sidebar.                                   |
| `navigation.indexes`              | Allows section index pages (`index.md` inside folders, e.g., prompt-guide).                       |
| `navigation.path`                 | Breadcrumb navigation above page titles.                                                          |
| `navigation.top`                  | Back-to-top button on scroll — replaces all manual `⬆️ Back to Top` links.                        |
| `toc.follow`                      | Sidebar auto-scrolls to keep the active heading visible.                                          |
| `content.code.copy`               | Copy button on every code block — critical since docs have many CLI snippets.                     |
| `content.code.annotate`           | Allows `# (1)` annotations in code blocks for inline explanations.                                |
| `content.tabs.link`               | When user clicks "Terraform" tab, all Bicep/Terraform tabs switch globally.                       |
| `pymdownx.details`                | Renders `??? note` collapsible admonitions (replaces HTML `<details>`).                           |
| `pymdownx.keys`                   | Renders `++ctrl+shift+i++` as styled keyboard badges.                                             |
| `pymdownx.mark`                   | Allows `==highlighted text==` for emphasis.                                                       |
| `edit_uri`                        | Adds "Edit this page" pencil icon linking to GitHub source.                                       |

## 8. GitHub Actions Workflow (`.github/workflows/docs.yml`)

Triggers on push to `main` when docs change. Uses `mkdocs gh-deploy`.

```yaml
name: docs

on:
  push:
    branches: [main]
    paths:
      - "docs/**"
      - "mkdocs.yml"
      - "CONTRIBUTING.md"
      - "CHANGELOG.md"
      - "requirements-docs.txt"
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements-docs.txt
      - run: mkdocs gh-deploy --force
```

## 9. `requirements-docs.txt`

```text
mkdocs-material>=9.5
pymdown-extensions>=10.0
```

Material bundles Mermaid support, search, and all markdown extensions.

## 10. Link Remediation

Several docs reference `.github/` internal paths (e.g., `../.github/agents/01-conductor.agent.md`).

| Current Pattern                        | Fix                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `../.github/agents/*.agent.md`         | GitHub source link: `https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/agents/...` |
| `../.github/skills/*/SKILL.md`         | GitHub source link                                                                                          |
| `../VERSION.md`, `../QUALITY_SCORE.md` | GitHub source link                                                                                          |
| `../CONTRIBUTING.md`                   | Relative link to `CONTRIBUTING.md` (pulled into docs/)                                                      |

This can be done incrementally — broken links show as 404s but won't block the initial launch.

## 11. Phased Rollout

| Phase                                                 | Scope                                                                                                         | Steps         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------- |
| **Phase 1 — Ship it**                                 | `mkdocs.yml` + workflow + `index.md` + copies for CONTRIBUTING/CHANGELOG. Deploy existing docs as-is.         | Steps 1-2     |
| **Phase 2 — Fix links + HTML**                        | Review Mermaid/HTML blocks, convert `../.github/` paths to GitHub source URLs, `mkdocs build --strict` clean. | Steps 3-4     |
| **Phase 3 — Polish (MkDocs Material best practices)** | Apply Section 2a recommendations. See conversion guide below.                                                 | Step 3a (new) |
| **Phase 4 — Workflow + Deploy**                       | Create GitHub Actions workflow, final build, commit, push, enable Pages.                                      | Steps 5-7     |
| **Phase 5 — Versioning**                              | Add `mike` for versioned docs if the project cuts releases with breaking changes.                             | Future        |

### Phase 3 Conversion Guide

Apply these changes to **all docs except `how-it-works.md`** during Step 3a:

**1. Remove rainbow dividers and back-to-top links**

Search and delete all instances of:

```html
<img
  src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png"
  alt="section divider"
  width="100%"
/>
```

```html
<div align="right">
  <a href="#top"><b>⬆️ Back to Top</b></a>
</div>
```

```html
<a id="top"></a>
```

These are replaced by `navigation.top` (automatic back-to-top button) and Material's
clean heading-anchored sidebar navigation.

**2. Convert `<details>` blocks to admonitions**

Before (HTML):

```html
<details>
  <summary>Click to expand</summary>

  Content here...
</details>
```

After (MkDocs Material):

```markdown
??? note "Click to expand"

    Content here...
```

Use `???+` (with `+`) for blocks that should start expanded.
Choose type by context: `tip`, `warning`, `info`, `example`, `note`.

**3. Convert blockquote callouts to admonitions**

Before:

```markdown
> **⚠️ REQUIRED**: The Conductor pattern requires this setting.
```

After:

```markdown
!!! warning "Required"

    The Conductor pattern requires this setting.
```

**4. Use content tabs for Bicep/Terraform dual-track content**

Before (two separate sections):

```markdown
### Bicep Commands

...commands...

### Terraform Commands

...commands...
```

After:

```markdown
=== "Bicep"

    ...commands...

=== "Terraform"

    ...commands...
```

The `content.tabs.link` feature syncs all tabs site-wide — click "Terraform"
once and every Bicep/Terraform tab pair switches.

**5. Use `pymdownx.keys` for keyboard shortcuts**

Before: `Ctrl+Shift+I`
After: `++ctrl+shift+i++` (renders as styled key badges)

**6. Add code block titles where relevant**

Before:

````markdown
```bash
az login
```
````

After:

````markdown
```bash title="Verify Azure CLI authentication"
az login
```
````

**7. Convert platform-specific instructions to content tabs** (dev-containers.md)

Use `=== "Windows"` / `=== "macOS"` / `=== "Linux"` tabs instead of separate
H3 sections for platform-specific instructions.

## 12. Repo Settings Required

1. **GitHub Pages source**: Set to "Deploy from a branch" → `gh-pages` / `/ (root)`
2. **No custom domain** initially — use the default `github.io` URL
