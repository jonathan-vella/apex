---
description: "Orchestrate the full GitHub Pages setup — reads state, resumes from last checkpoint, executes each step in order with approval gates."
agent: agent
model: "Claude Opus 4.6 (1M context)(Internal only)"
tools:vscode, execute, read, agent, browser, edit, search, web, todo
[execute/runInTerminal, read/readFile, edit/editFiles, search/codebase, todo]
---

# GitHub Pages — Session Resume

Resume or start the GitHub Pages documentation site setup.

## Protocol

1. Read `docs/exec-plans/active/github-pages-state.json`
2. Read `docs/exec-plans/active/github-pages-plan.md` for full context
3. Find the first step with `status: "pending"` or `status: "in_progress"`
4. Read the step's prompt file (from the `prompt` field in the state JSON)
5. Execute that step's instructions
6. Update the state file on completion
7. **Ask the user for approval** before proceeding to the next step
8. Repeat from step 3

## Step Overview

| Step | Name                               | Prompt                                | Gate     |
| ---- | ---------------------------------- | ------------------------------------- | -------- |
| 1    | Scaffold MkDocs                    | `ghpages-step1-scaffold.prompt.md`    | Auto     |
| 2    | Local Build Verification           | `ghpages-step2-build.prompt.md`       | Auto     |
| 3    | File Review — Mermaid & HTML       | `ghpages-step3-review-html.prompt.md` | Approval |
| 3a   | Polish — MkDocs Material practices | `ghpages-step3a-polish.prompt.md`     | Approval |
| 4    | Link Remediation                   | `ghpages-step4-fix-links.prompt.md`   | Approval |
| 5    | GitHub Actions Workflow            | `ghpages-step5-workflow.prompt.md`    | Auto     |
| 6    | Final Build & Commit               | `ghpages-step6-final.prompt.md`       | Approval |
| 7    | Enable GitHub Pages                | `ghpages-step7-enable.prompt.md`      | Manual   |

## Rules

- Always work on the `feat/github-pages-docs` branch
- Do NOT modify files outside `docs/`, `mkdocs.yml`, `requirements-docs.txt`,
  `.github/workflows/docs.yml`, and `.github/prompts/ghpages-*` unless necessary
- After each step, update the state JSON before asking for approval
- If a step fails, set status to `"in_progress"`, note the sub_step, and report
  the issue — do not skip ahead
