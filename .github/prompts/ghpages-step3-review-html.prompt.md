---
description: "GitHub Pages Step 3/7: Review Mermaid diagrams and HTML blocks for MkDocs compatibility"
agent: agent
model: "Claude Sonnet 4.6"
tools:
  - read/readFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
---

# GitHub Pages — Step 3: File Review — Mermaid & HTML

## Context

Read the state file first: `docs/exec-plans/active/github-pages-state.json`
Read **Section 3** of `docs/exec-plans/active/github-pages-plan.md` for the file review matrix.
Confirm Step 2 is complete before proceeding.

## Task

Review and fix all in-scope files for MkDocs Material rendering compatibility.

### 3.1 Mermaid Diagram Audit (3 files)

For each file with Mermaid diagrams:

- `docs/workflow.md`
- `docs/how-it-works.md`
- `docs/troubleshooting.md`

Check:

1. Fences use exactly ` ```mermaid ` (triple backtick, no indent, no extra attributes)
2. Fences are NOT nested inside HTML `<div>` or `<details>` blocks (MkDocs superfences won't render them)
3. If a Mermaid block is inside a `<details>` tag, extract it outside or convert the `<details>` to an admonition

### 3.2 HTML Block Audit (8 in-scope files)

For each file listed in the plan Section 3 "Files with HTML Blocks":

1. **`<div align="right">` back-to-top links**: These render fine — leave as-is
2. **`<img>` tags**: Ensure `src` URLs are absolute or relative to `docs/` (not `../`)
3. **`<details>`/`<summary>` blocks**: Test if content inside renders. If markdown inside `<details>` doesn't render, add `markdown` attribute: `<div markdown>` or convert to `??? note "Title"` admonitions (MkDocs Material's collapsible syntax)
4. **`<a id="...">` anchors**: Leave as-is, MkDocs preserves them
5. **`<table>` elements**: If any exist, prefer converting to pipe tables

### 3.3 Fix Priority

Work through files in this order (highest impact first):

1. `docs/README.md` / `docs/index.md` — landing page, must look right
2. `docs/quickstart.md` — first page new users see
3. `docs/how-it-works.md` — Mermaid + HTML + largest file
4. `docs/workflow.md` — Mermaid + HTML
5. `docs/troubleshooting.md` — Mermaid + HTML
6. Remaining files

### 3.4 Verify fixes

After each file edit, run:

```bash
mkdocs build --strict 2>&1 | grep -i "warning\|error"
```

## Completion

1. Update `docs/exec-plans/active/github-pages-state.json`:
   - Set `steps.3.status` to `"complete"`
   - Set timestamps, update `current_step` to `4`
   - List modified files in `artifacts`
2. Do NOT commit yet — Step 4 completes link fixes
