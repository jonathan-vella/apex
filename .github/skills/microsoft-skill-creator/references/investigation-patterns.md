<!-- ref:investigation-patterns-v1 -->

# Investigation Patterns & Examples

## Common Investigation Patterns

### For SDKs/Libraries

```text
"{name} overview" → purpose, architecture
"{name} getting started quickstart" → setup steps
"{name} API reference" → core classes/methods
"{name} samples examples" → code patterns
"{name} best practices performance" → optimization
```

### For Azure Services

```text
"{service} overview features" → capabilities
"{service} quickstart {language}" → setup code
"{service} REST API reference" → endpoints
"{service} SDK {language}" → client library
"{service} pricing limits quotas" → constraints
```

### For Frameworks/Platforms

```text
"{framework} architecture concepts" → mental model
"{framework} project structure" → conventions
"{framework} tutorial walkthrough" → end-to-end flow
"{framework} configuration options" → customization
```

## Example: Creating a "Semantic Kernel" Skill

### Investigation

```text
microsoft_docs_search(query="semantic kernel overview")
microsoft_docs_search(query="semantic kernel plugins functions")
microsoft_code_sample_search(query="semantic kernel", language="csharp")
microsoft_docs_fetch(url="https://learn.microsoft.com/semantic-kernel/overview/")
```

### Generated Skill

```text
semantic-kernel/
├── SKILL.md
└── sample_codes/
    ├── getting-started/
    │   └── hello-kernel.cs
    └── common-patterns/
        ├── chat-completion.cs
        └── function-calling.cs
```

### Generated SKILL.md

```markdown
---
name: semantic-kernel
description: "Build AI agents with Microsoft Semantic Kernel. USE FOR: LLM-powered apps with plugins, planners, and memory in .NET or Python. DO NOT USE FOR: direct Azure OpenAI API calls without orchestration."
---

# Semantic Kernel

Orchestration SDK for integrating LLMs into applications with plugins, planners, and memory.

## Key Concepts

- **Kernel**: Central orchestrator managing AI services and plugins
- **Plugins**: Collections of functions the AI can call
- **Planner**: Sequences plugin functions to achieve goals
- **Memory**: Vector store integration for RAG patterns

## Quick Start

See [getting-started/hello-kernel.cs](sample_codes/getting-started/hello-kernel.cs)

## Learn More

| Topic              | How to Find                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| Plugin development | `microsoft_docs_search(query="semantic kernel plugins custom functions")`  |
| Planners           | `microsoft_docs_search(query="semantic kernel planner")`                   |
| Memory             | `microsoft_docs_fetch(url="https://learn.microsoft.com/.../agent-memory")` |

## CLI Alternative

If the Learn MCP server is not available, use the `mslearn` CLI instead:

| MCP Tool                                                      | CLI Command                                |
| ------------------------------------------------------------- | ------------------------------------------ |
| `microsoft_docs_search(query: "...")`                         | `mslearn search "..."`                     |
| `microsoft_code_sample_search(query: "...", language: "...")` | `mslearn code-search "..." --language ...` |
| `microsoft_docs_fetch(url: "...")`                            | `mslearn fetch "..."`                      |

Run directly with `npx @microsoft/learn-cli <command>` or install globally with `npm install -g @microsoft/learn-cli`.
```
