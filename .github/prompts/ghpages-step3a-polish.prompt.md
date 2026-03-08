---
description: "GitHub Pages Step 3a: Apply MkDocs Material best-practice improvements to docs"
agent: agent
model: "Claude Opus 4.6 (1M context)(Internal only)"
tools:vscode, execute, read, agent, browser, edit, search, web, todo
[execute/runInTerminal, read/readFile, edit/editFiles, search/codebase, todo]
---

# GitHub Pages — Step 3a: Documentation Polish (MkDocs Material Best Practices)

## Context

Read the state file first: `docs/exec-plans/active/github-pages-state.json`
Read **Section 2a** and **Phase 3 Conversion Guide** (Section 11) of
`docs/exec-plans/active/github-pages-plan.md`.
Confirm Step 3 (Mermaid & HTML review) is complete before proceeding.

## CRITICAL: Do NOT modify `docs/how-it-works.md`

This file is explicitly excluded from all improvements.

## Task

Apply MkDocs Material best-practice improvements to all in-scope docs files.
Work through each file in priority order below. For each file, apply only the
changes listed in Section 2a of the plan.

### 3a.1 Cross-cutting removals (all files except `how-it-works.md`)

Search and remove across all published docs:

1. **Rainbow image dividers** — Delete every occurrence of:

```html
<img
  src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png"
  alt="section divider"
  width="100%"
/>
```

2. **Manual back-to-top links** — Delete every occurrence of:

```html
<div align="right">
  <a href="#top"><b>⬆️ Back to Top</b></a>
</div>
```

3. **Top-of-page anchor tags** — Delete:

```html
<a id="top"></a>
```

These are all replaced by Material's built-in `navigation.top` feature (automatic
back-to-top button on scroll-up).

Apply to: `docs/index.md`, `docs/README.md`, `docs/quickstart.md`,
`docs/workflow.md`, `docs/troubleshooting.md`, `docs/dev-containers.md`,
`docs/GLOSSARY.md`, `docs/prompt-guide/index.md`.

### 3a.2 Convert `<details>` blocks to admonitions

In each file, find HTML `<details>/<summary>` blocks and convert to MkDocs
Material admonition syntax:

**Before:**

```html
<details>
  <summary>Click to expand</summary>

  Content here...
</details>
```

**After:**

```markdown
??? note "Click to expand"

    Content here...
```

Use the appropriate admonition type based on content:

- `??? tip` — for helpful hints
- `??? warning` — for caution items
- `??? example` — for example prompts/code
- `??? info` — for additional context
- `??? note` — for general collapsible content
- `???+ note` — for content that should start expanded

Apply to: `docs/quickstart.md`, `docs/dev-containers.md`,
`docs/troubleshooting.md`, `docs/prompt-guide/index.md`.

### 3a.3 Convert blockquote callouts to admonitions

Find blockquote callouts using emoji prefixes and convert:

**Before:**

```markdown
> **⚠️ REQUIRED**: The Conductor pattern requires this setting.
```

**After:**

```markdown
!!! warning "Required"

    The Conductor pattern requires this setting.
```

**Before:**

```markdown
> **💡 Tip**: Use the prompt guide for examples.
```

**After:**

```markdown
!!! tip

    Use the prompt guide for examples.
```

### 3a.4 Convert platform instructions to content tabs (dev-containers.md)

In `docs/dev-containers.md`, convert platform-specific sections from
separate H3 headings to content tabs:

**Before:**

```markdown
#### Windows (with WSL 2)

...install instructions...

#### macOS

...install instructions...

#### Linux

...install instructions...
```

**After:**

```markdown
=== "Windows (WSL 2)"

    ...install instructions...

=== "macOS"

    ...install instructions...

=== "Linux"

    ...install instructions...
```

### 3a.5 Use content tabs for Bicep/Terraform dual-track content

In `docs/workflow.md` and `docs/quickstart.md`, where Bicep and Terraform
are shown as parallel options, wrap in content tabs:

```markdown
=== "Bicep"

    ...bicep content...

=== "Terraform"

    ...terraform content...
```

The `content.tabs.link` feature ensures all tabs sync site-wide.

### 3a.6 Verify after each file

After editing each file, run:

```bash
mkdocs build --strict 2>&1 | grep -i "warning\|error"
```

## File Processing Order

1. `docs/index.md` — landing page (highest impact)
2. `docs/quickstart.md` — first user touchpoint
3. `docs/workflow.md` — Mermaid + dual-track content
4. `docs/troubleshooting.md` — decision tree + collapsibles
5. `docs/dev-containers.md` — platform tabs conversion
6. `docs/GLOSSARY.md` — divider cleanup
7. `docs/prompt-guide/index.md` — example admonitions
8. `docs/README.md` — keep in sync with `index.md` changes

## Completion

1. Update `docs/exec-plans/active/github-pages-state.json`:
   - Set `steps.3a.status` to `"complete"`
   - Set timestamps, update `current_step` to `4`
   - List all modified files in `artifacts`
2. Do NOT commit yet — Step 4 completes link fixes
