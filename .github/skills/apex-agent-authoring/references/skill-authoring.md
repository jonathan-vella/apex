<!-- ref:skill-authoring-v1 -->

# Skill Authoring Reference

On-demand detail for [`agent-skills.instructions.md`](../../../instructions/agent-skills.instructions.md),
which holds the enforced rules. Official references: the
[Agent Skills specification](https://agentskills.io/) and the
[VS Code Agent Skills docs](https://code.visualstudio.com/docs/agent-customization/agent-skills).

## Skill Locations

| Scope        | Path                                                           |
| ------------ | -------------------------------------------------------------- |
| APEX workspace | `.github/skills/` |
| Personal Copilot skills | `~/.copilot/skills/` |
| Additional repository roots | `skillDirectories` in `.github/copilot/settings.json` |

These are APEX's supported authoring locations, not an exhaustive list of vendor formats.
The Local-only `chat.agentSkillsLocations` setting is not read by Copilot harness sessions.
Use the official [SDK discovery contract](https://github.com/github/copilot-sdk/blob/main/docs/features/customization-locations.md)
for additional directory semantics; listing a root grants no general filesystem permission.

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
├── LICENSE.txt           # Recommended: License terms
├── scripts/              # Executable automation (loaded when executed)
├── references/           # Documentation (loaded when referenced by SKILL.md)
├── assets/               # Static files used AS-IS in output (not loaded into context)
└── templates/            # Starter code the AI agent MODIFIES and builds upon
```

If the AI reads and builds upon a file, it belongs in `templates/`; if it is used as-is
in output, it belongs in `assets/`. Every `references/*.md` file starts with a
`<!-- ref:{slug}-v1 -->` canary marker.

## Progressive Loading

| Level           | What Loads                    | When                              |
| --------------- | ----------------------------- | --------------------------------- |
| 1. Discovery    | `name` and `description` only | Always (lightweight metadata)     |
| 2. Instructions | Full `SKILL.md` body          | When request matches description  |
| 3. Resources    | Scripts, examples, docs       | Only when Copilot references them |

## Writing Style

- Imperative mood: "Run", "Create", "Configure"; include exact commands with parameters.
- Use relative paths for resource references (e.g., `[script](./run-tests.js)`).
- Use `#tool:<tool-name>` to reference agent tools in body text.
- Scripts include `--help` documentation and error handling.

## Context Policy

Keep all current skills inline by omitting `context`. The validator accepts
generic `inline`/`fork` syntax; production policy tests separately prohibit fork.
`context: fork` is experimental and requires `github.copilot.chat.skillTool.enabled`;
do not enable it or infer support from another harness. Adoption requires a separately
approved, fully specified read-only experiment with bounded output, citations,
missing-input and unavailable-tool checks, permission tests and measured context
evidence in each intended harness. Standalone docs lookup or VM comparison may
qualify; mixed-purpose skills and parent-context guidance do not.
Never move questions, approvals, workflow transitions or required parent rules
into a fork, or bypass main-agent selection and existing review/pricing workers.
Isolation does not authorize writes, export, authentication, secrets or network
access. Unsupported execution must stop; never silently change mode or fabricate
results. Current fork adoption remains deferred, not runtime-certified.

## Why The Re-Read Budget Exists

The May 2026 nordic-foods retro showed `04-implementation-plan.md` read
6× and `04-governance-constraints.md` read 4× in a single Step 5 run.
Each redundant read shipped ~7 KB into a 200 K context. The per-step
re-read budget in the instruction file closes that hole.
