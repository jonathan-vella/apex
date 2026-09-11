<!-- ref:mermaid-styling-v1 -->

# Mermaid Styling, Theming, and Astro Integration

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

## Astro / Starlight Integration

In this project, Mermaid is rendered client-side by `rehype-mermaid-lite`.
Use fenced code blocks with `mermaid` language:

````markdown
```mermaid
graph LR
  A --> B
```
````
