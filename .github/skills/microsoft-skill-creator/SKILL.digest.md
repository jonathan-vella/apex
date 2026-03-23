<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Microsoft Skill Creator (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## About Skills

Skills are modular packages that extend agent capabilities with specialized
knowledge and workflows. A skill transforms a general-purpose agent into
a specialized one for a specific domain.

### Skill Structure

```text
skill-name/
├── SKILL.md (required)     # Frontmatter (name, description) + instructions
├── references/             # Documentation loaded into context as needed
├── sample_codes/           # Working code examples
└── assets/                 # Files used in output (templates, etc.)

> _See SKILL.md for full content._

## Learn MCP Tools

| Tool                           | Purpose               | When to Use                          |
| ------------------------------ | --------------------- | ------------------------------------ |
| `microsoft_docs_search`        | Search official docs  | First pass discovery, finding topics |
| `microsoft_docs_fetch`         | Get full page content | Deep dive into important pages       |
| `microsoft_code_sample_search` | Find code examples    | Get implementation patterns          |

### CLI Alternative

If the Learn MCP server is not available, use the `mslearn` CLI via Bash instead:

```bash
# Run directly (no install needed)

> _See SKILL.md for full content._

## Creation Process

### Step 1: Investigate the Topic

Build deep understanding using Learn MCP tools in three phases:

**Phase 1 — Scope Discovery:**

```text
microsoft_docs_search(query="{technology} overview what is")
microsoft_docs_search(query="{technology} concepts architecture")
microsoft_docs_search(query="{technology} getting started tutorial")
```

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

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

## Reference Index

| File                                                           | Purpose                                                                                   |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [references/skill-templates.md](references/skill-templates.md) | Ready-to-use templates for SDK/Library, Azure Service, Framework, and API/Protocol skills |
