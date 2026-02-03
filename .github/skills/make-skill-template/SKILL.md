---
name: make-skill-template
# yamllint disable-line rule:line-length
description: >
  Interactive skill creator for GitHub Copilot. Use when asked to "create a skill",
  "make a new skill", "scaffold a skill", "convert agent to skill", "build a skill
  interactively", or "help me create a skill". Guides through use case definition,
  category selection, and iterative refinement. Generates SKILL.md files with proper
  frontmatter, directory structure, and optional scripts/references/assets folders.
---

# Make Skill Template

An interactive meta-skill for creating new Agent Skills. Guides users through defining
use cases, selecting the right skill category, and iteratively refining the skill until
it meets quality standards.

## When to Use This Skill

- User asks to "create a skill", "make a new skill", or "scaffold a skill"
- User asks to "convert an agent to a skill" or "migrate agent to skill"
- User wants "help building a skill interactively"
- User needs help structuring a skill with bundled resources
- User wants to duplicate this template as a starting point

## Do NOT Use For

- General documentation or writing tasks (not skill creation)
- Creating agents (`.agent.md` files) - use agent definitions instead
- One-off code generation that doesn't warrant a reusable skill

## Prerequisites

- Understanding of what the skill should accomplish
- A clear, keyword-rich description of capabilities and triggers
- Knowledge of any bundled resources needed (scripts, references, assets, templates)

---

## Interactive Skill Creation Workflow

### Phase 1: Define Use Cases (Trigger/Steps/Result)

Start by defining 2-3 concrete use cases using this format:

```markdown
### Use Case 1: [Name]

- **Trigger**: What does the user say or do?
- **Steps**: What actions does the skill perform?
- **Result**: What output does the user receive?
```

**Example:**

```markdown
### Use Case 1: Generate Architecture Diagram

- **Trigger**: "Create an architecture diagram for my Azure infrastructure"
- **Steps**: Read Bicep files → Extract resources → Generate Python diagram code → Execute
- **Result**: PNG image saved to agent-output/{project}/
```

### Phase 2: Select Skill Category

| Category | Description | Best For |
|----------|-------------|----------|
| **Category 1** | Document Creation | ADRs, diagrams, reports, single-file outputs |
| **Category 2** | Workflow Automation | Multi-step processes, file generation, deployments |
| **Category 3** | Tool Integration | CLI wrappers, API clients, external services |

**Selection criteria:**

- If output is primarily a document → Category 1
- If output requires multiple steps with validation → Category 2
- If skill wraps external tools/APIs → Category 3

### Phase 3: Draft the Skill

Generate initial SKILL.md with:

1. **Frontmatter** with keyword-rich description
2. **When to Use** section matching use cases
3. **Do NOT Use For** section (negative triggers)
4. **Step-by-step workflows** for each use case
5. **Troubleshooting** table

### Phase 4: Iterative Refinement

Review the draft against this checklist:

| Aspect | Question | Fix If No |
|--------|----------|-----------|
| **Triggering** | Does description include all keywords from use cases? | Add missing keywords |
| **Clarity** | Are steps specific and actionable? | Rewrite vague steps |
| **Completeness** | Does it handle edge cases? | Add troubleshooting |
| **Negative triggers** | Does "Do NOT Use" prevent false positives? | Add exclusions |

Iterate until all checks pass.

---

## Agent-to-Skill Conversion Workflow

When converting an existing `.agent.md` to a skill:

### Step 1: Extract Core Capabilities

From the agent file, identify:

- **Purpose**: What does the agent do? (becomes skill description)
- **Triggers**: When is the agent invoked? (becomes "When to Use")
- **Outputs**: What files/artifacts are produced? (becomes workflows)
- **References**: What documentation does it use? (becomes `references/` folder)

### Step 2: Map Agent Sections to Skill Sections

| Agent Section | Skill Section |
|---------------|---------------|
| `description:` in frontmatter | `description:` with more keywords |
| Core Purpose / When to Use | `## When to Use This Skill` |
| Workflow steps | `## Step-by-Step Workflows` |
| Guardrails / DO NOT | `## Do NOT Use For` (negative triggers) |
| Reference links | `references/` folder with linked docs |
| Template references | `templates/` folder |

### Step 3: Enhance for Skill Discovery

Skills rely on description keywords for discovery, so:

1. Extract all trigger phrases from agent handoffs
2. Add action verbs: "generate", "create", "build", "document"
3. Add file types: ".py", ".md", "PNG", "diagram"
4. Add domain keywords: "Azure", "architecture", "ADR"

### Step 4: Create Directory Structure

```
.github/skills/{skill-name}/
├── SKILL.md                    # Converted instructions
├── references/                 # Documentation from agent
│   └── (copied from agent refs)
└── templates/                  # If agent used templates
    └── (copied from .github/templates/)
```

---

### Step 1: Create the Skill Directory

Create a new folder with a lowercase, hyphenated name:

```
skills/<skill-name>/
└── SKILL.md          # Required
```

### Step 2: Generate SKILL.md with Frontmatter

Every skill requires YAML frontmatter with `name` and `description`:

```yaml
---
name: <skill-name>
description: '<What it does>. Use when <specific triggers, scenarios, keywords users might say>.'
---
```

#### Frontmatter Field Requirements

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | **Yes** | 1-64 chars, lowercase letters/numbers/hyphens only, must match folder name |
| `description` | **Yes** | 1-1024 chars, must describe WHAT it does AND WHEN to use it |
| `license` | No | License name or reference to bundled LICENSE.txt |
| `compatibility` | No | 1-500 chars, environment requirements if needed |
| `metadata` | No | Key-value pairs for additional properties |
| `allowed-tools` | No | Space-delimited list of pre-approved tools (experimental) |

#### Description Best Practices

**CRITICAL**: The `description` is the PRIMARY mechanism for automatic skill discovery. Include:

1. **WHAT** the skill does (capabilities)
2. **WHEN** to use it (triggers, scenarios, file types)
3. **Keywords** users might mention in prompts

**Good example:**

```yaml
description: >
  Toolkit for testing local web applications using Playwright.
  Use when asked to verify frontend functionality, debug UI behavior,
  capture browser screenshots, or view browser console logs.
  Supports Chrome, Firefox, and WebKit.
```

**Poor example:**

```yaml
description: 'Web testing helpers'
```

### Step 3: Write the Skill Body

After the frontmatter, add markdown instructions. Recommended sections:

| Section | Purpose |
|---------|---------|
| `# Title` | Brief overview |
| `## When to Use This Skill` | Reinforces description triggers |
| `## Prerequisites` | Required tools, dependencies |
| `## Step-by-Step Workflows` | Numbered steps for tasks |
| `## Troubleshooting` | Common issues and solutions |
| `## References` | Links to bundled docs |

### Step 4: Add Optional Directories (If Needed)

| Folder | Purpose | When to Use |
|--------|---------|-------------|
| `scripts/` | Executable code (Python, Bash, JS) | Automation that performs operations |
| `references/` | Documentation agent reads | API references, schemas, guides |
| `assets/` | Static files used AS-IS | Images, fonts, templates |
| `templates/` | Starter code agent modifies | Scaffolds to extend |

## Example: Complete Skill Structure

```
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

| Issue | Cause | Solution |
|-------|-------|----------|
| Skill not discovered | Description lacks keywords | Add trigger phrases and action verbs |
| Skill triggers too often | Description too broad | Add "Do NOT Use For" section |
| Validation fails on name | Invalid characters | Use lowercase, hyphens only, match folder name |
| Description too short | Missing context | Add WHAT, WHEN, and KEYWORDS |
| Assets not found | Wrong path | Use relative paths from skill root |
| Skill won't trigger | Description mismatch | Test with exact phrases from use cases |

## Success Criteria

A well-designed skill should:

- [ ] **Trigger correctly** on paraphrased requests (not just exact matches)
- [ ] **NOT trigger** on unrelated requests (negative triggers work)
- [ ] **Produce consistent output** across multiple invocations
- [ ] **Complete in reasonable time** (no excessive tool calls)
- [ ] **Handle errors gracefully** with clear messages

## References

- Agent Skills official spec: <https://agentskills.io/specification>
- Anthropic Skills Guide: <https://docs.anthropic.com/en/docs/build-with-claude/agentic-skills>
