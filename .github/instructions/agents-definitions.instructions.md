---
description: "Standards for Copilot custom agent definition files"
applyTo: "**/*.agent.md"
---

# Agent Definition Standards

These instructions apply to custom agent definition files (for example: `.github/agents/*.agent.md`).

Goals:

- Keep agent behavior consistent and predictable across the repo
- Avoid drift between agents and the authoritative standards in `.github/instructions/`
- Prevent invalid YAML front matter and broken internal links

## Front Matter (Required)

Each `.agent.md` file MUST start with valid YAML front matter:

- Use `---` to open and close the front matter.
- Use spaces (no tabs).
- Keep keys simple and consistent.

Recommended minimum fields:

```yaml
---
name: { Human-friendly agent name }
description: { 1-2 sentences, specific scope }
tools:
  - { tool-id-or-pattern }
handoffs:
  - { other-agent-id }
---
```

### `name`

- Clear, human-friendly display name.
- Keep it stable (renames can confuse users and docs).

### `description`

- Describe what the agent does, and what it does NOT do.
- Mention any required standards (WAF, AVM-first, default regions) if applicable.

### `tools`

- List only tool identifiers that are actually available in the environment.
- Prefer patterns when supported (for example: `azure-pricing/*`).
- If the agent should not call tools, set `tools: []` explicitly.

### `handoffs`

- Use `handoffs` to connect workflow steps (for example: Architect -> Bicep Plan -> Bicep Code).
- Only reference agents that actually exist in the repo.
- Use Title Case for the `agent` value matching the agent's display `name` (from frontmatter).
  For example: `agent: Architect` (matching `name: Architect` in frontmatter).

### `model`

> [!IMPORTANT]
> **Model selection is intentional and must not be changed without explicit approval.**

Agents that specify `Claude Opus 4.6` as priority model do so deliberately:

- **Opus-first agents** (requirements, architect, bicep-plan) require advanced reasoning
  for accurate planning decisions, WAF assessments, and governance discovery
- **Sonnet-first agents** (bicep-code, deploy) prioritize speed for implementation tasks

**Rules:**

1. **Never reorder models** to put Sonnet before Opus if Opus is currently first
2. **Planning accuracy trumps cost/speed** - incorrect plans waste more resources than Opus costs
3. When adding `model` arrays, match the pattern of similar workflow-stage agents
4. Document any model changes in PR description with justification

## Shared Defaults (Required)

All top-level workflow agents in `.github/agents/` MUST read the `azure-defaults` skill for shared
knowledge. Include a reference near the top of the agent body:

```text
Read `.github/skills/azure-defaults/SKILL.md` FIRST for regional standards, naming conventions,
security baseline, and workflow integration patterns common to all agents.
```

All agent definitions live in `.github/agents/`. Subagents live in
`.github/agents/_subagents/`.

## Authoritative Standards (Avoid Drift)

When an agent outputs a specific document type, it MUST treat these as authoritative:

- Cost estimates: `.github/instructions/cost-estimate.instructions.md`
- Workload docs: `.github/instructions/workload-documentation.instructions.md`
- Markdown style: `.github/instructions/markdown.instructions.md`
- Bicep: `.github/instructions/bicep-code-best-practices.instructions.md`

If an agent contains an embedded template in its body, it MUST match the relevant instruction file.

## Templates in Agent Bodies

- Prefer short templates that are easy to keep aligned with standards.
- If you include fenced code blocks inside a fenced template, use quadruple fences (` ```` `)
  for the outer fence to avoid accidental termination.
- Keep example templates realistic, but do not hardcode secrets, subscription IDs, or tenant IDs.

## Links

- Prefer relative links for repo content.
- Verify links resolve from the agent file’s directory (relative paths in Markdown are file-relative).
- Avoid linking to files that don’t exist.

## Writing Style

- Use ATX headings (`##`, `###`).
- Keep markdown lines <= 120 characters.
- Use tables for decision matrices, comparisons, and checklists.

## Quick Self-Check (Before PR)

- `tools:` only contains valid tool IDs/patterns
- `handoffs:` only references real agents
- The `azure-defaults` skill reference is correct
- Embedded templates match `.github/instructions/*` standards
- `npm run lint:md` passes
