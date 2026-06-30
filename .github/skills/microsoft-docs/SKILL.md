---
name: microsoft-docs
description: '**ANALYSIS SKILL** — Query official Microsoft documentation to understand concepts, find tutorials, and learn how services work. WHEN: "Microsoft Learn", "Azure docs", "quickstart guide", "limits and quotas", "WAF reference", "architecture pattern docs". DO NOT USE FOR: Azure pricing (use azure-pricing MCP).'
compatibility: Works through the Azure MCP `documentation` namespace (`mcp_azure-mcp_documentation`), which proxies the Microsoft Learn MCP backend at `https://learn.microsoft.com/api/mcp`. Can also use the `mslearn` CLI as a fallback.
license: MIT
metadata:
  author: microsoftdocs
  version: "2.0"
  category: documentation
---

# Microsoft Docs

Search and retrieve official Microsoft documentation from learn.microsoft.com.
Covers Azure, .NET, Microsoft 365, Windows, Power Platform, and all Microsoft
technologies.

## Prerequisites

- **Azure MCP server** (`ms-azuretools.vscode-azure-mcp-server` extension,
  declared in `devcontainer.json`) running locally. The Microsoft Learn docs
  tools are exposed through the Azure MCP `documentation` router.
- **Outbound HTTPS** to `learn.microsoft.com`
- **Node.js ≥ 18** for the `mslearn` CLI fallback (via `npx @microsoft/learn-cli ...`)

## Tools

All operations go through the Azure MCP `documentation` router
(`mcp_azure-mcp_documentation`); pass the sub-command via `command`.

| `command` value                | Use For                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `microsoft_docs_search`        | Find documentation — concepts, guides, tutorials, configuration |
| `microsoft_docs_fetch`         | Get full page content (when search excerpts aren't enough)      |
| `microsoft_code_sample_search` | Find runnable code samples in official docs                     |

```jsonc
// Tool: mcp_azure-mcp_documentation
{
  "intent": "find AKS private cluster guidance",
  "command": "microsoft_docs_search",
  "parameters": { "query": "AKS private cluster best practices" }
}
```

## Rules

- **Search first, fetch second** — always start with `microsoft_docs_search`; only fetch the full page when the search excerpt is insufficient
- **Be specific** — include version (`.NET 8`, `EF Core 8`), task intent (`quickstart`, `tutorial`, `overview`, `limits`), and platform (`Linux`, `Windows`) where relevant
- **Live docs over training data** — prefer this skill over model knowledge for accuracy and freshness
- **Out of scope** — Azure pricing (use Azure Pricing MCP directly)
- **Avoid loading entire docs trees** — fetch single pages
- **CLI fallback** — when MCP server unavailable: `npx @microsoft/learn-cli search "..."`

## Steps

1. **Frame the question** — service, version, intent (quickstart / config / limits / best practice)
2. **`microsoft_docs_search`** with a specific query
3. **Read the excerpts** — if they cover the question, stop
4. **`microsoft_docs_fetch`** on the most relevant URL only when the excerpt is cut off
5. **`microsoft_code_sample_search`** when the user wants runnable examples
6. **Cite sources** — include the `learn.microsoft.com` URL

## CLI Alternative

If the Azure MCP server is unavailable:

```bash
npx @microsoft/learn-cli search "azure functions timeout"
```

The `fetch` command supports `--section <heading>` and `--max-chars <number>`.

| MCP invocation                                                              | CLI equivalent         |
| --------------------------------------------------------------------------- | ---------------------- |
| `mcp_azure-mcp_documentation` (`command: "microsoft_docs_search"`)          | `mslearn search "..."` |
| `mcp_azure-mcp_documentation` (`command: "microsoft_docs_fetch"`)           | `mslearn fetch "..."`  |
