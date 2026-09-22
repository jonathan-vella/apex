---
agent: agent
model: "MAI-Code-1.1-Flash"
description: "Stage everything except agent-output/, infra/, and .github/skills/sensei/ (unless on feat/skills-sensei), auto-generate a conventional commit, push, then prompt to open or update a PR. CLI-only (git + gh)."
argument-hint: "Optional commit subject. Leave blank to auto-generate from the diff."
tools: [vscode/askQuestions, execute/runInTerminal, read, todo]
---

# Git Commit, Push & PR (CLI-only)

Local operational adapter. Preserve this prompt's agent, model, and tool routing.
Read [apex-github-operations](../skills/apex-github-operations/SKILL.md), then
follow the [canonical procedure](../skills/apex-github-operations/references/git-commit.md).

Pass supplied inputs, scope, and options unchanged. Preserve the procedure's
required inputs, activities, output paths, approval gates, and bounded failures.
A reference grants no tools or model changes. Stop on unavailable prerequisites;
never silently inherit a different model, widen access, or invent success.
