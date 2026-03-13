---
name: microsoft-docs
description: "Query official Microsoft documentation to understand concepts, find tutorials, and learn how services work. USE FOR: Azure service overviews, quickstarts, configuration guides, limits and quotas, best practices, architecture patterns, WAF pillar references. DO NOT USE FOR: code sample lookups (use microsoft-code-reference), skill creation (use microsoft-skill-creator), Azure pricing (use azure-pricing MCP)."
compatibility: Works with Microsoft Learn MCP Server (https://learn.microsoft.com/api/mcp). Can also use the mslearn CLI as a fallback.
license: MIT
metadata:
  author: microsoftdocs
  version: "1.0"
  category: documentation
---

# Microsoft Docs

Search and retrieve official Microsoft documentation from learn.microsoft.com.
Covers Azure, .NET, Microsoft 365, Windows, Power Platform, and all Microsoft technologies.

## Tools

| Tool                    | Use For                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `microsoft_docs_search` | Find documentation — concepts, guides, tutorials, configuration |
| `microsoft_docs_fetch`  | Get full page content (when search excerpts aren't enough)      |

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

If the Learn MCP server is not available, use the `mslearn` CLI via Bash instead:

```bash
# Run directly (no install needed)
npx @microsoft/learn-cli search "azure functions timeout"

# Or install globally, then run
npm install -g @microsoft/learn-cli
mslearn search "azure functions timeout"
```

| MCP Tool                              | CLI Command            |
| ------------------------------------- | ---------------------- |
| `microsoft_docs_search(query: "...")` | `mslearn search "..."` |
| `microsoft_docs_fetch(url: "...")`    | `mslearn fetch "..."`  |

The `fetch` command also supports `--section <heading>` to extract a single section
and `--max-chars <number>` to truncate output.
