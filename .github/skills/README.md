# Skills

This directory contains Agent Skills for GitHub Copilot. Skills are reusable,
domain-specific procedures and knowledge loaded according to their invocation flags.

## Skill Name Migration

Repository skills use exactly one `apex-` prefix. The migration rule is
`<previous-name>` to `apex-<previous-name>` for both the immediate directory and
its `SKILL.md` name. For example, `azure-defaults` becomes `apex-azure-defaults`
and `mermaid` becomes `apex-mermaid`.

This is a breaking name/path change: update explicit skill invocations and
repository skill paths in your own integrations. No old-name wrappers remain.
Public npm commands, instruction filenames, agent identities, and external
or user-profile skills are unchanged. Imported licenses, attribution, upstream
URLs, and provenance metadata remain intact. Discovery descriptions route to
the new installed names; natural-language trigger phrases remain unchanged.

The tracked [migration map and retention decisions](../../tools/tests/exec-plans/active/apex-workflow-audit.md#skill-merger-and-retirement-plan)
list every original and new name, provenance, and rollback boundaries. To roll
back, revert the naming commit and its consumer changes together; do not restore
only the directories. For upstream refreshes, map the original upstream skill
name to its prefixed local directory and review the diff to retain APEX adaptations.

## Available Skills

> The tables below show representative skills by category. For the complete
> catalog, list all `SKILL.md` files: `find .github/skills -name SKILL.md`.
> See `tools/registry/count-manifest.json` for current counts.

### Category 1: Azure Conventions

| Skill                  | Description                                          | Triggers                                         |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `apex-azure-defaults`       | Azure conventions, naming, AVM, WAF, pricing, tags   | "azure defaults", "naming", "AVM"                |
| `apex-azure-artifacts`      | Template H2 structures, styling, generation rules    | "generate documentation", "create runbook"       |
| `apex-azure-bicep-patterns` | Reusable Bicep patterns (hub-spoke, PE, diagnostics) | "bicep pattern", "private endpoint", "hub-spoke" |
| `apex-azure-diagnostics`    | KQL templates, health checks, remediation playbooks  | "diagnose", "troubleshoot", "health check"       |

### Category 2: Document Creation

| Skill             | Description                                           | Triggers                                  |
| ----------------- | ----------------------------------------------------- | ----------------------------------------- |
| `apex-python-diagrams` | WAF/cost/compliance charts and Python diagrams        | "WAF chart", "cost chart", "create chart" |
| `apex-mermaid`         | Inline Mermaid diagrams for markdown                  | "mermaid diagram", "flowchart"            |
| `apex-azure-adr`       | Create Architecture Decision Records with WAF mapping | "create ADR", "document decision"         |

### Category 3: Workflow & Tool Integration

| Skill                 | Description                               | Triggers                                                                        |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| `apex-agent-authoring`   | Create and restructure Copilot agents     | "create agent", "agent architecture", "reduce agent tokens"                  |
| `apex-github-operations` | Branch naming, commits, PRs, CLI, Actions | "commit", "create PR", "gh command"                                             |
| `apex-docs-writer`       | Manual documentation maintenance | `/apex-docs-writer` or a user-selected docs prompt adapter |
| `apex-vendor-prompting`  | Manual vendor prompting audit | `/apex-vendor-prompting` |
| `apex-terraform-search-import` | Manual Terraform discovery/import workflow | `/apex-terraform-search-import` |

### Procedure Ownership

- [apex-unslop](apex-unslop/SKILL.md) provides manual-only prose cleanup via `/apex-unslop`.
   It preserves technical facts and file contracts; no production agent loads it as a required step.
- [apex-docs-writer](apex-docs-writer/SKILL.md) owns doc gardening, docs peer review,
   and Astro docs review. Review-only and opt-in fix modes remain procedure-specific.
- [apex-agent-authoring](apex-agent-authoring/SKILL.md) owns agent fleet and `.github`
   authoring assessments, plus reference-only assessment design history.
- [apex-context-management](apex-context-management/SKILL.md) owns log export, context audit,
   and runtime compression. A supplied profile can inform an authoring scorecard without moving runtime ownership.
- [apex-workflow-engine](apex-workflow-engine/SKILL.md) owns workflow entry, recovery, and DAG routing.

### Local And Agent Host

Local `.prompt.md` files are adapters; they are not Host entry points. Agent Host uses
manual skills such as `apex-host-workflow-start`, `apex-host-git-commit`, and
`apex-host-debug-log-export`. Select the required owning agent first. For recovery,
explicitly request the `resume` operation through `apex-host-workflow-start`.
Skills inherit the caller's model/tools and never grant permissions or select an agent.
Source checks do not prove runtime availability, attachment, or model eligibility.

## Usage

### Automatic Activation

Eligible skills can load when your request matches their description.
`disable-model-invocation: true` requires manual invocation; `user-invocable: false`
hides a skill from the slash menu. Defaults are `false` and `true`, respectively.
Neither flag overrides production human-selection or approval gates.

```text
"Create an architecture diagram for the ecommerce project"
→ apex-python-diagrams skill activates
```

### Explicit Invocation

Manual-only maintenance skills: `/apex-unslop`, `/apex-docs-writer`, `/apex-vendor-prompting` and
`/apex-terraform-search-import`. They are not required production-agent loads. Documentation obligations,
vendor validators and import/apply approval gates still apply. Skill metadata may remain discoverable;
manual-only does not guarantee a measured token reduction.

Reference the skill by name for explicit activation:

```text
"Use the apex-azure-adr skill to document our database decision"
```

### Via Agent Handoff

Agents can invoke skills through self-referencing handoffs:

```text
Architect agent → "▶ Generate Architecture Diagram" button
→ Uses apex-python-diagrams skill
```

## Skill vs Agent

| Aspect          | Agents                          | Skills                            |
| --------------- | ------------------------------- | --------------------------------- |
| **Invocation**  | `Ctrl+Shift+A` manual selection | Automatic or explicit             |
| **Scope**       | Workflow steps with handoffs    | Focused, single-purpose tasks     |
| **State**       | Conversational context          | Stateless                         |
| **When to use** | Multi-step processes            | Specific document/output creation |

## Creating New Skills

Follow the structure in
[agent-skills.instructions.md](../instructions/agent-skills.instructions.md):

1. Copy an existing `SKILL.md` (e.g. `apex-azure-defaults/SKILL.md`) as a template.
2. Update the frontmatter (`name`, `description`, `compatibility`) per
   the instruction file's rules.
3. Place deep reference material under `references/` (loaded on demand).
4. Run `npm run validate:skills` and `npm run validate:agents` to verify.

Use the authoring instructions to review frontmatter quality. Required documentation updates use the applicable
file instructions; the user may invoke `/apex-docs-writer` explicitly for its extended maintenance workflow.
