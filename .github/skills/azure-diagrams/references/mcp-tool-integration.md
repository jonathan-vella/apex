<!-- ref:mcp-tool-integration-v1 -->

# MCP Tool Integration (Draw.io)

The drawio-mcp-server provides rich diagram tools. Key tools:

| Category        | Tools                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Shape discovery | `search-shapes`, `get-shape-categories`, `get-shapes-in-category`, `get-style-presets`       |
| Diagram build   | `add-cells` (batch), `edit-cells`, `edit-edges`, `set-cell-shape`, `delete-cell-by-id`       |
| Containers      | `create-groups`, `add-cells-to-group`, `list-group-children`                                 |
| Inspection      | `list-paged-model`, `get-diagram-stats`, `export-diagram`, `import-diagram`, `clear-diagram` |
| Pages/layers    | `create-page`, `list-pages`, `create-layer`, `set-active-layer`                              |
| Finish          | `finish-diagram` (resolves placeholders to full SVG)                                         |
| File I/O        | `save-to-file` (write .drawio to disk — no terminal needed)                                  |
| Quality         | `validate-diagram` (check overlaps, spacing, orphaned edges → score 0-10)                    |

## MCP-First Diagram Workflow

1. **Read architecture** — Extract resource list and data flow from `02-architecture-assessment.md`
2. **Plan layout** — Identify main flow (Users→Identity→Compute→VNet→Data), cross-cutting services, and external APIs
3. `search-shapes` — Find ALL icons in ONE call (main flow + cross-cutting)
4. `create-groups` — Create VNet container (and External APIs box if needed)
5. `add-cells` (batch, `transactional: true`) — Add all vertices
   (title, icons, labels, footer) then edges for primary flow only
6. `add-cells-to-group` — Place data services inside VNet
7. `finish-diagram` (`compress: true`) — Resolve placeholders
8. `validate-diagram` — Check quality score (>= 9/10);
   if below, adjust and retry (max 2 attempts, then accept)
9. `save-to-file` — Save `.drawio` directly to disk.
   No terminal extraction needed.

## Transactional Mode (50+ shapes)

For complex diagrams, pass `transactional: true` on each tool call to use lightweight
placeholder SVGs (~2-5KB per call instead of 200KB+). Call `finish-diagram` at the
end to resolve all placeholders to production-ready SVG XML.

## Example: add-cells with Azure icons

```json
{
  "cells": [
    {
      "type": "vertex",
      "temp_id": "web",
      "x": 100,
      "y": 100,
      "width": 64,
      "height": 64,
      "text": "Web App",
      "shape_name": "App Services"
    },
    {
      "type": "vertex",
      "temp_id": "sql",
      "x": 300,
      "y": 100,
      "width": 64,
      "height": 64,
      "text": "SQL Database",
      "shape_name": "SQL Database"
    },
    {
      "type": "edge",
      "source_id": "web",
      "target_id": "sql",
      "text": "SQL:1433"
    }
  ]
}
```

## Saving .drawio Files (via MCP `save-to-file`)

After `finish-diagram`, call `save-to-file` to write the diagram
directly to disk. The tool auto-decompresses compressed XML.

```json
{
  "diagram_xml": "<xml from finish-diagram response>",
  "file_path": "agent-output/{project}/03-des-diagram.drawio"
}
```

Response: `{ success: true, path: "...", size_bytes: 41000 }`

**NEVER** use `read_file` on MCP content.json responses — the
compressed data pollutes the LLM context window. Use `save-to-file`
instead, which handles decompression server-side.
