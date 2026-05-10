---
name: microsoft-docs
description: '**ANALYSIS SKILL** — Query official Microsoft documentation to understand concepts, find tutorials, and learn how services work. WHEN: "Microsoft Learn", "Azure docs", "quickstart guide", "limits and quotas", "WAF reference", "architecture pattern docs". USE FOR: Azure service overviews, quickstarts, configuration guides, limits and quotas, best practices, architecture patterns, WAF pillar references. DO NOT USE FOR: Azure pricing (use azure-pricing MCP). INVOKES: microsoft-learn MCP (microsoft_docs_search, microsoft_code_sample_search, microsoft_docs_fetch).'
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

## Prerequisites

- **Microsoft Learn MCP server** reachable at `https://learn.microsoft.com/api/mcp`
  (no auth, no install — declared in `.vscode/mcp.json`)
- **Outbound HTTPS** to `learn.microsoft.com`
- **Node.js ≥ 18** for the `mslearn` CLI fallback (via `npx @microsoft/learn-cli ...`)

## Tools

| Tool                           | Use For                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `microsoft_docs_search`        | Find documentation — concepts, guides, tutorials, configuration |
| `microsoft_docs_fetch`         | Get full page content (when search excerpts aren't enough)      |
| `microsoft_code_sample_search` | Find runnable code samples in official docs                     |

## Rules

- **Search first, fetch second** — always start with `microsoft_docs_search`; only fetch the full page when the search excerpt is insufficient
- **Be specific** — include version (`.NET 8`, `EF Core 8`), task intent (`quickstart`, `tutorial`, `overview`, `limits`), and platform (`Linux`, `Windows`) where relevant
- **Live docs over training data** — prefer this skill over model knowledge for accuracy and freshness
- **Out of scope**: Azure pricing (use Azure Pricing MCP directly)
- **CLI fallback** — use the `mslearn` CLI when the Learn MCP server is unavailable: `npx @microsoft/learn-cli search "..."`
- **Avoid loading entire docs trees** — fetch single pages, not full sub-trees, to control context size

## Steps

1. **Frame the question** — identify service, version, and intent (quickstart / configuration / limits / best practice)
2. **Run `microsoft_docs_search`** with a specific query (see [Query Effectiveness](#query-effectiveness) examples)
3. **Read the excerpts** — if they cover the question, stop here
4. **Run `microsoft_docs_fetch`** on the most relevant URL when the excerpt is cut off or you need the full step list
5. **Cross-reference code samples** with `microsoft_code_sample_search` when the user wants runnable examples
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
