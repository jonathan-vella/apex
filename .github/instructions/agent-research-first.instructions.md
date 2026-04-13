---
description: "Research-before-implementation requirements for all agents"
applyTo: "**/*.agent.md, **/agent-output/**/*.md"
---

# Research Before Implementation

All agents gather context before producing output. This ensures complete,
one-shot execution without missing context or requiring multiple iterations.

## Pre-Implementation Checklist

Before creating output files or making changes:

1. Search workspace for existing patterns (`agent-output/`, similar projects, templates)
2. Read relevant templates in `.github/skills/azure-artifacts/templates/`
3. Query documentation via MCP tools (Azure docs, best practices) where applicable
4. Confirm all required artifacts from previous workflow steps exist
5. Check shared defaults in `.github/skills/azure-defaults/SKILL.md`
6. Proceed when you have sufficient context to produce a complete artifact

## Context Gathering

Use read-only tools first to build understanding before making changes:

- `semantic_search` / `grep_search` — find related code, patterns, documentation
- `read_file` / `list_dir` — read templates, existing artifacts, configuration
- Azure MCP tools — query documentation, best practices, SKU info, AVM metadata

## Validation Gate

Before implementation, confirm:

1. Required inputs exist — previous step artifacts are present and complete
2. Templates loaded — output structure template has been read
3. Standards reviewed — shared defaults and naming conventions understood
4. Azure guidance obtained — relevant documentation queried (where applicable)

## Delegation for Deep Research

When extensive research is needed, delegate to a subagent. Instruct the
subagent to work autonomously and return findings without pausing for
user feedback.

## Rules

- Research before creating files
- Read templates before generating output
- Query Azure docs before recommending services
- Validate inputs before proceeding to next step
- Ask for clarification when context is insufficient rather than assuming

See [Azure Defaults Skill](../skills/azure-defaults/SKILL.md) for shared
research requirements.
