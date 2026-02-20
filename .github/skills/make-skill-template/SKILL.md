---
name: make-skill-template
description: Scaffolds new GitHub Copilot Agent Skills from prompts or templates, generating SKILL.md frontmatter, folder structure, and optional bundled resources.
---

# Make Skill Template

A meta-skill for creating new Agent Skills. Use this skill when you need to scaffold
a new skill folder, generate a SKILL.md file, or help users understand the Agent Skills
specification.

## When to Use This Skill

- User asks to "create a skill", "make a new skill", or "scaffold a skill"
- User wants to add a specialized capability to their GitHub Copilot setup
- User needs help structuring a skill with bundled resources
- User wants to duplicate this template as a starting point

## Prerequisites

- Understanding of what the skill should accomplish
- A clear, keyword-rich description of capabilities and triggers
- Knowledge of any bundled resources needed (scripts, references, assets, templates)

## Creating a New Skill

### Step 1: Create the Skill Directory

Create a new folder with a lowercase, hyphenated name:

```text
skills/<skill-name>/
└── SKILL.md          # Required
```

### Step 2: Generate SKILL.md with Frontmatter

Every skill requires YAML frontmatter with `name` and `description`:

```yaml
---
name: <skill-name>
description: "<What it does>. Use when <specific triggers, scenarios, keywords users might say>."
---
```

#### Frontmatter Field Requirements

| Field           | Required | Constraints                                                                |
| --------------- | -------- | -------------------------------------------------------------------------- |
| `name`          | **Yes**  | 1-64 chars, lowercase letters/numbers/hyphens only, must match folder name |
| `description`   | **Yes**  | 1-1024 chars, must describe WHAT it does AND WHEN to use it                |
| `license`       | No       | License name or reference to bundled LICENSE.txt                           |
| `compatibility` | No       | 1-500 chars, environment requirements if needed                            |
| `metadata`      | No       | Key-value pairs for additional properties                                  |
| `allowed-tools` | No       | Space-delimited list of pre-approved tools (experimental)                  |

#### Description Best Practices

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

### Step 3: Write the Skill Body

After the frontmatter, add markdown instructions. Recommended sections:

| Section                     | Purpose                         |
| --------------------------- | ------------------------------- |
| `# Title`                   | Brief overview                  |
| `## When to Use This Skill` | Reinforces description triggers |
| `## Prerequisites`          | Required tools, dependencies    |
| `## Step-by-Step Workflows` | Numbered steps for tasks        |
| `## Troubleshooting`        | Common issues and solutions     |
| `## References`             | Links to bundled docs           |

### Step 4: Add Optional Directories (If Needed)

| Folder        | Purpose                            | When to Use                         |
| ------------- | ---------------------------------- | ----------------------------------- |
| `scripts/`    | Executable code (Python, Bash, JS) | Automation that performs operations |
| `references/` | Documentation agent reads          | API references, schemas, guides     |
| `assets/`     | Static files used AS-IS            | Images, fonts, templates            |
| `templates/`  | Starter code agent modifies        | Scaffolds to extend                 |

## Example: Complete Skill Structure

```text
my-awesome-skill/
├── SKILL.md                    # Required instructions
├── LICENSE.txt                 # Optional license file
├── scripts/
│   └── helper.py               # Executable automation
├── references/
│   ├── api-reference.md        # Detailed docs
│   └── examples.md             # Usage examples
├── assets/
│   └── diagram.png             # Static resources
└── templates/
    └── starter.ts              # Code scaffold
```

## Quick Start: Duplicate This Template

1. Copy the `make-skill-template/` folder
2. Rename to your skill name (lowercase, hyphens)
3. Update `SKILL.md`:
   - Change `name:` to match folder name
   - Write a keyword-rich `description:`
   - Replace body content with your instructions
4. Add bundled resources as needed
5. Validate with `npm run skill:validate`

## Validation Checklist

- [ ] Folder name is lowercase with hyphens
- [ ] `name` field matches folder name exactly
- [ ] `description` is 10-1024 characters
- [ ] `description` explains WHAT and WHEN
- [ ] `description` is wrapped in single quotes
- [ ] Body content is under 500 lines
- [ ] Bundled assets are under 5MB each

## Troubleshooting

| Issue                    | Solution                                                 |
| ------------------------ | -------------------------------------------------------- |
| Skill not discovered     | Improve description with more keywords and triggers      |
| Validation fails on name | Ensure lowercase, no consecutive hyphens, matches folder |
| Description too short    | Add capabilities, triggers, and keywords                 |
| Assets not found         | Use relative paths from skill root                       |

## Project-Specific Scaffold Templates

When creating skills for *this* project, use one of these skeletons that match
the conventions already established in the repository.

### Azure Knowledge Skill Skeleton

For skills that teach agents about Azure patterns, conventions, or diagnostics:

```yaml
---
name: azure-{topic}
description: {What it does including Azure context}. Use when {triggers and keywords}.
compatibility: Requires Azure CLI with Bicep extension
---
```

```markdown
# Azure {Topic} Skill

One-sentence overview of what this skill provides.

---

## Quick Reference

| Pattern / Capability | When to Use |
| -------------------- | ----------- |
| ...                  | ...         |

---

## {Pattern/Section Name}

Explanation and code example:

\```bicep
// example
\```

---

## Learn More

| Topic | How to Find |
| ----- | ----------- |
| ...   | `microsoft_docs_search(query="...")` |
```

### Integration Skill Skeleton

For skills that wrap external tools, MCP servers, or CLIs:

```yaml
---
name: {tool-name}
description: {What it does}. Use when {triggers}.
compatibility: Requires {tool/dependency}
---
```

```markdown
# {Tool Name} Skill

Overview of the integration.

---

## Quick Reference

| Tool / Command | Purpose |
| -------------- | ------- |
| ...            | ...     |

---

## Workflow

### Step 1: ...
### Step 2: ...

---

## Troubleshooting

| Issue | Solution |
| ----- | -------- |
| ...   | ...      |
```

### Checklist: Before Committing a New Skill

- [ ] Folder uses lowercase-hyphenated name matching `name:` field
- [ ] `description` is a single-line inline string (no YAML block scalars)
- [ ] `description` includes WHAT, WHEN, and keywords
- [ ] Body uses `---` horizontal rules between major sections
- [ ] Tables used for structured data instead of prose lists
- [ ] Code examples are project-relevant (Bicep, KQL, Azure CLI)
- [ ] `## Learn More` section references `microsoft_docs_search()` where applicable
- [ ] Added to `.github/skills/README.md` under the correct category
- [ ] Added to `.github/copilot-instructions.md` skills table
- [ ] Wired into consuming agents via mandatory read list

## References

- Agent Skills official spec: <https://agentskills.io/specification>
