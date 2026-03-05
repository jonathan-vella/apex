<a id="top"></a>

```mermaid
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'primaryColor': '#ffffff',
      'primaryTextColor': '#333333',
      'primaryBorderColor': '#4338ca',
      'lineColor': '#818cf8',
      'secondaryColor': '#f3f4f6',
      'tertiaryColor': '#e0e7ff',
      'edgeLabelBackground': '#ffffff',
      'fontFamily': 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif'
    },
    'flowchart': {
      'htmlLabels': true,
      'curve': 'basis',
      'nodeSpacing': 50,
      'rankSpacing': 50
    }
  }
}%%
flowchart LR
    classDef default fill:#ffffff,stroke:#8b5cf6,stroke-width:2px,color:#1f2937,rx:8px,ry:8px,shadow:drop-shadow(0 4px 6px -1px rgb(0 0 0 / 0.1));
    classDef gate fill:#fdf4ff,stroke:#d946ef,stroke-width:2px,color:#86198f,rx:20px,ry:20px;
    classDef step fill:#f0fdf4,stroke:#10b981,stroke-width:2px,color:#065f46;

    S1["Start"]:::step --> G1{{"Gate"}}:::gate --> S2["End"]:::default
```
