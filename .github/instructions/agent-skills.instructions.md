---
description: "Guidelines for creating high-quality Agent Skills for GitHub Copilot"
applyTo: "**/.github/skills/**/SKILL.md, **/.claude/skills/**/SKILL.md"
---

# Agent Skills File Guidelines

## Required SKILL.md Frontmatter

```yaml
---
name: webapp-testing
description: >-
  Toolkit for testing local web applications using Playwright. Use when asked
  to verify frontend functionality, debug UI behavior, or capture screenshots.
license: Complete terms in LICENSE.txt
---
```

| Field         | Required | Constraints                                                               |
| ------------- | -------- | ------------------------------------------------------------------------- |
| `name`        | Yes      | Lowercase, hyphens for spaces, max 64 characters                          |
| `description` | Yes      | State **WHAT** it does, **WHEN** to use it, and **KEYWORDS**; max 1024 ch |
| `license`     | No       | Reference to `LICENSE.txt` or SPDX identifier                             |

> **CRITICAL**: The `description` is the PRIMARY mechanism for automatic skill discovery.
> Copilot reads ONLY `name` + `description` to decide whether to load a skill.
> A vague description means the skill never activates.

## Body Sections

| Section                     | Purpose                                             |
| --------------------------- | --------------------------------------------------- |
| `# Title`                   | Brief overview of what this skill enables           |
| `## When to Use This Skill` | List of scenarios (reinforces description triggers) |
| `## Prerequisites`          | Required tools, dependencies, environment setup     |
| `## Step-by-Step Workflows` | Numbered steps for common tasks                     |
| `## Troubleshooting`        | Common issues and solutions table                   |
| `## References`             | Links to bundled docs or external resources         |

## Directory Structure

```text
.github/skills/<skill-name>/
├── SKILL.md              # Required: Main instructions (≤500 lines)
├── LICENSE.txt            # Recommended: License terms
├── scripts/              # Executable automation (loaded when executed)
├── references/           # Documentation (loaded when referenced by SKILL.md)
├── assets/               # Static files used AS-IS in output (not loaded into context)
└── templates/            # Starter code the AI agent MODIFIES and builds upon
```

**Assets vs Templates**: If the AI reads and builds upon it → `templates/`.
If the file is used as-is in output → `assets/`.

## Progressive Loading

| Level           | What Loads                    | When                              |
| --------------- | ----------------------------- | --------------------------------- |
| 1. Discovery    | `name` and `description` only | Always (lightweight metadata)     |
| 2. Instructions | Full `SKILL.md` body          | When request matches description  |
| 3. Resources    | Scripts, examples, docs       | Only when Copilot references them |

## Writing Rules

- Imperative mood: "Run", "Create", "Configure"
- Include exact commands with parameters
- Keep SKILL.md body ≤500 lines; split large workflows into `references/`
- Use relative paths for all resource references
- Include `--help` documentation and error handling in scripts
- No hardcoded credentials or secrets

## Validation Checklist

- [ ] Valid frontmatter with `name` and `description`
- [ ] `name` is lowercase with hyphens, ≤64 characters
- [ ] `description` states WHAT, WHEN, and KEYWORDS
- [ ] Body ≤500 lines; large content in `references/`
- [ ] Scripts include help docs and error handling
- [ ] No hardcoded credentials

## Resources

- [Agent Skills Specification](https://agentskills.io/)
- [VS Code Agent Skills Docs](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
