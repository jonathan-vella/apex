---
description: "Guidelines for creating high-quality Agent Skills for GitHub Copilot"
applyTo: "**/.github/skills/**/SKILL.md, **/.claude/skills/**/SKILL.md"
---

# Agent Skills File Guidelines

Agent Skills are folders of instructions, scripts, and resources that Copilot
loads on demand. They follow the [Agent Skills open standard](https://agentskills.io/)
and work across VS Code, Copilot CLI, and Copilot coding agent.

For the complete official reference, see
[VS Code Agent Skills docs](https://code.visualstudio.com/docs/copilot/customization/agent-skills).

## Required SKILL.md Frontmatter

```yaml
---
name: webapp-testing
description: "Toolkit for testing local web apps using Playwright. Use when asked to verify frontend functionality, debug UI behavior, or capture screenshots."
---
```

| Field                      | Required | Constraints                                                                        |
| -------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `name`                     | Yes      | Lowercase, hyphens for spaces, max 64 chars. **Must match parent directory name.** |
| `description`              | Yes      | State **WHAT** it does, **WHEN** to use it, and **KEYWORDS**; max 1024 chars       |
| `argument-hint`            | No       | Hint text shown in chat input when invoked as a `/` slash command                  |
| `user-invocable`           | No       | Boolean, default `true`. Set `false` to hide from `/` menu                         |
| `disable-model-invocation` | No       | Boolean, default `false`. Set `true` to require manual `/` invocation only         |
| `license`                  | No       | Reference to `LICENSE.txt` or SPDX identifier                                      |

**Name matching rule**: The `name` field MUST match its parent directory.
If the directory is `.github/skills/webapp-testing/`, the name must be
`webapp-testing`. Mismatched names prevent the skill from loading.

**Description is the discovery key**: Copilot reads ONLY `name` +
`description` to decide whether to load a skill. A vague description
means the skill never activates.

**NEVER use YAML block scalars** (`>`, `>-`, `|`, `|-`) for description.
Use a single-line `description: "..."` inline string.
Block scalars break VS Code prompts-diagnostics-provider.

## Slash Command Visibility

Skills are available as `/` slash commands alongside prompt files.
Use `user-invocable` and `disable-model-invocation` to control access:

| Configuration                    | In `/` menu | Auto-loaded by model | Use case               |
| -------------------------------- | ----------- | -------------------- | ---------------------- |
| Default (both omitted)           | Yes         | Yes                  | General-purpose skills |
| `user-invocable: false`          | No          | Yes                  | Background knowledge   |
| `disable-model-invocation: true` | Yes         | No                   | On-demand only         |
| Both set                         | No          | No                   | Disabled               |

## Skill Locations

| Scope        | Path                                                           |
| ------------ | -------------------------------------------------------------- |
| Workspace    | `.github/skills/`, `.claude/skills/`, `.agents/skills/`        |
| User profile | `~/.copilot/skills/`, `~/.claude/skills/`, `~/.agents/skills/` |
| Custom       | Configured via `chat.agentSkillsLocations` setting             |

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
- Use relative paths for all resource references (e.g., `[script](./run-tests.js)`)
- Use `#tool:<tool-name>` to reference agent tools in body text
- No hardcoded credentials or secrets
- Include `--help` documentation and error handling in scripts

## Wiring a Skill to an Agent

Skills are wired by referencing them in the agent body, **not** by an entry
in `tools/registry/agent-registry.json`. The orphan-content validator
(`tools/scripts/validate-orphaned-content.mjs`) discovers references at
runtime by scanning agent bodies, other skills, and instruction files for
the canonical pattern:

```text
.github/skills/{name}/SKILL.md
.github/skills/{name}/SKILL.digest.md
.github/skills/{name}/SKILL.minimal.md
```

Any of these three filenames count as a wiring reference. Use whichever
tier matches the agent's context budget — `SKILL.digest.md` is the default
for context-window-optimized agents; `SKILL.minimal.md` is reserved for
>80% utilization or explicit minimal-mode flags; full `SKILL.md` is for
skill-authoring or debugging contexts.

The validator also accepts:

- References without the leading `.github/` prefix (`skills/{name}/SKILL.md`)
- References inside fenced shell code blocks (e.g., `cat .github/skills/{name}/SKILL.digest.md`)

References to `references/` or `templates/` subpaths inside the same skill
are picked up via fallback containment checks but are not the preferred
wiring form. Use the canonical SKILL[.tier].md pattern for explicit wiring.

## Validation Checklist

- [ ] Valid frontmatter with `name` and `description`
- [ ] `name` is lowercase with hyphens, ≤64 characters, matches directory name
- [ ] `description` states WHAT, WHEN, and KEYWORDS
- [ ] Body ≤500 lines; large content in `references/`
- [ ] Scripts include help docs and error handling
- [ ] No hardcoded credentials

## Per-Step File Re-Read Budget (HARD LIMIT)

Agents driving a workflow step (`.github/agents/0*-*.agent.md`) MUST treat
predecessor artifacts as session-cached. The rule:

- Read `agent-output/{project}/04-implementation-plan.md`,
  `agent-output/{project}/04-governance-constraints.{md,json}`, and
  `agent-output/{project}/02-architecture-assessment.md` at most **twice**
  per Step (once at boot, once during a re-validation pass at most). Every
  further lookup against these artifacts MUST use
  `apex-recall show <project> --json` (or
  `apex-recall search <project> '<term>' --json`) against the cached
  session state — NOT a fresh `read_file` of the disk artifact.
- Subagents (`bicep-validate-subagent`, `terraform-validate-subagent`,
  `challenger-review-subagent`) receive a **compressed digest** of the
  plan + governance constraints from their parent agent — they do not
  re-read the source artifacts unless the parent explicitly omits the
  digest and the prompt instructs them to.
- The May 2026 nordic-foods retro showed `04-implementation-plan.md` read
  6× and `04-governance-constraints.md` read 4× in a single Step 5 run.
  Each redundant read shipped ~7 KB into a 200 K context. The cache
  contract closes that hole.

**Validator**: `npm run validate:context-budget` enforces a structural
floor — every agent that declares one of the frozen artifacts under a
"Prerequisites Check" / "Read at startup" / "Context budget" heading must
also reference `apex-recall show` (the cached read path) and contain a
phrase forbidding redundant reads ("do not re-read predecessor artifacts",
"frozen_inputs", or "plan_readonly").

## Resources

- [Agent Skills Specification](https://agentskills.io/)
- [VS Code Agent Skills Docs](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
- [Reference skills repository](https://github.com/anthropics/skills)
