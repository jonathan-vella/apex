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
```

### Key Principles

- **Frontmatter is critical**: `name` and `description` determine when the skill triggers — be clear and comprehensive

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
npx @microsoft/learn-cli search "semantic kernel overview"

# Or install globally, then run
npm install -g @microsoft/learn-cli
mslearn search "semantic kernel overview"

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

**Phase 2 — Core Content:**

```text
microsoft_docs_fetch(url="...")  # Fetch pages from Phase 1
microsoft_code_sample_search(query="{technology}", language="{lang}")

> _See SKILL.md for full content._

## Common Investigation Patterns

See `references/investigation-patterns.md` for SDK/Library, Azure Service, and
Framework/Platform search query templates, plus a complete Semantic Kernel example.

## Reference Index

| File                                                                         | Purpose                                                                                   |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [references/skill-templates.md](references/skill-templates.md)               | Ready-to-use templates for SDK/Library, Azure Service, Framework, and API/Protocol skills |
| [references/investigation-patterns.md](references/investigation-patterns.md) | Investigation query patterns and complete Semantic Kernel example                         |
