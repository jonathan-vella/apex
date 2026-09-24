---
description: "Guidelines for creating high-quality Agent Skills for GitHub Copilot"
applyTo: "**/.github/skills/**/SKILL.md, **/.claude/skills/**/SKILL.md"
---

# Agent Skills File Guidelines

Agent Skills are folders of instructions, scripts, and resources that Copilot
loads on demand, following the [Agent Skills open standard](https://agentskills.io/).
This file holds the enforced APEX rules; locations, body sections, directory layout,
progressive loading, writing style and the full `context` policy live in the
[skill authoring reference](../skills/apex-agent-authoring/references/skill-authoring.md).

## Required SKILL.md Frontmatter

```yaml
---
name: apex-webapp-testing
description: "Toolkit for testing local web apps using Playwright. Use when asked to verify frontend functionality, debug UI behavior, or capture screenshots."
---
```

| Field                      | Required | Constraints                                                                        |
| -------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `name`                     | Yes      | Lowercase, hyphens for spaces, max 64 chars. **Must match parent directory name.** |
| `description`              | Yes      | State **WHAT**, **WHEN**, and **KEYWORDS**; platform max 1024 chars, APEX max 500 |
| `argument-hint`            | No       | Concise non-secret slash input hint; APEX: non-empty single line, max 160 chars |
| `user-invocable`           | No       | Boolean, default `true`. Set `false` to hide from `/` menu                         |
| `disable-model-invocation` | No       | Boolean, default `false`. Set `true` to require manual `/` invocation only         |
| `context`                  | No       | `inline` (default) or experimental `fork`; omit for current APEX skills |
| `license`                  | No       | Reference to `LICENSE.txt` or SPDX identifier                                      |

**Name matching rule**: Repository-owned skills MUST use exactly one `apex-`
prefix, lowercase kebab-case, and at most 64 characters. The frontmatter `name`
MUST match its parent directory. If the directory is
`.github/skills/apex-webapp-testing/`, the name must be `apex-webapp-testing`.
Mismatched names prevent the skill from loading. Leave external user/plugin
skills unchanged; preserve upstream identity and attribution when adapting
repository-owned skills. Do not create wrapper skills to enforce the prefix.

**Description is the discovery key**: Copilot reads ONLY `name` +
`description` to decide whether to load a skill. A vague description
means the skill never activates.

**NEVER use YAML block scalars** (`>`, `>-`, `|`, `|-`) for description.
Use a single-line `description: "..."` inline string.
Block scalars break VS Code prompts-diagnostics-provider.

## Slash Command Visibility

In Local chat, skills are available as `/` slash commands alongside prompt files.
Use `user-invocable` and `disable-model-invocation` to control access:

| `user-invocable` | `disable-model-invocation` | In `/` menu | Model-loadable | APEX use |
| --- | --- | --- | --- | --- |
| `true` (default) | `false` (default) | Yes | Yes | Task skills |
| `false` | `false` | No | Yes | Internal guidance |
| `true` | `true` | Yes | No | Explicit manual workflows |
| `false` | `true` | No | No | Forbidden for active skills: unreachable |

Use actual YAML booleans, not quoted strings. Omitted fields retain their defaults.
Keep internal `apex-azure-defaults`, `apex-azure-artifacts`,
`apex-azure-bicep-patterns`, `apex-terraform-patterns`, `apex-iac-common`,
`apex-golden-principles`, and `apex-workflow-engine` hidden but model-loadable.
Preserve their required agent-body loading references. Task skills are normally visible and model-loadable.
Explicit exceptions `apex-unslop`, `apex-vendor-prompting` and `apex-terraform-search-import`
remain visible and manual-only, as do Host adapters. Do not read a manual-only skill body automatically to bypass
its flag. Explicit user-selected prompt adapters may load their owning manual skill for that requested operation.
Hints do not validate arguments, confer permissions, or grant approval. Never
request passwords, tokens, keys, or secret-bearing share links in hints. Omit
hints for hidden guidance. Treat hiding a skill as a slash-access change and
update live callers and public guidance; it does not prove reduced discovery tokens.

### Context Policy

Keep all current skills inline by omitting `context`. `context: fork` is experimental
and not adopted; production policy tests prohibit it. Adoption conditions are in the
[skill authoring reference](../skills/apex-agent-authoring/references/skill-authoring.md#context-policy).

### Local And Agent Host

Local prompt files are adapters, not Agent Host entry points. On Agent Host, use
the shared skill and explicitly select its owning main agent before consequential
work. Skills inherit the caller's model/tools; they do not switch agents or grant
permissions. Skill discovery and invocation flags do not override production
human-selection boundaries. Keep needed Local discovery settings and verify each
harness separately; authoring checks do not prove runtime attachment or support.

## Wiring a Skill to an Agent

Skills are wired by referencing them in the agent body, **not** by an entry
in `tools/registry/agent-registry.json`. The orphan-content validator
(`tools/scripts/validate-orphaned-content.mjs`) discovers references at
runtime by scanning agent bodies, other skills, and instruction files for
the canonical pattern:

```text
.github/skills/{name}/SKILL.md
```

There is one tier. Use this filename for every wiring reference.

The validator also accepts:

- References without the leading `.github/` prefix (`skills/{name}/SKILL.md`)
- References inside fenced shell code blocks (e.g., `cat .github/skills/{name}/SKILL.md`)

References to `references/` or `templates/` subpaths inside the same skill
are picked up via fallback containment checks but are not the preferred
wiring form. Use the canonical `SKILL.md` pattern for explicit wiring.

## Validation Checklist

- [ ] Valid frontmatter with `name` and `description`
- [ ] `name` is lowercase with hyphens, ≤64 characters, matches directory name
- [ ] `description` states WHAT, WHEN, and KEYWORDS
- [ ] Body ≤500 lines; large content in `references/` (each starting with a `<!-- ref:{slug}-v1 -->` marker)
- [ ] Scripts include help docs and error handling
- [ ] No hardcoded credentials or secrets

## Per-Step File Re-Read Budget (HARD LIMIT)

Agents driving a workflow step (`.github/agents/0*-*.agent.md`) MUST treat
predecessor artifacts as session-cached while their content is unchanged and
available in context. The rule:

- Read `agent-output/{project}/04-implementation-plan.md`,
  `agent-output/{project}/04-governance-constraints.{md,json}`, and
  `agent-output/{project}/02-architecture-assessment.md` at most **twice**
  per Step for the same available, unchanged inputs (once at boot, once during
  re-validation). Prefer further lookups through
  `apex-recall show <project> --json` (or
  `apex-recall search <project> '<term>' --json`) against the cached
  session state. If recall lacks required detail, the source changed, or
  compaction/new chat removed context, refresh only the needed sections.
  This budget never permits guessing missing constraints or skipping validation.
- Subagents (`bicep-validate-subagent`, `terraform-validate-subagent`,
  `challenger-review-subagent`) receive a **compressed digest** of the
  plan + governance constraints from their parent agent — they do not
  re-read unchanged source artifacts when the digest is sufficient and current.
  Missing or stale evidence requires a targeted source read or return to the parent;
  a digest cannot substitute for required schema, hash, or live governance checks.
- Rationale (measured redundant reads): see the
  [skill authoring reference](../skills/apex-agent-authoring/references/skill-authoring.md#why-the-re-read-budget-exists).

**Validator**: `npm run validate:context-budget` enforces a structural
floor for non-subagent consumers: a frozen artifact filename must occur on
the same line as `**REQUIRED**` to trigger the check. Those consumers need
`apex-recall show` and a recognized marker ("do not re-read predecessor artifacts",
"no self-edit", "frozen_inputs", "plan_readonly", "plan-lock", or
"plan-readiness precondition"). Headings alone do not trigger it. It does not
count runtime reads, validate cache freshness, or prove instruction attachment;
those remain execution/review responsibilities.
