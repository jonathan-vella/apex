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
Covers Azure, .NET, Microsoft 365, Windows, Power Platform, and all Microsoft technologies.

## Prerequisites

- **Azure MCP server** (`azure-mcp` in `.vscode/mcp.json`) running locally via
  `npx @azure/mcp@latest server start`. The Microsoft Learn docs tools are
  exposed through the Azure MCP `documentation` router.
- **Outbound HTTPS** to `learn.microsoft.com`
- **Node.js ≥ 18** for the `mslearn` CLI fallback (via `npx @microsoft/learn-cli ...`)

## Tools

All three operations are invoked through the Azure MCP `documentation` router
tool (`mcp_azure-mcp_documentation`). Pass the sub-command via the `command`
field and the operation arguments via the `parameters` object.

| `command` value                | Use For                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `microsoft_docs_search`        | Find documentation — concepts, guides, tutorials, configuration |
| `microsoft_docs_fetch`         | Get full page content (when search excerpts aren't enough)      |
| `microsoft_code_sample_search` | Find runnable code samples in official docs                     |

Example invocation shape:

```jsonc
// Tool: mcp_azure-mcp_documentation
{
  "intent": "find AKS private cluster guidance",
  "command": "microsoft_docs_search",
  "parameters": { "query": "AKS private cluster best practices" }
}
```

## Rules

- **Search first, fetch second** — always start with `command: "microsoft_docs_search"`; only fetch the full page when the search excerpt is insufficient
- **Be specific** — include version (`.NET 8`, `EF Core 8`), task intent (`quickstart`, `tutorial`, `overview`, `limits`), and platform (`Linux`, `Windows`) where relevant
- **Live docs over training data** — prefer this skill over model knowledge for accuracy and freshness
- **Out of scope**: Azure pricing (use Azure Pricing MCP directly)
- **CLI fallback** — use the `mslearn` CLI when the Azure MCP server is unavailable: `npx @microsoft/learn-cli search "..."`
- **Avoid loading entire docs trees** — fetch single pages, not full sub-trees, to control context size

## Steps

1. **Frame the question** — identify service, version, and intent (quickstart / configuration / limits / best practice)
2. **Call `mcp_azure-mcp_documentation`** with `command: "microsoft_docs_search"` and a specific query (see [Query Effectiveness](#query-effectiveness) examples)
3. **Read the excerpts** — if they cover the question, stop here
4. **Call `mcp_azure-mcp_documentation`** with `command: "microsoft_docs_fetch"` on the most relevant URL when the excerpt is cut off or you need the full step list
5. **Cross-reference code samples** with `command: "microsoft_code_sample_search"` when the user wants runnable examples
6. **Cite sources** — include the `learn.microsoft.com` URL in your response

## When to Use

- **Understanding concepts** — "How does Cosmos DB partitioning work?"
- **Learning a service** — "Azure Functions overview", "Container Apps architecture"
- **Finding tutorials** — "quickstart", "getting started", "step-by-step"
- **Configuration options** — "App Service configuration settings"
- **Limits & quotas** — "Azure OpenAI rate limits", "Service Bus quotas"
- **Best practices** — "Azure security best practices"

## Query Effectiveness

Good queries are specific:

```text
# Too broad
"Azure Functions"

# Specific
"Azure Functions Python v2 programming model"
"Cosmos DB partition key design best practices"
"Container Apps scaling rules KEDA"
```

Include context:

- **Version** when relevant (`.NET 8`, `EF Core 8`)
- **Task intent** (`quickstart`, `tutorial`, `overview`, `limits`)
- **Platform** for multi-platform docs (`Linux`, `Windows`)

## When to Fetch Full Page

Fetch after search when:

- **Tutorials** — need complete step-by-step instructions
- **Configuration guides** — need all options listed
- **Deep dives** — user wants comprehensive coverage
- **Search excerpt is cut off** — full context needed

## Why Use This

- **Accuracy** — live docs, not training data that may be outdated
- **Completeness** — tutorials have all steps, not fragments
- **Authority** — official Microsoft documentation

## CLI Alternative

If the Azure MCP server is not available, use the `mslearn` CLI via Bash instead:

```bash
# Run directly (no install needed)
npx @microsoft/learn-cli search "azure functions timeout"

# Or install globally, then run
npm install -g @microsoft/learn-cli
mslearn search "azure functions timeout"
```

| Azure MCP invocation                                                        | CLI Command            |
| --------------------------------------------------------------------------- | ---------------------- |
| `mcp_azure-mcp_documentation` (`command: "microsoft_docs_search"`)          | `mslearn search "..."` |
| `mcp_azure-mcp_documentation` (`command: "microsoft_docs_fetch"`)           | `mslearn fetch "..."`  |

The `fetch` command also supports `--section <heading>` to extract a single section
and `--max-chars <number>` to truncate output.

