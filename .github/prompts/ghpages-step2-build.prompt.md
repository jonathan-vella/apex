---
description: "GitHub Pages Step 2/7: Local build verification with mkdocs build --strict"
agent: agent
model: "Claude Sonnet 4.6"
tools:
  - read/readFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
---

# GitHub Pages — Step 2: Local Build Verification

## Context

Read the state file first: `docs/exec-plans/active/github-pages-state.json`
Confirm Step 1 is complete before proceeding.

## Task

Install MkDocs Material and verify the site builds cleanly.

### 2.1 Install dependencies

```bash
pip install -r requirements-docs.txt
```

### 2.2 Run strict build

```bash
mkdocs build --strict 2>&1
```

This will surface:

- Broken cross-references between docs pages
- Missing files referenced in `mkdocs.yml` nav
- Invalid Mermaid fences
- HTML parsing issues

### 2.3 Fix build errors

For each error:

- **Missing nav file**: Check if the file path in `mkdocs.yml` matches the actual file name (e.g., `index.md` vs `README.md`)
- **Broken link**: Note it for Step 4 (link remediation) — do not fix yet unless it blocks the build
- **Mermaid parse error**: Note it for Step 3 — do not fix yet unless it blocks the build

### 2.4 Run local preview (optional)

```bash
mkdocs serve --dev-addr 0.0.0.0:8000
```

Check the terminal output for any additional warnings.

## Completion

1. Update `docs/exec-plans/active/github-pages-state.json`:
   - Set `steps.2.status` to `"complete"`
   - Set timestamps and update `current_step` to `3`
   - Add any build warnings to `open_findings` array
2. Do NOT commit yet — Steps 3-4 will fix issues first
