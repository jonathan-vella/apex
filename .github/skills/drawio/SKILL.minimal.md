<!-- digest:auto-generated from SKILL.md — do not edit manually -->

---

name: drawio
description: "Minimal Draw.io reference via simonkurtz-MSFT MCP server. Load at >80% context."
metadata:
tier: minimal
version: "2.0"

---

# Draw.io — Minimal

## MCP Server Tools

`search-shapes` → `create-groups` → `add-cells` (shape_name for icons) → `add-cells-to-group` → `finish-diagram`

## Output Files

- `03-des-diagram.drawio`, `04-dependency-diagram.drawio`
- `04-runtime-diagram.drawio`, `07-ab-diagram.drawio`
- All in `agent-output/{project}/`

## 5 Critical Rules

1. Use `shape_name` in `add-cells` for Azure icons — do NOT specify width/height/style
2. Each batch tool called exactly ONCE with ALL items
3. Use transactional mode (`transactional: true`) for multi-step, then `finish-diagram`
4. Cross-cutting services at bottom, NO edges to them
5. Edges: orthogonal only, NO anchor points (entryX/exitX etc.)

## Add Cells Example

```json
{
  "cells": [
    {
      "type": "vertex",
      "shape_name": "Front Doors",
      "x": 200,
      "y": 100,
      "text": "Front Door",
      "temp_id": "fd"
    },
    {
      "type": "vertex",
      "shape_name": "App Services",
      "x": 400,
      "y": 100,
      "text": "Web App",
      "temp_id": "web"
    },
    { "type": "edge", "source_id": "fd", "target_id": "web", "text": "HTTPS" }
  ]
}
```
