---
description: "Open a sensei-free PR from feat/skills-sensei (or any sensei-bearing branch) into main. Dynamically discovers sensei-coupled files, classifies them into tiers, asks for approval, then creates a clean chore/merge-{source}-to-{target} branch and PR."
agent: agent
model: "Claude Sonnet 5"
tools: [vscode, execute, read, edit, search, terminal, todo]
argument-hint: "[source-branch] [target-branch] — defaults: feat/skills-sensei to main"
---

# Merge Sensei-Free PR

Local operational adapter. Preserve this prompt's agent, model, and tool routing.
Read [apex-github-operations](../../../.github/skills/apex-github-operations/SKILL.md), then
follow the [canonical procedure](../../../.github/skills/apex-github-operations/references/merge-sensei-free-pr.md).

Pass supplied inputs, scope, and options unchanged. Preserve the procedure's
required inputs, activities, output paths, approval gates, and bounded failures.
A reference grants no tools or model changes. Stop on unavailable prerequisites;
never silently inherit a different model, widen access, or invent success.
