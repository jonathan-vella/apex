---
name: mermaid
description: '**UTILITY SKILL** — Mermaid diagrams for inline markdown: flowcharts, sequence, Gantt, class, state, ER. WHEN: "mermaid flowchart", "sequence diagram", "Gantt chart", "state diagram", "ER diagram", "inline markdown diagram". DO NOT USE FOR: Azure-icon architecture diagrams (drawio), WAF/cost charts (python-diagrams).'
compatibility: Works with VS Code Copilot, Claude Code, and any tool that renders Mermaid in markdown.
license: MIT
metadata:
  author: apex
  version: "1.0"
---

# Mermaid Diagrams

Skill for generating Mermaid diagrams embedded in markdown fences. Mermaid is
used for inline documentation — flowcharts, sequences, state machines, ER
diagrams, Gantt charts. For architecture diagrams with Azure service icons,
use the `drawio` skill instead.

## When to Use Mermaid

- Inline diagrams inside markdown (`.md`, `.mdx`)
- Flowcharts for operational runbooks and process docs
- Sequence diagrams for auth flows and API interactions
- Gantt charts for project plans and maintenance schedules
- State diagrams for lifecycle documentation
- ER diagrams for data model overviews
- Azure resource relationship diagrams from live queries (via `azure-resources` Mode B)

## Rules

**DO:** fenced code blocks with `mermaid` language tag · include theme
directives for dark mode · `graph TB` (vertical) or `graph LR` (horizontal) ·
subgraphs for grouping · descriptive connection labels · validate syntax
before committing.

**DON'T:** use Mermaid for WAF/cost charts (use `python-diagrams`) · use
Mermaid for primary architecture diagrams with Azure icons (use `drawio`) ·
omit theme directives · embed Azure service icons.

## Steps

1. Pick the diagram type — see [`references/syntax-cheatsheet.md`](references/syntax-cheatsheet.md)
2. Author inside a triple-backtick `mermaid` fence in your markdown
3. Add theming and node styles — see [`references/styling.md`](references/styling.md)
4. Validate — render in VS Code preview or Starlight build
5. Commit — the rendered Mermaid stays inline; no separate artifact

## Reference Index

| File                                | When to Load                                                   |
| ----------------------------------- | -------------------------------------------------------------- |
| `references/syntax-cheatsheet.md`   | Authoring any diagram type (flowchart, sequence, Gantt, ER, state) |
| `references/styling.md`             | Adding theming, node `classDef` styling, or Astro/Starlight integration |

## Scope Exclusions

Does NOT: generate Draw.io architecture diagrams · produce Python charts ·
generate Bicep/Terraform · create ADRs · deploy resources · embed Azure
service icons (use `drawio`).
