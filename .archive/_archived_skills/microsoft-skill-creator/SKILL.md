---
name: microsoft-skill-creator
description: "Create agent skills for Microsoft technologies using Learn MCP tools. USE FOR: generating skills that teach agents about Azure services, .NET libraries, Microsoft 365 APIs, VS Code extensions, Bicep modules, or any Microsoft technology. DO NOT USE FOR: general skill scaffolding without Microsoft tech focus (use make-skill-template), Azure infrastructure deployment, Bicep/Terraform code generation."
compatibility: Works with Microsoft Learn MCP Server (https://learn.microsoft.com/api/mcp). Can also use the mslearn CLI as a fallback.
license: MIT
metadata:
  author: microsoftdocs
  version: "1.0"
  category: meta-skill
---

# Microsoft Skill Creator

Create hybrid skills for Microsoft technologies that store essential knowledge
locally while enabling dynamic Learn MCP lookups for deeper details.

> **This repo convention**: After generating skill content with this skill,
> use the **`make-skill-template`** skill to ensure the output follows
> this repo's SKILL.md frontmatter conventions and directory structure
> (see `.github/instructions/agent-skills.instructions.md`).

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
- **Concise is key**: Only include what agents don't already know; context window is shared
- **No duplication**: Information lives in SKILL.md OR reference files, not both

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
```

| MCP Tool                                                      | CLI Command                                |
| ------------------------------------------------------------- | ------------------------------------------ |
| `microsoft_docs_search(query: "...")`                         | `mslearn search "..."`                     |
| `microsoft_code_sample_search(query: "...", language: "...")` | `mslearn code-search "..." --language ...` |
| `microsoft_docs_fetch(url: "...")`                            | `mslearn fetch "..."`                      |

Generated skills should include this same CLI fallback table so agents can use either path.

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
```

**Phase 3 — Depth:**

```text
microsoft_docs_search(query="{technology} best practices")
microsoft_docs_search(query="{technology} troubleshooting errors")
```

#### Investigation Checklist

After investigating, verify:

- [ ] Can explain what the technology does in one paragraph
- [ ] Identified 3–5 key concepts
- [ ] Have working code for basic usage
- [ ] Know the most common API patterns
- [ ] Have search queries for deeper topics

### Step 2: Clarify with User

Present findings and ask:

1. "I found these key areas: [list]. Which are most important?"
2. "What tasks will agents primarily perform with this skill?"
3. "Which programming language should code samples prioritize?"

### Step 3: Generate the Skill

Use the appropriate template from [skill-templates.md](references/skill-templates.md):

| Technology Type                   | Template           |
| --------------------------------- | ------------------ |
| Client library, NuGet/npm package | SDK/Library        |
| Azure resource                    | Azure Service      |
| App development framework         | Framework/Platform |
| REST API, protocol                | API/Protocol       |

#### Generated Skill Structure

```text
{skill-name}/
├── SKILL.md                    # Core knowledge + Learn MCP guidance
├── references/                 # Detailed local documentation (if needed)
└── sample_codes/               # Working code examples
    ├── getting-started/
    └── common-patterns/
```

### Step 4: Balance Local vs Dynamic Content

**Store locally when:**

- Foundational (needed for any task)
- Frequently accessed
- Stable (won't change)
- Hard to find via search

**Keep dynamic when:**

- Exhaustive reference (too large)
- Version-specific
- Situational (specific tasks only)
- Well-indexed (easy to search)

| Content Type          | Local               | Dynamic             |
| --------------------- | ------------------- | ------------------- |
| Core concepts (3–5)   | Full                |                     |
| Hello world code      | Full                |                     |
| Common patterns (3–5) | Full                |                     |
| Top API methods       | Signature + example | Full docs via fetch |
| Best practices        | Top 5 bullets       | Search for more     |
| Troubleshooting       |                     | Search queries      |
| Full API reference    |                     | Doc links           |

### Step 5: Validate

1. Review: Is local content sufficient for common tasks?
2. Test: Do suggested search queries return useful results?
3. Verify: Do code samples run without errors?

## Common Investigation Patterns

See `references/investigation-patterns.md` for SDK/Library, Azure Service, and
Framework/Platform search query templates, plus a complete Semantic Kernel example.

## Reference Index

| File                                                                         | Purpose                                                                                   |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [references/skill-templates.md](references/skill-templates.md)               | Ready-to-use templates for SDK/Library, Azure Service, Framework, and API/Protocol skills |
| [references/investigation-patterns.md](references/investigation-patterns.md) | Investigation query patterns and complete Semantic Kernel example                         |
