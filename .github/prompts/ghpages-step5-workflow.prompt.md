---
description: "GitHub Pages Step 5/7: Create GitHub Actions deployment workflow"
agent: agent
model: "Claude Sonnet 4.6"
tools:
  - read/readFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
---

# GitHub Pages — Step 5: GitHub Actions Workflow

## Context

Read the state file first: `docs/exec-plans/active/github-pages-state.json`
Read **Section 8** of `docs/exec-plans/active/github-pages-plan.md` for the workflow spec.
Confirm Step 4 is complete before proceeding.

## Task

Create the GitHub Actions workflow for automated docs deployment.

### 5.1 Create `.github/workflows/docs.yml`

Use the workflow from Section 8 of the plan with these specifics:

- **Trigger**: Push to `main` on paths `docs/**`, `mkdocs.yml`, `CONTRIBUTING.md`, `CHANGELOG.md`, `requirements-docs.txt`
- **Manual dispatch**: `workflow_dispatch` for initial setup and ad-hoc rebuilds
- **Permissions**: `contents: write` (needed to push to `gh-pages` branch)
- **Steps**: Checkout → Setup Python 3.12 → Install docs deps → `mkdocs gh-deploy --force`

### 5.2 Review existing workflows

Check that the new workflow doesn't conflict with existing workflows in `.github/workflows/`:

- `lint.yml` — triggers on PR + push to main, no conflict
- `agent-validation.yml` — no conflict
- Other workflows — verify no duplicate names or conflicting triggers

### 5.3 Add `.gitignore` entry (if needed)

Check if `site/` (MkDocs build output) is already in `.gitignore`. If not, add it.

## Completion

1. Update `docs/exec-plans/active/github-pages-state.json`:
   - Set `steps.5.status` to `"complete"`
   - Set timestamps, update `current_step` to `6`
   - Add `.github/workflows/docs.yml` to `artifacts`
2. Do NOT commit yet — Step 6 does the final build + commit
