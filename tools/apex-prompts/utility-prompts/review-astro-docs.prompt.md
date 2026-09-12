---
description: "Single deep-reviewer audit of the Astro Starlight docs site covering completeness, accuracy, errors, grammar, visuals, Microsoft terminology, site standards, and information architecture. Report-only by default; safe auto-fix gated behind --apply-fixes."
agent: agent
model: "Claude Opus 4.7"
tools:
  - vscode
  - read
  - search
  - execute
  - edit
  - web
  - agent
argument-hint: "Optional: scope path under site/src/content/docs/ (e.g., 'getting-started/'), and/or --apply-fixes, --screenshot-age-months N"
---

# Review Astro Docs (Deep)

Local operational adapter. Preserve this prompt's agent, model, and tool routing.
Read [apex-workflow-engine](../../../.github/skills/apex-workflow-engine/SKILL.md), then
follow the [canonical procedure](../../../.github/skills/apex-workflow-engine/references/review-astro-docs.md).

Pass supplied inputs, scope, and options unchanged. Preserve the procedure's
required inputs, activities, output paths, approval gates, and bounded failures.
A reference grants no tools or model changes. Stop on unavailable prerequisites;
never silently inherit a different model, widen access, or invent success.
