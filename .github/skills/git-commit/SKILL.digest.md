<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Git Commit with Conventional Commits (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Overview

Create standardized, semantic git commits using the Conventional Commits specification.
Analyze the actual diff to determine appropriate type, scope, and message.

## Conventional Commit Format

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

> _See SKILL.md for full content._

## Commit Types

| Type       | Purpose                        |
| ---------- | ------------------------------ |
| `feat`     | New feature                    |
| `fix`      | Bug fix                        |
| `docs`     | Documentation only             |
| `style`    | Formatting/style (no logic)    |

> _See SKILL.md for full content._

## Breaking Changes

```text
# Exclamation mark after type/scope
feat!: remove deprecated endpoint

# BREAKING CHANGE footer
feat: allow config to extend other configs

> _See SKILL.md for full content._

## Workflow

### 1. Analyze Diff

```bash
# If files are staged, use staged diff
git diff --staged

> _See SKILL.md for full content._

## Best Practices

- One logical change per commit
- Present tense: "add" not "added"
- Imperative mood: "fix bug" not "fixes bug"
- Reference issues: `Closes #123`, `Refs #456`
- Keep description under 72 characters

## Git Safety Protocol

- NEVER update git config
- NEVER run destructive commands (--force, hard reset) without explicit request
- NEVER skip hooks (--no-verify) unless user asks
- NEVER force push to main/master
- If commit fails due to hooks, fix and create NEW commit (don't amend)
