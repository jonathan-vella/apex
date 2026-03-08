---
description: "GitHub Pages Step 1/7: Scaffold MkDocs Material project files"
agent: agent
model: "Claude Opus 4.6 (1M context)(Internal only)"
tools:vscode, execute, read, agent, browser, edit, search, web, todo
[execute/runInTerminal, read/readFile, edit/editFiles, search/codebase, todo]
---

# GitHub Pages — Step 1: Scaffold MkDocs

## Context

Read the plan and state files first:

- `docs/exec-plans/active/github-pages-plan.md` — full plan
- `docs/exec-plans/active/github-pages-state.json` — progress tracker

## Task

Create the MkDocs Material project scaffolding. All files go on the `feat/github-pages-docs` branch.

### 1.1 Create `requirements-docs.txt` (repo root)

```text
mkdocs-material>=9.5
pymdown-extensions>=10.0
```

### 1.2 Create `mkdocs.yml` (repo root)

Use the configuration from **Section 7** of the plan. Key points:

- `docs_dir: docs/`
- `site_url` is **required** for instant navigation
- `edit_uri: edit/main/docs/` — enables "Edit this page" links
- Theme: Material with light/dark toggle, `primary: blue`
- **Navigation features**: `navigation.instant`, `navigation.instant.prefetch`,
  `navigation.instant.progress`, `navigation.tracking`, `navigation.sections`,
  `navigation.expand`, `navigation.top`, `navigation.indexes`, `navigation.path`
- **TOC**: `toc.follow` (sidebar tracks active heading)
- **Content features**: `content.code.copy`, `content.code.annotate`, `content.tabs.link`
- **Search**: `search.suggest`, `search.highlight`
- Extensions: `pymdownx.superfences` (Mermaid fences), `pymdownx.details`,
  `pymdownx.tabbed`, `pymdownx.highlight`, `pymdownx.inlinehilite`,
  `pymdownx.snippets`, `pymdownx.keys`, `pymdownx.mark`, `pymdownx.emoji`,
  `admonition`, `tables`, `attr_list`, `md_in_html`, `def_list`, `footnotes`,
  `toc` with permalinks
- Plugins: `search` only
- Nav structure from **Section 5** of the plan

### 1.3 Create `docs/index.md`

Copy the current `docs/README.md` content into `docs/index.md`. Do NOT delete `docs/README.md` — keep both so GitHub still renders the README. Add a hidden comment at the top of `index.md`: `<!-- MkDocs landing page — source of truth is this file -->`.

### 1.4 Pull root files into docs/

- Copy `CONTRIBUTING.md` → `docs/CONTRIBUTING.md` (add a comment at top: `<!-- Copied from repo root for MkDocs — keep in sync -->`)
- Copy `CHANGELOG.md` → `docs/CHANGELOG.md` (same comment)

### 1.5 Rename `docs/prompt-guide/README.md`

MkDocs needs `index.md` for folder landing pages. Copy `docs/prompt-guide/README.md` → `docs/prompt-guide/index.md`. Keep the original so GitHub still works.

## Completion

After all files are created:

1. Update `docs/exec-plans/active/github-pages-state.json`:
   - Set `steps.1.status` to `"complete"`
   - Set `steps.1.started` and `steps.1.completed` to current ISO timestamp
   - Set `steps.1.artifacts` to the list of created files
   - Set `current_step` to `2`
   - Update `updated` timestamp
2. Do NOT commit yet — Step 2 will verify the build first
