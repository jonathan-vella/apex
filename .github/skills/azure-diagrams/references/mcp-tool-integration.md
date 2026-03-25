<!-- ref:mcp-tool-integration-v1 -->

# MCP Tool Integration (Excalidraw)

The Excalidraw MCP server at `https://mcp.excalidraw.com/mcp` provides interactive
diagram creation with streaming and camera control.

## MCP Server Configuration

Configured in `.vscode/mcp.json`:

```json
{
  "excalidraw": {
    "type": "http",
    "url": "https://mcp.excalidraw.com/mcp"
  }
}
```

## Workflow (MCP Available)

1. Gather context (resources, flows, boundaries)
2. Use Excalidraw MCP to create interactive diagram
3. Export as `.excalidraw` JSON and save to disk
4. CI auto-generates `.excalidraw.svg`

## Workflow (MCP Fallback — Direct JSON)

If the remote MCP is unavailable (network issues, service down):

1. Gather context (resources, flows, boundaries)
2. Look up icons in `assets/excalidraw-libraries/azure-icons/reference.md`
3. Create base `.excalidraw` JSON file with the standard schema
4. Add icons using Python script: `scripts/add-icon-to-diagram.py`
5. Add arrows using Python script: `scripts/add-arrow.py`
6. Save `.excalidraw` file to disk
7. CI auto-generates `.excalidraw.svg`

## Python Script Reference

### Add Icon

```bash
python scripts/add-icon-to-diagram.py <diagram.excalidraw> <icon-name> <x> <y> [--label "Text"]
```

- `icon-name`: Must match a filename in `assets/excalidraw-libraries/azure-icons/icons/` (without `.json`)
- `x`, `y`: Position coordinates in pixels
- `--label`: Optional text label below the icon

### Add Arrow

```bash
python scripts/add-arrow.py <diagram.excalidraw> <from-x> <from-y> <to-x> <to-y> [--label "Text"] [--style solid|dashed]
```

## Quality Gate

After generating a diagram, verify:

- Quality score >= 9/10
- No overlapping elements
- All labels readable at 100% zoom
- Correct Azure icons used
- Clear data flow direction
- Cross-cutting services at bottom with NO edges

If quality < 9/10, adjust layout and regenerate (max 2 attempts).

## Saving Files

Save `.excalidraw` files directly to the output path using file creation tools.
The CI workflow `excalidraw-svg-export.yml` will automatically generate
`.excalidraw.svg` files for documentation embedding.

**NEVER** use `read_file` on large MCP response payloads — summarize and discard.
