<!-- ref:step-by-step-guide-v1 -->

# Step-by-Step Skill Creation Guide

Detailed instructions for creating a new Agent Skill from scratch.

## Step 1: Create the Skill Directory

Create a new folder with a lowercase, hyphenated name:

```text
skills/<skill-name>/
└── SKILL.md          # Required
```

## Step 2: Generate SKILL.md with Frontmatter

Every skill requires YAML frontmatter with `name` and `description`:

```yaml
---
name: <skill-name>
description: "<What it does>. Use when <specific triggers, scenarios, keywords users might say>."
---
```

### Frontmatter Field Requirements

| Field           | Required | Constraints                                                                |
| --------------- | -------- | -------------------------------------------------------------------------- |
| `name`          | **Yes**  | 1-64 chars, lowercase letters/numbers/hyphens only, must match folder name |
| `description`   | **Yes**  | 1-1024 chars, must describe WHAT it does AND WHEN to use it                |
| `license`       | No       | License name or reference to bundled LICENSE.txt                           |
| `compatibility` | No       | 1-500 chars, environment requirements if needed                            |
| `metadata`      | No       | Key-value pairs for additional properties                                  |
| `allowed-tools` | No       | Space-delimited list of pre-approved tools (experimental)                  |

### Description Best Practices

**CRITICAL**: The `description` is the PRIMARY mechanism for automatic skill discovery. Include:

1. **WHAT** the skill does (capabilities)
2. **WHEN** to use it (triggers, scenarios, file types)
3. **Keywords** users might mention in prompts

**Good example** — single-line inline string (required):

```yaml
description: "Toolkit for testing local web applications using Playwright. Use when asked to verify frontend functionality, debug UI behavior, capture browser screenshots, or view browser console logs. Supports Chrome, Firefox, and WebKit."
```

**Poor examples** — NEVER use these:

```yaml
# ❌ YAML block scalar — breaks Copilot skill discovery
description: >
  Toolkit for testing local web applications...

# ❌ Too short — not enough context for skill routing
description: "Web testing helpers"
```

> **Rule**: `description` MUST be a single-line inline string. YAML block scalars
> (`>` or `|`) cause the runtime to receive a literal `">"` instead of your text,
> silently disabling skill auto-discovery.

## Step 3: Write the Skill Body

After the frontmatter, add markdown instructions. Recommended sections:

| Section                     | Purpose                         |
| --------------------------- | ------------------------------- |
| `# Title`                   | Brief overview                  |
| `## When to Use This Skill` | Reinforces description triggers |
| `## Prerequisites`          | Required tools, dependencies    |
| `## Step-by-Step Workflows` | Numbered steps for tasks        |
| `## Troubleshooting`        | Common issues and solutions     |
| `## References`             | Links to bundled docs           |

## Step 4: Add Optional Directories (If Needed)

| Folder        | Purpose                            | When to Use                         |
| ------------- | ---------------------------------- | ----------------------------------- |
| `scripts/`    | Executable code (Python, Bash, JS) | Automation that performs operations |
| `references/` | Documentation agent reads          | API references, schemas, guides     |
| `assets/`     | Static files used AS-IS            | Images, fonts, templates            |
| `templates/`  | Starter code agent modifies        | Scaffolds to extend                 |
