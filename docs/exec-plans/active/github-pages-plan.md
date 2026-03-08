# GitHub Pages Documentation Plan

> Publish the `docs/` folder as a searchable documentation site using MkDocs Material.

- **Status**: Draft
- **Created**: 2026-03-08
- **Branch**: `feat/github-pages-docs`
- **Target URL**: `https://jonathan-vella.github.io/azure-agentic-infraops/`

---

## 1. Goal

Publish the `docs/` folder as a clean, searchable documentation site at
`https://jonathan-vella.github.io/azure-agentic-infraops/` using **MkDocs Material**,
deployed automatically from `main` via GitHub Actions.

## 2. Why MkDocs Material

| Factor | Rationale |
|---|---|
| **Python-native** | Already in the dev container; no React/Node build chain added |
| **Mermaid support** | Built-in plugin — `workflow.md` and `troubleshooting.md` use Mermaid diagrams that raw Pages won't render |
| **HTML blocks** | `docs/README.md` uses `<div>`, `<img>`, `<a id>` — Material passes these through correctly |
| **GFM tables** | All docs use pipe tables extensively — rendered natively |
| **Search** | Built-in full-text search with zero config |
| **Admonitions** | Can progressively adopt `!!! note` / `!!! warning` callouts |

## 3. Site Map — What to Publish vs. Exclude

### Publish (public-facing)

| Nav Section | Source | Notes |
|---|---|---|
| **Home** | `docs/README.md` → `index.md` | Rename or symlink; becomes landing page |
| **Quickstart** | `docs/quickstart.md` | As-is |
| **How It Works** | `docs/how-it-works.md` | Largest page (1,192 lines) — consider splitting later |
| **Workflow** | `docs/workflow.md` | Mermaid diagrams render via `superfences` plugin |
| **Dev Containers** | `docs/dev-containers.md` | As-is |
| **Troubleshooting** | `docs/troubleshooting.md` | Mermaid decision tree renders correctly |
| **Glossary** | `docs/GLOSSARY.md` | As-is |
| **Prompt Guide** | `docs/prompt-guide/README.md` | Single page |
| **Contributing** | Root `CONTRIBUTING.md` | Pull into nav via explicit entry |
| **Changelog** | Root `CHANGELOG.md` | Pull into nav |

### Exclude (internal / presenter toolkit)

| Content | Reason |
|---|---|
| `docs/presenter/` | Internal pitch materials, ROI calculator, .pptx — not user-facing docs |
| `docs/exec-plans/` | Internal project tracking — execution plans, tech-debt tracker |
| `docs/branch-ruleset-config.md` | Internal repo governance config |
| `agent-output/` | Per-project generated artifacts — not static docs |
| `.github/agents/`, `.github/skills/`, `.github/instructions/` | Internal agent system — link to GitHub source where needed |

## 4. Navigation Structure (`mkdocs.yml`)

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

## 5. Files to Create

| File | Purpose |
|---|---|
| `mkdocs.yml` | Site config (theme, plugins, nav, markdown extensions) |
| `.github/workflows/docs.yml` | GitHub Actions: build + deploy to `gh-pages` branch |
| `docs/index.md` | Either rename `docs/README.md` or create a redirect/symlink |
| `docs/CONTRIBUTING.md` | Symlink or copy of root `CONTRIBUTING.md` |
| `docs/CHANGELOG.md` | Symlink or copy of root `CHANGELOG.md` |
| `requirements-docs.txt` | Docs-only Python dependencies (mkdocs-material, plugins) |

## 6. `mkdocs.yml` — Key Configuration

```yaml
site_name: Agentic InfraOps
site_url: https://jonathan-vella.github.io/azure-agentic-infraops/
repo_url: https://github.com/jonathan-vella/azure-agentic-infraops
repo_name: jonathan-vella/azure-agentic-infraops

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
    - navigation.sections
    - navigation.expand
    - navigation.top
    - search.suggest
    - search.highlight
    - content.code.copy

markdown_extensions:
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_mermaid
  - pymdownx.tabbed:
      alternate_style: true
  - pymdownx.highlight:
      anchor_linenums: true
  - pymdownx.details
  - admonition
  - tables
  - attr_list
  - md_in_html
  - toc:
      permalink: true

plugins:
  - search
```

## 7. GitHub Actions Workflow (`.github/workflows/docs.yml`)

Triggers on push to `main` when docs change. Uses `mkdocs gh-deploy`.

```yaml
name: docs

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - 'mkdocs.yml'
      - 'CONTRIBUTING.md'
      - 'CHANGELOG.md'
      - 'requirements-docs.txt'
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
          python-version: '3.12'
      - run: pip install -r requirements-docs.txt
      - run: mkdocs gh-deploy --force
```

## 8. `requirements-docs.txt`

```text
mkdocs-material>=9.5
pymdown-extensions>=10.0
```

Material bundles Mermaid support, search, and all markdown extensions.

## 9. Link Remediation

Several docs reference `.github/` internal paths (e.g., `../.github/agents/01-conductor.agent.md`).

| Current Pattern | Fix |
|---|---|
| `../.github/agents/*.agent.md` | GitHub source link: `https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/agents/...` |
| `../.github/skills/*/SKILL.md` | GitHub source link |
| `../VERSION.md`, `../QUALITY_SCORE.md` | GitHub source link |
| `../CONTRIBUTING.md` | Relative link to `CONTRIBUTING.md` (pulled into docs/) |

This can be done incrementally — broken links show as 404s but won't block the initial launch.

## 10. Phased Rollout

| Phase | Scope | Effort |
|---|---|---|
| **Phase 1 — Ship it** | `mkdocs.yml` + workflow + `index.md` + symlinks for CONTRIBUTING/CHANGELOG. Deploy existing docs as-is. | ~1 hour |
| **Phase 2 — Fix links** | Convert `../.github/` relative paths to GitHub source URLs. Run `mkdocs build --strict` to catch broken links. | ~30 min |
| **Phase 3 — Polish** | Add admonition callouts, split `how-it-works.md` into sub-pages, add a favicon/logo, customize colors. | Optional |
| **Phase 4 — Versioning** | Add `mike` for versioned docs if the project starts cutting releases with breaking changes. | Future |

## 11. Repo Settings Required

1. **GitHub Pages source**: Set to "Deploy from a branch" → `gh-pages` / `/ (root)`
2. **No custom domain** initially — use the default `github.io` URL
