# Draw.io MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for programmatic diagram generation using [Draw.io](https://www.drawio.com/) (Diagrams.net). This server generates Draw.io XML directly — no browser extension or Draw.io instance required.

[![Build project](https://github.com/simonkurtz-MSFT/drawio-mcp-server/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/simonkurtz-MSFT/drawio-mcp-server/actions/workflows/ci.yml)

[![Docker Hub](https://img.shields.io/docker/v/simonkurtzmsft/drawio-mcp-server?label=Docker%20Hub&logo=docker&sort=semver)](https://hub.docker.com/r/simonkurtzmsft/drawio-mcp-server)

## Demo Video

[![Draw.io MCP Server Demo](https://img.youtube.com/vi/YAz-qjDPVZI/0.jpg)](https://youtu.be/YAz-qjDPVZI)

## Acknowledgements

This project would not exist in this manner if it weren't for the following repositories and their authors. Thank you!

- **Original drawio-mcp-server** by **Ladislav (lgazo)**: https://github.com/lgazo/drawio-mcp-server
- **Azure icons source** (`dwarfered`): https://github.com/dwarfered/azure-architecture-icons-for-drawio
- **VS Code Drawio extension** by **hediet**: https://github.com/hediet/vscode-drawio

## Features

- **700+ Azure Architecture Icons** — Official Microsoft icons with embedded SVG data, organized into ~20 categories (Compute, Networking, Storage, Databases, AI + ML, Security, and more)
- **Basic Shapes** — Rectangles, ellipses, diamonds, parallelograms, and other flowchart primitives
- **Fuzzy Search** — Find shapes by partial name across the entire icon library
- **Batch Operations** — Create and update multiple cells in a single call for better performance
- **Layer Management** — Create, list, and organize cells across layers
- **Style Presets** — Built-in Azure, flowchart, and general color presets
- **Multiple Transports** — stdio (default) and streamable HTTP
- **XML Export** — Standard Draw.io XML format compatible with Draw.io desktop and web

## Documentation

- Transactional mode design: [docs/transactional_mode_design.md](docs/transactional_mode_design.md)

## Requirements

- **[Deno](https://deno.com/)** v2.3 or higher

## Quick Start

### From Source

```sh
deno run --allow-net --allow-read --allow-env src/index.ts
```

### MCP Client Configuration

Configure your MCP client (Claude Desktop, VS Code, Codex, etc.) to use the server:

<details>
<summary><b>Claude Desktop</b></summary>

Edit `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "drawio": {
      "command": "deno",
      "args": ["run", "--allow-net", "--allow-read", "--allow-env", "/path/to/drawio-mcp-server/src/index.ts"]
    }
  }
}
```

</details>

<details>
<summary><b>VS Code</b></summary>

Add to your VS Code settings or `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "deno",
      "args": ["run", "--allow-net", "--allow-read", "--allow-env", "/path/to/drawio-mcp-server/src/index.ts"]
    }
  }
}
```

</details>

<details>
<summary><b>Zed</b></summary>

In the Assistant settings, add a Context Server:

```json
{
  "drawio": {
    "command": "deno",
    "args": ["run", "--allow-net", "--allow-read", "--allow-env", "/path/to/drawio-mcp-server/src/index.ts"],
    "env": {}
  }
}
```

</details>

<details>
<summary><b>Codex</b></summary>

Edit `~/.codex/config.toml`:

```toml
[mcp_servers.drawio]
command = "deno"
args = ["run", "--allow-net", "--allow-read", "--allow-env", "/path/to/drawio-mcp-server/src/index.ts"]
```

For a locally running HTTP transport:

```toml
[mcp_servers.drawio]
url = "http://localhost:8080/mcp"
```

</details>

<details>
<summary><b>oterm (Ollama)</b></summary>

Edit `~/.local/share/oterm/config.json`:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "deno",
      "args": ["run", "--allow-net", "--allow-read", "--allow-env", "/path/to/drawio-mcp-server/src/index.ts"]
    }
  }
}
```

</details>

## Configuration

### Transport Selection

The `--transport` flag controls which transports to start. Default is `stdio`.

| Flag                     | Description          |
| ------------------------ | -------------------- |
| `--transport stdio`      | stdio only (default) |
| `--transport http`       | HTTP only            |
| `--transport stdio,http` | Both transports      |

### Environment Variables

| Variable                  | Description                                                                           | Default    |
| ------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| `AZURE_ICON_LIBRARY_PATH` | Path to Azure icon library XML file (auto-detected from `assets/` if unset)           | (detected) |
| `LOGGER_TYPE`             | Logger implementation: `console` or `mcp_server`                                      | `console`  |
| `HTTP_PORT`               | HTTP server port (CLI `--http-port` takes precedence)                                 | `8080`     |
| `TRANSPORT`               | Transport type: `stdio`, `http`, or `stdio,http` (CLI `--transport` takes precedence) | `stdio`    |
| **`SAVE_DIAGRAMS`**       | **⚠️ DEV MODE ONLY** — Auto-save diagram XML to `./diagrams/` on export/finish        | (disabled) |

> **Tip**: You can create a `.env` file from `.env.example` to configure environment variables locally:
>
> ```sh
> cp .env.example .env
> # Edit .env and uncomment/set SAVE_DIAGRAMS=true or other variables
> ```
>
> The server automatically loads `.env` files at startup. The `.env` file is gitignored and won't be committed to the repository.

### Development Mode — Auto-save Diagrams

> **⚠️ WARNING: DEVELOPMENT MODE ONLY — NOT FOR PRODUCTION USE**

For local debugging and development, you can enable automatic saving of diagram XML to a local `diagrams/` folder. This is useful for inspecting generated diagrams without manually copying XML output.

**To enable:**

```sh
export SAVE_DIAGRAMS=true
deno task start
```

or

```sh
SAVE_DIAGRAMS=true deno task start
```

**Behavior when enabled:**

- Every call to `export-diagram` or `finish-diagram` automatically saves the XML to `./diagrams/<timestamp>_<tool-name>.drawio`
- Timestamp format: `YYYYMMDD_HHMMSS` (e.g., `20260219_143052_export-diagram.drawio`)
- The `diagrams/` folder is created automatically if it doesn't exist
- Errors during file saving are logged but do not fail the tool operation

**To disable (default):**

Simply unset the environment variable or set it to any value other than `true` or `1`:

```sh
unset SAVE_DIAGRAMS
```

or

```sh
export SAVE_DIAGRAMS=false
```

**Security note**: This feature is **disabled by default** and should **never be enabled in production** or containerized deployments. It is intended solely for local development and debugging.

### HTTP Transport

The HTTP transport exposes a streamable HTTP endpoint at `/mcp` (default port 8080).

```sh
deno task start:http
# or with a custom port:
deno run --allow-net --allow-read --allow-env src/index.ts --transport http --http-port 4000
```

MCP client configuration for HTTP:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "deno",
      "args": [
        "run",
        "--allow-net",
        "--allow-read",
        "--allow-env",
        "/path/to/drawio-mcp-server/src/index.ts",
        "--transport",
        "http",
        "--http-port",
        "4000"
      ]
    }
  }
}
```

Health check: `curl http://localhost:8080/health`

### Docker

The Docker image uses `deno compile` to produce a self-contained native binary, then runs it on a minimal [distroless](https://github.com/GoogleContainerTools/distroless) base image (~20MB) with no shell, no package manager, and a non-root user.

#### Pulling from Docker Hub

A pre-built image is available on [Docker Hub](https://hub.docker.com/r/simonkurtzmsft/drawio-mcp-server). This is the fastest way to get started — no cloning or building required.

**1. Pull the latest image:**

```sh
docker pull simonkurtzmsft/drawio-mcp-server:latest
```

**2. Start the container:**

```sh
docker run -d --name drawio-mcp-server -p 8080:8080 simonkurtzmsft/drawio-mcp-server:latest
```

This starts the server in the background, exposing the HTTP transport on port 8080.

**3. Verify the server is running:**

```sh
curl http://localhost:8080/health
```

You should receive an `OK` response, confirming the server is healthy and ready to accept connections.

**4. Point your MCP client to the running container.** For example, in VS Code (`.vscode/mcp.json`):

```json
{
  "mcpServers": {
    "drawio": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

Or in Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "drawio": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

**5. To stop and remove the container:**

```sh
docker stop drawio-mcp-server
docker rm drawio-mcp-server
```

#### Building Locally

To build the image from source instead of pulling from Docker Hub:

```sh
# Build
docker build -t drawio-mcp-server .

# Run (exposes HTTP on port 8080)
docker run -d --name drawio-mcp-server -p 8080:8080 drawio-mcp-server
```

#### Docker Compose

```sh
cp .env.example .env   # Configure REGISTRY and IMAGE_VERSION
docker compose up -d
```

The `.env` file supports:

- `REGISTRY` — Docker registry URL (e.g., `docker.io/myusername`)
- `IMAGE_VERSION` — Semantic version for image tags (e.g., `1.0.0`)

> **Note**: The distroless image has no shell, so in-container health checks (wget, curl) are not available. Use external health checks (e.g., Kubernetes liveness probes, load balancer health checks) to monitor the `/health` endpoint.

## Tools

> **Performance tip**: All cell-manipulation tools accept arrays — pass ALL items in a single call rather than calling a tool repeatedly.
>
> **Stateless contract**: Diagram tools are stateless per call. Pass the full prior `diagram_xml` into each diagram-related tool call, and carry forward the returned `diagram_xml` from the response for the next call.

### Shape Discovery

| Tool                     | Description                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `search-shapes`          | Fuzzy search for shapes including 700+ Azure icons. Pass all queries in the `queries` array. |
| `get-shape-categories`   | List all shape categories (General, Flowchart, Azure categories).                            |
| `get-shapes-in-category` | List all shapes in a category by `category_id`.                                              |
| `get-style-presets`      | Get built-in style presets (Azure colors, flowchart shapes, edge styles).                    |

### Diagram Modification

| Tool                | Description                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `add-cells`         | Add vertices and/or edges. Supports `shape_name` for icon resolution, `temp_id` for within-batch references, and `dry_run` validation. |
| `edit-cells`        | Update vertex cell properties (position, size, text, style).                                                                           |
| `edit-edges`        | Update edge properties (text, source, target, style).                                                                                  |
| `set-cell-shape`    | Apply library shape styles to existing cells.                                                                                          |
| `delete-cell-by-id` | Remove a cell (vertex or edge) by ID. Cascade-deletes connected edges for vertices.                                                    |

### Diagram Inspection

| Tool                | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| `list-paged-model`  | Paginated view of all cells with filtering by type.           |
| `get-diagram-stats` | Statistics about cell counts, bounds, and layer distribution. |
| `export-diagram`    | Export the diagram as Draw.io XML.                            |
| `import-diagram`    | Import a Draw.io XML string, replacing the current diagram.   |
| `clear-diagram`     | Clear all cells and reset the diagram.                        |

### Layer Management

| Tool                 | Description                            |
| -------------------- | -------------------------------------- |
| `list-layers`        | List all layers with IDs and names.    |
| `set-active-layer`   | Set the active layer for new elements. |
| `create-layer`       | Create a new layer.                    |
| `move-cell-to-layer` | Move a cell to a different layer.      |

### Page Management

| Tool              | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `create-page`     | Create a new page (tab) in the diagram.                          |
| `list-pages`      | List all pages with IDs and names.                               |
| `get-active-page` | Get the currently active page.                                   |
| `set-active-page` | Switch to a different page.                                      |
| `rename-page`     | Rename an existing page.                                         |
| `delete-page`     | Delete a page and all its contents. Cannot delete the last page. |

### Group / Container Management

| Tool                     | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| `create-groups`          | Create group/container cells for VNets, subnets, resource groups, etc. |
| `add-cells-to-group`     | Assign cells to groups.                                                |
| `remove-cell-from-group` | Remove a cell from its group, returning it to the active layer.        |
| `list-group-children`    | List all cells contained in a group.                                   |

### Add Cells Example

Use `add-cells` with `temp_id` references to create vertices and edges in a single call:

```json
{
  "cells": [
    {
      "type": "vertex",
      "temp_id": "web",
      "x": 100,
      "y": 100,
      "width": 60,
      "height": 60,
      "text": "Web",
      "style": "aspect=fixed;html=1;image;image=img/lib/azure2/compute/Container_Instances.svg;"
    },
    {
      "type": "vertex",
      "temp_id": "api",
      "x": 220,
      "y": 100,
      "width": 60,
      "height": 60,
      "text": "API",
      "style": "aspect=fixed;html=1;image;image=img/lib/azure2/compute/Container_Instances.svg;"
    },
    { "type": "edge", "source_id": "web", "target_id": "api", "text": "HTTPS" }
  ]
}
```

## Azure Icon Library

The server includes **700+ official Azure architecture icons** from [dwarfered/azure-architecture-icons-for-drawio](https://github.com/dwarfered/azure-architecture-icons-for-drawio), organized into categories:

| Category                | Examples                                                              |
| ----------------------- | --------------------------------------------------------------------- |
| AI + Machine Learning   | Cognitive Services, Azure OpenAI, Bot Service, Machine Learning       |
| Analytics               | Synapse Analytics, Databricks, Data Factory, Event Hubs               |
| App Services            | App Service, Static Web Apps                                          |
| Compute                 | Virtual Machines, Functions, AKS, Container Instances, Batch          |
| Containers              | Container Registry, Container Instances, AKS                          |
| Databases               | SQL Database, Cosmos DB, Cache for Redis, PostgreSQL                  |
| DevOps                  | Azure DevOps, Pipelines, Repos                                        |
| Identity                | Azure AD, Key Vault                                                   |
| Integration             | Service Bus, Logic Apps, API Management, Event Grid                   |
| Management + Governance | Monitor, Automation, Policy, Log Analytics                            |
| Networking              | Front Door, Load Balancer, Application Gateway, VPN Gateway, Firewall |
| Security                | Sentinel, Security Center                                             |
| Storage                 | Storage Account, Blob Storage, File Storage, Disk Storage             |

Icons use **embedded base64 SVG data** — no external dependencies, works fully offline with correct Azure branding and colors.

The library loads lazily on first access (singleton pattern). Search operations are <5ms after initial load.

## Development

### Setup

```sh
git clone https://github.com/simonkurtz-MSFT/drawio-mcp-server.git
cd drawio-mcp-server
```

No install step needed — Deno resolves dependencies on first run.

### Common Commands

| Command                   | Description                          |
| ------------------------- | ------------------------------------ |
| `deno task start`         | Start with stdio + HTTP transports   |
| `deno task start:http`    | Start with HTTP transport only       |
| `deno task dev`           | Watch mode — auto-restart on changes |
| `deno task test`          | Run tests                            |
| `deno task test:watch`    | Run tests in watch mode              |
| `deno task test:coverage` | Run tests with coverage              |
| `deno task bench`         | Run focused performance benchmarks   |
| `deno task lint`          | Lint and type-check                  |
| `deno task fmt`           | Format code                          |
| `deno task fmt:check`     | Check formatting without writing     |
| `deno task compile`       | Compile to a self-contained binary   |

### MCP Inspector

Use the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) to debug the server:

```sh
deno task inspect
```

After making changes, **Restart** the Inspector. After changing tool definitions, **Clear** and **List** the tools again.

## Related Approaches

> **Note**: The comparisons below are all **as of February 2026**. Both projects and the agent skill continue to evolve — check their repositories for the latest state.

This project is a fork of [lgazo/drawio-mcp-server](https://github.com/lgazo/drawio-mcp-server) by Ladislav Gazo. The original acts as a **bridge to a live Draw.io instance** via a WebSocket browser extension for interactive, real-time diagram control. This fork is a **standalone XML generator** — it builds diagrams in memory and outputs Draw.io XML without needing a browser or Draw.io instance. [thomast1906/github-copilot-agent-skills](https://github.com/thomast1906/github-copilot-agent-skills/tree/main/.github/skills/drawio-mcp-diagramming) takes yet another approach: a **Copilot Agent Skill** that constructs raw Draw.io XML and sends it to the hosted `mcp.draw.io` service, guided by prompt instructions and a static Azure icon catalog.

| Aspect                           | simonkurtz-MSFT                                        | Original (lgazo)                                       | Agent Skill (thomast1906)                           |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------- |
| **Architecture**                 | Standalone MCP server — generates XML in memory        | Bridge to live Draw.io via WebSocket browser extension | Copilot Agent Skill + hosted `mcp.draw.io` endpoint |
| **Runtime**                      | Deno (TypeScript)                                      | Node.js + pnpm (TypeScript + JavaScript)               | None (prompt-driven)                                |
| **Draw.io instance required**    | ❌                                                     | ✅ Browser + MCP extension                             | ❌ (uses hosted endpoint)                           |
| **Setup effort**                 | Clone + Deno, or `docker pull`                         | `npx` + browser extension + open Draw.io               | Drop `SKILL.md` + catalog into repo                 |
| **Batch operations**             | ✅ Arrays in `add-cells`, `edit-cells`, etc.           | ❌ One tool call per cell                              | ✅ Full XML in one shot                             |
| **Azure icons**                  | ✅ 700+ embedded base64 SVG                            | ✅ From live Draw.io libraries                         | ✅ Static catalog (`img/lib/azure2/…`)              |
| **Fuzzy shape search**           | ✅ `search-shapes`                                     | ❌ Exact name lookup only                              | ❌                                                  |
| **Page management**              | ✅                                                     | ❌                                                     | ❌                                                  |
| **Group / container management** | ✅                                                     | ❌                                                     | ❌                                                  |
| **Iterative editing**            | ✅ Stateful model, incremental calls                   | ✅ Live edits in Draw.io                               | ❌ Regenerate full XML each time                    |
| **Interactive features**         | ❌ Stateless XML generation                            | ✅ `get-selected-cell`, `set-cell-data`                | ❌                                                  |
| **Docker / cloud deployment**    | ✅ Distroless image (~20 MB)                           | ❌ npm package only                                    | ❌ Relies on hosted endpoint                        |
| **Offline support**              | ✅ Fully offline                                       | ⚠️ Needs browser with Draw.io                          | ❌ Requires internet                                |
| **Best for**                     | CI/CD, containers, headless / offline batch generation | Interactive diagramming with real-time visual feedback | Quick one-shot diagrams with zero install           |

All three approaches are valid — the right choice depends on whether you need interactive visual feedback (original), headless batch generation (this fork), or a zero-install agent skill.

## License

[MIT](LICENSE.md)
