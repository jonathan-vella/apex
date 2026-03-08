---
description: "GitHub Pages Step 4/7: Fix parent-relative links that escape docs/"
agent: agent
model: "Claude Sonnet 4.6"
tools:
  - read/readFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
---

# GitHub Pages — Step 4: Link Remediation

## Context

Read the state file first: `docs/exec-plans/active/github-pages-state.json`
Read **Section 10** of `docs/exec-plans/active/github-pages-plan.md` for the link remediation rules.
Confirm Step 3 is complete before proceeding.

## Task

Convert all parent-relative links (`../`) that escape the `docs/` folder into
working links for the MkDocs-generated site.

### 4.1 Find all broken links

```bash
grep -rn '\.\.\/' docs/ --include='*.md' | grep -v 'exec-plans/' | grep -v 'presenter/' | grep -v 'branch-ruleset-config'
```

Only fix links in **published** files (files in the nav). Skip excluded files
(`docs/presenter/`, `docs/exec-plans/`, `docs/branch-ruleset-config.md`).

### 4.2 Remediation Rules

| Link Pattern | Replacement |
|---|---|
| `../VERSION.md` | `https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/VERSION.md` |
| `../QUALITY_SCORE.md` | `https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/QUALITY_SCORE.md` |
| `../.github/agents/{file}` | `https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/agents/{file}` |
| `../.github/skills/{path}` | `https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/skills/{path}` |
| `../.github/agents/` (directory) | `https://github.com/jonathan-vella/azure-agentic-infraops/tree/main/.github/agents` |
| `../.github/skills/` (directory) | `https://github.com/jonathan-vella/azure-agentic-infraops/tree/main/.github/skills` |
| `../mcp/{path}` | `https://github.com/jonathan-vella/azure-agentic-infraops/tree/main/mcp/{path}` |
| `../CONTRIBUTING.md` | `CONTRIBUTING.md` (now in docs/) |
| `../../VERSION.md` (from prompt-guide/) | `https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/VERSION.md` |

### 4.3 Apply to `docs/index.md` too

Since `docs/index.md` was copied from `docs/README.md`, apply the same link fixes there.

### 4.4 Cross-page relative links

Links between docs pages (e.g., `../quickstart.md` from `prompt-guide/`) should work as-is
in MkDocs since the files are all under `docs/`. Verify but don't change unless broken.

### 4.5 Verify

```bash
mkdocs build --strict 2>&1 | grep -i "warning\|error"
```

Should show zero link warnings for published pages.

## Completion

1. Update `docs/exec-plans/active/github-pages-state.json`:
   - Set `steps.4.status` to `"complete"`
   - Set timestamps, update `current_step` to `5`
   - List modified files in `artifacts`
2. Do NOT commit yet — Step 5 creates the workflow
