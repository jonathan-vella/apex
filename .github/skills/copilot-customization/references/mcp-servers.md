<!-- ref:mcp-servers-v1 -->

# MCP Servers Reference

> Source: https://code.visualstudio.com/docs/copilot/customization/mcp-servers
> Last verified: 2026-03-08

MCP (Model Context Protocol) servers connect Copilot to external tools and services.
MCP is an open standard for AI-tool integration, supported across multiple AI agents.

## Purpose

- Connect to external APIs, databases, and services from chat
- Provide tools, resources, prompts, and interactive apps
- Share tool configurations across teams via workspace `mcp.json`

## Configuration Locations

| Scope          | File                                              | Sharing                                   |
| -------------- | ------------------------------------------------- | ----------------------------------------- |
| Workspace      | `.vscode/mcp.json`                                | Commit to source control for team sharing |
| User profile   | `mcp.json` via **MCP: Open User Configuration**   | Per-profile, across workspaces            |
| Dev containers | `devcontainer.json` → `customizations.vscode.mcp` | Container-scoped                          |

## Configuration Format

```jsonc
{
  "servers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@microsoft/mcp-server-playwright"],
    },
  },
}
```

### Server Types

| Type      | Description       | Config                                   |
| --------- | ----------------- | ---------------------------------------- |
| **http**  | Remote MCP server | `type: "http"`, `url: "https://..."`     |
| **stdio** | Local process     | `command`, `args`, optional `cwd`, `env` |

### Key Configuration Fields

| Field            | Description                                |
| ---------------- | ------------------------------------------ |
| `type`           | `"http"` or `"stdio"`                      |
| `url`            | URL for HTTP servers                       |
| `command`        | Executable for stdio servers               |
| `args`           | Command-line arguments array               |
| `cwd`            | Working directory                          |
| `env`            | Environment variables object               |
| `sandboxEnabled` | Enable sandboxing (macOS/Linux only)       |
| `sandbox`        | Sandbox restrictions (filesystem, network) |

> **Security**: Never hardcode secrets or API keys. Use input variables or environment files.

## Installation Methods

| Method              | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| **Extensions view** | `@mcp` search → Install (user) or Install in Workspace                     |
| **CLI**             | `code --add-mcp '{"name":"server","command":"uvx","args":["mcp-server"]}'` |
| **Manual**          | Edit `.vscode/mcp.json` directly                                           |
| **Discovery**       | `chat.mcp.discovery.enabled` — auto-detect from Claude Desktop, etc.       |
| **Command Palette** | **MCP: Add Server** guided flow                                            |

## MCP Capabilities Beyond Tools

| Capability    | Description                                       | Access                              |
| ------------- | ------------------------------------------------- | ----------------------------------- |
| **Resources** | Data as context (files, DB tables, API responses) | **Add Context** > **MCP Resources** |
| **Prompts**   | Preconfigured prompts from servers                | Type `/<server>.<prompt>` in chat   |
| **MCP Apps**  | Interactive UI (forms, visualizations)            | Rendered inline in chat             |

## Sandboxing (macOS/Linux Only)

Restrict stdio servers to specific filesystem and network access:

```jsonc
{
  "servers": {
    "myServer": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "sandboxEnabled": true,
      "sandbox": {
        "filesystem": {
          "allowWrite": ["${workspaceFolder}"],
        },
        "network": {
          "allowedDomains": ["api.example.com"],
        },
      },
    },
  },
}
```

When sandboxing is enabled, tool calls are auto-approved (they run in a controlled environment).

## Server Management

| Method              | Actions                                        |
| ------------------- | ---------------------------------------------- |
| **Extensions view** | Right-click in MCP SERVERS - INSTALLED section |
| **mcp.json editor** | Use inline code lenses (Start, Stop, Restart)  |
| **Command Palette** | **MCP: List Servers** → select → choose action |

## Dev Container Integration

```jsonc
{
  "image": "mcr.microsoft.com/devcontainers/typescript-node:latest",
  "customizations": {
    "vscode": {
      "mcp": {
        "servers": {
          "playwright": {
            "command": "npx",
            "args": ["-y", "@microsoft/mcp-server-playwright"],
          },
        },
      },
    },
  },
}
```

## This Repo's Examples

From `.vscode/mcp.json`:

| Server          | Type  | Purpose                                 |
| --------------- | ----- | --------------------------------------- |
| `github`        | http  | GitHub Copilot MCP (issues, PRs, repos) |
| `azure-pricing` | stdio | Custom Azure Pricing MCP server         |
| `terraform`     | stdio | Terraform registry queries              |

## Common Mistakes

| Mistake                                             | Fix                                           |
| --------------------------------------------------- | --------------------------------------------- |
| Hardcoded API keys in `mcp.json`                    | Use input variables or `.env` files           |
| Server configured in workspace but needed on remote | Define in remote user settings                |
| Forgetting to trust a new server                    | Confirm trust when prompted on first start    |
| Sandbox config on Windows                           | Sandboxing only available on macOS/Linux      |
| MCP server not starting                             | Check **MCP: List Servers** for error details |

## Verify Freshness

Check VS Code docs for upstream changes to MCP servers:\n`https://code.visualstudio.com/docs/copilot/customization/mcp-servers`

Check for: new server types, new capabilities, sandbox changes, new installation methods,
new settings, or enterprise management features.
