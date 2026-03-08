---
description: "GitHub Pages Step 6/7: Final build verification, commit all changes, push"
agent: agent
model: "Claude Sonnet 4.6"
tools:
  - read/readFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
---

# GitHub Pages — Step 6: Final Build & Commit

## Context

Read the state file first: `docs/exec-plans/active/github-pages-state.json`
Confirm Steps 1-5 are complete before proceeding.

## Task

Final verification and commit of all GitHub Pages work.

### 6.1 Clean build

```bash
rm -rf site/
mkdocs build --strict 2>&1
```

Must show:

- Zero errors
- Zero warnings (or only expected warnings for excluded files)

### 6.2 Verify navigation

Check that `site/` output has all expected pages:

```bash
find site/ -name '*.html' | sort
```

Expected pages: `index.html`, `quickstart/`, `how-it-works/`, `workflow/`,
`dev-containers/`, `troubleshooting/`, `GLOSSARY/`, `prompt-guide/`,
`CONTRIBUTING/`, `CHANGELOG/`

### 6.3 Clean up build output

```bash
rm -rf site/
```

The `site/` directory should not be committed (it's built by CI).

### 6.4 Stage and commit

Stage all new and modified files:

```bash
git add -A
git status
```

Review the staged files. Expected new files:

- `mkdocs.yml`
- `requirements-docs.txt`
- `docs/index.md`
- `docs/CONTRIBUTING.md`
- `docs/CHANGELOG.md`
- `docs/prompt-guide/index.md`
- `.github/workflows/docs.yml`
- `.github/prompts/ghpages-step*.prompt.md`
- `docs/exec-plans/active/github-pages-*`

Expected modified files (link remediation):

- `docs/README.md` (if links were fixed there too)
- `docs/GLOSSARY.md`
- `docs/quickstart.md`
- `docs/workflow.md`
- Other docs files with fixed links

Commit with conventional commit:

```
feat(docs): add MkDocs Material site with GitHub Actions deployment
```

### 6.5 Push

```bash
git push
```

## Completion

1. Update `docs/exec-plans/active/github-pages-state.json`:
   - Set `steps.6.status` to `"complete"`
   - Set timestamps, update `current_step` to `7`
   - Note the commit SHA in `artifacts`
2. Commit and push the state update too (amend or separate commit)
