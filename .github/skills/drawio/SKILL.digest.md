<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Draw.io Architecture Diagrams (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Prerequisites

- **Draw.io MCP server**: `simonkurtz-MSFT/drawio-mcp-server` (Deno, stdio) configured in `.vscode/mcp.json`
- **Deno runtime**: Installed via devcontainer feature `ghcr.io/devcontainers-community/features/deno`
- **VS Code extension** (optional): `hediet.vscode-drawio` for in-editor preview

## MCP Workflow Summary

Use the MCP server's startup instructions as the authoritative tool reference.
This skill only captures the repo-specific sequence and guardrails that must stay
consistent across generated diagrams.

- `search-shapes` — resolve all Azure icons up front in one batch
- `create-groups` — create VNets, subnets, resource groups, or app environments
- `add-cells` — add all vertices and edges in one batch using `shape_name` and `temp_id`
- `add-cells-to-group` — assign all children to groups in one batch
- `finish-diagram` or `export-diagram` — emit final XML with `compress: true`
> _See SKILL.md for full content._

## Icon Handling

Icons are resolved automatically by the MCP server from its built-in library
(700+ Azure icons from `assets/azure-public-service-icons/`).

- Use `shape_name` in `add-cells` to specify Azure icons (e.g., `shape_name: "Front Doors"`)
- **Do NOT specify `width`, `height`, or `style`** when using `shape_name` —
  the server auto-applies correct dimensions and styling
- Use `search-shapes` with a `queries` array to find icon names by fuzzy match
- Azure icons use their official service names, often plural (e.g., "Key Vaults", "Container Apps", "App Services")
- Every shaped vertex **MUST** have a `text` label or omit `text` entirely — **never** pass `text: ""`
- Output format is **embedded base64 SVG** in the style attribute

## Diagram Creation Workflows

### Workflow A: Non-Transactional (small diagrams)

For simple diagrams or single operations. Each tool call returns full XML with
complete SVG image data.

```text
search-shapes → add-cells → export-diagram(compress: true) → save .drawio
```

### Workflow B: Transactional (recommended for multi-step)
> _See SKILL.md for full content._

## Batch-Only Workflow (CRITICAL)

**Every tool that accepts an array MUST be called exactly ONCE with ALL items.**
Never call a tool repeatedly for individual items.

1. **`search-shapes`** — ONE call with ALL queries in the `queries` array (main flow + cross-cutting)
2. **`create-groups`** — ONE call with ALL groups. Set `text: ""` for groups; create separate text vertex above.
3. **`add-cells`** — ONE call with ALL vertices AND edges. Vertices before edges.
   Use `temp_id` for cross-refs, `shape_name` for icons.
4. **`add-cells-to-group`** — ONE call with ALL assignments. Server auto-converts absolute → group-relative coords.
5. **`edit-cells`/`edit-edges`** — ONE call if adjustments needed.
6. **`finish-diagram`** (transactional) or **`export-diagram`** (default) — with `compress: true`.
> _See SKILL.md for full content._

## Layout Conventions

### General Rules

- **Primary flow**: left-to-right. Each stage occupies a column.
- **Parallel services**: stacked vertically within their column, never side-by-side.
- **Spacing**: 120px horizontal between columns, 80px vertical between rows, 40px around each cell.
- **Page**: US Letter 850×1100px. Content within 40px margins (usable: 770×1020).
- **No overlapping**: Components must not overlap each other.

### Groups
> _See SKILL.md for full content._

## Reference Index

| File                                 | Purpose                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `references/style-reference.md`      | Draw.io style properties for AI-generated files         |
| `references/azure-patterns.md`       | Reusable MCP tool call patterns for Azure architectures |
| `references/validation-checklist.md` | Validation rules for AI-generated `.drawio` files       |
| `references/abstraction-rules.md`    | Diagram abstraction and data-flow clarity rules         |
| `references/iac-to-diagram.md`       | Generate diagrams from Bicep/Terraform/ARM templates    |

Quality target samples: `tmp/azure-architecture-example.drawio`, `tmp/03-des-diagram.svg`
