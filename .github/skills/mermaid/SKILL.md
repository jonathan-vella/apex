---
name: mermaid
description: '**UTILITY SKILL** — Mermaid diagram generation for inline markdown documentation: flowcharts, sequence diagrams, Gantt, class, state, ER. WHEN: "mermaid flowchart", "sequence diagram", "Gantt chart", "state diagram", "ER diagram", "inline markdown diagram". USE FOR: inline markdown diagrams, flowcharts, sequence diagrams, Gantt charts, state diagrams, ER diagrams. DO NOT USE FOR: architecture diagrams with Azure icons (use drawio), WAF/cost charts (use python-diagrams).'
compatibility: Works with VS Code Copilot, Claude Code, and any tool that renders Mermaid in markdown.
license: MIT
metadata:
  author: apex
  version: "1.0"
---

# Mermaid Diagrams

Skill for generating Mermaid diagrams embedded in markdown fences. Mermaid is used
for inline documentation diagrams — flowcharts, sequences, state machines, ER
diagrams, and Gantt charts. For architecture diagrams with Azure service icons,
use the `drawio` skill instead.

## When to Use Mermaid

- Inline diagrams inside markdown documents (`.md`, `.mdx`)
- Quick flowcharts for operational runbooks and process docs
- Sequence diagrams for auth flows and API interactions
- Gantt charts for project plans and maintenance schedules
- State diagrams for lifecycle documentation
- ER diagrams for data model overviews
- Azure resource relationship diagrams from live queries

## Syntax Reference

### Flowcharts

```mermaid
graph TB
    A["Step 1"] --> B{"Decision"}
    B -->|"Yes"| C["Action"]
    B -->|"No"| D["Skip"]
```

Use `graph TB` (top-to-bottom) for vertical layouts.
Use `graph LR` (left-to-right) for horizontal layouts.
Use subgraphs for logical grouping:

```mermaid
graph TB
    subgraph "Resource Group"
        APP["App Service"]
        SQL["SQL Database"]
    end
    APP --> SQL
```

### Sequence Diagrams

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    Client->>API: Request
    API->>DB: Query
    DB-->>API: Result
    API-->>Client: Response
```

### Gantt Charts

```mermaid
gantt
    title Deployment Schedule
    dateFormat YYYY-MM-DD
    section Phase 1
        Task A :a1, 2026-01-01, 7d
        Task B :a2, after a1, 5d
```

### State Diagrams

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Active: Approve
    Active --> Suspended: Suspend
    Suspended --> Active: Resume
    Active --> [*]: Complete
```

### ER Diagrams

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"
```

## Theming (Dark Mode Compatible)

Include a neutral theme directive for dark mode compatibility:

```mermaid
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'primaryColor': '#ffffff',
      'primaryTextColor': '#333333',
      'primaryBorderColor': '#e91e63',
      'lineColor': '#475569',
      'fontFamily': 'ui-sans-serif, system-ui, -apple-system, sans-serif'
    }
  }
}%%
graph LR
    A --> B
```

## Node Styling

Use `classDef` for consistent node styling:

```mermaid
graph TB
    classDef default fill:#ffffff,stroke:#e91e63,stroke-width:2px,color:#1f2937,rx:8px,ry:8px;
    classDef gate fill:#ffffff,stroke:#3b82f6,stroke-width:2px,color:#1f2937,rx:8px,ry:8px;

    S1["Step 1"]
    G1{{"Gate"}}:::gate
```

## Azure Resource Visualization

For visualizing live Azure resource groups as Mermaid diagrams, use the
`azure-resources` skill (Mode B: Visualize) which outputs resource relationship
diagrams in Mermaid format. That skill handles Azure Resource Graph queries,
resource discovery, and relationship mapping.

### Resource Diagram Conventions

- Group by layer: Network, Compute, Data, Security, Monitoring
- Include resource details in node labels (use `<br/>` for line breaks)
- Label all connections descriptively
- Use subgraphs for logical grouping
- Connection types:
  - `-->` for data flow or dependencies
  - `-.->` for optional/conditional connections
  - `==>` for critical/primary paths

## Astro / Starlight Integration

In this project, Mermaid is rendered client-side by `rehype-mermaid-lite`.
Use fenced code blocks with `mermaid` language:

````markdown
```mermaid
graph LR
  A --> B
```
````

## Rules

**DO:** Use fenced code blocks with `mermaid` language tag · Include theme
directives for dark mode · Use `graph TB` for vertical layouts · Use subgraphs
for grouping · Use descriptive connection labels · Validate syntax before
committing.

**DON'T:** Use Mermaid for WAF/cost charts (use `python-diagrams`) · Use Mermaid
for primary architecture diagrams with Azure icons (use `drawio`) · Omit
theme directives · Create overly complex diagrams that don't render well ·
Use inline Mermaid for diagrams that need icon embedding.

## Steps

1. **Pick the diagram type** — flowchart, sequence, Gantt, state, ER, class — see [Syntax Reference](#syntax-reference)
2. **Choose the layout** — `graph TB` (vertical) or `graph LR` (horizontal); use subgraphs for logical grouping
3. **Author the diagram** inside a triple-backtick `mermaid` fence in your markdown
4. **Add theming** — include dark-mode-compatible theme directives (see [Theming](#theming-dark-mode-compatible))
5. **Apply node styling** — use descriptive labels and consistent shapes for like roles
6. **Validate** — render in VS Code preview or Starlight build; check that all nodes resolve and edges have labels
7. **Commit** — the rendered Mermaid stays inline; no separate `.drawio` / `.png` artifact needed

## Scope Exclusions

Does NOT: generate Draw.io architecture diagrams · produce Python charts ·
generate Bicep/Terraform · create ADRs · deploy resources · embed Azure service
icons (use `drawio` skill).
